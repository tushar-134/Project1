const Client = require("../models/Client");
const Task = require("../models/Task");
const User = require("../models/User");
const Category = require("../models/Category");
const ActivityLog = require("../models/ActivityLog");

function monthRange(month) {
  if (!month) return null;
  const match = String(month).match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const [, year, monthNumber] = match;
  const y = Number(year);
  const m = Number(monthNumber);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
}

function daysOverdue(date) {
  return Math.max(0, Math.ceil((new Date() - new Date(date)) / 86400000));
}

// Report endpoints mostly reshape operational data for the existing dashboard and admin tables.
exports.dashboardStats = async (req, res, next) => {
  try {
    const { month, fromDate, toDate, reportBasedOn } = req.query;
    const roleScope = req.user.role === "associate" ? { assignedTo: req.user._id } : {};

    // Build the date/report filter
    const dateFilter = {};
    if (month) {
      const match = String(month).match(/^(\d{4})-(\d{2})$/);
      if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]);
        if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
          dateFilter.dueDate = { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
        }
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
        dateFilter[targetField] = { ...(dateFilter[targetField] || {}), ...rangeQuery };
      }
    }

    const taskScope = { ...dateFilter, ...roleScope };

    // For activity logs, scope to the selected date range on createdAt field
    const activityDateScope = {};
    if (month) {
      const match = String(month).match(/^(\d{4})-(\d{2})$/);
      if (match) {
        const y = Number(match[1]);
        const m = Number(match[2]);
        if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
          activityDateScope.createdAt = { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
        }
      }
    } else if (fromDate || toDate) {
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
        activityDateScope.createdAt = rangeQuery;
      }
    }

    let activityTaskIds = null;
    let visibleTaskClientIds = null;

    if (req.user.role === "associate") {
      const tasks = await Task.find({ assignedTo: req.user._id }).select("_id client").lean();
      activityTaskIds = tasks.map((t) => t._id);
      visibleTaskClientIds = tasks.map((t) => t.client).filter(Boolean);
    }

    // Overdue = ALL uncompleted tasks past their due date, regardless of selected date range
    const now = new Date();
    const overdueScope = {
      ...roleScope,
      status: { $ne: "completed" },
      dueDate: { $lt: now },
    };

    const clientScope = {
      isActive: true,
      ...(req.user.role === "associate"
        ? { _id: { $in: visibleTaskClientIds } }
        : {}),
    };

    const catMatchStage = taskScope;

    // Licence alerts reference date: expiring within 15 days from now (all-time/absolute)
    const expiryStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const expirySoonEnd = new Date(expiryStart);
    expirySoonEnd.setUTCDate(expirySoonEnd.getUTCDate() + 15);

    const [totalClients, pendingTasks, overdueTasks, ftaPending, licenceAlerts, recentActivity, catAgg, overdueAgg] = await Promise.all([
      Client.countDocuments(clientScope),
      Task.countDocuments({ ...taskScope, status: { $ne: "completed" } }),
      Task.countDocuments(overdueScope),
      Task.countDocuments({ ...taskScope, isAwaitingFta: true, ftaStatus: { $ne: "approved" } }),
      Client.countDocuments({
        ...clientScope,
        $or: [
          { "tradeLicences.expiryDate": { $lte: expirySoonEnd, $type: "date" } },
          { "contactPersons.emiratesId.expiryDate": { $lte: expirySoonEnd, $type: "date" } },
          { "contactPersons.passport.expiryDate": { $lte: expirySoonEnd, $type: "date" } },
        ],
      }),

      ActivityLog.find({
        ...(req.user.role === "associate" ? { task: { $in: activityTaskIds } } : {}),
        ...activityDateScope,
      })
        .populate({ path: "task", select: "_id taskId category taskType dueDate client", populate: { path: "client", select: "legalName" } })
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .limit(10),
      Task.aggregate([
        { $match: catMatchStage },
        {
          $group: {
            _id: "$category",
            active: { $sum: { $cond: [{ $ne: ["$status", "completed"] }, 1, 0] } },
            closed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          }
        },
      ]),
      Task.aggregate([
        { $match: overdueScope },
        { $group: { _id: "$category", overdue: { $sum: 1 } } },
      ]),
    ]);

    const overdueByCat = new Map(overdueAgg.map((c) => [c._id, c.overdue]));
    const catMap = new Map(catAgg.map((c) => [c._id, c]));
    for (const [cat] of overdueByCat) {
      if (!catMap.has(cat)) catMap.set(cat, { _id: cat, active: 0, closed: 0 });
    }
    const categoryBreakdown = [...catMap.values()].map((c) => ({
      category: c._id,
      active: c.active,
      closed: c.closed,
      overdue: overdueByCat.get(c._id) || 0,
    }));
    res.json({ totalClients, pendingTasks, overdueTasks, ftaPending, licenceAlerts, categoryBreakdown, recentActivity });
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
      {
        $group: {
          _id: "$client",
          total: { $sum: 1 },
          not_started: { $sum: { $cond: [{ $eq: ["$status", "not_started"] }, 1, 0] } },
          wip: { $sum: { $cond: [{ $eq: ["$status", "wip"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          submitted_to_fta: { $sum: { $cond: [{ $eq: ["$status", "submitted_to_fta"] }, 1, 0] } },
        }
      },
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
      {
        $group: {
          _id: "$assignedTo",
          total: { $sum: 1 },
          not_started: { $sum: { $cond: [{ $eq: ["$status", "not_started"] }, 1, 0] } },
          wip: { $sum: { $cond: [{ $eq: ["$status", "wip"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          submitted_to_fta: { $sum: { $cond: [{ $eq: ["$status", "submitted_to_fta"] }, 1, 0] } },
        }
      },
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
