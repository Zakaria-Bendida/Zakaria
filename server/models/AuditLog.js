// models/AuditLog.js (ESM version)
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },
  userEmail: String,
  userRole: String,
  action: {
    type: String,
    required: true,
    enum: [
      "CREATE",
      "READ",
      "UPDATE",
      "DELETE",
      "ASSIGN",
      "LOGIN",
      "LOGOUT",
      "CANCEL",
      "COMPLETE",
    ],
  },
  resource: {
    type: String,
    required: true,
    enum: ["ambulance", "intervention", "user", "routing", "statistics"],
  },
  resourceId: {
    type: String,
    index: true,
  },
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  changes: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  status: {
    type: String,
    enum: ["SUCCESS", "FAILED"],
    default: "SUCCESS",
  },
  errorMessage: String,
  duration: Number, // Response time in ms
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// TTL index to auto-delete old logs (keep 90 days)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
