# Module 02 — Authentication

## Overview

The Authentication module manages user identity throughout the entire application lifecycle: login, session restoration on page refresh, route protection, and logout. It is the first provider mounted and is consumed by nearly every other module.

---

## Primary Files

| File | Role |
|------|------|
| `src/context/AuthContext.jsx` | Stateful provider exposing auth actions and user info |
| `src/services/authService.js` | HTTP calls to the auth API endpoints |
| `src/components/layout/ProtectedRoute.jsx` | Route guard that redirects unauthenticated users |
| `src/components/screens/Login.jsx` | Login form UI |

---

## Responsibilities

- Store and validate the JWT token
- Restore user session on page refresh by calling `/api/auth/me`
- Provide `currentUser`, `token`, `loading`, and `isAuthenticated` to consumers
- Expose `login()` and `logout()` actions
- Redirect unauthorized users to `/login`

---

## AuthContext — Exported Values

| Value | Type | Description |
|-------|------|-------------|
| `currentUser` | Object | The resolved user object from the API |
| `token` | String | JWT stored in `localStorage` key `filingBuddyToken` |
| `loading` | Boolean | `true` while the `/auth/me` check is in flight |
| `isAuthenticated` | Boolean | `true` when both token and user are set |
| `login(email, password)` | Async Function | Calls API, stores token+user, sets state |
| `logout()` | Async Function | Calls API logout, clears storage, redirects to `/login` |

---

## Session Restore Logic

On every page load (via `useEffect` on token change):

```
token exists in localStorage
  → call authService.me() → GET /api/auth/me
      → success → update currentUser in state + localStorage
      → failure → clear token + user from localStorage, set both to null
      → either way → setLoading(false)
```

---

## authService — API Methods

| Method | HTTP Call | Description |
|--------|-----------|-------------|
| `login(email, password)` | `POST /api/auth/login` | Returns `{ token, user }` |
| `logout()` | `POST /api/auth/logout` | Clears server-side session record |
| `me()` | `GET /api/auth/me` | Returns the current user from the active token |
| `changePassword(payload)` | `PUT /api/auth/change-password` | Updates user's own password |

---

## ProtectedRoute Behavior

- Reads `loading` and `isAuthenticated` from `useAuth()`
- While `loading === true`: renders nothing (prevents flicker)
- When `isAuthenticated === false`: redirects to `/login`
- When `isAuthenticated === true`: renders the child screen

---

## localStorage Keys

| Key | Value |
|-----|-------|
| `filingBuddyToken` | Raw JWT string |
| `filingBuddyUser` | JSON-serialized last resolved user object |

The user snapshot is stored so that the UI can paint user details immediately on reload while the `/auth/me` network call is still in flight.

---

## Backend Endpoints Used

| Method | Path | Auth Required |
|--------|------|--------------|
| `POST` | `/api/auth/login` | No |
| `POST` | `/api/auth/logout` | Yes |
| `GET` | `/api/auth/me` | Yes |
| `PUT` | `/api/auth/change-password` | Yes |

---

## Data Flow

```
Login.jsx
  → authService.login(email, password)
    → POST /api/auth/login
      → returns { token, user }
        → AuthContext stores both in state + localStorage
          → ProtectedRoute.isAuthenticated = true
            → Screens rendered
```
