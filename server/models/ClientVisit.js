const mongoose = require("mongoose");

const visitUserSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  checkInTime: { type: String, trim: true },
  checkOutTime: { type: String, trim: true },
}, { _id: true });

const clientVisitSchema = new mongoose.Schema({
  visitDate: { type: Date, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  visitors: {
    type: [visitUserSchema],
    validate: {
      validator(value) {
        return Array.isArray(value) && value.length > 0;
      },
      message: "At least one visiting user is required.",
    },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

clientVisitSchema.index({ visitDate: -1 });
clientVisitSchema.index({ client: 1, visitDate: -1 });
clientVisitSchema.index({ "visitors.user": 1, visitDate: -1 });

module.exports = mongoose.model("ClientVisit", clientVisitSchema);
