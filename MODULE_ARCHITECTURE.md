# Filing Buddy Module Architecture

This document explains the major modules in the `Filing Buddy` codebase, what each module is responsible for, what functionality it contains, and how it connects to the rest of the system.

The goal is to help any developer quickly answer:

- What does this module do?
- Which files are part of it?
- What data does it consume and produce?
- Which other modules does it depend on?
- Which backend APIs or database models are involved?

---

## 1. System Overview

`Filing Buddy` is a full-stack practice management system for a UAE-based accounting firm.

It has two major application layers:

1. **Frontend**
   - React + React Router
   - Context API for auth and shared resource state
   - Axios service layer for API calls
   - Screen-driven UI modules

2. **Backend**
   - Node.js + Express
   - MongoDB with Mongoose
   - JWT-based authentication
   - Role-based authorization
   - Controllers, routes, middleware, and models

Data flow at a high level:

```text
Screen Component
  -> Hook
    -> Service
      -> api.js axios client
        -> Express Route
          -> Middleware
            -> Controller
              -> Mongoose Model
                -> MongoDB
```

---

## 2. Frontend Modules

## 2.1 Frontend App Bootstrap Module

**Primary file**
- [src/main.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/main.jsx)

**Responsibility**
- Starts the React app
- Mounts global providers
- Registers the route tree
- Wraps private routes in authentication and layout shells

**Main functionality**
- Mounts:
  - `AuthProvider`
  - `AppProvider`
  - `BrowserRouter`
  - `Toaster`
- Defines route-to-screen mapping
- Applies `ProtectedRoute` to restricted screens

**Connectivity**
- Uses `AuthContext` for identity/session state
- Uses `AppContext` for shared resource state
- Loads screen modules from `src/components/screens`
- Loads layout modules from `src/components/layout`

---

## 2.2 Authentication Module

**Primary files**
- [src/context/AuthContext.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/context/AuthContext.jsx)
- [src/services/authService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/authService.js)
- [src/components/layout/ProtectedRoute.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/layout/ProtectedRoute.jsx)
- [src/components/screens/Login.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Login.jsx)

**Responsibility**
- Handles login, logout, session restore, and route protection

**Main functionality**
- Stores JWT token in `localStorage`
- Stores the last resolved user snapshot in `localStorage`
- Calls `/api/auth/me` on refresh to validate the stored token
- Redirects unauthenticated users to `/login`
- Blocks users from screens they are not authorized to access
- Provides `currentUser`, `token`, `loading`, `isAuthenticated`, `login()`, `logout()`

