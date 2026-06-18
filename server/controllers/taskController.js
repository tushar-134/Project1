const { validationResult } = require("express-validator");
const Task = require("../models/Task");
const Client = require("../models/Client");
const User = require("../models/User");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const auditLogger = require("../utils/auditLogger");
const { nextTaskId } = require("../utils/autoId");
const { buildUploadedFileUrl } = require("../utils/uploadUrl");
const xlsx = require("xlsx");

// Human-readable status labels for notification messages
const STATUS_LABEL = {
  not_started: "Not Yet Started",
  wip: "In Progress",
  submitted_to_fta: "Submitted to FTA",
  completed: "Completed",
};

// Reverse map: UI label → DB enum value
const LABEL_TO_STATUS = {
  "Not Yet Started": "not_started",
  "In Progress": "wip",
  "Submitted to FTA": "submitted_to_fta",
  "Completed": "completed",
};

// human readable status labels for notification messages
const FTA_STATUS_LABEL = {
  in_review: "In Review",
  additional_query: "Additional Query",
  approved: "Approved",
  rejected: "Rejected",
};


function statusLabel(s) { return STATUS_LABEL[s] || FTA_STATUS_LABEL[s] || s; }

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePagination(query = {}, defaultLimit = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || defaultLimit));
  return { page, limit };
}

function toUploadedFile(file, req) {
  const fileUrl = buildUploadedFileUrl(file, req);
  return {
    name: file.originalname || file.filename || "File",
    size: file.size ? `${(file.size / 1024 / 1024).toFixed(file.size >= 1024 * 1024 ? 2 : 3).replace(/\.?0+$/, "")} MB` : "",
    fileType: file.mimetype || "",
    url: fileUrl,
    storageProvider: file.key ? "s3" : "local",
    bucket: file.bucket || "",
    key: file.key || "",
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
    storageProvider: uploadedFile.storageProvider,
    bucket: uploadedFile.bucket,
    key: uploadedFile.key,
    uploadedBy: userId,
  };
}



function addFrequency(dateValue, frequency) {
  const date = asDate(dateValue);
  if (!date || !frequency) return null;
  const next = new Date(date);
  switch (frequency) {
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    case "quarterly":
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    case "semi_annual":
      next.setUTCMonth(next.getUTCMonth() + 6);
      return next;
    case "annual":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    default:
      return null;
  }
}

function calculateNextOccurrence(baseDate, config) {
  if (!baseDate || !config) return null;
  const { frequency } = config;
  const date = asDate(baseDate);
  if (!date) return null;

  return addFrequency(date, frequency);
}

function normalizeRecurringFields(body, fallbackDueDate) {
  if (!body.isRecurring) return { isRecurring: false, recurringConfig: undefined };
  const rc = body.recurringConfig || {};
  const frequency = rc.frequency;
  const daysBeforeDue = rc.daysBeforeDue ? Number(rc.daysBeforeDue) : 15;

  const dueDate = asDate(body.dueDate || fallbackDueDate);
  const providedNextDueDate = asDate(rc.nextDueDate);
  const calculatedNextDueDate = calculateNextOccurrence(dueDate, { frequency });
  const nextDueDate = providedNextDueDate && (!dueDate || providedNextDueDate > dueDate)
    ? providedNextDueDate
    : (providedNextDueDate || calculatedNextDueDate);
  const endDate = asDate(rc.endDate);
  return {
    isRecurring: true,
    recurringConfig: {
      frequency,
      daysBeforeDue,
      nextDueDate: nextDueDate || undefined,
      endDate: endDate || undefined,
    },
  };
}

