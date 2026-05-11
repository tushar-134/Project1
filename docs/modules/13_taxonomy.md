# Module 13 — Taxonomy (Categories)

## Overview

The Taxonomy module manages the two-level classification system used throughout the application: **Categories** (top-level service areas) and **Task Types** (services within each category). This data drives task creation dropdowns and dashboard groupings.

---

## Primary File

| File | Role |
|------|------|
| `src/components/screens/Categories.jsx` | Admin/manager UI for managing categories and task types |

---

## Responsibilities

- List all categories with their active task types
- Create new categories
- Add task types to an existing category
- Delete task types from a category
- Delete a whole category

---

## UI Sections

### Category List

Displays all categories in a card/tile layout. Each tile shows:
- Category name and icon
- Color indicator
- List of active task types

### Add Category Button

Opens an inline or modal form:

| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Category display name |
| Description | Text | Short description |
| Icon | Select | Lucide icon name |
| Color | Color picker | Hex color for the tile |

On submit: `categoryService.create(payload)` → `POST /api/categories`

### Add Task Type

Within each category tile, an "Add Type" control:

| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Task type name |

On submit: `categoryService.addTaskType(categoryId, name)` → `POST /api/categories/:id/task-types`

### Delete Task Type

Each task type has a delete icon.

On click: `categoryService.removeTaskType(categoryId, typeId)` → `DELETE /api/categories/:id/task-types/:typeId`

---

## Seeded vs. API Categories

`AppContext` preloads an 8-category seed so the task creation screen renders immediately. When `Categories.jsx` opens, it fetches live data from the API and overwrites the seed in `AppContext`.

---

## Backend Endpoints Used

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| `GET` | `/api/categories` | Yes | All |
| `POST` | `/api/categories` | Yes | Admin, Manager |
| `PUT` | `/api/categories/:id` | Yes | Admin, Manager |
| `DELETE` | `/api/categories/:id` | Yes | Admin |
| `POST` | `/api/categories/:id/task-types` | Yes | Admin, Manager |
| `DELETE` | `/api/categories/:id/task-types/:typeId` | Yes | Admin, Manager |

---

## Dependencies

| Dependency | Used For |
|-----------|---------|
| `categoryService` | All CRUD and task-type operations |
| `AppContext` | Read and update the `categories` resource |
