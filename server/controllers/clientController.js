const { validationResult } = require("express-validator");
const Client = require("../models/Client");
const User = require("../models/User");
const Task = require("../models/Task");
const Contact = require("../models/Contact");
const ClientGroup = require("../models/ClientGroup");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const { nextClientFileNo } = require("../utils/autoId");
const { normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");

// Managers can assign clients to themselves or task_only users only — not to other managers or admins.
async function ensureManagerCanAssignClient(req, assignedUser) {
  if (req.user.role !== "manager" || !assignedUser) return null;
  if (String(assignedUser) === String(req.user._id)) return null; // self-assign always OK
  const target = await User.findById(assignedUser).select("role");
  if (!target) return { status: 404, message: "Assigned user not found" };
  // Managers can only assign to themselves or task_only users
  if (target.role !== "task_only") {
    return { status: 403, message: "Managers can only assign clients to themselves or task-only users." };
  }
  return null;
}

const populateClient = [{ path: "assignedUser", select: "name" }, { path: "group", select: "name" }, { path: "createdBy", select: "name" }];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFileNo(value) {
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
}

async function findExistingFileNo(fileNo, excludeId) {
  const normalized = normalizeFileNo(fileNo);
  if (!normalized) return null;

  const query = { fileNo: new RegExp(`^${escapeRegex(normalized)}$`, "i") };
  if (excludeId) query._id = { $ne: excludeId };
  return Client.findOne(query).select("fileNo");
}

function buildDuplicateClauses(data) {
  const clauses = [];
  const legalName = data.legalName?.trim();
  const vatTrn = data.vatDetails?.trn?.trim();
  const licenceNumbers = (data.tradeLicences || [])
    .map((licence) => licence?.licenceNumber?.trim())
    .filter(Boolean);

  if (legalName) clauses.push({ legalName: new RegExp(`^${escapeRegex(legalName)}$`, "i") });
  if (vatTrn) clauses.push({ "vatDetails.trn": vatTrn });
  licenceNumbers.forEach((licenceNumber) => clauses.push({ "tradeLicences.licenceNumber": licenceNumber }));

  return clauses;
}

async function findDuplicateClient(data, excludeId) {
  const clauses = buildDuplicateClauses(data);
  if (!clauses.length) return null;

  const query = {
    isActive: true,
    $or: clauses,
  };
  if (excludeId) query._id = { $ne: excludeId };

  return Client.findOne(query);
}

function duplicateMessage(client, payload) {
  const legalName = payload.legalName?.trim();
  const vatTrn = payload.vatDetails?.trn?.trim();
  const licenceNumbers = new Set(
    (payload.tradeLicences || [])
      .map((licence) => licence?.licenceNumber?.trim())
      .filter(Boolean),
  );

  if (legalName && client.legalName?.trim().toLowerCase() === legalName.toLowerCase()) {
    return `A client with legal name "${legalName}" already exists.`;
  }
  if (vatTrn && client.vatDetails?.trn === vatTrn) {
    return `A client with VAT TRN "${vatTrn}" already exists.`;
  }
  const matchingLicence = client.tradeLicences?.find((licence) => licenceNumbers.has(licence.licenceNumber));
  if (matchingLicence?.licenceNumber) {
    return `A client with trade licence "${matchingLicence.licenceNumber}" already exists.`;
  }
  return "A matching client already exists.";
}

function findInvalidContactMobile(contactPersons = []) {
  return -1;
}

function findMissingContactName(contactPersons = []) {
  return contactPersons.findIndex((contact) => !String(contact?.fullName || "").trim());
}

function findInvalidEmiratesId(contactPersons = []) {
  const pattern = /^\d{3}-\d{4}-\d{7}-\d$/;
  return contactPersons.findIndex((contact) => {
    const value = String(contact?.emiratesId?.number || "").trim();
    if (!value) return false;
    return !pattern.test(value);
  });
}

function validateVatTrn(vatDetails = {}) {
  const status = String(vatDetails?.status || "").trim();
  const trn = String(vatDetails?.trn || "").trim();
  if (status === "registered" && !trn) return "VAT TRN is required when VAT status is registered.";
  if (trn && !/^1\d{14}$/.test(trn)) return "VAT TRN must be a 15-digit number starting with 1.";
  return null;
}

function buildUploadedFile(req) {
  if (!req.file) return null;
  const url = req.file.path?.startsWith?.("http")
    ? req.file.path
    : `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  return {
    name: req.file.originalname,
    size: `${Math.round(req.file.size / 1024)} KB`,
    fileType: req.file.mimetype,
    url,
  };
}

exports.listClients = async (req, res, next) => {
  try {
    const { search, jurisdiction, group, assignedUser, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (jurisdiction) query.jurisdiction = jurisdiction;
    if (group) query.group = group;
    if (assignedUser) query.assignedUser = assignedUser;
    if (req.user.role === "task_only") {
      // task_only users may only see clients whose tasks are assigned to them.
      const assignedClientIds = await Task.find({ assignedTo: req.user._id }).distinct("client");
      query._id = { $in: assignedClientIds };
    }
    if (search) {
      query.$or = [
        { legalName: new RegExp(search, "i") },
        { tradeName: new RegExp(search, "i") },
        { "vatDetails.trn": new RegExp(search, "i") },
        { "tradeLicences.licenceNumber": new RegExp(search, "i") },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [clients, total] = await Promise.all([
      Client.find(query).populate(populateClient).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Client.countDocuments(query),
    ]);
    res.json({ clients, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
  } catch (error) { next(error); }
};

exports.getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id).populate(populateClient).populate("attachments.uploadedBy", "name");
    if (!client || !client.isActive) return res.status(404).json({ message: "Client not found" });
    if (req.user.role === "task_only") {
      // task_only users may only access a client if they have at least one task assigned to them for that client.
      const hasTask = await Task.exists({ client: client._id, assignedTo: req.user._id });
      if (!hasTask) return res.status(403).json({ message: "Forbidden" });
    }
    res.json(client);
  } catch (error) { next(error); }
};

exports.createClient = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const clientAssignError = await ensureManagerCanAssignClient(req, req.body.assignedUser);
    if (clientAssignError) return res.status(clientAssignError.status).json({ message: clientAssignError.message });
    const vatTrnError = validateVatTrn(req.body.vatDetails);
    if (vatTrnError) return res.status(400).json({ message: vatTrnError });
    const invalidEidIndex = findInvalidEmiratesId(req.body.contactPersons);
    if (invalidEidIndex >= 0) return res.status(400).json({ message: `Contact person ${invalidEidIndex + 1}: Emirates ID must match 784-XXXX-XXXXXXX-X.` });
    if (req.body.group) {
      const groupExists = await ClientGroup.exists({ _id: req.body.group });
      if (!groupExists) return res.status(400).json({ message: "Selected group not found." });
    }
    const missingContactNameIndex = findMissingContactName(req.body.contactPersons);
    if (missingContactNameIndex >= 0) return res.status(400).json({ message: `Contact person ${missingContactNameIndex + 1}: Full name is required.` });
    const invalidContactIndex = findInvalidContactMobile(req.body.contactPersons);
    if (invalidContactIndex >= 0) return res.status(400).json({ message: `Contact person ${invalidContactIndex + 1}: Invalid number.` });
    const emptyLicenceIndex = (req.body.tradeLicences || []).findIndex((l) => !l?.licenceNumber?.trim());
    if (req.body.tradeLicences?.length && emptyLicenceIndex >= 0) {
      return res.status(400).json({ message: `Trade licence ${emptyLicenceIndex + 1}: Licence number is required.` });
    }
    const customFileNo = normalizeFileNo(req.body.fileNo);
    if (customFileNo) {
      const existingFileNo = await findExistingFileNo(customFileNo);
      if (existingFileNo) return res.status(409).json({ message: `Client file number "${customFileNo}" already exists.` });
    }
    const duplicate = await findDuplicateClient(req.body);
    if (duplicate) return res.status(409).json({ message: duplicateMessage(duplicate, req.body) });
    const client = await Client.create({
      ...req.body,
      fileNo: customFileNo || await nextClientFileNo(),
      createdBy: req.user._id,
    });
    if (client.group) {
      await ClientGroup.findByIdAndUpdate(client.group, { $addToSet: { clients: client._id } });
    }
    const admins = await User.find({ role: "admin", isActive: true });
    await Notification.insertMany(admins.map((admin) => ({
      recipient: admin._id, title: "New client added", message: `${client.legalName} was added.`, type: "client_added", relatedClient: client._id,
    })));
    res.status(201).json(await client.populate(populateClient));
  } catch (error) { next(error); }
};

exports.updateClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || !client.isActive) return res.status(404).json({ message: "Client not found" });
    const originalFileNo = client.fileNo;
    if ("assignedUser" in req.body) {
      const clientAssignError = await ensureManagerCanAssignClient(req, req.body.assignedUser);
      if (clientAssignError) return res.status(clientAssignError.status).json({ message: clientAssignError.message });
    }
    if ("vatDetails" in req.body) {
      const vatTrnError = validateVatTrn({ ...(client.vatDetails || {}), ...(req.body.vatDetails || {}) });
      if (vatTrnError) return res.status(400).json({ message: vatTrnError });
    }
    if ("group" in req.body && req.body.group) {
      const groupExists = await ClientGroup.exists({ _id: req.body.group });
      if (!groupExists) return res.status(400).json({ message: "Selected group not found." });
    }
    if ("contactPersons" in req.body) {
      const invalidEidIndex = findInvalidEmiratesId(req.body.contactPersons);
      if (invalidEidIndex >= 0) return res.status(400).json({ message: `Contact person ${invalidEidIndex + 1}: Emirates ID must match 784-XXXX-XXXXXXX-X.` });
      const missingContactNameIndex = findMissingContactName(req.body.contactPersons);
      if (missingContactNameIndex >= 0) return res.status(400).json({ message: `Contact person ${missingContactNameIndex + 1}: Full name is required.` });
      const invalidContactIndex = findInvalidContactMobile(req.body.contactPersons);
      if (invalidContactIndex >= 0) return res.status(400).json({ message: `Contact person ${invalidContactIndex + 1}: Invalid number.` });
    }
    if ("tradeLicences" in req.body) {
      const emptyLicenceIndex = (req.body.tradeLicences || []).findIndex((l) => !l?.licenceNumber?.trim());
      if (req.body.tradeLicences?.length && emptyLicenceIndex >= 0) {
        return res.status(400).json({ message: `Trade licence ${emptyLicenceIndex + 1}: Licence number is required.` });
      }
    }
    const candidate = {
      legalName: "legalName" in req.body ? req.body.legalName : client.legalName,
      vatDetails: "vatDetails" in req.body ? req.body.vatDetails : client.vatDetails,
      tradeLicences: "tradeLicences" in req.body ? req.body.tradeLicences : client.tradeLicences,
    };
    if ("fileNo" in req.body) {
      const customFileNo = normalizeFileNo(req.body.fileNo);
      if (customFileNo) {
        const existingFileNo = await findExistingFileNo(customFileNo, client._id);
        if (existingFileNo) return res.status(409).json({ message: `Client file number "${customFileNo}" already exists.` });
      }
    }
    const duplicate = await findDuplicateClient(candidate, client._id);
    if (duplicate) return res.status(409).json({ message: duplicateMessage(duplicate, candidate) });
    // Bug #4 Fix: whitelist editable fields to prevent mass-assignment of fileNo, createdBy, isActive, etc.
    const ALLOWED = ["fileNo", "legalName", "tradeName", "clientType", "jurisdiction", "financialYearEnd", "assignedUser", "group", "registeredAddress", "correspondenceAddress", "tradeLicences", "contactPersons", "vatDetails", "ctDetails", "portalLogins", "customFields"];
    // Handle explicit ungroup: remove client from its current group and unset the reference.
    if ("group" in req.body && (req.body.group === null || req.body.group === "")) {
      if (client.group) {
        await ClientGroup.updateMany({ clients: client._id }, { $pull: { clients: client._id } });
      }
      client.group = undefined;
    }
    ALLOWED.forEach((key) => { if (key in req.body && !(key === "group" && (req.body.group === null || req.body.group === ""))) client[key] = req.body[key]; });
    if ("fileNo" in req.body) {
      client.fileNo = normalizeFileNo(req.body.fileNo) || originalFileNo;
    }
    await client.save();
    if ("group" in req.body && req.body.group) {
      await ClientGroup.updateMany({ clients: client._id }, { $pull: { clients: client._id } });
      await ClientGroup.findByIdAndUpdate(req.body.group, { $addToSet: { clients: client._id } });
    }
    res.json(await client.populate(populateClient));
  } catch (error) { next(error); }
};

exports.deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const taskIds = await Task.find({ client: client._id }).distinct("_id");
    if (taskIds.length) {
      await ActivityLog.deleteMany({ task: { $in: taskIds } });
      await Notification.deleteMany({
        $or: [
          { relatedTask: { $in: taskIds } },
          { relatedClient: client._id },
        ],
      });
      await Task.deleteMany({ client: client._id });
    } else {
      await Notification.deleteMany({ relatedClient: client._id });
    }

    await Contact.deleteMany({ client: client._id });
    await ClientGroup.updateMany({ clients: client._id }, { $pull: { clients: client._id } });
    await client.deleteOne();

    res.json({ message: "Client deleted permanently" });
  } catch (error) { next(error); }
};

exports.bulkUpload = async (req, res, next) => {
  try {
    // Bulk upload accepts already-parsed rows from the browser so the backend can focus on validation and dedupe.
    const rows = Array.isArray(req.body.rows) ? req.body.rows : req.body;
    let added = 0, skipped = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const trn = row.vatTrn || row.trn || row["VAT TRN"];
        const licence = row.licenceNumber || row.licence || row["Trade Licence No."];
        const exists = await findDuplicateClient({
          legalName: row.legalName || row.name,
          vatDetails: { trn },
          tradeLicences: licence ? [{ licenceNumber: licence }] : [],
        });
        if (exists) { skipped += 1; continue; }
        await Client.create({
          fileNo: await nextClientFileNo(),
          clientType: row.clientType || "legal",
          legalName: row.legalName || row.name,
          jurisdiction: row.jurisdiction || "mainland",
          vatDetails: { trn },
          tradeLicences: licence ? [{ licenceNumber: licence }] : [],
          createdBy: req.user._id,
        });
        added += 1;
      } catch (error) { errors.push({ row, message: error.message }); }
    }
    res.json({ added, skipped, errors });
  } catch (error) { next(error); }
};

exports.exportClients = async (req, res, next) => {
  try {
    const clients = await Client.find({ isActive: true }).populate("group", "name");
    const csv = ["File No,Name,Jurisdiction,Group,VAT TRN"].concat(clients.map((c) => [c.fileNo, c.legalName, c.jurisdiction, c.group?.name || "", c.vatDetails?.trn || ""].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))).join("\n");
    // Bug #2 Fix: res.attachment() was removed in Express 5; use setHeader instead.
    res.setHeader("Content-Disposition", 'attachment; filename="clients.csv"')
       .setHeader("Content-Type", "text/csv")
       .send(csv);
  } catch (error) { next(error); }
};

exports.uploadAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const uploadedFile = buildUploadedFile(req);
    if (!uploadedFile) return res.status(400).json({ message: "Please choose a file to upload" });
    client.attachments.push({
      name: uploadedFile.name,
      size: uploadedFile.size,
      fileType: uploadedFile.fileType,
      description: req.body.description,
      url: uploadedFile.url,
      uploadedBy: req.user._id,
    });
    await client.save();
    res.status(201).json(client.attachments);
  } catch (error) { next(error); }
};

exports.uploadClientDocument = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || !client.isActive) return res.status(404).json({ message: "Client not found" });
    const uploadedFile = buildUploadedFile(req);
    if (!uploadedFile) return res.status(400).json({ message: "Please choose a file to upload" });

    const index = Number(req.body.index);
    const section = req.body.section;
    const description = req.body.description || "";
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ message: "A valid document index is required" });

    if (section === "tradeLicences") {
      if (!client.tradeLicences[index]) return res.status(404).json({ message: "Trade licence not found" });
      client.tradeLicences[index].documentUrl = uploadedFile.url;
    } else if (section === "emiratesId") {
      if (!client.contactPersons[index]) return res.status(404).json({ message: "Contact person not found" });
      client.contactPersons[index].emiratesId = client.contactPersons[index].emiratesId || {};
      client.contactPersons[index].emiratesId.documentUrl = uploadedFile.url;
    } else if (section === "passport") {
      if (!client.contactPersons[index]) return res.status(404).json({ message: "Contact person not found" });
      client.contactPersons[index].passport = client.contactPersons[index].passport || {};
      client.contactPersons[index].passport.documentUrl = uploadedFile.url;
    } else {
      return res.status(400).json({ message: "Unsupported document section" });
    }

    client.attachments.push({
      name: uploadedFile.name,
      size: uploadedFile.size,
      fileType: uploadedFile.fileType,
      description,
      url: uploadedFile.url,
      uploadedBy: req.user._id,
    });
    await client.save();
    res.status(201).json(client);
  } catch (error) { next(error); }
};

exports.deleteAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    client.attachments.pull(req.params.attachId);
    await client.save();
    res.json(client.attachments);
  } catch (error) { next(error); }
};
