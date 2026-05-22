const { validationResult } = require("express-validator");
const Task = require("../models/Task");
const User = require("../models/User");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const auditLogger = require("../utils/auditLogger");
const { nextTaskId } = require("../utils/autoId");

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function normalizeRecurringFields(body, fallbackDueDate) {
  if (!body.isRecurring) return { isRecurring: false, recurringConfig: undefined };
  const frequency = body.recurringConfig?.frequency;
  const dueDate = asDate(body.dueDate || fallbackDueDate);
  const providedNextDueDate = asDate(body.recurringConfig?.nextDueDate);
  const calculatedNextDueDate = addFrequency(dueDate, frequency);
  const nextDueDate = providedNextDueDate && (!dueDate || providedNextDueDate > dueDate)
    ? providedNextDueDate
    : (providedNextDueDate || calculatedNextDueDate);
  const endDate = asDate(body.recurringConfig?.endDate);
  return {
    isRecurring: true,
    recurringConfig: {
      frequency,
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

async function maybeGenerateNextRecurringTask(task, userId) {
  if (!task?.isRecurring || task.recurringGeneratedTask) return null;
  const frequency = task.recurringConfig?.frequency;
  const nextDueDate = asDate(task.recurringConfig?.nextDueDate) || addFrequency(task.dueDate, frequency);
  if (!nextDueDate) return null;
  const endDate = asDate(task.recurringConfig?.endDate);
  if (endDate && nextDueDate > endDate) return null;
  const followingDueDate = addFrequency(nextDueDate, frequency);
  const nextTask = await Task.create({
    category: task.category,
    taskType: task.taskType,
    client: task.client,
    assignedTo: task.assignedTo,
    dueDate: nextDueDate,
    period: task.period,
    description: task.description,
    status: "not_started",
    isRecurring: true,
    recurringConfig: {
      frequency,
      nextDueDate: followingDueDate || undefined,
      endDate: endDate || undefined,
    },
    isAwaitingFta: task.isAwaitingFta,
    ftaStatus: "in_review",
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
      message: `${nextTask.taskId} ${nextTask.taskType}`,
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

const populateTask = [{ path: "client", select: "legalName fileNo jurisdiction vatDetails tradeLicences contactPersons" }, { path: "assignedTo", select: "name email role" }, { path: "createdBy", select: "name" }];

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
    if (task.assignedTo) await Notification.create({ recipient: task.assignedTo, title: "New task assigned", message: `${task.taskId} ${task.taskType}`, type: "task_update", relatedTask: task._id });
    res.status(201).json(await task.populate(populateTask));
  } catch (error) { next(error); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
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
    const ALLOWED = ["category", "taskType", "client", "assignedTo", "dueDate", "status", "description", "isAwaitingFta", "ftaStatus", "period"];
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
    const previousStatus = task.status;
    task.status = req.body.status;
    // When "Submitted to FTA" is selected from the Task List dropdown, automatically route
    // the task into the FTA Tracker regardless of whether the toggle was pre-set on the task.
    // Always reset ftaStatus to "in_review" so re-submitted tasks go back to the In Review tab.
    if (task.status === "submitted_to_fta") {
      task.isAwaitingFta = true;
      task.ftaStatus = "in_review";
      task.ftaSubmittedDate = new Date();
    }
    await task.save();
    if (previousStatus !== "completed" && task.status === "completed") {
      await maybeGenerateNextRecurringTask(task, req.user._id);
    }
    await auditLogger({ task: task._id, user: req.user._id, action: "Status Changed", previousStatus, newStatus: task.status });
    if (task.assignedTo) await Notification.create({ recipient: task.assignedTo, title: "Task status changed", message: `${task.taskId} moved to ${task.status}`, type: "task_update", relatedTask: task._id });
    res.json(await task.populate(populateTask));
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
    task.ftaStatus = req.body.ftaStatus;
    await task.save();
    await auditLogger({ task: task._id, user: req.user._id, action: "FTA Status Changed", previousStatus, newStatus: task.ftaStatus });
    if (task.ftaStatus === "additional_query") {
      const admins = await User.find({ role: "admin", isActive: true });
      const recipients = [task.assignedTo, ...admins.map((u) => u._id)].filter(Boolean);
      await Notification.insertMany(recipients.map((recipient) => ({ recipient, title: "FTA query received", message: `${task.taskId} has an additional FTA query.`, type: "fta_query", relatedTask: task._id })));
    }
    res.json(await task.populate(populateTask));
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
