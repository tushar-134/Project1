import { useApp } from "../context/AppContext";
import { userService } from "../services/userService";

const roleLabel = { admin: "Admin", manager: "Manager", task_only: "Task Only" };
const roleApi = { Admin: "admin", Manager: "manager", "Task Only": "task_only" };

export function mapUser(user) {
  return { ...user, id: user._id, role: roleLabel[user.role] || user.role, status: user.isActive ? "Active" : "Inactive" };
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
  return { fetchUsers, createUser, updateUser: userService.update, deleteUser, updateRole, updateStatus };
}
