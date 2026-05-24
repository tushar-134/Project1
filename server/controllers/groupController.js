const ClientGroup = require("../models/ClientGroup");
const Client = require("../models/Client");

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvEscape).join(",");
}

function sendCsv(res, filename, csv) {
  // Express 5 removed res.attachment(); set headers explicitly.
  res
    .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .send(`\uFEFF${csv}`);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const search = String(query.search || "").trim();
  const requested = ["page", "limit", "search"].some((key) => Object.prototype.hasOwnProperty.call(query, key));
  return { page, limit, search, requested };
}

function formatMobile(contact) {
  if (!contact?.mobile) return "";
  return [contact.mobile.countryCode, contact.mobile.number].filter(Boolean).join(" ");
}

function clientExportRow(client, groupName = client.group?.name || "") {
  const primaryContact = client.contactPersons?.find((person) => person.isPrimary) || client.contactPersons?.[0] || {};
  return [
    client.fileNo || "",
    client.legalName || "",
    client.clientType || "",
    client.jurisdiction || "",
    groupName,
    client.tradeLicences?.[0]?.licenceNumber || "",
    client.vatDetails?.trn || "",
    primaryContact.fullName || "",
    formatMobile(primaryContact),
    primaryContact.email || "",
  ];
}

const CLIENT_EXPORT_HEADERS = [
  "File No",
  "Client Name",
  "Client Type",
  "Jurisdiction",
  "Group",
  "Trade Licence No.",
  "VAT TRN",
  "Primary Contact",
  "Mobile",
  "Email",
];

exports.listGroups = async (req, res, next) => {
  try {
    const { page, limit, search, requested } = parsePagination(req.query);
    const query = search ? { name: new RegExp(escapeRegex(search), "i") } : {};
    const groupsQuery = ClientGroup.find(query).populate("clients", "legalName fileNo").sort({ name: 1 });
    if (requested) groupsQuery.skip((page - 1) * limit).limit(limit);
    const [groups, total] = await Promise.all([
      groupsQuery,
      requested ? ClientGroup.countDocuments(query) : ClientGroup.countDocuments(),
    ]);
    if (!requested) return res.json(groups);
    res.json({ items: groups, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};
exports.createGroup = async (req, res, next) => {
  try {
    const group = await ClientGroup.create({ name: req.body.name, clients: req.body.clients || [], createdBy: req.user._id });
    if (group.clients.length) await Client.updateMany({ _id: { $in: group.clients } }, { group: group._id });
    res.status(201).json(await group.populate("clients", "legalName fileNo"));
  } catch (error) { next(error); }
};
exports.updateGroup = async (req, res, next) => {
  try { res.json(await ClientGroup.findByIdAndUpdate(req.params.id, { name: req.body.name }, { new: true }).populate("clients", "legalName fileNo")); } catch (error) { next(error); }
};
exports.updateGroupClients = async (req, res, next) => {
  try {
    // Group edits must update both the group document and the client.group back-reference.
    const group = await ClientGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    const add = req.body.add || [];
    const remove = req.body.remove || [];
    group.clients = [...new Set([...group.clients.map(String), ...add.map(String)])].filter((id) => !remove.map(String).includes(id));
    await group.save();
    if (add.length) await Client.updateMany({ _id: { $in: add } }, { group: group._id });
    if (remove.length) await Client.updateMany({ _id: { $in: remove } }, { $unset: { group: "" } });
    res.json(await group.populate("clients", "legalName fileNo"));
  } catch (error) { next(error); }
};
exports.deleteGroup = async (req, res, next) => {
  try {
    await Client.updateMany({ group: req.params.id }, { $unset: { group: "" } });
    await ClientGroup.findByIdAndDelete(req.params.id);
    res.json({ message: "Group deleted" });
  } catch (error) { next(error); }
};

exports.exportGroups = async (req, res, next) => {
  try {
    const mode = String(req.query.mode || "group").toLowerCase();
    const groupId = req.query.groupId ? String(req.query.groupId) : null;
    const clientId = req.query.clientId ? String(req.query.clientId) : null;

    if (mode === "client" || mode === "clients") {
      const query = { isActive: true };
      if (groupId) query.group = groupId;
      if (clientId) query._id = clientId;

      const clients = await Client.find(query).populate("group", "name").sort({ fileNo: 1 });
      const csv = [CLIENT_EXPORT_HEADERS, ...clients.map((client) => clientExportRow(client))]
        .map(csvRow)
        .join("\r\n");

      return sendCsv(res, clientId ? "client.csv" : groupId ? "group-clients.csv" : "clients.csv", csv);
    }

    const groupQuery = groupId ? { _id: groupId } : {};
    const groups = await ClientGroup.find(groupQuery)
      .populate("clients")
      .sort({ name: 1 });

    const rows = groups.flatMap((group) => {
      const clients = group.clients || [];
      if (!clients.length) return [[group.name, 0, ...Array(CLIENT_EXPORT_HEADERS.length).fill("")]];
      return clients.map((client) => [
        group.name,
        clients.length,
        ...clientExportRow(client, group.name),
      ]);
    });
    const csv = [["Group Name", "Client Count", ...CLIENT_EXPORT_HEADERS], ...rows]
      .map(csvRow)
      .join("\r\n");

    return sendCsv(res, groupId ? "client-group.csv" : "client-groups.csv", csv);
  } catch (error) {
    next(error);
  }
};
