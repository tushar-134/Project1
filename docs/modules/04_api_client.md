# Module 04 — API Client

## Overview

The API Client module is the single shared HTTP client (`axios` instance) used by every service module in the frontend. It handles base URL resolution, token injection, and automatic session invalidation on `401` responses.

---

## Primary File

| File | Role |
|------|------|
| `src/services/api.js` | Configured axios instance with interceptors |

---

## Responsibilities

- Resolve the correct API base URL from the environment variable `VITE_API_URL`
- Normalize `localhost` vs `127.0.0.1` inconsistencies during local development
- Automatically inject the `Authorization: Bearer <token>` header on every request
- On any `401` response, clear the stored session and redirect to `/login`

---

## Base URL Resolution

```
VITE_API_URL (default: http://localhost:5000/api)
  → Parse with URL constructor
  → If both the configured host AND the browser's current host are localhost/127.0.0.1
    → Normalize configured hostname to match the active browser hostname
  → Strip trailing slash
```

This prevents CORS mismatch when the developer opens the app on `127.0.0.1` but `.env` uses `localhost` (or vice versa).

---

## Request Interceptor

On every outgoing request:

```
Read localStorage.getItem("filingBuddyToken")
  → If present → set header: Authorization: Bearer <token>
  → If absent  → continue without header (public endpoints still work)
```

---

## Response Interceptor

On every API response:

```
2xx → pass through as-is
Non-2xx → reject promise
  401 specifically:
    → Remove "filingBuddyToken" from localStorage
    → Remove "filingBuddyUser" from localStorage
    → If not already on /login → window.location.assign("/login")
```

This ensures the UI never stays in a half-authenticated state after a token expires.

---

## Consumers

All service modules import and use this client:

| Service | File |
|---------|------|
| Auth Service | `src/services/authService.js` |
| Client Service | `src/services/clientService.js` |
| Task Service | `src/services/taskService.js` |
| User Service | `src/services/userService.js` |
| Category Service | `src/services/categoryService.js` |
| Group Service | `src/services/groupService.js` |
| Report Service | `src/services/reportService.js` |
| Notification Service | `src/services/notificationService.js` |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000/api` | Backend API base URL |
