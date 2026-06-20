// services/interventionService.js
import { pool } from "../config/database.js";
import routingService from "./routingService.js";
import User from "../models/User.js"; // ✅ single import at top, no dynamic import needed

class InterventionService {
  // Create intervention
  async createIntervention(data, io = null) {
    try {
      const {
        type,
        latitude_depart,
        longitude_depart,
        description,
        caller_name,
        caller_phone,
      } = data;

      const query = `
        INSERT INTO interventions (type, latitude_depart, longitude_depart, description, statut, caller_name, caller_phone, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'en attente', $5, $6, NOW(), NOW())
        RETURNING id, type, statut, created_at
      `;
      const result = await pool.query(query, [
        type,
        latitude_depart,
        longitude_depart,
        description,
        caller_name,
        caller_phone,
      ]);

      if (io) {
        io.emit("new_intervention", {
          interventionId: result.rows[0].id,
          type,
          location: { lat: latitude_depart, lon: longitude_depart },
          caller_name,
          timestamp: new Date(),
        });
        console.log(
          `📢 Nouvelle intervention ${result.rows[0].id} - notification envoyée`,
        );
      }

      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error("Create intervention error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get all interventions
  async getAllInterventions() {
    try {
      const query = `
        SELECT i.*, a.immatriculation as ambulance_immatriculation
        FROM interventions i
        LEFT JOIN ambulances a ON i.ambulance_id = a.id
        ORDER BY i.created_at DESC
      `;
      const result = await pool.query(query);
      return { success: true, data: result.rows };
    } catch (error) {
      console.error("Get interventions error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get intervention by ID
  async getInterventionById(id) {
    try {
      const query = `
        SELECT i.*, a.immatriculation as ambulance_immatriculation
        FROM interventions i
        LEFT JOIN ambulances a ON i.ambulance_id = a.id
        WHERE i.id = $1
      `;
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) {
        return { success: false, error: "Intervention not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error("Get intervention error:", error);
      return { success: false, error: error.message };
    }
  }

  // Assign ambulance to intervention
  async assignAmbulance(
    interventionId,
    ambulanceId,
    hospitalId = null,
    skipHospital = true,
    io = null,
  ) {
    try {
      const ambulanceQuery = `
      SELECT 
        a.id, a.immatriculation, a.statut, 
        a.latitude, a.longitude, a.parking_id,
        p.latitude as parking_lat, p.longitude as parking_lon, p.nom as parking_name
      FROM ambulances a
      LEFT JOIN parkings p ON a.parking_id = p.id
      WHERE a.id = $1
    `;
      const ambulanceResult = await pool.query(ambulanceQuery, [ambulanceId]);

      if (ambulanceResult.rows.length === 0) {
        return { success: false, error: "Ambulance not found" };
      }
      const ambulance = ambulanceResult.rows[0];

      if (ambulance.statut !== "Disponible") {
        return {
          success: false,
          error: `Ambulance ${ambulance.immatriculation} is not available`,
        };
      }

      const startLat = ambulance.parking_lat || ambulance.latitude;
      const startLon = ambulance.parking_lon || ambulance.longitude;

      if (!startLat || !startLon) {
        return {
          success: false,
          error: `Ambulance ${ambulance.immatriculation} has no valid starting coordinates`,
        };
      }

      const intervention = await pool.query(
        "SELECT id, latitude_depart, longitude_depart, caller_name, caller_phone, type, description FROM interventions WHERE id = $1",
        [interventionId],
      );
      if (intervention.rows.length === 0) {
        return { success: false, error: "Intervention not found" };
      }
      const emergency = intervention.rows[0];

      let finalHospitalId = null;
      let hospitalInfo = null;

      if (hospitalId && !skipHospital) {
        finalHospitalId = hospitalId;
        const hospital = await pool.query(
          "SELECT id, nom FROM hopitaux WHERE id = $1",
          [hospitalId],
        );
        if (hospital.rows.length > 0) {
          hospitalInfo = {
            hospital_id: hospitalId,
            hospital_name: hospital.rows[0].nom,
          };
        }
      }

      await pool.query(
        `UPDATE interventions 
       SET ambulance_id = $1, hospital_id = $2, statut = 'en route', updated_at = NOW() 
       WHERE id = $3`,
        [ambulanceId, finalHospitalId, interventionId],
      );

      await pool.query(
        "UPDATE ambulances SET statut = 'En mission', updated_at = NOW() WHERE id = $1",
        [ambulanceId],
      );

      // ✅ Notify the driver directly by socketId
      if (io) {
        const activeDriver = await User.findOne({
          ambulanceId: ambulanceId,
          role: "ambulancier",
          isOnline: true,
        });

        if (activeDriver && activeDriver.socketId) {
          io.to(activeDriver.socketId).emit("ambulance_assigned", {
            interventionId,
            type: emergency.type,
            location: {
              lat: emergency.latitude_depart,
              lon: emergency.longitude_depart,
            },
            patient: {
              name: emergency.caller_name,
              phone: emergency.caller_phone,
            },
            description: emergency.description,
            timestamp: new Date(),
          });
          console.log(
            `📢 Notification envoyée au conducteur ${activeDriver.fullName} (socket: ${activeDriver.socketId})`,
          );
        } else {
          console.log(
            `⚠️ Aucun conducteur en ligne pour l'ambulance ${ambulanceId}`,
          );
        }

        // ✅✅✅ AJOUTER CET ÉVÉNEMENT POUR LE DASHBOARD ✅✅✅
        io.emit("ambulance_status_updated", {
          ambulanceId: ambulanceId,
          newStatus: "En mission",
          timestamp: new Date(),
        });
        console.log(
          `📢 Dashboard: ambulance ${ambulanceId} status updated to En mission`,
        );
      }

      const responseData = {
        intervention_id: parseInt(interventionId),
        ambulance_id: parseInt(ambulanceId),
        ambulance_immatriculation: ambulance.immatriculation,
        hospital: hospitalInfo,
      };

      if (ambulance.parking_id) {
        responseData.parking = {
          id: ambulance.parking_id,
          name: ambulance.parking_name,
          lat: startLat,
          lon: startLon,
        };
      }

      return {
        success: true,
        data: responseData,
        message: `Ambulance ${ambulance.immatriculation} assigned successfully`,
      };
    } catch (error) {
      console.error("Assign ambulance error:", error);
      return { success: false, error: error.message };
    }
  }

  // Update intervention
  async updateIntervention(id, data, io = null) {
    try {
      const {
        type,
        description,
        latitude_depart,
        longitude_depart,
        ambulance_id,
        hospital_id,
        priority,
        caller_name,
        caller_phone,
        statut,
      } = data;

      console.log("🔧 Updating intervention:", { id, data });

      const current = await pool.query(
        "SELECT ambulance_id, statut FROM interventions WHERE id = $1",
        [id],
      );

      const oldAmbulanceId = current.rows[0]?.ambulance_id;
      const oldStatut = current.rows[0]?.statut;

      const updates = [];
      const values = [];
      let paramCount = 1;
      let newStatut = null;

      if (type !== undefined) {
        updates.push(`type = $${paramCount++}`);
        values.push(type);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }
      if (latitude_depart !== undefined) {
        updates.push(`latitude_depart = $${paramCount++}`);
        values.push(latitude_depart);
      }
      if (longitude_depart !== undefined) {
        updates.push(`longitude_depart = $${paramCount++}`);
        values.push(longitude_depart);
      }
      if (ambulance_id !== undefined) {
        updates.push(`ambulance_id = $${paramCount++}`);
        values.push(ambulance_id);
      }
      if (hospital_id !== undefined) {
        updates.push(`hospital_id = $${paramCount++}`);
        values.push(hospital_id);
      }
      if (priority !== undefined) {
        updates.push(`priority = $${paramCount++}`);
        values.push(priority);
      }
      if (caller_name !== undefined) {
        updates.push(`caller_name = $${paramCount++}`);
        values.push(caller_name);
      }
      if (caller_phone !== undefined) {
        updates.push(`caller_phone = $${paramCount++}`);
        values.push(caller_phone);
      }

      if (ambulance_id !== undefined && oldStatut === "en attente") {
        newStatut = "en route";
      } else if (statut !== undefined) {
        newStatut = statut;
      }

      if (newStatut) {
        updates.push(`statut = $${paramCount++}`);
        values.push(newStatut);
      }

      if (updates.length === 0) {
        return { success: false, error: "No fields to update" };
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
      UPDATE interventions
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

      console.log("📝 SQL Query:", query);
      console.log("📝 Values:", values);

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return { success: false, error: "Intervention not found" };
      }

      // ✅ FIXED: no dynamic import, User already imported at top
      if (ambulance_id !== undefined && oldAmbulanceId !== ambulance_id && io) {
        // Notify new driver directly by socketId
        const activeDriver = await User.findOne({
          ambulanceId: ambulance_id,
          role: "ambulancier",
          isOnline: true,
        });

        if (activeDriver && activeDriver.socketId) {
          io.to(activeDriver.socketId).emit("ambulance_assigned", {
            interventionId: id,
            type,
            location: { lat: latitude_depart, lon: longitude_depart },
            patient: { name: caller_name, phone: caller_phone },
            description,
            timestamp: new Date(),
          });
          console.log(
            `📢 Notification envoyée au conducteur ${activeDriver.fullName} (socket: ${activeDriver.socketId})`,
          );
        } else {
          console.log(
            `⚠️ Aucun conducteur en ligne pour l'ambulance ${ambulance_id}`,
          );
        }

        // Free old ambulance and notify old driver
        if (oldAmbulanceId) {
          await pool.query(
            "UPDATE ambulances SET statut = 'Disponible', updated_at = NOW() WHERE id = $1",
            [oldAmbulanceId],
          );
          console.log(`🔓 Ancienne ambulance ${oldAmbulanceId} libérée`);

          const oldDriver = await User.findOne({
            ambulanceId: oldAmbulanceId,
            role: "ambulancier",
            isOnline: true,
          });

          if (oldDriver && oldDriver.socketId) {
            io.to(oldDriver.socketId).emit("mission_cancelled", {
              interventionId: id,
              message: "La mission a été réassignée à une autre ambulance.",
            });
            console.log(
              `📢 Ancien conducteur ${oldDriver.fullName} notifié de la réassignation`,
            );
          }
        }

        // ✅✅✅ AJOUTER CET ÉVÉNEMENT POUR LE DASHBOARD AMBULANCES ✅✅✅
        io.emit("ambulance_status_updated", {
          ambulanceId: ambulance_id,
          newStatus: "En mission",
          timestamp: new Date(),
        });
        console.log(
          `📢 Dashboard: ambulance ${ambulance_id} status updated to En mission (via updateIntervention)`,
        );

        // Si on a libéré une ancienne ambulance, aussi notifier le dashboard
        if (oldAmbulanceId) {
          io.emit("ambulance_status_updated", {
            ambulanceId: oldAmbulanceId,
            newStatus: "Disponible",
            timestamp: new Date(),
          });
          console.log(
            `📢 Dashboard: ambulance ${oldAmbulanceId} status updated to Disponible`,
          );
        }
      }

      // Broadcast dashboard refresh for interventions
      if (io) {
        io.emit("intervention_updated", {
          interventionId: id,
          action: "updated",
          timestamp: new Date(),
        });
      }

      const finalResult = await pool.query(
        `SELECT i.*, a.immatriculation as ambulance_immatriculation
       FROM interventions i
       LEFT JOIN ambulances a ON i.ambulance_id = a.id
       WHERE i.id = $1`,
        [id],
      );

      console.log("✅ Update successful:", finalResult.rows[0]);
      return { success: true, data: finalResult.rows[0] };
    } catch (error) {
      console.error("Update intervention error:", error);
      return { success: false, error: error.message };
    }
  }

  // Complete intervention
  async completeIntervention(interventionId, io = null) {
    try {
      const intervention = await pool.query(
        "SELECT id, ambulance_id, statut FROM interventions WHERE id = $1",
        [interventionId],
      );

      if (intervention.rows.length === 0) {
        return { success: false, error: "Intervention not found" };
      }

      const currentIntervention = intervention.rows[0];

      if (currentIntervention.statut === "terminée") {
        return { success: false, error: "Intervention already completed" };
      }
      if (currentIntervention.statut === "annulée") {
        return {
          success: false,
          error: "Cannot complete a cancelled intervention",
        };
      }

      await pool.query(
        "UPDATE interventions SET statut = 'terminée', updated_at = NOW() WHERE id = $1",
        [interventionId],
      );

      if (currentIntervention.ambulance_id) {
        await pool.query(
          "UPDATE ambulances SET statut = 'Disponible', updated_at = NOW() WHERE id = $1",
          [currentIntervention.ambulance_id],
        );
      }

      if (io) {
        // ✅ Notify the driver directly
        const activeDriver = await User.findOne({
          ambulanceId: currentIntervention.ambulance_id,
          role: "ambulancier",
          isOnline: true,
        });

        if (activeDriver && activeDriver.socketId) {
          io.to(activeDriver.socketId).emit("intervention_completed", {
            interventionId,
            timestamp: new Date(),
          });
          console.log(
            `📢 Conducteur ${activeDriver.fullName} notifié de la fin de mission`,
          );
        }

        // Also broadcast to dashboard
        io.emit("intervention_completed", {
          interventionId,
          timestamp: new Date(),
        });
      }

      return { success: true, message: "Intervention completed successfully" };
    } catch (error) {
      console.error("Complete intervention error:", error);
      return { success: false, error: error.message };
    }
  }

  // Cancel intervention
  async cancelIntervention(interventionId, io = null) {
    try {
      const intervention = await pool.query(
        "SELECT id, ambulance_id, statut FROM interventions WHERE id = $1",
        [interventionId],
      );

      if (intervention.rows.length === 0) {
        return { success: false, error: "Intervention not found" };
      }

      const currentIntervention = intervention.rows[0];

      if (currentIntervention.statut === "terminée") {
        return {
          success: false,
          error: "Cannot cancel a completed intervention",
        };
      }
      if (currentIntervention.statut === "annulée") {
        return { success: false, error: "Intervention is already cancelled" };
      }

      if (currentIntervention.ambulance_id) {
        await pool.query(
          "UPDATE ambulances SET statut = 'Disponible' WHERE id = $1",
          [currentIntervention.ambulance_id],
        );
      }

      await pool.query(
        `UPDATE interventions 
         SET statut = 'annulée', updated_at = NOW(), ambulance_id = NULL 
         WHERE id = $1`,
        [interventionId],
      );

      if (io) {
        // ✅ FIXED: notify driver directly with mission_cancelled (was missing before)
        if (currentIntervention.ambulance_id) {
          const activeDriver = await User.findOne({
            ambulanceId: currentIntervention.ambulance_id,
            role: "ambulancier",
            isOnline: true,
          });

          if (activeDriver && activeDriver.socketId) {
            io.to(activeDriver.socketId).emit("mission_cancelled", {
              interventionId,
              message: "La mission a été annulée par le dispatcher.",
            });
            console.log(
              `📢 Conducteur ${activeDriver.fullName} notifié de l'annulation`,
            );
          }
        }

        // Also broadcast to dashboard
        io.emit("intervention_cancelled", {
          interventionId,
          timestamp: new Date(),
        });
      }

      return { success: true, message: "Intervention cancelled successfully" };
    } catch (error) {
      console.error("Cancel intervention error:", error);
      return { success: false, error: error.message };
    }
  }

  // Delete intervention
  async deleteIntervention(id) {
    try {
      const intervention = await pool.query(
        "SELECT statut FROM interventions WHERE id = $1",
        [id],
      );

      if (intervention.rows.length === 0) {
        return { success: false, error: "Intervention not found" };
      }

      const statut = intervention.rows[0].statut;
      if (statut !== "terminée" && statut !== "annulée") {
        return {
          success: false,
          error:
            "Cannot delete active intervention. Cancel or complete it first.",
        };
      }

      await pool.query("DELETE FROM interventions WHERE id = $1", [id]);
      return { success: true, message: "Intervention deleted successfully" };
    } catch (error) {
      console.error("Delete intervention error:", error);
      return { success: false, error: error.message };
    }
  }

  // Confirm intervention
  async confirmIntervention(interventionId) {
    try {
      const intervention = await pool.query(
        "SELECT id, statut FROM interventions WHERE id = $1",
        [interventionId],
      );

      if (intervention.rows.length === 0) {
        return { success: false, error: "Intervention not found" };
      }

      console.log(
        `✅ Intervention ${interventionId} confirmed as real emergency`,
      );
      return {
        success: true,
        message: "Intervention confirmed as real emergency",
      };
    } catch (error) {
      console.error("Confirm intervention error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN statut = 'terminée' THEN 1 END) as completed,
          COUNT(CASE WHEN statut = 'en route' THEN 1 END) as in_progress,
          COUNT(CASE WHEN statut = 'en attente' THEN 1 END) as pending,
          COUNT(CASE WHEN statut = 'annulée' THEN 1 END) as cancelled
        FROM interventions
      `;
      const result = await pool.query(query);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error("Get statistics error:", error);
      return { success: false, error: error.message };
    }
  }
}

export default new InterventionService();
