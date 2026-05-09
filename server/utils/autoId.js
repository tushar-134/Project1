const Client = require("../models/Client");
const Task = require("../models/Task");

async function nextClientFileNo() {
  // IDs are generated from the latest stored record so seeded and user-created data share one sequence.
  const last = await Client.findOne({ fileNo: /^FB-CLIENT-/ }).sort({ createdAt: -1 }).select("fileNo");
  const n = last?.fileNo ? Number(last.fileNo.split("-").pop()) + 1 : 1;
  return `FB-CLIENT-${String(n).padStart(4, "0")}`;
}

async function nextTaskId(year = new Date().getUTCFullYear()) {
  // Task numbering rolls per year to preserve the FB/YYYY/T001 format used in the prototype.
  const last = await Task.findOne({ taskId: new RegExp(`^FB/${year}/T`) }).sort({ createdAt: -1 }).select("taskId");
  const n = last?.taskId ? Number(last.taskId.split("T").pop()) + 1 : 1;
  return `FB/${year}/T${String(n).padStart(3, "0")}`;
}

module.exports = { nextClientFileNo, nextTaskId };
