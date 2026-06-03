export const statusToApi = {
  "Not yet started": "not_started",
  "In progress": "wip",
  Completed: "completed",
  "Submitted to FTA": "submitted_to_fta",
};

export const statusFromApi = {
  not_started: "Not yet started",
  wip: "In progress",
  completed: "Completed",
  submitted_to_fta: "Submitted to FTA",
};

export const ftaStatusToApi = {
  "In review": "in_review",
  "Additional query from FTA": "additional_query",
  Approved: "approved",
};

export const ftaStatusFromApi = {
  in_review: "In review",
  additional_query: "Additional query from FTA",
  approved: "Approved",
};

export function daysOverdue(dueDate, status) {
  if (!dueDate || status === "completed" || status === "Completed") return 0;
  const diff = Math.ceil((new Date() - new Date(dueDate)) / 86400000);
  return Math.max(0, diff);
}

export function mapClient(client) {
  const jurisdictionLabels = {
    mainland: "Mainland",
    freezone: "Free zone",
    designated_zone: "Designated zone",
    offshore: "Offshore",
  };
  const missingFields = Array.isArray(client.missingFields) ? client.missingFields : [];
  const isDraft = Boolean(client.isDraft || client.lifecycleStatus === "draft" || missingFields.length);
  const now = new Date();

  // Compute which documents are expired
  const expiredDocs = [];
  (client.tradeLicences || []).forEach((lic, i) => {
    if (lic.expiryDate && new Date(lic.expiryDate) < now) {
      expiredDocs.push({ type: "Trade Licence", label: lic.licenceNumber || `Licence ${i + 1}`, expiryDate: lic.expiryDate });
    }
  });
  (client.contactPersons || []).forEach((person) => {
    const name = person.fullName || "Contact";
    if (person.emiratesId?.expiryDate && new Date(person.emiratesId.expiryDate) < now) {
      expiredDocs.push({ type: "Emirates ID", label: name, expiryDate: person.emiratesId.expiryDate });
    }
    if (person.passport?.expiryDate && new Date(person.passport.expiryDate) < now) {
      expiredDocs.push({ type: "Passport", label: name, expiryDate: person.passport.expiryDate });
    }
  });

  return {
    ...client,
    id: client._id,
    name: client.legalName,
    type: client.clientType === "natural" ? "Natural person" : "Legal person",
    jurisdiction: jurisdictionLabels[client.jurisdiction] || client.jurisdiction,
    group: client.group?.name || "",
    assignedToName: client.assignedUser?.name || "",
    licence: client.tradeLicences?.[0]?.licenceNumber || "",
    licenceExpiry: client.tradeLicences?.[0]?.expiryDate ? client.tradeLicences[0].expiryDate.slice(0, 10) : "",
    vatTrn: client.vatDetails?.trn || "",
    contact: client.contactPersons?.find((p) => p.isPrimary)?.fullName || client.contactPersons?.[0]?.fullName || "",
    mobile: client.contactPersons?.[0]?.mobile ? `${client.contactPersons[0].mobile.countryCode || ""} ${client.contactPersons[0].mobile.number || ""}` : "",
    email: client.contactPersons?.[0]?.email || "",
    activeTasks: client.activeTasks || 0,
    createdAt: client.createdAt || null,
    createdByName: client.createdBy?.name || null,
    isDraft,
    lifecycleStatus: isDraft ? "draft" : "complete",
    missingFields,
    expiredDocs,
  };
}

export function mapTask(task) {
  const categoryLabels = {
    CT: "Corporate tax",
    MIS: "MIS reporting",
    EInv: "E-invoicing",
    Refund: "VAT refund",
  };
  return {
    ...task,
    id: task._id,
    taskId: task.taskId,
    client: task.client?.legalName || task.client,
    clientId: task.client?._id,
    category: categoryLabels[task.category] || task.category,
    type: task.taskType,
    dueDate: task.dueDate?.slice?.(0, 10) || task.dueDate,
    assigned: task.assignedTo?.name || "Unassigned",
    assignedId: task.assignedTo?._id,
    status: statusFromApi[task.status] || task.status,
    apiStatus: task.status,
    recurring: task.isRecurring,
    remarks: task.remarks || "",
    overdueDays: daysOverdue(task.dueDate, task.status),
    ftaStatus: task.ftaStatus,
    // Needed so TaskList can gate "Submitted to FTA" to FTA-tracked tasks only (BRD 5.4)
    isAwaitingFta: task.isAwaitingFta ?? false,
    // Date audit fields — full ISO strings are preserved so formatDateTime in
    // TaskList.jsx can extract the exact server-side time. Slicing to date-only
    // caused every time to display as 00:00 UTC (05:30 am local for IST/GST).
    createdAt: task.createdAt || null,
    updatedAt: task.updatedAt || null,
  };
}

export function mapFtaTask(task) {
  const ftaStat = task.ftaStatus || "in_review";
  return {
    ...mapTask(task),
    submitted: task.ftaSubmittedDate?.slice?.(0, 10) || task.createdAt?.slice?.(0, 10),
    status: ftaStatusFromApi[ftaStat] || ftaStat,
  };
}

export function mapCategory(category) {
  return {
    ...category,
    id: category._id || category.id,
    // We keep both a flattened list for the current UI and the raw task type documents
    // so admin actions can still address the real Mongo subdocument ids when needed.
    taskTypes: (category.taskTypes || []).filter((type) => type.isActive !== false).map((type) => typeof type === "string" ? type : type.name),
    rawTaskTypes: category.taskTypes || [],
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
