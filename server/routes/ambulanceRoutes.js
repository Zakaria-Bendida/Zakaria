// routes/ambulanceRoutes.js
import express from "express";
import ambulanceController from "../controllers/ambulanceController.js"; // ✅ default import
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
  validateId,
  validateAmbulance,
  checkValidation,
} from "../middleware/validation.js";
import { apiLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.use(verifyToken);
// router.use(apiLimiter);

// Manager only routes
router.get("/", requireRole(["manager"]), ambulanceController.getAllAmbulances);
router.post(
  "/",
  requireRole(["manager"]),
  validateAmbulance,
  checkValidation,
  ambulanceController.createAmbulance,
);
router.put(
  "/:id",
  requireRole(["manager"]),
  validateId,
  checkValidation,
  ambulanceController.updateAmbulance,
);
router.delete(
  "/:id",
  requireRole(["manager"]),
  validateId,
  checkValidation,
  ambulanceController.deleteAmbulance,
);
router.get(
  "/statistics",
  requireRole(["manager"]),
  ambulanceController.getStatistics,
);
router.get(
  "/status/:status",
  requireRole(["manager"]),
  ambulanceController.getAmbulancesByStatus,
);

// Manager + Driver routes
router.get(
  "/:id",
  requireRole(["manager", "ambulancier"]),
  validateId,
  checkValidation,
  ambulanceController.getAmbulanceById,
);
router.put(
  "/:id/location",
  requireRole(["manager", "ambulancier"]),
  validateId,
  checkValidation,
  ambulanceController.updateLocation,
);
router.put(
  "/:id/status",
  requireRole(["manager", "ambulancier"]),
  validateId,
  checkValidation,
  ambulanceController.updateStatus,
);

export default router;

// routes/ambulanceRoutes.js

// import express from "express";
// import ambulanceController from "../controllers/ambulanceController.js";
// import {
//   validateId,
//   validateAmbulance,
//   checkValidation,
// } from "../middleware/validation.js";

// const router = express.Router();

// // ✅ TEMPORAIRE - Toutes les routes sont publiques pour tester
// // À réactiver après avoir vérifié que les données s'affichent

// // Routes publiques (sans authentification)
// router.get("/", ambulanceController.getAllAmbulances);
// router.get("/statistics", ambulanceController.getStatistics);
// router.get("/status/:status", ambulanceController.getAmbulancesByStatus);
// router.get("/:id", ambulanceController.getAmbulanceById);
// router.post("/", ambulanceController.createAmbulance);
// router.put("/:id", ambulanceController.updateAmbulance);
// router.put("/:id/location", ambulanceController.updateLocation);
// router.put("/:id/status", ambulanceController.updateStatus);
// router.delete("/:id", ambulanceController.deleteAmbulance);

// export default router;
