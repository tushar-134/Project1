export const DEFAULT_DASHBOARD_TILE_ORDER = [
  "VAT",
  "Corporate Tax",
  "Audit",
  "Accounting",
  "MIS Reporting",
  "E-Invoicing",
  "VAT Refund",
  "Other",
  "Trade Licence",
];

const DASHBOARD_TILE_ORDER_EVENT = "dashboard-tile-order-changed";

function getPreferenceKey(user) {
  const userId = user?.id || user?._id || user?.email || "guest";
  return `filingBuddyDashboardTileOrder:${userId}`;
}

function sanitizeOrder(order) {
  const validNames = new Set(DEFAULT_DASHBOARD_TILE_ORDER);
  const next = Array.isArray(order) ? order.filter((name) => validNames.has(name)) : [];
  const missing = DEFAULT_DASHBOARD_TILE_ORDER.filter((name) => !next.includes(name));
  return [...next, ...missing];
}

export function loadDashboardTileOrder(user) {
  try {
    const raw = localStorage.getItem(getPreferenceKey(user));
    if (!raw) return DEFAULT_DASHBOARD_TILE_ORDER;
    return sanitizeOrder(JSON.parse(raw));
  } catch {
    return DEFAULT_DASHBOARD_TILE_ORDER;
  }
}

export function saveDashboardTileOrder(user, order) {
  const next = sanitizeOrder(order);
  localStorage.setItem(getPreferenceKey(user), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { order: next } }));
  return next;
}

export function clearDashboardTileOrder(user) {
  localStorage.removeItem(getPreferenceKey(user));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TILE_ORDER_EVENT, { detail: { order: DEFAULT_DASHBOARD_TILE_ORDER } }));
  return DEFAULT_DASHBOARD_TILE_ORDER;
}

export function subscribeDashboardTileOrder(listener) {
  window.addEventListener(DASHBOARD_TILE_ORDER_EVENT, listener);
  return () => window.removeEventListener(DASHBOARD_TILE_ORDER_EVENT, listener);
}
