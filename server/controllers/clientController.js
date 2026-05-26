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

const populateClient = [
  { path: "assignedUser", select: "name" },
  { path: "group", select: "name" },
  { path: "createdBy", select: "name" },
  { path: "attachments.uploadedBy", select: "name" },
  { path: "tradeLicences.documents.uploadedBy", select: "name" },
  { path: "contactPersons.emiratesId.documents.uploadedBy", select: "name" },
  { path: "contactPersons.emiratesId.frontDocuments.uploadedBy", select: "name" },
  { path: "contactPersons.emiratesId.backDocuments.uploadedBy", select: "name" },
  { path: "contactPersons.passport.documents.uploadedBy", select: "name" },
];

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

function toUploadedFile(file, req) {
  const url = file.path?.startsWith?.("http")
    ? file.path
    : `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
  return {
    name: file.originalname,
    size: `${Math.round(file.size / 1024)} KB`,
    fileType: file.mimetype,
    url,
  };
}

function buildUploadedFiles(req) {
  const fieldFiles = Object.values(req.files || {}).flat();
  const files = fieldFiles.length ? fieldFiles : (req.file ? [req.file] : []);
  return files.map((file) => toUploadedFile(file, req));
}

function toStoredFileEntry(uploadedFile, userId, description = "") {
  return {
    name: uploadedFile.name,
    size: uploadedFile.size,
    fileType: uploadedFile.fileType,
    description,
    url: uploadedFile.url,
    uploadedBy: userId,
  };
}

function uploadedFileSignature(file) {
  return `${String(file?.name || "").trim().toLowerCase()}::${file?.size || ""}`;
}

function normalizeDocumentSection(section) {
  const value = String(section || "").trim().toLowerCase();
  const aliases = {
    tradelicence: "tradeLicences",
    tradelicences: "tradeLicences",
    tradelicense: "tradeLicences",
    tradelicenses: "tradeLicences",
    emiratesid: "emiratesId",
    emiratesidfront: "emiratesIdFront",
    emiratesidback: "emiratesIdBack",
    passport: "passport",
  };
  return aliases[value] || section;
}

function getDocumentContainer(client, section, index) {
  if (!Number.isInteger(index) || index < 0) return null;
  const normalizedSection = normalizeDocumentSection(section);
  if (normalizedSection === "tradeLicences") {
    const item = client.tradeLicences[index];
    if (!item) return null;
    item.documents = Array.isArray(item.documents) ? item.documents : [];
    return { holder: item, key: "documents", sync(container) { container.documentUrl = container.documents.at(-1)?.url || ""; } };
  }
  if (normalizedSection === "emiratesId") {
    const item = client.contactPersons[index];
    if (!item) return null;
    item.emiratesId = item.emiratesId || {};
    item.emiratesId.documents = Array.isArray(item.emiratesId.documents) ? item.emiratesId.documents : [];
    return { holder: item.emiratesId, key: "documents", sync(container) { container.documentUrl = container.documents.at(-1)?.url || ""; } };
  }
  if (normalizedSection === "emiratesIdFront") {
    const item = client.contactPersons[index];
    if (!item) return null;
    item.emiratesId = item.emiratesId || {};
    item.emiratesId.frontDocuments = Array.isArray(item.emiratesId.frontDocuments) ? item.emiratesId.frontDocuments : [];
    return { holder: item.emiratesId, key: "frontDocuments", sync(container) { container.frontDocumentUrl = container.frontDocuments.at(-1)?.url || ""; } };
  }
  if (normalizedSection === "emiratesIdBack") {
    const item = client.contactPersons[index];
    if (!item) return null;
    item.emiratesId = item.emiratesId || {};
    item.emiratesId.backDocuments = Array.isArray(item.emiratesId.backDocuments) ? item.emiratesId.backDocuments : [];
    return { holder: item.emiratesId, key: "backDocuments", sync(container) { container.backDocumentUrl = container.backDocuments.at(-1)?.url || ""; } };
  }
  if (normalizedSection === "passport") {
    const item = client.contactPersons[index];
    if (!item) return null;
    item.passport = item.passport || {};
    item.passport.documents = Array.isArray(item.passport.documents) ? item.passport.documents : [];
    return { holder: item.passport, key: "documents", sync(container) { container.documentUrl = container.documents.at(-1)?.url || ""; } };
  }
  return null;
}

function normalizeTradeLicencesForPersistence(tradeLicences = [], existingTradeLicences = []) {
  return (tradeLicences || []).map((licence, index) => {
    const existing = existingTradeLicences[index] || {};
    const documents = Array.isArray(licence?.documents)
      ? licence.documents
      : Array.isArray(existing.documents)
        ? existing.documents
        : [];
    return {
      ...licence,
      documents,
      documentUrl: licence?.documentUrl || documents[documents.length - 1]?.url || existing.documentUrl || "",
    };
  });
}

function normalizeContactPersonsForPersistence(contactPersons = [], existingContactPersons = []) {
  return (contactPersons || []).map((contact, index) => {
    const existing = existingContactPersons[index] || {};
    const existingEmiratesId = existing.emiratesId || {};
    const existingPassport = existing.passport || {};
    const emiratesIdDocuments = Array.isArray(contact?.emiratesId?.documents)
      ? contact.emiratesId.documents
      : Array.isArray(existingEmiratesId.documents)
        ? existingEmiratesId.documents
        : [];
    const frontDocuments = Array.isArray(contact?.emiratesId?.frontDocuments)
      ? contact.emiratesId.frontDocuments
      : Array.isArray(existingEmiratesId.frontDocuments)
        ? existingEmiratesId.frontDocuments
        : [];
    const backDocuments = Array.isArray(contact?.emiratesId?.backDocuments)
      ? contact.emiratesId.backDocuments
      : Array.isArray(existingEmiratesId.backDocuments)
        ? existingEmiratesId.backDocuments
        : [];
    const passportDocuments = Array.isArray(contact?.passport?.documents)
      ? contact.passport.documents
      : Array.isArray(existingPassport.documents)
        ? existingPassport.documents
        : [];
    return {
      ...contact,
      emiratesId: {
        ...(contact.emiratesId || {}),
        documents: emiratesIdDocuments,
        frontDocuments,
        backDocuments,
        documentUrl: contact?.emiratesId?.documentUrl || emiratesIdDocuments[emiratesIdDocuments.length - 1]?.url || existingEmiratesId.documentUrl || "",
        frontDocumentUrl: contact?.emiratesId?.frontDocumentUrl || frontDocuments[frontDocuments.length - 1]?.url || existingEmiratesId.frontDocumentUrl || "",
        backDocumentUrl: contact?.emiratesId?.backDocumentUrl || backDocuments[backDocuments.length - 1]?.url || existingEmiratesId.backDocumentUrl || "",
      },
      passport: {
        ...(contact.passport || {}),
        documents: passportDocuments,
        documentUrl: contact?.passport?.documentUrl || passportDocuments[passportDocuments.length - 1]?.url || existingPassport.documentUrl || "",
      },
    };
  });
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
    const client = await Client.findById(req.params.id).populate(populateClient);
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
    if (Array.isArray(req.body.tradeLicences)) {
      req.body.tradeLicences = normalizeTradeLicencesForPersistence(req.body.tradeLicences);
    }
    if (Array.isArray(req.body.contactPersons)) {
      req.body.contactPersons = normalizeContactPersonsForPersistence(req.body.contactPersons);
    }
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
    if (Array.isArray(req.body.tradeLicences)) {
      req.body.tradeLicences = normalizeTradeLicencesForPersistence(req.body.tradeLicences, client.tradeLicences || []);
    }
    if (Array.isArray(req.body.contactPersons)) {
      req.body.contactPersons = normalizeContactPersonsForPersistence(req.body.contactPersons, client.contactPersons || []);
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

// ─── Shared bulk-upload helpers ────────────────────────────────────────────────

const VALID_JURISDICTIONS = ["mainland", "freezone", "designated_zone", "offshore"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeBulkJurisdiction(raw) {
  const value = String(raw || "mainland").trim().toLowerCase().replace(/\s+/g, "_");
  if (value === "free_zone") return "freezone";
  return VALID_JURISDICTIONS.includes(value) ? value : "mainland";
}

function validateBulkRow(row) {
  const errors = [];
  if (!String(row.legalName || "").trim()) errors.push("legalName is required.");
  const clientType = String(row.clientType || "legal").trim().toLowerCase();
  if (!["legal", "natural"].includes(clientType)) errors.push("clientType must be 'legal' or 'natural'.");
  const trn = String(row.vatTrn || row.trn || "").trim();
  if (trn && !/^1\d{14}$/.test(trn)) errors.push("VAT TRN must be a 15-digit number starting with 1.");
  if (!String(row.contactName || "").trim()) errors.push("contactName is required.");
  const email = String(row.contactEmail || "").trim();
  if (!email) errors.push("contactEmail is required.");
  else if (!EMAIL_PATTERN.test(email)) errors.push("contactEmail is invalid.");
  if (!String(row.contactMobile || "").trim()) errors.push("contactMobile is required.");
  else if (!/^\d+$/.test(String(row.contactMobile).trim())) errors.push("contactMobile must contain only digits.");
  return errors;
}

async function resolveAssignedUser(emailId) {
  const email = String(emailId || "").trim().toLowerCase();
  if (!email) return undefined;
  const user = await User.findOne({ email, isActive: true }).select("_id");
  return user?._id || undefined;
}

function buildClientPayload(row, userId) {
  const trn = String(row.vatTrn || row.trn || "").trim();
  const licence = String(row.licenceNumber || "").trim();
  const contactCountryCode = String(row.contactCountryCode || "+971").trim();
  return {
    clientType: String(row.clientType || "legal").trim().toLowerCase(),
    legalName: String(row.legalName || "").trim(),
    tradeName: String(row.tradeName || "").trim() || undefined,
    jurisdiction: normalizeBulkJurisdiction(row.jurisdiction),
    vatDetails: trn ? { trn } : undefined,
    tradeLicences: licence ? [{ licenceNumber: licence }] : [],
    contactPersons: [{
      fullName: String(row.contactName || "").trim(),
      email: String(row.contactEmail || "").trim(),
      mobile: {
        countryCode: contactCountryCode,
        number: String(row.contactMobile || "").trim(),
      },
      isPrimary: true,
    }],
    createdBy: userId,
  };
}

// ─── v1: JSON-based bulk upload (updated with contacts + per-row results) ─────

exports.bulkUpload = async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : req.body;
    const results = [];
    let added = 0, failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const serial = row.serial || i + 1;
      const legalName = String(row.legalName || row.name || "").trim();

      try {
        // Validate row fields
        const validationErrors = validateBulkRow(row);
        if (validationErrors.length) {
          results.push({ serial, status: "error", legalName, error: validationErrors.join(" ") });
          failed++;
          continue;
        }

        const trn = String(row.vatTrn || row.trn || "").trim();
        const licence = String(row.licenceNumber || "").trim();

        // Duplicate check
        const exists = await findDuplicateClient({
          legalName,
          vatDetails: { trn },
          tradeLicences: licence ? [{ licenceNumber: licence }] : [],
        });
        if (exists) {
          results.push({ serial, status: "error", legalName, error: duplicateMessage(exists, { legalName, vatDetails: { trn }, tradeLicences: licence ? [{ licenceNumber: licence }] : [] }) });
          failed++;
          continue;
        }

        // Resolve assigned user by email
        const assignedUser = await resolveAssignedUser(row.assignedUserEmailId || row.assignedUser);

        const payload = buildClientPayload(row, req.user._id);
        if (assignedUser) payload.assignedUser = assignedUser;
        payload.fileNo = await nextClientFileNo();

        const client = await Client.create(payload);
        results.push({ serial, status: "success", legalName, clientId: client._id });
        added++;
      } catch (error) {
        results.push({ serial, status: "error", legalName, error: error.message });
        failed++;
      }
    }
    res.json({ results, summary: { total: rows.length, added, failed } });
  } catch (error) { next(error); }
};

// ─── v2: ZIP-based bulk upload with document processing ───────────────────────

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../config/cloudinary");
const { extractZip, cleanupTempFiles, findFileByBasename, findSpreadsheet, resolveContentRoot } = require("../utils/zipUtils");

// Check if Cloudinary is properly configured (mirrors uploadMiddleware.js logic)
function isCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  function isValid(v) {
    if (!v) return false;
    const n = String(v).trim().toLowerCase();
    return n !== "your_cloud_name" && n !== "your_api_key" && n !== "your_api_secret" && n !== "test" && n !== "demo" && n !== "undefined" && n !== "null";
  }
  return isValid(cloudName) && isValid(apiKey) && isValid(apiSecret) && /^\d+$/.test(String(apiKey).trim()) && String(apiSecret).trim().length >= 8;
}

/**
 * Upload a local file to Cloudinary or copy to local uploads folder.
 * Returns a file entry suitable for the uploadedFileSchema.
 */
async function uploadDocumentFile(filePath, userId, description = "", folderPrefix = "") {
  const rawFileName = path.basename(filePath);
  // Prepend folder name so the stored attachment name indicates its source
  const fileName = folderPrefix ? `${folderPrefix}_${rawFileName}` : rawFileName;
  const fileSize = fs.statSync(filePath).size;
  const mimeTypes = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
  const ext = path.extname(rawFileName).toLowerCase();
  const fileType = mimeTypes[ext] || "application/octet-stream";

  let url;
  if (isCloudinaryConfigured()) {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "filing-buddy",
      resource_type: "auto",
    });
    url = result.secure_url || result.url;
  } else {
    // Local: copy to server/uploads/
    const uploadsDir = path.join(__dirname, "..", "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const destName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const destPath = path.join(uploadsDir, destName);
    fs.copyFileSync(filePath, destPath);
    url = `/uploads/${destName}`;
  }

  return {
    name: fileName,
    size: `${Math.round(fileSize / 1024)} KB`,
    fileType,
    description,
    url,
    uploadedBy: userId,
  };
}

exports.bulkUploadV2 = async (req, res, next) => {
  let extractedDir = null;
  const zipFilePath = req.file?.path || null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a .zip file." });
    }

    // 1. Extract ZIP
    extractedDir = extractZip(zipFilePath);

    // 2. Find the spreadsheet
    const spreadsheetPath = findSpreadsheet(extractedDir);
    if (!spreadsheetPath) {
      return res.status(400).json({ message: "No .xlsx or .csv file found in the ZIP archive." });
    }

    // 3. Parse spreadsheet
    const wb = XLSX.readFile(spreadsheetPath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    if (!rows.length) {
      return res.status(400).json({ message: "The spreadsheet is empty." });
    }

    // 4. Locate document folders (case-insensitive)
    // Resolve the real content root — handles wrapper folders created when re-zipping
    const contentRoot = resolveContentRoot(extractedDir);
    const dirEntries = fs.readdirSync(contentRoot);
    const findSubDir = (name) => {
      const match = dirEntries.find((e) => e.toLowerCase() === name.toLowerCase());
      if (!match) return null;
      const full = path.join(contentRoot, match);
      return fs.statSync(full).isDirectory() ? full : null;
    };

    const licensesDir = findSubDir("licenses");
    const passportsDir = findSubDir("passports");
    const emirateIdsDir = findSubDir("emirate_ids");

    // 5. Process each row
    const results = [];
    let added = 0, failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const serial = row.serial || i + 1;
      const legalName = String(row.legalName || row.name || "").trim();

      try {
        // Validate
        const validationErrors = validateBulkRow(row);
        if (validationErrors.length) {
          results.push({ serial, status: "error", legalName, error: validationErrors.join(" ") });
          failed++;
          continue;
        }

        const trn = String(row.vatTrn || row.trn || "").trim();
        const licence = String(row.licenceNumber || "").trim();

        // Duplicate check
        const exists = await findDuplicateClient({
          legalName,
          vatDetails: { trn },
          tradeLicences: licence ? [{ licenceNumber: licence }] : [],
        });
        if (exists) {
          results.push({ serial, status: "error", legalName, error: duplicateMessage(exists, { legalName, vatDetails: { trn }, tradeLicences: licence ? [{ licenceNumber: licence }] : [] }) });
          failed++;
          continue;
        }

        // Resolve assigned user
        const assignedUser = await resolveAssignedUser(row.assignedUserEmailId || row.assignedUser);

        // Build payload
        const payload = buildClientPayload(row, req.user._id);
        if (assignedUser) payload.assignedUser = assignedUser;
        payload.fileNo = await nextClientFileNo();

        // 6. Process documents — upload and map
        // Trade licence document: licenses/<licenceNumber>.*
        if (licence && licensesDir) {
          const licenceFile = findFileByBasename(licensesDir, licence);
          if (licenceFile) {
            const fileEntry = await uploadDocumentFile(licenceFile, req.user._id, `Trade licence document for ${licence}`, "licenses");
            if (payload.tradeLicences.length) {
              payload.tradeLicences[0].documents = [fileEntry];
              payload.tradeLicences[0].documentUrl = fileEntry.url;
            }
          }
        }

        // Passport document: passports/<serial>.*
        if (passportsDir) {
          const passportFile = findFileByBasename(passportsDir, String(serial));
          if (passportFile && payload.contactPersons.length) {
            const fileEntry = await uploadDocumentFile(passportFile, req.user._id, `Passport document for ${row.contactName}`, "passports");
            payload.contactPersons[0].passport = {
              ...(payload.contactPersons[0].passport || {}),
              documents: [fileEntry],
              documentUrl: fileEntry.url,
            };
          }
        }

        // Emirates ID document: emirate_ids/<serial>.*
        if (emirateIdsDir) {
          const eidFile = findFileByBasename(emirateIdsDir, String(serial));
          if (eidFile && payload.contactPersons.length) {
            const fileEntry = await uploadDocumentFile(eidFile, req.user._id, `Emirates ID document for ${row.contactName}`, "emirate_ids");
            payload.contactPersons[0].emiratesId = {
              ...(payload.contactPersons[0].emiratesId || {}),
              documents: [fileEntry],
              documentUrl: fileEntry.url,
            };
          }
        }

        // Normalize for persistence
        if (payload.tradeLicences?.length) {
          payload.tradeLicences = normalizeTradeLicencesForPersistence(payload.tradeLicences);
        }
        if (payload.contactPersons?.length) {
          payload.contactPersons = normalizeContactPersonsForPersistence(payload.contactPersons);
        }

        const client = await Client.create(payload);
        results.push({ serial, status: "success", legalName, clientId: client._id });
        added++;
      } catch (error) {
        results.push({ serial, status: "error", legalName, error: error.message });
        failed++;
      }
    }

    res.json({ results, summary: { total: rows.length, added, failed } });
  } catch (error) {
    next(error);
  } finally {
    // 7. Always purge temp files — regardless of success or failure.
    // Files already uploaded to Cloudinary/blob storage remain.
    cleanupTempFiles(extractedDir, zipFilePath);
  }
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

exports.expiryAlerts = async (req, res, next) => {
  try {
    const query = { isActive: true };
    if (req.user.role === "task_only") {
      const assignedClientIds = await Task.find({ assignedTo: req.user._id }).distinct("client");
      query._id = { $in: assignedClientIds };
    }

    const clients = await Client.find(query).select("legalName fileNo tradeLicences contactPersons");
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const soonEnd = new Date(start);
    soonEnd.setUTCDate(soonEnd.getUTCDate() + 15);
    const alerts = [];

    function pushAlert({ client, type, label, holderName, expiryDate }) {
      if (!expiryDate) return;
      const date = new Date(expiryDate);
      if (Number.isNaN(date.getTime())) return;
      const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      if (normalized > soonEnd) return;
      const status = normalized < start ? "expired" : "expiring_soon";
      alerts.push({
        clientId: client._id,
        clientName: client.legalName,
        fileNo: client.fileNo,
        type,
        label,
        holderName: holderName || "",
        expiryDate: normalized.toISOString(),
        status,
      });
    }

    clients.forEach((client) => {
      (client.tradeLicences || []).forEach((licence) => {
        pushAlert({
          client,
          type: "licence",
          label: "Trade Licence",
          holderName: licence.licenceNumber || licence.issuingAuthority || "",
          expiryDate: licence.expiryDate,
        });
      });

      (client.contactPersons || []).forEach((person) => {
        pushAlert({
          client,
          type: "emirates_id",
          label: "Emirates ID",
          holderName: person.fullName || "",
          expiryDate: person.emiratesId?.expiryDate,
        });
        pushAlert({
          client,
          type: "passport",
          label: "Passport",
          holderName: person.fullName || "",
          expiryDate: person.passport?.expiryDate,
        });
      });
    });

    alerts.sort((a, b) => {
      if (a.status !== b.status) return a.status === "expired" ? -1 : 1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });

    res.json({
      expiredCount: alerts.filter((item) => item.status === "expired").length,
      expiringSoonCount: alerts.filter((item) => item.status === "expiring_soon").length,
      total: alerts.length,
      alerts,
    });
  } catch (error) { next(error); }
};

exports.uploadAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const uploadedFiles = buildUploadedFiles(req);
    if (!uploadedFiles.length) return res.status(400).json({ message: "Please choose a file to upload" });
    const description = req.body.description || "";
    uploadedFiles.forEach((uploadedFile) => {
      client.attachments.push(toStoredFileEntry(uploadedFile, req.user._id, description));
    });
    await client.save();
    res.status(201).json(await client.populate(populateClient));
  } catch (error) { next(error); }
};

exports.uploadClientDocument = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || !client.isActive) return res.status(404).json({ message: "Client not found" });
    const uploadedFiles = buildUploadedFiles(req);
    if (!uploadedFiles.length) return res.status(400).json({ message: "Please choose a file to upload" });

    const index = Number(req.body.index);
    const section = req.body.section || req.body.documentSection;
    const description = req.body.description || "";
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ message: "A valid document index is required" });

    const container = getDocumentContainer(client, section, index);
    if (!container) return res.status(400).json({ message: "Unsupported document section" });

    const existingSignatures = new Set((container.holder[container.key] || []).map(uploadedFileSignature));
    const newFiles = uploadedFiles.filter((uploadedFile) => {
      const signature = uploadedFileSignature(uploadedFile);
      if (existingSignatures.has(signature)) return false;
      existingSignatures.add(signature);
      return true;
    });
    if (!newFiles.length) return res.status(409).json({ message: "This file is already uploaded." });

    newFiles.forEach((uploadedFile) => {
      container.holder[container.key].push(toStoredFileEntry(uploadedFile, req.user._id, description));
    });
    container.sync(container.holder);
    await client.save();
    res.status(201).json(await client.populate(populateClient));
  } catch (error) { next(error); }
};

exports.deleteClientDocument = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || !client.isActive) return res.status(404).json({ message: "Client not found" });
    const index = Number(req.params.index);
    const container = getDocumentContainer(client, req.params.section, index);
    if (!container) return res.status(400).json({ message: "Unsupported document section" });
    const doc = container.holder[container.key].id(req.params.documentId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    doc.deleteOne();
    container.sync(container.holder);
    await client.save();
    res.json(await client.populate(populateClient));
  } catch (error) { next(error); }
};

exports.deleteAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    client.attachments.pull(req.params.attachId);
    await client.save();
    res.json(await client.populate(populateClient));
  } catch (error) { next(error); }
};
