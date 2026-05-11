# Module 12 — Task Management

## Overview

The Task Management module covers creating new tasks, monitoring the status of all tasks, and tracking FTA (Federal Tax Authority)-specific workflows. It is the operational core of Filing Buddy, used by all roles daily.

---

## Primary Files

| File | Role |
|------|------|
| `src/components/screens/AddTask.jsx` | Multi-step task creation form |
| `src/components/screens/TaskList.jsx` | Filtered task table with inline status updates |
| `src/components/screens/FtaTracker.jsx` | FTA-only task tracking with FTA-specific status |

---

## AddTask

### Responsibility
Guide the user through a three-step form to create a new task.

### Steps

| Step | Content |
|------|---------|
| **1 — Category** | Pick the service category (VAT, CT, Audit, Accounting, MIS, EInv, Refund, Other) |
| **2 — Task Type** | Pick a task type within the category (loaded from categories in `AppContext`) |
| **3 — Details** | Fill in: client, assigned user, due date, notes, FTA flag, recurring toggle |

### Optional Fields

| Field | Description |
|-------|-------------|
| FTA Flag | Marks the task as FTA-relevant; reveals FTA sub-fields |
| Recurring | Enables recurrence settings (frequency, interval) |
| Notes / Instructions | Free text for the assignee |

### On Submit

```
Collect form state
  → taskService.create(payload)
    → POST /api/tasks
      → Task created + audit log written + creation notification dispatched
        → Navigate to /tasks
```

---

## TaskList

### Responsibility
Display all tasks in a filterable, paginated table. Support inline status changes without page reload.

### Filters

| Filter | Options |
|--------|---------|
| Category | All, VAT, CT, Audit, Accounting, MIS, EInv, Refund, Other |
| Scope | All, Mine (assigned to current user) |
| Month | Calendar month picker |

### Table Columns

| Column | Description |
|--------|-------------|
| Task ID | `FB/YYYY/T001` format |
| Client | Client legal name |
| Category | Translated category label |
| Task Type | Service type |
| Assigned To | Team member name |
| Due Date | `YYYY-MM-DD` |
| Overdue | Days past due (highlighted red if > 0) |
| Status | `StatusPill` with inline dropdown to change |
| Actions | Edit / Delete |

### Inline Status Update Flow

```
User selects new status in dropdown
  → useTasks().updateStatus(id, label)
    → Optimistic UPDATE_TASK_STATUS dispatch (UI updates immediately)
    → PATCH /api/tasks/:id/status
      → Server confirms
        → Second UPDATE_TASK_STATUS dispatch with canonical value
```

---

## FtaTracker

### Responsibility
Show only tasks flagged as FTA-relevant and allow FTA-specific status management.

### Differences from TaskList

| Feature | TaskList | FtaTracker |
|---------|----------|------------|
| Data source | `/api/tasks` | `/api/tasks/fta-tracker` |
| Status field | Task status | FTA status |
| Extra column | — | `Additional Query From FTA` row highlight |
| Inline update | `updateStatus` | `updateFtaStatus` |

### FTA Statuses

| Display | API |
|---------|-----|
| `In Review` | `in_review` |
| `Additional Query From FTA` | `additional_query` |
| `Approved` | `approved` |

Rows with `Additional Query From FTA` status are visually highlighted (orange/amber row) to draw immediate attention.

---

## Backend Endpoints Used

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| `GET` | `/api/tasks` | Yes | All |
| `POST` | `/api/tasks` | Yes | Admin, Manager |
| `PUT` | `/api/tasks/:id` | Yes | Admin, Manager |
| `DELETE` | `/api/tasks/:id` | Yes | Admin |
| `PATCH` | `/api/tasks/:id/status` | Yes | All |
| `GET` | `/api/tasks/fta-tracker` | Yes | All |
| `PATCH` | `/api/tasks/:id/fta-status` | Yes | All |
| `GET` | `/api/tasks/export` | Yes | All |

---

## Dependencies

| Dependency | Used For |
|-----------|---------|
| `useTasks` | Fetch, create, update status, FTA status, export |
| `useClients` | Client dropdown in AddTask |
| `useUsers` | Assigned-user dropdown in AddTask |
| `categoryService` | Category + task type lists |
| `AppContext` | Cached tasks + FTA items |
