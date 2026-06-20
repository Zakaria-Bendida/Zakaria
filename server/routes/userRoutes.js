// // routes/userRoutes.js (ESM version)
// import express from "express";
// import {
//   getAllUsers,
//   getUserById,
//   getUsersByRole,
//   createUserByAdmin,
//   updateUser,
//   deleteUser,
//   getDrivers,
//   getAvailableDrivers,
// } from "../controllers/userController.js"; // ✅ named imports
// import { verifyToken, requireRole } from "../middleware/auth.js";

// const router = express.Router();

// // All routes require authentication
// router.use(verifyToken);

// // Manager-only routes
// router.use(requireRole(["manager"]));

// router.get("/", getAllUsers);
// router.get("/drivers", getDrivers);
// router.get("/drivers/available", getAvailableDrivers);
// router.get("/role/:role", getUsersByRole);
// router.get("/:id", getUserById);
// router.post("/", createUserByAdmin);
// router.put("/:id", updateUser);
// router.delete("/:id", deleteUser);

// export default router;

// routes/userRoutes.js (version sans authentification pour test)
// import express from "express";
// import {
//   getAllUsers,
//   getUserById,
//   getUsersByRole,
//   createUserByAdmin,
//   updateUser,
//   deleteUser,
//   getDrivers,
//   getAvailableDrivers,
// } from "../controllers/userController.js";

// const router = express.Router();

// // ✅ TEMPORAIRE - Routes publiques pour tester (sans authentification)
// router.get("/", getAllUsers);
// router.get("/drivers", getDrivers);
// router.get("/drivers/available", getAvailableDrivers);
// router.get("/role/:role", getUsersByRole);
// router.get("/:id", getUserById);
// router.post("/", createUserByAdmin);
// router.put("/:id", updateUser);
// router.delete("/:id", deleteUser);
// // Add these routes
// router.get(
//   "/drivers/online",
//   authenticate,
//   requireRole(["manager"]),
//   userController.getOnlineDrivers,
// );
// router.put(
//   "/:id/status",
//   authenticate,
//   requireRole(["manager", "ambulancier"]),
//   userController.updateDriverStatus,
// );

// export default router;

// routes/userRoutes.js (ESM version)
// routes/userRoutes.js (ESM version)
import express from "express";
import {
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
} from "../controllers/userController.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// ==================== AUTHENTICATION MIDDLEWARE ====================
// All routes require authentication
router.use(verifyToken);

// ==================== MANAGER ONLY ROUTES ====================
router.get("/", requireRole(["manager"]), getAllUsers);
router.get("/drivers", requireRole(["manager"]), getDrivers);
router.get("/drivers/available", requireRole(["manager"]), getAvailableDrivers);
router.get("/drivers/online", requireRole(["manager"]), getOnlineDrivers);
router.get("/role/:role", requireRole(["manager"]), getUsersByRole);
router.get("/:id", requireRole(["manager"]), getUserById);
router.post("/", requireRole(["manager"]), createUserByAdmin);
router.put("/:id", requireRole(["manager"]), updateUser);
router.delete("/:id", requireRole(["manager"]), deleteUser);

// ==================== MANAGER + DRIVER ROUTES ====================
router.put(
  "/:id/status",
  requireRole(["manager", "ambulancier"]),
  updateDriverStatus,
);
// Add these routes to userRoutes.js
router.get("/drivers/online", requireRole(["manager"]), getOnlineDrivers);
router.put(
  "/:id/status",
  requireRole(["manager", "ambulancier"]),
  updateDriverStatus,
);

export default router;
