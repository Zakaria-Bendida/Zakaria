// services/interventionService.js
import { pool } from "../config/database.js";
import routingService from "./routingService.js";
import User from "../models/User.js";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const haversineKm = (fromLat, fromLon, toLat, toLon) => {
  const R = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

async function calculateAssignmentMetrics(fromLat, fromLon, toLat, toLon) {
  const startLat = toNumber(fromLat);
  const startLon = toNumber(fromLon);
  const destLat = toNumber(toLat);
  const destLon = toNumber(toLon);

  if (
    startLat == null ||
    startLon == null ||
    destLat == null ||
    destLon == null
  ) {
    return { distanceKm: null, etaMinutes: null };
  }

  try {
    const startVertex = await routingService.findNearestVertex(
      startLat,
      startLon,
    );
    const endVertex = await routingService.findNearestVertex(destLat, destLon);

    if (startVertex.success && endVertex.success) {
      const eta = await routingService.calculateETAAdvanced(
        startVertex.vertex_id,
        endVertex.vertex_id,
        true,
        true,
      );

      if (eta.success && eta.data) {
        return {
          distanceKm: eta.data.total_km ?? null,
          etaMinutes: eta.data.total_minutes ?? null,
        };
      }
    }
  } catch (routeError) {
    console.error("Route calculation error:", routeError);
  }

  const distanceKm = parseFloat(
    haversineKm(startLat, startLon, destLat, destLon).toFixed(2),
  );
  return {
    distanceKm,
    etaMinutes: parseFloat(((distanceKm / 40) * 60).toFixed(1)),
  };
}

class InterventionService {
  // Create intervention
  // FIX: accepte désormais ambulance_id pour l'insérer en base. On ne notifie PAS le driver
  // ici — la notif + le passage de l'ambulance à "En mission" se font exclusivement dans
  // assignAmbulance(), appelé juste après par le contrôleur. Ça évite d'avoir deux chemins
  // de code différents qui peuvent désynchroniser l'état (ambulance "Disponible" en base
  // mais intervention déjà liée à elle, etc.)
  async createIntervention(data, io = null) {
    try {
      const {
        type,
        latitude_depart,
        longitude_depart,
        description,
        caller_name,
        caller_phone,
        ambulance_id, // FIX: était lu nulle part avant
      } = data;

      const query = `
        INSERT INTO interventions (type, latitude_depart, longitude_depart, description, statut, caller_name, caller_phone, ambulance_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'en attente', $5, $6, $7, NOW(), NOW())
        RETURNING id, type, statut, created_at, ambulance_id
      `;
      const result = await pool.query(query, [
        type,
        latitude_depart,
        longitude_depart,
        description,
        caller_name,
        caller_phone,
        ambulance_id || null,
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
  // FIX: calcule désormais distance_km / eta_minutes via routingService et les inclut
  // dans le payload "ambulance_assigned" envoyé au driver. Avant, ces champs n'étaient
  // jamais envoyés -> undefined côté HomeScreen.tsx.
  //
  // ⚠️ ADAPTER ICI si la signature réelle de routingService diffère. J'ai supposé une
  // fonction `calculateRoute(fromLat, fromLon, toLat, toLon)` qui retourne
  // { distanceKm, durationMinutes } (ou équivalent). Remplace l'appel ci-dessous par
  // ta fonction réelle si le nom/format est différent.
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

      const { distanceKm, etaMinutes } = await calculateAssignmentMetrics(
        startLat,
        startLon,
        emergency.latitude_depart,
        emergency.longitude_depart,
      );

      // ✅ Notify the driver directly by socketId
      if (io) {
        const activeDriver = await User.findOne({
          ambulanceId: ambulanceId,
          role: "ambulancier",
          isOnline: true,
        });

        const assignmentPayload = {
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
          distance_km: distanceKm,
          eta_minutes: etaMinutes,
          timestamp: new Date(),
        };

        const target = io.to(`driver_${ambulanceId}`);
        if (activeDriver && activeDriver.socketId) {
          target.to(activeDriver.socketId);
        }
        target.emit("ambulance_assigned", assignmentPayload);

        if (activeDriver && activeDriver.socketId) {
          console.log(
            `📢 Notification envoyée au conducteur ${activeDriver.fullName} (socket: ${activeDriver.socketId})`,
          );
        } else {
          console.log(
            `⚠️ Aucun conducteur en ligne pour l'ambulance ${ambulanceId}`,
          );
        }

        io.emit("ambulance_status_updated", {
          ambulanceId: ambulanceId,
          newStatus: "En mission",
          timestamp: new Date(),
        });
        console.log(
          `📢 Dashboard: ambulance ${ambulanceId} status updated to En mission`,
        );

        // FIX: le dashboard manager n'était jamais notifié que l'ambulance a bien
        // été liée à CETTE intervention -> c'est probablement pourquoi le card
        // manager ne montrait pas l'ambulance assignée sans rafraîchir la page.
        io.emit("intervention_updated", {
          interventionId: parseInt(interventionId),
          action: "ambulance_assigned",
          ambulanceId: parseInt(ambulanceId),
          timestamp: new Date(),
        });
      }

      const responseData = {
        intervention_id: parseInt(interventionId),
        ambulance_id: parseInt(ambulanceId),
        ambulance_immatriculation: ambulance.immatriculation,
        hospital: hospitalInfo,
        distance_km: distanceKm,
        eta_minutes: etaMinutes,
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
        "SELECT ambulance_id, statut, latitude_depart, longitude_depart FROM interventions WHERE id = $1",
        [id],
      );

      const oldAmbulanceId = current.rows[0]?.ambulance_id;
      const oldStatut = current.rows[0]?.statut;
      const currentLat = latitude_depart ?? current.rows[0]?.latitude_depart;
      const currentLon = longitude_depart ?? current.rows[0]?.longitude_depart;

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

      if (ambulance_id !== undefined && oldAmbulanceId !== ambulance_id && io) {
        // FIX: si la nouvelle ambulance choisie n'est pas "Disponible", on ne devrait
        // pas continuer à la traiter comme assignée avec succès. On vérifie son statut
        // ici pour éviter l'incohérence "card créé mais ambulance pas vraiment dispo".
        const ambStatusCheck = await pool.query(
          "SELECT statut FROM ambulances WHERE id = $1",
          [ambulance_id],
        );
        const newAmbulanceStatut = ambStatusCheck.rows[0]?.statut;

        if (newAmbulanceStatut && newAmbulanceStatut !== "Disponible") {
          console.log(
            `⚠️ Ambulance ${ambulance_id} n'est pas disponible (statut: ${newAmbulanceStatut}) — notif driver annulée`,
          );
        } else {
          let distanceKm = null;
          let etaMinutes = null;
          if (currentLat && currentLon) {
            try {
              const ambCoords = await pool.query(
                `SELECT a.latitude, a.longitude, p.latitude as parking_lat, p.longitude as parking_lon
                 FROM ambulances a LEFT JOIN parkings p ON a.parking_id = p.id
                 WHERE a.id = $1`,
                [ambulance_id],
              );
              const startLat =
                ambCoords.rows[0]?.parking_lat || ambCoords.rows[0]?.latitude;
              const startLon =
                ambCoords.rows[0]?.parking_lon || ambCoords.rows[0]?.longitude;

              if (startLat && startLon) {
                const metrics = await calculateAssignmentMetrics(
                  startLat,
                  startLon,
                  currentLat,
                  currentLon,
                );
                distanceKm = metrics.distanceKm;
                etaMinutes = metrics.etaMinutes;
              }
            } catch (routeError) {
              console.error("Route calculation error:", routeError);
            }
          }

          await pool.query(
            "UPDATE ambulances SET statut = 'En mission', updated_at = NOW() WHERE id = $1",
            [ambulance_id],
          );

          const activeDriver = await User.findOne({
            ambulanceId: ambulance_id,
            role: "ambulancier",
            isOnline: true,
          });

          const assignmentPayload = {
            interventionId: id,
            type,
            location: { lat: currentLat, lon: currentLon },
            patient: { name: caller_name, phone: caller_phone },
            description,
            distance_km: distanceKm,
            eta_minutes: etaMinutes,
            timestamp: new Date(),
          };

          const target = io.to(`driver_${ambulance_id}`);
          if (activeDriver && activeDriver.socketId) {
            target.to(activeDriver.socketId);
          }
          target.emit("ambulance_assigned", assignmentPayload);

          if (activeDriver && activeDriver.socketId) {
            console.log(
              `📢 Notification envoyée au conducteur ${activeDriver.fullName} (socket: ${activeDriver.socketId})`,
            );
          } else {
            console.log(
              `⚠️ Aucun conducteur en ligne pour l'ambulance ${ambulance_id}`,
            );
          }

          io.emit("ambulance_status_updated", {
            ambulanceId: ambulance_id,
            newStatus: "En mission",
            timestamp: new Date(),
          });
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

          io.emit("ambulance_status_updated", {
            ambulanceId: oldAmbulanceId,
            newStatus: "Disponible",
            timestamp: new Date(),
          });
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

        io.emit("intervention_completed", {
          interventionId,
          timestamp: new Date(),
        });

        if (currentIntervention.ambulance_id) {
          io.emit("ambulance_status_updated", {
            ambulanceId: currentIntervention.ambulance_id,
            newStatus: "Disponible",
            timestamp: new Date(),
          });
        }
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

          io.emit("ambulance_status_updated", {
            ambulanceId: currentIntervention.ambulance_id,
            newStatus: "Disponible",
            timestamp: new Date(),
          });
        }

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
