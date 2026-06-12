import { useApp } from "../context/AppContext";
import { userService } from "../services/userService";

const roleLabel = { admin: "Admin", manager: "Manager", associate: "Associate" };
const roleApi = { Admin: "admin", Manager: "manager", Associate: "associate" };

export function mapUser(user) {
  const dial = String(user.mobileCountryCode || "").trim();
  const num = String(user.mobile || "").trim();
  const mobile = [dial, num].filter(Boolean).join(" ").trim();
  return {
    ...user,
    id: user._id,
    mobile,
    role: roleLabel[user.role] || user.role,
    status: user.isActive ? "Active" : "Inactive",
    assignedClients: user.assignedClients || [],
  };
}

export function useUsers() {
  const { dispatch } = useApp();
  async function fetchUsers() {
    const users = (await userService.list()).map(mapUser);
    dispatch({ type: "SET_RESOURCE", resource: "users", payload: users });
    return users;
  }
  async function updateRole(id, label) {
    const user = await userService.updateRole(id, roleApi[label] || label);
    await fetchUsers();
    return user;
  }
  async function createUser(payload) {
    const user = await userService.create({ ...payload, role: roleApi[payload.role] || payload.role });
    await fetchUsers();
    return user;
  }
  async function updateUser(id, payload) {
    const user = await userService.update(id, { ...payload, role: roleApi[payload.role] || payload.role });
    await fetchUsers();
    return user;
  }
  async function deleteUser(id) {
    const result = await userService.remove(id);
    await fetchUsers();
    return result;
  }
  async function updateStatus(id, isActive) {
    const user = await userService.updateStatus(id, isActive);
    await fetchUsers();
    return user;
  }
  return { fetchUsers, createUser, updateUser, deleteUser, updateRole, updateStatus };
}
