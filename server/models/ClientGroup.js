const mongoose = require("mongoose");

// Groups are simple containers; the richer client summary is assembled in controllers and adapters.
const clientGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  clients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("ClientGroup", clientGroupSchema);
