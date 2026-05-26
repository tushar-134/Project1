# Client Visit Management Module

## Objective

Before onboarding a client, company employees/users visit the client location for requirement gathering, verification, onboarding discussion, or follow-up meetings.

We need a new separate module/tab called:

# “Client Visit Management”

OR

# “Client Visits”

This module should be added seamlessly into the current software without disturbing the existing UI flow, design system, navigation, or architecture.

The new functionality must feel like a native part of the current product.

---

# Important UI/UX Requirement

Before implementation, first analyze the current application:

* UI flow
* Navigation structure
* Existing layouts
* Design system
* Component library
* Color theme
* Typography
* Spacing system
* Responsive behavior
* Existing reusable components

Then implement the new module following the exact same patterns.

---

# Core Requirements

## 1. Create a Separate New Tab/Module

Add a new sidebar/menu tab:

# Client Visits

This should open a dedicated module for managing client visit activities.

Do NOT disturb existing modules or workflows.

Follow current:

* Routing structure
* State management pattern
* API/service architecture
* Reusable component strategy

---

# 2. Visit Listing Screen

Create a main listing page/table for all client visits.

## Required Columns

* Visit ID
* Client Name
* Visit Date
* Visit Time
* Visit Type
* Visiting Users
* Team Lead
* Visit Status
* Check-In Status
* Check-Out Status
* Duration
* Created By
* Actions

---

## Required Features

* Search
* Filters
* Pagination
* Sorting
* Export (Excel/PDF)
* Status badges
* Responsive table/cards

---

## Required Filters

* Date Range
* Client Name
* User Name
* Visit Status
* Visit Type

---

## 3. Create Visit Screen

Create a form for scheduling a client visit.

### Client Type Selection
While scheduling a new client visit, a "Client Type" field must be selected first.

**Options:**
* New Client
* Existing Client

**Expected Behavior:**
* **If “New Client” is selected:**
    * User can manually enter client details (Name, etc.).
    * No client selection dropdown should appear.
* **If “Existing Client” is selected:**
    * A “Select Client” dropdown should appear dynamically.
    * Dropdown should list all existing clients from the system.
    * User should be able to search/select the client.

## Required Fields

| Field Name     | Type            |
| -------------- | --------------- |
| Visit ID       | Auto Generated  |
| Client Type    | Radio/Dropdown  |
| Client Name    | Text (if New) / Dropdown (if Existing) |
| Visit Date     | Date Picker (Disabled past dates, Today/Future only) |
| Visit Time     | Time Picker (12-hour format with AM/PM) |
| Visit Type     | Dropdown        |
| Visit Location | Text            |
| Assigned Users | Multi Select (Dynamic from DB, Searchable) |
| Remarks/Notes  | Text Area       |
| Status         | Dropdown        |

---

# 4. User Assignment Logic

In our workflow, we do NOT have fixed teams. Any user/employee can be assigned to a client visit.

## Required Behavior

### For New Client Visits
* Show dynamic dropdown/list of all active users/employees fetched from the database.
* User can manually select one or multiple users.
* Support searching/filtering users.

### For Existing Client Visits
When an existing client is selected:
* System should automatically pre-select the user(s) already assigned to that client (intelligent auto-selection/default assignment).
* **User must still be able to change/remove/add assigned users manually.**
* Auto-selected users should remain editable.
* Multi-user assignment should still be supported.
* Fetch all active users from the backend dynamically.

---

# 5. Multiple User Visit Support

One visit may include multiple employees/users.

System must support assigning multiple users to a single visit.

## Requirements

* Multi-select employee dropdown
* Multiple users attached to same visit
* Individual tracking per user

Each assigned user should have separate:

* Check-In
* Check-Out
* Duration
* Notes/Summary

---

# 5. Check-In / Check-Out Functionality

Each visiting employee should be able to independently check in and check out.

---

## Check-In Requirements

When user checks in:

* Capture current timestamp automatically
* Capture current date automatically
* Optional GPS location
* Optional selfie/image upload
* Optional notes

