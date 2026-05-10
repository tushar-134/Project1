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
connectDB().then(() => app.listen(port, () => console.log(`API running on ${port}`))).catch((error) => {
  console.error(error);
  process.exit(1);
});
