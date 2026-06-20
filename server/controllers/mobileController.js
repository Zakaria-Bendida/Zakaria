import { pool } from "../config/database.js";
import { User } from "../models/index.js";
import routingService from "../services/routingService.js";
import ambulanceService from "../services/ambulanceService.js";
import interventionService from "../services/interventionService.js";

class MobileController {
  async sosEmergency(req, res) {
    try {
      const { lat, lon, type, description } = req.body;
      const userId = req.user?.userId;
      const io = req.app.get("io");

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          error: "GPS location is required.",
        });
      }

      let callerName = "Appel d'urgence";
      let callerPhone = "Inconnu";
      let user = null;

      if (userId) {
        user = await User.findById(userId);
        if (user) {
          callerName = user.fullName;
          callerPhone = user.phone;
        }
      }

      const query = `
      INSERT INTO interventions (type, latitude_depart, longitude_depart, description, statut, caller_name, caller_phone, created_at)
      VALUES ($1, $2, $3, $4, 'en attente', $5, $6, NOW())
      RETURNING id
    `;

      const result = await pool.query(query, [
        type || "SOS Emergency",
        lat,
        lon,
        description || "Emergency call from mobile app",
        callerName,
        callerPhone,
      ]);

      const interventionId = result.rows[0].id;
      let assignedAmbulance = null;

      // ✅ Émettre un événement pour nouvelle intervention (dashboard managers)
      if (io) {
        io.emit("new_intervention", {
          interventionId,
          type: type || "SOS Emergency",
          location: { lat, lon },
          caller_name: callerName,
          timestamp: new Date(),
        });
      }

      try {
        // ✅ Trouver l'ambulance la plus proche
        const nearestResult = await ambulanceService.findNearestAmbulance(
          lat,
          lon,
        );

        if (nearestResult.success && nearestResult.data.length > 0) {
          // ✅ Récupérer les conducteurs en ligne depuis MongoDB
          const onlineDrivers = await User.find({
            role: "ambulancier",
            isOnline: true,
            isActive: true,
          }).select("ambulanceId fullName phone socketId");

          const onlineAmbulanceIds = onlineDrivers.map((d) => d.ambulanceId);

          // ✅ Prendre la première ambulance disponible avec conducteur en ligne
          const nearestAmbulance = nearestResult.data.find((amb) =>
            onlineAmbulanceIds.includes(amb.ambulance_id),
          );

          if (nearestAmbulance) {
            assignedAmbulance = nearestAmbulance;
            const driver = onlineDrivers.find(
              (d) => d.ambulanceId === nearestAmbulance.ambulance_id,
            );

            let etaMinutes = 5;
            let distanceKm = nearestAmbulance.distance_km || 0;

            try {
              const ambCoords = await pool.query(
                "SELECT latitude, longitude FROM ambulances WHERE id = $1",
                [nearestAmbulance.ambulance_id],
              );

              if (ambCoords.rows[0]?.latitude && ambCoords.rows[0]?.longitude) {
                const ambVertex = await routingService.findNearestVertex(
                  ambCoords.rows[0].latitude,
                  ambCoords.rows[0].longitude,
                );
                const intVertex = await routingService.findNearestVertex(
                  lat,
                  lon,
                );

                const etaResult = await routingService.calculateETAAdvanced(
                  ambVertex.vertex_id,
                  intVertex.vertex_id,
                  false,
                  true,
                );
                if (etaResult.success && etaResult.data) {
                  etaMinutes = etaResult.data.total_minutes || 5;
                  distanceKm = etaResult.data.total_km || distanceKm;
                  console.log(
                    `📊 ETA calculé: ${etaMinutes} min, ${distanceKm} km`,
                  );
                }
              }
            } catch (routingError) {
              console.error("Routing ETA error:", routingError);
            }

            if (io && driver && driver.socketId) {
              io.to(driver.socketId).emit("ambulance_assigned", {
                interventionId,
                type: type || "SOS Emergency",
                location: { lat, lon },
                patient: {
                  name: callerName,
                  phone: callerPhone,
                },
                description: description || "Emergency call from mobile app",
                distance_km: distanceKm,
                eta_minutes: Math.round(etaMinutes),
                timestamp: new Date(),
              });
            } else {
              console.log(
                `⚠️ Impossible d'émettre: io=${!!io}, driver=${!!driver}, socketId=${driver?.socketId}`,
              );
            }
          } else {
            console.log(
              `⚠️ Aucune ambulance ONLINE trouvée pour intervention ${interventionId}`,
            );
          }
        }
      } catch (assignError) {
        console.error("Error sending alerts to drivers:", assignError);
      }

      if (io) {
        io.to("managers").emit("new_emergency_call", {
          interventionId,
          location: { lat, lon },
          type: type || "SOS Emergency",
          priority: "high",
          callerInfo: { name: callerName, phone: callerPhone },
          assignedAmbulance: assignedAmbulance,
          timestamp: new Date(),
        });
      }

      // ✅ Message de réponse
      let responseMessage = "✅ SOS reçu! ";
      if (assignedAmbulance) {
        responseMessage = `✅ SOS reçu! L'ambulance ${assignedAmbulance.immatriculation} a été alertée et arrive dans quelques minutes.`;
      } else {
        responseMessage =
          "✅ SOS reçu! Aucune ambulance disponible pour le moment. Vous serez notifié.";
      }

      res.json({
        success: true,
        interventionId,
        message: responseMessage,
        assignedAmbulance: assignedAmbulance,
        location: { lat, lon },
      });
    } catch (error) {
      console.error("SOS emergency error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async trackAmbulance(req, res) {
    try {
      const { interventionId } = req.params;

      const query = `
      SELECT 
        i.id, 
        i.statut as intervention_status,
        i.latitude_depart,
        i.longitude_depart,
        a.id as ambulance_id, 
        a.immatriculation, 
        a.statut as ambulance_status,
        a.latitude, 
        a.longitude
      FROM interventions i
      LEFT JOIN ambulances a ON i.ambulance_id = a.id
      WHERE i.id = $1
    `;

      const result = await pool.query(query, [interventionId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Intervention not found",
        });
      }

      const data = result.rows[0];

      if (data.ambulance_id) {
        try {
          const driver = await User.findOne({
            ambulanceId: data.ambulance_id,
            role: "ambulancier",
            isOnline: true,
          }).select("fullName phone email");

          if (driver) {
            data.driver = {
              fullName: driver.fullName,
              phone: driver.phone,
              email: driver.email,
            };
          } else {
            console.log(
              "⚠️ No online driver found for ambulance:",
              data.ambulance_id,
            );
            data.driver = null;
          }
        } catch (mongoError) {
          console.error("❌ MongoDB error:", mongoError.message);
          data.driver = null;
        }
      } else {
        console.log("⚠️ No ambulance assigned yet");
        data.driver = null;
      }

      console.log("✅ Tracking response:", {
        id: data.id,
        ambulance_id: data.ambulance_id,
        hasDriver: !!data.driver,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error("❌ Track ambulance error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get ETA
  async getETA(req, res) {
    try {
      const { interventionId } = req.params;

      const intervention = await pool.query(
        "SELECT latitude_depart, longitude_depart FROM interventions WHERE id = $1",
        [interventionId],
      );

      if (intervention.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Intervention not found",
        });
      }

      const ambulance = await pool.query(
        `SELECT a.latitude, a.longitude 
         FROM interventions i 
         JOIN ambulances a ON i.ambulance_id = a.id 
         WHERE i.id = $1 AND i.ambulance_id IS NOT NULL`,
        [interventionId],
      );

      if (ambulance.rows.length === 0) {
        return res.json({
          success: true,
          data: { eta: null, message: "Ambulance not yet assigned" },
        });
      }

      const ambVertex = await routingService.findNearestVertex(
        ambulance.rows[0].latitude,
        ambulance.rows[0].longitude,
      );
      const intVertex = await routingService.findNearestVertex(
        intervention.rows[0].latitude_depart,
        intervention.rows[0].longitude_depart,
      );

      const eta = await routingService.calculateETAAdvanced(
        ambVertex.vertex_id,
        intVertex.vertex_id,
      );

      res.json({ success: true, data: eta.data });
    } catch (error) {
      console.error("Get ETA error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getHistory(req, res) {
    try {
      const userId = req.user.userId;
      const user = await User.findById(userId);

      const query = `
        SELECT id, type, statut, latitude_depart, longitude_depart, created_at
        FROM interventions 
        WHERE caller_phone = $1
        ORDER BY created_at DESC
        LIMIT 20
      `;

      const result = await pool.query(query, [user.phone]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("Get history error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Cancel emergency
  async cancelEmergency(req, res) {
    try {
      const { interventionId } = req.params;

      await pool.query(
        "UPDATE interventions SET statut = $1, updated_at = NOW() WHERE id = $2",
        ["annulé", interventionId],
      );

      res.json({ success: true, message: "Emergency cancelled" });
    } catch (error) {
      console.error("Cancel emergency error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new MobileController();
