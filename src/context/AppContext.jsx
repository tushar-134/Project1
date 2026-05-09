import { createContext, useContext, useMemo, useReducer } from "react";

const AppContext = createContext(null);

export const categoriesSeed = [
  { id: "vat", name: "VAT", icon: "Receipt", color: "#0ea5e9", description: "VAT filing and compliance", taskTypes: ["VAT Return", "VAT Refund Application", "VAT Registration", "VAT Deregistration", "VAT Amendment"] },
  { id: "ct", name: "CT", icon: "Landmark", color: "#7c3aed", description: "Corporate tax registrations and returns", taskTypes: ["CT Return", "CT Registration", "CT Deregistration", "Transfer Pricing", "Pillar Two Reporting"] },
  { id: "audit", name: "Audit", icon: "ClipboardCheck", color: "#dc2626", description: "Audit engagements", taskTypes: ["Statutory Audit", "Internal Audit", "Due Diligence", "Special Purpose Audit"] },
  { id: "accounting", name: "Accounting", icon: "Calculator", color: "#059669", description: "Books, payroll, and accounts", taskTypes: ["Monthly Accounting", "Quarterly Accounts", "Year-end Financials", "Bookkeeping", "Payroll Accounting"] },
  { id: "mis", name: "MIS", icon: "BarChart3", color: "#0891b2", description: "Management reporting", taskTypes: ["Monthly MIS", "Quarterly MIS", "Annual MIS", "Dashboard Preparation"] },
  { id: "einvoicing", name: "EInv", icon: "FileDigit", color: "#ea580c", description: "E-invoicing setup and portal work", taskTypes: ["E-Invoicing Setup", "Portal Updation", "E-Invoicing Compliance"] },
  { id: "refund", name: "Refund", icon: "RefreshCw", color: "#0ea5e9", description: "Refund applications and follow-up", taskTypes: ["VAT Refund Application", "VAT Refund Follow-up"] },
  { id: "other", name: "Other", icon: "Boxes", color: "#64748b", description: "Custom compliance tasks", taskTypes: ["ESR Notification", "UBO Registration", "Trade Licence Renewal", "MOA Amendment", "Custom Task"] },
];

const initialState = {
  clients: [],
  tasks: [],
  users: [],
  groups: [],
  ftaItems: [],
  categories: categoriesSeed,
  notifications: [],
  unreadCount: 0,
  activity: [],
  dashboardStats: null,
  loading: {},
  errors: {},
};

function reducer(state, action) {
  // Resources are normalized by screen-specific hooks and then stored here as UI-friendly state.
  switch (action.type) {
    case "SET_RESOURCE":
      return { ...state, [action.resource]: action.payload, loading: { ...state.loading, [action.resource]: false }, errors: { ...state.errors, [action.resource]: null } };
    case "SET_DASHBOARD":
      return { ...state, dashboardStats: action.payload, activity: action.payload.recentActivity || [] };
    case "SET_LOADING":
      return { ...state, loading: { ...state.loading, [action.resource]: action.value } };
    case "SET_ERROR":
      return { ...state, errors: { ...state.errors, [action.resource]: action.error }, loading: { ...state.loading, [action.resource]: false } };
    case "UPDATE_TASK_STATUS":
      return { ...state, tasks: state.tasks.map((task) => task._id === action.id || task.id === action.id ? { ...task, status: action.status, displayStatus: action.displayStatus || task.displayStatus } : task) };
    case "UPDATE_FTA_STATUS":
      return { ...state, ftaItems: state.ftaItems.map((item) => item._id === action.id || item.id === action.id ? { ...item, ftaStatus: action.status, status: action.displayStatus || item.status } : item) };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
