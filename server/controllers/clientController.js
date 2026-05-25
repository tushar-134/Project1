const { validationResult } = require("express-validator");
const Client = require("../models/Client");
const User = require("../models/User");
const Task = require("../models/Task");
const Contact = require("../models/Contact");
const ClientGroup = require("../models/ClientGroup");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const { nextClientFileNo } = require("../utils/autoId");
const { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } = require("../utils/phoneUtils");

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

function toStoredFileEntry(uploadedFile, userId, extra = {}) {
  return {
    name: uploadedFile.name,
    size: uploadedFile.size,
    fileType: uploadedFile.fileType,
    description: extra.description || "",
    documentType: extra.documentType,
    url: uploadedFile.url,
    uploadedBy: userId,
  };
}

function getDocumentContainer(client, section, index) {
  if (!Number.isInteger(index) || index < 0) return null;
  if (section === "tradeLicences") {
    const item = client.tradeLicences[index];
    if (!item) return null;
    item.documents = Array.isArray(item.documents) ? item.documents : [];
    return { holder: item, key: "documents", sync(container) { container.documentUrl = container.documents.at(-1)?.url || ""; } };
  }
  if (section === "emiratesId") {
    const item = client.contactPersons[index];
    if (!item) return null;
    item.emiratesId = item.emiratesId || {};
    item.emiratesId.documents = Array.isArray(item.emiratesId.documents) ? item.emiratesId.documents : [];
    return { holder: item.emiratesId, key: "documents", sync(container) { container.documentUrl = container.documents.at(-1)?.url || ""; } };
  }
  if (section === "emiratesIdFront") {
    const item = client.contactPersons[index];
    if (!item) return null;
    item.emiratesId = item.emiratesId || {};
    item.emiratesId.frontDocuments = Array.isArray(item.emiratesId.frontDocuments) ? item.emiratesId.frontDocuments : [];
    return { holder: item.emiratesId, key: "frontDocuments", sync(container) { container.frontDocumentUrl = container.frontDocuments.at(-1)?.url || ""; } };
  }
  if (section === "emiratesIdBack") {
    const item = client.contactPersons[index];
    if (!item) return null;
    item.emiratesId = item.emiratesId || {};
    item.emiratesId.backDocuments = Array.isArray(item.emiratesId.backDocuments) ? item.emiratesId.backDocuments : [];
    return { holder: item.emiratesId, key: "backDocuments", sync(container) { container.backDocumentUrl = container.backDocuments.at(-1)?.url || ""; } };
  }
  if (section === "passport") {
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
    const documents = Array.isArray(licence?.documents) ? licence.documents : Array.isArray(existing.documents) ? existing.documents : [];
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
    const existingEid = existing.emiratesId || {};
    const existingPassport = existing.passport || {};
    const documents = Array.isArray(contact?.emiratesId?.documents) ? contact.emiratesId.documents : Array.isArray(existingEid.documents) ? existingEid.documents : [];
    const frontDocuments = Array.isArray(contact?.emiratesId?.frontDocuments) ? contact.emiratesId.frontDocuments : Array.isArray(existingEid.frontDocuments) ? existingEid.frontDocuments : [];
    const backDocuments = Array.isArray(contact?.emiratesId?.backDocuments) ? contact.emiratesId.backDocuments : Array.isArray(existingEid.backDocuments) ? existingEid.backDocuments : [];
    const passportDocuments = Array.isArray(contact?.passport?.documents) ? contact.passport.documents : Array.isArray(existingPassport.documents) ? existingPassport.documents : [];
    return {
      ...contact,
      emiratesId: {
        ...(contact.emiratesId || {}),
        documents,
        frontDocuments,
        backDocuments,
        documentUrl: contact?.emiratesId?.documentUrl || documents[documents.length - 1]?.url || existingEid.documentUrl || "",
        frontDocumentUrl: contact?.emiratesId?.frontDocumentUrl || frontDocuments[frontDocuments.length - 1]?.url || existingEid.frontDocumentUrl || "",
        backDocumentUrl: contact?.emiratesId?.backDocumentUrl || backDocuments[backDocuments.length - 1]?.url || existingEid.backDocumentUrl || "",
      },
      passport: {
        ...(contact.passport || {}),
        documents: passportDocuments,
        documentUrl: contact?.passport?.documentUrl || passportDocuments[passportDocuments.length - 1]?.url || existingPassport.documentUrl || "",
      },
    };
  });
}

