# Module 03 — Shared Resource State (AppContext)

## Overview

`AppContext` is the global frontend state store for all shared business resources. It holds the data consumed by multiple screens and is updated exclusively through dispatched actions from custom hooks. No screen writes to it directly.

---

## Primary File

| File | Role |
|------|------|
| `src/context/AppContext.jsx` | Reducer-based context providing state and dispatch |

---

## Responsibilities

- Hold normalized UI-friendly snapshots of: clients, tasks, users, groups, FTA items, categories, notifications, and dashboard stats
- Track per-resource loading and error states
- Accept dispatch actions from hooks to update state
- Provide a categories seed so the UI can paint immediately before the API call resolves

---

## State Shape

| Key | Type | Description |
|-----|------|-------------|
| `clients` | Array | Flat mapped client records |
| `tasks` | Array | Flat mapped task records |
| `users` | Array | User list from `/api/users` |
| `groups` | Array | Client group records |
| `ftaItems` | Array | FTA-scoped task subset |
| `categories` | Array | Category + task-type records (pre-seeded) |
| `notifications` | Array | Notification items for the bell panel |
| `unreadCount` | Number | Count of unread notifications |
| `activity` | Array | Recent activity entries for Dashboard |
| `dashboardStats` | Object \| null | Stats payload from `/api/reports/dashboard-stats` |
| `loading` | Object | `{ [resource]: Boolean }` per-resource loading flags |
| `errors` | Object | `{ [resource]: Error }` per-resource error values |

---

## Dispatch Actions

| Action Type | Payload | Effect |
|-------------|---------|--------|
| `SET_RESOURCE` | `{ resource, payload }` | Replace array for a named resource, clear loading + error |
| `SET_DASHBOARD` | `{ payload }` | Set `dashboardStats` + extract `recentActivity` → `activity` |
| `SET_LOADING` | `{ resource, value }` | Set loading flag for a named resource |
| `SET_ERROR` | `{ resource, error }` | Set error for a named resource, clear loading |
| `UPDATE_TASK_STATUS` | `{ id, status, displayStatus }` | Patch a single task's status in the `tasks` array (optimistic) |
| `UPDATE_FTA_STATUS` | `{ id, status, displayStatus }` | Patch a single FTA item's status in `ftaItems` (optimistic) |

---

## Category Seed

`AppContext` initializes `categories` with a hardcoded seed before the API responds:

| ID | Name | Color | Example Task Types |
|----|------|-------|--------------------|
| `vat` | VAT | `#0ea5e9` | VAT Return, VAT Refund, VAT Registration |
| `ct` | CT | `#7c3aed` | CT Return, CT Registration, Transfer Pricing |
| `audit` | Audit | `#dc2626` | Statutory Audit, Internal Audit, Due Diligence |
| `accounting` | Accounting | `#059669` | Monthly Accounting, Bookkeeping, Payroll |
| `mis` | MIS | `#0891b2` | Monthly MIS, Dashboard Preparation |
| `einvoicing` | EInv | `#ea580c` | E-Invoicing Setup, Portal Updation |
| `refund` | Refund | `#0ea5e9` | VAT Refund Application, Follow-up |
| `other` | Other | `#64748b` | ESR Notification, UBO Registration, Custom Task |

---

## Exposed Hook

```js
const { state, dispatch } = useApp();
```

- `state` — full state tree
- `dispatch` — reducer dispatcher

---

## Dependencies

| Dependency | Source |
|-----------|--------|
| Populated by | `useClients`, `useTasks`, `useUsers`, `useNotifications` hooks |
| Read by | All screen modules |
| Seeded by | Hardcoded `categoriesSeed` constant |