async function ensureManagerCanAssign(req, assignedTo) {
  if (req.user.role !== "manager" || !assignedTo) return null;
  if (String(assignedTo) === String(req.user._id)) return null; // self-assign always OK
  const assignee = await User.findById(assignedTo).select("role");
  if (!assignee) return { status: 404, message: "Assigned user not found" };
  // Managers can only assign to themselves or associate users
  if (assignee.role !== "associate") {
    return { status: 403, message: "Managers can only assign tasks to themselves or associate users." };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Inline period helpers (CJS-safe — mirrors src/utils/periodUtils.js).
// Kept here so the controller has no FE import dependency.
// ---------------------------------------------------------------------------
const PERIOD_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseFYEStartMonth(fyeString) {
  if (!fyeString) return 0;
  const firstPart = fyeString.split("-")[0].trim();
  const idx = PERIOD_MONTH_NAMES.findIndex((m) => m.toLowerCase() === firstPart.slice(0, 3).toLowerCase());
  return idx >= 0 ? idx : 0;
}

function buildFYLabelServer(startYear, fyeString) {
  const startMonth = parseFYEStartMonth(fyeString);
  if (startMonth === 0) return `FY ${startYear}`;
  return `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
}

function getPeriodFromDateServer(date, fyeString) {
  if (!date) return { periodFY: "", periodQuarter: "" };
  const startMonth = parseFYEStartMonth(fyeString);
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();

  // Which 0-based quarter (within the FY) does this month fall in?
  let relativeMonth = (month - startMonth + 12) % 12;
  const qi = Math.floor(relativeMonth / 3); // 0-3

  // FY start year
  const fyStartYear = month >= startMonth ? year : year - 1;

  const qStart = (startMonth + qi * 3) % 12;
  const qEnd = (qStart + 2) % 12;

  return {
    periodFY: buildFYLabelServer(fyStartYear, fyeString),
    periodQuarter: `${PERIOD_MONTH_NAMES[qStart]}-${PERIOD_MONTH_NAMES[qEnd]}`,
  };
}
// ---------------------------------------------------------------------------

async function maybeGenerateNextRecurringTask(task, userId) {
  if (!task?.isRecurring || task.recurringGeneratedTask) return null;
  const rc = task.recurringConfig || {};
  const frequency = rc.frequency;
  const daysBeforeDue = rc.daysBeforeDue;

  const nextDueDate = asDate(rc.nextDueDate) || calculateNextOccurrence(task.dueDate, rc);
  if (!nextDueDate) return null;
  const endDate = asDate(rc.endDate);
  if (endDate && nextDueDate > endDate) return null;

  const followingDueDate = calculateNextOccurrence(nextDueDate, { frequency });

  // Compute the period for the new task from its due date and the client's FYE config.
  // The client may or may not be populated at this point, so we guard carefully.
  const clientFYE =
    (task.client && typeof task.client === "object" ? task.client.financialYearEnd : null) || "Jan - Dec";

  // Note: For VAT and CT specific period resolution we ideally need the full client object,
  // but if it's missing, getPeriodFromDateServer handles standard FY/Quarter logic based on FYE.
  const nextPeriod = getPeriodFromDateServer(nextDueDate, clientFYE);

  const nextTask = await Task.create({
    category: task.category,
    taskType: task.taskType,
    client: task.client,
    assignedTo: task.assignedTo,
    dueDate: nextDueDate,
    period: task.period, // legacy free-text — keep for backward compat
    periodFY: nextPeriod.periodFY || undefined,
    periodQuarter: nextPeriod.periodQuarter || undefined,
    description: task.description,
    status: "not_started",
    isRecurring: true,
    recurringConfig: {
      frequency,
      daysBeforeDue,
      nextDueDate: followingDueDate || undefined,
      endDate: endDate || undefined,
    },
    isAwaitingFta: task.isAwaitingFta,
    ftaStatus: task.isAwaitingFta ? "in_review" : null,
    ftaSubmittedDate: undefined,
    createdBy: userId || task.createdBy,
    taskId: await nextTaskId(nextDueDate.getUTCFullYear()),
  });

  task.recurringGeneratedTask = nextTask._id;
  await task.save();
  await auditLogger({
    task: nextTask._id,
    user: userId || task.createdBy,
    action: "Generated Recurrence",
    newStatus: nextTask.status,
    notes: `Generated from ${task.taskId}`,
  });
  if (nextTask.assignedTo) {
    await Notification.create({
      recipient: nextTask.assignedTo,
      title: "Recurring task generated",
      message: `${nextTask.taskId} — ${nextTask.taskType} (${statusLabel(nextTask.status)})`,
      type: "task_update",
      relatedTask: nextTask._id,
    });
  }
  return nextTask;
}

async function taskQuery(req) {
  // Query shaping happens once here so list and export stay aligned with the same role and filter logic.
  const { category, status, assignedTo, month, overdue, taskId, client, type, dueDate, assigned, remarks, recurring, createdAt, updatedAt, fromDate, toDate, reportBasedOn } = req.query;
  const query = {};
  const andClauses = [];

  if (category && category !== "All") query.category = category;
  if (status && status !== "All") {
    if (status === "Active") {
      query.status = { $in: ["not_started", "wip", "submitted_to_fta"] };
    } else {
      // Split comma-joined string and map human-readable labels → DB enum values
      const statusValues = status.split(",").map((s) => {
        const trimmed = s.trim();
        const lower = trimmed.toLowerCase();
        // find case-insensitive match in LABEL_TO_STATUS
        const matchKey = Object.keys(LABEL_TO_STATUS).find(k => k.toLowerCase() === lower);
        return matchKey ? LABEL_TO_STATUS[matchKey] : trimmed;
      }).filter(Boolean);
      query.status = { $in: statusValues };
    }
  }
  if (assignedTo) andClauses.push({ assignedTo });
  if (req.user.role === "associate") andClauses.push({ assignedTo: req.user._id });
  // Bug #7 Fix: Build the dueDate filter carefully so overdue never silently
  // clobber the month's $lt boundary. We now apply the month window first, then
  // tighten $lt to today only when no month is selected (overdue standalone).
  if (month) {
    const match = String(month).match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
        query.dueDate = { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
      }
    }
  }


  if (taskId) {
    query.taskId = new RegExp(escapeRegex(taskId.trim()), "i");
  }
  if (client) {
    const clientIds = await Client.find({
      isActive: true,
      legalName: new RegExp(escapeRegex(client.trim()), "i"),
    }).distinct("_id");
    query.client = clientIds.length ? { $in: clientIds } : { $in: [] };
  }
  if (type) {
    query.taskType = type;
  }
  if (dueDate) {
    const start = new Date(`${dueDate}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      query.dueDate = { ...(query.dueDate || {}), $gte: start, $lt: end };
    }
  }
  if (assigned) {
    if (/^unassigned$/i.test(String(assigned).trim())) {
      andClauses.push({ assignedTo: null });
    } else {
      const userIds = await User.find({
        isActive: true,
        name: new RegExp(`^${escapeRegex(assigned.trim())}$`, "i"),
      }).distinct("_id");
      andClauses.push({ assignedTo: userIds.length ? { $in: userIds } : { $in: [] } });
    }
  }
  if (remarks) {
    query.remarks = new RegExp(escapeRegex(remarks.trim()), "i");
  }
  if (recurring === "recurring") query.isRecurring = true;
  if (recurring === "one-time") query.isRecurring = false;
  if (createdAt) {
    const start = new Date(`${createdAt}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      query.createdAt = { ...(query.createdAt || {}), $gte: start, $lt: end };
    }
  }
  if (updatedAt) {
    const start = new Date(`${updatedAt}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      query.updatedAt = { ...(query.updatedAt || {}), $gte: start, $lt: end };
    }
  }
  if (fromDate || toDate) {
    const targetField = reportBasedOn || "dueDate";
    const rangeQuery = {};
    if (fromDate) {
      const start = new Date(`${fromDate}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime())) rangeQuery.$gte = start;
    }
    if (toDate) {
      const end = new Date(`${toDate}T23:59:59.999Z`);
      if (!Number.isNaN(end.getTime())) rangeQuery.$lte = end;
    }
    if (Object.keys(rangeQuery).length > 0) {
      query[targetField] = { ...(query[targetField] || {}), ...rangeQuery };
    }
  }
  if (overdue === "true") {
    if (query.dueDate) {
      const today = new Date();
      if (query.dueDate.$lt === undefined && query.dueDate.$lte === undefined) {
        query.dueDate.$lt = today;
      } else {
        const currentUpper = query.dueDate.$lt !== undefined ? query.dueDate.$lt : query.dueDate.$lte;
        if (today < currentUpper) {
          delete query.dueDate.$lte;
          query.dueDate.$lt = today;
        }
      }
    } else {
      query.dueDate = { $lt: new Date() };
    }
    if (!query.status) query.status = { $ne: "completed" };
  }
  if (andClauses.length) query.$and = andClauses;
  return query;
}

const populateTask = [
  { path: "client", select: "legalName fileNo jurisdiction vatDetails tradeLicences contactPersons financialYearEnd" },
  { path: "assignedTo", select: "name email role" },
  { path: "createdBy", select: "name" },
  { path: "attachments.uploadedBy", select: "name" },
];

exports.listTasks = async (req, res, next) => {
  try {
    const { page: requestedPage, limit } = parsePagination(req.query, 20);
    const query = await taskQuery(req);
    const skip = (requestedPage - 1) * limit;

    const [total, tasks, statusCounts] = await Promise.all([
      Task.countDocuments(query),
      Task.find(query)
        .populate(populateTask)
        .sort({ updatedAt: -1, createdAt: -1, taskId: 1 })
        .skip(skip)
        .limit(limit),
      Task.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const totalCompleted = statusCounts
      .filter((s) => s._id === "completed")
      .reduce((sum, s) => sum + s.count, 0);
    const totalWorking = total - totalCompleted;

    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);
    res.json({ tasks, total, page, pages, limit, totalCompleted, totalWorking });
  } catch (error) { next(error); }
};

exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate(populateTask);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (req.user.role === "associate" && String(task.assignedTo?._id) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    const logs = await ActivityLog.find({ task: task._id }).populate("user", "name email role").sort({ createdAt: -1 });
    res.json({
      ...task.toObject(),
      logs
    });
  } catch (error) { next(error); }
};

exports.createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const assignmentError = await ensureManagerCanAssign(req, req.body.assignedTo);
    if (assignmentError) {
      return res.status(assignmentError.status).json({ message: assignmentError.message });
    }
    const status = req.body.status || (req.body.isAwaitingFta ? "submitted_to_fta" : "not_started");
    const recurringFields = normalizeRecurringFields(req.body, req.body.dueDate);
    const isAwaitingFta = req.body.isAwaitingFta || status === "submitted_to_fta";
    const task = await Task.create({
      ...req.body,
      ...recurringFields,
      status,
      taskId: await nextTaskId(new Date(req.body.dueDate).getUTCFullYear()),
      isAwaitingFta,
      ftaSubmittedDate: isAwaitingFta ? new Date() : undefined,
      ftaStatus: isAwaitingFta ? "in_review" : undefined,
      createdBy: req.user._id,
    });
    await auditLogger({ task: task._id, user: req.user._id, action: "Created", newStatus: task.status });
    if (task.assignedTo && String(task.assignedTo) !== String(req.user._id)) {
      await Notification.create({ recipient: task.assignedTo, title: "New task assigned", message: `${task.taskId} — ${task.taskType} (${statusLabel(task.status)})`, type: "task_update", relatedTask: task._id });
    }
    res.status(201).json(await task.populate(populateTask));
  } catch (error) { next(error); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (task.ftaStatus === "approved" && ("status" in req.body || "ftaStatus" in req.body || "isAwaitingFta" in req.body)) {
      return res.status(400).json({ message: "Approved FTA tasks are locked and cannot have their status changed." });
    }
    const assignmentError = await ensureManagerCanAssign(
      req,
      "assignedTo" in req.body ? req.body.assignedTo : task.assignedTo,
    );
    if (assignmentError) {
      return res.status(assignmentError.status).json({ message: assignmentError.message });
    }
    const previousStatus = task.status;
    // Bug #4 Fix: whitelist editable fields to block mass-assignment of taskId, createdBy, etc.
    const ALLOWED = ["category", "taskType", "client", "assignedTo", "dueDate", "status", "description", "isAwaitingFta", "ftaStatus", "period", "periodFY", "periodQuarter"];
    ALLOWED.forEach((key) => { if (key in req.body) task[key] = req.body[key]; });

    if ("isRecurring" in req.body || "recurringConfig" in req.body || "dueDate" in req.body) {
      const recurringFields = normalizeRecurringFields(
        {
          isRecurring: "isRecurring" in req.body ? req.body.isRecurring : task.isRecurring,
          recurringConfig: req.body.recurringConfig || task.recurringConfig,
          dueDate: req.body.dueDate || task.dueDate,
        },
        task.dueDate
      );
      task.isRecurring = recurringFields.isRecurring;
      task.recurringConfig = recurringFields.recurringConfig;
      if (!task.isRecurring) task.recurringGeneratedTask = undefined;
    }

    if ("status" in req.body) {
      if (req.body.status === "submitted_to_fta") {
        task.isAwaitingFta = true;
        if (!task.ftaSubmittedDate) {
          task.ftaSubmittedDate = new Date();
        }
        if (!task.ftaStatus) {
          task.ftaStatus = "in_review";
        }
      } else if (req.body.status === "wip" || req.body.status === "not_started") {
        task.isAwaitingFta = false;
        task.ftaStatus = undefined;
        task.ftaSubmittedDate = undefined;
      }
    }

    if ("isAwaitingFta" in req.body && !req.body.isAwaitingFta) {
      task.ftaStatus = undefined;
      task.ftaSubmittedDate = undefined;
    }
    await task.save();
    if (previousStatus !== "completed" && task.status === "completed") {
      await maybeGenerateNextRecurringTask(task, req.user._id);
    }
    await auditLogger({ task: task._id, user: req.user._id, action: "Updated", newStatus: task.status });
    res.json(await task.populate(populateTask));
  } catch (error) { next(error); }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    await ActivityLog.deleteMany({ task: task._id });
    res.json({ message: "Task deleted" });
  } catch (error) { next(error); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (req.user.role === "associate" && String(task.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    if (task.ftaStatus === "approved") {
      return res.status(400).json({ message: "Approved FTA tasks are locked and cannot have their status changed." });
    }

    const previousStatus = task.status;
    const newStatus = req.body.status;

    // Early return if status hasn't changed (from main)
    if (previousStatus === newStatus) {
      return res.json(await task.populate(populateTask));
    }

    // Build the update object
    const updateFields = { status: newStatus };

    // When "Submitted to FTA" is selected, auto-route the task into FTA Tracker.
    // Use $set directly to avoid mongoose dirty-tracking issues with boolean/enum fields.
    if (newStatus === "submitted_to_fta") {
      updateFields.isAwaitingFta = true;
      updateFields.ftaStatus = "in_review";
      updateFields.ftaSubmittedDate = new Date();
      console.log(`[FTA] Task ${task.taskId} submitted to FTA tracker by user ${req.user._id}`);
    } else {
      // Changing status away from submitted_to_fta means the task is no longer awaiting FTA.
      // Reset so it is removed from the FTA Tracker and Edit Task toggle reflects correctly.
      updateFields.isAwaitingFta = false;
    }

    // Use findByIdAndUpdate to guarantee all fields are persisted.
    // Explicitly set updatedAt via the server clock because findByIdAndUpdate
    // bypasses the Mongoose timestamps hook unless { timestamps: true } is passed
    // as a query option — which some MongoDB drivers ignore on $set paths.
    // Using new Date() here ensures the server (not the client browser) is the
    // single source of truth for modification time.
    const updated = await Task.findByIdAndUpdate(
      task._id,
      { $set: { ...updateFields, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).populate(populateTask);

    if (previousStatus !== "completed" && newStatus === "completed") {
      await maybeGenerateNextRecurringTask(updated, req.user._id);
    }
    await auditLogger({ task: updated._id, user: req.user._id, action: "Status Changed", previousStatus, newStatus: updated.status });
    // Only notify assignee if it's not the same person making the change (from main)
    if (updated.assignedTo && String(updated.assignedTo._id || updated.assignedTo) !== String(req.user._id)) {
      await Notification.create({ recipient: updated.assignedTo._id || updated.assignedTo, title: "Task status changed", message: `${updated.taskId} moved to ${statusLabel(updated.status)}`, type: "task_update", relatedTask: updated._id });
    }
    res.json(updated);
  } catch (error) { next(error); }
};


exports.updateAssignee = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    const task = await Task.findById(req.params.id).populate("assignedTo", "name");
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Capture previous assignee name for the audit log before overwriting
    const previousAssigneeName = task.assignedTo?.name || "Unassigned";

    const updateFields = { assignedTo: assignedTo || null };
    // Explicitly set updatedAt via the server clock — findByIdAndUpdate bypasses
    // Mongoose timestamps: true hooks, so we inject the timestamp directly.
    const updated = await Task.findByIdAndUpdate(
      task._id,
      { $set: { ...updateFields, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).populate(populateTask);

    // Resolve the new assignee's display name from the populated result
    const newAssigneeName = updated.assignedTo?.name || "Unassigned";

    // Build a descriptive audit note that matches the activity log UI style
    let assignmentNote;
    if (previousAssigneeName === "Unassigned" && newAssigneeName !== "Unassigned") {
      assignmentNote = `Assigned to ${newAssigneeName}`;
    } else if (previousAssigneeName !== "Unassigned" && newAssigneeName === "Unassigned") {
      assignmentNote = `Unassigned (was ${previousAssigneeName})`;
    } else {
      assignmentNote = `Assigned to ${newAssigneeName} (was ${previousAssigneeName})`;
    }

    await auditLogger({
      task: updated._id,
      user: req.user._id,
      action: "Reassigned",
      notes: assignmentNote,
    });

    // Notify the new assignee if they are not the person making the change
    if (updated.assignedTo && String(updated.assignedTo._id || updated.assignedTo) !== String(req.user._id)) {
      await Notification.create({ recipient: updated.assignedTo._id || updated.assignedTo, title: "Task reassigned to you", message: `${updated.taskId} — ${updated.taskType} (${statusLabel(updated.status)})`, type: "task_update", relatedTask: updated._id });
    }
    res.json(updated);
  } catch (error) { next(error); }
};


exports.updateRemarks = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (req.user.role === "associate" && String(task.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });

    task.remarks = String(req.body.remarks || "").trim();
    await task.save();
    await auditLogger({
      task: task._id,
      user: req.user._id,
      action: "Updated",
      newStatus: task.status,
      notes: task.remarks ? "Remarks updated" : "Remarks cleared",
    });
    res.json(await task.populate(populateTask));
  } catch (error) { next(error); }
};

exports.ftaTracker = async (req, res, next) => {
  try {
    const query = { isAwaitingFta: true };
    // associate users can only see FTA tasks that are assigned to them
    if (req.user.role === "associate") query.assignedTo = req.user._id;
    if (req.query.category && req.query.category !== "All") query.category = req.query.category;
    const tasks = await Task.find(query).populate(populateTask).sort({ ftaSubmittedDate: -1, createdAt: -1 });
    res.json(tasks);
  } catch (error) { next(error); }
};

exports.updateFtaStatus = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (req.user.role === "associate" && String(task.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const previousStatus = task.ftaStatus;
    const previousTaskStatus = task.status;
    const nextFtaStatus = req.body.ftaStatus;
    const updateFields = { ftaStatus: nextFtaStatus };
    if (nextFtaStatus === "approved") {
      updateFields.status = "completed";
      updateFields.isAwaitingFta = false;
    }

    // Explicitly set updatedAt via the server clock.
    const updated = await Task.findByIdAndUpdate(
      task._id,
      { $set: { ...updateFields, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).populate(populateTask);

    await auditLogger({ task: updated._id, user: req.user._id, action: "FTA Status Changed", previousStatus, newStatus: updated.ftaStatus });
    if (previousTaskStatus !== "completed" && updated.status === "completed") {
      await auditLogger({ task: updated._id, user: req.user._id, action: "Status Changed", previousStatus: previousTaskStatus, newStatus: updated.status, notes: "Auto-completed after FTA approval" });
      await maybeGenerateNextRecurringTask(updated, req.user._id);
    }
    if (previousStatus !== "additional_query" && updated.ftaStatus === "additional_query") {
      const admins = await User.find({ role: "admin", isActive: true });
      const recipients = [...new Set([updated.assignedTo?._id || updated.assignedTo, ...admins.map((u) => u._id)].filter(Boolean).map((id) => String(id)))];
      await Notification.insertMany(recipients.map((recipient) => ({ recipient, title: "FTA query received", message: `${updated.taskId} has an additional FTA query.`, type: "fta_query", relatedTask: updated._id })));
    }
    res.json(updated);
  } catch (error) { next(error); }
};

exports.uploadTaskAttachment = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const uploadedFiles = buildUploadedFiles(req);
    if (!uploadedFiles.length) return res.status(400).json({ message: "Please choose at least one file to upload" });
    const description = String(req.body.description || "").trim();
    uploadedFiles.forEach((uploadedFile) => {
      task.attachments.push(toStoredFileEntry(uploadedFile, req.user._id, description));
    });
    await task.save();
    await auditLogger({
      task: task._id,
      user: req.user._id,
      action: "Updated",
      newStatus: task.status,
      notes: `${uploadedFiles.length} attachment${uploadedFiles.length === 1 ? "" : "s"} uploaded`,
    });
    res.json(await task.populate(populateTask));
  } catch (error) { next(error); }
};

exports.deleteTaskAttachment = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const attachment = task.attachments.id(req.params.attachId);
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    attachment.deleteOne();
    await task.save();
    await auditLogger({
      task: task._id,
      user: req.user._id,
      action: "Updated",
      newStatus: task.status,
      notes: `Attachment deleted: ${attachment.name || "File"}`,
    });
    res.json(await task.populate(populateTask));
  } catch (error) { next(error); }
};

exports.getTaskLogs = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (req.user.role === "associate" && String(task.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    const logs = await ActivityLog.find({ task: task._id }).populate("user", "name email role").sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) { next(error); }
};

exports.exportTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find(await taskQuery(req)).populate(populateTask);

    const formatDate = (dateStr) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return "";
      return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    };

    const isExportAll = req.query.mode === "all";

    const BASE_COLUMNS = ["taskId", "client", "category", "type", "dueDate", "assigned", "status", "recurring", "createdAt", "updatedAt"];
    const ALL_COLUMNS = BASE_COLUMNS;
    const requestedColumns = isExportAll
      ? ALL_COLUMNS
      : (req.query.columns ? String(req.query.columns).split(",").map(c => c.trim()).filter(Boolean) : ALL_COLUMNS);

    const activeBaseColumns = requestedColumns.filter(k => BASE_COLUMNS.includes(k));

    const HEADER_MAP = {
      taskId: "Task ID",
      client: "Client",
      category: "Category",
      type: "Task Type",
      dueDate: "Due Date",
      assigned: "Assigned",
      status: "Status",
      recurring: "Recurring",
      createdAt: "Created Date",
      updatedAt: "Last Modified",
    };

    const orderedHeaders = activeBaseColumns.map(k => HEADER_MAP[k]).filter(Boolean);

    const getBaseCell = (t, col) => {
      switch (col) {
        case "taskId": return t.taskId || "";
        case "client": return t.client?.legalName || "";
        case "category": return t.category || "";
        case "type": return t.taskType || "";
        case "dueDate": return formatDate(t.dueDate);
        case "assigned": return t.assignedTo?.name || "Unassigned";
        case "status": return statusLabel(t.status) || "";
        case "recurring": return t.isRecurring ? "Recurring" : "One-time";
        case "createdAt": return formatDate(t.createdAt);
        case "updatedAt": return formatDate(t.updatedAt);
        default: return "";
      }
    };

    const rows = tasks.map((t) => {
      const row = {};
      activeBaseColumns.forEach((col) => {
        const header = HEADER_MAP[col];
        if (header) {
          row[header] = getBaseCell(t, col);
        }
      });
      return row;
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows, { header: orderedHeaders });
    xlsx.utils.book_append_sheet(wb, ws, "Tasks");
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", 'attachment; filename="tasks.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (error) { next(error); }
};

exports.maybeGenerateNextRecurringTask = maybeGenerateNextRecurringTask;
// Export helper functions for testing
exports._test = {
  calculateNextOccurrence
};
