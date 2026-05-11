# Module 09 — Reusable UI Components

## Overview

The Reusable UI module contains the shared presentational primitives used across all screen components. These components encapsulate consistent visual styles and keep screen files focused on business logic rather than repetitive class names or markup patterns.

---

## Primary Files

| File | Component | Purpose |
|------|-----------|---------|
| `src/components/ui/Button.jsx` | `Button` | Styled button with variants and loading state |
| `src/components/ui/Card.jsx` | `Card` | Content container with consistent padding and border |
| `src/components/ui/Badge.jsx` | `Badge` | Small label for roles, counts, and category tags |
| `src/components/ui/StatusPill.jsx` | `StatusPill` | Colored pill displaying a task or FTA status |
| `src/components/ui/Table.jsx` | `Table` | Shared table wrapper with consistent header/body styles |
| `src/components/ui/Toggle.jsx` | `Toggle` | Boolean on/off switch (used for user active status) |

---

## Component Details

### Button

| Prop | Type | Description |
|------|------|-------------|
| `variant` | `"primary"` \| `"secondary"` \| `"danger"` | Visual style |
| `size` | `"sm"` \| `"md"` \| `"lg"` | Size preset |
| `loading` | Boolean | Shows a spinner and disables the button |
| `disabled` | Boolean | Disables interaction |
| `onClick` | Function | Click handler |

Used by: all screen modules (form submissions, action triggers, export buttons)

---

### Card

| Prop | Type | Description |
|------|------|-------------|
| `title` | String | Optional card heading |
| `className` | String | Extra CSS classes for overrides |
| `children` | Node | Card body content |

Used by: Dashboard (KPI cards), AddClient (form sections), Reports (tile selectors)

---

### Badge

| Prop | Type | Description |
|------|------|-------------|
| `color` | String | Hex or CSS color |
| `children` | Node | Badge label text |

Used by: TopBar (role badge), Sidebar (section labels), Task/Client lists (category tags)

---

### StatusPill

| Prop | Type | Description |
|------|------|-------------|
| `status` | String | Display label (e.g. `"WIP"`, `"Completed"`) |

Internally maps display labels to background/text color combinations:

| Status | Color |
|--------|-------|
| `Not Yet Started` | Gray |
| `WIP` | Blue |
| `Completed` | Green |
| `Submitted to FTA` | Purple |
| `In Review` | Yellow |
| `Additional Query From FTA` | Orange |
| `Approved` | Green |

Used by: `TaskList.jsx`, `FtaTracker.jsx`, recent activity tables

---

### Table

A thin wrapper that applies consistent table styling: sticky header, row hover, border separators, and responsive horizontal scroll.

| Prop | Type | Description |
|------|------|-------------|
| `columns` | Array | Column definitions (header, key or render fn) |
| `data` | Array | Row data |
| `loading` | Boolean | Shows skeleton rows |
| `emptyText` | String | Message when data is empty |

Used by: ClientList, TaskList, FtaTracker, Users, Reports

---

### Toggle

| Prop | Type | Description |
|------|------|-------------|
| `checked` | Boolean | Current on/off state |
| `onChange` | Function | Toggle handler |
| `disabled` | Boolean | Prevents interaction |

Used by: `Users.jsx` (activate/deactivate user accounts)

---

## Design Rules

- No business logic in any of these components
- All data comes via props; components hold no internal state beyond UI interaction state (e.g., hover)
- Consumed by virtually every screen module
