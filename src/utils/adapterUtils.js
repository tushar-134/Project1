export const statusToApi = {
  "Not Yet Started": "not_started",
  WIP: "wip",
  Completed: "completed",
  "Submitted to FTA": "submitted_to_fta",
};

export const statusFromApi = {
  not_started: "Not Yet Started",
  wip: "WIP",
  completed: "Completed",
  submitted_to_fta: "Submitted to FTA",
};

export const ftaStatusToApi = {
  "In Review": "in_review",
  "Additional Query From FTA": "additional_query",
  Approved: "approved",
};

export const ftaStatusFromApi = {
  in_review: "In Review",
  additional_query: "Additional Query From FTA",
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
    freezone: "Free Zone",
    designated_zone: "Designated Zone",
    offshore: "Offshore",
  };

  // Collect all uploaded documents across trade licences and contact persons
  const documents = [];
  (client.tradeLicences || []).forEach((lic, i) => {
    if (lic.documentUrl) {
      documents.push({
        label: `Trade Licence${(client.tradeLicences.length > 1) ? ` ${i + 1}` : ""} — ${lic.licenceNumber || "Document"}`,
        filename: lic.documentUrl.split("/").pop(),
        url: lic.documentUrl,
      });
    }
  });
  (client.contactPersons || []).forEach((person, i) => {
    const suffix = (client.contactPersons.length > 1) ? ` (${person.fullName || `Contact ${i + 1}`})` : "";
    if (person.emiratesId?.documentUrl) {
      documents.push({
        label: `Emirates ID${suffix}`,
        filename: person.emiratesId.documentUrl.split("/").pop(),
        url: person.emiratesId.documentUrl,
      });
    }
    if (person.passport?.documentUrl) {
      documents.push({
        label: `Passport${suffix}`,
        filename: person.passport.documentUrl.split("/").pop(),
        url: person.passport.documentUrl,
      });
    }
  });

  return {
    ...client,
    id: client._id,
    name: client.legalName,
    type: client.clientType === "natural" ? "Natural Person" : "Legal Person",
    jurisdiction: jurisdictionLabels[client.jurisdiction] || client.jurisdiction,
    group: client.group?.name || "",
    licence: client.tradeLicences?.[0]?.licenceNumber || "",
    vatTrn: client.vatDetails?.trn || "",
    contact: client.contactPersons?.find((p) => p.isPrimary)?.fullName || client.contactPersons?.[0]?.fullName || "",
    mobile: client.contactPersons?.[0]?.mobile ? `${client.contactPersons[0].mobile.countryCode || ""} ${client.contactPersons[0].mobile.number || ""}` : "",
    email: client.contactPersons?.[0]?.email || "",
    documents,
  };
}


export function mapTask(task) {
  const categoryLabels = {
    CT: "Corporate Tax",
    MIS: "MIS Reporting",
    EInv: "E-Invoicing",
    Refund: "VAT Refund",
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
    overdueDays: daysOverdue(task.dueDate, task.status),
    // Needed so TaskList can gate "Submitted to FTA" to FTA-tracked tasks only (BRD 5.4)
    isAwaitingFta: task.isAwaitingFta ?? false,
  };
}

export function mapFtaTask(task) {
  return {
    ...mapTask(task),
    submitted: task.ftaSubmittedDate?.slice?.(0, 10) || task.createdAt?.slice?.(0, 10),
    status: ftaStatusFromApi[task.ftaStatus] || task.ftaStatus,
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
