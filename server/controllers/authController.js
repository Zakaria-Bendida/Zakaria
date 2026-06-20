// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import Blacklist from "../models/Blacklist.js";

// Get JWT secret
const getJWTSecret = () => {
  return process.env.JWT_SECRET || "secret123";
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Account is deactivated. Please contact administrator.",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip || req.connection?.remoteAddress;
    await user.save();

    // Generate token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        ambulanceId: user.ambulanceId,
      },
      getJWTSecret(),
      { expiresIn: "24h" },
    );

    // Set cookie for web pages
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          ambulanceId: user.ambulanceId,
          isOnline: user.isOnline || false,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get my profile (authenticated user)
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        ambulanceId: user.ambulanceId,
        isOnline: user.isOnline || false,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update my profile
const updateMyProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    updateData.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Simple user auth (no password, just name and phone) - One step login/register
const userAuth = async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        error: "Full name and phone number are required",
      });
    }

    // Check if user exists
    let user = await User.findOne({ phone: phone });

    if (user) {
      // EXISTING USER - Just login (update name if changed)
      if (user.fullName !== fullName) {
        user.fullName = fullName;
        await user.save();
      }

      const token = jwt.sign(
        {
          userId: user._id,
          phone: user.phone,
          role: user.role,
          fullName: user.fullName,
        },
        getJWTSecret(),
        { expiresIn: "24h" },
      );

      return res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            phone: user.phone,
            role: user.role,
          },
          token,
        },
      });
    }

    const validEmail = `${phone.replace(/[^0-9]/g, "")}@user.com`;
    const passwordHash = await bcrypt.hash(phone + "_no_password", 10);

    user = new User({
      email: validEmail,
      passwordHash: passwordHash,
      fullName: fullName,
      phone: phone,
      role: "user",
      isActive: true,
    });

    await user.save();

    const token = jwt.sign(
      {
        userId: user._id,
        phone: user.phone,
        role: user.role,
        fullName: user.fullName,
      },
      getJWTSecret(),
      { expiresIn: "24h" },
    );

    res.status(201).json({
      success: true,
      message: "Account created and logged in successfully",
      data: {
        user: {
          id: user._id,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    console.error("User auth error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // Get token from header or cookie
    const token =
      req.headers.authorization?.split(" ")[1] || req.cookies?.token;

    if (token) {
      // Decode token to get expiration
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        // Add token to blacklist
        await Blacklist.create({
          token: token,
          expiresAt: new Date(decoded.exp * 1000),
        });
        console.log("Token blacklisted successfully");
      }
    }

    // Clear cookie
    res.clearCookie("token");

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export { login, userAuth, getMyProfile, updateMyProfile, logout };
