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
    // Only keep unread notifications in state — read ones should not appear in the panel.
    const unreadOnly = (data.notifications || []).filter((n) => !n.isRead);
    dispatch({ type: "SET_RESOURCE", resource: "notifications", payload: unreadOnly });
    dispatch({ type: "SET_RESOURCE", resource: "unreadCount", payload: data.unreadCount });
    return data;
  }

  async function markRead(id) {
    // Fire-and-forget API call; UI removal happens via REMOVE_NOTIFICATION dispatch.
    notificationService.markRead(id).catch(() => {});
    // Remove from panel immediately so it disappears after the user reads it.
    dispatch({ type: "REMOVE_NOTIFICATION", id });
  }

  async function markAllRead() {
    // Fire-and-forget API call; UI clears immediately via MARK_ALL_NOTIFICATIONS_READ.
    notificationService.markAllRead().catch(() => {});
    dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" });
  }

  return { fetchNotifications, markRead, markAllRead };
}
