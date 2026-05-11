# Module 06 — Frontend Hooks

## Overview

The Hook modules encapsulate all resource-fetch and state-update logic between the screen components and the service layer. Each hook is responsible for one domain, loads data via its corresponding service, transforms it via adapters, and dispatches the result into `AppContext`.

---

## Primary Files

| File | Domain |
|------|--------|
| `src/hooks/useClients.js` | Client data |
| `src/hooks/useTasks.js` | Task and FTA data |
| `src/hooks/useUsers.js` | User data |
| `src/hooks/useNotifications.js` | Notification data |

---

## useClients

**Source**: `src/hooks/useClients.js`

| Exported Function | Description |
|-------------------|-------------|
| `fetchClients(params)` | Fetches client list, maps via `mapClient()`, dispatches `SET_RESOURCE` into AppContext |
| `getClient` | Direct alias to `clientService.get` |
| `createClient` | Direct alias to `clientService.create` |
| `updateClient` | Direct alias to `clientService.update` |
| `deleteClient` | Direct alias to `clientService.remove` |
| `bulkUpload` | Direct alias to `clientService.bulkUpload` |
| `exportClients` | Direct alias to `clientService.export` |

**State managed**: Sets `AppContext.state.clients` on fetch.  
**Error handling**: Dispatches `SET_ERROR` if the fetch fails.  
**Loading**: Dispatches `SET_LOADING` before fetch, cleared automatically by `SET_RESOURCE`.

---

## useTasks

**Source**: `src/hooks/useTasks.js`

| Exported Function | Description |
|-------------------|-------------|
| `fetchTasks(params)` | Fetches tasks, maps via `mapTask()`, dispatches `SET_RESOURCE` for `tasks` |
| `fetchFtaTracker(params)` | Fetches FTA tasks, maps via `mapFtaTask()`, dispatches `SET_RESOURCE` for `ftaItems` |
| `createTask` | Alias to `taskService.create` |
| `updateTask` | Alias to `taskService.update` |
| `updateStatus(id, label)` | Optimistic UI update then confirms with server — see table below |
| `updateFtaStatus(id, label)` | Optimistic FTA status update then confirms with server |
| `exportTasks` | Alias to `taskService.export` |

**Optimistic status update flow** (`updateStatus`):

```
1. Dispatch UPDATE_TASK_STATUS (optimistic) → UI updates immediately
2. Call taskService.updateStatus(id, api_status_value)
3. Server returns canonical status → dispatch UPDATE_TASK_STATUS again with confirmed value
```

**Status label → API value mapping** (via `adapterUtils`):

| Display Label | API Value |
|---------------|-----------|
| `Not Started` | `not_started` |
| `In Progress` | `in_progress` |
| `Completed` | `completed` |
| `On Hold` | `on_hold` |

---

## useUsers

**Source**: `src/hooks/useUsers.js`

| Exported Function | Description |
|-------------------|-------------|
| `fetchUsers()` | Fetches user list, dispatches `SET_RESOURCE` for `users` |
| `updateRole(id, role)` | Calls `userService.updateRole`, re-fetches users |
| `updateStatus(id, isActive)` | Calls `userService.updateStatus`, re-fetches users |
| `deleteUser(id)` | Calls `userService.remove`, re-fetches users |

---

## useNotifications

**Source**: `src/hooks/useNotifications.js`

| Exported Function | Description |
|-------------------|-------------|
| `fetchNotifications()` | Fetches notification list, dispatches `SET_RESOURCE` for `notifications` and updates `unreadCount` |
| `markAllRead()` | Calls `notificationService.markAllRead`, re-fetches |
| `markRead(id)` | Calls `notificationService.markRead`, re-fetches |

---

## Common Pattern

All hooks follow this pattern:

```
Hook called by screen
  → dispatch SET_LOADING
  → service.apiCall()
    → adapterUtils.mapXxx() (where needed)
      → dispatch SET_RESOURCE / UPDATE_xxx
        → AppContext state updated
          → All subscribed screens re-render
```

---

## Dependencies

| Hook | Service | Adapter Used |
|------|---------|-------------|
| `useClients` | `clientService` | `mapClient` |
| `useTasks` | `taskService` | `mapTask`, `mapFtaTask`, `statusToApi`, `statusFromApi`, `ftaStatusToApi` |
| `useUsers` | `userService` | None |
| `useNotifications` | `notificationService` | None |
