// socket/handlers/notification.js
import Notification from "../../models/Notification.js";
import rooms from "../rooms.js";

export async function handleGetNotifications(socket, data) {
  try {
    const { limit = 20, unreadOnly = false } = data;
    const userId = socket.user.userId;

    let query = { userId };
    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    socket.emit("notifications", {
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    socket.emit("error", { message: "Failed to get notifications" });
  }
}

export async function handleMarkNotificationRead(socket, data) {
  try {
    const { notificationId } = data;

    await Notification.findByIdAndUpdate(notificationId, {
      read: true,
      readAt: new Date(),
    });

    socket.emit("notification_read", { notificationId });
  } catch (error) {
    console.error("Mark notification read error:", error);
  }
}

export async function handleMarkAllNotificationsRead(socket, data) {
  try {
    await Notification.updateMany(
      { userId: socket.user.userId, read: false },
      { read: true, readAt: new Date() },
    );

    socket.emit("all_notifications_read");
  } catch (error) {
    console.error("Mark all notifications read error:", error);
  }
}
