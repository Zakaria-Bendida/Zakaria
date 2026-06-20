// socket/handlers/emergency.js
import { pool } from "../../config/database.js";
import rooms from "../rooms.js";

export async function handleNewEmergencyCall(socket, io, data) {
  try {
    const { location, type, description, priority, callerInfo } = data;

    console.log(`🚨 New emergency call from ${callerInfo.name}`);

    // Get current date and time
    const today = new Date();
    const currentDate = today.toISOString().split("T")[0];
    const currentTime = today.toTimeString().split(" ")[0];

    // Insert into database
    const query = `
      INSERT INTO interventions (type, date_intervention, heure_intervention, latitude_depart, longitude_depart, description, statut, priority, caller_name, caller_phone, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'en attente', $7, $8, $9, NOW())
      RETURNING id
    `;

    const values = [
      type,
      currentDate,
      currentTime,
      location.lat,
      location.lon,
      description,
      priority || "normal",
      callerInfo.name,
      callerInfo.phone,
    ];

    const result = await pool.query(query, values);
    const interventionId = result.rows[0].id;

    // Join user to intervention room for notifications
    const interventionRoom = rooms.interventionRoom(interventionId);
    socket.join(interventionRoom);
    console.log(
      `✅ User ${socket.user.fullName} joined room: ${interventionRoom}`,
    );

    // Store intervention ID on socket for reference
    socket.currentInterventionId = interventionId;

    // Notify all managers
    io.to(rooms.managerRoom()).emit("new_emergency_call", {
      interventionId,
      location,
      type,
      description,
      priority: priority || "normal",
      callerInfo,
      timestamp: new Date(),
    });

    // Confirm to user
    socket.emit("call_received", {
      success: true,
      interventionId,
      message: "Emergency call received. Ambulance is being dispatched.",
    });

    console.log(
      `✅ Emergency call ${interventionId} created and managers notified`,
    );
  } catch (error) {
    console.error("Emergency call error:", error);
    socket.emit("call_error", {
      message: "Failed to process emergency call",
      error: error.message,
    });
  }
}

// User tracks their intervention
export async function handleTrackIntervention(socket, data) {
  const { interventionId } = data;
  const interventionRoom = rooms.interventionRoom(interventionId);
  socket.join(interventionRoom);
  console.log(
    `📢 User ${socket.user.fullName} manually joined room: ${interventionRoom}`,
  );
  socket.emit("tracking_started", { interventionId });
}
