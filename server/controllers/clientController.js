const { validationResult } = require("express-validator");
const Client = require("../models/Client");
const User = require("../models/User");
const Task = require("../models/Task");
const Contact = require("../models/Contact");
const ClientGroup = require("../models/ClientGroup");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const CustomField = require("../models/CustomField");
const { nextClientFileNo } = require("../utils/autoId");
const { normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");
const { buildUploadedFileUrl, normalizeStoredUploadUrl } = require("../utils/uploadUrl");
const { createTtlCache } = require("../utils/ttlCache");
const { buildDirectUploadedFiles } = require("../utils/s3DirectUpload");
const { deleteStoredS3Object } = require("../utils/s3Delete");

const expiryAlertsCache = createTtlCache(30_000);

// Managers can assign clients to themselves or associate users only — not to other managers or admins.
async function ensureManagerCanAssignClient(req, assignedUser) {
  if (req.user.role !== "manager" || !assignedUser) return null;
  if (String(assignedUser) === String(req.user._id)) return null; // self-assign always OK
  const target = await User.findById(assignedUser).select("role");
  if (!target) return { status: 404, message: "Assigned user not found" };
  // Managers can only assign to themselves or associate users
  if (target.role !== "associate") {
    return { status: 403, message: "Managers can only assign clients to themselves or associate users." };
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

const populateClientList = [
  { path: "assignedUser", select: "name" },
  { path: "group", select: "name" },
  { path: "createdBy", select: "name" },
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePagination(query = {}, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(5000, Number(query.limit) || defaultLimit));
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
  const { search, jurisdiction, type, group, assignedUser, client, compliance, contact, createdAt, createdBy, licenceExpiry, status, licenceAlerts } = req.query;
  const query = {};
  if (status !== "all") {
    query.isActive = status === "inactive" ? false : true;
  }
  const andClauses = [];

  if (jurisdiction) andClauses.push({ jurisdiction: buildPattern(jurisdiction) });
  if (type) {
    // type filter: "Legal Person" -> "legal", "Natural Person" -> "natural", or pass raw
    const typeMap = { "legal person": "legal", "natural person": "natural" };
    const normalized = typeMap[String(type).trim().toLowerCase()] || String(type).trim();
    andClauses.push({ clientType: new RegExp(`^${escapeRegex(normalized)}$`, "i") });
  }
  if (assignedUser) andClauses.push({ assignedUser });
  if (req.user.role === "associate") {
    const assignedClientIds = await Task.distinct("client", { assignedTo: req.user._id });
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
  if (createdAt) {
    // createdAt is expected as "YYYY-MM" from the month input
    const [year, month] = String(createdAt).split("-");
    if (year && month) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate   = new Date(Number(year), Number(month), 1);
      andClauses.push({ createdAt: { $gte: startDate, $lt: endDate } });
    }
  }
  if (createdBy) {
    const matchedUserIds = await User.find({ name: buildPattern(createdBy) }).distinct("_id");
    andClauses.push({ createdBy: { $in: matchedUserIds } });
  }
  if (licenceExpiry) {
    const pattern = buildPattern(licenceExpiry);
    andClauses.push({ "tradeLicences.expiryDate": pattern });
  }
  if (licenceAlerts === "true") {
    const now = new Date();
    const expiryStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const expirySoonEnd = new Date(expiryStart);
    expirySoonEnd.setUTCDate(expirySoonEnd.getUTCDate() + 15);
    andClauses.push({
      $or: [
        { "tradeLicences.expiryDate": { $lte: expirySoonEnd, $type: "date" } },
        { "contactPersons.emiratesId.expiryDate": { $lte: expirySoonEnd, $type: "date" } },
        { "contactPersons.passport.expiryDate": { $lte: expirySoonEnd, $type: "date" } },
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
  const vatTrn = data.vatDetails?.trn?.trim();
  const licenceNumbers = (data.tradeLicences || [])
    .map((licence) => licence?.licenceNumber?.trim())
    .filter(Boolean);

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
  const vatTrn = payload.vatDetails?.trn?.trim();
  const licenceNumbers = new Set(
    (payload.tradeLicences || [])
      .map((licence) => licence?.licenceNumber?.trim())
      .filter(Boolean),
  );

  if (vatTrn && client.vatDetails?.trn === vatTrn) {
    return `A client with VAT TRN "${vatTrn}" already exists.`;
  }
  const matchingLicence = client.tradeLicences?.find((licence) => licenceNumbers.has(licence.licenceNumber));
  if (matchingLicence?.licenceNumber) {
    return `A client with trade licence "${matchingLicence.licenceNumber}" already exists.`;
  }
  return "A matching client already exists.";
}

function validateLegalName(value) {
  return String(value || "").trim().length > 0;
}

function clientLifecycle(client) {
  const contact = (client.contactPersons || []).find((person) => String(person?.fullName || "").trim());
  const hasContactPhone = Boolean(String(contact?.mobile?.number || "").trim());
  const hasContactEmail = Boolean(String(contact?.email || "").trim());
  const hasTradeLicence = (client.tradeLicences || []).some((licence) => String(licence?.licenceNumber || "").trim());
  const missingFields = [];

  if (!String(client.jurisdiction || "").trim()) missingFields.push("jurisdiction");
  if (!hasTradeLicence) missingFields.push("trade licence");
  if (!contact) missingFields.push("contact person");
  if (contact && !hasContactPhone) missingFields.push("contact phone");
  if (contact && !hasContactEmail) missingFields.push("contact email");

  return {
    lifecycleStatus: missingFields.length ? "draft" : "complete",
    isDraft: missingFields.length > 0,
    missingFields,
  };
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
  if (status === "registered" && !vatDetails?.registrationDate) return "VAT Registration Date is required when VAT status is registered.";
  return null;
}

function validateCtDetails(ctDetails = {}) {
  const status = String(ctDetails?.status || "").trim();
  if (status === "registered" && !ctDetails?.registrationDate) return "CT Registration Date is required when CT status is registered.";
  return null;
}

function toUploadedFile(file, req) {
  const url = buildUploadedFileUrl(file, req);
  return {
    name: file.originalname,
    size: `${Math.round(file.size / 1024)} KB`,
    fileType: file.mimetype,
    url,
    storageProvider: file.key ? "s3" : "local",
    bucket: file.bucket || "",
    key: file.key || "",
  };
}

async function buildUploadedFiles(req) {
  const fieldFiles = Object.values(req.files || {}).flat();
  const files = fieldFiles.length ? fieldFiles : (req.file ? [req.file] : []);
  const streamedFiles = files.map((file) => toUploadedFile(file, req));
  const directFiles = await buildDirectUploadedFiles(req.body);
  return [...streamedFiles, ...directFiles];
}

function toStoredFileEntry(uploadedFile, userId, description = "") {
  return {
    name: uploadedFile.name,
    size: uploadedFile.size,
    fileType: uploadedFile.fileType,
    description,
    url: uploadedFile.url,
    storageProvider: uploadedFile.storageProvider,
    bucket: uploadedFile.bucket,
    key: uploadedFile.key,
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

function getDocumentUrlField(documentKey) {
  if (documentKey === "frontDocuments") return "frontDocumentUrl";
  if (documentKey === "backDocuments") return "backDocumentUrl";
  return "documentUrl";
}

function buildDocumentLocator(req) {
  const url = String(req.query.url || "").trim();
  const key = String(req.query.key || "").trim().replace(/^\/+/, "");
  return { url, key };
}

function storedFileMatchesLocator(file, locator) {
  if (!file || !locator) return false;
  const fileUrl = String(file.url || "").trim();
  const fileKey = String(file.key || "").trim().replace(/^\/+/, "");
  if (locator.key && fileKey === locator.key) return true;
  if (locator.url && fileUrl === locator.url) return true;

  const parsed = locator.url ? parseS3ObjectUrl(locator.url) : null;
  return Boolean(parsed?.key && fileKey === parsed.key);
}

function findStoredDocument(container, documentId, locator) {
  const documents = container.holder[container.key] || [];
  if (/^[0-9a-fA-F]{24}$/.test(String(documentId || ""))) {
    const doc = documents.id(documentId);
    if (doc) return doc;
  }
  return documents.find((document) => storedFileMatchesLocator(document, locator));
}

function clearLegacyDocumentUrl(container, locator) {
  const urlField = getDocumentUrlField(container.key);
  const storedUrl = String(container.holder[urlField] || "").trim();
  if (!storedUrl) return null;

  const storedObject = parseS3ObjectUrl(storedUrl);
  const requestedObject = locator.url ? parseS3ObjectUrl(locator.url) : null;
  const requestedKey = locator.key || requestedObject?.key || "";
  const matchesUrl = locator.url && storedUrl === locator.url;
  const matchesKey = requestedKey && storedObject?.key === requestedKey;
  if (!matchesUrl && !matchesKey) return null;

  container.holder[urlField] = "";
  return { url: storedUrl, key: storedObject?.key || requestedKey };
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
      documentUrl: normalizeStoredUploadUrl(licence?.documentUrl || documents[documents.length - 1]?.url || existing.documentUrl || ""),
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
        documentUrl: normalizeStoredUploadUrl(contact?.emiratesId?.documentUrl || emiratesIdDocuments[emiratesIdDocuments.length - 1]?.url || existingEmiratesId.documentUrl || ""),
        frontDocumentUrl: normalizeStoredUploadUrl(contact?.emiratesId?.frontDocumentUrl || frontDocuments[frontDocuments.length - 1]?.url || existingEmiratesId.frontDocumentUrl || ""),
        backDocumentUrl: normalizeStoredUploadUrl(contact?.emiratesId?.backDocumentUrl || backDocuments[backDocuments.length - 1]?.url || existingEmiratesId.backDocumentUrl || ""),
      },
      passport: {
        ...(contact.passport || {}),
        documents: passportDocuments,
        documentUrl: normalizeStoredUploadUrl(contact?.passport?.documentUrl || passportDocuments[passportDocuments.length - 1]?.url || existingPassport.documentUrl || ""),
      },
    };
  });
}

exports.listClients = async (req, res, next) => {
  try {
    const { page: requestedPage, limit } = parsePagination(req.query, 20);
    const query = await buildClientListQuery(req);
    const skip = (requestedPage - 1) * limit;

    if (req.query.mode === "options") {
      const [total, clients] = await Promise.all([
        Client.countDocuments(query),
        Client.find(query)
          .select("legalName tradeName fileNo group")
          .sort({ legalName: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
      const pages = Math.max(1, Math.ceil(total / limit));
      return res.json({ clients, total, page: Math.min(requestedPage, pages), pages, limit });
    }
    
    const sortCriteria = req.query.status === "inactive" ? { updatedAt: -1 } : { createdAt: -1 };
    
    const [total, clients] = await Promise.all([
      Client.countDocuments(query),
      Client.find(query)
        .populate(populateClientList)
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
    ]);

    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);

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
      Object.assign(obj, clientLifecycle(client));
      return obj;
    });

    res.json({ clients: enrichedClients, total, page, pages, limit, workingTasksTotal });
  } catch (error) { next(error); }
};

exports.getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id).populate(populateClient);
    // Allow fetching inactive clients so the detail drawer can show read-only info
    // and the Restore action can be triggered from within the drawer.
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (req.user.role === "associate") {
      // associate users may only access a client if they have at least one task assigned to them for that client.
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
    req.body.legalName = String(req.body.legalName || "").trim();
    if (!validateLegalName(req.body.legalName)) return res.status(400).json({ message: "Legal name is required." });
    const clientAssignError = await ensureManagerCanAssignClient(req, req.body.assignedUser);
    if (clientAssignError) return res.status(clientAssignError.status).json({ message: clientAssignError.message });
    const vatTrnError = validateVatTrn(req.body.vatDetails);
    if (vatTrnError) return res.status(400).json({ message: vatTrnError });
    const ctDetailsError = validateCtDetails(req.body.ctDetails);
    if (ctDetailsError) return res.status(400).json({ message: ctDetailsError });
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
    if ("legalName" in req.body) {
      req.body.legalName = String(req.body.legalName || "").trim();
      if (!validateLegalName(req.body.legalName)) return res.status(400).json({ message: "Legal name is required." });
    }
    if ("assignedUser" in req.body) {
      const clientAssignError = await ensureManagerCanAssignClient(req, req.body.assignedUser);
      if (clientAssignError) return res.status(clientAssignError.status).json({ message: clientAssignError.message });
    }
    if ("vatDetails" in req.body) {
      const vatTrnError = validateVatTrn({ ...(client.vatDetails || {}), ...(req.body.vatDetails || {}) });
      if (vatTrnError) return res.status(400).json({ message: vatTrnError });
    }
    if ("ctDetails" in req.body) {
      const ctDetailsError = validateCtDetails({ ...(client.ctDetails || {}), ...(req.body.ctDetails || {}) });
      if (ctDetailsError) return res.status(400).json({ message: ctDetailsError });
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

    // Auto-archiving and history logic
    if ("vatDetails" in req.body && req.body.vatDetails) {
      if (req.body.vatDetails.status === "deregistered") {
        const oldStatus = client.vatDetails?.status;
        if (oldStatus === "registered") {
          const newHistoryEntry = {
            trn: client.vatDetails.trn,
            status: "deregistered",
            registrationDate: client.vatDetails.registrationDate,
            deregistrationDate: req.body.vatDetails.deregistrationDate || new Date(),
            filingFrequency: client.vatDetails.filingFrequency,
            registrationTask: client.vatDetails.registrationTask,
            registrationTaskId: client.vatDetails.registrationTaskId,
            archivedAt: new Date(),
            linkedTo: null,
          };
          if (!client.vatDetails.history) {
            client.vatDetails.history = [];
          }
          client.vatDetails.history.push(newHistoryEntry);
        }
      } else if (req.body.vatDetails.status === "registered") {
        const oldStatus = client.vatDetails?.status;
        if (oldStatus === "deregistered") {
          if (client.vatDetails.history && client.vatDetails.history.length > 0) {
            const lastIndex = client.vatDetails.history.length - 1;
            client.vatDetails.history[lastIndex].linkedTo = -1;
          }
          req.body.vatDetails.deregistrationDate = null;
        }
      }
      
      // Update individual fields of client.vatDetails directly
      client.vatDetails.trn = req.body.vatDetails.trn;
      client.vatDetails.status = req.body.vatDetails.status;
      client.vatDetails.registrationDate = req.body.vatDetails.registrationDate;
      client.vatDetails.deregistrationDate = req.body.vatDetails.deregistrationDate;
      client.vatDetails.filingFrequency = req.body.vatDetails.filingFrequency;
      client.vatDetails.registrationTask = req.body.vatDetails.registrationTask;
      client.vatDetails.registrationTaskId = req.body.vatDetails.registrationTaskId;

      delete req.body.vatDetails;
    }

    if ("ctDetails" in req.body && req.body.ctDetails) {
      if (req.body.ctDetails.status === "deregistered") {
        const oldStatus = client.ctDetails?.status;
        if (oldStatus === "registered") {
          const newHistoryEntry = {
            tin: client.ctDetails.tin,
            status: "deregistered",
            registrationDate: client.ctDetails.registrationDate,
            deregistrationDate: req.body.ctDetails.deregistrationDate || new Date(),
            financialYearEnd: client.ctDetails.financialYearEnd,
            registrationTask: client.ctDetails.registrationTask,
            registrationTaskId: client.ctDetails.registrationTaskId,
            archivedAt: new Date(),
            linkedTo: null,
          };
          if (!client.ctDetails.history) {
            client.ctDetails.history = [];
          }
          client.ctDetails.history.push(newHistoryEntry);
        }
      } else if (req.body.ctDetails.status === "registered") {
        const oldStatus = client.ctDetails?.status;
        if (oldStatus === "deregistered") {
          if (client.ctDetails.history && client.ctDetails.history.length > 0) {
            const lastIndex = client.ctDetails.history.length - 1;
            client.ctDetails.history[lastIndex].linkedTo = -1;
          }
          req.body.ctDetails.deregistrationDate = null;
        }
      }

      // Update individual fields of client.ctDetails directly
      client.ctDetails.tin = req.body.ctDetails.tin;
      client.ctDetails.status = req.body.ctDetails.status;
      client.ctDetails.registrationDate = req.body.ctDetails.registrationDate;
      client.ctDetails.deregistrationDate = req.body.ctDetails.deregistrationDate;
      client.ctDetails.financialYearEnd = req.body.ctDetails.financialYearEnd;
      client.ctDetails.registrationTask = req.body.ctDetails.registrationTask;
      client.ctDetails.registrationTaskId = req.body.ctDetails.registrationTaskId;

      delete req.body.ctDetails;
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

    // Soft delete: keep the client and tasks, just mark inactive
    client.isActive = false;
    await client.save();

    res.json({ message: "Client moved to inactive list" });
  } catch (error) { next(error); }
};

exports.restoreClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    client.isActive = true;
    await client.save();

    res.json(await client.populate(populateClient));
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
  if (!String(row.licenceNumber || "").trim()) errors.push("licenceNumber is required.");
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
  
  const contactPersons = [];
  
  // Contact 1: has country code and mobile number too
  const c1Name = String(row.contact_name_1 || "").trim();
  const c1Email = String(row.contact_email_1 || "").trim();
  const c1Country = String(row.contact_country_code_1 || "+971").trim();
  const c1Mobile = String(row.contact_mobile_1 || "").trim();
  
  if (c1Name || c1Email || c1Mobile) {
    contactPersons.push({
      fullName: c1Name,
      email: c1Email,
      mobile: {
        countryCode: c1Country,
        number: c1Mobile,
      },
      isPrimary: false,
    });
  }
  
  // Contacts 2..10: only name and email
  for (let n = 2; n <= 10; n++) {
    const cName = String(row[`contact_name_${n}`] || "").trim();
    const cEmail = String(row[`contact_email_${n}`] || "").trim();
    if (cName || cEmail) {
      contactPersons.push({
        fullName: cName,
        email: cEmail,
        isPrimary: false,
      });
    }
  }

  if (contactPersons.length > 0) {
    contactPersons[0].isPrimary = true;
  }

  return {
    clientType: String(row.clientType || "legal").trim().toLowerCase(),
    legalName: String(row.legalName || "").trim(),
    tradeName: String(row.tradeName || "").trim() || undefined,
    jurisdiction: normalizeBulkJurisdiction(row.jurisdiction),
    vatDetails: trn ? { trn } : undefined,
    tradeLicences: licence ? [{ licenceNumber: licence }] : [],
    contactPersons,
    createdBy: userId,
  };
}

// ─── v1: JSON-based bulk upload (updated with contacts + per-row results) ─────

exports.bulkUpload = async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : req.body;
    const results = [];
    let added = 0, failed = 0;
    const seenLicences = new Set();

    // Batch pre-fetch active users to avoid querying inside the loop
    const activeUsers = await User.find({ isActive: true }).select("_id email").lean();
    const userMap = new Map(activeUsers.map((u) => [String(u.email || "").trim().toLowerCase(), u._id]));

    // Batch query existing licence numbers to check for duplicates in one roundtrip
    const licenceNumbers = rows
      .map((r) => String(r.licenceNumber || r.licence || "").trim())
      .filter(Boolean);
    const existingClients = licenceNumbers.length
      ? await Client.find({
          isActive: true,
          "tradeLicences.licenceNumber": { $in: licenceNumbers },
        }).select("tradeLicences.licenceNumber").lean()
      : [];
    const existingLicenceSet = new Set(
      existingClients.flatMap((c) => (c.tradeLicences || []).map((l) => String(l.licenceNumber || "").trim().toLowerCase()))
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const serial = row.serial || i + 1;
      const legalName = String(row.legalName || row.name || "").trim();
      const licence = String(row.licenceNumber || "").trim();

      try {
        // Validate row fields
        const validationErrors = validateBulkRow(row);
        if (validationErrors.length) {
          results.push({ serial, status: "error", legalName, error: validationErrors.join(" ") });
          failed++;
          continue;
        }

        // Check for duplicate licence numbers within this batch
        if (seenLicences.has(licence.toLowerCase())) {
          results.push({
            serial,
            status: "error",
            legalName,
            error: `A duplicate licence number "${licence}" is present in this upload batch.`
          });
          failed++;
          continue;
        }
        seenLicences.add(licence.toLowerCase());

        // Check against existing clients in database (using pre-fetched batch results)
        if (existingLicenceSet.has(licence.toLowerCase())) {
          results.push({
            serial,
            status: "error",
            legalName,
            error: `A client with trade licence "${licence}" already exists.`
          });
          failed++;
          continue;
        }

        // Resolve assigned user by email in-memory
        const emailKey = String(row.assignedUserEmailId || row.assignedUser || "").trim().toLowerCase();
        const assignedUser = emailKey ? userMap.get(emailKey) : undefined;

        const payload = buildClientPayload(row, req.user._id);
        if (assignedUser) payload.assignedUser = assignedUser;
        payload.fileNo = await nextClientFileNo();

        const client = await Client.create(payload);
        results.push({ serial, status: "success", legalName, clientId: client._id });
        added++;
        
        // Add to existing licences to protect against duplicate inputs in this batch if any are skipped or not caught
        existingLicenceSet.add(licence.toLowerCase());
      } catch (error) {
        results.push({ serial, status: "error", legalName, error: error.message });
        failed++;
      }
    }
    res.json({ results, summary: { total: rows.length, added, failed } });
  } catch (error) { next(error); }
};

// ─── exportClients ─────────────────────────────────────────────────────────────

exports.exportClients = async (req, res, next) => {
  try {
    const clients = await Client.find(await buildClientListQuery(req))
      .populate("group", "name")
      .populate("assignedUser", "name")
      .populate("createdBy", "name");

    const XLSX = require("xlsx");
    const isExportAll = req.query.mode === "all";

    const typeLabel  = (c) => (c.clientType === "natural" ? "Natural Person" : "Legal Person");
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
    const formatCurrencyValue = (val) => {
      if (!val) return "";
      const colonIdx = val.indexOf(":");
      if (colonIdx === -1) return val;
      const code = val.slice(0, colonIdx);
      const amount = val.slice(colonIdx + 1);
      return amount ? `${code} ${amount}` : "";
    };

    let rows;
    let orderedHeaders;

    if (isExportAll) {
      // ── Export All mode: dynamic contacts + custom fields ─────────────────
      const customFieldDefs = await CustomField.find({ isActive: true }).lean();

      // Calculate the actual max contacts across all clients — no ghost columns
      const maxContacts = clients.length > 0
        ? Math.max(...clients.map((c) => c.contactPersons?.length || 0))
        : 0;

      // Only include custom fields that have at least one non-empty value across all clients
      const activeCustomFields = customFieldDefs.filter((f) =>
        clients.some((c) => {
          const raw = c.customFields?.get ? c.customFields.get(f.key) : (c.customFields?.[f.key] || "");
          return raw && String(raw).trim() !== "";
        })
      );

      // Split into currency (shown first, before contacts) and everything else (shown after contacts)
      const currencyFields = activeCustomFields.filter((f) => f.type === "currency");
      const otherFields    = activeCustomFields.filter((f) => f.type !== "currency");

      // Column order: Base → Currency → Contacts → Other Custom Fields
      const baseHeaders        = ["File No", "Legal Name", "Jurisdiction", "Type", "Group", "Assigned To", "Licence No", "Licence Expiry", "VAT TRN", "Created Date", "Created By"];
      const currencyHeaders    = currencyFields.map((f) => f.label);
      const contactHeaders     = Array.from({ length: maxContacts }, (_, i) => `Contact ${i + 1}`);
      const otherCustomHeaders = otherFields.map((f) => f.label);
      orderedHeaders = [...baseHeaders, ...currencyHeaders, ...contactHeaders, ...otherCustomHeaders];

      rows = clients.map((c) => {
        const row = {};
        // Base columns
        row["File No"]        = c.fileNo || "";
        row["Legal Name"]     = c.legalName || "";
        row["Jurisdiction"]   = jurisLabel(c);
        row["Type"]           = typeLabel(c);
        row["Group"]          = c.group?.name || "";
        row["Assigned To"]    = c.assignedUser?.name || "";
        row["Licence No"]     = c.tradeLicences?.[0]?.licenceNumber || "";
        row["Licence Expiry"] = formatDate(c.tradeLicences?.[0]?.expiryDate) || "";
        row["VAT TRN"]        = c.vatDetails?.trn || "";
        row["Created Date"]   = formatDate(c.createdAt);
        row["Created By"]     = c.createdBy?.name || "";
        // Currency custom fields (right after base, before contacts)
        currencyFields.forEach((f) => {
          const raw = c.customFields?.get ? c.customFields.get(f.key) : (c.customFields?.[f.key] || "");
          row[f.label] = formatCurrencyValue(raw);
        });
        // Contacts: one cell per contact, all details joined with newlines
        for (let i = 0; i < maxContacts; i++) {
          const p = c.contactPersons?.[i];
          if (p) {
            const mobile = p.mobile ? `${p.mobile.countryCode || ""} ${p.mobile.number || ""}`.trim() : "";
            const parts = [];
            if (p.fullName) parts.push(`Name: ${p.fullName}`);
            if (mobile)     parts.push(`Mobile: ${mobile}`);
            if (p.email)    parts.push(`Email: ${p.email}`);
            if (p.role)     parts.push(`Role: ${p.role}`);
            row[`Contact ${i + 1}`] = parts.join("\n");
          } else {
            row[`Contact ${i + 1}`] = "";
          }
        }
        // Other custom fields (after contacts, at the very end)
        otherFields.forEach((f) => {
          const raw = c.customFields?.get ? c.customFields.get(f.key) : (c.customFields?.[f.key] || "");
          row[f.label] = raw || "";
        });
        return row;
      });
    } else {
      // ── Visible / Selected Columns mode ────────────────────────────────────
      const BASE_COLUMNS = ["fileNo", "name", "jurisdiction", "type", "group", "assignedUser", "licence", "licenceExpiry", "vatTrn", "contact", "mobile", "email", "createdAt", "createdBy"];
      const ALL_COLUMNS  = BASE_COLUMNS;
      const requestedColumns = req.query.columns
        ? String(req.query.columns).split(",").map((c) => c.trim()).filter(Boolean)
        : ALL_COLUMNS;

      // Separate known base columns from custom field keys
      const activeBaseColumns   = requestedColumns.filter((k) => BASE_COLUMNS.includes(k));
      const activeCustomKeys    = requestedColumns.filter((k) => !BASE_COLUMNS.includes(k));
      const customFieldDefsAll  = activeCustomKeys.length > 0
        ? await CustomField.find({ key: { $in: activeCustomKeys }, isActive: true }).lean()
        : [];

      const HEADER_MAP = {
        fileNo:        "File No",
        name:          "Legal Name",
        jurisdiction:  "Jurisdiction",
        type:          "Type",
        group:         "Group",
        assignedUser:  "Assigned To",
        licence:       "Licence No",
        licenceExpiry: "Licence Expiry",
        vatTrn:        "VAT TRN",
        contact:       "Contact Name",
        mobile:        "Mobile No",
        email:         "Email",
        createdAt:     "Created Date",
        createdBy:     "Created By",
      };
      const getBaseCell = (c, col) => {
        switch (col) {
          case "fileNo":        return c.fileNo || "";
          case "name":          return c.legalName || "";
          case "jurisdiction":  return jurisLabel(c);
          case "type":          return typeLabel(c);
          case "group":         return c.group?.name || "";
          case "assignedUser":  return c.assignedUser?.name || "";
          case "licence":       return c.tradeLicences?.[0]?.licenceNumber || "";
          case "licenceExpiry": return formatDate(c.tradeLicences?.[0]?.expiryDate) || "";
          case "vatTrn":        return c.vatDetails?.trn || "";
          case "contact":
            return c.contactPersons?.map((p) => p.fullName).filter(Boolean).join(" | ") || "";
          case "mobile":
            return c.contactPersons
              ?.map((p) => p.mobile ? `${p.mobile.countryCode || ""} ${p.mobile.number || ""}`.trim() : "")
              .filter(Boolean)
              .join(" | ") || "";
          case "email":
            return c.contactPersons?.map((p) => p.email).filter(Boolean).join(" | ") || "";
          case "createdAt":     return formatDate(c.createdAt);
          case "createdBy":     return c.createdBy?.name || "";
          default:              return "";
        }
      };

      const CONTACT_KEYS = new Set(["contact", "mobile", "email"]);
      const wantsContacts = activeBaseColumns.some((k) => CONTACT_KEYS.has(k));
      // Non-contact base columns — these map 1-to-1 to a header
      const nonContactBaseColumns = activeBaseColumns.filter((k) => !CONTACT_KEYS.has(k));

      // Dynamic contact columns (only if any contact key was requested)
      const maxContacts = wantsContacts && clients.length > 0
        ? Math.max(...clients.map((c) => c.contactPersons?.length || 0))
        : 0;
      const contactHeaders = Array.from({ length: maxContacts }, (_, i) => `Contact ${i + 1}`);

      // Build ordered headers: non-contact base → Contact N → custom fields
      const baseColHeaders   = nonContactBaseColumns.map((col) => HEADER_MAP[col]);
      const customColHeaders = customFieldDefsAll.map((f) => f.label);
      orderedHeaders = [...baseColHeaders, ...contactHeaders, ...customColHeaders];

      rows = clients.map((c) => {
        const row = {};
        // Non-contact base columns
        nonContactBaseColumns.forEach((col) => { row[HEADER_MAP[col]] = getBaseCell(c, col); });
        // Contact N columns — one cell per contact, all details with newlines
        for (let i = 0; i < maxContacts; i++) {
          const p = c.contactPersons?.[i];
          if (p) {
            const mobile = p.mobile ? `${p.mobile.countryCode || ""} ${p.mobile.number || ""}`.trim() : "";
            const parts = [];
            if (p.fullName) parts.push(`Name: ${p.fullName}`);
            if (mobile)     parts.push(`Mobile: ${mobile}`);
            if (p.email)    parts.push(`Email: ${p.email}`);
            if (p.role)     parts.push(`Role: ${p.role}`);
            row[`Contact ${i + 1}`] = parts.join("\n");
          } else {
            row[`Contact ${i + 1}`] = "";
          }
        }
        // Custom fields
        customFieldDefsAll.forEach((f) => {
          const raw = c.customFields?.get ? c.customFields.get(f.key) : (c.customFields?.[f.key] || "");
          row[f.label] = f.type === "currency" ? formatCurrencyValue(raw) : (raw || "");
        });
        return row;
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: orderedHeaders });
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const filename = isExportAll ? "clients_full_export.xlsx" : "clients.xlsx";
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
       .setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
       .send(buffer);
  } catch (error) { next(error); }
};

exports.expiryAlerts = async (req, res, next) => {
  try {
    const cacheKey = `${req.user.role}:${req.user._id}`;
    const cached = expiryAlertsCache.get(cacheKey);
    if (cached) return res.json(cached);
    const query = { isActive: true };
    if (req.user.role === "associate") {
      const assignedClientIds = await Task.find({ assignedTo: req.user._id }).distinct("client");
      query._id = { $in: assignedClientIds };
    }

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const soonEnd = new Date(start);
    soonEnd.setUTCDate(soonEnd.getUTCDate() + 15);

    query.$or = [
      { "tradeLicences.expiryDate": { $lte: soonEnd } },
      { "contactPersons.emiratesId.expiryDate": { $lte: soonEnd } },
      { "contactPersons.passport.expiryDate": { $lte: soonEnd } },
    ];

    const clients = await Client.find(query).select("legalName fileNo tradeLicences contactPersons");

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

    const payload = {
      expiredCount: alerts.filter((item) => item.status === "expired").length,
      expiringSoonCount: alerts.filter((item) => item.status === "expiring_soon").length,
      total: alerts.length,
      alerts,
    };
    expiryAlertsCache.set(cacheKey, payload);
    res.json(payload);
  } catch (error) { next(error); }
};

exports.uploadAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const uploadedFiles = await buildUploadedFiles(req);
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
    const uploadedFiles = await buildUploadedFiles(req);
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
    const locator = buildDocumentLocator(req);
    const doc = findStoredDocument(container, req.params.documentId, locator);
    if (doc) {
      await deleteStoredS3Object(doc);
      // Use pull() on the parent DocumentArray instead of doc.deleteOne().
      // deleteOne() silently fails on deeply nested subdocuments (e.g.
      // contactPersons[i].emiratesId.documents[j]) because Mongoose cannot
      // resolve the parent path. pull() operates on the array directly and
      // works reliably at any nesting depth.
      if (doc._id) {
        container.holder[container.key].pull(doc._id);
      } else {
        container.holder[container.key] = container.holder[container.key].filter(
          (entry) => entry !== doc
        );
      }
    } else {
      const legacyDocument = clearLegacyDocumentUrl(container, locator);
      if (!legacyDocument) return res.status(404).json({ message: "Document not found" });
      await deleteStoredS3Object(legacyDocument);
    }
    container.sync(container.holder);
    await client.save();
    res.json(await client.populate(populateClient));
  } catch (error) { next(error); }
};

exports.deleteAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const attachment = client.attachments.id(req.params.attachId);
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    await deleteStoredS3Object(attachment);
    attachment.deleteOne();
    await client.save();
    res.json(await client.populate(populateClient));
  } catch (error) { next(error); }
};
