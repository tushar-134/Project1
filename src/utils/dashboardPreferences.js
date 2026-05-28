import { sortOptionsWithOtherLast } from "./optionSort.js";

export const DEFAULT_DASHBOARD_TILE_ORDER = [
  "VAT",
  "Corporate Tax",
  "Audit",
  "Accounting",
  "MIS Reporting",
  "E-Invoicing",
  "VAT Refund",
  "Other",
];

const DASHBOARD_TILE_ORDER_EVENT = "dashboard-tile-order-changed";

function getPreferenceKey(user) {
  const userId = user?.id || user?._id || user?.email || "guest";
  return `filingBuddyDashboardTileOrder:${userId}`;
}

function getVisibilityPreferenceKey(user) {
  const userId = user?.id || user?._id || user?.email || "guest";
  return `filingBuddyDashboardTileVisibility:${userId}`;
}

function normalizeAvailableNames(availableNames) {
  const names = Array.isArray(availableNames) && availableNames.length ? availableNames : DEFAULT_DASHBOARD_TILE_ORDER;
  return sortOptionsWithOtherLast([...new Set(names.filter(Boolean))]);
}

function sanitizeOrder(order, availableNames) {
  const validOrder = normalizeAvailableNames(availableNames);
  const validNames = new Set(validOrder);
  const next = Array.isArray(order) ? order.filter((name) => validNames.has(name)) : [];
  const missing = validOrder.filter((name) => !next.includes(name));
  return [...next, ...missing];
}

function sanitizeVisibility(visibleNames, availableNames) {
  const validOrder = normalizeAvailableNames(availableNames);
  const validNames = new Set(validOrder);
  const next = Array.isArray(visibleNames) ? visibleNames.filter((name) => validNames.has(name)) : [];
  return next.length ? next : validOrder;
}

export function loadDashboardTileOrder(user, availableNames) {
  try {
    const raw = localStorage.getItem(getPreferenceKey(user));
    if (!raw) return sanitizeOrder(DEFAULT_DASHBOARD_TILE_ORDER, availableNames);
    return sanitizeOrder(JSON.parse(raw), availableNames);
  } catch {
    return sanitizeOrder(DEFAULT_DASHBOARD_TILE_ORDER, availableNames);
  }
}

export function loadDashboardTileVisibility(user, availableNames) {
  try {
    const raw = localStorage.getItem(getVisibilityPreferenceKey(user));
    if (!raw) return sanitizeVisibility(DEFAULT_DASHBOARD_TILE_ORDER, availableNames);
    return sanitizeVisibility(JSON.parse(raw), availableNames);
  } catch {
    return sanitizeVisibility(DEFAULT_DASHBOARD_TILE_ORDER, availableNames);
  }
}

export function saveDashboardTileOrder(user, order, availableNames) {
  const next = sanitizeOrder(order, availableNames);
  localStorage.setItem(getPreferenceKey(user), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { order: next } }));
  return next;
}

export function saveDashboardTileVisibility(user, visibleNames, availableNames) {
  const next = sanitizeVisibility(visibleNames, availableNames);
  localStorage.setItem(getVisibilityPreferenceKey(user), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { visible: next } }));
  return next;
}

export function clearDashboardTileOrder(user, availableNames) {
  const next = sanitizeOrder(DEFAULT_DASHBOARD_TILE_ORDER, availableNames);
  localStorage.removeItem(getPreferenceKey(user));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { order: next } }));
  return next;
}

export function clearDashboardTileVisibility(user, availableNames) {
  const next = sanitizeVisibility(DEFAULT_DASHBOARD_TILE_ORDER, availableNames);
  localStorage.removeItem(getVisibilityPreferenceKey(user));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { visible: next } }));
  return next;
}

export function subscribeDashboardTileOrder(listener) {
  window.addEventListener(DASHBOARD_TILE_ORDER_EVENT, listener);
  return () => window.removeEventListener(DASHBOARD_TILE_ORDER_EVENT, listener);
}
