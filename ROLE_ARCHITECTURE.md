# Filing Buddy Role Architecture

## 1. Role Model

The system uses 3 roles only:

- `admin`
- `manager`
- `task_only`

These roles define what each user can see, create, assign, update, or delete.

## 2. Role Intent

### Admin

Admin is the full-control role.

Admin can:

- create work
- assign work
- update work
- delete work
- create and manage clients
- create and manage users
- manage categories and task types
- manage client groups
- view reports
- view all tasks and all clients

### Manager

Manager is the operations role.

Manager can:

- create work
- assign work
- update work
- create and manage clients
- view reports
- view all tasks and all clients

Manager cannot:

- delete work
- delete clients
- manage user roles
- delete users

### Task Only

Task Only is the execution role.

Task Only can:

- view only assigned tasks
- update only their own task progress or status
- complete assigned work

Task Only cannot:

- assign work
- delete work
- manage clients
- access reports
- access settings modules

## 3. Permission Matrix

| Action | Admin | Manager | Task Only |
|---|---|---|---|
| Login | Yes | Yes | Yes |
| View dashboard | Yes | Yes | Limited / own work only |
| View all clients | Yes | Yes | No |
| Create client | Yes | Yes | No |
| Update client | Yes | Yes | No |
| Delete client | Yes | No | No |
| View all tasks | Yes | Yes | No |
| View own assigned tasks | Yes | Yes | Yes |
| Create task | Yes | Yes | No |
| Assign task | Yes | Yes | No |
| Update task | Yes | Yes | Own task only |
| Delete task | Yes | No | No |
| Update task status | Yes | Yes | Own task only |
| Access FTA tracker | Yes | Yes | No |
| Manage categories | Yes | Optional read/update only | No |
| Manage users | Yes | No | No |
| Change user role | Yes | No | No |
| Manage client groups | Yes | Yes | No |
| View reports | Yes | Yes | No |
| View notifications | Yes | Yes | Yes |

## 4. Frontend Role Architecture

The frontend should use role-aware rendering.

### 4.1 Role Sources

Role is stored in:

- `AuthContext`
- the JWT-backed `/api/auth/me` response

### 4.2 Frontend Rules

The frontend should:

- hide screens the user cannot access
- hide buttons the user cannot use
- hide delete actions for non-admin users
- hide assign controls for `task_only`
- hide user/settings/report sections for `task_only`

### 4.3 Sidebar by Role

#### Admin

- Dashboard
- Clients
- Tasks
- Settings
- Reports

#### Manager

- Dashboard
- Clients
- Tasks
- Client Groups
- Reports

#### Task Only

- Dashboard or limited dashboard
- Task List
- Notifications

## 5. Backend Role Architecture

The backend is the true authority for permissions.

### 5.1 Request Flow

```text
Route
-> authMiddleware
-> roleMiddleware
-> controller
-> database
```

### 5.2 authMiddleware

`authMiddleware` does:

- verify JWT
- load the authenticated user identity
- attach user info to `req.user`

### 5.3 roleMiddleware

`roleMiddleware` should expose helpers such as:

- `adminOnly`
- `adminManager`
- task ownership checks for `task_only`

## 6. API Access by Role

### 6.1 Auth

- `POST /api/auth/login` -> all roles
- `GET /api/auth/me` -> authenticated users
- `PUT /api/auth/change-password` -> authenticated users

### 6.2 Clients

- `GET /api/clients` -> admin, manager
- `GET /api/clients/:id` -> admin, manager
- `POST /api/clients` -> admin, manager
- `PUT /api/clients/:id` -> admin, manager
- `DELETE /api/clients/:id` -> admin only

### 6.3 Tasks

- `GET /api/tasks`
  - admin -> all tasks
  - manager -> all tasks
  - task_only -> only assigned tasks
- `GET /api/tasks/:id`
  - admin, manager -> any task
  - task_only -> only own assigned task
- `POST /api/tasks` -> admin, manager
- `PUT /api/tasks/:id`
  - admin, manager -> yes
  - task_only -> no, or limited self-update if intentionally allowed
- `PATCH /api/tasks/:id/status`
  - admin -> yes
  - manager -> yes
  - task_only -> own task only
- `DELETE /api/tasks/:id` -> admin only

### 6.4 Users

- `GET /api/users` -> admin only
- `GET /api/users/:id` -> admin only
- `POST /api/users` -> admin only
- `PUT /api/users/:id` -> admin only
- `PATCH /api/users/:id/role` -> admin only
- `PATCH /api/users/:id/status` -> admin only
- `DELETE /api/users/:id` -> admin only

### 6.5 Groups

- `GET /api/groups` -> admin, manager
- `POST /api/groups` -> admin, manager
- `PUT /api/groups/:id` -> admin, manager
- `PATCH /api/groups/:id/clients` -> admin, manager
- `DELETE /api/groups/:id` -> admin, manager or admin only depending on business rule

### 6.6 Categories

- `GET /api/categories` -> authenticated users or admin/manager only
- `POST /api/categories` -> admin only
- `PUT /api/categories/:id` -> admin only
- `DELETE /api/categories/:id` -> admin only

### 6.7 Reports

- `GET /api/reports/*` -> admin, manager

### 6.8 Notifications

- `GET /api/notifications` -> authenticated users
- `PATCH /api/notifications/:id/read` -> authenticated users
- `PATCH /api/notifications/mark-all-read` -> authenticated users

## 7. Task Ownership Rule

This is the key rule for `task_only`.

When a `task_only` user requests tasks:

- backend must automatically filter by `assignedTo = req.user._id`

When a `task_only` user tries to update status:

- backend must verify the task is assigned to that same user

This check must not depend only on the frontend.

## 8. Assignment Architecture

Assignment is controlled only by `admin` and `manager`.

### 8.1 Assignment Flow

```text
Admin or Manager creates task
-> selects client
-> selects assignee
-> backend saves assignedTo
-> assignee gets notification
-> task_only user sees assigned work only
```

### 8.2 Assignment Rule

The backend must reject assignment attempts made by `task_only`.

## 9. Delete Architecture

Delete is controlled only by `admin`.

### 9.1 Delete Rules

- task delete -> admin only
- client delete -> admin only
- user delete -> admin only

### 9.2 Manager Delete Rule

Manager can operate work but cannot remove data permanently.

### 9.3 Task Only Delete Rule

Task Only cannot delete anything.

## 10. Recommended UI Behavior

The UI should make the role model obvious:

- hide unauthorized buttons
- disable unauthorized actions
- redirect unauthorized users away from blocked screens
- show only relevant modules in the sidebar

But the backend must still enforce every permission again.

## 11. Final Principle

Use this rule across the whole project:

- frontend controls visibility
- backend controls permission
- database stores truth
- JWT identifies the role
- middleware enforces the role

