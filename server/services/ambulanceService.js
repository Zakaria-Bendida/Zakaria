import { pool } from "../config/database.js";
import routingService from "./routingService.js";

class AmbulanceService {
  // Helper: Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in kilometers
  }

  // Get all ambulances
  async getAllAmbulances() {
    try {
      const query = `
        SELECT 
          a.id, a.immatriculation, a.type, a.statut, 
          a.date_mise_service, a.kilometrage, 
          a.latitude, a.longitude, a.parking_id,
          p.nom as parking_name, p.latitude as parking_lat, p.longitude as parking_lon
        FROM ambulances a
        LEFT JOIN parkings p ON a.parking_id = p.id
        ORDER BY a.id
      `;
      const result = await pool.query(query);
      return { success: true, count: result.rows.length, data: result.rows };
    } catch (error) {
      console.error("Get ambulances error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get ambulance by ID with parking info
  async getAmbulanceById(id) {
    try {
      const query = `
        SELECT 
          a.id, a.immatriculation, a.type, a.statut, 
          a.date_mise_service, a.kilometrage, 
          a.latitude, a.longitude, a.parking_id,
          p.nom as parking_name, p.latitude as parking_lat, p.longitude as parking_lon
        FROM ambulances a
        LEFT JOIN parkings p ON a.parking_id = p.id
        WHERE a.id = $1
      `;
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) {
        return { success: false, error: "Ambulance not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error("Get ambulance error:", error);
      return { success: false, error: error.message };
    }
  }

  // Update ambulance location
  async updateLocation(ambulanceId, lat, lon, kilometrage = null) {
    try {
      const updates = ["latitude = $1", "longitude = $2", "updated_at = NOW()"];
      const values = [lat, lon];
      let paramCounter = 3;

      if (kilometrage !== null) {
        updates.push(`kilometrage = $${paramCounter++}`);
        values.push(kilometrage);
      }

      values.push(ambulanceId);
      const query = `
        UPDATE ambulances 
        SET ${updates.join(", ")} 
        WHERE id = $${paramCounter}
        RETURNING id, immatriculation, statut, latitude, longitude
      `;

      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        return { success: false, error: "Ambulance not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error("Update location error:", error);
      return { success: false, error: error.message };
    }
  }

  // Update ambulance status
  async updateStatus(ambulanceId, status) {
    try {
      const query = `
        UPDATE ambulances 
        SET statut = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, immatriculation, statut
      `;
      const result = await pool.query(query, [status, ambulanceId]);
      if (result.rows.length === 0) {
        return { success: false, error: "Ambulance not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      console.error("Update status error:", error);
      return { success: false, error: error.message };
    }
  }

  // Get ambulances by status
  async getAmbulancesByStatus(status) {
    try {
      const query = `
        SELECT 
          a.id, a.immatriculation, a.type, a.statut, 
          a.latitude, a.longitude, a.kilometrage,
          p.nom as parking_name
        FROM ambulances a
        LEFT JOIN parkings p ON a.parking_id = p.id
        WHERE a.statut = $1
        ORDER BY a.id
      `;
      const result = await pool.query(query, [status]);
      return { success: true, data: result.rows };
    } catch (error) {
      console.error("Get ambulances by status error:", error);
      return { success: false, error: error.message };
    }
  }

  // Create ambulance
  // Create ambulance
  async createAmbulance(data) {
    try {
      const {
        immatriculation,
        type,
        date_mise_service,
        kilometrage,
        parking_id,
        latitude, // ✅ ADD THIS
        longitude, // ✅ ADD THIS
      } = data;

      // Get parking coordinates if latitude/longitude not provided
      let finalLat = latitude;
      let finalLng = longitude;

      if ((!finalLat || !finalLng) && parking_id) {
        const parkingResult = await pool.query(
          "SELECT latitude, longitude FROM parkings WHERE id = $1",
          [parking_id],
        );
        if (parkingResult.rows.length > 0) {
          finalLat = parkingResult.rows[0].latitude;
          finalLng = parkingResult.rows[0].longitude;
          console.log(
            `📍 Auto-filled coordinates from parking: ${finalLat}, ${finalLng}`,
          );
        }
      }

      const query = `
      INSERT INTO ambulances (
        immatriculation, type, date_mise_service, kilometrage, 
        parking_id, statut, latitude, longitude, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'Disponible', $6, $7, NOW(), NOW())
      RETURNING *
    `;

      const result = await pool.query(query, [
        immatriculation,
        type,
        date_mise_service || null,
        kilometrage || 0,
        parking_id || null,
        finalLat || null, // ✅ ADD THIS
        finalLng || null, // ✅ ADD THIS
      ]);

      return {
        success: true,
        data: result.rows[0],
        message: "Ambulance created successfully",
      };
    } catch (error) {
      console.error("Create ambulance error:", error);
      return { success: false, error: error.message };
    }
  }

  async updateAmbulance(id, data) {
    try {
      const {
        immatriculation,
        type,
        kilometrage,
        parking_id,
        statut,
        latitude,
        longitude,
      } = data;

      const updates = [];
      const values = [];
      let paramCounter = 1;

      if (immatriculation) {
        updates.push(`immatriculation = $${paramCounter++}`);
        values.push(immatriculation);
      }
      if (type) {
        updates.push(`type = $${paramCounter++}`);
        values.push(type);
      }
      if (kilometrage !== undefined) {
        updates.push(`kilometrage = $${paramCounter++}`);
        values.push(kilometrage);
      }
      if (parking_id !== undefined) {
        updates.push(`parking_id = $${paramCounter++}`);
        values.push(parking_id);
      }
      if (statut) {
        updates.push(`statut = $${paramCounter++}`);
        values.push(statut);
      }
      if (latitude !== undefined) {
        updates.push(`latitude = $${paramCounter++}`);
        values.push(latitude);
      }
      if (longitude !== undefined) {
        updates.push(`longitude = $${paramCounter++}`);
        values.push(longitude);
      }

      if (updates.length === 0) {
        return { success: false, error: "No fields to update" };
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
      UPDATE ambulances 
      SET ${updates.join(", ")} 
      WHERE id = $${paramCounter}
      RETURNING *
    `;
      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        return { success: false, error: "Ambulance not found" };
      }
      return {
        success: true,
        data: result.rows[0],
        message: "Ambulance updated successfully",
      };
    } catch (error) {
      console.error("Update ambulance error:", error);
      return { success: false, error: error.message };
    }
  }

  // Delete ambulance
  async deleteAmbulance(id) {
    try {
      const result = await pool.query(
        "DELETE FROM ambulances WHERE id = $1 RETURNING id",
        [id],
      );
      if (result.rows.length === 0) {
        return { success: false, error: "Ambulance not found" };
      }
      return { success: true, message: "Ambulance deleted successfully" };
    } catch (error) {
      console.error("Delete ambulance error:", error);
      return { success: false, error: error.message };
    }
  }

  // Find nearest ambulance (straight line) - USING PARKING POSITION
  async findNearestAmbulance(lat, lon) {
    try {
      console.log("📍 findNearestAmbulance called with:", { lat, lon });

      const ambulancesQuery = `
        SELECT 
          a.id, a.immatriculation, a.type, a.statut, 
          a.latitude, a.longitude, a.parking_id,
          p.latitude as parking_lat, p.longitude as parking_lon, p.nom as parking_name
        FROM ambulances a
        LEFT JOIN parkings p ON a.parking_id = p.id
        WHERE a.statut = 'Disponible'
      `;
      const ambulances = await pool.query(ambulancesQuery);

      if (ambulances.rows.length === 0) {
        return { success: false, error: "No available ambulances" };
      }

      console.log(`🚑 Found ${ambulances.rows.length} available ambulances`);

      const distances = [];
      for (const amb of ambulances.rows) {
        // PRIORITY: Use parking coordinates as starting point
        // If no parking, fallback to ambulance current position
        const startLat = amb.parking_lat || amb.latitude;
        const startLon = amb.parking_lon || amb.longitude;

        if (!startLat || !startLon) {
          console.log(
            `⚠️ Ambulance ${amb.id} has no coordinates (no parking, no position), skipping`,
          );
          continue;
        }

        const distance = this.calculateDistance(
          lat,
          lon,
          parseFloat(startLat),
          parseFloat(startLon),
        );

        distances.push({
          ambulance_id: amb.id,
          immatriculation: amb.immatriculation,
          parking_id: amb.parking_id,
          parking_name: amb.parking_name,
          parking_latitude: startLat,
          parking_longitude: startLon,
          distance_km: parseFloat(distance.toFixed(2)),
          estimated_time_min: parseFloat(((distance / 40) * 60).toFixed(1)),
        });
      }

      if (distances.length === 0) {
        return {
          success: false,
          error: "No available ambulances with valid coordinates",
        };
      }

      distances.sort((a, b) => a.distance_km - b.distance_km);
      console.log(
        `✅ Nearest ambulance: ${distances[0]?.immatriculation} at ${distances[0]?.distance_km} km (parking: ${distances[0]?.parking_name || "N/A"})`,
      );

      return { success: true, data: distances };
    } catch (error) {
      console.error("Find nearest ambulance error:", error);
      return { success: false, error: error.message };
    }
  }
}

const ambulanceService = new AmbulanceService();
export default ambulanceService;
