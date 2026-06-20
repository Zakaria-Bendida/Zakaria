import parkingService from "../services/parkingService.js";

class ParkingController {
  async getAllParkings(req, res) {
    const result = await parkingService.getAllParkings();
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  async getParkingById(req, res) {
    const { id } = req.params;
    const result = await parkingService.getParkingById(parseInt(id));
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  }

  async createParking(req, res) {
    const result = await parkingService.createParking(req.body);
    if (result.success) {
      res.status(201).json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  async updateParking(req, res) {
    const { id } = req.params;
    const result = await parkingService.updateParking(parseInt(id), req.body);
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }

  async deleteParking(req, res) {
    const { id } = req.params;
    const result = await parkingService.deleteParking(parseInt(id));
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  }
}

export default new ParkingController();
