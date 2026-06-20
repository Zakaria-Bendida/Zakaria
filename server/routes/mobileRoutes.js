// server/routes/mobileRoutes.js
// FIXED: Added manager roadblock routes, edge center endpoint

import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
  validateCoordinates,
  validateId,
  checkValidation,
} from "../middleware/validation.js";
import { sosLimiter } from "../middleware/rateLimit.js";
import mobileController from "../controllers/mobileController.js";
import driverController from "../controllers/driverController.js";

const router = express.Router();

// ── PUBLIC ───────────────────────────────────────────────────────────────────
router.post("/driver/login", driverController.driverLogin);

// ── MANAGER ROUTES ───────────────────────────────────────────────────────────
router.get(
  "/manager/roadblocks",
  verifyToken,
  requireRole(["manager"]),
  driverController.getRoadblocks,
);

// Clear (delete) a roadblock — manager only
router.delete(
  "/manager/roadblock/:edge_id",
  verifyToken,
  requireRole(["manager"]),
  driverController.clearRoadblock,
);

// Legacy clear endpoint (kept for compatibility)
router.delete(
  "/driver/roadblock/:edge_id",
  verifyToken,
  requireRole(["manager"]),
  driverController.clearRoadblock,
);

// Edge center for map display
router.get(
  "/edges/:edgeId/center",
  verifyToken,
  requireRole(["manager", "ambulancier"]),
  driverController.getEdgeCenter,
);

// ── PROTECTED DRIVER ROUTES ──────────────────────────────────────────────────
router.use("/driver", verifyToken);
router.use("/driver", requireRole(["ambulancier"]));

router.get("/driver/assignment", driverController.getCurrentAssignment);
router.put("/driver/status", driverController.updateStatus);
router.post("/driver/select-hospital", driverController.selectHospitalAndRoute);
router.post(
  "/driver/location",
  validateCoordinates,
  checkValidation,
  driverController.updateLocation,
);
router.get(
  "/driver/route/:interventionId",
  validateId,
  checkValidation,
  driverController.getRoute,
);
router.get(
  "/driver/route-to-hospital/:interventionId",
  validateId,
  checkValidation,
  driverController.getRouteToHospital,
);
router.post("/driver/roadblock", driverController.reportRoadblock);
router.post(
  "/driver/start-transport",
  driverController.startTransportToHospital,
);
router.post("/driver/accept/:interventionId", driverController.acceptEmergency);
router.post(
  "/driver/decline/:interventionId",
  driverController.declineEmergency,
);

// ── PROTECTED USER ROUTES ────────────────────────────────────────────────────
router.use(verifyToken);
router.post(
  "/sos",
  sosLimiter,
  validateCoordinates,
  checkValidation,
  mobileController.sosEmergency,
);
router.get(
  "/track/:interventionId",
  validateId,
  checkValidation,
  mobileController.trackAmbulance,
);
router.get(
  "/eta/:interventionId",
  validateId,
  checkValidation,
  mobileController.getETA,
);
router.get("/history", mobileController.getHistory);
router.delete(
  "/emergency/:interventionId",
  validateId,
  checkValidation,
  mobileController.cancelEmergency,
);

export default router;
