export const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  task_only: "Task Only",
};

export function hasAnyRole(role, roles = []) {
  return roles.includes(role);
}

export function canManageClients(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canManageTasks(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}

export function canViewFtaTracker(role) {
  return hasAnyRole(role, ["admin", "manager"]);
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

export function canViewContacts(role) {
  return hasAnyRole(role, ["admin", "manager"]);
}
