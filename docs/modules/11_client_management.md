# Module 11 — Client Management

## Overview

The Client Management module covers the full lifecycle of client records: creating detailed client profiles, listing and searching existing clients, and importing clients in bulk via spreadsheet. It is the most data-rich module in the frontend, mapping complex nested backend schemas to a multi-tab form UI.

---

## Primary Files

| File | Role |
|------|------|
| `src/components/screens/AddClient.jsx` | Multi-tab form for creating or editing a client |
| `src/components/screens/ClientList.jsx` | Searchable, paginated client table with actions |
| `src/components/screens/BulkUpload.jsx` | Spreadsheet import flow |

---

## AddClient

### Responsibility
Build a complete client record through a tabbed form and send it to the backend.

### Form Tabs

| Tab | Fields |
|-----|--------|
| **Basic Info** | Legal name, client type, jurisdiction, trade name |
| **Address** | Registered address (street, city, emirate, country, PO Box) |
| **Contacts** | Multiple contact persons — name, mobile, email, designation; one marked primary |
| **Licences** | Multiple trade licences — number, authority, issue/expiry dates |
| **VAT** | TRN number, registration date, filing frequency, scheme |
| **CT** | CT registration number, registration date |
| **Portal Logins** | Portal name, URL, username, password (for client-facing portals) |
| **Custom Fields** | Key-value pairs for firm-specific metadata |

### On Submit
- Assembles the nested payload matching the `Client` Mongoose schema
- Calls `clientService.create(payload)` (new) or `clientService.update(id, payload)` (edit)
- On success: resets form and navigates to `/clients`

### Supporting Lookups (loaded on mount)
- `useUsers().fetchUsers()` — for assigning a relationship manager
- `groupService.list()` — for assigning a group

---

## ClientList

### Responsibility
Display all clients in a searchable, filterable, paginated table.

### Features

| Feature | Description |
|---------|-------------|
| Search | Filter by client name substring |
| Pagination | Page through large client sets |
| Sort | Sort by name, type, or date |
| Export | Calls `clientService.export()`, downloads CSV/Excel blob |
| Delete | Calls `clientService.remove(id)` with confirmation dialog |
| Edit | Link to `AddClient.jsx` pre-populated with the record |
| Attachment | Upload/delete file attachments per client |

### Table Columns

| Column | Source Field |
|--------|-------------|
| Client Name | `client.name` (from `mapClient`) |
| Type | `client.type` |
| Jurisdiction | `client.jurisdiction` |
| Group | `client.group` |
| VAT TRN | `client.vatTrn` |
| Primary Contact | `client.contact` |
| Actions | Edit / Delete / Attach |

---

## BulkUpload

### Responsibility
Accept a spreadsheet file, preview parsed rows, and submit them as a batch import.

### Flow

```
User selects file (CSV/XLSX)
  → Parse rows client-side into preview table
  → User reviews rows
  → Click "Upload"
    → clientService.bulkUpload(rows)
      → POST /api/clients/bulk-upload
        → Server validates + inserts
          → Returns { created, skipped, errors }
            → UI shows result summary
```

---

## Backend Endpoints Used

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| `GET` | `/api/clients` | Yes | All |
| `POST` | `/api/clients` | Yes | Admin, Manager |
| `GET` | `/api/clients/:id` | Yes | All |
| `PUT` | `/api/clients/:id` | Yes | Admin, Manager |
| `DELETE` | `/api/clients/:id` | Yes | Admin |
| `GET` | `/api/clients/export` | Yes | All |
| `POST` | `/api/clients/bulk-upload` | Yes | Admin, Manager |
| `POST` | `/api/clients/:id/attachments` | Yes | All |
| `DELETE` | `/api/clients/:id/attachments/:attachId` | Yes | All |

---

## Dependencies

| Dependency | Used For |
|-----------|---------|
| `useClients` | Fetch, create, update, delete, export |
| `useUsers` | Assign relationship manager |
| `groupService` | Group assignment dropdown |
| `AppContext` | Read cached clients list |
