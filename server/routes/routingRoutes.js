// server/routes/routingRoutes.js
// FIXED: Added fastest-path and comfort-path endpoints

import express from "express";
import routingController from "../controllers/routingController.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken);

const roles = ["manager", "ambulancier"];

// NEW: fastest path (time-based, avoids blocked edges)
router.get(
  "/fastest-path",
  requireRole(roles),
  routingController.getFastestPath,
);

// NEW: comfort path (avoids speed bumps)
router.get(
  "/comfort-path",
  requireRole(roles),
  routingController.getComfortPath,
);

// Legacy endpoints (kept for compatibility)
router.get(
  "/shortest-path",
  requireRole(roles),
  routingController.getShortestPath,
);
router.get(
  "/path-geometry",
  requireRole(roles),
  routingController.getPathWithGeometry,
);
router.get(
  "/nearest-vertex",
  requireRole(roles),
  routingController.findNearestVertex,
);
router.get(
  "/nearest-edge",
  requireRole(roles),
  routingController.findNearestEdge,
);
router.get(
  "/eta-advanced",
  requireRole(roles),
  routingController.getETAAdvanced,
);

export default router;
