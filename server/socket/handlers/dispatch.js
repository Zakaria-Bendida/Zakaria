// socket/handlers/assignment.js
import { pool } from "../../config/database.js";
import rooms from "../rooms.js";

// Manager assigns ambulance to intervention
export async function handleAssignAmbulance(socket, io, data) {
  try {
    const { interventionId, ambulanceId, driverId } = data;

    const interventionQuery = await pool.query(
      "SELECT id, latitude_depart, longitude_depart, type, priority, caller_name FROM interventions WHERE id = $1",
      [interventionId],
    );

    if (interventionQuery.rows.length === 0) {
      socket.emit("assign_error", { message: "Intervention not found" });
      return;
    }

    const intervention = interventionQuery.rows[0];

    // Get ambulance details
    const ambulanceQuery = await pool.query(
      "SELECT id, immatriculation FROM ambulances WHERE id = $1",
      [ambulanceId],
    );

    if (ambulanceQuery.rows.length === 0) {
      socket.emit("assign_error", { message: "Ambulance not found" });
      return;
    }

    const ambulance = ambulanceQuery.rows[0];

    // Update database
    await pool.query(
      "UPDATE interventions SET ambulance_id = $1, statut = $2 WHERE id = $3",
      [ambulanceId, "en route", interventionId],
    );

    await pool.query("UPDATE ambulances SET statut = $1 WHERE id = $2", [
      "En mission",
      ambulanceId,
    ]);

    // Send assignment to specific driver
    const driverRoom = rooms.driverRoom(ambulanceId);
    const assignmentData = {
      interventionId,
      ambulanceId,
      location: {
        lat: intervention.latitude_depart,
        lon: intervention.longitude_depart,
      },
      type: intervention.type,
      priority: intervention.priority,
      callerName: intervention.caller_name,
      message: `New emergency assignment! Intervention #${interventionId}`,
      timestamp: new Date(),
    };

    io.to(driverRoom).emit("ambulance_assigned", assignmentData);
    console.log(`✅ Assignment sent to driver room: ${driverRoom}`);

    // Notify all managers
    io.to(rooms.managerRoom()).emit("assignment_sent", {
      interventionId,
      ambulanceId,
      ambulanceImmatriculation: ambulance.immatriculation,
      status: "pending",
      timestamp: new Date(),
    });

    socket.emit("assign_success", {
      interventionId,
      ambulanceId,
      message: `Ambulance ${ambulance.immatriculation} has been notified`,
    });
  } catch (error) {
    console.error("Assign ambulance error:", error);
    socket.emit("assign_error", { message: error.message });
  }
}

// Cancel assignment
export async function handleCancelAssignment(socket, io, data) {
  const { interventionId, ambulanceId, reason } = data;

  const driverRoom = rooms.driverRoom(ambulanceId);

  io.to(driverRoom).emit("assignment_cancelled", {
    interventionId,
    reason: reason || "Assignment cancelled by dispatcher",
    timestamp: new Date(),
  });

  io.to(rooms.managerRoom()).emit("assignment_cancelled", {
    interventionId,
    ambulanceId,
    timestamp: new Date(),
  });

  console.log(`❌ Assignment cancelled for intervention ${interventionId}`);
}
