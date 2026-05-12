const { validationResult } = require("express-validator");
const Client = require("../models/Client");
const User = require("../models/User");
const Notification = require("../models/Notification");
const ActivityLog = require("../models/ActivityLog");
const { nextClientFileNo } = require("../utils/autoId");

const populateClient = [{ path: "assignedUser", select: "name" }, { path: "group", select: "name" }, { path: "createdBy", select: "name" }];

exports.listClients = async (req, res, next) => {
  try {
    const { search, jurisdiction, group, assignedUser, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (jurisdiction) query.jurisdiction = jurisdiction;
    if (group) query.group = group;
    if (assignedUser) query.assignedUser = assignedUser;
    if (search) {
      query.$or = [
        { legalName: new RegExp(search, "i") },
        { tradeName: new RegExp(search, "i") },
        { "vatDetails.trn": new RegExp(search, "i") },
        { "tradeLicences.licenceNumber": new RegExp(search, "i") },
      ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [clients, total] = await Promise.all([
      Client.find(query).populate(populateClient).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Client.countDocuments(query),
    ]);
    res.json({ clients, total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 });
  } catch (error) { next(error); }
};

exports.getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id).populate(populateClient).populate("attachments.uploadedBy", "name");
    if (!client || !client.isActive) return res.status(404).json({ message: "Client not found" });
    res.json(client);
  } catch (error) { next(error); }
};

exports.createClient = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const client = await Client.create({ ...req.body, fileNo: await nextClientFileNo(), createdBy: req.user._id });
    const admins = await User.find({ role: "admin", isActive: true });
    await Notification.insertMany(admins.map((admin) => ({
      recipient: admin._id, title: "New client added", message: `${client.legalName} was added.`, type: "client_added", relatedClient: client._id,
    })));
    res.status(201).json(client);
  } catch (error) { next(error); }
};

exports.updateClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || !client.isActive) return res.status(404).json({ message: "Client not found" });
    // Bug #4 Fix: whitelist editable fields to prevent mass-assignment of fileNo, createdBy, isActive, etc.
    const ALLOWED = ["legalName", "tradeName", "clientType", "jurisdiction", "financialYearEnd", "assignedUser", "group", "registeredAddress", "correspondenceAddress", "tradeLicences", "contactPersons", "vatDetails", "ctDetails", "portalLogins", "customFields"];
    ALLOWED.forEach((key) => { if (key in req.body) client[key] = req.body[key]; });
    await client.save();
    res.json(client);
  } catch (error) { next(error); }
};

exports.deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json({ message: "Client deleted" });
  } catch (error) { next(error); }
};

exports.bulkUpload = async (req, res, next) => {
  try {
    // Bulk upload accepts already-parsed rows from the browser so the backend can focus on validation and dedupe.
    const rows = Array.isArray(req.body.rows) ? req.body.rows : req.body;
    let added = 0, skipped = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const trn = row.vatTrn || row.trn || row["VAT TRN"];
        const licence = row.licenceNumber || row.licence || row["Trade Licence No."];
        const exists = await Client.findOne({ $or: [{ "vatDetails.trn": trn }, { "tradeLicences.licenceNumber": licence }].filter((q) => Object.values(q)[0]) });
        if (exists) { skipped += 1; continue; }
        await Client.create({
          fileNo: await nextClientFileNo(),
          clientType: row.clientType || "legal",
          legalName: row.legalName || row.name,
          jurisdiction: row.jurisdiction || "mainland",
          vatDetails: { trn },
          tradeLicences: licence ? [{ licenceNumber: licence }] : [],
          createdBy: req.user._id,
        });
        added += 1;
      } catch (error) { errors.push({ row, message: error.message }); }
    }
    res.json({ added, skipped, errors });
  } catch (error) { next(error); }
};

exports.exportClients = async (req, res, next) => {
  try {
    const clients = await Client.find({ isActive: true }).populate("group", "name");
    const csv = ["File No,Name,Jurisdiction,Group,VAT TRN"].concat(clients.map((c) => [c.fileNo, c.legalName, c.jurisdiction, c.group?.name || "", c.vatDetails?.trn || ""].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))).join("\n");
    // Bug #2 Fix: res.attachment() was removed in Express 5; use setHeader instead.
    res.setHeader("Content-Disposition", 'attachment; filename="clients.csv"')
       .setHeader("Content-Type", "text/csv")
       .send(csv);
  } catch (error) { next(error); }
};

exports.uploadAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    client.attachments.push({
      name: req.file.originalname,
      size: `${Math.round(req.file.size / 1024)} KB`,
      fileType: req.file.mimetype,
      description: req.body.description,
      url: req.file.path,
      uploadedBy: req.user._id,
    });
    await client.save();
    res.status(201).json(client.attachments);
  } catch (error) { next(error); }
};

exports.deleteAttachment = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });
    client.attachments.pull(req.params.attachId);
    await client.save();
    res.json(client.attachments);
  } catch (error) { next(error); }
};
