// models/Session.js (ESM version)
import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  refreshToken: {
    type: String,
    unique: true,
    sparse: true,
  },
  deviceInfo: String,
  ipAddress: String,
  userAgent: String,
  expiresAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1 });

const Session = mongoose.model("Session", sessionSchema);

export default Session;
