// controllers/userController.js
import { User } from "../models/index.js";
import bcrypt from "bcryptjs";
import { pgPool } from "../config/database.js";

// Get all users
// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-passwordHash");

    // Format users for frontend
    const formattedUsers = users.map((user) => ({
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
      matricule: user.matricule,
      isActive: user.isActive,
      isOnline: user.isOnline || false, // ✅ ADD THIS
      currentInterventionId: user.currentInterventionId || null, // ✅ ADD THIS
      created_at: user.createdAt,
    }));

    res.json({
      success: true,
      count: users.length,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const formattedUser = {
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
      matricule: user.matricule,
      isActive: user.isActive,
      created_at: user.createdAt,
    };

    res.json({ success: true, data: formattedUser });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create user by admin
const createUserByAdmin = async (req, res) => {
  try {
    const { email, password, fullName, phone, role, ambulanceId, matricule } =
      req.body;

    console.log("📥 Create user:", { email, fullName, role, matricule });

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({
        success: false,
        error: "Email, password, fullName and role are required",
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
      role: role,
      ambulanceId: role === "ambulancier" ? ambulanceId || null : null,
      matricule: matricule || "",
      isActive: true,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: `User created successfully with role: ${role}`,
      data: {
        id: user._id,
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        ambulanceId: user.ambulanceId,
        matricule: user.matricule,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update user - FIXED VERSION
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, role, telephone, email, ambulanceId, fullName } =
      req.body;

    console.log("📥 UPDATE REQUEST:");
    console.log("  - ID:", id);
    console.log("  - nom:", nom);
    console.log("  - prenom:", prenom);
    console.log("  - role:", role);
    console.log("  - telephone:", telephone);
    console.log("  - email:", email);
    console.log("  - ambulanceId:", ambulanceId);

    // Find the user first
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Build update data
    const updateData = {};

    // Handle name - combine nom and prenom into fullName
    if (nom && prenom) {
      updateData.fullName = `${prenom} ${nom}`;
    } else if (fullName) {
      updateData.fullName = fullName;
    }

    if (role) updateData.role = role;
    if (telephone) updateData.phone = telephone;
    if (email) updateData.email = email.toLowerCase();
    if (
      ambulanceId !== undefined &&
      ambulanceId !== null &&
      ambulanceId !== ""
    ) {
      updateData.ambulanceId = Number(ambulanceId);
    } else if (role !== "ambulancier") {
      updateData.ambulanceId = null;
    }

    updateData.updatedAt = new Date();

    console.log("📝 Update data being applied:", updateData);

    // Update the user
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

    // Format response
    const responseData = {
      id: updatedUser._id,
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      nom: updatedUser.fullName?.split(" ").slice(1).join(" ") || "",
      prenom: updatedUser.fullName?.split(" ")[0] || "",
      role: updatedUser.role,
      email: updatedUser.email,
      telephone: updatedUser.phone || "",
      phone: updatedUser.phone,
      ambulanceId: updatedUser.ambulanceId,
      matricule: updatedUser.matricule,
      isActive: updatedUser.isActive,
      created_at: updatedUser.createdAt,
    };

    res.json({
      success: true,
      message: "User updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete user
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

// Get users by role
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

    const users = await User.find({ role: role }).select("-passwordHash");

    const formattedUsers = users.map((user) => ({
      id: user._id,
      _id: user._id,
      fullName: user.fullName,
      nom: user.fullName?.split(" ").slice(1).join(" ") || "",
      prenom: user.fullName?.split(" ")[0] || "",
      role: user.role,
      email: user.email,
      telephone: user.phone || "",
      ambulanceId: user.ambulanceId,
    }));

    res.json({
      success: true,
      count: users.length,
      role: role,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Get users by role error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get drivers (ambulanciers)
const getDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: "ambulancier" }).select(
      "-passwordHash",
    );

    const formattedDrivers = drivers.map((driver) => ({
      id: driver._id,
      _id: driver._id,
      fullName: driver.fullName,
      nom: driver.fullName?.split(" ").slice(1).join(" ") || "",
      prenom: driver.fullName?.split(" ")[0] || "",
      role: driver.role,
      email: driver.email,
      telephone: driver.phone || "",
      ambulanceId: driver.ambulanceId,
      isOnline: driver.isOnline,
      lastOnline: driver.lastOnline, // ← MAKE SURE THIS LINE EXISTS
      currentInterventionId: driver.currentInterventionId,
    }));

    res.json({
      success: true,
      count: drivers.length,
      data: formattedDrivers,
    });
  } catch (error) {
    console.error("Get drivers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get available drivers
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

    const formattedDrivers = availableDrivers.map((driver) => ({
      id: driver._id,
      _id: driver._id,
      fullName: driver.fullName,
      role: driver.role,
      ambulanceId: driver.ambulanceId,
    }));

    res.json({
      success: true,
      count: availableDrivers.length,
      data: formattedDrivers,
    });
  } catch (error) {
    console.error("Get available drivers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add this method to your userController.js

// Get online drivers
// Add these functions to your userController.js (before the exports)

// Add this function to your userController.js

// Update driver status (online/offline) - Admin endpoint
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

// Get online drivers
const getOnlineDrivers = async (req, res) => {
  try {
    const drivers = await User.find({
      role: "ambulancier",
      isOnline: true,
      isActive: true,
    }).select("-passwordHash");

    const formattedDrivers = drivers.map((driver) => ({
      id: driver._id,
      _id: driver._id,
      fullName: driver.fullName,
      nom: driver.fullName?.split(" ").slice(1).join(" ") || "",
      prenom: driver.fullName?.split(" ")[0] || "",
      role: driver.role,
      email: driver.email,
      telephone: driver.phone || "",
      ambulanceId: driver.ambulanceId,
      isOnline: true,
      lastOnline: driver.lastOnline,
      currentInterventionId: driver.currentInterventionId,
    }));

    res.json({
      success: true,
      count: drivers.length,
      data: formattedDrivers,
    });
  } catch (error) {
    console.error("Get online drivers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update driver online status

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
