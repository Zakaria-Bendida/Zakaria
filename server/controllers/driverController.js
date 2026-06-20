// server/controllers/driverController.js
// FIXED:
// 1. selectHospitalAndRoute: route from SOS → hospital using routeType (fastest/comfort)
// 2. getRouteToHospital: same fix
// 3. roadblock: immediate active status (no manager approval needed for driver)

import { pool } from "../config/database.js";
import { User } from "../models/index.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import routingService from "../services/routingService.js";

// ── Helper: recalculate route avoiding blocked road ───────────────────────
async function recalculateRouteFunc(ambulanceId, destLat, destLon) {
  const blockedEdges = await pool
    .query(
      `SELECT edge_id FROM blocked_roads
     WHERE status = 'active' AND expires_at > NOW()`,
    )
    .catch(() => ({ rows: [] }));

  const blockedIds = blockedEdges.rows.map((r) => r.edge_id);

  const ambulance = await pool.query(
    "SELECT latitude, longitude FROM ambulances WHERE id = $1",
    [ambulanceId],
  );

  const startVertex = await routingService.findNearestVertex(
    ambulance.rows[0].latitude,
    ambulance.rows[0].longitude,
  );
  const endVertex = await routingService.findNearestVertex(destLat, destLon);

  if (!startVertex.success || !endVertex.success)
    return { success: false, error: "Cannot find vertices" };

  return routingService.getPathAvoidingEdges(
    startVertex.vertex_id,
    endVertex.vertex_id,
    blockedIds,
    false,
  );
}