function findInvalidContactMobile(contactPersons = []) {
  return contactPersons.findIndex((contact) => {
    const digits = normalizePhoneNumber(contact?.mobile?.number || "");
    if (!digits.length) return false;
    const { min, max } = getPhoneNumberSpec(contact?.mobile?.countryCode);
    return digits.length < min || digits.length > max;
  });
}

function findMissingContactName(contactPersons = []) {
  return contactPersons.findIndex((contact) => !String(contact?.fullName || "").trim());
}

function toTrimmedString(value) {
  return String(value ?? "").trim();
}

function toOptionalString(value) {
  const normalized = toTrimmedString(value);
  return normalized || undefined;
}

function toBooleanFlag(value, fallback = false) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (!normalized) return fallback;
  return ["yes", "true", "1", "y"].includes(normalized);
}

function normalizeBulkStatus(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (["registered", "applying", "not_registered", "exempt"].includes(normalized)) return normalized;
  if (normalized === "applying / in progress" || normalized === "in progress") return "applying";
  if (normalized === "not registered") return "not_registered";
  return undefined;
}

function normalizeBulkFrequency(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (["monthly", "quarterly", "annual"].includes(normalized)) return normalized;
  return undefined;
}

function normalizeBulkJurisdiction(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "free zone") return "freezone";
  if (normalized === "designated zone") return "designated_zone";
  if (["mainland", "freezone", "designated_zone", "offshore"].includes(normalized)) return normalized;
  return undefined;
}

function normalizeBulkClientType(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "natural person") return "natural";
  if (normalized === "legal person") return "legal";
  return ["legal", "natural"].includes(normalized) ? normalized : undefined;
}

function normalizeBulkLicenceType(value) {
  const normalized = toTrimmedString(value).toLowerCase();
  if (["commercial", "professional", "industrial", "tourism"].includes(normalized)) return normalized;
  return undefined;
}

function normalizeBulkDate(value) {
  const normalized = toTrimmedString(value);
  if (!normalized) return undefined;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "__invalid__" : normalized;
}

