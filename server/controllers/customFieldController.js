const CustomField = require("../models/CustomField");

exports.getCustomFields = async (req, res) => {
  try {
    const fields = await CustomField.find({ isActive: true }).sort({ createdAt: 1 });
    res.json(fields);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCustomField = async (req, res) => {
  try {
    const { label, key, type, options, required } = req.body;
    
    // Check if key already exists
    const existing = await CustomField.findOne({ key });
    if (existing) {
      return res.status(400).json({ message: "A field with this key already exists." });
    }

    const field = await CustomField.create({
      label,
      key,
      type,
      options,
      required,
      createdBy: req.user._id
    });
    res.status(201).json(field);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateCustomField = async (req, res) => {
  try {
    const field = await CustomField.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!field) return res.status(404).json({ message: "Custom field not found" });
    res.json(field);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteCustomField = async (req, res) => {
  try {
    // We do soft delete to preserve data integrity for existing clients
    const field = await CustomField.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!field) return res.status(404).json({ message: "Custom field not found" });
    res.json({ message: "Custom field removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
