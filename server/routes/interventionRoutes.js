// // // routes/interventionRoutes.js (ESM version)
// import express from "express";
// import interventionController from "../controllers/interventionController.js"; // ✅ default import
// import { verifyToken, requireRole } from "../middleware/auth.js";

// const router = express.Router();

// // All routes require authentication
// router.use(verifyToken);

// // ==================== MANAGER ONLY ====================
// router.get(
//   "/",
//   requireRole(["manager"]),
//   interventionController.getAllInterventions,
// );
// router.get(
//   "/statistics",
//   requireRole(["manager"]),
//   interventionController.getStatistics,
// );
// router.post(
//   "/",
//   requireRole(["manager"]),
//   interventionController.createIntervention,
// );
// router.post(
//   "/assign",
//   requireRole(["manager"]),
//   interventionController.assignAmbulance,
// );

// // ==================== MANAGER + DRIVER ====================
// router.get(
//   "/:id",
//   requireRole(["manager", "ambulancier"]),
//   interventionController.getInterventionById,
// );
// router.put(
//   "/:id/complete",
//   requireRole(["manager", "ambulancier"]),
//   interventionController.completeIntervention,
// );

// export default router;

// // routes/interventionRoutes.js
// // import express from "express";
// // import interventionController from "../controllers/interventionController.js";

// // const router = express.Router();

// // // ✅ TEMPORAIRE - Toutes les routes sont publiques pour tester
// // // Routes CRUD pour les interventions
// // router.get("/", interventionController.getAllInterventions);
// // router.get("/statistics", interventionController.getStatistics);
// // router.get("/:id", interventionController.getInterventionById);
// // router.post("/", interventionController.createIntervention);
// // router.put("/:id", interventionController.updateIntervention);
// // router.delete("/:id", interventionController.deleteIntervention);
// // router.post("/assign", interventionController.assignAmbulance);
// // router.put("/:id/complete", interventionController.completeIntervention);

// // router.put("/:id/cancel", interventionController.cancelIntervention);

// // export default router;

// routes/interventionRoutes.js (ESM version)
// routes/interventionRoutes.js (ESM version)
import express from "express";
import interventionController from "../controllers/interventionController.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ==================== MANAGER ONLY ====================
router.get(
  "/",
  requireRole(["manager"]),
  interventionController.getAllInterventions,
);
router.get(
  "/statistics",
  requireRole(["manager"]),
  interventionController.getStatistics,
);
router.post(
  "/",
  requireRole(["manager"]),
  interventionController.createIntervention,
);
router.post(
  "/assign",
  requireRole(["manager"]),
  interventionController.assignAmbulance,
);

// ==================== MANAGER + DRIVER ====================
router.get(
  "/:id",
  requireRole(["manager", "ambulancier"]),
  interventionController.getInterventionById,
);
router.put(
  "/:id/complete",
  requireRole(["manager", "ambulancier"]),
  interventionController.completeIntervention,
);
router.put(
  "/:id/cancel",
  requireRole(["manager", "ambulancier"]),
  interventionController.cancelIntervention,
);
router.put(
  "/:id",
  requireRole(["manager", "ambulancier"]),
  interventionController.updateIntervention,
);
router.delete(
  "/:id",
  requireRole(["manager"]),
  interventionController.deleteIntervention,
);

router.put(
  "/:id/confirm",
  requireRole(["manager"]),
  interventionController.confirmIntervention,
);

export default router;
