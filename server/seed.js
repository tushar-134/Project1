require("dotenv").config();
const connectDB = require("./config/db");
const User = require("./models/User");
const Category = require("./models/Category");
const ClientGroup = require("./models/ClientGroup");
const Client = require("./models/Client");
const Task = require("./models/Task");
const ActivityLog = require("./models/ActivityLog");
const Notification = require("./models/Notification");

const categories = [
  ["VAT", "Receipt", "#1e3a8a", ["VAT Return", "VAT Refund Application", "VAT Registration", "VAT Deregistration", "VAT Amendment"]],
  ["CT", "Landmark", "#7c3aed", ["CT Return", "CT Registration", "CT Deregistration", "Transfer Pricing", "Pillar Two Reporting"]],
  ["Audit", "ClipboardCheck", "#dc2626", ["Statutory Audit", "Internal Audit", "Due Diligence", "Special Purpose Audit"]],
  ["Accounting", "Calculator", "#059669", ["Monthly Accounting", "Quarterly Accounts", "Year-end Financials", "Bookkeeping", "Payroll Accounting"]],
  ["MIS", "BarChart3", "#0891b2", ["Monthly MIS", "Quarterly MIS", "Annual MIS", "Dashboard Preparation"]],
  ["EInv", "FileDigit", "#ea580c", ["E-Invoicing Setup", "Portal Updation", "E-Invoicing Compliance"]],
  ["Refund", "RefreshCw", "#0ea5e9", ["VAT Refund Application", "VAT Refund Follow-up"]],
  ["Other", "Boxes", "#475569", ["ESR Notification", "UBO Registration", "Trade Licence Renewal", "MOA Amendment", "Custom Task"]],
];

async function upsertUser(data) {
  let user = await User.findOne({ email: data.email });
  if (!user) user = await User.create(data);
  return user;
}

async function upsertClient(data) {
  let client = await Client.findOne({ legalName: data.legalName });
  if (!client) client = await Client.create(data);
  return client;
}

async function seed() {
  // Seed stays idempotent so it can be rerun after local resets without duplicating practice data.
  await connectDB();
  const admin = await upsertUser({ name: "Hamad Siddiqui", email: "admin@filingbuddy.ae", password: "Admin@123", role: "admin" });
  const sara = await upsertUser({ name: "Sara Mahmoud", email: "sara@filingbuddy.ae", password: "Sara@123", role: "manager" });
  const omar = await upsertUser({ name: "Omar Khalid", email: "omar@filingbuddy.ae", password: "Omar@123", role: "task_only" });

  for (const [name, icon, color, taskTypes] of categories) {
    await Category.updateOne({ name }, { $setOnInsert: { name, icon, color, isDefault: true, taskTypes: taskTypes.map((type) => ({ name: type })) } }, { upsert: true });
  }

  const cipriani = await ClientGroup.findOneAndUpdate({ name: "Cipriani Group" }, { $setOnInsert: { name: "Cipriani Group", createdBy: admin._id } }, { upsert: true, new: true });
  const maritime = await ClientGroup.findOneAndUpdate({ name: "Gulf Maritime Group" }, { $setOnInsert: { name: "Gulf Maritime Group", createdBy: admin._id } }, { upsert: true, new: true });

  const alBaraka = await upsertClient({ fileNo: "FB-CLIENT-0001", clientType: "legal", legalName: "Al Baraka Trading LLC", tradeName: "Al Baraka Trading", jurisdiction: "mainland", registeredAddress: { country: "United Arab Emirates", emirate: "Dubai" }, vatDetails: { trn: "1004821550003", status: "registered", filingFrequency: "quarterly" }, group: cipriani._id, createdBy: admin._id });
  const zenith = await upsertClient({ fileNo: "FB-CLIENT-0002", clientType: "legal", legalName: "Zenith Digital FZ LLC", jurisdiction: "freezone", registeredAddress: { country: "United Arab Emirates", emirate: "DMCC" }, group: cipriani._id, createdBy: admin._id });
  const petra = await upsertClient({ fileNo: "FB-CLIENT-0003", clientType: "legal", legalName: "Petra Construction Co.", jurisdiction: "mainland", registeredAddress: { country: "United Arab Emirates", emirate: "Abu Dhabi" }, createdBy: admin._id });
  const gulf = await upsertClient({ fileNo: "FB-CLIENT-0004", clientType: "legal", legalName: "Gulf Star Logistics", jurisdiction: "mainland", registeredAddress: { country: "United Arab Emirates", emirate: "Sharjah" }, group: maritime._id, createdBy: admin._id });
  const nova = await upsertClient({ fileNo: "FB-CLIENT-0005", clientType: "legal", legalName: "Nova Tech DMCC", jurisdiction: "freezone", registeredAddress: { country: "United Arab Emirates", emirate: "Dubai" }, createdBy: admin._id });
  await upsertClient({ fileNo: "FB-CLIENT-0006", clientType: "natural", legalName: "Mr. Khalid Al Rashidi", jurisdiction: "mainland", registeredAddress: { country: "United Arab Emirates", emirate: "Dubai" }, createdBy: admin._id });
  cipriani.clients = [alBaraka._id, zenith._id];
  maritime.clients = [gulf._id];
  await cipriani.save(); await maritime.save();

  const tasks = [
    ["FB/2026/T001", alBaraka, "VAT", "VAT Return", "2026-04-28", sara, "wip", true, "quarterly", false],
    ["FB/2026/T002", zenith, "CT", "CT Return", "2026-05-31", omar, "not_started", true, "annual", false],
    ["FB/2026/T003", petra, "VAT", "VAT Registration", "2026-05-15", sara, "submitted_to_fta", false, null, true, "in_review"],
    ["FB/2026/T004", gulf, "Accounting", "Monthly Accounting", "2026-05-31", null, "not_started", false, null, false],
    ["FB/2026/T007", petra, "VAT", "VAT Registration", "2026-05-10", sara, "submitted_to_fta", false, null, true, "in_review"],
    ["FB/2026/T008", nova, "CT", "CT Registration", "2026-05-10", omar, "submitted_to_fta", false, null, true, "in_review"],
    ["FB/2026/T009", alBaraka, "VAT", "VAT Refund Application", "2026-05-10", sara, "submitted_to_fta", false, null, true, "additional_query"],
  ];
  for (const [taskId, client, category, taskType, dueDate, assignedTo, status, isRecurring, frequency, isAwaitingFta, ftaStatus] of tasks) {
    const task = await Task.findOneAndUpdate({ taskId }, { $setOnInsert: { taskId, client: client._id, category, taskType, dueDate, assignedTo: assignedTo?._id, status, isRecurring, recurringConfig: frequency ? { frequency } : undefined, isAwaitingFta, ftaStatus, ftaSubmittedDate: isAwaitingFta ? new Date("2026-05-01") : undefined, createdBy: admin._id } }, { upsert: true, new: true });
    await ActivityLog.updateOne({ task: task._id, action: "Created" }, { $setOnInsert: { task: task._id, user: admin._id, action: "Created", newStatus: status } }, { upsert: true });
  }
  await Notification.updateOne({ recipient: sara._id, type: "fta_query" }, { $setOnInsert: { recipient: sara._id, title: "FTA query received", message: "FB/2026/T009 has an additional FTA query.", type: "fta_query" } }, { upsert: true });
  console.log("Seed complete");
  process.exit(0);
}

seed().catch((error) => { console.error(error); process.exit(1); });
