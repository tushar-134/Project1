import { useCallback, useRef } from "react";
import { useApp } from "../context/AppContext";
import { notificationService } from "../services/notificationService";

export function useNotifications() {
  const { dispatch } = useApp();
  const latestRequestRef = useRef(0);
  // Track IDs that are being dismissed so polling doesn't resurrect them.
  const dismissingRef = useRef(new Set());

  const fetchNotifications = useCallback(async function fetchNotifications() {
    // The API returns both the latest items and the unread count in one call for the bell badge.
    const requestId = ++latestRequestRef.current;
    const data = await notificationService.list();
    if (requestId !== latestRequestRef.current) return data;
    // Only keep unread notifications in state — read ones should not appear in the panel.
    // Filter out any IDs that are in the middle of being dismissed to avoid flickering.
    const unreadOnly = (data.notifications || []).filter(
      (n) => !n.isRead && !dismissingRef.current.has(n._id)
    );
    dispatch({ type: "SET_RESOURCE", resource: "notifications", payload: unreadOnly });
    dispatch({ type: "SET_RESOURCE", resource: "unreadCount", payload: data.unreadCount });
    return data;
  }, [dispatch]);

  const markRead = useCallback(async (id) => {
    // Track that this ID is being dismissed so polling doesn't bring it back.
    dismissingRef.current.add(id);
    // Remove from panel immediately so it disappears after the user reads it.
    dispatch({ type: "REMOVE_NOTIFICATION", id });
    try {
      await notificationService.markRead(id);
    } catch {
      // If the API fails, the next poll will re-sync
    } finally {
      dismissingRef.current.delete(id);
    }
  }, [dispatch]);

  const markAllRead = useCallback(async () => {
    // Clear the panel immediately, then tell the server.
    dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" });
    try {
      await notificationService.markAllRead();
    } catch {
      // If the API fails, the next poll will re-sync
    }
  }, [dispatch]);

  return { fetchNotifications, markRead, markAllRead };
}
