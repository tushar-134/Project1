const { validationResult } = require("express-validator");
const XLSX = require("xlsx");
const ClientVisit = require("../models/ClientVisit");
const Client = require("../models/Client");
const User = require("../models/User");
const { nextVisitId } = require("../utils/autoId");
const { buildSimplePdf } = require("../utils/simplePdf");
const { normalizeStoredUploadUrl } = require("../utils/uploadUrl");

const populateVisit = [
  { path: "client", select: "legalName fileNo assignedUser registeredAddress correspondenceAddress contactPersons" },
  { path: "assignedUsers.user", select: "name role email" },
  { path: "activityLogs.user", select: "name email role" },
  { path: "createdBy", select: "name email role" },
];

const VISIT_TYPES = [
  "Requirement Gathering",
  "Verification",
  "Onboarding Discussion",
  "Follow Up",
  "Monthly Visit",
  "General Meeting",
];

function getErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  res.status(400).json({ errors: errors.array() });
  return errors.array();
}

function visitScope(req) {
  if (req.user.role === "task_only") {
    return { "assignedUsers.user": req.user._id };
  }
  return {};
}

function canManageVisit(req) {
  return req.user.role === "admin" || req.user.role === "manager";
}

function parse12HourTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM") hours += 12;
  return { hours, minutes };
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const parsed = parse12HourTime(timeValue);
  if (!parsed) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

