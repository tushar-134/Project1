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
    
    let activityTaskIds = null;
    let visibleTaskClientIds = null;

    if (req.user.role === "task_only") {
      const tasks = await Task.find({ assignedTo: req.user._id }).select("_id client").lean();
      activityTaskIds = tasks.map((t) => t._id);
      visibleTaskClientIds = tasks.map((t) => t.client).filter(Boolean);
    }

    // Overdue query: tasks whose dueDate is within the selected month AND before now
    const now = new Date();
    const overdueScope = {
      ...roleScope,
      status: { $ne: "completed" },
      dueDate: dueDate
        ? { $gte: dueDate.$gte, $lt: now < dueDate.$lt ? now : dueDate.$lt }
        : { $lt: now },
    };

    const clientScope = {
      isActive: true,
      ...(req.user.role === "task_only"
        ? { _id: { $in: visibleTaskClientIds } }
        : {}),
    };

    const catMatchStage = {
      ...(dueDate ? { dueDate } : {}),
      ...roleScope,
    };

    const [totalClients, pendingTasks, overdueTasks, ftaPending, recentActivity, catAgg] = await Promise.all([
      Client.countDocuments(clientScope),
      Task.countDocuments({ ...taskScope, status: { $ne: "completed" } }),
      Task.countDocuments(overdueScope),
      Task.countDocuments({ ...taskScope, isAwaitingFta: true, ftaStatus: { $ne: "approved" } }),
      ActivityLog.find({
        ...(req.user.role === "task_only" ? { task: { $in: activityTaskIds } } : {}),
        ...activityDateScope,
      })
        .populate({ path: "task", select: "_id taskId category taskType dueDate client", populate: { path: "client", select: "legalName" } })
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .limit(10),
      Task.aggregate([
        { $match: catMatchStage },
        { $group: {
          _id: "$category",
          active: { $sum: { $cond: [{ $ne: ["$status", "completed"] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $ne: ["$status", "completed"] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "completed"] }, { $lt: ["$dueDate", now] }] }, 1, 0] } },
        }},
      ]),
    ]);

    const categoryBreakdown = catAgg.map((c) => ({ category: c._id, active: c.active, closed: c.closed, pending: c.pending, overdue: c.overdue }));
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
