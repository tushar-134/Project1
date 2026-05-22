## Bug Report

Audit date: 2026-05-22

This file lists confirmed bugs and requirement mismatches found during a code review of the current `main` branch. Findings are ordered by severity.

### 1. Task-only dashboard leaks global category counts and undercounts visible clients
- Severity: High
- Files:
  - [server/controllers/reportController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/reportController.js)
- References:
  - `taskScope` uses `assignedTo` for `task_only`, but `clientScope` uses `assignedUser` instead of the same task-based visibility rule: lines 21-22
  - `categoryBreakdown` aggregation does not include any `task_only` scope at all: lines 35-38
- Why this is a bug:
  - `task_only` users are allowed to see clients through assigned tasks in the client controller, but the dashboard counts clients using `assignedUser`, which can undercount or show `0` even when the task-only user has visible work.
  - The category breakdown aggregation ignores the `task_only` filter entirely and returns whole-practice counts.
- User impact:
  - Task-only users can see dashboard stats that disagree with the client/task lists.
  - Category cards can leak practice-wide workload information.

### 2. Managers cannot assign tasks to other users
- Severity: High
- Files:
  - [server/controllers/taskController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/taskController.js)
- References:
  - create guard: lines 163-165
  - update guard: lines 188-190
- Why this is a bug:
  - The current controller rejects any manager task assignment unless `assignedTo === req.user._id`.
  - That blocks managers from assigning work to staff, which contradicts the stated role architecture where managers are allowed to assign work but not delete it.
- User impact:
  - Managers can create tasks only for themselves.
  - Reassignment and team workload management are blocked.

### 3. Contact updates bypass request validation
- Severity: Medium
- Files:
  - [server/routes/contactRoutes.js](C:/Users/ritik/OneDrive/Desktop/project1/server/routes/contactRoutes.js)
  - [server/controllers/contactController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/contactController.js)
- References:
  - `PUT /:id` has no validators: line 37
  - `updateContact` does not run `validationResult`: lines 51-67
- Why this is a bug:
  - Contact creation validates `fullName`, `client`, and phone structure, but update accepts whatever payload is sent.
  - A malformed update can store blank names, invalid country codes, or malformed phone numbers.
- User impact:
  - Contact data quality can drift after edits even if creation is clean.
  - The contact directory can end up with records that creation would have rejected.

### 4. Task list loses active filters after a failed inline status update
- Severity: Medium
- Files:
  - [src/components/screens/TaskList.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/TaskList.jsx)
- References:
  - failure path calls `fetchTasks()` with no filter params: line 93
- Why this is a bug:
  - The table loads with category/status/month filters, but on an update failure it refetches the default task list instead of the filtered list.
- User impact:
  - A failed status change can suddenly replace a filtered view with all tasks.
  - It is especially confusing when working from month or overdue views.

### 5. Client-side duplicate phone detection in Users is ineffective for records with country codes
- Severity: Medium
- Files:
  - [src/components/screens/Users.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Users.jsx)
  - [src/hooks/useUsers.js](C:/Users/ritik/OneDrive/Desktop/project1/src/hooks/useUsers.js)
- References:
  - mapped users already flatten mobile into one display string: [src/hooks/useUsers.js](C:/Users/ritik/OneDrive/Desktop/project1/src/hooks/useUsers.js) lines 5-8
  - duplicate comparison concatenates `mobileCountryCode + mobile` again: [src/components/screens/Users.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Users.jsx) line 93
- Why this is a bug:
  - `mapUser()` turns `mobile` into a string like `+971 501234567`.
  - The Users screen then builds `normalizePhoneNumber(user.mobileCountryCode + user.mobile)`, which duplicates the dial code and never matches the form’s normalized digits.
- User impact:
  - The frontend pre-check can miss duplicate phone numbers.
  - The backend still rejects duplicates, but the user gets a late server error instead of immediate inline feedback.

### 6. Contact Directory only loads the first 100 clients for the add-contact picker
- Severity: Low
- Files:
  - [src/components/screens/Contacts.jsx](C:/Users/ritik/OneDrive/Desktop/project1/src/components/screens/Contacts.jsx)
- References:
  - client fetch is capped at `limit: 100`: line 47
  - selected client is resolved only from `state.clients`: lines 92-96, 200-202
- Why this is a bug:
  - The add-contact form depends on the locally loaded client list.
  - Any client outside the first 100 active results cannot be selected or resolved.
- User impact:
  - Larger datasets make some clients impossible to target from the contact form.
  - The UI can show “Please select a valid client” even when the client exists in the database.

### 7. Custom recurring tasks will not auto-generate the next occurrence
- Severity: Low
- Files:
  - [server/controllers/taskController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/taskController.js)
  - [server/models/Task.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/Task.js)
- References:
  - model allows `custom`: [server/models/Task.js](C:/Users/ritik/OneDrive/Desktop/project1/server/models/Task.js) line 17
  - recurrence calculator has no `custom` branch and returns `null`: [server/controllers/taskController.js](C:/Users/ritik/OneDrive/Desktop/project1/server/controllers/taskController.js) lines 19-37
  - generator bails out when no next due date can be derived: lines 63-67
- Why this is a bug:
  - The schema advertises `custom` as a valid recurring frequency, but the generator does not know how to advance it.
- User impact:
  - A task can be saved as custom recurring but stop recurring after completion unless a valid `nextDueDate` is manually maintained.

## Notes

- This report focuses on confirmed code-level bugs and requirement mismatches visible in the current branch.
- It does not include deployment-only issues or local environment problems unless they are rooted in application code.
