# Filing Buddy Project Flow Architecture

## System Overview

Filing Buddy is a full-stack practice management system with:

- React frontend
- Express backend
- MongoDB database
- JWT authentication
- role-based access

## End-to-End Architecture

```mermaid
flowchart TD
    A["User (Admin / Manager / Task Only)"] --> B["React Frontend"]
    B --> C["AuthContext / AppContext"]
    C --> D["Service Layer (Axios API Client)"]
    D --> E["Express API"]
    E --> F["authMiddleware"]
    F --> G["roleMiddleware"]
    G --> H["Controllers"]
    H --> I["Mongoose Models"]
    I --> J["MongoDB"]

    H --> K["Notifications"]
    H --> L["Activity Logs"]
    H --> M["Uploads / Cloudinary"]
    H --> N["Cron / Email Helpers"]
```

## Main Flow

```mermaid
flowchart TD
    A["Login"] --> B["Dashboard"]
    B --> C["Clients"]
    B --> D["Tasks"]
    B --> E["Settings"]
    B --> F["Reports"]
    B --> G["Notifications"]
```

## Login Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Backend
    participant DB as MongoDB

    U->>FE: Enter email and password
    FE->>API: POST /api/auth/login
    API->>DB: Find user
    DB-->>API: User record
    API->>API: Verify password
    API->>API: Generate JWT
    API-->>FE: token + user
    FE->>FE: Save token
    FE->>FE: Set current user context
    FE-->>U: Redirect to dashboard
```

## App Navigation Flow

### Clients Module

```text
Dashboard
-> Add Client
-> Client List
-> Bulk Upload
-> Contact Directory
```

### Tasks Module

```text
Dashboard
-> Add Task
-> Task List
-> FTA Tracker
-> Categories and Task Types
```

### Settings and Reports

```text
Dashboard
-> Users
-> Client Groups
-> Reports
```

## Client Creation Flow

```mermaid
sequenceDiagram
    participant U as Admin/Manager
    participant FE as Add Client Screen
    participant API as Client API
    participant DB as MongoDB

    U->>FE: Fill client tabs
    FE->>API: POST /api/clients
    API->>API: Validate request
    API->>DB: Save client
    API->>DB: Save linked attachments/doc references
    API->>DB: Create notifications if needed
    API-->>FE: Client created
    FE-->>U: Redirect to client list
```

## Client Edit Flow

```mermaid
sequenceDiagram
    participant U as Admin/Manager
    participant FE as Client List / Add Client
    participant API as Client API
    participant DB as MongoDB

    U->>FE: Click Edit
    FE->>API: GET /api/clients/:id
    API->>DB: Load client
    DB-->>API: Client document
    API-->>FE: Client data
    U->>FE: Update fields
    FE->>API: PUT /api/clients/:id
    API->>DB: Save client updates
    API-->>FE: Updated client
```

## Client Delete Flow

```mermaid
sequenceDiagram
    participant U as Admin
    participant FE as Client List
    participant API as Client API
    participant DB as MongoDB

    U->>FE: Click Delete Client
    FE->>API: DELETE /api/clients/:id
    API->>API: Verify admin role
    API->>DB: Delete client
    API->>DB: Delete related tasks
    API->>DB: Delete related activity logs
    API->>DB: Delete related notifications
    API->>DB: Delete related contacts
    API->>DB: Remove client from groups
    API-->>FE: Success response
```

## Task Creation and Assignment Flow

```mermaid
sequenceDiagram
    participant U as Admin/Manager
    participant FE as Add Task
    participant API as Task API
    participant DB as MongoDB
    participant N as Notification

    U->>FE: Select category
    U->>FE: Select task type
    U->>FE: Enter task details
    U->>FE: Select assignee
    FE->>API: POST /api/tasks
    API->>API: Validate request
    API->>DB: Save task
    API->>DB: Create activity log
    API->>DB: Create notification for assignee
    API-->>FE: Task created
