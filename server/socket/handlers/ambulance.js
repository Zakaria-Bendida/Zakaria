import rooms from "../rooms.js";
import { pool } from "../../config/database.js";

export async function handleLocationUpdate(socket, io, data) {
  try {
    const { lat, lon, speed } = data;
    const user = socket.user;

    if (user.role !== "ambulancier" || !user.ambulanceId) {
      return socket.emit("error", { message: "Not authorized" });
    }

    // Update location in database
    await pool.query(
      "UPDATE ambulances SET latitude = $1, longitude = $2, updated_at = NOW() WHERE id = $3",
      [lat, lon, user.ambulanceId],
    );

    const locationData = {
      ambulanceId: user.ambulanceId,
      driverName: user.fullName,
      lat,
      lon,
      speed: speed || 0,
      timestamp: new Date(),
    };

    io.to(rooms.managerRoom()).emit("ambulance_location", locationData);
    socket.emit("location_updated", locationData);
  } catch (error) {
    console.error("Location update error:", error);
    socket.emit("error", { message: "Failed to update location" });
  }
}

export async function handleStatusUpdate(socket, io, data) {
  try {
    const { status, interventionId } = data;
    const user = socket.user;

    if (user.role !== "ambulancier" || !user.ambulanceId) {
      return socket.emit("error", { message: "Not authorized" });
    }

    await pool.query(
      "UPDATE ambulances SET statut = $1, updated_at = NOW() WHERE id = $2",
      [status, user.ambulanceId],
    );

    const statusData = {
      ambulanceId: user.ambulanceId,
      driverName: user.fullName,
      oldStatus: user.status,
      newStatus: status,
      interventionId: interventionId || null,
      timestamp: new Date(),
    };

    io.to(rooms.managerRoom()).emit("ambulance_status", statusData);
    io.to(rooms.allDriversRoom()).emit("driver_status_change", statusData);

    socket.emit("status_updated", statusData);
  } catch (error) {
    console.error("Status update error:", error);
    socket.emit("error", { message: "Failed to update status" });
  }
}