async function mapBulkRowToClient(row) {
  const legalName = toOptionalString(row.legalName || row.name);
  const financialYearEnd = toOptionalString(row.financialYearEnd || row.fye);
  const jurisdiction = normalizeBulkJurisdiction(row.jurisdiction);
  const clientType = normalizeBulkClientType(row.clientType) || "legal";
  const licenceNumber = toOptionalString(row.licenceNumber || row.licence || row["Trade Licence No."]);
  const contactName = toOptionalString(row.contactName || row["Contact Name"]);
  const contactMobile = toTrimmedString(row.contactMobile || row.mobile || row["Contact Mobile"]);
  const contactCountryCode = toOptionalString(row.contactCountryCode || row.contactCode || row.mobileCountryCode);
  const emiratesIdNumber = toOptionalString(row.emiratesIdNumber || row.eid || row.emiratesId);
  const vatRegistrationDate = normalizeBulkDate(row.vatRegistrationDate || row.vatDate);
  const ctRegistrationDate = normalizeBulkDate(row.ctRegistrationDate || row.ctDate);
  const licenceIssueDate = normalizeBulkDate(row.licenceIssueDate || row.issueDate);
  const licenceExpiryDate = normalizeBulkDate(row.licenceExpiryDate || row.expiryDate);
  const emiratesIdIssueDate = normalizeBulkDate(row.emiratesIdIssueDate || row.eidIssueDate);
  const emiratesIdExpiryDate = normalizeBulkDate(row.emiratesIdExpiryDate || row.eidExpiryDate);
  const passportIssueDate = normalizeBulkDate(row.passportIssueDate);
  const passportExpiryDate = normalizeBulkDate(row.passportExpiryDate);

  if (!legalName) throw new Error("Legal name is required.");
  if (!financialYearEnd) throw new Error("Financial year end is required.");
  if (!jurisdiction) throw new Error("Jurisdiction must be one of mainland, freezone, designated_zone, or offshore.");
  if (!licenceNumber) throw new Error("Trade licence number is required.");
  if (!contactName) throw new Error("Contact name is required.");

  const invalidDateField = [
    ["licenceIssueDate", licenceIssueDate],
    ["licenceExpiryDate", licenceExpiryDate],
    ["emiratesIdIssueDate", emiratesIdIssueDate],
    ["emiratesIdExpiryDate", emiratesIdExpiryDate],
    ["passportIssueDate", passportIssueDate],
    ["passportExpiryDate", passportExpiryDate],
    ["vatRegistrationDate", vatRegistrationDate],
    ["ctRegistrationDate", ctRegistrationDate],
  ].find(([, value]) => value === "__invalid__");
  if (invalidDateField) throw new Error(`${invalidDateField[0]} has an invalid date value.`);

  if (contactMobile && !contactCountryCode) throw new Error("Contact country code is required when contact mobile is provided.");
  if (contactMobile) {
    const digits = normalizePhoneNumber(contactMobile);
    const normalizedCountryCode = normalizeDialCode(contactCountryCode);
    const { min } = getPhoneNumberSpec(normalizedCountryCode);
    if (digits.length !== min) throw new Error(`Contact mobile must be exactly ${min} digits.`);
  }
  if (emiratesIdNumber && !/^784-\d{4}-\d{7}-\d$/.test(emiratesIdNumber)) {
    throw new Error("Emirates ID must match 784-XXXX-XXXXXXX-X.");
  }

  let assignedUser;
  const assignedUserName = toOptionalString(row.assignedUser);
  if (assignedUserName) {
    const user = await User.findOne({ name: new RegExp(`^${escapeRegex(assignedUserName)}$`, "i"), isActive: true }).select("_id");
    if (!user) throw new Error(`Assigned user "${assignedUserName}" was not found.`);
    assignedUser = user._id;
  }

  let group;
  const groupName = toOptionalString(row.group || row.groupName);
  if (groupName) {
    const existingGroup = await ClientGroup.findOne({ name: new RegExp(`^${escapeRegex(groupName)}$`, "i") }).select("_id");
    if (!existingGroup) throw new Error(`Client group "${groupName}" was not found.`);
    group = existingGroup._id;
  }

  const vatStatus = normalizeBulkStatus(row.vatStatus) || "not_registered";
  const ctStatus = normalizeBulkStatus(row.ctStatus) || "not_registered";
  const vatFrequency = normalizeBulkFrequency(row.vatFilingFrequency || row.vatFreq) || "quarterly";
  const licenceType = normalizeBulkLicenceType(row.licenceType) || "commercial";

  const correspondenceSame = toBooleanFlag(row.correspondenceSameAsRegistered, true);
  const registeredAddress = {
    country: toOptionalString(row.registeredCountry) || "United Arab Emirates",
    emirate: toOptionalString(row.registeredEmirate),
    street: toOptionalString(row.registeredStreet),
    poBox: toOptionalString(row.registeredPoBox),
    postalCode: toOptionalString(row.registeredPostalCode),
  };
  const correspondenceAddress = correspondenceSame ? undefined : {
    country: toOptionalString(row.correspondenceCountry) || "United Arab Emirates",
    emirate: toOptionalString(row.correspondenceEmirate),
    street: toOptionalString(row.correspondenceStreet),
    poBox: toOptionalString(row.correspondencePoBox),
    postalCode: toOptionalString(row.correspondencePostalCode),
  };

  return {
    fileNo: toOptionalString(row.fileNo),
    clientType,
    legalName,
    tradeName: toOptionalString(row.tradeName),
    financialYearEnd,
    jurisdiction,
    assignedUser,
    group,
    registeredAddress,
    correspondenceAddress,
    tradeLicences: [{
      licenceNumber,
      issueDate: licenceIssueDate || undefined,
      expiryDate: licenceExpiryDate || undefined,
      issuingAuthority: toOptionalString(row.licenceAuthority),
      licenceType,
      officialEmail: toOptionalString(row.licenceOfficialEmail),
    }],
    contactPersons: [{
      fullName: contactName,
      designation: toOptionalString(row.contactDesignation),
      email: toOptionalString(row.contactEmail),
      mobile: { countryCode: normalizeDialCode(contactCountryCode), number: normalizePhoneNumber(contactMobile) || undefined },
      whatsapp: toOptionalString(row.contactWhatsapp),
      alternateEmail: toOptionalString(row.contactAlternateEmail),
      isPrimary: toBooleanFlag(row.contactPrimary, true),
      emiratesId: {
        number: emiratesIdNumber,
        issueDate: emiratesIdIssueDate || undefined,
        expiryDate: emiratesIdExpiryDate || undefined,
      },
      passport: {
        number: toOptionalString(row.passportNumber),
        issuingCountry: toOptionalString(row.passportIssuingCountry) || "United Arab Emirates",
        issueDate: passportIssueDate || undefined,
        expiryDate: passportExpiryDate || undefined,
      },
    }],
    vatDetails: {
      trn: toOptionalString(row.vatTrn || row.trn || row["VAT TRN"]),
      status: vatStatus,
      registrationDate: vatRegistrationDate || undefined,
      filingFrequency: vatFrequency,
    },
    ctDetails: {
      tin: toOptionalString(row.ctTin),
      status: ctStatus,
      registrationDate: ctRegistrationDate || undefined,
      financialYearEnd: toOptionalString(row.ctFinancialYearEnd) || financialYearEnd,
    },
    portalLogins: [],
    customFields: {
      qrmpPreference: toOptionalString(row.qrmpPreference),
      auditFirmName: toOptionalString(row.auditFirmName),
      bankName: toOptionalString(row.bankName),
      iban: toOptionalString(row.iban),
      extraFields: [],
    },
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
    const admins = await User.find({ role: "admin", isActive: true });
    await Notification.insertMany(admins.map((admin) => ({
      recipient: admin._id, title: "New client added", message: `${client.legalName} was added.`, type: "client_added", relatedClient: client._id,
    })));
    res.status(201).json(client);
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
    if ("contactPersons" in req.body) {
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
    ALLOWED.forEach((key) => { if (key in req.body) client[key] = req.body[key]; });
    if ("fileNo" in req.body) {
      client.fileNo = normalizeFileNo(req.body.fileNo) || originalFileNo;
    }
    await client.save();
    res.json(client);
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
    const rows = Array.isArray(req.body.rows) ? req.body.rows : req.body;
    let added = 0, skipped = 0;
    const errors = [];
    for (const [index, row] of rows.entries()) {
      try {
        const payload = await mapBulkRowToClient(row);
        if (payload.fileNo) {
          const existingFileNo = await findExistingFileNo(payload.fileNo);
          if (existingFileNo) throw new Error(`Client file number "${payload.fileNo}" already exists.`);
        }
        const exists = await findDuplicateClient(payload);
        if (exists) { skipped += 1; continue; }
        const missingContactNameIndex = findMissingContactName(payload.contactPersons);
        if (missingContactNameIndex >= 0) throw new Error(`Contact person ${missingContactNameIndex + 1}: Full name is required.`);
        const invalidContactIndex = findInvalidContactMobile(payload.contactPersons);
        if (invalidContactIndex >= 0) throw new Error(`Contact person ${invalidContactIndex + 1}: Invalid number.`);
        const emptyLicenceIndex = (payload.tradeLicences || []).findIndex((l) => !l?.licenceNumber?.trim());
        if (payload.tradeLicences?.length && emptyLicenceIndex >= 0) throw new Error(`Trade licence ${emptyLicenceIndex + 1}: Licence number is required.`);
        await Client.create({
          ...payload,
          fileNo: payload.fileNo || await nextClientFileNo(),
          createdBy: req.user._id,
        });
        added += 1;
      } catch (error) { errors.push({ row: index + 2, message: error.message }); }
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
    const uploadedFiles = buildUploadedFiles(req);
    if (!uploadedFiles.length) return res.status(400).json({ message: "Please choose a file to upload" });
    uploadedFiles.forEach((uploadedFile) => {
      client.attachments.push(toStoredFileEntry(uploadedFile, req.user._id, {
        documentType: req.body.documentType,
        description: req.body.description,
      }));
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
    const section = req.body.section;
    const description = req.body.description || "";
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ message: "A valid document index is required" });
    const container = getDocumentContainer(client, section, index);
    if (!container) return res.status(400).json({ message: "Unsupported document section" });

    uploadedFiles.forEach((uploadedFile) => {
      container.holder[container.key].push(toStoredFileEntry(uploadedFile, req.user._id, { description }));
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
    const document = container.holder[container.key].id(req.params.documentId);
    if (!document) return res.status(404).json({ message: "Document not found" });
    document.deleteOne();
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
