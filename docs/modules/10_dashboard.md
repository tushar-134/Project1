# Module 10 — Dashboard

## Overview

The Dashboard module is the home screen of Filing Buddy. It displays high-level practice metrics and recent task activity, allowing managers and admins to get a quick snapshot of the firm's workload status for any requested month.

---

## Primary File

| File | Role |
|------|------|
| `src/components/screens/Dashboard.jsx` | Main dashboard screen |

---

## Responsibilities

- Load dashboard statistics from the backend on mount and on month change
- Display KPI summary cards (total clients, active tasks, completed tasks, overdue tasks)
- Display a category-level breakdown of task counts
- Display a recent activity table showing the latest task actions

---

## UI Sections

### Month Picker
- Lets the user select any month/year
- Changing the month re-fetches all stats filtered to that period

### KPI Cards

| Card | Data Source |
|------|------------|
| Total Clients | `dashboardStats.totalClients` |
| Active Tasks | `dashboardStats.activeTasks` |
| Completed Tasks | `dashboardStats.completedTasks` |
| Overdue Tasks | `dashboardStats.overdueTasks` |

### Category Tile Breakdown

Renders one tile per category (VAT, CT, Audit, Accounting, MIS, EInv, Refund, Other), each showing:
- Total tasks in that category for the month
- Completed count
- Overdue count

### Recent Activity Table

| Column | Description |
|--------|-------------|
| Task ID | Formatted ID (e.g. `FB/2024/T001`) |
| Client | Client name |
| Action | What happened (status change, creation) |
| User | Who performed the action |
| Time | Relative or formatted timestamp |

---

## Data Flow

```
Dashboard.jsx mounts
  → reportService.dashboardStats({ month, year })
    → GET /api/reports/dashboard-stats
      → reportController builds aggregation
        → returns { totalClients, activeTasks, completedTasks, overdueTasks, categoryBreakdown, recentActivity }
          → AppContext.SET_DASHBOARD
            → state.dashboardStats + state.activity updated
              → UI re-renders
```

---

## Backend Endpoint

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| `GET` | `/api/reports/dashboard-stats` | Yes | All |

Query params: `month`, `year`

---

## Dependencies

| Dependency | Used For |
|-----------|---------|
| `reportService.dashboardStats` | Fetch stats |
| `AppContext` (`SET_DASHBOARD`) | Store result |
| `Card`, `Badge` UI components | Layout |