### Fields

| Field         | Description  |
| ------------- | ------------ |
| Check-In Time | Auto Capture |
| Check-In Date | Auto Capture |
| GPS Location  | Optional     |
| Image Upload  | Optional     |
| Notes         | Optional     |

---

## Check-Out Requirements

When user checks out:

* Capture checkout timestamp
* Auto calculate visit duration
* Add visit summary
* Follow-up required option

### Fields

| Field              | Description     |
| ------------------ | --------------- |
| Check-Out Time     | Auto Capture    |
| Duration           | Auto Calculated |
| Visit Summary      | Text            |
| Follow-Up Required | Yes/No          |

---

# 6. Visit Status Workflow

## Statuses

| Status      | Meaning                      |
| ----------- | ---------------------------- |
| Planned     | Visit scheduled              |
| In Progress | At least one user checked in |
| Completed   | All users checked out        |
| Cancelled   | Visit cancelled              |

---

## Auto Status Rules

* On first check-in → Status becomes “In Progress”
* When all users check out → Status becomes “Completed”

---

# 7. Visit Details Screen

Create a detailed visit view page.

## Must Include

* Complete visit information
* Assigned users
* User-wise check-in/check-out
* Duration tracking
* Timeline/activity logs
* Visit remarks
* Attachments/photos
* Follow-up notes

---

# 8. Timeline / Activity Logs

Maintain activity history for every visit.

## Example Activities

* Visit Created
* User Assigned
* User Removed
* Check-In Completed
* Check-Out Completed
* Remarks Updated
* Status Changed

---

# 9. Dashboard Widgets

Add dashboard statistics/cards.

## Required Widgets

* Total Visits
* Today Visits
* Pending Visits
* Completed Visits
* User-wise Visit Count
* Client-wise Visit Count

---

# 10. Notifications (Optional)

Optional notification support:

* Visit reminders
* Missed check-in alerts
* Visit completion notifications
* Follow-up reminders

---

# 11. Reports & Export

Generate reports for:

* Monthly Visits
* User-wise Visits
* Client Visit History
* Duration Reports

Export formats:

* Excel
* PDF

---

# 12. Suggested Database Structure

## Table: client_visits

| Column     |
| ---------- |
| id         |
| visit_id   |
| client_id  |
| visit_date |
| visit_time |
| visit_type |
| location   |
| remarks    |
| status     |
| created_by |
| created_at |

---

## Table: client_visit_users

| Column         |
| -------------- |
| id             |
| visit_id       |
| user_id        |
| check_in_time  |
| check_out_time |
| duration       |
| visit_summary  |

---

# 13. Suggested API Structure

## Create Visit

POST /api/client-visits

## Get Visit List

GET /api/client-visits

## Get Visit Details

GET /api/client-visits/{id}

## Check-In

POST /api/client-visits/{id}/checkin

## Check-Out

POST /api/client-visits/{id}/checkout

## Reports

GET /api/client-visits/reports

---

# 14. Suggested UX Flow

Client Visits Tab
→ Visit Listing
→ Create Visit
→ Assign Multiple Users
→ User Check-In
→ User Check-Out
→ Visit Completion
→ Reports & Analytics

---

# 15. UI/UX Guidelines

Please ensure:

* Existing UI consistency is maintained (e.g., clickable IDs use blue color and hover underline)
* Enterprise-grade clean UI
* Reusable components are used
* Responsive design
* Mobile-friendly check-in experience
* Proper form validation
* Empty states
* Skeleton loaders
* Success/error toasts
 * Proper status indicators
 * Smooth user flow

---

# 16. Layout Architecture (Enterprise SaaS Standard)

The “Schedule New Visit” page must follow a professional, stable layout architecture to prevent content spill and ensure accessibility across all devices.

