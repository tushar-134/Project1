const crypto = require("crypto");
const mongoose = require("mongoose");

const secret = crypto.createHash("sha256").update(process.env.JWT_SECRET || "filing-buddy-dev").digest();

function encrypt(value) {
  if (!value) return value;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", secret, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

// Portal passwords are encrypted before persistence because the UI treats them as operational secrets.
const clientSchema = new mongoose.Schema({
  fileNo: { type: String, unique: true },
  clientType: { type: String, enum: ["legal", "natural"], required: true },
  legalName: { type: String, required: true, trim: true },
  tradeName: String,
  financialYearEnd: String,
  jurisdiction: { type: String, enum: ["mainland", "freezone", "designated_zone", "offshore"] },
  assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  registeredAddress: { country: String, emirate: String, street: String, poBox: String, postalCode: String },
  correspondenceAddress: { country: String, emirate: String, street: String },
  tradeLicences: [{
    licenceNumber: String,
    issuingAuthority: String,
    officialEmail: String,
    licenceType: { type: String, enum: ["commercial", "professional", "industrial", "tourism"], default: "commercial" },
    issueDate: Date,
    expiryDate: Date,
    documentUrl: String,
  }],
  contactPersons: [{
    fullName: String,
    designation: String,
    email: String,
    whatsapp: String,
    alternateEmail: String,
    mobile: { countryCode: String, number: String },
    isPrimary: { type: Boolean, default: false },
    emiratesId: { number: String, issueDate: Date, expiryDate: Date, documentUrl: String },
    passport: { number: String, issuingCountry: String, issueDate: Date, expiryDate: Date, documentUrl: String },
  }],
  vatDetails: {
    trn: String,
    status: { type: String, enum: ["registered", "applying", "not_registered", "exempt"], default: "not_registered" },
    registrationDate: Date,
    filingFrequency: { type: String, enum: ["monthly", "quarterly", "annual"], default: "quarterly" },
  },
  ctDetails: {
    tin: String,
    status: { type: String, enum: ["registered", "applying", "not_registered", "exempt"], default: "not_registered" },
    registrationDate: Date,
    financialYearEnd: String,
  },
  group: { type: mongoose.Schema.Types.ObjectId, ref: "ClientGroup" },
  // Bug #6 Fix: added _passwordEncrypted flag so we never use a colon-sniff heuristic
  // that breaks legitimate passwords containing a colon character (e.g. "p:assword").
  portalLogins: [{ portalName: String, portalUrl: String, username: String, password: String, _passwordEncrypted: { type: Boolean, default: false }, notes: String }],
  customFields: { qrmpPreference: String, auditFirmName: String, bankName: String, iban: String },
  attachments: [{
    name: String,
    size: String,
    fileType: String,
    description: String,
    url: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
  }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

clientSchema.pre("save", function encryptPortalPasswords() {
  if (this.isModified("portalLogins")) {
    this.portalLogins.forEach((portal) => {
      // Bug #6 Fix: use an explicit _passwordEncrypted flag instead of checking
      // for a colon, which would break any password that legitimately contains ":".
      if (portal.password && !portal._passwordEncrypted) {
        portal.password = encrypt(portal.password);
        portal._passwordEncrypted = true;
      }
    });
  }
});

module.exports = mongoose.model("Client", clientSchema);
