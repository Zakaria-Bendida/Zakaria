// routes/index.js (ESM version)
import express from "express";

// Import route modules
import ambulanceRoutes from "./ambulanceRoutes.js";
import routingRoutes from "./routingRoutes.js";
import interventionRoutes from "./interventionRoutes.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import hospitalRoutes from "./hospitalRoutes.js";
import mobileRoutes from "./mobileRoutes.js";
import parkingRoutes from "./parkingRoutes.js";

const router = express.Router();

// Register routes
router.use("/auth", authRoutes);
router.use("/ambulances", ambulanceRoutes);
router.use("/routing", routingRoutes);
router.use("/interventions", interventionRoutes);
router.use("/users", userRoutes);
router.use("/hospitals", hospitalRoutes);
router.use("/mobile", mobileRoutes);
router.use("/parkings", parkingRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Ambulance Tracking System",
    version: "1.0.0",
  });
});

// Root endpoint
router.get("/", (req, res) => {
  res.json({
    name: "Ambulance Tracking System API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      ambulances: "/api/ambulances",
      interventions: "/api/interventions",
      routing: "/api/routing",
      health: "/api/health",
    },
  });
});

export default router;
