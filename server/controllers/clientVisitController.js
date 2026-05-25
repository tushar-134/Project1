const { validationResult } = require("express-validator");
const ClientVisit = require("../models/ClientVisit");

const populateVisit = [
  { path: "client", select: "legalName fileNo" },
  { path: "visitors.user", select: "name role email" },
  { path: "createdBy", select: "name" },
];

function uniqueVisitors(visitors = []) {
  const byUser = new Map();
  visitors.forEach((visitor) => {
    const userId = String(visitor?.user || "").trim();
    if (!userId || byUser.has(userId)) return;
    byUser.set(userId, {
      user: userId,
      checkInTime: String(visitor?.checkInTime || "").trim(),
      checkOutTime: String(visitor?.checkOutTime || "").trim(),
    });
  });
  return [...byUser.values()];
}

exports.listVisits = async (req, res, next) => {
  try {
    const { search } = req.query;
    let visits = await ClientVisit.find({}).populate(populateVisit).sort({ visitDate: -1, createdAt: -1 });

    if (search) {
      const term = String(search).trim().toLowerCase();
      visits = visits.filter((visit) => {
        const clientName = String(visit.client?.legalName || "").toLowerCase();
        const fileNo = String(visit.client?.fileNo || "").toLowerCase();
        const visitorNames = visit.visitors.map((entry) => String(entry.user?.name || "").toLowerCase());
        return clientName.includes(term) || fileNo.includes(term) || visitorNames.some((name) => name.includes(term));
      });
    }

    res.json(visits);
  } catch (error) {
    next(error);
  }
};

exports.createVisit = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const visitors = uniqueVisitors(req.body.visitors);
    if (!visitors.length) {
      return res.status(400).json({ message: "Please select at least one visiting user." });
    }

    const visit = await ClientVisit.create({
      visitDate: req.body.visitDate,
      client: req.body.client,
      visitors,
      createdBy: req.user._id,
    });

    res.status(201).json(await visit.populate(populateVisit));
  } catch (error) {
    next(error);
  }
};

exports.updateVisitorTimes = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const visit = await ClientVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: "Visit record not found" });

    const visitor = visit.visitors.id(req.params.visitorId);
    if (!visitor) return res.status(404).json({ message: "Visitor entry not found" });

    if (String(visitor.checkInTime || "").trim() || String(visitor.checkOutTime || "").trim()) {
      return res.status(409).json({ message: "Visit timing is already locked for this user." });
    }

    if ("checkInTime" in req.body) visitor.checkInTime = String(req.body.checkInTime || "").trim();
    if ("checkOutTime" in req.body) visitor.checkOutTime = String(req.body.checkOutTime || "").trim();

    await visit.save();
    res.json(await visit.populate(populateVisit));
  } catch (error) {
    next(error);
  }
};
