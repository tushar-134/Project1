const Client = require("../models/Client");
const Task = require("../models/Task");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");

const PAGE_LIMIT = 10;
const CSV_BATCH_SIZE = 100;

const reportKeys = new Set(["login-activity", "task-activity", "client-wise", "user-wise", "overdue", "fta-tracker"]);

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

function parseRange(query) {
  const fallback = defaultRange();
  const start = query.startDate ? new Date(query.startDate) : fallback.start;
  const end = query.endDate ? new Date(query.endDate) : fallback.end;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return fallback;
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function parsePage(value) {
  return Math.max(1, Number.parseInt(value, 10) || 1);
}

function dateMatch(field, range) {
  return { [field]: { $gte: range.start, $lte: range.end } };
}

function daysOverdue(date) {
  return Math.max(0, Math.ceil((new Date() - new Date(date)) / 86400000));
}

function pageResult(items, total, page) {
  return { items, total, page, pages: Math.ceil(total / PAGE_LIMIT) || 1, limit: PAGE_LIMIT };
}

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatCsvDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatCsvDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatCsvDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function writeCsvRow(res, values) {
  res.write(`${values.map(escapeCsv).join(",")}\n`);
}

function sendCsvHeaders(res, filename) {
  res.status(200);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

async function aggregatePage(pipeline, page) {
  const [result] = await Task.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [{ $skip: (page - 1) * PAGE_LIMIT }, { $limit: PAGE_LIMIT }],
        meta: [{ $count: "total" }],
      },
    },
  ]);
  return pageResult(result?.items || [], result?.meta?.[0]?.total || 0, page);
}

