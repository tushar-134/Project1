# Module 14 — User Management

## Overview

The User Management module provides admin-only controls for maintaining the list of application users: creating accounts, editing profile information, changing roles, toggling activation, and deleting users.

---

## Primary File

| File | Role |
|------|------|
| `src/components/screens/Users.jsx` | Admin-only user maintenance screen |

---

## Responsibilities

- List all registered application users with their roles and status
- Create new user accounts
- Edit existing user information
- Change a user's role
- Activate or deactivate a user account
- Delete a user

---

## UI Layout

### User Table

| Column | Description |
|--------|-------------|
| Name | Full name |
| Email | Login email address |
| Role | Current role with badge color |
| Status | Active / Inactive toggle |
| Actions | Edit / Change Role / Delete |

### Add / Edit User Form (Modal or Inline)

| Field | Type | Description |
|-------|------|-------------|
| Full Name | Text | Display name |
| Email | Email | Login credential |
| Password | Password | Set on create; blank = no change on edit |
| Role | Select | `admin`, `manager`, `task_only` |

---

## Roles

| Role | Access Level |
|------|-------------|
| `admin` | Full access — can manage users, delete records, view all reports |
| `manager` | Operational access — can create clients, tasks, categories, groups |
| `task_only` | Restricted — can only view and update task statuses assigned to them |

---

## Actions and API Calls

| Action | Hook / Service | Endpoint |
|--------|---------------|----------|
| Load users | `useUsers().fetchUsers()` | `GET /api/users` |
| Create user | `userService.create(payload)` | `POST /api/users` |
| Edit user | `userService.update(id, payload)` | `PUT /api/users/:id` |
| Change role | `useUsers().updateRole(id, role)` | `PATCH /api/users/:id/role` |
| Activate/deactivate | `useUsers().updateStatus(id, isActive)` | `PATCH /api/users/:id/status` |
| Delete | `useUsers().deleteUser(id)` | `DELETE /api/users/:id` |

---

## Access Control

### Frontend
- `Sidebar.jsx` only shows the "Users" link when `currentUser.role === 'admin'`
- The route can be hidden for non-admins but the backend is the authoritative guard

### Backend
- All `/api/users` routes require `authMiddleware` + `adminOnly` role middleware
- A non-admin request returns `403 Forbidden` regardless of the frontend state

---

## Backend Endpoints Used

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| `GET` | `/api/users` | Yes | Admin only |
| `POST` | `/api/users` | Yes | Admin only |
| `PUT` | `/api/users/:id` | Yes | Admin only |
| `PATCH` | `/api/users/:id/role` | Yes | Admin only |
| `PATCH` | `/api/users/:id/status` | Yes | Admin only |
| `DELETE` | `/api/users/:id` | Yes | Admin only |

---

## Dependencies

| Dependency | Used For |
|-----------|---------|
| `useUsers` | All user operations and state management |
| `Toggle` UI component | Activate/deactivate switch |
| `AppContext` | Cached users state |
