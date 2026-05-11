# Module 07 — Data Adapter

## Overview

The Data Adapter module converts raw MongoDB-shaped API responses into flatter, UI-friendly objects expected by the prototype-driven screen components. It also provides label translation maps between API enums and human-readable display strings.

---

## Primary File

| File | Role |
|------|------|
| `src/utils/adapterUtils.js` | Mapping functions, label dictionaries, blob download helper |

---

## Status Label Mappings

### Task Status

| Display Label | API Value |
|---------------|-----------|
| `Not Yet Started` | `not_started` |
| `WIP` | `wip` |
| `Completed` | `completed` |
| `Submitted to FTA` | `submitted_to_fta` |

`statusToApi` — converts display → API value (used when sending updates)  
`statusFromApi` — converts API value → display label (used when rendering)

---

### FTA Status

| Display Label | API Value |
|---------------|-----------|
| `In Review` | `in_review` |
| `Additional Query From FTA` | `additional_query` |
| `Approved` | `approved` |

`ftaStatusToApi` — display → API  
`ftaStatusFromApi` — API → display

---

## Functions

### `mapClient(client)`

Converts a raw Mongoose `Client` document into the flat shape the screens use.

| Output Field | Source |
|-------------|--------|
| `id` | `client._id` |
| `name` | `client.legalName` |
| `type` | `"Natural Person"` / `"Legal Person"` from `clientType` |
| `jurisdiction` | Translated from enum (`mainland`, `freezone`, `designated_zone`, `offshore`) |
| `group` | `client.group.name` |
| `licence` | First trade licence number |
| `vatTrn` | `client.vatDetails.trn` |
| `contact` | Primary contact person's full name |
| `mobile` | First contact's country code + number |
| `email` | First contact's email |

---

### `mapTask(task)`

Converts a raw Mongoose `Task` document.

| Output Field | Source |
|-------------|--------|
| `id` | `task._id` |
| `taskId` | `task.taskId` (e.g. `FB/2024/T001`) |
| `client` | `task.client.legalName` |
| `clientId` | `task.client._id` |
| `category` | Translated category label |
| `type` | `task.taskType` |
| `dueDate` | ISO date trimmed to `YYYY-MM-DD` |
| `assigned` | `task.assignedTo.name` or `"Unassigned"` |
| `assignedId` | `task.assignedTo._id` |
| `status` | Translated display label via `statusFromApi` |
| `apiStatus` | Raw API enum value (kept for update calls) |
| `recurring` | `task.isRecurring` |
| `overdueDays` | Computed via `daysOverdue()` |

---

### `mapFtaTask(task)`

Extends `mapTask()` with FTA-specific fields:

| Output Field | Source |
|-------------|--------|
| `submitted` | `task.ftaSubmittedDate` or `task.createdAt` |
| `status` | FTA display label via `ftaStatusFromApi` |

---

### `mapCategory(category)`

| Output Field | Source |
|-------------|--------|
| `id` | `category._id` or `category.id` |
| `taskTypes` | Active task type names (filters out `isActive: false`) |
| `rawTaskTypes` | Full subdocument array (needed for delete operations using subdoc `_id`) |

---

### `daysOverdue(dueDate, status)`

Returns the number of days a task is past its due date.  
Returns `0` if the task is `completed` or has no due date.

---

### `downloadBlob(blob, filename)`

Triggers a browser file download from a `Blob` object (used after export API calls).

```
Create object URL → inject hidden anchor → click → revoke URL
```

---

## Used By

| Consumer | Functions Used |
|----------|---------------|
| `useClients` | `mapClient` |
| `useTasks` | `mapTask`, `mapFtaTask`, `statusToApi`, `statusFromApi`, `ftaStatusToApi` |
| `Categories.jsx` | `mapCategory` |
| Screen export handlers | `downloadBlob` |