class DriverController {
  // ── Driver login ────────────────────────────────────────────────────────
  async driverLogin(req, res) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password)
        return res
          .status(400)
          .json({ success: false, error: "Phone and password required" });

      const driver = await User.findOne({ phone, role: "ambulancier" });
      if (!driver)
        return res
          .status(404)
          .json({ success: false, error: "Driver not found" });
      if (!driver.isActive)
        return res
          .status(401)
          .json({ success: false, error: "Account deactivated" });

      const isValid = await bcrypt.compare(password, driver.passwordHash);
      if (!isValid)
        return res
          .status(401)
          .json({ success: false, error: "Invalid password" });

      const ambulance = await pool.query(
        "SELECT id, immatriculation, statut, latitude, longitude FROM ambulances WHERE id = $1",
        [driver.ambulanceId],
      );
      if (!ambulance.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "No ambulance assigned" });

      const token = jwt.sign(
        {
          userId: driver._id,
          ambulanceId: driver.ambulanceId,
          role: "ambulancier",
          fullName: driver.fullName,
          phone: driver.phone,
        },
        process.env.JWT_SECRET || "secret123",
        { expiresIn: "24h" },
      );

      res.json({
        success: true,
        data: {
          driver: {
            id: driver._id,
            fullName: driver.fullName,
            phone: driver.phone,
            role: driver.role,
          },
          ambulance: {
            id: ambulance.rows[0].id,
            immatriculation: ambulance.rows[0].immatriculation,
            status: ambulance.rows[0].statut,
            latitude: ambulance.rows[0].latitude,
            longitude: ambulance.rows[0].longitude,
          },
          token,
        },
      });
    } catch (error) {
      console.error("Driver login error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  // ── Current assignment ──────────────────────────────────────────────────
  async getCurrentAssignment(req, res) {
    try {
      const ambulanceId = req.user.ambulanceId;
      const ambulance = await pool.query(
        "SELECT latitude, longitude FROM ambulances WHERE id = $1",
        [ambulanceId],
      );
      if (!ambulance.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "Ambulance not found" });

      const result = await pool.query(
        `SELECT i.id, i.type, i.description, i.statut,
                i.latitude_depart, i.longitude_depart,
                i.caller_name, i.caller_phone, i.created_at,
                h.id AS hospital_id, h.nom AS hospital_name,
                h.latitude AS hospital_lat, h.longitude AS hospital_lon
         FROM interventions i
         LEFT JOIN hopitaux h ON i.hospital_id = h.id
         WHERE i.ambulance_id = $1
           AND i.statut IN ('en route','transporting','transport','sur_place','arrived')
         ORDER BY i.created_at DESC LIMIT 1`,
        [ambulanceId],
      );

      if (!result.rows.length)
        return res.json({
          success: true,
          data: null,
          message: "No active assignment",
        });

      const assignment = result.rows[0];

      // Get route geometry
      let eta = null,
        routeGeometry = null;
      try {
        const ambVertex = await routingService.findNearestVertex(
          ambulance.rows[0].latitude,
          ambulance.rows[0].longitude,
        );
        const destVertex = await routingService.findNearestVertex(
          assignment.latitude_depart,
          assignment.longitude_depart,
        );
        if (ambVertex.success && destVertex.success) {
          const route = await routingService.getPathAvoidingEdges(
            ambVertex.vertex_id,
            destVertex.vertex_id,
            [],
            false,
          );
          const etaResult = await routingService.calculateETAAdvanced(
            ambVertex.vertex_id,
            destVertex.vertex_id,
            false,
            true,
          );
          if (etaResult.success) eta = etaResult.data;
          if (route.success) routeGeometry = route.data;
        }
      } catch (e) {
        console.warn("Route calc error:", e.message);
      }

      res.json({
        success: true,
        data: { ...assignment, eta, route_geometry: routeGeometry },
      });
    } catch (error) {
      console.error("Get assignment error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ── Update driver location ──────────────────────────────────────────────
  async updateLocation(req, res) {
    try {
      const { lat, lon, speed } = req.body;
      const ambulanceId = req.user.ambulanceId;
      if (!lat || !lon)
        return res
          .status(400)
          .json({ success: false, error: "lat and lon required" });

      await pool.query(
        "UPDATE ambulances SET latitude=$1, longitude=$2, updated_at=NOW() WHERE id=$3",
        [lat, lon, ambulanceId],
      );

      const io = req.app.get("io");
      if (io) {
        io.to("managers").emit("ambulance_location", {
          ambulanceId,
          lat,
          lon,
          speed: speed || 0,
          timestamp: new Date(),
        });
      }
      res.json({
        success: true,
        message: "Location updated",
        data: { lat, lon, speed: speed || 0 },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  // ── Update driver status ────────────────────────────────────────────────
  async updateStatus(req, res) {
    try {
      const { status, interventionId } = req.body;
      const ambulanceId = req.user.ambulanceId;

      const validStatuses = [
        "en_route",
        "arrived",
        "transporting",
        "completed",
      ];
      if (!validStatuses.includes(status))
        return res
          .status(400)
          .json({ success: false, error: "Invalid status" });

      const ambulanceStatusMap = {
        en_route: "En mission",
        arrived: "En mission",
        transporting: "En mission",
        completed: "Disponible",
      };

      await pool.query(
        "UPDATE ambulances SET statut=$1, updated_at=NOW() WHERE id=$2",
        [ambulanceStatusMap[status], ambulanceId],
      );

      if (interventionId && status === "arrived") {
        await pool.query(
          "UPDATE interventions SET statut='sur_place', updated_at=NOW() WHERE id=$1",
          [interventionId],
        );
      }
      if (interventionId && status === "completed") {
        await pool.query(
          "UPDATE interventions SET statut='terminé', updated_at=NOW() WHERE id=$1",
          [interventionId],
        );
      }

      const io = req.app.get("io");
      if (io && status === "arrived" && interventionId) {
        io.to(`intervention_${interventionId}`).emit("ambulance_arrived", {
          interventionId,
          message: "Ambulance has arrived",
        });
      }

      res.json({ success: true, message: `Status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  // ── Get route to intervention ───────────────────────────────────────────
  async getRoute(req, res) {
    try {
      const { interventionId } = req.params;
      const { routeType = "fastest" } = req.query;
      const ambulanceId = req.user.ambulanceId;

      const intervention = await pool.query(
        "SELECT latitude_depart, longitude_depart FROM interventions WHERE id=$1",
        [interventionId],
      );
      if (!intervention.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "Intervention not found" });

      const ambulance = await pool.query(
        "SELECT latitude, longitude FROM ambulances WHERE id=$1",
        [ambulanceId],
      );
      if (!ambulance.rows[0]?.latitude)
        return res
          .status(404)
          .json({ success: false, error: "Ambulance has no position" });

      const startVertex = await routingService.findNearestVertex(
        ambulance.rows[0].latitude,
        ambulance.rows[0].longitude,
      );
      const endVertex = await routingService.findNearestVertex(
        intervention.rows[0].latitude_depart,
        intervention.rows[0].longitude_depart,
      );
      if (!startVertex.success || !endVertex.success)
        return res
          .status(404)
          .json({ success: false, error: "Could not find route vertices" });

      let route;
      if (routeType === "comfort") {
        route = await routingService.getComfortPath(
          startVertex.vertex_id,
          endVertex.vertex_id,
          false,
        );
      } else {
        route = await routingService.getPathAvoidingEdges(
          startVertex.vertex_id,
          endVertex.vertex_id,
          [],
          false,
        );
      }

      res.json({
        success: true,
        data: {
          start: {
            lat: ambulance.rows[0].latitude,
            lon: ambulance.rows[0].longitude,
          },
          destination: {
            lat: intervention.rows[0].latitude_depart,
            lon: intervention.rows[0].longitude_depart,
          },
          route: route.data || [],
          routeType,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }

  // ── FIXED: Get route to hospital ────────────────────────────────────────
  // Route is calculated FROM the SOS location (emergency pickup) TO the hospital
  async getRouteToHospital(req, res) {
    try {
      const { interventionId } = req.params;
      const { routeType = "fastest" } = req.query;
      const ambulanceId = req.user.ambulanceId;

      const intervention = await pool.query(
        `SELECT i.id, i.latitude_depart, i.longitude_depart, i.hospital_id, i.statut,
                h.id AS hosp_id, h.nom AS hospital_name,
                h.latitude AS hospital_lat, h.longitude AS hospital_lon
         FROM interventions i
         LEFT JOIN hopitaux h ON i.hospital_id = h.id
         WHERE i.id = $1`,
        [interventionId],
      );

      if (!intervention.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "Intervention not found" });

      const data = intervention.rows[0];

      if (!data.hospital_id)
        return res
          .status(400)
          .json({ success: false, error: "No hospital selected yet" });

      // FIX: Start from ambulance current position (driver already at/near SOS)
      const ambulance = await pool.query(
        "SELECT latitude, longitude FROM ambulances WHERE id=$1",
        [ambulanceId],
      );

      const fromLat =
        ambulance.rows[0]?.latitude ?? parseFloat(data.latitude_depart);
      const fromLon =
        ambulance.rows[0]?.longitude ?? parseFloat(data.longitude_depart);
      const toLat = parseFloat(data.hospital_lat);
      const toLon = parseFloat(data.hospital_lon);

      if (!toLat || !toLon)
        return res
          .status(400)
          .json({ success: false, error: "Hospital has no coordinates" });

      const startVertex = await routingService.findNearestVertex(
        fromLat,
        fromLon,
      );
      const endVertex = await routingService.findNearestVertex(toLat, toLon);

      if (!startVertex.success || !endVertex.success)
        return res
          .status(404)
          .json({
            success: false,
            error: "Could not find route on road network",
          });

      let route;
      if (routeType === "comfort") {
        route = await routingService.getComfortPath(
          startVertex.vertex_id,
          endVertex.vertex_id,
          false,
        );
      } else {
        route = await routingService.getPathAvoidingEdges(
          startVertex.vertex_id,
          endVertex.vertex_id,
          [],
          false,
        );
      }

      // If routing failed try base path
      if (!route.success || !route.data?.length) {
        route = await routingService.getPathWithGeometry(
          startVertex.vertex_id,
          endVertex.vertex_id,
          false,
        );
      }

      const eta = await routingService.calculateETAAdvanced(
        startVertex.vertex_id,
        endVertex.vertex_id,
        false,
        true,
      );

      // Update status to transport if not already
      const allowedUpdate = ["arrived", "sur_place", "transport", "en route"];
      if (allowedUpdate.includes(data.statut) && data.statut !== "transport") {
        await pool.query(
          "UPDATE interventions SET statut='transport', updated_at=NOW() WHERE id=$1",
          [interventionId],
        );
      }

      res.json({
        success: true,
        data: {
          intervention_id: parseInt(interventionId),
          hospital: {
            id: data.hosp_id,
            name: data.hospital_name,
            lat: toLat,
            lon: toLon,
          },
          route: route.data || [],
          eta: eta.data || null,
          routeType,
        },
      });
    } catch (error) {
      console.error("Get route to hospital error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ── FIXED: Select hospital and route ────────────────────────────────────
  // routeType: "fastest" | "comfort" — affects SOS → hospital segment
  async selectHospitalAndRoute(req, res) {
    try {
      const { interventionId, hospitalId, routeType = "fastest" } = req.body;
      const ambulanceId = req.user.ambulanceId;

      if (!interventionId || !hospitalId)
        return res
          .status(400)
          .json({
            success: false,
            error: "interventionId and hospitalId required",
          });

      if (!["fastest", "comfort"].includes(routeType))
        return res
          .status(400)
          .json({
            success: false,
            error: "routeType must be fastest or comfort",
          });

      const intervention = await pool.query(
        `SELECT i.id, i.statut, i.latitude_depart, i.longitude_depart,
                a.latitude AS ambulance_lat, a.longitude AS ambulance_lon
         FROM interventions i
         JOIN ambulances a ON i.ambulance_id = a.id
         WHERE i.id = $1 AND i.ambulance_id = $2`,
        [interventionId, ambulanceId],
      );
      if (!intervention.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "Intervention not found" });

      const iData = intervention.rows[0];
      const allowed = ["en route", "transport", "arrived", "sur_place"];
      if (!allowed.includes(iData.statut))
        return res
          .status(400)
          .json({
            success: false,
            error: `Status ${iData.statut} not allowed`,
          });

      const hospital = await pool.query(
        "SELECT id, nom, latitude, longitude FROM hopitaux WHERE id=$1",
        [hospitalId],
      );
      if (!hospital.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "Hospital not found" });

      const h = hospital.rows[0];

      // Update intervention
      await pool.query(
        "UPDATE interventions SET hospital_id=$1, statut='transport', updated_at=NOW() WHERE id=$2",
        [hospitalId, interventionId],
      );

      // FIX: Route from SOS location → hospital
      const sosLat = parseFloat(iData.latitude_depart);
      const sosLon = parseFloat(iData.longitude_depart);

      const startVertex = await routingService.findNearestVertex(
        sosLat,
        sosLon,
      );
      const endVertex = await routingService.findNearestVertex(
        parseFloat(h.latitude),
        parseFloat(h.longitude),
      );

      if (!startVertex.success || !endVertex.success) {
        // Return success anyway — client will use OSRM fallback
        return res.json({
          success: true,
          message: `Hospital ${h.nom} selected`,
          data: {
            intervention_id: interventionId,
            hospital: {
              id: h.id,
              name: h.nom,
              lat: h.latitude,
              lon: h.longitude,
            },
            route: [],
            eta: null,
            routeType,
          },
        });
      }

      let route;
      if (routeType === "comfort") {
        route = await routingService.getComfortPath(
          startVertex.vertex_id,
          endVertex.vertex_id,
          false,
        );
      } else {
        route = await routingService.getPathAvoidingEdges(
          startVertex.vertex_id,
          endVertex.vertex_id,
          [],
          false,
        );
      }

      // Fallback if route calculation failed
      if (!route.success || !route.data?.length) {
        route = await routingService.getPathWithGeometry(
          startVertex.vertex_id,
          endVertex.vertex_id,
          false,
        );
      }

      const eta = await routingService.calculateETAAdvanced(
        startVertex.vertex_id,
        endVertex.vertex_id,
        false,
        true,
      );

      const io = req.app.get("io");
      if (io) {
        io.to(`intervention_${interventionId}`).emit("hospital_selected", {
          interventionId,
          hospitalName: h.nom,
          routeType,
          eta: eta.data?.total_minutes,
          message: `Patient being transported to ${h.nom}`,
        });
      }

      res.json({
        success: true,
        message: `Hospital ${h.nom} selected (${routeType})`,
        data: {
          intervention_id: interventionId,
          hospital: {
            id: h.id,
            name: h.nom,
            lat: h.latitude,
            lon: h.longitude,
          },
          route_type: routeType,
          route: route.data || [],
          eta: eta.data || null,
        },
      });
    } catch (error) {
      console.error("Select hospital error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ── Start transport to hospital ─────────────────────────────────────────
  async startTransportToHospital(req, res) {
    try {
      const { interventionId } = req.body;
      const ambulanceId = req.user.ambulanceId;

      await pool.query(
        "UPDATE interventions SET statut='transport', updated_at=NOW() WHERE id=$1 AND ambulance_id=$2",
        [interventionId, ambulanceId],
      );

      const hospital = await pool.query(
        `SELECT h.nom, h.latitude, h.longitude
         FROM interventions i
         JOIN hopitaux h ON i.hospital_id = h.id
         WHERE i.id = $1`,
        [interventionId],
      );

      const io = req.app.get("io");
      if (io && hospital.rows.length) {
        io.to(`intervention_${interventionId}`).emit(
          "transporting_to_hospital",
          {
            interventionId,
            hospitalName: hospital.rows[0].nom,
            message: `Patient being transported to ${hospital.rows[0].nom}`,
          },
        );
      }

      res.json({ success: true, message: "Transport started" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ── FIXED: Report roadblock — immediately active, no approval needed ─────
  reportRoadblock = async (req, res) => {
    try {
      const { edge_id, reason, estimated_duration, tap_lat, tap_lon } =
        req.body;
      const ambulanceId = req.user.ambulanceId;
      const driverId = req.user.userId;

      // Get driver name
      const driver = await import("../models/User.js").then((m) =>
        m.default
          .findById(driverId)
          .select("fullName")
          .catch(() => null),
      );

      const actualEdgeId =
        edge_id && edge_id !== 0 ? parseInt(edge_id, 10) : null;
      const durationMinutes = estimated_duration || 30;

      // FIX: if the client didn't resolve a precise edge (or sends none),
      // resolve it server-side from the tapped coordinates so the stored
      // edge_id always matches a REAL road segment at that exact position.
      // This guarantees the manager map later shows the obstacle exactly
      // where the driver tapped (no more position mismatch).
      let finalEdgeId = actualEdgeId;
      if (!finalEdgeId && tap_lat && tap_lon) {
        const nearest = await routingService.findNearestEdge(
          parseFloat(tap_lat),
          parseFloat(tap_lon),
        );
        if (nearest.success) finalEdgeId = nearest.edge_id;
      }

      if (!finalEdgeId) {
        return res.status(400).json({
          success: false,
          error: "Impossible de localiser le segment de route signalé.",
        });
      }

      // Insert as 'active' immediately (driver-reported = trusted, no manager approval)
      // NOTE: column is "reported_by" (FK -> ambulances.id) on the real deployed schema,
      // NOT "reported_by_ambulance".
      const inserted = await pool
        .query(
          `INSERT INTO blocked_roads
           (edge_id, reason, estimated_duration, status, reported_by,
            reported_by_driver, blocked_at, expires_at)
         VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW() + ($3::text || ' minutes')::interval)
         RETURNING id, edge_id`,
          [
            finalEdgeId,
            reason || "Obstacle",
            durationMinutes,
            ambulanceId,
            driver?.fullName || "Conducteur",
          ],
        )
        .catch(async () => {
          // Fallback for older/minimal schema (no reported_by_driver column yet, etc.)
          return pool.query(
            `INSERT INTO blocked_roads (edge_id, reason, estimated_duration, status, reported_by)
           VALUES ($1, $2, $3, 'active', $4) RETURNING id, edge_id`,
            [finalEdgeId, reason || "Obstacle", durationMinutes, ambulanceId],
          );
        });

      const roadblockId = inserted.rows[0].id;

      // Notify managers via socket
      const io = req.app.get("io");
      if (io) {
        io.to("managers").emit("roadblock_active", {
          roadblockId,
          edge_id: finalEdgeId,
          reason: reason || "Obstacle",
          ambulanceId,
          tap_lat,
          tap_lon,
          timestamp: new Date(),
        });
      }

      // Get current intervention to notify driver of new route
      const intervention = await pool.query(
        `SELECT id, latitude_depart, longitude_depart
         FROM interventions
         WHERE ambulance_id = $1 AND statut IN ('en route', 'transport', 'sur_place')
         LIMIT 1`,
        [ambulanceId],
      );

      if (intervention.rows.length) {
        const newRoute = await recalculateRouteFunc(
          ambulanceId,
          intervention.rows[0].latitude_depart,
          intervention.rows[0].longitude_depart,
        );

        if (io) {
          io.to(`driver_${ambulanceId}`).emit("route_recalculated", {
            interventionId: intervention.rows[0].id,
            new_route: newRoute.data || [],
            message: "Roadblock detected. Route recalculated.",
          });
        }

        return res.json({
          success: true,
          message: "Roadblock reported. Route recalculated.",
          data: { roadblockId, edge_id: finalEdgeId },
          new_route: newRoute.data || [],
        });
      }

      res.json({
        success: true,
        message: "Roadblock reported",
        data: { roadblockId, edge_id: finalEdgeId },
      });
    } catch (error) {
      console.error("Report roadblock error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // ── Clear roadblock (manager) ────────────────────────────────────────────
  clearRoadblock = async (req, res) => {
    try {
      const { edge_id } = req.params;
      const managerName = req.user?.fullName || "Manager";

      const result = await pool
        .query(
          `UPDATE blocked_roads
         SET status = 'cleared', cleared_at = NOW(), cleared_by_name = $2
         WHERE edge_id = $1 AND status = 'active'
         RETURNING id, edge_id`,
          [edge_id, managerName],
        )
        .catch(() =>
          // Fallback if cleared_by_name column doesn't exist yet
          pool.query(
            `UPDATE blocked_roads SET status = 'cleared', cleared_at = NOW()
           WHERE edge_id = $1 AND status = 'active' RETURNING id, edge_id`,
            [edge_id],
          ),
        );

      if (!result.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "Roadblock not found" });

      const io = req.app.get("io");
      if (io) {
        io.to("managers").emit("roadblock_cleared", {
          edge_id,
          timestamp: new Date(),
        });
        io.to("all_drivers").emit("roadblock_cleared", {
          edge_id,
          timestamp: new Date(),
        });
      }

      res.json({ success: true, message: "Roadblock cleared" });
    } catch (error) {
      console.error("Clear roadblock error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // ── Get all roadblocks (manager view) ───────────────────────────────────
  async getRoadblocks(req, res) {
    try {
      const result = await pool.query(
        `SELECT br.id, br.edge_id, br.reason, br.estimated_duration,
                br.status, br.blocked_at, br.expires_at,
                br.reported_by_driver, br.manager_note, br.cleared_by_name,
                a.immatriculation AS reported_by_ambulance
         FROM blocked_roads br
         LEFT JOIN ambulances a ON br.reported_by = a.id
         WHERE br.expires_at > NOW() OR br.status = 'cleared'
         ORDER BY br.blocked_at DESC
         LIMIT 100`,
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      // Table might not exist yet, or text columns not added — degrade gracefully
      try {
        const fallback = await pool.query(
          `SELECT br.id, br.edge_id, br.reason, br.estimated_duration,
                  br.status, br.blocked_at, br.expires_at, br.manager_note,
                  a.immatriculation AS reported_by_ambulance
           FROM blocked_roads br
           LEFT JOIN ambulances a ON br.reported_by = a.id
           WHERE br.expires_at > NOW() OR br.status = 'cleared'
           ORDER BY br.blocked_at DESC
           LIMIT 100`,
        );
        res.json({ success: true, data: fallback.rows });
      } catch {
        res.json({ success: true, data: [] });
      }
    }
  }

  // ── Get edge center coordinates ──────────────────────────────────────────
  async getEdgeCenter(req, res) {
    try {
      const { edgeId } = req.params;
      const result = await pool.query(
        `SELECT ST_Y(ST_Centroid(the_geom)) AS lat,
                ST_X(ST_Centroid(the_geom)) AS lon,
                ST_AsGeoJSON(the_geom) AS geometry
         FROM ways WHERE gid = $1`,
        [edgeId],
      );
      if (!result.rows.length)
        return res
          .status(404)
          .json({ success: false, error: "Edge not found" });

      res.json({
        success: true,
        center: { lat: result.rows[0].lat, lon: result.rows[0].lon },
        geometry: result.rows[0].geometry,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // ── Accept emergency ─────────────────────────────────────────────────────
  async acceptEmergency(req, res) {
    try {
      const { interventionId } = req.params;
      const ambulanceId = req.user.ambulanceId;

      const intervention = await pool.query(
        "SELECT id FROM interventions WHERE id=$1 AND ambulance_id IS NULL",
        [interventionId],
      );
      if (!intervention.rows.length)
        return res
          .status(400)
          .json({ success: false, error: "Intervention already assigned" });

      await pool.query(
        "UPDATE interventions SET ambulance_id=$1, statut='en route', updated_at=NOW() WHERE id=$2",
        [ambulanceId, interventionId],
      );

      const io = req.app.get("io");
      if (io) {
        io.to(`intervention_${interventionId}`).emit("ambulance_assigned", {
          interventionId,
          ambulanceId,
          message: "Une ambulance est en route vers vous",
        });
      }

      res.json({ success: true, message: "Intervention acceptée" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async declineEmergency(req, res) {
    res.json({ success: true, message: "Intervention refusée" });
  }
}

export default new DriverController();
