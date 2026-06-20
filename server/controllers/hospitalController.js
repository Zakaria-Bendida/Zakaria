// server/controllers/hospitalController.js
import hospitalService from "../services/hospitalService.js";

class HospitalController {
  async getAllHospitals(req, res) {
    try {
      const result = await hospitalService.getAllHospitals();
      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Controller error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getHospitalById(req, res) {
    try {
      const { id } = req.params;
      const result = await hospitalService.getHospitalById(parseInt(id));
      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(404).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createHospital(req, res) {
    try {
      const result = await hospitalService.createHospital(req.body);
      if (result.success) {
        res.status(201).json({ success: true, data: result.data });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateHospital(req, res) {
    try {
      const { id } = req.params;
      const result = await hospitalService.updateHospital(
        parseInt(id),
        req.body,
      );
      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteHospital(req, res) {
    try {
      const { id } = req.params;
      const result = await hospitalService.deleteHospital(parseInt(id));
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new HospitalController();
