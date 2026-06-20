import express from "express";
import parkingController from "../controllers/parkingController.js";

const router = express.Router();

// Routes publiques temporaires pour test
router.get("/", parkingController.getAllParkings);
router.get("/:id", parkingController.getParkingById);
router.post("/", parkingController.createParking);
router.put("/:id", parkingController.updateParking);
router.delete("/:id", parkingController.deleteParking);

export default router;
