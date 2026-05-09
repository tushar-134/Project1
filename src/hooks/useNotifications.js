import { useApp } from "../context/AppContext";
import { notificationService } from "../services/notificationService";

export function useNotifications() {
  const { dispatch } = useApp();
  async function fetchNotifications() {
    // The API returns both the latest items and the unread count in one call for the bell badge.
    const data = await notificationService.list();
    dispatch({ type: "SET_RESOURCE", resource: "notifications", payload: data.notifications });
    dispatch({ type: "SET_RESOURCE", resource: "unreadCount", payload: data.unreadCount });
    return data;
  }
  async function markRead(id) {
    await notificationService.markRead(id);
    return fetchNotifications();
  }
  async function markAllRead() {
    await notificationService.markAllRead();
    return fetchNotifications();
  }
  return { fetchNotifications, markRead, markAllRead };
}
