import { useRef } from "react";
import { useApp } from "../context/AppContext";
import { notificationService } from "../services/notificationService";

export function useNotifications() {
  const { dispatch } = useApp();
  const latestRequestRef = useRef(0);
  async function fetchNotifications() {
    // The API returns both the latest items and the unread count in one call for the bell badge.
    const requestId = ++latestRequestRef.current;
    const data = await notificationService.list();
    if (requestId !== latestRequestRef.current) return data;
    dispatch({ type: "SET_RESOURCE", resource: "notifications", payload: data.notifications });
    dispatch({ type: "SET_RESOURCE", resource: "unreadCount", payload: data.unreadCount });
    return data;
  }
  async function markRead(id) {
    await notificationService.markRead(id);
    dispatch({ type: "MARK_NOTIFICATION_READ", id });
    return fetchNotifications();
  }
  async function markAllRead() {
    await notificationService.markAllRead();
    dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" });
    return fetchNotifications();
  }
  return { fetchNotifications, markRead, markAllRead };
}