```

## Task Execution Flow

```mermaid
sequenceDiagram
    participant T as Task Only User
    participant FE as Task List
    participant API as Task API
    participant DB as MongoDB

    T->>FE: Open task list
    FE->>API: GET /api/tasks
    API->>API: Filter to assigned tasks only
    API->>DB: Load assigned tasks
    DB-->>API: Task list
    API-->>FE: Own tasks only
    T->>FE: Update status
    FE->>API: PATCH /api/tasks/:id/status
    API->>API: Check ownership
    API->>DB: Update task
    API->>DB: Create activity log
    API-->>FE: Updated task
```

## Recurring Task Flow

```mermaid
flowchart TD
    A["Admin / Manager creates recurring task"] --> B["Task saved with recurringConfig"]
    B --> C["User completes recurring task"]
    C --> D["Backend detects completion"]
    D --> E["Next recurring task generated"]
    E --> F["Notification sent to assignee"]
```

## FTA Tracker Flow

```mermaid
sequenceDiagram
    participant U as Admin/Manager
    participant FE as FTA Tracker
    participant API as Task API
    participant DB as MongoDB

    U->>FE: Open FTA tracker
    FE->>API: GET /api/tasks/fta-tracker
    API->>DB: Load FTA tasks
    API-->>FE: FTA records
    U->>FE: Change FTA status
    FE->>API: PATCH /api/tasks/:id/fta-status
    API->>DB: Update task
    API->>DB: Create log and notification if additional query
```

## Reports Flow

```mermaid
sequenceDiagram
    participant U as Admin/Manager
    participant FE as Reports Screen
    participant API as Reports API
    participant DB as MongoDB

    U->>FE: Open report
    FE->>API: GET /api/reports/*
    API->>DB: Aggregate and filter records
    DB-->>API: Report data
    API-->>FE: Rows and counts
```

## Notification Flow

```mermaid
flowchart TD
    A["Task created / updated / overdue / FTA query"] --> B["Controller creates notification"]
    B --> C["Notification stored in MongoDB"]
    C --> D["Frontend polls /api/notifications"]
    D --> E["Bell badge updates"]
    E --> F["User reads notification"]
```

## Background Job Flow

```mermaid
flowchart TD
    A["Daily cron job"] --> B["Find tasks due in 3 days"]
    B --> C["Create due-soon notifications"]

    A --> D["Find overdue tasks"]
    D --> E["Create overdue notifications"]
    E --> F["Send overdue digest emails"]
```

## Database Relationship Flow

```mermaid
erDiagram
    USER ||--o{ CLIENT : assignedUser
    USER ||--o{ TASK : assignedTo
    USER ||--o{ NOTIFICATION : recipient
    USER ||--o{ ACTIVITYLOG : user

    CLIENT ||--o{ TASK : has
    CLIENTGROUP ||--o{ CLIENT : groups
    CLIENT ||--o{ CONTACT : has

    TASK ||--o{ ACTIVITYLOG : logs
    TASK ||--o{ NOTIFICATION : relatedTask
    CLIENT ||--o{ NOTIFICATION : relatedClient
```

## Role-Based Screen Flow

```mermaid
flowchart TD
    A["Login"] --> B{"Role?"}

    B -->|Admin| C["Full Access"]
    B -->|Manager| D["Operations Access"]
    B -->|Task Only| E["Assigned Work Access"]

    C --> C1["Clients"]
    C --> C2["Tasks"]
    C --> C3["Users"]
    C --> C4["Reports"]
    C --> C5["Delete + Assign"]

    D --> D1["Clients"]
    D --> D2["Tasks"]
    D --> D3["Groups"]
    D --> D4["Reports"]
    D --> D5["Assign Only"]

    E --> E1["Own Tasks"]
    E --> E2["Status Updates"]
```

## Backend Request Architecture

```text
Frontend event
-> API service call
-> Express route
-> authMiddleware
-> roleMiddleware
-> controller
-> model
-> MongoDB
-> response
-> UI update
```

## Final Architecture Principle

The project should always follow these rules:

- frontend controls visibility
- backend controls permissions
- database stores truth
- JWT carries identity and role
- middleware enforces access
- controllers implement business logic
- logs and notifications record important actions

