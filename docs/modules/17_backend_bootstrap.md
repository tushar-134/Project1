# Module 17 — Backend Bootstrap

## Overview

`server.js` is the entry point for the Express API. It loads configuration, mounts all global middleware, registers domain route modules, connects to MongoDB, and schedules the daily notification cron job.

---

## Primary File

| File | Role |
|------|------|
| `server/server.js` | Express app entry point |

---

## Startup Sequence

```
1. Load environment variables (dotenv)
2. Create Express app
3. Mount global middleware (Helmet, CORS, JSON body parser, rate limiter, Morgan)
4. Register route modules under /api/*
5. Mount error handling middleware
6. Connect to MongoDB via connectDB()
7. Start HTTP listener on PORT (default 5000)
8. Schedule cron job
```

---

## Global Middleware Stack

| Middleware | Package | Purpose |
|-----------|---------|---------|
| Helmet | `helmet` | Sets security HTTP headers |
| CORS | `cors` | Allows requests from `CLIENT_URL`, `localhost:5173`, `127.0.0.1:5173` |
| JSON Body Parser | `express` built-in | Parses request bodies up to 5 MB |
| Rate Limiter | `express-rate-limit` | 300 requests per 15 minutes per IP |
| Morgan | `morgan` | Logs requests in `dev` format (non-production only) |

---

## Route Registration

| Mount Path | Module |
|-----------|--------|
| `GET /api/health` | Inline health check |
| `/api/auth` | `routes/authRoutes.js` |
| `/api/clients` | `routes/clientRoutes.js` |
| `/api/tasks` | `routes/taskRoutes.js` |
| `/api/users` | `routes/userRoutes.js` |
| `/api/groups` | `routes/groupRoutes.js` |
| `/api/categories` | `routes/categoryRoutes.js` |
| `/api/reports` | `routes/reportRoutes.js` |
| `/api/notifications` | `routes/notificationRoutes.js` |

Error handlers (`notFound`, `errorMiddleware`) are mounted after all routes.

---

## Daily Cron Job — `dailyTaskNotifications`

**Schedule**: Every day at 04:00 UTC (`0 4 * * *`)

### What it does

**Due-soon notifications:**
- Finds all incomplete tasks with `dueDate` exactly 3 days from today
- Inserts a `type: "task_due"` Notification for each assignee

**Overdue notifications + emails:**
- Finds all incomplete tasks where `dueDate < now`
- Inserts `type: "task_overdue"` Notifications for assignees and all admin users
- Sends an overdue task digest email to each affected user/admin via `sendEmail`

---

## Environment Variables Consumed

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP server port (default `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry (default `7d`) |
| `CLIENT_URL` | Production frontend origin for CORS |
| `EMAIL_HOST` | SMTP host for cron emails |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `NODE_ENV` | Enables/disables Morgan logging |
