// controllers/userController.js
import { User } from "../models/index.js";
import bcrypt from "bcryptjs";
import { pgPool } from "../config/database.js";

// ── Helper: split fullName into nom/prenom for frontend ───────────────────
const formatUser = (user) => ({
  id: user._id,
  _id: user._id,
  fullName: user.fullName,
  nom: user.fullName?.split(" ").slice(1).join(" ") || "",
  prenom: user.fullName?.split(" ")[0] || "",
  role: user.role,
  email: user.email,
  telephone: user.phone || "",
  phone: user.phone,
  ambulanceId: user.ambulanceId,
  isActive: user.isActive,
  isOnline: user.isOnline || false,
  lastOnline: user.lastOnline || null,
  currentInterventionId: user.currentInterventionId || null,
  created_at: user.createdAt,
});

// ── Helper: resolve fullName from nom/prenom or fullName ──────────────────
const resolveFullName = (body) => {
  const { fullName, nom, prenom } = body;
  if (fullName) return fullName;
  if (nom && prenom) return `${prenom} ${nom}`;
  return null;
};

// ── Get all users ─────────────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-passwordHash");
    res.json({
      success: true,
      count: users.length,
      data: users.map(formatUser),
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Get user by ID ────────────────────────────────────────────────────────
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, data: formatUser(user) });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Create user by admin ──────────────────────────────────────────────────
const createUserByAdmin = async (req, res) => {
  try {
    const { email, password, phone, role, ambulanceId } = req.body;

    // Resolve fullName from nom/prenom or fullName directly
    const fullName = resolveFullName(req.body);

    console.log("📥 Create user:", { email, fullName, role });

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({
        success: false,
        error:
          "Email, password, fullName (or nom+prenom) and role are required",
      });
    }

    const validRoles = ["user", "ambulancier", "manager"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Valid roles: user, ambulancier, manager",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new User({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      phone: phone || "",
      role,
      ambulanceId: role === "ambulancier" ? ambulanceId || null : null,
      matricule: null,
      isActive: true,
    });

    await user.save();

    console.log("✅ User created:", user._id, fullName, role);

    res.status(201).json({
      success: true,
      message: `User created successfully with role: ${role}`,
      data: formatUser(user),
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Update user ───────────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, telephone, email, ambulanceId } = req.body;

    console.log("📥 UPDATE REQUEST:", { id, ...req.body });

    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const updateData = {};

    // Resolve fullName from nom/prenom or fullName
    const fullName = resolveFullName(req.body);
    if (fullName) updateData.fullName = fullName;

    if (role) updateData.role = role;
    if (telephone) updateData.phone = telephone;
    if (email) updateData.email = email.toLowerCase();

    if (
      ambulanceId !== undefined &&
      ambulanceId !== null &&
      ambulanceId !== ""
    ) {
      updateData.ambulanceId = Number(ambulanceId);
    } else if (role && role !== "ambulancier") {
      updateData.ambulanceId = null;
    }

    updateData.updatedAt = new Date();

    console.log("📝 Update data being applied:", updateData);

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, error: "User not found after update" });
    }

    console.log("✅ User updated successfully:", updatedUser._id);

    res.json({
      success: true,
      message: "User updated successfully",
      data: formatUser(updatedUser),
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Delete user ───────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🗑️ Deleting user ID:", id);

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    console.log("✅ User deleted successfully:", id);

    res.json({
      success: true,
      message: "User deleted successfully",
      data: { id: user._id, email: user.email },
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Get users by role ─────────────────────────────────────────────────────
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const validRoles = ["user", "ambulancier", "manager"];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Valid roles: user, ambulancier, manager",
      });
    }

    const users = await User.find({ role }).select("-passwordHash");

    res.json({
      success: true,
      count: users.length,
      role,
      data: users.map(formatUser),
    });
  } catch (error) {
    console.error("Get users by role error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Get drivers (ambulanciers) ────────────────────────────────────────────
const getDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: "ambulancier" }).select(
      "-passwordHash",
    );

    res.json({
      success: true,
      count: drivers.length,
      data: drivers.map(formatUser),
    });
  } catch (error) {
    console.error("Get drivers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Get available drivers ─────────────────────────────────────────────────
const getAvailableDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: "ambulancier" }).select(
      "-passwordHash",
    );

    const ambulanceQuery = await pgPool.query(
      "SELECT id FROM ambulances WHERE statut = $1",
      ["Disponible"],
    );

    const availableAmbulanceIds = ambulanceQuery.rows.map((a) => a.id);

    const availableDrivers = drivers.filter((driver) =>
      availableAmbulanceIds.includes(driver.ambulanceId),
    );

    res.json({
      success: true,
      count: availableDrivers.length,
      data: availableDrivers.map(formatUser),
    });
  } catch (error) {
    console.error("Get available drivers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Get online drivers ────────────────────────────────────────────────────
const getOnlineDrivers = async (req, res) => {
  try {
    const drivers = await User.find({
      role: "ambulancier",
      isOnline: true,
      isActive: true,
    }).select("-passwordHash");

    res.json({
      success: true,
      count: drivers.length,
      data: drivers.map(formatUser),
    });
  } catch (error) {
    console.error("Get online drivers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Update driver status ──────────────────────────────────────────────────
const updateDriverStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isOnline, socketId, currentInterventionId } = req.body;

    const updateData = {};
    if (isOnline !== undefined) updateData.isOnline = isOnline;
    if (socketId !== undefined) updateData.socketId = socketId;
    if (currentInterventionId !== undefined)
      updateData.currentInterventionId = currentInterventionId;
    if (isOnline === true) updateData.lastOnline = new Date();
    updateData.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      message: `Driver status updated to ${isOnline ? "online" : "offline"}`,
      data: {
        id: user._id,
        fullName: user.fullName,
        isOnline: user.isOnline,
        ambulanceId: user.ambulanceId,
        currentInterventionId: user.currentInterventionId,
      },
    });
  } catch (error) {
    console.error("Update driver status error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export {
  getAllUsers,
  getUserById,
  getUsersByRole,
  createUserByAdmin,
  updateUser,
  deleteUser,
  getDrivers,
  getAvailableDrivers,
  getOnlineDrivers,
  updateDriverStatus,
};
