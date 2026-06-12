require("dotenv").config();
const express = require("express");
const path = require("path");
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
const { maybeGenerateNextRecurringTask } = require("./controllers/taskController");

const app = express();
app.set("trust proxy", 1);
// The frontend has been opened through both localhost and 127.0.0.1 during local runs,
// so we allow both dev origins here to avoid misleading "invalid credentials" UI errors.
const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean));

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  exposedHeaders: ["x-auth-token"],
}));
app.use(express.json({ limit: "5mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "uploads")));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/clients", require("./routes/clientRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/groups", require("./routes/groupRoutes"));
app.use("/api/contacts", require("./routes/contactRoutes"));
app.use("/api/client-visits", require("./routes/clientVisitRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/custom-fields", require("./routes/customFieldRoutes"));
app.use(notFound);
app.use(errorMiddleware);

async function insertMissingNotifications(entries) {
  if (!entries.length) return;
  const recipients = [...new Set(entries.map((entry) => String(entry.recipient)).filter(Boolean))];
  const relatedTaskIds = [...new Set(entries.map((entry) => String(entry.relatedTask)).filter(Boolean))];
  const types = [...new Set(entries.map((entry) => entry.type).filter(Boolean))];

  const existing = await Notification.find({
    recipient: { $in: recipients },
    relatedTask: { $in: relatedTaskIds },
    type: { $in: types },
  }).select("recipient relatedTask type");

  const existingKeys = new Set(
    existing.map((entry) => `${String(entry.recipient)}:${entry.type}:${String(entry.relatedTask)}`)
  );

  const freshEntries = entries.filter((entry) => {
    const key = `${String(entry.recipient)}:${entry.type}:${String(entry.relatedTask)}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  if (freshEntries.length) await Notification.insertMany(freshEntries);
}

async function dailyTaskNotifications() {
  // We compute date windows in UTC because all persisted task dates are stored in UTC.
  const now = new Date();
  const start3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3));
  const end3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 4));
  const dueSoon = await Task.find({ dueDate: { $gte: start3, $lt: end3 }, status: { $ne: "completed" }, assignedTo: { $ne: null } });
  await insertMissingNotifications(dueSoon.map((task) => ({
    recipient: task.assignedTo,
    title: "Task due in 3 days",
    message: `${task.taskId} is due soon.`,
    type: "task_due",
    relatedTask: task._id,
  })));

  const overdue = await Task.find({ dueDate: { $lt: now }, status: { $ne: "completed" } }).populate("assignedTo", "email name");
  const admins = await User.find({ role: "admin", isActive: true });
  const notifications = [];
  overdue.forEach((task) => {
    [task.assignedTo?._id, ...admins.map((admin) => admin._id)].filter(Boolean).forEach((recipient) => notifications.push({ recipient, title: "Task overdue", message: `${task.taskId} is overdue.`, type: "task_overdue", relatedTask: task._id }));
  });
  await insertMissingNotifications(notifications);
  const byEmail = new Map();
  overdue.forEach((task) => { if (task.assignedTo?.email) byEmail.set(task.assignedTo.email, [...(byEmail.get(task.assignedTo.email) || []), task.taskId]); });
  admins.forEach((admin) => byEmail.set(admin.email, overdue.map((task) => task.taskId)));
  for (const [to, ids] of byEmail) await sendEmail({ to, subject: "Filing Buddy overdue task digest", text: `Overdue tasks: ${ids.join(", ")}` });
}

async function taskScheduler() {
  const now = new Date();
  
  // Find all recurring tasks whose next due date is within the
  // maximum configured daysBeforeDue window from today (99 days max).
  const maxWindow = 99;
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + maxWindow + 1));
  
  console.log("Now running task scheduler for window: ", windowStart, " to ", windowEnd);

  const tasks = await Task.find({
    isRecurring: true,
    recurringGeneratedTask: null,
    "recurringConfig.nextDueDate": { $gte: windowStart, $lt: windowEnd }
  });

  if (!tasks.length) {
    console.log("No recurring tasks found in window");
    return;
  }

  const todayMs = windowStart.getTime();
  let generatedCount = 0;
  
  for (const task of tasks) {
    const daysBeforeDue = task.recurringConfig?.daysBeforeDue || 15;
    const nextDueMs = new Date(task.recurringConfig.nextDueDate).getTime();
    const daysUntilDue = Math.ceil((nextDueMs - todayMs) / 86400000);
    
    // Only generate if we are within the daysBeforeDue window
    if (daysUntilDue <= daysBeforeDue) {
      await maybeGenerateNextRecurringTask(task);
      generatedCount++;
    }
  }
  
  console.log(`Generated ${generatedCount} recurring tasks`);
}

cron.schedule("0 4 * * *", dailyTaskNotifications, { timezone: "UTC" });

// ── Licence-expiry notifications (runs daily at 04:15 UTC) ──────────────────
async function dailyLicenceExpiryNotifications() {
  try {
    const Client = require("./models/Client");
    const now = new Date();
    const soon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 15));
    // Find clients whose primary trade licence expires within 15 days (or already expired)
    const expiringClients = await Client.find({
      isActive: true,
      "tradeLicences.0.expiryDate": { $lte: soon },
    }).select("_id legalName fileNo tradeLicences");

    if (!expiringClients.length) return;

    const admins = await User.find({ role: "admin", isActive: true }).select("_id");
    const recipientIds = admins.map((a) => String(a._id));
    if (!recipientIds.length) return;

    const entries = [];
    expiringClients.forEach((client) => {
      const licence = (client.tradeLicences || [])[0];
      if (!licence?.expiryDate) return;
      const expiry = new Date(licence.expiryDate);
      const isExpired = expiry < now;
      const daysLeft = Math.ceil((expiry - now) / 86_400_000);
      const title = isExpired
        ? "Trade licence expired"
        : `Trade licence expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
      const message = `${client.legalName || client.fileNo} — ${isExpired ? "expired" : "expires"} ${expiry.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
      recipientIds.forEach((recipient) =>
        entries.push({ recipient, title, message, type: "licence_expiry", relatedClient: client._id })
      );
    });

    await insertMissingNotifications(entries);
  } catch (err) {
    console.error("[Licence Expiry Cron] Error:", err.message);
  }
}

cron.schedule("15 4 * * *", dailyLicenceExpiryNotifications, { timezone: "UTC" });

cron.schedule("0 4 * * *", taskScheduler, { timezone: "UTC" });

const port = process.env.PORT || 5000;
async function seedLocalDatabaseIfEmpty() {
  const User = require("./models/User");
  const userCount = await User.countDocuments();
  if (userCount !== 0) return;

  console.log("🌱 Empty local database detected — running seed in the background...");
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
    const sara = await User.create({ name: "Sara Mahmoud", email: "sara@filingbuddy.ae", password: "Sara@123", role: "manager" });
    const omar = await User.create({ name: "Omar Khalid", email: "omar@filingbuddy.ae", password: "Omar@123", role: "associate" });

    for (const [name, icon, color, taskTypes] of categories) {
      await Category.create({ name, icon, color, isDefault: true, taskTypes: taskTypes.map((t) => ({ name: t })) });
    }

    const cipriani = await ClientGroup.create({ name: "Cipriani Group", createdBy: admin._id });
    const maritime = await ClientGroup.create({ name: "Gulf Maritime Group", createdBy: admin._id });

    const mkClient = (d) => Client.create({ ...d, createdBy: admin._id });
    const alBaraka = await mkClient({ fileNo: "FB-CLIENT-0001", clientType: "legal", legalName: "Al Baraka Trading LLC", jurisdiction: "mainland", registeredAddress: { country: "UAE", emirate: "Dubai" }, vatDetails: { trn: "1004821550003", status: "registered", filingFrequency: "quarterly" }, group: cipriani._id });
    const zenith = await mkClient({ fileNo: "FB-CLIENT-0002", clientType: "legal", legalName: "Zenith Digital FZ LLC", jurisdiction: "freezone", registeredAddress: { country: "UAE", emirate: "DMCC" }, group: cipriani._id });
    const petra = await mkClient({ fileNo: "FB-CLIENT-0003", clientType: "legal", legalName: "Petra Construction Co.", jurisdiction: "mainland", registeredAddress: { country: "UAE", emirate: "Abu Dhabi" } });
    const gulf = await mkClient({ fileNo: "FB-CLIENT-0004", clientType: "legal", legalName: "Gulf Star Logistics", jurisdiction: "mainland", registeredAddress: { country: "UAE", emirate: "Sharjah" }, group: maritime._id });
    const nova = await mkClient({ fileNo: "FB-CLIENT-0005", clientType: "legal", legalName: "Nova Tech DMCC", jurisdiction: "freezone", registeredAddress: { country: "UAE", emirate: "Dubai" } });
    await mkClient({ fileNo: "FB-CLIENT-0006", clientType: "natural", legalName: "Mr. Khalid Al Rashidi", jurisdiction: "mainland", registeredAddress: { country: "UAE", emirate: "Dubai" } });

    cipriani.clients = [alBaraka._id, zenith._id]; await cipriani.save();
    maritime.clients = [gulf._id]; await maritime.save();

    const seedTasks = [
      ["FB/2026/T001", alBaraka, "VAT", "VAT Return", "2026-04-28", sara, "wip", false, null, false],
      ["FB/2026/T002", zenith, "CT", "CT Return", "2026-05-31", omar, "not_started", false, null, false],
      ["FB/2026/T003", petra, "VAT", "VAT Registration", "2026-05-15", sara, "submitted_to_fta", false, null, true, "in_review"],
      ["FB/2026/T004", gulf, "Accounting", "Monthly Accounting", "2026-05-31", null, "not_started", false, null, false],
      ["FB/2026/T007", petra, "VAT", "VAT Registration", "2026-05-10", sara, "submitted_to_fta", false, null, true, "in_review"],
      ["FB/2026/T008", nova, "CT", "CT Registration", "2026-05-10", omar, "submitted_to_fta", false, null, true, "in_review"],
      ["FB/2026/T009", alBaraka, "VAT", "VAT Refund Application", "2026-05-10", sara, "submitted_to_fta", false, null, true, "additional_query"],
    ];
    let lastTask;
    for (const [taskId, client, category, taskType, dueDate, assignedTo, status, isRecurring, frequency, isAwaitingFta, ftaStatus] of seedTasks) {
      const task = await Task.create({ taskId, client: client._id, category, taskType, dueDate, assignedTo: assignedTo?._id, status, isRecurring, recurringConfig: frequency ? { frequency } : undefined, isAwaitingFta, ftaStatus, ftaSubmittedDate: isAwaitingFta ? new Date("2026-05-01") : undefined, createdBy: admin._id });
      await ActivityLog.create({ task: task._id, user: admin._id, action: "Created", newStatus: status });
      lastTask = task;
    }
    await Notification.create({ recipient: sara._id, title: "FTA query received", message: "FB/2026/T009 has an additional FTA query.", type: "fta_query", relatedTask: lastTask._id });
    console.log("✅ Seed complete! Login: admin@filingbuddy.ae / Admin@123");
  } catch (seedErr) {
    console.error("Seed error:", seedErr.message);
  }
}

// Boot is fail-fast for Mongo connection, but local seed data should not block the API from listening.
connectDB().then(({ isMemory }) => {
  app.listen(port, () => console.log(`API running on ${port}`));
  if (isMemory) seedLocalDatabaseIfEmpty().catch((seedErr) => console.error("Seed error:", seedErr.message));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
