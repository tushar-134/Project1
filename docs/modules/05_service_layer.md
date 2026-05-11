# Module 05 — Frontend Service Layer

## Overview

The Service Layer forms the HTTP boundary between the frontend hooks/screens and the backend API. Each service file groups API calls by business domain, keeping endpoint strings and response shaping out of components and contexts.

All services are built on top of the shared `api.js` axios client, which handles auth headers and session invalidation automatically.

---

## Primary Files

| File | Domain |
|------|--------|
| `src/services/authService.js` | Authentication |
| `src/services/clientService.js` | Client management |
| `src/services/taskService.js` | Task management |
| `src/services/userService.js` | User management |
| `src/services/categoryService.js` | Categories & task types |
| `src/services/groupService.js` | Client groups |
| `src/services/reportService.js` | Dashboard & report data |
| `src/services/notificationService.js` | Notifications |

---

## authService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `login(email, password)` | POST | `/auth/login` | Returns `{ token, user }` |
| `logout()` | POST | `/auth/logout` | Ends server-side session |
| `me()` | GET | `/auth/me` | Validates token and returns user |
| `changePassword(payload)` | PUT | `/auth/change-password` | Updates own password |

---

## clientService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list(params)` | GET | `/clients` | Paginated/filtered client list |
| `get(id)` | GET | `/clients/:id` | Single client record |
| `create(payload)` | POST | `/clients` | Create new client |
| `update(id, payload)` | PUT | `/clients/:id` | Update client |
| `remove(id)` | DELETE | `/clients/:id` | Delete client |
| `bulkUpload(rows)` | POST | `/clients/bulk-upload` | Import rows from spreadsheet |
| `export()` | GET | `/clients/export` | Blob download of client CSV/Excel |
| `uploadAttachment(id, formData)` | POST | `/clients/:id/attachments` | Upload file attachment |
| `deleteAttachment(id, attachId)` | DELETE | `/clients/:id/attachments/:attachId` | Remove attachment |

---

## taskService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list(params)` | GET | `/tasks` | Filtered task list |
| `get(id)` | GET | `/tasks/:id` | Single task |
| `create(payload)` | POST | `/tasks` | Create task |
| `update(id, payload)` | PUT | `/tasks/:id` | Update task |
| `remove(id)` | DELETE | `/tasks/:id` | Delete task |
| `updateStatus(id, status)` | PATCH | `/tasks/:id/status` | Change task status |
| `ftaTracker(params)` | GET | `/tasks/fta-tracker` | FTA-scoped task list |
| `updateFtaStatus(id, ftaStatus)` | PATCH | `/tasks/:id/fta-status` | Update FTA sub-status |
| `export(params)` | GET | `/tasks/export` | Blob download of task export |

---

## userService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list()` | GET | `/users` | List all users |
| `get(id)` | GET | `/users/:id` | Single user |
| `create(payload)` | POST | `/users` | Create user (admin only) |
| `update(id, payload)` | PUT | `/users/:id` | Update user details |
| `updateRole(id, role)` | PATCH | `/users/:id/role` | Change user role |
| `updateStatus(id, isActive)` | PATCH | `/users/:id/status` | Activate/deactivate |
| `remove(id)` | DELETE | `/users/:id` | Delete user |

---

## categoryService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list()` | GET | `/categories` | All categories |
| `create(payload)` | POST | `/categories` | Create category |
| `update(id, payload)` | PUT | `/categories/:id` | Update category |
| `remove(id)` | DELETE | `/categories/:id` | Delete category |
| `addTaskType(id, name)` | POST | `/categories/:id/task-types` | Add task type |
| `removeTaskType(id, typeId)` | DELETE | `/categories/:id/task-types/:typeId` | Remove task type |

---

## groupService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list()` | GET | `/groups` | All groups |
| `create(payload)` | POST | `/groups` | Create group |
| `update(id, payload)` | PUT | `/groups/:id` | Rename/edit group |
| `updateClients(id, payload)` | PATCH | `/groups/:id/clients` | Update client membership |
| `remove(id)` | DELETE | `/groups/:id` | Delete group |

---

## reportService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `dashboardStats(params)` | GET | `/reports/dashboard-stats` | KPI data for Dashboard |
| `loginActivity()` | GET | `/reports/login-activity` | User login history |
| `taskActivity()` | GET | `/reports/task-activity` | Task creation/status history |
| `clientWise()` | GET | `/reports/client-wise` | Task rollup per client |
| `userWise()` | GET | `/reports/user-wise` | Task rollup per user |
| `overdue()` | GET | `/reports/overdue` | Overdue task list |
| `ftaTracker()` | GET | `/reports/fta-tracker` | FTA summary for reports |

---

## notificationService

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list()` | GET | `/notifications` | All notifications for current user |
| `markAllRead()` | PATCH | `/notifications/mark-all-read` | Mark all as read |
| `markRead(id)` | PATCH | `/notifications/:id/read` | Mark one as read |

---

## Design Principles

- **Domain isolation**: Each file only knows about its own domain's endpoints
- **No business logic**: Services only prepare requests and return raw responses — transformation happens in hooks or adapters
- **Blob support**: `clientService.export` and `taskService.export` set `responseType: 'blob'` so browsers can trigger file downloads
