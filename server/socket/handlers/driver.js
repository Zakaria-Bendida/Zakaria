// socket/handlers/driver.js
import { pool } from "../../config/database.js";
import rooms from "../rooms.js";

// Driver responds to assignment (accept/decline)
export async function handleDriverResponse(socket, io, data) {
  try {
    const { interventionId, ambulanceId, status, reason, eta } = data;

    console.log(
      `🚑 Driver response: ${status} for intervention ${interventionId}`,
    );

    if (status === "accepted") {
      // Update database
      await pool.query(
        "UPDATE interventions SET statut = $1, driver_accepted_at = NOW() WHERE id = $2",
        ["en route", interventionId],
      );

      await pool.query("UPDATE ambulances SET statut = $1 WHERE id = $2", [
        "En mission",
        ambulanceId,
      ]);

      // Get intervention details for notification
      const interventionQuery = await pool.query(
        "SELECT caller_name, latitude_depart, longitude_depart FROM interventions WHERE id = $1",
        [interventionId],
      );
      const intervention = interventionQuery.rows[0];

      // Notify all managers
      io.to(rooms.managerRoom()).emit("assignment_accepted", {
        interventionId,
        ambulanceId,
        eta: eta || 5,
        message: `Ambulance accepted. ETA: ${eta || 5} minutes`,
        timestamp: new Date(),
      });

      // Notify the user in the intervention room
      const interventionRoom = rooms.interventionRoom(interventionId);
      console.log(`📢 Sending notification to user room: ${interventionRoom}`);

      io.to(interventionRoom).emit("ambulance_on_way", {
        interventionId,
        eta: eta || 5,
        message: `Ambulance is on its way! ETA: ${eta || 5} minutes`,
      });

      console.log(`✅ Notification sent to room ${interventionRoom}`);
    } else {
      // Driver declined
      io.to(rooms.managerRoom()).emit("assignment_declined", {
        interventionId,
        ambulanceId,
        reason: reason || "Driver unavailable",
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error("Driver response error:", error);
  }
}

// Driver updates status (en route, arrived, transporting, completed)
export async function handleDriverStatusUpdate(socket, io, data) {
  try {
    const { ambulanceId, status, interventionId, eta } = data;

    console.log(`📍 Ambulance ${ambulanceId} status: ${status}`);

    // Update database
    await pool.query(
      "UPDATE ambulances SET statut = $1, updated_at = NOW() WHERE id = $2",
      [status === "completed" ? "Disponible" : "En mission", ambulanceId],
    );

    // Get ambulance details
    const ambulanceQuery = await pool.query(
      "SELECT immatriculation, latitude, longitude FROM ambulances WHERE id = $1",
      [ambulanceId],
    );
    const ambulance = ambulanceQuery.rows[0];

    // Broadcast to all managers
    io.to(rooms.managerRoom()).emit("driver_status_changed", {
      ambulanceId,
      ambulanceImmatriculation: ambulance.immatriculation,
      status,
      interventionId,
      lat: ambulance.latitude,
      lon: ambulance.longitude,
      eta: eta || null,
      timestamp: new Date(),
    });

    // Send specific updates to user based on status
    if (interventionId) {
      const interventionRoom = rooms.interventionRoom(interventionId);

      if (status === "arrived") {
        io.to(interventionRoom).emit("ambulance_arrived", {
          interventionId,
          message: "Ambulance has arrived at the scene!",
        });
        console.log(
          `📍 Arrival notification sent to intervention ${interventionId}`,
        );
      }

      if (status === "completed") {
        io.to(interventionRoom).emit("mission_completed", {
          interventionId,
          message: "Emergency response completed. Stay safe!",
        });
        console.log(
          `✅ Completion notification sent to intervention ${interventionId}`,
        );
      }
    }
  } catch (error) {
    console.error("Driver status update error:", error);
  }
}

// Driver shares live location (real-time tracking)
export async function handleDriverLocation(socket, io, data) {
  try {
    const { ambulanceId, lat, lon, speed } = data;

    // Update database
    await pool.query(
      "UPDATE ambulances SET latitude = $1, longitude = $2, updated_at = NOW() WHERE id = $3",
      [lat, lon, ambulanceId],
    );

    // Get ambulance details
    const ambulanceQuery = await pool.query(
      "SELECT immatriculation, statut FROM ambulances WHERE id = $1",
      [ambulanceId],
    );
    const ambulance = ambulanceQuery.rows[0];

    // Broadcast to all managers
    io.to(rooms.managerRoom()).emit("ambulance_location", {
      ambulanceId,
      ambulanceImmatriculation: ambulance.immatriculation,
      lat,
      lon,
      speed: speed || 0,
      status: ambulance.statut,
      timestamp: new Date(),
    });

    // Also broadcast to all drivers (optional)
    io.to(rooms.allDriversRoom()).emit("ambulance_location", {
      ambulanceId,
      lat,
      lon,
      speed: speed || 0,
      timestamp: new Date(),
    });

    console.log(
      `📍 Ambulance ${ambulanceId} location: ${lat}, ${lon} at ${speed}km/h`,
    );
  } catch (error) {
    console.error("Driver location error:", error);
  }
}
