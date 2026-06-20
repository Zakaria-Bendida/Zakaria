import { pool } from "../config/database.js";

class ParkingService {
  async getAllParkings() {
    try {
      const query = `SELECT * FROM parkings ORDER BY id`;
      const result = await pool.query(query);
      return { success: true, data: result.rows };
    } catch (error) {
      console.error("Get parkings error:", error);
      return { success: false, error: error.message };
    }
  }

  async getParkingById(id) {
    try {
      const query = `SELECT * FROM parkings WHERE id = $1`;
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) {
        return { success: false, error: "Parking not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createParking(data) {
    try {
      const { nom, adresse, capacite, latitude, longitude } = data;
      const query = `
        INSERT INTO parkings (nom, adresse, capacite, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await pool.query(query, [
        nom,
        adresse,
        capacite,
        latitude,
        longitude,
      ]);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateParking(id, data) {
    try {
      const { nom, adresse, capacite, latitude, longitude } = data;
      const query = `
        UPDATE parkings 
        SET nom = $1, adresse = $2, capacite = $3, latitude = $4, longitude = $5
        WHERE id = $6
        RETURNING *
      `;
      const result = await pool.query(query, [
        nom,
        adresse,
        capacite,
        latitude,
        longitude,
        id,
      ]);
      if (result.rows.length === 0) {
        return { success: false, error: "Parking not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteParking(id) {
    try {
      const result = await pool.query(
        "DELETE FROM parkings WHERE id = $1 RETURNING id",
        [id],
      );
      if (result.rows.length === 0) {
        return { success: false, error: "Parking not found" };
      }
      return { success: true, message: "Parking deleted successfully" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new ParkingService();
