// models/User.js - Simplified version
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Basic Information
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: "",
    },

    // Role
    role: {
      type: String,
      enum: ["user", "ambulancier", "manager"],
      default: "user",
    },

    ambulanceId: {
      type: Number,
      default: null,
    },

    // ==================== ONLINE TRACKING ====================
    isOnline: {
      type: Boolean,
      default: false,
    },

    socketId: {
      type: String,
      default: null,
    },

    lastOnline: {
      type: Date,
      default: null,
    },

    currentInterventionId: {
      type: Number,
      default: null,
    },

    // Other fields
    matricule: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ ambulanceId: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ socketId: 1 });

// Instance methods
userSchema.methods.setOnline = async function (socketId) {
  this.isOnline = true;
  this.socketId = socketId;
  this.lastOnline = new Date();
  await this.save();
};

userSchema.methods.setOffline = async function () {
  this.isOnline = false;
  this.socketId = null;
  await this.save();
};

// Static method to logout other drivers (auto-logout)
userSchema.statics.logoutOtherDrivers = async function (
  currentDriverId,
  ambulanceId,
) {
  return this.updateMany(
    {
      _id: { $ne: currentDriverId },
      ambulanceId: ambulanceId,
      role: "ambulancier",
      isOnline: true,
    },
    {
      isOnline: false,
      socketId: null,
      lastOnline: new Date(),
    },
  );
};

// Find online driver by ambulance ID
userSchema.statics.getOnlineDriverByAmbulanceId = async function (ambulanceId) {
  return this.findOne({
    role: "ambulancier",
    ambulanceId: ambulanceId,
    isOnline: true,
    isActive: true,
  }).sort({ lastOnline: -1 });
};

const User = mongoose.model("User", userSchema);

export default User;
