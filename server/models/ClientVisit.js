const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  message: { type: String, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const assignedUserSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  checkInAt: Date,
  checkOutAt: Date,
  durationMinutes: Number,
  visitSummary: String,
  followUpRequired: { type: Boolean, default: false },
  notes: String,
  gpsLocation: String,
  selfieUrl: String,
}, { _id: true });

const legacyVisitUserSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  checkInTime: { type: String, trim: true },
  checkOutTime: { type: String, trim: true },
}, { _id: true });

const newClientSchema = new mongoose.Schema({
  authorityName: { type: String, trim: true },
  contactPersonName: { type: String, trim: true },
  mobileCountryCode: { type: String, trim: true },
  mobileNumber: { type: String, trim: true },
  email: { type: String, trim: true },
  location: { type: String, trim: true },
}, { _id: false });

const clientVisitSchema = new mongoose.Schema({
  visitId: { type: String, trim: true, unique: true, sparse: true },
  clientType: { type: String, enum: ["existing", "new"], default: "existing" },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  newClient: newClientSchema,
  visitDate: { type: Date, required: true },
  visitTime: { type: String, trim: true },
  visitType: { type: String, trim: true, default: "Requirement Gathering" },
  location: { type: String, trim: true },
  remarks: { type: String, trim: true },
  status: {
    type: String,
    enum: ["planned", "in_progress", "completed", "cancelled"],
    default: "planned",
  },
  assignedUsers: {
    type: [assignedUserSchema],
    validate: {
      validator(value) {
        return Array.isArray(value) && value.length > 0;
      },
      message: "At least one assigned user is required.",
    },
  },
  activityLogs: { type: [activityLogSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Legacy fields preserved for backfill/migration of existing records.
  visitors: { type: [legacyVisitUserSchema], default: undefined },
}, { timestamps: true });

clientVisitSchema.index({ visitDate: -1, createdAt: -1 });
clientVisitSchema.index({ client: 1, visitDate: -1 });
clientVisitSchema.index({ "assignedUsers.user": 1, visitDate: -1 });
clientVisitSchema.index({ status: 1, visitDate: -1 });

module.exports = mongoose.model("ClientVisit", clientVisitSchema);
