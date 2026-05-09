const ClientGroup = require("../models/ClientGroup");
const Client = require("../models/Client");

exports.listGroups = async (req, res, next) => {
  try { res.json(await ClientGroup.find().populate("clients", "legalName fileNo").sort({ name: 1 })); } catch (error) { next(error); }
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
