require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const connectDB = require("./config/db");
const Task = require("./models/Task");
const User = require("./models/User");
const Notification = require("./models/Notification");
const sendEmail = require("./utils/sendEmail");
const { notFound, errorMiddleware } = require("./middleware/errorMiddleware");

const app = express();
// The frontend has been opened through both localhost and 127.0.0.1 during local runs,
// so we allow both dev origins here to avoid misleading "invalid credentials" UI errors.
const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean));

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/clients", require("./routes/clientRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/groups", require("./routes/groupRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use(notFound);
app.use(errorMiddleware);

async function dailyTaskNotifications() {
  // We compute date windows in UTC because all persisted task dates are stored in UTC.
  const now = new Date();
  const start3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3));
  const end3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 4));
  const dueSoon = await Task.find({ dueDate: { $gte: start3, $lt: end3 }, status: { $ne: "completed" }, assignedTo: { $ne: null } });
  await Notification.insertMany(dueSoon.map((task) => ({ recipient: task.assignedTo, title: "Task due in 3 days", message: `${task.taskId} is due soon.`, type: "task_due", relatedTask: task._id })));

  const overdue = await Task.find({ dueDate: { $lt: now }, status: { $ne: "completed" } }).populate("assignedTo", "email name");
  const admins = await User.find({ role: "admin", isActive: true });
  const notifications = [];
  overdue.forEach((task) => {
    [task.assignedTo?._id, ...admins.map((admin) => admin._id)].filter(Boolean).forEach((recipient) => notifications.push({ recipient, title: "Task overdue", message: `${task.taskId} is overdue.`, type: "task_overdue", relatedTask: task._id }));
  });
  if (notifications.length) await Notification.insertMany(notifications);
  const byEmail = new Map();
  overdue.forEach((task) => { if (task.assignedTo?.email) byEmail.set(task.assignedTo.email, [...(byEmail.get(task.assignedTo.email) || []), task.taskId]); });
  admins.forEach((admin) => byEmail.set(admin.email, overdue.map((task) => task.taskId)));
  for (const [to, ids] of byEmail) await sendEmail({ to, subject: "Filing Buddy overdue task digest", text: `Overdue tasks: ${ids.join(", ")}` });
}

cron.schedule("0 4 * * *", dailyTaskNotifications, { timezone: "UTC" });

const port = process.env.PORT || 5000;
// Boot is intentionally fail-fast: if Mongo is unavailable, we do not start a half-alive API.
// Keeping startup explicit here helps hosted platforms surface environment issues quickly in logs.
connectDB().then(async () => {
  // Auto-seed when using the in-memory dev MongoDB so the app has usable data immediately.
  const User = require("./models/User");
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    console.log("🌱 Empty database detected — running seed for local dev...");
    try {
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

      const admin = await User.create({ name: "Hamad Siddiqui", email: "admin@filingbuddy.ae", password: "Admin@123", role: "admin" });
      const sara  = await User.create({ name: "Sara Mahmoud",   email: "sara@filingbuddy.ae",  password: "Sara@123",  role: "manager" });
      const omar  = await User.create({ name: "Omar Khalid",    email: "omar@filingbuddy.ae",  password: "Omar@123",  role: "task_only" });

      for (const [name, icon, color, taskTypes] of categories) {
        await Category.create({ name, icon, color, isDefault: true, taskTypes: taskTypes.map((t) => ({ name: t })) });
      }

      const cipriani = await ClientGroup.create({ name: "Cipriani Group", createdBy: admin._id });
      const maritime = await ClientGroup.create({ name: "Gulf Maritime Group", createdBy: admin._id });

      const mkClient = (d) => Client.create({ ...d, createdBy: admin._id });
      const alBaraka = await mkClient({ fileNo: "FB-CLIENT-0001", clientType: "legal", legalName: "Al Baraka Trading LLC",   jurisdiction: "mainland",  registeredAddress: { country: "UAE", emirate: "Dubai" },    vatDetails: { trn: "1004821550003", status: "registered", filingFrequency: "quarterly" }, group: cipriani._id });
      const zenith   = await mkClient({ fileNo: "FB-CLIENT-0002", clientType: "legal", legalName: "Zenith Digital FZ LLC",   jurisdiction: "freezone",  registeredAddress: { country: "UAE", emirate: "DMCC" },     group: cipriani._id });
      const petra    = await mkClient({ fileNo: "FB-CLIENT-0003", clientType: "legal", legalName: "Petra Construction Co.",  jurisdiction: "mainland",  registeredAddress: { country: "UAE", emirate: "Abu Dhabi" } });
      const gulf     = await mkClient({ fileNo: "FB-CLIENT-0004", clientType: "legal", legalName: "Gulf Star Logistics",     jurisdiction: "mainland",  registeredAddress: { country: "UAE", emirate: "Sharjah" },  group: maritime._id });
      const nova     = await mkClient({ fileNo: "FB-CLIENT-0005", clientType: "legal", legalName: "Nova Tech DMCC",          jurisdiction: "freezone",  registeredAddress: { country: "UAE", emirate: "Dubai" } });
      await mkClient({ fileNo: "FB-CLIENT-0006", clientType: "natural", legalName: "Mr. Khalid Al Rashidi", jurisdiction: "mainland", registeredAddress: { country: "UAE", emirate: "Dubai" } });

      cipriani.clients = [alBaraka._id, zenith._id]; await cipriani.save();
      maritime.clients = [gulf._id];                  await maritime.save();

      const seedTasks = [
        ["FB/2026/T001", alBaraka, "VAT",        "VAT Return",             "2026-04-28", sara, "wip",            false, null,       false],
        ["FB/2026/T002", zenith,   "CT",         "CT Return",              "2026-05-31", omar, "not_started",    false, null,       false],
        ["FB/2026/T003", petra,    "VAT",        "VAT Registration",       "2026-05-15", sara, "submitted_to_fta",false,null,      true, "in_review"],
        ["FB/2026/T004", gulf,     "Accounting", "Monthly Accounting",     "2026-05-31", null, "not_started",    false, null,       false],
        ["FB/2026/T007", petra,    "VAT",        "VAT Registration",       "2026-05-10", sara, "submitted_to_fta",false,null,      true, "in_review"],
        ["FB/2026/T008", nova,     "CT",         "CT Registration",        "2026-05-10", omar, "submitted_to_fta",false,null,      true, "in_review"],
        ["FB/2026/T009", alBaraka, "VAT",        "VAT Refund Application", "2026-05-10", sara, "submitted_to_fta",false,null,      true, "additional_query"],
      ];
      for (const [taskId, client, category, taskType, dueDate, assignedTo, status, isRecurring, frequency, isAwaitingFta, ftaStatus] of seedTasks) {
        const task = await Task.create({ taskId, client: client._id, category, taskType, dueDate, assignedTo: assignedTo?._id, status, isRecurring, recurringConfig: frequency ? { frequency } : undefined, isAwaitingFta, ftaStatus, ftaSubmittedDate: isAwaitingFta ? new Date("2026-05-01") : undefined, createdBy: admin._id });
        await ActivityLog.create({ task: task._id, user: admin._id, action: "Created", newStatus: status });
      }
      await Notification.create({ recipient: sara._id, title: "FTA query received", message: "FB/2026/T009 has an additional FTA query.", type: "fta_query" });
      console.log("✅ Seed complete! Login: admin@filingbuddy.ae / Admin@123");
    } catch (seedErr) {
      console.error("Seed error:", seedErr.message);
    }
  }
  app.listen(port, () => console.log(`API running on ${port}`));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