## Parent Card / Panel
* **Fixed Height:** On desktop, the card/panel should have a fixed height (approx. 500px to 550px) to maintain a stable layout and ensure buttons are visible without scrolling.
* **Compact View:** Limit the visible user list to a maximum of 4 users at a time to keep the panel compact.
* **Flex Layout:** Use `display: flex` and `flex-direction: column` to manage internal sections.
* **No Auto-Expansion:** Containers should NEVER expand dynamically based on content growth.
* **Responsive Padding:** Ensure parent container has sufficient bottom padding (`pb-24` or more) on mobile to prevent buttons from hiding behind navigation or sticky elements.

## Section 1: Selected Users Area (Fixed/Shrinkable)
* **Max Height:** Strictly enforced (e.g., maximum 2-3 rows of pills).
* **Internal Scroll:** Vertical scroll must appear if selected users exceed the limit.
* **Flex Behavior:** `flex-shrink: 0` to prevent it from pushing other sections down.
* **Overflow:** `overflow-y: auto`.

## Section 2: Search + User List Area (Flexible Scroll Area)
* **Primary Scroll Area:** This section MUST consume ONLY the remaining available space.
* **Flex Behavior:** Use `flex: 1` and `min-height: 0` (CRITICAL) to ensure it shrinks/grows correctly.
* **Internal Scroll:** Use `overflow-y: auto`.
* **Compact UI:** Optimize list item height (avatar size, padding, spacing) to fit more users.
* **Buffer Padding:** Include bottom padding (`pb-32`) within the scroll area to ensure the last items aren't obscured by the fixed footer.

## Section 3: Action Buttons Area (Stable Footer)
* **Fixed Position:** Footer must have a reserved fixed height and stay at the bottom of the card/viewport.
* **Flex Behavior:** `flex-shrink: 0`.
* **Desktop Styling:** Use absolute positioning with `backdrop-blur` and a distinct top shadow for better visual separation.
* **No Overlap:** Ensure buttons never move outside the card or get hidden by content.
* **Mobile/Tablet:** Use a `sticky-footer` with a clear margin-top to separate from form content.

---

# 17. Business Rules

1. At least one user must be assigned to a visit.
2. Check-out cannot happen before check-in.
3. Multiple users can check in/out separately.
4. Visit status updates automatically.
5. Admin can edit/cancel visits.
6. Duration should be auto calculated.
7. All activities should be logged in timeline history.
8. Visit date must be greater than or equal to today's date.
9. Time must be in 12-hour format with AM/PM.
10. Assigned users must be fetched dynamically from the database.

---

---

# 18. Quick View / Side Panel (Drawer)

To improve accessibility and user experience, the module must support a "Quick View" drawer similar to the Task Management module.

## Expected Behavior
* **Trigger:** Clicking on a "Visit ID" in the Visit Listing table or Dashboard's Today's Schedule should open a side drawer.
* **Functionality:**
    * View complete visit details without leaving the current page.
    * Update Visit Status (Planned, In Progress, Completed, Cancelled).
    * Add/Update Visit Remarks.
    * View the Activity Timeline/Logs in real-time.
    * **Quick Navigation:** A "Full page" or "Edit page" button in the top-right corner for deeper management.
* **UI Requirements:**
    * Smooth slide-in animation from the right.
    * Header-based actions (Close and Edit/Full Page buttons) for stable accessibility.
    * Overlay/Backdrop to focus on the drawer.
    * Close on Esc key or Backdrop click.
    * Consistent styling with `TaskDrawer`.

---

# 19. Edit Visit Functionality

Admins and Managers must be able to edit existing visits to correct details, change schedules, or reassign users.

## Requirements
* **Access:** Accessible via the "Edit" button in the Visit List or the "Edit page" button in the Quick View drawer.
* **Pre-loading:** All form fields must be automatically populated with existing visit data.
* **Update Logic:** Changes must be validated (e.g., preventing past dates) and saved via the `PUT /api/client-visits/{id}` endpoint.
* **Audit Trail:** Any edits should be logged in the Activity Timeline with the user's name and timestamp.

---

# Final Implementation Instruction

Please first analyze the current UI flow and existing design architecture before implementation.

The new “Client Visit Management” module should integrate seamlessly into the current product and should not look like a separate system or externally added feature.
