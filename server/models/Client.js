const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema({
  name: String,
  size: String,
  fileType: String,
  description: String,
  url: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const clientSchema = new mongoose.Schema({
  fileNo: { type: String, unique: true },
  clientType: { type: String, enum: ["legal", "natural"], required: true },
  legalName: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator(value) {
        return String(value || "").trim().length > 0;
      },
      message: "Legal name is required.",
    },
  },
  tradeName: String,
  financialYearEnd: String,
  jurisdiction: { type: String, enum: ["mainland", "freezone", "designated_zone", "offshore"] },
  assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  registeredAddress: { country: String, emirate: String, street: String, poBox: String, postalCode: String },
  correspondenceAddress: { country: String, emirate: String, street: String },
  tradeLicences: [{
    licenceNumber: { type: String, required: true, trim: true },
    issuingAuthority: String,
    officialEmail: String,
    licenceType: { type: String, enum: ["commercial", "professional", "industrial", "tourism"], default: "commercial" },
    issueDate: Date,
    expiryDate: Date,
    documentUrl: String,
    documents: [uploadedFileSchema],
  }],
  contactPersons: [{
    fullName: String,
    designation: String,
    email: String,
    whatsapp: String,
    alternateEmail: String,
    mobile: { countryCode: String, number: String },
    isPrimary: { type: Boolean, default: false },
    emiratesId: {
      number: String,
      issueDate: Date,
      expiryDate: Date,
      documentUrl: String,
      documents: [uploadedFileSchema],
      frontDocumentUrl: String,
      backDocumentUrl: String,
      frontDocuments: [uploadedFileSchema],
      backDocuments: [uploadedFileSchema],
    },
    passport: { number: String, issuingCountry: String, issueDate: Date, expiryDate: Date, documentUrl: String, documents: [uploadedFileSchema] },
  }],
  vatDetails: {
    trn: String,
    status: { type: String, enum: ["registered", "applying", "not_registered", "exempt"], default: "not_registered" },
    registrationDate: Date,
    filingFrequency: { type: String, default: "Jan-Mar" },
    registrationTask: String,
    registrationTaskId: String,
  },
  ctDetails: {
    tin: String,
    status: { type: String, enum: ["registered", "applying", "not_registered", "exempt"], default: "not_registered" },
    registrationDate: Date,
    financialYearEnd: String,
    registrationTask: String,
    registrationTaskId: String,
  },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "ClientGroup" },
  portalLogins: [{ portalName: String, portalUrl: String, username: String, password: String, notes: String }],
  // customFields: { qrmpPreference: String, auditFirmName: String, bankName: String, iban: String },
  customFields: { type: Map, of: String },
  attachments: [uploadedFileSchema],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

clientSchema.index({ isActive: 1, createdAt: -1 });
clientSchema.index({ isActive: 1, jurisdiction: 1, createdAt: -1 });
clientSchema.index({ isActive: 1, group: 1, createdAt: -1 });
clientSchema.index({ isActive: 1, assignedUser: 1, createdAt: -1 });
clientSchema.index({ legalName: 1 });
clientSchema.index({ "vatDetails.trn": 1 });
clientSchema.index({ "tradeLicences.licenceNumber": 1 }, { unique: true, sparse: true });
clientSchema.index({ group: 1 });

module.exports = mongoose.model("Client", clientSchema);
