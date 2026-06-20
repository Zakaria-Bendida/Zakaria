// middleware/auth.js (ESM version)
import jwt from "jsonwebtoken";
import Blacklist from "../models/Blacklist.js";

const getJWTSecret = () => {
  return process.env.JWT_SECRET || "secret123";
};

// Verify JWT token
const verifyToken = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];

  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Access denied. No token provided.",
    });
  }

  // Check if token is blacklisted
  try {
    const isBlacklisted = await Blacklist.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: "Token has been invalidated. Please login again.",
      });
    }
  } catch (blacklistError) {
    console.error("Blacklist check error:", blacklistError);
  }

  try {
    const decoded = jwt.verify(token, getJWTSecret());
    req.user = decoded;
    next(); // Continue to next middleware/route
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};

// Role-based access control
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${req.user.role}`,
      });
    }

    next(); // User has required role, continue
  };
};

export { verifyToken, requireRole };
