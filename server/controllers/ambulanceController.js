import ambulanceService from "../services/ambulanceService.js"; // ✅ CHANGÉ: enlevé * as
import { pool } from "../config/database.js";

class AmbulanceController {
  // Get all ambulances
  async getAllAmbulances(req, res) {
    const result = await ambulanceService.getAllAmbulances();
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  // Get ambulance by ID
  async getAmbulanceById(req, res) {
    const { id } = req.params;
    const result = await ambulanceService.getAmbulanceById(parseInt(id));
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  }

  // Update ambulance location
  async updateLocation(req, res) {
    const { id } = req.params;
    const { lat, lon, kilometrage } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error: "Latitude and longitude are required",
      });
    }

    const result = await ambulanceService.updateLocation(
      parseInt(id),
      lat,
      lon,
      kilometrage,
    );
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: "Location updated successfully",
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  // Update ambulance status
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      console.log("Update status called:", { id, status });

      if (!status) {
        return res.status(400).json({
          success: false,
          error: "Status is required",
        });
      }

      const result = await ambulanceService.updateStatus(parseInt(id), status);

      console.log("Service result:", result);

      if (result.success) {
        return res.json({
          success: true,
          data: result.data,
          message: "Status updated successfully",
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Update status error:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Get ambulances by status
  async getAmbulancesByStatus(req, res) {
    const { status } = req.params;
    const result = await ambulanceService.getAmbulancesByStatus(status);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  // Get ambulance statistics
  async getStatistics(req, res) {
    try {
      const statusQuery = `
        SELECT statut, COUNT(*) as count
        FROM ambulances
        GROUP BY statut
      `;
      const statusResult = await pool.query(statusQuery);

      const kmQuery = `
        SELECT SUM(kilometrage) as total_kilometers
        FROM ambulances
      `;
      const kmResult = await pool.query(kmQuery);

      res.json({
        success: true,
        data: {
          by_status: statusResult.rows,
          total_kilometers: kmResult.rows[0]?.total_kilometers || 0,
          total_ambulances: statusResult.rows.reduce(
            (sum, row) => sum + parseInt(row.count),
            0,
          ),
        },
      });
    } catch (error) {
      console.error("Get statistics error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create ambulance (Manager only)
  async createAmbulance(req, res) {
    const result = await ambulanceService.createAmbulance(req.body);
    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.data,
        message: "Ambulance created successfully",
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  // Update ambulance (Manager only)
  async updateAmbulance(req, res) {
    const { id } = req.params;
    const result = await ambulanceService.updateAmbulance(
      parseInt(id),
      req.body,
    );
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: "Ambulance updated successfully",
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  // Delete ambulance (Manager only)
  async deleteAmbulance(req, res) {
    const { id } = req.params;
    const result = await ambulanceService.deleteAmbulance(parseInt(id));
    if (result.success) {
      res.json({ success: true, message: "Ambulance deleted successfully" });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }
}

export default new AmbulanceController();
