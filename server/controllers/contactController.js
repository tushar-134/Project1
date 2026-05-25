const { validationResult } = require("express-validator");
const Contact = require("../models/Contact");

const populateContact = [{ path: "client", select: "legalName registeredAddress" }, { path: "createdBy", select: "name" }];

function normalizeCountryCode(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  const cleaned = `+${withPlus.replace(/[^\d]/g, "")}`;
  return cleaned === "+" ? "" : cleaned;
}

exports.listContacts = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };
    if (search) {
      query.$or = [
        { authorityName: new RegExp(search, "i") },
        { contactPersonName: new RegExp(search, "i") },
        { fullName: new RegExp(search, "i") },
        { designation: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { "mobile.number": new RegExp(search, "i") },
        { address: new RegExp(search, "i") },
        { location: new RegExp(search, "i") },
        { city: new RegExp(search, "i") },
      ];
    }
    const contacts = await Contact.find(query).populate(populateContact).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) { next(error); }
};

exports.createContact = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const contact = await Contact.create({
      authorityName: String(req.body.authorityName || "").trim(),
      contactPersonName: String(req.body.contactPersonName || "").trim(),
      fullName: String(req.body.contactPersonName || "").trim(),
      address: String(req.body.address || "").trim(),
      location: String(req.body.location || "").trim(),
      designation: String(req.body.designation || "").trim(),
      email: String(req.body.email || "").trim().toLowerCase(),
      mobile: {
        countryCode: normalizeCountryCode(req.body.mobile?.countryCode),
        number: String(req.body.mobile?.number || "").replace(/\D+/g, ""),
      },
      type: "Government Authority",
      createdBy: req.user._id,
    });
    res.status(201).json(await contact.populate(populateContact));
  } catch (error) { next(error); }
};

exports.updateContact = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const contact = await Contact.findById(req.params.id);
    if (!contact || !contact.isActive) return res.status(404).json({ message: "Contact not found" });
    const ALLOWED = ["authorityName", "contactPersonName", "designation", "email", "address", "location", "city"];
    ALLOWED.forEach((key) => {
      if (key in req.body) contact[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    });
    if ("mobile" in req.body) {
      const nextCountryCode = normalizeCountryCode(req.body.mobile?.countryCode);
      contact.mobile = {
        countryCode: nextCountryCode || contact.mobile?.countryCode || "",
        number: String(req.body.mobile?.number || "").replace(/\D+/g, ""),
      };
    }
    if ("email" in req.body) contact.email = String(req.body.email || "").trim().toLowerCase();
    if ("contactPersonName" in req.body) contact.fullName = String(req.body.contactPersonName || "").trim();
    contact.type = "Government Authority";
    await contact.save();
    res.json(await contact.populate(populateContact));
  } catch (error) { next(error); }
};

exports.deleteContact = async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json({ message: "Contact deleted" });
  } catch (error) { next(error); }
};
