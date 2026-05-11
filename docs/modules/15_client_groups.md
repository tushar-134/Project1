# Module 15 — Client Groups

## Overview

The Client Groups module lets the firm organize clients under named group collections. Groups are displayed in the client list and can be used as a filter or organizational label, making it easier to handle clients that belong to the same holding company or family of businesses.

---

## Primary File

| File | Role |
|------|------|
| `src/components/screens/ClientGroups.jsx` | UI for creating, editing, and managing client groups |

---

## Responsibilities

- List all existing client groups with their member clients
- Create new groups
- Rename/edit existing groups
- Add or remove clients from a group
- Delete a group

---

## UI Layout

### Group List

Displays each group as a tile or row with:
- Group name
- Comma-separated list of member client names (or count)
- Edit and Delete action buttons

### Create / Edit Group Form

| Field | Type | Description |
|-------|------|-------------|
| Group Name | Text | Display name for the group |
| Clients | Multi-select | Pick from the full client list |

---

## Actions and API Calls

| Action | Service | Endpoint |
|--------|---------|----------|
| Load groups | `groupService.list()` | `GET /api/groups` |
| Create group | `groupService.create(payload)` | `POST /api/groups` |
| Edit/rename | `groupService.update(id, payload)` | `PUT /api/groups/:id` |
| Update members | `groupService.updateClients(id, payload)` | `PATCH /api/groups/:id/clients` |
| Delete group | `groupService.remove(id)` | `DELETE /api/groups/:id` |

### Why a separate `updateClients` call?
The membership list is handled through a dedicated `PATCH` route rather than a full `PUT` to avoid accidentally overwriting the group name when only membership changes.

---

## Relationship to Client Records

- In the backend, each `Client` document has an optional `group` ObjectId reference to a `ClientGroup`
- When a group's client membership is updated via `PATCH /api/groups/:id/clients`, the backend updates both the `ClientGroup.clients` array and each referenced `Client.group` field atomically
- In the client list table and `AddClient` form, the group name is displayed via the populated `client.group.name` field

---

## Backend Endpoints Used

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| `GET` | `/api/groups` | Yes | All |
| `POST` | `/api/groups` | Yes | Admin, Manager |
| `PUT` | `/api/groups/:id` | Yes | Admin, Manager |
| `PATCH` | `/api/groups/:id/clients` | Yes | Admin, Manager |
| `DELETE` | `/api/groups/:id` | Yes | Admin |

---

## Dependencies

| Dependency | Used For |
|-----------|---------|
| `groupService` | All group CRUD and membership operations |
| `clientService.list()` or AppContext clients | Populate client multi-select |
