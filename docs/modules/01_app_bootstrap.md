# Module 01 — App Bootstrap

## Overview

The App Bootstrap module is the entry point of the entire React application. It is responsible for mounting global providers, registering the client-side route tree, and wrapping all authenticated screens behind a route protection shell.

---

## Primary File

| File | Role |
|------|------|
| `src/main.jsx` | React root — mounts providers and declares routes |

---

## Responsibilities

- Start the React application via `ReactDOM.createRoot`
- Mount global context providers in the correct nesting order
- Define the URL-to-screen mapping using React Router v6
- Apply `ProtectedRoute` to every authenticated screen
- Ensure the `Toaster` (toast notification system) is globally available

---

## Provider Mounting Order

```
<AuthProvider>
  <AppProvider>
    <BrowserRouter>
      <Toaster />
      <Routes>
        ...
      </Routes>
    </BrowserRouter>
  </AppProvider>
</AuthProvider>
```

---

## Route-to-Screen Mapping

| Path | Screen Component | Protected |
|------|-----------------|-----------|
| `/login` | `Login.jsx` | No |
| `/` | `Dashboard.jsx` | Yes |
| `/clients` | `ClientList.jsx` | Yes |
| `/clients/add` | `AddClient.jsx` | Yes |
| `/clients/bulk-upload` | `BulkUpload.jsx` | Yes |
| `/tasks` | `TaskList.jsx` | Yes |
| `/tasks/add` | `AddTask.jsx` | Yes |
| `/tasks/fta-tracker` | `FtaTracker.jsx` | Yes |
| `/categories` | `Categories.jsx` | Yes |
| `/users` | `Users.jsx` | Yes |
| `/groups` | `ClientGroups.jsx` | Yes |
| `/reports` | `Reports.jsx` | Yes |

---

## Key Behaviors

- **Protected Routes**: All screens except `/login` are wrapped in `ProtectedRoute`, which reads `isAuthenticated` from `AuthContext` and redirects unauthenticated users to `/login`.
- **Layout Shell**: Authenticated screens are nested inside `Layout.jsx`, giving them the sidebar and top bar automatically.
- **Session Restore**: Because `AuthProvider` is mounted at the root, it runs `authService.me()` on every page load to verify the stored JWT before rendering any screen.

---

## Dependencies

| Dependency | Used For |
|-----------|----------|
| `AuthContext` / `AuthProvider` | Session state |
| `AppContext` / `AppProvider` | Shared resource state |
| `ProtectedRoute` | Route-level auth guards |
| `Layout.jsx` | Authenticated shell layout |
| `react-hot-toast` (`Toaster`) | Global toast notifications |

---

## Data Flow

```
Browser navigate → React Router match → ProtectedRoute check → AuthContext.isAuthenticated
  → true  → Layout + Screen rendered
  → false → redirect to /login
```
