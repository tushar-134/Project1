const Notification = require("../models/Notification");

exports.listNotifications = async (req, res, next) => {
  try {
    // The bell UI needs both the latest items and a count for unread badge rendering.
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(20),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (error) { next(error); }
};
exports.markAllRead = async (req, res, next) => {
  try { await Notification.updateMany({ recipient: req.user._id }, { isRead: true }); res.json({ message: "Marked read" }); } catch (error) { next(error); }
};
exports.markRead = async (req, res, next) => {
  try { res.json(await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true }, { new: true })); } catch (error) { next(error); }
};