**Connectivity**
- `Login.jsx` calls `authService.login()`
- `ProtectedRoute.jsx` reads `useAuth()`
- `api.js` injects token into outgoing requests
- Backend endpoints used:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`

---

## 2.3 Shared Resource State Module

**Primary file**
- [src/context/AppContext.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/context/AppContext.jsx)

**Responsibility**
- Central store for shared business resources used across screens

**Managed resources**
- `clients`
- `tasks`
- `users`
- `groups`
- `ftaItems`
- `categories`
- `notifications`
- `unreadCount`
- `activity`
- `dashboardStats`
- `loading`
- `errors`

**Main functionality**
- `SET_RESOURCE`
- `SET_DASHBOARD`
- `SET_LOADING`
- `SET_ERROR`
- `UPDATE_TASK_STATUS`
- `UPDATE_FTA_STATUS`

**Connectivity**
- Consumed by nearly every screen module
- Updated by custom hooks like `useClients`, `useTasks`, `useUsers`, `useNotifications`
- Initialized with a local category seed so the UI can render quickly even before category fetch completes

---

## 2.4 API Client Module

**Primary file**
- [src/services/api.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/api.js)

**Responsibility**
- Shared HTTP client for all frontend-to-backend communication

**Main functionality**
- Builds `baseURL` from `VITE_API_URL`
- Normalizes `localhost` and `127.0.0.1` during local development
- Adds `Authorization: Bearer <token>` header automatically
- On `401`, clears local session and redirects to `/login`

**Connectivity**
- Used by all service modules:
  - `authService`
  - `clientService`
  - `taskService`
  - `userService`
  - `categoryService`
  - `groupService`
  - `reportService`
  - `notificationService`

---

## 2.5 Frontend Service Layer Module

**Primary files**
- [src/services/clientService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/clientService.js)
- [src/services/taskService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/taskService.js)
- [src/services/userService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/userService.js)
- [src/services/categoryService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/categoryService.js)
- [src/services/groupService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/groupService.js)
- [src/services/reportService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/reportService.js)
- [src/services/notificationService.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/notificationService.js)

**Responsibility**
- Defines API methods grouped by business domain

**Main functionality**
- Client CRUD, bulk upload, export, attachments
- Task CRUD, status updates, FTA status updates, export
- User CRUD, role changes, activation changes
- Category CRUD and task type management
- Group CRUD and grouping operations
- Dashboard/report reads
- Notification reads and read-state updates

**Connectivity**
- Called by custom hooks and some screen-level handlers
- Built on top of `api.js`
- Mirrors backend route groups one-to-one

---

## 2.6 Frontend Hook Modules

**Primary files**
- [src/hooks/useClients.js](C:/Users/ritik/OneDrive/Desktop/project1/src/hooks/useClients.js)
- [src/hooks/useTasks.js](C:/Users/ritik/OneDrive/Desktop/project1/src/hooks/useTasks.js)
- [src/hooks/useUsers.js](C:/Users/ritik/OneDrive/Desktop/project1/src/hooks/useUsers.js)
- [src/hooks/useNotifications.js](C:/Users/ritik/OneDrive/Desktop/project1/src/hooks/useNotifications.js)

**Responsibility**
- Encapsulate resource-specific API calls and state updates

**Main functionality**
- Load API data
- Normalize API responses into UI-friendly shapes
- Dispatch updates into `AppContext`
- Provide screen-friendly functions such as:
  - `fetchClients`
  - `createTask`
  - `updateStatus`
  - `updateRole`
  - `markAllRead`

**Connectivity**
- Hook -> Service -> API
- Hook -> `AppContext.dispatch`
- Hook -> adapter utilities where needed

---

## 2.7 Data Adapter Module

**Primary file**
- [src/utils/adapterUtils.js](C:/Users/ritik/OneDrive/Desktop/project1/src/utils/adapterUtils.js)

**Responsibility**
- Converts backend Mongo-shaped data into the flatter UI shape expected by the prototype-driven screens

**Main functionality**
- `mapClient()`
- `mapTask()`
- `mapFtaTask()`
- `mapCategory()`
- status label conversion
- FTA status label conversion
- overdue day calculation
- blob download helper

**Connectivity**
- Used by hooks and some screen logic
- Sits between raw backend response objects and `AppContext`

---

## 2.8 Layout Module

**Primary files**
- [src/components/layout/Layout.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/layout/Layout.jsx)
- [src/components/layout/Sidebar.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/layout/Sidebar.jsx)
- [src/components/layout/TopBar.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/layout/TopBar.jsx)
- [src/components/layout/NotificationPanel.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/layout/NotificationPanel.jsx)

**Responsibility**
- Provides the consistent authenticated app shell

**Main functionality**
- Fixed sidebar
- Top bar with page title and user identity
- Notification panel
- Shared navigation across all authenticated screens
- Route outlet placement for screen content

**Connectivity**
- Reads from `AuthContext` for current user details
- Reads from `AppContext` for counts and notifications
- Uses notification hooks/services for bell panel behavior

---

## 2.9 Reusable UI Module

**Primary files**
- [src/components/ui/Button.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/ui/Button.jsx)
- [src/components/ui/Card.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/ui/Card.jsx)
- [src/components/ui/Badge.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/ui/Badge.jsx)
- [src/components/ui/StatusPill.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/ui/StatusPill.jsx)
- [src/components/ui/Table.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/ui/Table.jsx)
- [src/components/ui/Toggle.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/ui/Toggle.jsx)

**Responsibility**
- Shared presentational primitives for consistency and reuse

**Main functionality**
- Encapsulates common visual styles
- Keeps screens focused on business logic and layout rather than low-level class repetition

**Connectivity**
- Imported by nearly all screen modules
- No business logic of its own

---

## 2.10 Dashboard Module

**Primary file**
- [src/components/screens/Dashboard.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Dashboard.jsx)

**Responsibility**
- Presents high-level practice metrics and recent task activity

**Main functionality**
- Month picker
- KPI cards
- Category tile breakdown
- Recent activity table

**Connectivity**
- Calls `reportService.dashboardStats()`
- Writes dashboard payload into `AppContext`
- Depends on backend reports module:
  - `GET /api/reports/dashboard-stats`

---

## 2.11 Client Management Module

**Primary files**
- [src/components/screens/AddClient.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/AddClient.jsx)
- [src/components/screens/ClientList.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/ClientList.jsx)
- [src/components/screens/BulkUpload.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/BulkUpload.jsx)

**Responsibility**
- Create, list, search, import, and manage client records

**Main functionality**

### Add Client
- Multi-tab form
- Converts UI-friendly state into backend nested schema shape
- Builds:
  - registered address
  - contact persons
  - licences
  - VAT details
  - CT details
  - portal logins
  - custom fields

### Client List
- Fetch paginated client list
- Search/filter
- Export
- Delete client

### Bulk Upload
- Parse spreadsheet input
- Preview rows
- Submit array payload for import

**Connectivity**
- Uses:
  - `useClients`
  - `useUsers`
  - `groupService`
- Backend endpoints:
  - `/api/clients`
  - `/api/clients/export`
  - `/api/clients/bulk-upload`
  - `/api/clients/:id`

---

## 2.12 Task Management Module

**Primary files**
- [src/components/screens/AddTask.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/AddTask.jsx)
- [src/components/screens/TaskList.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/TaskList.jsx)
- [src/components/screens/FtaTracker.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/FtaTracker.jsx)

**Responsibility**
- Create tasks, monitor tasks, update task status, and track FTA-related workflows

**Main functionality**

### Add Task
- Three-step flow:
  - category selection
  - task type selection
  - task details
- Optional recurring configuration
- Optional FTA flagging

### Task List
- Filter by category, scope, and month
- Inline status changes
- Overdue display
- Export list

### FTA Tracker
- FTA-only task subset
- FTA status updates
- Highlight rows with `Additional Query From FTA`

**Connectivity**
- Uses:
  - `useTasks`
  - `useClients`
  - `useUsers`
  - `categoryService`
- Backend endpoints:
  - `/api/tasks`
  - `/api/tasks/:id/status`
  - `/api/tasks/fta-tracker`
  - `/api/tasks/:id/fta-status`
  - `/api/tasks/export`

---

## 2.13 Taxonomy Module

**Primary file**
- [src/components/screens/Categories.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Categories.jsx)

**Responsibility**
- Manages categories and task types used by task creation and reporting

**Main functionality**
- Category list
- Add task type
- Delete task type
- Create new category

**Connectivity**
- Uses `categoryService`
- Feeds task-creation workflows and dashboard category grouping
- Backend endpoints:
  - `/api/categories`
  - `/api/categories/:id/task-types`

---

## 2.14 User Management Module

**Primary file**
- [src/components/screens/Users.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Users.jsx)

**Responsibility**
- Admin-only user maintenance

**Main functionality**
- Load users
- Add user
- Edit user
- Change role
- Activate/deactivate user
- Delete user

**Connectivity**
- Uses `useUsers`
- Protected by frontend role guard and backend admin-only routes
- Backend endpoints:
  - `/api/users`
  - `/api/users/:id`
  - `/api/users/:id/role`
  - `/api/users/:id/status`
  - `/api/users/:id` (DELETE)

---

## 2.15 Client Group Module

**Primary file**
- [src/components/screens/ClientGroups.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/ClientGroups.jsx)

**Responsibility**
- Group clients under named collections

**Main functionality**
- Create group
- Edit group
- Remove group
- Display grouped client names

**Connectivity**
- Uses `groupService`
- Backend endpoints:
  - `/api/groups`
  - `/api/groups/:id`
  - `/api/groups/:id/clients`

---

## 2.16 Reports Module

**Primary file**
- [src/components/screens/Reports.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Reports.jsx)

**Responsibility**
- Presents administrative reports over task, user, client, and FTA data

**Main functionality**
- Report tile selection
- Dynamic report table
- Export behavior

**Connectivity**
- Uses `reportService`
- Backend endpoints:
  - `/api/reports/login-activity`
  - `/api/reports/task-activity`
  - `/api/reports/client-wise`
  - `/api/reports/user-wise`
  - `/api/reports/overdue`
  - `/api/reports/fta-tracker`

---

## 3. Backend Modules

## 3.1 Backend Bootstrap Module

**Primary file**
- [server/server.js](C:/Users/ritik/OneDrive/Desktop/project1/server/server.js)

**Responsibility**
- Starts the Express API
- Attaches global middleware
- Registers routes
- Connects to MongoDB
- Schedules cron notifications

**Main functionality**
- Loads env variables
- Configures CORS
- Configures Helmet
- Configures JSON body parsing
- Configures rate limiting
- Configures request logging in non-production
- Exposes `/api/health`
- Schedules daily overdue/due-soon notification logic

**Connectivity**
- Imports route modules
- Imports DB connector
- Imports task, user, notification, and email utilities for cron processing

---

## 3.2 Config Module

**Primary files**
- [server/config/db.js](C:/Users/ritik/OneDrive/Desktop/project1/server/config/db.js)
- [server/config/cloudinary.js](C:/Users/ritik/OneDrive/Desktop/project1/server/config/cloudinary.js)

**Responsibility**
- External system connection setup

**Main functionality**
- MongoDB connection bootstrap
- Cloudinary configuration for uploaded files

**Connectivity**
- `db.js` is consumed by `server.js`
- `cloudinary.js` is consumed by `uploadMiddleware.js`

---

## 3.3 Middleware Module

**Primary files**
- [server/middleware/authMiddleware.js](C:/Users/ritik/OneDrive/Desktop/project1/server/middleware/authMiddleware.js)
- [server/middleware/roleMiddleware.js](C:/Users/ritik/OneDrive/Desktop/project1/server/middleware/roleMiddleware.js)
- [server/middleware/uploadMiddleware.js](C:/Users/ritik/OneDrive/Desktop/project1/server/middleware/uploadMiddleware.js)
- [server/middleware/errorMiddleware.js](C:/Users/ritik/OneDrive/Desktop/project1/server/middleware/errorMiddleware.js)

**Responsibility**
- Cross-cutting request concerns

**Main functionality**
- Decode JWT and attach `req.user`
- Enforce roles such as:
  - `admin`
  - `manager`
  - `task_only`
- Process uploads through multer + Cloudinary
- Return standardized JSON errors

**Connectivity**
- Applied at route level
- Used by all protected route modules

---

## 3.4 Route Modules

**Primary files**
- [server/routes/authRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/authRoutes.js)
- [server/routes/clientRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/clientRoutes.js)
- [server/routes/taskRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/taskRoutes.js)
- [server/routes/userRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/userRoutes.js)
- [server/routes/groupRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/groupRoutes.js)
- [server/routes/categoryRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/categoryRoutes.js)
- [server/routes/reportRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/reportRoutes.js)
- [server/routes/notificationRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/notificationRoutes.js)

**Responsibility**
- Map URL endpoints to middleware chains and controllers

**Main functionality**
- Apply:
  - auth checks
  - role checks
  - express-validator rules
- Keep controller logic thinly routed and well grouped by domain

**Connectivity**
- `server.js` mounts these modules under `/api/*`
- Each route module points to its controller module

---

## 3.5 Controller Modules

**Primary files**
- [server/controllers/authController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/authController.js)
- [server/controllers/clientController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/clientController.js)
- [server/controllers/taskController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/taskController.js)
- [server/controllers/userController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/userController.js)
- [server/controllers/groupController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/groupController.js)
- [server/controllers/categoryController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/categoryController.js)
- [server/controllers/reportController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/reportController.js)
- [server/controllers/notificationController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/notificationController.js)

**Responsibility**
- Domain business logic

**Main functionality by controller**

### Auth Controller
- Login
- Logout
- Get current user
- Change password

### Client Controller
- List clients
- Create/update/delete clients
- Bulk upload
- Export
- Attachment upload/delete

### Task Controller
- List tasks
- Create/update/delete tasks
- Update task status
- FTA tracker fetch
- FTA status updates
- Export

### User Controller
- List users
- Create user
- Update user
- Change role
- Activate/deactivate
- Delete user

### Group Controller
- Group CRUD and client membership updates

### Category Controller
- Category CRUD
- Task type add/remove

### Report Controller
- Dashboard stats
- Login activity
- Task activity
- Client-wise rollups
- User-wise rollups
- Overdue report
- FTA report

### Notification Controller
- Fetch notifications
- Mark one read
- Mark all read

**Connectivity**
- Each controller uses one or more models
- Controllers may also call utility modules such as:
  - `auditLogger`
  - `generateToken`
  - `autoId`
  - `sendEmail`

---

## 3.6 Data Model Module

**Primary files**
- [server/models/User.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/User.js)
- [server/models/Client.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/Client.js)
- [server/models/Task.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/Task.js)
- [server/models/ClientGroup.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/ClientGroup.js)
- [server/models/Category.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/Category.js)
- [server/models/Notification.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/Notification.js)
- [server/models/ActivityLog.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/ActivityLog.js)

**Responsibility**
- Persist the domain objects in MongoDB

**Main functionality**
- Schema validation
- Defaults
- enums
- model methods
- hooks such as password hashing
- virtuals such as task overdue state

**Connectivity**
- Used by controllers and seed script
- Models reference each other through Mongoose relationships:
  - `Task.client -> Client`
  - `Task.assignedTo -> User`
  - `Client.group -> ClientGroup`
  - `Notification.relatedTask -> Task`
  - `ActivityLog.task -> Task`

---

## 3.7 Utility Module

**Primary files**
- [server/utils/generateToken.js](C:/Users/ritik/OneDrive/Desktop/project1/server/utils/generateToken.js)
- [server/utils/auditLogger.js](C:/Users/ritik/OneDrive/Desktop/project1/server/utils/auditLogger.js)
- [server/utils/autoId.js](C:/Users/ritik/OneDrive/Desktop/project1/server/utils/autoId.js)
- [server/utils/sendEmail.js](C:/Users/ritik/OneDrive/Desktop/project1/server/utils/sendEmail.js)

**Responsibility**
- Shared backend helpers

**Main functionality**
- JWT creation
- Activity log creation
- Task/client ID generation
- Email delivery

**Connectivity**
- Reused by controllers and boot-time cron logic

---

## 3.8 Seed Module

**Primary file**
- [server/seed.js](C:/Users/ritik/OneDrive/Desktop/project1/server/seed.js)

**Responsibility**
- Populate development or deployment databases with initial demo data

**Main functionality**
- Seeds:
  - users
  - categories
  - groups
  - clients
  - tasks
  - activity logs
  - notifications

**Connectivity**
- Uses the same Mongoose models as the running API
- Supports deployment setup and local development bootstrap

---

## 4. Module Connectivity by Business Flow

## 4.1 Login Flow

```text
Login.jsx
  -> authService.login()
    -> api.js
      -> POST /api/auth/login
        -> authController.login
          -> User model
          -> generateToken
```

After login:

```text
AuthContext
  -> stores token + user in localStorage
  -> ProtectedRoute unlocks authenticated screens
```

---

## 4.2 Client Creation Flow

```text
AddClient.jsx
  -> useClients().createClient
    -> clientService.create
      -> api.js
        -> POST /api/clients
          -> clientRoutes
          -> authMiddleware
          -> roleMiddleware(admin/manager)
          -> clientController.createClient
          -> Client model
```

Supporting lookups:

```text
AddClient.jsx
  -> useUsers().fetchUsers
  -> groupService.list
  -> AppContext
```

---

## 4.3 Task Creation Flow

```text
AddTask.jsx
  -> useTasks().createTask
    -> taskService.create
      -> api.js
        -> POST /api/tasks
          -> taskRoutes validation
          -> authMiddleware
          -> roleMiddleware(admin/manager)
          -> taskController.createTask
          -> Task model
          -> auditLogger
          -> Notification model
```

---

## 4.4 Dashboard Flow

```text
Dashboard.jsx
  -> reportService.dashboardStats
    -> api.js
      -> GET /api/reports/dashboard-stats
        -> reportController.dashboardStats
          -> Client model
          -> Task model
          -> Category model
          -> ActivityLog model
  -> AppContext.SET_DASHBOARD
```

---

## 4.5 Users Screen Flow

```text
Users.jsx
  -> useUsers().fetchUsers / updateRole / updateStatus / deleteUser
    -> userService
      -> api.js
        -> /api/users*
          -> userRoutes
          -> authMiddleware
          -> adminOnly role middleware
          -> userController
          -> User model
```

---

## 4.6 Notification Flow

```text
NotificationPanel.jsx
  -> useNotifications()
    -> notificationService
      -> api.js
        -> /api/notifications*
          -> notificationRoutes
          -> notificationController
          -> Notification model
```

Also created by backend-side events:

- task creation
- task status changes
- FTA query changes
- cron-generated due/overdue checks

---

## 5. Role Connectivity

The authorization model spans both frontend and backend.

## Frontend
- `ProtectedRoute` hides restricted screens

## Backend
- `authMiddleware` verifies JWT
- `roleMiddleware` enforces role access

**Roles**
- `admin`
  - full access
- `manager`
  - operational access without admin-only user management/deletes
- `task_only`
  - restricted task-focused access

**Important rule**
- Backend authorization is the real source of truth
- Frontend route protection improves UX, but backend middleware is what actually secures data

---

## 6. Where to Start as a New Developer

If you are onboarding into this codebase, read in this order:

1. [src/main.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/main.jsx)
2. [src/context/AuthContext.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/context/AuthContext.jsx)
3. [src/context/AppContext.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/context/AppContext.jsx)
4. [src/services/api.js](C:/Users/ritik/OneDrive/Desktop/project1/src/services/api.js)
5. [server/server.js](C:/Users/ritik/OneDrive/Desktop/project1/server/server.js)
6. Representative route/controller pairs:
   - [server/routes/clientRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/clientRoutes.js)
   - [server/controllers/clientController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/clientController.js)
   - [server/routes/taskRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/taskRoutes.js)
   - [server/controllers/taskController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/taskController.js)

Then move into the screen you need to change.

---

## 7. Summary

This project is organized as a domain-based full-stack app:

- **screens** own user workflows
- **hooks** own resource orchestration
- **services** own HTTP calls
- **contexts** own shared frontend state
- **routes** own endpoint definitions
- **controllers** own backend behavior
- **models** own persistence rules
- **utilities** support shared cross-cutting concerns

The cleanest way to reason about any feature is:

1. start from the screen
2. trace into the hook
3. trace into the service/API call
4. trace into route + middleware
5. trace into the controller
6. trace into the model

That path will explain almost every behavior in the application.
