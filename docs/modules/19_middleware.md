# Module 19 — Middleware

## Overview

The Middleware module contains all cross-cutting request concerns. Middleware functions are applied at the route level to enforce authentication, authorization, file upload handling, and standardized error responses.

---

## Primary Files

| File | Role |
|------|------|
| `server/middleware/authMiddleware.js` | Verify JWT, attach `req.user` |
| `server/middleware/roleMiddleware.js` | Enforce role-based access control |
| `server/middleware/uploadMiddleware.js` | Process multipart file uploads via AWS S3 |
| `server/middleware/errorMiddleware.js` | Return standardized JSON error responses |

---

## authMiddleware

**Source**: `server/middleware/authMiddleware.js`

### Responsibility
Verify the JWT from the `Authorization` header and attach the resolved user to `req.user`.

### Logic

```
1. Read Authorization header
2. Extract token (expect "Bearer <token>" format)
3. If no token → 401 "Not authorized"
4. jwt.verify(token, JWT_SECRET) → decode payload
5. User.findById(decoded.id).select('-password')
6. If user not found or isActive === false → 401 "User inactive or not found"
7. Set req.user = user
8. Call next()
```

### Applied to
All protected routes (every route except `POST /api/auth/login`)

---

## roleMiddleware

**Source**: `server/middleware/roleMiddleware.js`

### Responsibility
Check that `req.user.role` is in the list of allowed roles.

### Exported Values

| Export | Allowed Roles | Used On |
|--------|-------------|---------|
| `requireRoles(...roles)` | Custom | Generates a middleware for any role set |
| `adminOnly` | `admin` | User management routes |
| `adminManager` | `admin`, `manager` | Client, task creation/delete routes |

### Logic

```
If req.user.role not in allowed list → 403 "Forbidden"
Otherwise → call next()
```

---

## uploadMiddleware

**Source**: `server/middleware/uploadMiddleware.js`

### Responsibility
Accept `multipart/form-data` file uploads and write them directly to AWS S3 when S3 env vars are configured.

### Setup
- Uses `multer` with a custom S3 storage adapter
- S3 key prefix: `AWS_S3_UPLOAD_PREFIX`, defaulting to `filing-buddy`
- Content type is preserved from the uploaded file
- File size limit: **10 MB**

### Applied to
`POST /api/clients/:id/attachments`

### Why direct-to-S3?
Files never touch local disk, so the server stays stateless and compatible with container deployments.
Document reads use `/api/files/signed-url`, which authenticates the user, verifies
the file is referenced by a client/task record, and returns a short-lived S3
pre-signed URL for browser display.

---

## errorMiddleware

**Source**: `server/middleware/errorMiddleware.js`

### Exported Functions

| Function | Triggers On | Response |
|---------|------------|---------|
| `notFound` | Any request that doesn't match a route | `404 { message: "Route not found" }` |
| `errorMiddleware` | Any thrown/unhandled error | `{ message, stack (dev only) }` with appropriate status code |

### Applied to
Mounted last in `server.js` after all route modules.

---

## Middleware Application Order per Request

```
Request arrives
  → CORS + Helmet (global, before routes)
  → Rate Limiter (global)
  → Route match
    → authMiddleware (per-route)
    → roleMiddleware (per-route, where applicable)
    → uploadMiddleware (per-route, only upload endpoints)
    → express-validator (per-route, request validation)
    → Controller
  → errorMiddleware (global, last)
```
