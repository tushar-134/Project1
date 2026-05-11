# Module 08 — Layout

## Overview

The Layout module provides the consistent authenticated application shell: a fixed sidebar, a top bar with the current page title and user identity, and a notification panel triggered from the top bar bell icon. All authenticated screens are rendered inside this shell.

---

## Primary Files

| File | Role |
|------|------|
| `src/components/layout/Layout.jsx` | Outer shell: combines Sidebar + TopBar + page outlet |
| `src/components/layout/Sidebar.jsx` | Fixed vertical navigation menu |
| `src/components/layout/TopBar.jsx` | Horizontal bar with page title, user info, and notification bell |
| `src/components/layout/NotificationPanel.jsx` | Slide-in notification list panel |
| `src/components/layout/ProtectedRoute.jsx` | Auth guard that wraps all authenticated routes |

---

## Layout.jsx

**Responsibility**: Composes the three-panel authenticated shell.

- Renders `<Sidebar />` on the left (fixed width)
- Renders `<TopBar />` at the top of the content area
- Renders a `<main>` containing the React Router `<Outlet />` where screen content is injected
- Manages state for notification panel open/close and passes the toggle handler to `TopBar`

---

## Sidebar.jsx

**Responsibility**: Full-height vertical navigation for all authenticated screens.

**Navigation links** (with icons):

| Label | Path | Access |
|-------|------|--------|
| Dashboard | `/` | All roles |
| Clients | `/clients` | All roles |
| Tasks | `/tasks` | All roles |
| FTA Tracker | `/tasks/fta-tracker` | All roles |
| Categories | `/categories` | Admin / Manager |
| Users | `/users` | Admin only |
| Client Groups | `/groups` | All roles |
| Reports | `/reports` | All roles |

- Reads `currentUser` from `AuthContext` to conditionally hide admin-only links
- Highlights the active route using React Router's `NavLink`

---

## TopBar.jsx

**Responsibility**: Horizontal application bar shown above all screen content.

- Displays the current page title (derived from the route)
- Shows the logged-in user's name and role badge
- Bell icon showing `unreadCount` badge from `AppContext`
- Clicking the bell opens/closes the `NotificationPanel`
- Logout button that calls `AuthContext.logout()`

---

## NotificationPanel.jsx

**Responsibility**: Slide-in panel listing recent notifications.

- Reads `notifications` and `unreadCount` from `AppContext`
- Calls `useNotifications().fetchNotifications()` on open
- Each notification entry shows: type icon, message text, timestamp
- "Mark all read" button calls `notificationService.markAllRead()`
- Individual item click calls `notificationService.markRead(id)` and navigates to the related task

---

## ProtectedRoute.jsx

**Responsibility**: Route-level authentication gating.

```
Read useAuth().loading → show nothing if true (prevents flash)
Read useAuth().isAuthenticated
  → false → <Navigate to="/login" replace />
  → true  → render children
```

---

## Data Read By Layout Components

| Component | From AuthContext | From AppContext |
|-----------|----------------|----------------|
| `Sidebar` | `currentUser.role` | — |
| `TopBar` | `currentUser.name`, `logout()` | `unreadCount` |
| `NotificationPanel` | — | `notifications`, `unreadCount` |
| `ProtectedRoute` | `loading`, `isAuthenticated` | — |