function clientWisePipeline(range) {
  return [
    { $match: dateMatch("updatedAt", range) },
    {
      $group: {
        _id: "$client",
        total: { $sum: 1 },
        not_started: { $sum: { $cond: [{ $eq: ["$status", "not_started"] }, 1, 0] } },
        wip: { $sum: { $cond: [{ $eq: ["$status", "wip"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        submitted_to_fta: { $sum: { $cond: [{ $eq: ["$status", "submitted_to_fta"] }, 1, 0] } },
        updatedAt: { $max: "$updatedAt" },
      },
    },
    { $lookup: { from: "clients", localField: "_id", foreignField: "_id", as: "client" } },
    { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
    { $match: { "client.isActive": true } },
    { $sort: { updatedAt: -1 } },
    { $project: { client: { _id: "$client._id", legalName: "$client.legalName", fileNo: "$client.fileNo" }, total: 1, not_started: 1, wip: 1, completed: 1, submitted_to_fta: 1, updatedAt: 1 } },
  ];
}

async function latestTaskActors(taskIds) {
  if (!taskIds.length) return new Map();
  const logs = await ActivityLog.aggregate([
    { $match: { task: { $in: taskIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$task",
        user: { $first: "$user" },
        action: { $first: "$action" },
        createdAt: { $first: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        task: "$_id",
        user: { _id: "$user._id", name: "$user.name", email: "$user.email", role: "$user.role" },
        action: 1,
        createdAt: 1,
      },
    },
  ]);

  return new Map(logs.map((row) => [String(row.task), row]));
}

function userWisePipeline(range) {
  return [
    { $match: dateMatch("updatedAt", range) },
    {
      $group: {
        _id: "$assignedTo",
        total: { $sum: 1 },
        not_started: { $sum: { $cond: [{ $eq: ["$status", "not_started"] }, 1, 0] } },
        wip: { $sum: { $cond: [{ $eq: ["$status", "wip"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        submitted_to_fta: { $sum: { $cond: [{ $eq: ["$status", "submitted_to_fta"] }, 1, 0] } },
        updatedAt: { $max: "$updatedAt" },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $sort: { updatedAt: -1 } },
    { $project: { user: { _id: "$user._id", name: "$user.name", email: "$user.email", role: "$user.role" }, total: 1, not_started: 1, wip: 1, completed: 1, submitted_to_fta: 1, updatedAt: 1 } },
  ];
}

exports.loginActivity = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    const page = parsePage(req.query.page);
    const query = dateMatch("lastLogin", range);
    const [items, total] = await Promise.all([
      User.find(query).select("name email role lastLogin").sort({ lastLogin: -1 }).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT),
      User.countDocuments(query),
    ]);
    res.status(200).json(pageResult(items, total, page));
  } catch (error) { next(error); }
};

exports.taskActivity = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    const page = parsePage(req.query.page);
    const query = dateMatch("updatedAt", range);
    const [items, total] = await Promise.all([
      ActivityLog.find(query).populate("user", "name email").populate({ path: "task", populate: { path: "client", select: "legalName" } }).sort({ updatedAt: -1 }).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT),
      ActivityLog.countDocuments(query),
    ]);
    res.status(200).json(pageResult(items, total, page));
  } catch (error) { next(error); }
};

exports.clientWise = async (req, res, next) => {
  try { res.status(200).json(await aggregatePage(clientWisePipeline(parseRange(req.query)), parsePage(req.query.page))); } catch (error) { next(error); }
};

exports.clientTaskDetail = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    const client = await Client.findById(req.params.clientId).select("legalName fileNo");
    if (!client) return res.status(404).json({ message: "Client not found" });

    const tasks = await Task.find({
      client: client._id,
      ...dateMatch("updatedAt", range),
    })
      .populate("assignedTo", "name email role")
      .sort({ updatedAt: -1, createdAt: -1 });

    const activityByTask = await latestTaskActors(tasks.map((task) => task._id));
    const items = tasks.map((task) => {
      const latestActivity = activityByTask.get(String(task._id));
      return {
        _id: task._id,
        taskId: task.taskId,
        taskType: task.taskType,
        category: task.category,
        status: task.status,
        dueDate: task.dueDate,
        updatedAt: task.updatedAt,
        assignedTo: task.assignedTo ? {
          _id: task.assignedTo._id,
          name: task.assignedTo.name,
          email: task.assignedTo.email,
          role: task.assignedTo.role,
        } : null,
        performedBy: latestActivity?.user || null,
        latestAction: latestActivity?.action || null,
        latestActionAt: latestActivity?.createdAt || null,
      };
    });

    res.status(200).json({ client, items, total: items.length });
  } catch (error) { next(error); }
};

exports.userWise = async (req, res, next) => {
  try { res.status(200).json(await aggregatePage(userWisePipeline(parseRange(req.query)), parsePage(req.query.page))); } catch (error) { next(error); }
};

exports.userTaskDetail = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    const user = await User.findById(req.params.userId).select("name email role");
    if (!user) return res.status(404).json({ message: "User not found" });

    const tasks = await Task.find({
      assignedTo: user._id,
      ...dateMatch("updatedAt", range),
    })
      .populate("client", "legalName fileNo")
      .populate("assignedTo", "name email role")
      .sort({ updatedAt: -1, createdAt: -1 });

    const activityByTask = await latestTaskActors(tasks.map((task) => task._id));
    const items = tasks.map((task) => {
      const latestActivity = activityByTask.get(String(task._id));
      return {
        _id: task._id,
        taskId: task.taskId,
        taskType: task.taskType,
        category: task.category,
        status: task.status,
        dueDate: task.dueDate,
        updatedAt: task.updatedAt,
        client: task.client ? {
          _id: task.client._id,
          legalName: task.client.legalName,
          fileNo: task.client.fileNo,
        } : null,
        assignedTo: task.assignedTo ? {
          _id: task.assignedTo._id,
          name: task.assignedTo.name,
          email: task.assignedTo.email,
          role: task.assignedTo.role,
        } : null,
        performedBy: latestActivity?.user || null,
        latestAction: latestActivity?.action || null,
        latestActionAt: latestActivity?.createdAt || null,
      };
    });

    res.status(200).json({ user, items, total: items.length });
  } catch (error) { next(error); }
};

exports.overdue = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    const page = parsePage(req.query.page);
    const query = { ...dateMatch("updatedAt", range), dueDate: { $lt: new Date() }, status: { $ne: "completed" } };
    const [tasks, total] = await Promise.all([
      Task.find(query).populate("client", "legalName").populate("assignedTo", "name").sort({ updatedAt: -1 }).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT),
      Task.countDocuments(query),
    ]);
    res.status(200).json(pageResult(tasks.map((task) => ({ ...task.toObject(), daysOverdue: daysOverdue(task.dueDate) })), total, page));
  } catch (error) { next(error); }
};

exports.ftaTrackerReport = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    const page = parsePage(req.query.page);
    const query = { ...dateMatch("updatedAt", range), isAwaitingFta: true };
    const [tasks, total] = await Promise.all([
      Task.find(query).populate("client", "legalName").populate("assignedTo", "name").sort({ updatedAt: -1 }).skip((page - 1) * PAGE_LIMIT).limit(PAGE_LIMIT),
      Task.countDocuments(query),
    ]);
    res.status(200).json(pageResult(tasks, total, page));
  } catch (error) { next(error); }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const { report } = req.params;
    if (!reportKeys.has(report)) return res.status(404).json({ message: "Report not found" });
    const range = parseRange(req.query);
    sendCsvHeaders(res, `${report}-${range.start.toISOString().slice(0, 10)}-to-${range.end.toISOString().slice(0, 10)}.csv`);

    if (report === "login-activity") {
      writeCsvRow(res, ["Name", "Email", "Role", "Last Login"]);
      const cursor = User.find(dateMatch("lastLogin", range)).select("name email role lastLogin").sort({ lastLogin: -1 }).cursor({ batchSize: CSV_BATCH_SIZE });
      for await (const user of cursor) writeCsvRow(res, [user.name, user.email, user.role, formatCsvDateTime(user.lastLogin)]);
    } else if (report === "task-activity") {
      writeCsvRow(res, ["Task ID", "User", "Date & Time", "Client", "Task Name", "Category", "Action", "Last Updated"]);
      const cursor = ActivityLog.find(dateMatch("updatedAt", range)).populate("user", "name email").populate({ path: "task", populate: { path: "client", select: "legalName" } }).sort({ updatedAt: -1 }).cursor({ batchSize: CSV_BATCH_SIZE });
      for await (const row of cursor) writeCsvRow(res, [row.task?.taskId, row.user?.name || row.user?.email, formatCsvDateTime(row.createdAt), row.task?.client?.legalName, row.task?.taskType, row.task?.category, row.action, formatCsvDateTime(row.updatedAt)]);
    } else if (report === "client-wise") {
      writeCsvRow(res, ["Client", "File No", "Total", "Not Started", "In Progress", "Completed", "Submitted to FTA", "Last Updated"]);
      const cursor = Task.aggregate(clientWisePipeline(range)).cursor({ batchSize: CSV_BATCH_SIZE });
      for await (const row of cursor) writeCsvRow(res, [row.client?.legalName, row.client?.fileNo, row.total, row.not_started, row.wip, row.completed, row.submitted_to_fta, formatCsvDateTime(row.updatedAt)]);
    } else if (report === "user-wise") {
      writeCsvRow(res, ["User", "Email", "Role", "Total", "Not Started", "In Progress", "Completed", "Submitted to FTA", "Last Updated"]);
      const cursor = Task.aggregate(userWisePipeline(range)).cursor({ batchSize: CSV_BATCH_SIZE });
      for await (const row of cursor) writeCsvRow(res, [row.user?.name || "Unassigned", row.user?.email, row.user?.role, row.total, row.not_started, row.wip, row.completed, row.submitted_to_fta, formatCsvDateTime(row.updatedAt)]);
    } else {
      const query = {
        ...dateMatch("updatedAt", range),
        ...(report === "overdue" ? { dueDate: { $lt: new Date() }, status: { $ne: "completed" } } : { isAwaitingFta: true }),
      };
      writeCsvRow(res, report === "overdue"
        ? ["Task ID", "Client", "Assigned To", "Task Name", "Category", "Due Date", "Days Overdue", "Last Updated"]
        : ["Task ID", "Client", "Assigned To", "Task Name", "Category", "FTA Status", "Submitted", "Last Updated"]);
      const cursor = Task.find(query).populate("client", "legalName").populate("assignedTo", "name").sort({ updatedAt: -1 }).cursor({ batchSize: CSV_BATCH_SIZE });
      for await (const task of cursor) {
        writeCsvRow(res, report === "overdue"
          ? [task.taskId, task.client?.legalName, task.assignedTo?.name, task.taskType, task.category, formatCsvDate(task.dueDate), daysOverdue(task.dueDate), formatCsvDateTime(task.updatedAt)]
          : [task.taskId, task.client?.legalName, task.assignedTo?.name, task.taskType, task.category, task.ftaStatus, formatCsvDateTime(task.ftaSubmittedDate), formatCsvDateTime(task.updatedAt)]);
      }
    }
    res.end();
  } catch (error) { next(error); }
};