function combineDateAndLegacyTime(dateValue, timeValue) {
  const match = String(timeValue || "").trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

function combineDateAndTimeInput(dateValue, timeValue) {
  const match = String(timeValue || "").trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

function normalizeLegacyRange(checkInAt, checkOutAt) {
  if (!checkInAt || !checkOutAt) return { checkInAt, checkOutAt };
  if (checkOutAt >= checkInAt) return { checkInAt, checkOutAt };
  const adjusted = new Date(checkOutAt);
  if (adjusted.getHours() < 12) {
    adjusted.setHours(adjusted.getHours() + 12);
  } else {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  return { checkInAt, checkOutAt: adjusted };
}

function formatVisitTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function deriveStatus(assignedUsers = [], explicitStatus) {
  if (explicitStatus === "cancelled") return "cancelled";
  if (!assignedUsers.length) return explicitStatus || "planned";
  const checkedIn = assignedUsers.filter((entry) => entry.checkInAt).length;
  const checkedOut = assignedUsers.filter((entry) => entry.checkOutAt).length;
  if (!checkedIn) return "planned";
  if (checkedOut === assignedUsers.length) return "completed";
  return "in_progress";
}

function durationMinutes(checkInAt, checkOutAt) {
  if (!checkInAt || !checkOutAt) return undefined;
  return Math.max(0, Math.round((new Date(checkOutAt) - new Date(checkInAt)) / 60000));
}

function visitClientName(visit) {
  return visit.clientType === "new"
    ? visit.newClient?.authorityName || "New Client"
    : visit.client?.legalName || "Unknown Client";
}

function visitClientLocation(visit) {
  if (visit.clientType === "new") return visit.newClient?.location || visit.location || "-";
  const registered = visit.client?.registeredAddress || {};
  const correspondence = visit.client?.correspondenceAddress || {};
  return visit.location
    || [registered.emirate, registered.street].filter(Boolean).join(", ")
    || [correspondence.emirate, correspondence.street].filter(Boolean).join(", ")
    || "-";
}

function serializeVisit(visit) {
  const assignedUsers = (visit.assignedUsers || []).map((entry) => ({
    ...(entry.toObject?.() || entry),
    selfieUrl: normalizeStoredUploadUrl(entry.selfieUrl),
  }));
  return {
    ...visit.toObject({ virtuals: true }),
    assignedUsers,
    clientName: visitClientName(visit),
    clientLocation: visitClientLocation(visit),
    teamLead: visit.assignedUsers?.[0]?.user || null,
    checkInStatus: visit.assignedUsers?.some((entry) => entry.checkInAt) ? "Checked In" : "Pending",
    checkOutStatus: visit.assignedUsers?.every((entry) => entry.checkOutAt) && visit.assignedUsers?.length ? "Checked Out" : "Pending",
  };
}

function appendActivity(visit, userId, action, message) {
  visit.activityLogs = Array.isArray(visit.activityLogs) ? visit.activityLogs : [];
  visit.activityLogs.unshift({ action, message, user: userId, createdAt: new Date() });
}

function normalizeAssignedUsers(assignedUsers = []) {
  const byUser = new Map();
  assignedUsers.forEach((entry) => {
    const userId = String(entry?.user || "").trim();
    if (!userId || byUser.has(userId)) return;
    byUser.set(userId, {
      user: userId,
      notes: String(entry?.notes || "").trim(),
      visitSummary: String(entry?.visitSummary || "").trim(),
      followUpRequired: Boolean(entry?.followUpRequired),
    });
  });
  return [...byUser.values()];
}

async function ensureUsersExist(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map((id) => String(id)))];
  if (!uniqueIds.length) return [];
  const users = await User.find({ _id: { $in: uniqueIds }, isActive: true }).select("_id role");
  if (users.length !== uniqueIds.length) return null;
  return users;
}

async function backfillVisit(visit) {
  let changed = false;

  if (!visit.visitId) {
    const year = new Date(visit.visitDate || Date.now()).getUTCFullYear();
    visit.visitId = await nextVisitId(year);
    changed = true;
  }

  if (!visit.clientType) {
    visit.clientType = visit.client ? "existing" : "new";
    changed = true;
  }

  if (!visit.visitType) {
    visit.visitType = "Requirement Gathering";
    changed = true;
  }

  if ((!visit.assignedUsers || !visit.assignedUsers.length) && Array.isArray(visit.visitors) && visit.visitors.length) {
    visit.assignedUsers = visit.visitors.map((entry) => {
      const range = normalizeLegacyRange(
        combineDateAndLegacyTime(visit.visitDate, entry.checkInTime),
        combineDateAndLegacyTime(visit.visitDate, entry.checkOutTime)
      );
      return {
        user: entry.user,
        checkInAt: range.checkInAt,
        checkOutAt: range.checkOutAt,
        durationMinutes: durationMinutes(range.checkInAt, range.checkOutAt),
      };
    });
    changed = true;
  }

  const derivedStatus = deriveStatus(visit.assignedUsers || [], visit.status);
  if (visit.status !== derivedStatus) {
    visit.status = derivedStatus;
    changed = true;
  }

  if (!Array.isArray(visit.activityLogs) || !visit.activityLogs.length) {
    appendActivity(visit, visit.createdBy, "Visit Created", "Visit record created");
    changed = true;
  }

  if (changed) {
    await visit.save();
    return visit.populate(populateVisit);
  }
  return visit;
}

async function getVisitOr404(req, res) {
  let visit = await ClientVisit.findOne({ _id: req.params.id, ...visitScope(req) }).populate(populateVisit);
  if (!visit) {
    res.status(404).json({ message: "Visit record not found" });
    return null;
  }
  visit = await backfillVisit(visit);
  return visit;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildFilteredVisits(req, { exportMode = false } = {}) {
  const {
    status,
    visitType,
    clientType,
    clientId,
    clientName,
    userName,
    fromDate,
    toDate,
    sortBy = "visitDate",
    sortDir = "desc",
    page = 1,
    limit = 10,
  } = req.query;

  const query = { ...visitScope(req) };

  // 1. Status Filter
  if (status && status !== "all") {
    query.status = { $in: status.split(",") };
  }

  // 2. Visit Type Filter
  if (visitType && visitType !== "all") {
    query.visitType = visitType;
  }

  // 3. Client Type Filter
  if (clientType && clientType !== "all") {
    query.clientType = clientType;
  }

  // 4. Client ID Filter
  if (clientId) {
    query.client = clientId;
  }

  // 5. Client Name / Search Filter
  if (clientName && String(clientName).trim()) {
    const term = String(clientName).trim();
    const regex = new RegExp(escapeRegex(term), "i");

    // Resolve matching existing clients
    const matchedClients = await Client.find({
      $or: [
        { legalName: regex },
        { fileNo: regex }
      ]
    }).select("_id").lean();
    const matchedClientIds = matchedClients.map((c) => c._id);

    query.$or = [
      { client: { $in: matchedClientIds } },
      { "newClient.authorityName": regex },
      { location: regex },
      { "newClient.location": regex }
    ];
  }

  // 6. User Name Filter
  if (userName && String(userName).trim()) {
    const term = String(userName).trim();
    const regex = new RegExp(escapeRegex(term), "i");

    const matchedUsers = await User.find({ name: regex }).select("_id").lean();
    const matchedUserIds = matchedUsers.map((u) => u._id);

    query["assignedUsers.user"] = { $in: matchedUserIds };
  }

  // 7. Date Range Filter
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;
  if (to) to.setHours(23, 59, 59, 999);

  if (from || to) {
    query.visitDate = {};
    if (from) query.visitDate.$gte = from;
    if (to) query.visitDate.$lte = to;
  }

  // 8. Sorting Configuration
  const direction = sortDir === "asc" ? 1 : -1;
  let dbSort = {};
  switch (sortBy) {
    case "visitId":
      dbSort = { visitId: direction };
      break;
    case "status":
      dbSort = { status: direction };
      break;
    case "type":
      dbSort = { visitType: direction };
      break;
    case "createdAt":
      dbSort = { createdAt: direction };
      break;
    case "visitDate":
    default:
      dbSort = { visitDate: direction, visitTime: direction };
      break;
  }

  // Count total matching records natively in MongoDB
  const total = await ClientVisit.countDocuments(query);

  let visitsQuery = ClientVisit.find(query).populate(populateVisit);
  
  if (sortBy !== "client") {
    visitsQuery = visitsQuery.sort(dbSort);
  }

  const isClientSort = sortBy === "client";
  let visits;

  if (isClientSort && !exportMode) {
    // Elegant graceful degradation for clientName alphabetical sort:
    // Fetch matching, populate, sort in-memory, then slice/paginate
    const allVisits = await visitsQuery;
    const hydrated = await Promise.all(allVisits.map((visit) => backfillVisit(visit)));
    hydrated.sort((left, right) => {
      const a = visitClientName(left);
      const b = visitClientName(right);
      if (a < b) return -1 * direction;
      if (a > b) return 1 * direction;
      return 0;
    });

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
    const start = (pageNumber - 1) * pageSize;
    visits = hydrated.slice(start, start + pageSize);
  } else if (!exportMode) {
    // High-performance database pagination (covers 99% of visit tracker requests)
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
    
    visitsQuery = visitsQuery.skip((pageNumber - 1) * pageSize).limit(pageSize);
    const pageVisits = await visitsQuery;
    // Only backfill/hydrate the paginated slice (e.g. 10 items instead of full DB)
    visits = await Promise.all(pageVisits.map((visit) => backfillVisit(visit)));
  } else {
    // Export mode: fetch and backfill all records matching query
    const allVisits = await visitsQuery;
    const hydrated = await Promise.all(allVisits.map((visit) => backfillVisit(visit)));
    if (isClientSort) {
      hydrated.sort((left, right) => {
        const a = visitClientName(left);
        const b = visitClientName(right);
        if (a < b) return -1 * direction;
        if (a > b) return 1 * direction;
        return 0;
      });
    }
    visits = hydrated;
  }

  if (!exportMode) {
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
    return {
      items: visits.map(serializeVisit),
      total,
      page: pageNumber,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      filters: { status, visitType, clientType, clientName, userName, fromDate, toDate },
      visitTypes: VISIT_TYPES,
    };
  }

  return visits.map(serializeVisit);
}

function exportRows(visits = [], requestedColumns = []) {
  const HEADER_MAP = {
    visitId: "Visit ID",
    clientName: "Client Name",
    clientType: "Client Type",
    visitDate: "Visit Date",
    visitTime: "Visit Time",
    visitType: "Visit Type",
    location: "Location",
    status: "Status",
    assignedUsers: "Assigned Users",
    teamLead: "Team Lead",
    checkInStatus: "Check-In Status",
    checkOutStatus: "Check-Out Status",
    createdBy: "Created By",
    remarks: "Remarks",
  };

  const getBaseCell = (visit, col) => {
    switch (col) {
      case "visitId": return visit.visitId || "";
      case "clientName": return visit.clientName || "";
      case "clientType": return visit.clientType || "";
      case "visitDate": return visit.visitDate ? new Date(visit.visitDate).toISOString().slice(0, 10) : "";
      case "visitTime": return visit.visitTime || "";
      case "visitType": return visit.visitType || "";
      case "location": return visit.clientLocation || visit.location || "";
      case "status": return visit.status || "";
      case "assignedUsers": return (visit.assignedUsers || []).map((entry) => entry.user?.name || "").filter(Boolean).join(", ");
      case "teamLead": return visit.teamLead?.name || "";
      case "checkInStatus": return visit.checkInStatus || "";
      case "checkOutStatus": return visit.checkOutStatus || "";
      case "createdBy": return visit.createdBy?.name || "";
      case "remarks": return visit.remarks || "";
      default: return "";
    }
  };

  const orderedHeaders = requestedColumns.map(k => HEADER_MAP[k]).filter(Boolean);

  const rows = visits.map((visit) => {
    const row = {};
    requestedColumns.forEach((col) => {
      const header = HEADER_MAP[col];
      if (header) {
        row[header] = getBaseCell(visit, col);
      }
    });
    return row;
  });

  return { rows, orderedHeaders };
}

exports.listVisits = async (req, res, next) => {
  try {
    res.json(await buildFilteredVisits(req));
  } catch (error) {
    next(error);
  }
};

exports.getVisit = async (req, res, next) => {
  try {
    const visit = await getVisitOr404(req, res);
    if (!visit) return;
    res.json(serializeVisit(visit));
  } catch (error) {
    next(error);
  }
};

exports.createVisit = async (req, res, next) => {
  try {
    if (getErrors(req, res)) return;

    const {
      clientType = "existing",
      client,
      newClient = {},
      visitDate,
      visitTime,
      visitType = "Requirement Gathering",
      location,
      remarks,
      assignedUsers = [],
    } = req.body;



    if (clientType === "existing" && !client) {
      return res.status(400).json({ message: "Please select an existing client." });
    }
    if (clientType === "existing") {
      const existingClient = await Client.findById(client).select("_id");
      if (!existingClient) {
        return res.status(400).json({ message: "Selected client was not found." });
      }
    }
    if (clientType === "new") {
      if (!String(newClient.authorityName || "").trim()) {
        return res.status(400).json({ message: "Name is required." });
      }
      if (!String(newClient.mobileNumber || "").trim()) {
        return res.status(400).json({ message: "Mobile Number is required." });
      }
      if (!String(newClient.location || "").trim()) {
        return res.status(400).json({ message: "Location is required." });
      }
    }

    const normalizedAssignedUsers = req.user.role === "task_only"
      ? [{ user: req.user._id }]
      : normalizeAssignedUsers(assignedUsers);
    if (!normalizedAssignedUsers.length) {
      return res.status(400).json({ message: "Please assign at least one user." });
    }
    if (req.user.role === "task_only" && normalizedAssignedUsers.some((entry) => String(entry.user) !== String(req.user._id))) {
      return res.status(403).json({ message: "Task Only users can only create visits for themselves." });
    }

    const users = await ensureUsersExist(normalizedAssignedUsers.map((entry) => entry.user));
    if (!users) {
      return res.status(400).json({ message: "One or more assigned users are invalid or inactive." });
    }

    const year = new Date(visitDate).getUTCFullYear();
    const visit = await ClientVisit.create({
      visitId: await nextVisitId(year),
      clientType,
      client: clientType === "existing" ? client : undefined,
      newClient: clientType === "new" ? {
        authorityName: String(newClient.authorityName || "").trim(),
        mobileCountryCode: String(newClient.mobileCountryCode || "").trim(),
        mobileNumber: String(newClient.mobileNumber || "").trim(),
        email: String(newClient.email || "").trim(),
        location: String(newClient.location || "").trim(),
      } : undefined,
      visitDate,
      visitTime: String(visitTime || "").trim(),
      visitType: VISIT_TYPES.includes(visitType) ? visitType : "Requirement Gathering",
      location: String(location || "").trim(),
      remarks: String(remarks || "").trim(),
      status: "planned",
      assignedUsers: normalizedAssignedUsers,
      createdBy: req.user._id,
      activityLogs: [{ action: "Visit Created", message: "Visit scheduled", user: req.user._id }],
    });

    appendActivity(
      visit,
      req.user._id,
      "Users Assigned",
      `${normalizedAssignedUsers.length} user${normalizedAssignedUsers.length === 1 ? "" : "s"} assigned`
    );
    await visit.save();
    res.status(201).json(serializeVisit(await visit.populate(populateVisit)));
  } catch (error) {
    next(error);
  }
};

exports.updateVisit = async (req, res, next) => {
  try {
    if (getErrors(req, res)) return;
    if (!canManageVisit(req)) {
      return res.status(403).json({ message: "Only Admin and Manager can edit visits." });
    }

    const visit = await getVisitOr404(req, res);
    if (!visit) return;

    const {
      clientType = visit.clientType,
      client,
      newClient = visit.newClient || {},
      visitDate = visit.visitDate,
      visitTime = visit.visitTime,
      visitType = visit.visitType,
      location = visit.location,
      remarks = visit.remarks,
      assignedUsers = visit.assignedUsers.map((entry) => ({ user: entry.user?._id || entry.user })),
      status = visit.status,
    } = req.body;


    if (clientType === "existing" && !client) {
      return res.status(400).json({ message: "Please select an existing client." });
    }
    if (clientType === "existing") {
      const existingClient = await Client.findById(client).select("_id");
      if (!existingClient) {
        return res.status(400).json({ message: "Selected client was not found." });
      }
    }
    if (clientType === "new") {
      if (!String(newClient.authorityName || "").trim()) {
        return res.status(400).json({ message: "Name is required." });
      }
      if (!String(newClient.mobileNumber || "").trim()) {
        return res.status(400).json({ message: "Mobile Number is required." });
      }
      if (!String(newClient.location || "").trim()) {
        return res.status(400).json({ message: "Location is required." });
      }
    }

    const normalizedAssignedUsers = normalizeAssignedUsers(assignedUsers);
    if (!normalizedAssignedUsers.length) {
      return res.status(400).json({ message: "Please assign at least one user." });
    }
    const users = await ensureUsersExist(normalizedAssignedUsers.map((entry) => entry.user));
    if (!users) {
      return res.status(400).json({ message: "One or more assigned users are invalid or inactive." });
    }

    visit.clientType = clientType;
    visit.client = clientType === "existing" ? client : undefined;
    visit.newClient = clientType === "new" ? {
      authorityName: String(newClient.authorityName || "").trim(),
      mobileCountryCode: String(newClient.mobileCountryCode || "").trim(),
      mobileNumber: String(newClient.mobileNumber || "").trim(),
      email: String(newClient.email || "").trim(),
      location: String(newClient.location || "").trim(),
    } : undefined;
    visit.visitDate = visitDate;
    visit.visitTime = String(visitTime || "").trim();
    visit.visitType = VISIT_TYPES.includes(visitType) ? visitType : "Requirement Gathering";
    visit.location = String(location || "").trim();
    if (remarks !== undefined) {
      visit.remarks = String(remarks).trim();
    }

    const previousAssignedByUser = new Map(
      (visit.assignedUsers || []).map((entry) => [String(entry.user?._id || entry.user), entry])
    );
    visit.assignedUsers = normalizedAssignedUsers.map((entry) => {
      const existing = previousAssignedByUser.get(String(entry.user));
      return {
        user: entry.user,
        checkInAt: existing?.checkInAt,
        checkOutAt: existing?.checkOutAt,
        durationMinutes: existing?.durationMinutes,
        visitSummary: existing?.visitSummary,
        followUpRequired: existing?.followUpRequired,
        notes: existing?.notes,
        gpsLocation: existing?.gpsLocation,
        selfieUrl: existing?.selfieUrl,
      };
    });

    visit.status = deriveStatus(visit.assignedUsers, status);
    appendActivity(visit, req.user._id, "Visit Updated", "Visit details updated");
    await visit.save();
    res.json(serializeVisit(await visit.populate(populateVisit)));
  } catch (error) {
    next(error);
  }
};

exports.checkIn = async (req, res, next) => {
  try {
    const visit = await getVisitOr404(req, res);
    if (!visit) return;
    if (visit.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled visits cannot be checked in." });
    }

    const targetUserId = canManageVisit(req) && req.body.userId ? String(req.body.userId) : String(req.user._id);
    const assignedUser = visit.assignedUsers.find((entry) => String(entry.user?._id || entry.user) === targetUserId);
    if (!assignedUser) {
      return res.status(404).json({ message: "Assigned user not found for this visit." });
    }
    if (assignedUser.checkInAt) {
      return res.status(409).json({ message: "This user has already checked in." });
    }

    assignedUser.checkInAt = new Date();
    assignedUser.notes = String(req.body.notes || assignedUser.notes || "").trim();
    assignedUser.gpsLocation = String(req.body.gpsLocation || assignedUser.gpsLocation || "").trim();
    assignedUser.selfieUrl = String(req.body.selfieUrl || assignedUser.selfieUrl || "").trim();
    visit.status = deriveStatus(visit.assignedUsers, visit.status);
    appendActivity(visit, req.user._id, "Check-In Completed", `${assignedUser.user?.name || "Assigned user"} checked in`);
    await visit.save();
    res.json(serializeVisit(await visit.populate(populateVisit)));
  } catch (error) {
    next(error);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const visit = await getVisitOr404(req, res);
    if (!visit) return;
    if (visit.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled visits cannot be checked out." });
    }

    const targetUserId = canManageVisit(req) && req.body.userId ? String(req.body.userId) : String(req.user._id);
    const assignedUser = visit.assignedUsers.find((entry) => String(entry.user?._id || entry.user) === targetUserId);
    if (!assignedUser) {
      return res.status(404).json({ message: "Assigned user not found for this visit." });
    }
    if (!assignedUser.checkInAt) {
      return res.status(400).json({ message: "Check-in is required before check-out." });
    }
    if (assignedUser.checkOutAt) {
      return res.status(409).json({ message: "This user has already checked out." });
    }

    assignedUser.checkOutAt = new Date();
    assignedUser.durationMinutes = durationMinutes(assignedUser.checkInAt, assignedUser.checkOutAt);
    assignedUser.visitSummary = String(req.body.visitSummary || assignedUser.visitSummary || "").trim();
    assignedUser.followUpRequired = Boolean(req.body.followUpRequired);
    assignedUser.notes = String(req.body.notes || assignedUser.notes || "").trim();
    visit.status = deriveStatus(visit.assignedUsers, visit.status);
    appendActivity(visit, req.user._id, "Check-Out Completed", `${assignedUser.user?.name || "Assigned user"} checked out`);
    await visit.save();
    res.json(serializeVisit(await visit.populate(populateVisit)));
  } catch (error) {
    next(error);
  }
};

exports.updateAttendance = async (req, res, next) => {
  try {
    if (getErrors(req, res)) return;
    const visit = await getVisitOr404(req, res);
    if (!visit) return;
    if (visit.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled visits cannot be updated." });
    }

    const checkInAt = combineDateAndTimeInput(visit.visitDate, req.body.checkInTime);
    const checkOutAt = req.body.checkOutTime
      ? combineDateAndTimeInput(visit.visitDate, req.body.checkOutTime)
      : null;
    if (!checkInAt) {
      return res.status(400).json({ message: "Check-in time is required." });
    }
    if (req.body.checkOutTime && !checkOutAt) {
      return res.status(400).json({ message: "Check-out time is invalid." });
    }

    const normalizedRange = normalizeLegacyRange(checkInAt, checkOutAt);
    const visitSummary = String(req.body.visitSummary || "").trim();
    visit.assignedUsers = (visit.assignedUsers || []).map((entry) => {
      entry.checkInAt = normalizedRange.checkInAt;
      entry.checkOutAt = normalizedRange.checkOutAt;
      entry.durationMinutes = durationMinutes(normalizedRange.checkInAt, normalizedRange.checkOutAt);
      entry.visitSummary = visitSummary;
      return entry;
    });
    visit.status = deriveStatus(visit.assignedUsers, visit.status);
    appendActivity(visit, req.user._id, "Visit Attendance Updated", "Visit timing and remarks updated");
    await visit.save();
    res.json(serializeVisit(await visit.populate(populateVisit)));
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    if (!canManageVisit(req)) {
      return res.status(403).json({ message: "Only Admin and Manager can update visit status." });
    }
    const visit = await getVisitOr404(req, res);
    if (!visit) return;
    if (req.body.status === "cancelled") {
      const hasSavedAttendance = (visit.assignedUsers || []).some((entry) => (
        entry.checkInAt || entry.checkOutAt || String(entry.visitSummary || "").trim()
      ));
      if (visit.status !== "planned" || hasSavedAttendance) {
        return res.status(400).json({ message: "Saved visits cannot be cancelled." });
      }
    }
    visit.status = req.body.status;
    appendActivity(visit, req.user._id, "Status Changed", `Visit status changed to ${req.body.status}`);
    await visit.save();
    res.json(serializeVisit(await visit.populate(populateVisit)));
  } catch (error) {
    next(error);
  }
};

exports.updateRemarks = async (req, res, next) => {
  try {
    const visit = await getVisitOr404(req, res);
    if (!visit) return;
    
    // In visits, "task_only" can post comments on visits assigned to them, 
    // managers/admins can post comments on any visit.
    const isAssigned = (visit.assignedUsers || []).some(entry => String(entry.user?._id || entry.user) === String(req.user._id));
    if (!canManageVisit(req) && !isAssigned) {
      return res.status(403).json({ message: "You don't have permission to comment on this visit." });
    }

    visit.remarks = req.body.remarks || "";
    appendActivity(visit, req.user._id, "Remarks Updated", "Added a comment to visit");
    await visit.save();
    res.json(serializeVisit(await visit.populate(populateVisit)));
  } catch (error) {
    next(error);
  }
};

exports.exportVisits = async (req, res, next) => {
  try {
    const format = String(req.query.format || "xlsx").toLowerCase();
    const isExportAll = req.query.mode === "all";
    const visits = await buildFilteredVisits(req, { exportMode: true });

    const ALL_COLUMNS = [
      "visitId", "clientName", "clientType", "visitDate", "visitTime",
      "visitType", "location", "status", "assignedUsers", "teamLead",
      "checkInStatus", "checkOutStatus", "createdBy", "remarks"
    ];
    
    const requestedColumns = isExportAll
      ? ALL_COLUMNS
      : (req.query.columns ? String(req.query.columns).split(",").map(c => c.trim()).filter(Boolean) : ALL_COLUMNS);

    const { rows, orderedHeaders } = exportRows(visits, requestedColumns);

    if (format === "pdf") {
      // Basic PDF logic fallback, usually PDF doesn't use dynamic columns easily with simple text building
      // We will supply all rows here
      const allRowsData = exportRows(visits, ALL_COLUMNS).rows;
      const lines = allRowsData.flatMap((row, index) => ([
        `${index + 1}. ${row["Visit ID"]} | ${row["Client Name"]} | ${row["Visit Date"]} ${row["Visit Time"]} | ${row["Visit Type"]} | ${row["Status"]}`,
        `   Team: ${row["Assigned Users"] || "-"} | Location: ${row.Location || "-"}`,
      ]));
      const pdf = buildSimplePdf("Client Visits Report", lines);
      res
        .setHeader("Content-Disposition", 'attachment; filename="client-visits.pdf"')
        .setHeader("Content-Type", "application/pdf")
        .send(pdf);
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: orderedHeaders });
    XLSX.utils.book_append_sheet(workbook, worksheet, "Client Visits");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    res
      .setHeader("Content-Disposition", 'attachment; filename="client-visits.xlsx"')
      .setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .send(buffer);
  } catch (error) {
    next(error);
  }
};
