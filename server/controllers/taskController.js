const { validationResult } = require("express-validator");
const Task = require("../models/Task");
const User = require("../models/User");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const auditLogger = require("../utils/auditLogger");
const { nextTaskId } = require("../utils/autoId");

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
    const status = req.body.status || (req.body.isAwaitingFta ? "submitted_to_fta" : "not_started");
    const task = await Task.create({
      ...req.body,
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
    if (!task) return res.status(404).json({ message: "Task not found" });
    // Bug #4 Fix: whitelist editable fields to block mass-assignment of taskId, createdBy, etc.
    const ALLOWED = ["category", "taskType", "client", "assignedTo", "dueDate", "status", "notes", "isAwaitingFta", "ftaStatus", "period"];
    ALLOWED.forEach((key) => { if (key in req.body) task[key] = req.body[key]; });
    await task.save();
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
    if (task.status === "submitted_to_fta" && task.isAwaitingFta && !task.ftaSubmittedDate) task.ftaSubmittedDate = new Date();
    await task.save();
    await auditLogger({ task: task._id, user: req.user._id, action: "Status Changed", previousStatus, newStatus: task.status });
    if (task.assignedTo) await Notification.create({ recipient: task.assignedTo, title: "Task status changed", message: `${task.taskId} moved to ${task.status}`, type: "task_update", relatedTask: task._id });
    res.json(await task.populate(populateTask));
  } catch (error) { next(error); }
};

exports.ftaTracker = async (req, res, next) => {
  try {
    const query = { isAwaitingFta: true };
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
