const Client = require("../models/Client");
const Task = require("../models/Task");
const User = require("../models/User");
const Category = require("../models/Category");
const ActivityLog = require("../models/ActivityLog");

function monthRange(month) {
  if (!month) return null;
  const [y, m] = month.split("-").map(Number);
  return { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
}

function daysOverdue(date) {
  return Math.max(0, Math.ceil((new Date() - new Date(date)) / 86400000));
}

// Report endpoints mostly reshape operational data for the existing dashboard and admin tables.
exports.dashboardStats = async (req, res, next) => {
  try {
    const dueDate = monthRange(req.query.month);
    const taskScope = dueDate ? { dueDate } : {};
    const [totalClients, pendingTasks, overdueTasks, ftaPending, categories, recentActivity] = await Promise.all([
      Client.countDocuments({ isActive: true }),
      Task.countDocuments({ ...taskScope, status: { $ne: "completed" } }),
      Task.countDocuments({ ...taskScope, dueDate: { ...(dueDate || {}), $lt: new Date() }, status: { $ne: "completed" } }),
      Task.countDocuments({ isAwaitingFta: true, ftaStatus: { $ne: "approved" } }),
      Category.find({ isActive: true }),
      ActivityLog.find().populate("task").populate("user", "name").sort({ createdAt: -1 }).limit(10),
    ]);
    const categoryBreakdown = await Promise.all(categories.map(async (cat) => ({
      category: cat.name,
      pending: await Task.countDocuments({ ...taskScope, category: cat.name, status: { $ne: "completed" } }),
      overdue: await Task.countDocuments({ ...taskScope, category: cat.name, dueDate: { ...(dueDate || {}), $lt: new Date() }, status: { $ne: "completed" } }),
    })));
    res.json({ totalClients, pendingTasks, overdueTasks, ftaPending, categoryBreakdown, recentActivity });
  } catch (error) { next(error); }
};

exports.loginActivity = async (req, res, next) => {
  try { res.json(await User.find().select("name email role lastLogin").sort({ lastLogin: -1 })); } catch (error) { next(error); }
};

exports.taskActivity = async (req, res, next) => {
  try { res.json(await ActivityLog.find().populate("user", "name").populate({ path: "task", populate: { path: "client", select: "legalName" } }).sort({ createdAt: -1 })); } catch (error) { next(error); }
};

exports.clientWise = async (req, res, next) => {
  try {
    const clients = await Client.find({ isActive: true }).select("legalName fileNo");
    const rows = await Promise.all(clients.map(async (client) => {
      const tasks = await Task.find({ client: client._id }).select("status");
      return { client, total: tasks.length, not_started: tasks.filter((t) => t.status === "not_started").length, wip: tasks.filter((t) => t.status === "wip").length, completed: tasks.filter((t) => t.status === "completed").length, submitted_to_fta: tasks.filter((t) => t.status === "submitted_to_fta").length };
    }));
    res.json(rows);
  } catch (error) { next(error); }
};

exports.userWise = async (req, res, next) => {
  try {
    const users = await User.find().select("name email role");
    const rows = await Promise.all(users.map(async (user) => {
      const tasks = await Task.find({ assignedTo: user._id }).select("status");
      return { user, total: tasks.length, not_started: tasks.filter((t) => t.status === "not_started").length, wip: tasks.filter((t) => t.status === "wip").length, completed: tasks.filter((t) => t.status === "completed").length, submitted_to_fta: tasks.filter((t) => t.status === "submitted_to_fta").length };
    }));
    res.json(rows);
  } catch (error) { next(error); }
};

exports.overdue = async (req, res, next) => {
  try {
    const tasks = await Task.find({ dueDate: { $lt: new Date() }, status: { $ne: "completed" } }).populate("client", "legalName").populate("assignedTo", "name");
    res.json(tasks.map((task) => ({ ...task.toObject(), daysOverdue: daysOverdue(task.dueDate) })));
  } catch (error) { next(error); }
};

exports.ftaTrackerReport = async (req, res, next) => {
  try {
    const tasks = await Task.find({ isAwaitingFta: true }).populate("client", "legalName").populate("assignedTo", "name");
    const breakdown = {
      in_review: tasks.filter((t) => t.ftaStatus === "in_review").length,
      additional_query: tasks.filter((t) => t.ftaStatus === "additional_query").length,
      approved: tasks.filter((t) => t.ftaStatus === "approved").length,
    };
    res.json({ breakdown, tasks });
  } catch (error) { next(error); }
};
