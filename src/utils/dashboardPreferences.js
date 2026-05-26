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

function normalizeAvailableNames(availableNames) {
  const names = Array.isArray(availableNames) && availableNames.length ? availableNames : DEFAULT_DASHBOARD_TILE_ORDER;
  return [...new Set(names.filter(Boolean))];
}

function sanitizeOrder(order, availableNames) {
  const validOrder = normalizeAvailableNames(availableNames);
  const validNames = new Set(validOrder);
  const next = Array.isArray(order) ? order.filter((name) => validNames.has(name)) : [];
  const missing = validOrder.filter((name) => !next.includes(name));
  return [...next, ...missing];
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

export function saveDashboardTileOrder(user, order, availableNames) {
  const next = sanitizeOrder(order, availableNames);
  localStorage.setItem(getPreferenceKey(user), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { order: next } }));
  return next;
}

export function clearDashboardTileOrder(user, availableNames) {
  const next = sanitizeOrder(DEFAULT_DASHBOARD_TILE_ORDER, availableNames);
  localStorage.removeItem(getPreferenceKey(user));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { order: next } }));
  return next;
}

export function subscribeDashboardTileOrder(listener) {
  window.addEventListener(DASHBOARD_TILE_ORDER_EVENT, listener);
  return () => window.removeEventListener(DASHBOARD_TILE_ORDER_EVENT, listener);
}
