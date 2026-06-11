export const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  associate: "Associate",
  task_only: "Associate", // legacy — DB rows not yet migrated
};

export function hasAnyRole(role, roles = []) {
  return roles.includes(role);
}

// ── Associates can be stored as "associate" (new) OR "task_only" (legacy) ──
// All permission helpers that should apply to associates check for both.
const ASSOCIATE_ROLES = ["associate", "task_only"];

export function canManageClients(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canCreateClients(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canManageTasks(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canViewFtaTracker(role) {
  return hasAnyRole(role, ["admin", "manager", ...ASSOCIATE_ROLES]);
}

export function canManageCategories(role) {
  return hasAnyRole(role, ["admin"]);
}

export function canManageUsers(role) {
  return hasAnyRole(role, ["admin"]);
}

export function canViewUsers(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canManageGroups(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canViewReports(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

// Contact Directory is restricted to admin and manager only.
// Associates (both "associate" and legacy "task_only") must NOT see this.
export function canViewContacts(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canViewClientVisits(role) {
  return hasAnyRole(role, ["admin", "manager", ...ASSOCIATE_ROLES]);
}

export function canManageClientVisits(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}
