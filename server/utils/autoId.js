const mongoose = require("mongoose");

// Bug #1 Fix: Replace read-then-increment with atomic findOneAndUpdate on a
// dedicated counters collection. This eliminates the race condition where two
// concurrent requests could read the same "last" record and generate duplicate IDs.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

// Keeps the stored counter aligned with existing records in MongoDB.
// This matters when seed data, imports, or manual DB edits already created IDs
// before the counter document existed or before it was updated.
async function syncCounterFloor(name, floor) {
  if (!floor) return;
  await Counter.updateOne(
    { _id: name },
    { $max: { seq: floor } },
    { upsert: true }
  );
}

function numberFromMatch(value, regex) {
  const match = String(value || "").match(regex);
  return match ? Number(match[1]) : 0;
}

// Client file number format:
//   FB-CLIENT-0001
//
// Flow:
// 1. Find the latest existing client file number.
// 2. Parse its numeric suffix.
// 3. Raise the MongoDB counter floor if needed.
// 4. Atomically increment the counter document.
// 5. Return the next zero-padded file number.
//
// Counter document:
//   _id: "clientFileNo"
async function nextClientFileNo() {
  const Client = require("../models/Client");
  const latest = await Client.findOne({ fileNo: /^FB-CLIENT-\d+$/ }).sort({ fileNo: -1 }).select("fileNo").lean();
  await syncCounterFloor("clientFileNo", numberFromMatch(latest?.fileNo, /^FB-CLIENT-(\d+)$/));
  const doc = await Counter.findByIdAndUpdate(
    "clientFileNo",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `FB-CLIENT-${String(doc.seq).padStart(4, "0")}`;
}

// Task ID format:
//   FB/YYYY/T001
//
// Example:
//   FB/2026/T001
//
// Flow:
// 1. Use the current UTC year unless a year is passed in.
// 2. Find the latest task ID for that year.
// 3. Parse its numeric suffix.
// 4. Raise the year-specific counter floor if needed.
// 5. Atomically increment the counter document.
// 6. Return the next zero-padded task ID for that year.
//
// Counter document example:
//   _id: "taskId-2026"
async function nextTaskId(year = new Date().getUTCFullYear()) {
  const Task = require("../models/Task");
  const name = `taskId-${year}`;
  const latest = await Task.findOne({ taskId: new RegExp(`^FB/${year}/T\\d+$`) }).sort({ taskId: -1 }).select("taskId").lean();
  await syncCounterFloor(name, numberFromMatch(latest?.taskId, new RegExp(`^FB/${year}/T(\\d+)$`)));
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `FB/${year}/T${String(doc.seq).padStart(3, "0")}`;
}

module.exports = { nextClientFileNo, nextTaskId };
