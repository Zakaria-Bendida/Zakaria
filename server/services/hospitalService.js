// server/services/hospitalService.js
import { pool } from "../config/database.js";

class HospitalService {
  async getAllHospitals() {
    try {
      const query = `
        SELECT id, nom, adresse, telephone, email, latitude, longitude, 
               created_at, updated_at
        FROM hopitaux 
        ORDER BY nom
      `;
      const result = await pool.query(query);
      return { success: true, data: result.rows };
    } catch (error) {
      console.error("Get hospitals error:", error);
      return { success: false, error: error.message };
    }
  }

  async getHospitalById(id) {
    try {
      const query = `
        SELECT id, nom, adresse, telephone, email, latitude, longitude
        FROM hopitaux 
        WHERE id = $1
      `;
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) {
        return { success: false, error: "Hospital not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createHospital(data) {
    try {
      const { nom, adresse, telephone, email, latitude, longitude } = data;
      const query = `
        INSERT INTO hopitaux (nom, adresse, telephone, email, latitude, longitude, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `;
      const result = await pool.query(query, [
        nom,
        adresse,
        telephone,
        email,
        latitude,
        longitude,
      ]);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateHospital(id, data) {
    try {
      const { nom, adresse, telephone, email, latitude, longitude } = data;
      const query = `
        UPDATE hopitaux 
        SET nom = $1, adresse = $2, telephone = $3, email = $4, 
            latitude = $5, longitude = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;
      const result = await pool.query(query, [
        nom,
        adresse,
        telephone,
        email,
        latitude,
        longitude,
        id,
      ]);
      if (result.rows.length === 0) {
        return { success: false, error: "Hospital not found" };
      }
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteHospital(id) {
    try {
      const result = await pool.query(
        "DELETE FROM hopitaux WHERE id = $1 RETURNING id",
        [id],
      );
      if (result.rows.length === 0) {
        return { success: false, error: "Hospital not found" };
      }
      return { success: true, message: "Hospital deleted successfully" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const hospitalService = new HospitalService();
export default hospitalService;
