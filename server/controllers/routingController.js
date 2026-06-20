// server/controllers/routingController.js
// FIXED: fastest + comfort path endpoints, nearest-vertex, ETA

import routingService from "../services/routingService.js";

class RoutingController {
  // Fastest path (time-based, avoids active blocked edges)
  async getFastestPath(req, res) {
    const { start, end, directed } = req.query;
    if (!start || !end)
      return res
        .status(400)
        .json({ success: false, error: "start and end required" });

    const result = await routingService.getPathAvoidingEdges(
      parseInt(start),
      parseInt(end),
      [],
      directed === "true",
    );
    if (result.success)
      res.json({ success: true, data: result.data, meta: result.meta });
    else res.status(500).json({ success: false, error: result.error });
  }

  // Comfort path (avoids speed bumps)
  async getComfortPath(req, res) {
    const { start, end, directed } = req.query;
    if (!start || !end)
      return res
        .status(400)
        .json({ success: false, error: "start and end required" });

    const result = await routingService.getComfortPath(
      parseInt(start),
      parseInt(end),
      directed === "true",
    );
    if (result.success)
      res.json({ success: true, data: result.data, meta: result.meta });
    else res.status(500).json({ success: false, error: result.error });
  }

  // Legacy: shortest path (distance)
  async getShortestPath(req, res) {
    const { start, end, directed } = req.query;
    if (!start || !end)
      return res
        .status(400)
        .json({ success: false, error: "start and end required" });

    const result = await routingService.getPathWithGeometry(
      parseInt(start),
      parseInt(end),
      directed === "true",
    );
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(500).json({ success: false, error: result.error });
  }

  // Path with geometry as single merged line
  async getPathWithGeometry(req, res) {
    const { start, end, directed } = req.query;
    const result = await routingService.getPathAsSingleLine(
      parseInt(start),
      parseInt(end),
      directed === "true",
    );
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(500).json({ success: false, error: result.error });
  }

  // Nearest vertex to GPS
  async findNearestVertex(req, res) {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res
        .status(400)
        .json({ success: false, error: "lat and lon required" });

    const result = await routingService.findNearestVertex(
      parseFloat(lat),
      parseFloat(lon),
    );
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(500).json({ success: false, error: result.error });
  }

  // Nearest road segment (edge) to GPS — used for roadblock reporting (real geometry)
  async findNearestEdge(req, res) {
    const { lat, lon } = req.query;
    if (!lat || !lon)
      return res
        .status(400)
        .json({ success: false, error: "lat and lon required" });

    const result = await routingService.findNearestEdge(
      parseFloat(lat),
      parseFloat(lon),
    );
    if (result.success) {
      res.json({
        success: true,
        data: {
          edge_id: result.edge_id,
          road_name: result.road_name,
          coords: result.coords,
        },
      });
    } else {
      res.status(404).json({ success: false, error: result.error });
    }
  }

  // Advanced ETA
  async getETAAdvanced(req, res) {
    const { start, end, directed } = req.query;
    if (!start || !end)
      return res
        .status(400)
        .json({ success: false, error: "start and end required" });

    const result = await routingService.calculateETAAdvanced(
      parseInt(start),
      parseInt(end),
      directed === "true",
    );
    if (result.success) res.json({ success: true, data: result.data });
    else res.status(500).json({ success: false, error: result.error });
  }
}

export default new RoutingController();
