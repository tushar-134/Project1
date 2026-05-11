# Module 16 — Reports

## Overview

The Reports module provides read-only administrative reports across all major data domains: user activity, task activity, client-level summaries, user-level summaries, overdue tasks, and the FTA tracker rollup. It is intended for admin and manager use.

---

## Primary File

| File | Role |
|------|------|
| `src/components/screens/Reports.jsx` | Report tile selection and dynamic data table |

---

## Responsibilities

- Display a grid of available report tiles
- On tile selection, fetch the corresponding report from the backend
- Render the report data in a dynamic table
- Allow export where available

---

## Available Reports

| Tile | API Endpoint | Description |
|------|-------------|-------------|
| **Login Activity** | `GET /api/reports/login-activity` | Who logged in when |
| **Task Activity** | `GET /api/reports/task-activity` | Task creation and status changes over time |
| **Client-Wise Summary** | `GET /api/reports/client-wise` | Task count, completion, and overdue per client |
| **User-Wise Summary** | `GET /api/reports/user-wise` | Task load, completion rate per team member |
| **Overdue Tasks** | `GET /api/reports/overdue` | All currently overdue tasks |
| **FTA Tracker** | `GET /api/reports/fta-tracker` | All FTA-flagged tasks with their current FTA status |

---

## UI Flow

```
Reports.jsx mounts
  → Renders report tile grid
    → User clicks a tile
      → reportService.<method>() called
        → GET /api/reports/<endpoint>
          → Response stored in local component state
            → Dynamic table renders with the returned rows
```

---

## Dynamic Table Column Definitions per Report

### Login Activity

| Column | Description |
|--------|-------------|
| User | Name |
| Email | Login email |
| Login Time | Timestamp |
| IP Address | Source IP |

### Task Activity

| Column | Description |
|--------|-------------|
| Task ID | `FB/YYYY/T001` |
| Client | Client name |
| Action | Status change or creation description |
| Performed By | User name |
| Time | Timestamp |

### Client-Wise Summary

| Column | Description |
|--------|-------------|
| Client | Client legal name |
| Total Tasks | Count |
| Completed | Count |
| Overdue | Count |
| Pending | Count |

### User-Wise Summary

| Column | Description |
|--------|-------------|
| User | Name |
| Assigned Tasks | Total count |
| Completed | Count |
| Overdue | Count |
| Completion Rate | Percentage |

### Overdue Tasks

| Column | Description |
|--------|-------------|
| Task ID | Formatted ID |
| Client | Name |
| Category | Service area |
| Due Date | Date |
| Days Overdue | Numeric |
| Assigned To | User name |

### FTA Tracker

| Column | Description |
|--------|-------------|
| Task ID | Formatted ID |
| Client | Name |
| Task Type | Service type |
| FTA Status | In Review / Additional Query / Approved |
| Submitted Date | Date |

---

## reportService Methods

| Method | Endpoint |
|--------|----------|
| `dashboardStats(params)` | `/reports/dashboard-stats` |
| `loginActivity()` | `/reports/login-activity` |
| `taskActivity()` | `/reports/task-activity` |
| `clientWise()` | `/reports/client-wise` |
| `userWise()` | `/reports/user-wise` |
| `overdue()` | `/reports/overdue` |
| `ftaTracker()` | `/reports/fta-tracker` |

---

## Backend Endpoints Used

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| `GET` | `/api/reports/*` | Yes | Admin, Manager |

---

## Dependencies

| Dependency | Used For |
|-----------|---------|
| `reportService` | All report data fetches |
| `Table` UI component | Data display |
