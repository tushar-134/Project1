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
    const roleScope = req.user.role === "task_only" ? { assignedTo: req.user._id } : {};
    const taskScope = { ...(dueDate ? { dueDate } : {}), ...roleScope };

    // For activity logs, scope to the selected month's date range
    const activityDateScope = dueDate ? { createdAt: dueDate } : {};
    const activityTaskIds = req.user.role === "task_only"
      ? await Task.find({ assignedTo: req.user._id }).distinct("_id")
      : null;

    // Overdue query: tasks whose dueDate is within the selected month AND before now
    const now = new Date();
    const overdueScope = {
      ...roleScope,
      status: { $ne: "completed" },
      dueDate: dueDate
        ? { $gte: dueDate.$gte, $lt: now < dueDate.$lt ? now : dueDate.$lt }
        : { $lt: now },
    };

    // Count clients that have at least one task in the selected month (not just all active clients)
    const clientIdsWithTasks = dueDate
      ? await Task.find(taskScope).distinct("client")
      : null;
    const clientScope = {
      isActive: true,
      ...roleScope,
      ...(req.user.role === "task_only"
        ? { _id: { $in: await Task.find({ assignedTo: req.user._id }).distinct("client") } }
        : clientIdsWithTasks
          ? { _id: { $in: clientIdsWithTasks } }
          : {}),
    };

    const [totalClients, pendingTasks, overdueTasks, ftaPending, recentActivity] = await Promise.all([
      Client.countDocuments(clientScope),
      Task.countDocuments({ ...taskScope, status: { $ne: "completed" } }),
      Task.countDocuments(overdueScope),
      Task.countDocuments({ ...taskScope, isAwaitingFta: true, ftaStatus: { $ne: "approved" } }),
      ActivityLog.find({
        ...(req.user.role === "task_only" ? { task: { $in: activityTaskIds } } : {}),
        ...activityDateScope,
      })
        .populate({ path: "task", populate: { path: "client", select: "legalName" } })
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    // Category breakdown — aggregation scoped to month
    const matchStage = {
      status: { $ne: "completed" },
      ...(dueDate ? { dueDate } : {}),
      ...roleScope,
    };
    const catAgg = await Task.aggregate([
      { $match: matchStage },
      { $group: {
        _id: "$category",
        pending: { $sum: 1 },
        overdue: { $sum: { $cond: [{ $lt: ["$dueDate", now] }, 1, 0] } },
      }},
    ]);
    const categoryBreakdown = catAgg.map((c) => ({ category: c._id, pending: c.pending, overdue: c.overdue }));
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
    // Bug #10 Fix: single aggregation instead of one query per client.
    const agg = await Task.aggregate([
      { $group: {
        _id: "$client",
        total: { $sum: 1 },
        not_started: { $sum: { $cond: [{ $eq: ["$status", "not_started"] }, 1, 0] } },
        wip: { $sum: { $cond: [{ $eq: ["$status", "wip"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        submitted_to_fta: { $sum: { $cond: [{ $eq: ["$status", "submitted_to_fta"] }, 1, 0] } },
      }},
      { $lookup: { from: "clients", localField: "_id", foreignField: "_id", as: "client" } },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      { $match: { "client.isActive": true } },
      { $project: { client: { _id: "$client._id", legalName: "$client.legalName", fileNo: "$client.fileNo" }, total: 1, not_started: 1, wip: 1, completed: 1, submitted_to_fta: 1 } },
    ]);
    res.json(agg);
  } catch (error) { next(error); }
};

exports.userWise = async (req, res, next) => {
  try {
    // Bug #10 Fix: single aggregation instead of one query per user.
    const agg = await Task.aggregate([
      { $group: {
        _id: "$assignedTo",
        total: { $sum: 1 },
        not_started: { $sum: { $cond: [{ $eq: ["$status", "not_started"] }, 1, 0] } },
        wip: { $sum: { $cond: [{ $eq: ["$status", "wip"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        submitted_to_fta: { $sum: { $cond: [{ $eq: ["$status", "submitted_to_fta"] }, 1, 0] } },
      }},
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $project: { user: { _id: "$user._id", name: "$user.name", email: "$user.email", role: "$user.role" }, total: 1, not_started: 1, wip: 1, completed: 1, submitted_to_fta: 1 } },
    ]);
    res.json(agg);
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
