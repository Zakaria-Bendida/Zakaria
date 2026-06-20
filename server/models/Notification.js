// models/Notification.js (ESM version)
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userRole: {
      type: String,
      enum: ["user", "ambulancier", "manager"],
      required: true,
    },
    type: {
      type: String,
      enum: [
        "new_intervention",
        "intervention_assigned",
        "status_change",
        "location_update",
        "eta_update",
        "arrived_scene",
        "intervention_completed",
        "new_message",
        "emergency_alert",
      ],
      required: true,
    },
    title: String,
    body: String,
    data: Object,
    interventionId: Number,
    ambulanceId: Number,
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    sent: {
      type: Boolean,
      default: true,
    },
    deliveredAt: Date,
    priority: {
      type: String,
      enum: ["low", "normal", "high", "emergency"],
      default: "normal",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
