// routes/hospitalRoutes.js (ESM version)
import express from "express";
import hospitalController from "../controllers/hospitalController.js"; // ✅ default import
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Public routes (any authenticated user)
router.get("/", hospitalController.getAllHospitals);
// router.get("/nearest", hospitalController.findNearestHospitals);
// router.get("/nearest-by-road", hospitalController.findNearestHospitals); // ADD THIS LINE
router.get("/:id", hospitalController.getHospitalById);

// Manager only routes
router.post("/", requireRole(["manager"]), hospitalController.createHospital);
router.put("/:id", requireRole(["manager"]), hospitalController.updateHospital);
router.delete(
  "/:id",
  requireRole(["manager"]),
  hospitalController.deleteHospital,
);

export default router;

// server/routes/hospitalRoutes.js
// import express from "express";
// import hospitalController from "../controllers/hospitalController.js";

// const router = express.Router();

// // Routes publiques pour test
// router.get("/", hospitalController.getAllHospitals);
// router.get("/:id", hospitalController.getHospitalById);
// router.post("/", hospitalController.createHospital);
// router.put("/:id", hospitalController.updateHospital);
// router.delete("/:id", hospitalController.deleteHospital);

// export default router;
