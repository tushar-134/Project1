const { validationResult } = require("express-validator");
const Task = require("../models/Task");
const User = require("../models/User");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const auditLogger = require("../utils/auditLogger");
const { nextTaskId } = require("../utils/autoId");

// Human-readable status labels for notification messages
const STATUS_LABEL = {
  not_started: "Not Yet Started",
  wip: "WIP",
  submitted_to_fta: "Submitted to FTA",
  completed: "Completed",
};
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

function toUploadedFile(file, req) {
  const fileUrl = file.path && /^https?:\/\//i.test(String(file.path || ""))
    ? file.path
    : `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
  return {
    name: file.originalname || file.filename || "File",
    size: file.size ? `${(file.size / 1024 / 1024).toFixed(file.size >= 1024 * 1024 ? 2 : 3).replace(/\.?0+$/, "")} MB` : "",
    fileType: file.mimetype || "",
    url: fileUrl,
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

function getNextWeeklyDate(baseDate, targetDayStr) {
  const dayMap = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
  const targetDay = dayMap[targetDayStr];
  if (targetDay === undefined) return null;
  
  const result = new Date(baseDate);
  for (let i = 1; i <= 7; i++) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() === targetDay) {
      return result;
    }
  }
  return result;
}

function getNextMonthlyDate(baseDate, targetDate) {
  const currentYear = baseDate.getUTCFullYear();
  const currentMonth = baseDate.getUTCMonth();
  let targetYear = currentYear;
  let targetMonth = currentMonth + 1;
  if (targetMonth > 11) {
    targetMonth = 0;
    targetYear += 1;
  }
  
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  
  if (targetDate <= daysInTargetMonth) {
    return new Date(Date.UTC(targetYear, targetMonth, targetDate));
  } else {
    let nextMonth = targetMonth + 1;
    let nextYear = targetYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    return new Date(Date.UTC(nextYear, nextMonth, 1));
  }
}

function getNextQuarterlyDate(baseDate, targetDate) {
  const currentYear = baseDate.getUTCFullYear();
  const currentMonth = baseDate.getUTCMonth();
  let targetMonth = currentMonth + 3;
  let targetYear = currentYear;
  while (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }
  
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  
  if (targetDate <= daysInTargetMonth) {
    return new Date(Date.UTC(targetYear, targetMonth, targetDate));
  } else {
    let nextMonth = targetMonth + 1;
    let nextYear = targetYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    return new Date(Date.UTC(nextYear, nextMonth, 1));
  }
}

function getNextYearlyDate(baseDate, targetMonth, targetDate) {
  const targetMonth0 = targetMonth - 1;
  const currentYear = baseDate.getUTCFullYear();
  const targetYear = currentYear + 1;
  
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth0 + 1, 0)).getUTCDate();
  
  if (targetDate <= daysInTargetMonth) {
    return new Date(Date.UTC(targetYear, targetMonth0, targetDate));
  } else {
    let nextMonth = targetMonth0 + 1;
    let nextYear = targetYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    return new Date(Date.UTC(nextYear, nextMonth, 1));
  }
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
  const { frequency, dayOfWeek, dateOfMonth, monthOfYear } = config;
  const date = asDate(baseDate);
  if (!date) return null;

  switch (frequency) {
    case "weekly":
      return getNextWeeklyDate(date, dayOfWeek || "Sun");
    case "monthly":
      return getNextMonthlyDate(date, dateOfMonth || 1);
    case "quarterly":
      return getNextQuarterlyDate(date, dateOfMonth || 1);
    case "annual":
      return getNextYearlyDate(date, monthOfYear || 1, dateOfMonth || 1);
    default:
      return addFrequency(date, frequency);
  }
}

function normalizeRecurringFields(body, fallbackDueDate) {
  if (!body.isRecurring) return { isRecurring: false, recurringConfig: undefined };
  const rc = body.recurringConfig || {};
  const frequency = rc.frequency;
  const dayOfWeek = rc.dayOfWeek;
  const dateOfMonth = rc.dateOfMonth ? Number(rc.dateOfMonth) : undefined;
  const monthOfYear = rc.monthOfYear ? Number(rc.monthOfYear) : undefined;

  const dueDate = asDate(body.dueDate || fallbackDueDate);
  const providedNextDueDate = asDate(rc.nextDueDate);
  const calculatedNextDueDate = calculateNextOccurrence(dueDate, { frequency, dayOfWeek, dateOfMonth, monthOfYear });
  const nextDueDate = providedNextDueDate && (!dueDate || providedNextDueDate > dueDate)
    ? providedNextDueDate
    : (providedNextDueDate || calculatedNextDueDate);
  const endDate = asDate(rc.endDate);
  return {
    isRecurring: true,
    recurringConfig: {
      frequency,
      dayOfWeek,
      dateOfMonth,
      monthOfYear,
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
  // Managers can only assign to themselves or task_only users
  if (assignee.role !== "task_only") {
    return { status: 403, message: "Managers can only assign tasks to themselves or task-only users." };
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
  const dayOfWeek = rc.dayOfWeek;
  const dateOfMonth = rc.dateOfMonth;
  const monthOfYear = rc.monthOfYear;

  const nextDueDate = asDate(rc.nextDueDate) || calculateNextOccurrence(task.dueDate, rc);
  if (!nextDueDate) return null;
  const endDate = asDate(rc.endDate);
  if (endDate && nextDueDate > endDate) return null;

  const followingDueDate = calculateNextOccurrence(nextDueDate, { frequency, dayOfWeek, dateOfMonth, monthOfYear });

  // Compute the period for the new task from its due date and the client's FYE config.
  // The client may or may not be populated at this point, so we guard carefully.
  const clientFYE =
    (task.client && typeof task.client === "object" ? task.client.financialYearEnd : null) || "Jan - Dec";
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
      dayOfWeek,
      dateOfMonth,
      monthOfYear,
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

function taskQuery(req) {
  // Query shaping happens once here so list and export stay aligned with the same role and filter logic.
  const { category, status, assignedTo, month, overdue } = req.query;
  const query = {};
  if (category && category !== "All") query.category = category;
  if (status && status !== "All") query.status = status;
  if (assignedTo) query.assignedTo = assignedTo;
  if (req.user.role === "task_only") query.assignedTo = req.user._id;
  // Bug #7 Fix: Build the dueDate filter carefully so overdue never silently
  // clobber the month's $lt boundary. We now apply the month window first, then
  // tighten $lt to today only when no month is selected (overdue standalone).
  if (month) {
    const [y, m] = month.split("-").map(Number);
    query.dueDate = { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
  }
  if (overdue === "true") {
    if (query.dueDate) {
      // Month window is already set — just tighten the upper boundary to today
      // if today is earlier than the month's end.
      const today = new Date();
      if (today < query.dueDate.$lt) query.dueDate.$lt = today;
    } else {
      query.dueDate = { $lt: new Date() };
    }
    // Bug #7 Fix: use a dedicated guard so we don't overwrite an earlier status filter.
    if (!query.status) query.status = { $ne: "completed" };
  }
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
    const tasks = await Task.find(taskQuery(req)).populate(populateTask).sort({ dueDate: 1 });
    res.json(tasks);
  } catch (error) { next(error); }
};

exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate(populateTask);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (req.user.role === "task_only" && String(task.assignedTo?._id) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    res.json(task);
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
    const task = await Task.create({
      ...req.body,
      ...recurringFields,
      status,
      taskId: await nextTaskId(new Date(req.body.dueDate).getUTCFullYear()),
      ftaSubmittedDate: req.body.isAwaitingFta || status === "submitted_to_fta" ? new Date() : undefined,
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

    if ("status" in req.body && req.body.status === "submitted_to_fta" && task.isAwaitingFta && !task.ftaSubmittedDate) {
      task.ftaSubmittedDate = new Date();
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
    if (req.user.role === "task_only" && String(task.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
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

    // Use findByIdAndUpdate to guarantee all fields are persisted
    const updated = await Task.findByIdAndUpdate(
      task._id,
      { $set: updateFields },
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
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    // Only admin/manager can reassign (task_only can't)
    const updateFields = { assignedTo: assignedTo || null };
    const updated = await Task.findByIdAndUpdate(
      task._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate(populateTask);
    await auditLogger({ task: updated._id, user: req.user._id, action: "Updated", newStatus: updated.status });
    // Notify the new assignee
    if (updated.assignedTo && String(updated.assignedTo._id || updated.assignedTo) !== String(req.user._id)) {
      await Notification.create({ recipient: updated.assignedTo._id || updated.assignedTo, title: "Task reassigned to you", message: `${updated.taskId} — ${updated.taskType} (${statusLabel(updated.status)})`, type: "task_update", relatedTask: updated._id });
    }
    res.json(updated);
  } catch (error) { next(error); }
};

exports.ftaTracker = async (req, res, next) => {
  try {
    const query = { isAwaitingFta: true };
    // task_only users can only see FTA tasks that are assigned to them
    if (req.user.role === "task_only") query.assignedTo = req.user._id;
    if (req.query.category && req.query.category !== "All") query.category = req.query.category;
    const tasks = await Task.find(query).populate(populateTask).sort({ ftaSubmittedDate: -1, createdAt: -1 });
    res.json(tasks);
  } catch (error) { next(error); }
};

exports.updateFtaStatus = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    const previousStatus = task.ftaStatus;
    const previousTaskStatus = task.status;
    const nextFtaStatus = req.body.ftaStatus;
    const updateFields = { ftaStatus: nextFtaStatus };
    if (nextFtaStatus === "approved") {
      updateFields.status = "completed";
      updateFields.isAwaitingFta = false;
    }

    const updated = await Task.findByIdAndUpdate(
      task._id,
      { $set: updateFields },
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
    if (req.user.role === "task_only" && String(task.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: "Forbidden" });
    const logs = await ActivityLog.find({ task: task._id }).populate("user", "name email role").sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) { next(error); }
};

exports.exportTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find(taskQuery(req)).populate(populateTask);
    const csv = ["Task ID,Client,Category,Task Type,Due Date,Assigned,Status"].concat(tasks.map((t) => [t.taskId, t.client?.legalName || "", t.category, t.taskType, t.dueDate?.toISOString().slice(0, 10), t.assignedTo?.name || "", t.status].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))).join("\n");
    // Bug #2 Fix: res.attachment() was removed in Express 5; use setHeader instead.
    res.setHeader("Content-Disposition", 'attachment; filename="tasks.csv"')
      .setHeader("Content-Type", "text/csv")
      .send(csv);
  } catch (error) { next(error); }
};

exports.maybeGenerateNextRecurringTask =  maybeGenerateNextRecurringTask ;
// Export helper functions for testing
exports._test = {
  getNextWeeklyDate,
  getNextMonthlyDate,
  getNextQuarterlyDate,
  getNextYearlyDate,
  calculateNextOccurrence
};
