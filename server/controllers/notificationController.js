const Notification = require("../models/Notification");
const { createTtlCache } = require("../utils/ttlCache");

const notificationCache = createTtlCache(15_000);

exports.listNotifications = async (req, res, next) => {
  try {
    const cacheKey = String(req.user._id);
    const cached = notificationCache.get(cacheKey);
    if (cached) return res.json(cached);
    // The bell UI needs both the latest items and a count for unread badge rendering.
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(20),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);
    const payload = { notifications, unreadCount };
    notificationCache.set(cacheKey, payload);
    res.json(payload);
  } catch (error) { next(error); }
};
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id }, { isRead: true });
    notificationCache.del(String(req.user._id));
    res.json({ message: "Marked read" });
  } catch (error) { next(error); }
};
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { returnDocument: "after" }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    notificationCache.del(String(req.user._id));
    res.json(notification);
  } catch (error) { next(error); }
};
