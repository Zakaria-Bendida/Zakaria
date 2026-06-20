// routes/authRoutes.js (ESM version)
import express from "express";
import {
  login,
  userAuth,
  getMyProfile,
  updateMyProfile,
  logout,
} from "../controllers/authController.js"; // ✅ named imports
import { verifyToken } from "../middleware/auth.js";
import {
  validateUserAuth,
  validateDriverLogin,
  checkValidation,
} from "../middleware/validation.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Public routes with rate limiting and validation
router.post("/login", authLimiter, login);
router.post(
  "/user-auth",
  authLimiter,
  validateUserAuth,
  checkValidation,
  userAuth,
);

// Protected routes
router.get("/me", verifyToken, getMyProfile);
router.put("/me", verifyToken, updateMyProfile);
router.post("/logout", verifyToken, logout);

export default router;
