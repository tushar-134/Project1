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

function parsePagination(query = {}, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || defaultLimit));
  return { page, limit };
}

function buildPattern(value) {
  return new RegExp(escapeRegex(String(value || "").trim()), "i");
}

function buildClientSearchClause(value) {
  const pattern = buildPattern(value);
  return {
    $or: [
      { legalName: pattern },
      { tradeName: pattern },
      { fileNo: pattern },
      { jurisdiction: pattern },
      { clientType: pattern },
      { "vatDetails.trn": pattern },
      { "tradeLicences.licenceNumber": pattern },
      { "contactPersons.fullName": pattern },
      { "contactPersons.email": pattern },
      { "contactPersons.mobile.number": pattern },
      { "contactPersons.mobile.countryCode": pattern },
    ],
  };
}

async function buildClientListQuery(req) {
  const { search, jurisdiction, type, group, assignedUser, client, compliance, contact } = req.query;
  const query = { isActive: true };
  const andClauses = [];

  if (jurisdiction) andClauses.push({ jurisdiction: buildPattern(jurisdiction) });
  if (type) {
    // type filter: "Legal Person" -> "legal", "Natural Person" -> "natural", or pass raw
    const typeMap = { "legal person": "legal", "natural person": "natural" };
    const normalized = typeMap[String(type).trim().toLowerCase()] || String(type).trim();
    andClauses.push({ clientType: new RegExp(`^${escapeRegex(normalized)}$`, "i") });
  }
  if (assignedUser) andClauses.push({ assignedUser });
  if (req.user.role === "task_only") {
    const assignedClientIds = await Task.find({ assignedTo: req.user._id }).distinct("client");
    andClauses.push({ _id: { $in: assignedClientIds } });
  }
  if (search) andClauses.push(buildClientSearchClause(search));
  if (client) {
    const pattern = buildPattern(client);
    andClauses.push({
      $or: [
        { legalName: pattern },
        { tradeName: pattern },
        { fileNo: pattern },
        { jurisdiction: pattern },
        { clientType: pattern },
      ],
    });
  }
  if (group) {
    const trimmed = String(group || "").trim();
    const groupIds = new Set(/^[0-9a-fA-F]{24}$/.test(trimmed) ? [trimmed] : []);
    const matchedGroups = await ClientGroup.find({ name: buildPattern(group) }).distinct("_id");
    matchedGroups.forEach((id) => groupIds.add(String(id)));
    andClauses.push({ group: groupIds.size ? { $in: [...groupIds] } : { $in: [] } });
  }
  if (compliance) {
    const pattern = buildPattern(compliance);
    andClauses.push({
      $or: [
        { "vatDetails.trn": pattern },
        { "tradeLicences.licenceNumber": pattern },
      ],
    });
  }
  if (contact) {
    const pattern = buildPattern(contact);
    andClauses.push({
      $or: [
        { "contactPersons.fullName": pattern },
        { "contactPersons.email": pattern },
        { "contactPersons.mobile.number": pattern },
        { "contactPersons.mobile.countryCode": pattern },
      ],
    });
  }
  if (andClauses.length) query.$and = andClauses;
  return query;
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
    const { page: requestedPage, limit } = parsePagination(req.query, 20);
    const query = await buildClientListQuery(req);
    const total = await Client.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);
    const clients = await Client.find(query)
      .populate(populateClient)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Attach active (non-completed) task counts per client for the list view summary pills.
    const clientIds = clients.map((c) => c._id);
    const activeStatuses = ["not_started", "wip", "submitted_to_fta"];
    const taskCounts = await Task.aggregate([
      { $match: { client: { $in: clientIds }, status: { $in: activeStatuses } } },
      { $group: { _id: "$client", count: { $sum: 1 } } },
    ]);
    const taskCountMap = {};
    taskCounts.forEach(({ _id, count }) => { taskCountMap[String(_id)] = count; });
    const workingTasksTotal = taskCounts.reduce((sum, { count }) => sum + count, 0);

    const enrichedClients = clients.map((client) => {
      const obj = client.toObject ? client.toObject() : client;
      obj.activeTasks = taskCountMap[String(client._id)] || 0;
      return obj;
    });

    res.json({ clients: enrichedClients, total, page, pages, limit, workingTasksTotal });
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
    const clients = await Client.find(await buildClientListQuery(req))
      .populate("group", "name")
      .populate("createdBy", "name");

    // columns param is a comma-separated list of column keys the user has visible.
    // If not provided, all columns are exported.
    const ALL_COLUMNS = ["fileNo", "name", "jurisdiction", "type", "group", "vatTrn", "createdAt", "createdBy"];
    const requestedColumns = req.query.columns
      ? String(req.query.columns).split(",").map((c) => c.trim()).filter(Boolean)
      : ALL_COLUMNS;
    const activeColumns = ALL_COLUMNS.filter((c) => requestedColumns.includes(c));

    const HEADER_MAP = {
      fileNo: "File No",
      name: "Name",
      jurisdiction: "Jurisdiction",
      type: "Type",
      group: "Group",
      vatTrn: "VAT TRN",
      createdAt: "Created Date",
      createdBy: "Created By",
    };

    const typeLabel = (c) => (c.clientType === "natural" ? "Natural Person" : "Legal Person");
    const jurisLabel = (c) => {
      const map = { mainland: "Mainland", freezone: "Free Zone", designated_zone: "Designated Zone", offshore: "Offshore" };
      return map[c.jurisdiction] || c.jurisdiction || "";
    };
    const formatDate = (d) => {
      if (!d) return "";
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return "";
      return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    };

    const getCell = (c, col) => {
      switch (col) {
        case "fileNo": return c.fileNo || "";
        case "name": return c.legalName || "";
        case "jurisdiction": return jurisLabel(c);
        case "type": return typeLabel(c);
        case "group": return c.group?.name || "";
        case "vatTrn": return c.vatDetails?.trn || "";
        case "createdAt": return formatDate(c.createdAt);
        case "createdBy": return c.createdBy?.name || "";
        default: return "";
      }
    };

    const headerRow = activeColumns.map((col) => `"${HEADER_MAP[col]}"`).join(",");
    const dataRows = clients.map((c) =>
      activeColumns.map((col) => `"${String(getCell(c, col)).replaceAll('"', '""')}"`).join(",")
    );
    const csv = [headerRow, ...dataRows].join("\n");

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
