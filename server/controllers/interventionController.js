// controllers/interventionController.js
import interventionService from "../services/interventionService.js";

class InterventionController {
  // Get all interventions
  async getAllInterventions(req, res) {
    try {
      const result = await interventionService.getAllInterventions();
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

  // Get intervention by ID
  async getInterventionById(req, res) {
    try {
      const { id } = req.params;
      const result = await interventionService.getInterventionById(
        parseInt(id),
      );
      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(404).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create intervention (with auto-assign)
  async createIntervention(req, res) {
    try {
      const io = req.app.get("io"); // ← Récupérer io

      // First create the intervention
      const createResult = await interventionService.createIntervention(
        req.body,
        io,
      );
      if (!createResult.success) {
        return res
          .status(500)
          .json({ success: false, error: createResult.error });
      }

      const intervention = createResult.data;

      // Auto-assign ambulance if coordinates are provided
      if (req.body.latitude_depart && req.body.longitude_depart) {
        // Find nearest available ambulance
        const nearestAmbulance = await interventionService.findNearestAmbulance(
          req.body.latitude_depart,
          req.body.longitude_depart,
        );

        if (nearestAmbulance.success && nearestAmbulance.data) {
          // Auto-assign the nearest ambulance
          const assignResult = await interventionService.assignAmbulance(
            intervention.id,
            nearestAmbulance.data.id,
            req.body.hospital_id || null,
          );

          if (assignResult.success) {
            return res.json({
              success: true,
              data: assignResult.data,
              message: "Intervention created with auto-assigned ambulance",
            });
          }
        }
      }

      res.status(201).json({ success: true, data: intervention });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Update intervention
  async updateIntervention(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      const io = req.app.get("io"); // ← Récupérer io

      const result = await interventionService.updateIntervention(id, data, io);

      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error("Update intervention error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Cancel intervention (free ambulance, mark as cancelled)
  async cancelIntervention(req, res) {
    try {
      const { id } = req.params;
      const io = req.app.get("io"); // ← Récupérer io

      const result = await interventionService.cancelIntervention(
        parseInt(id),
        io,
      );
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete intervention (permanent - only for completed/cancelled)
  async deleteIntervention(req, res) {
    try {
      const { id } = req.params;
      const result = await interventionService.deleteIntervention(parseInt(id));
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Assign ambulance to intervention (manual reassign)
  async assignAmbulance(req, res) {
    try {
      const { interventionId, ambulanceId, hospitalId } = req.body;

      if (!interventionId || !ambulanceId) {
        return res.status(400).json({
          success: false,
          error: "interventionId and ambulanceId are required",
        });
      }

      const result = await interventionService.assignAmbulance(
        interventionId,
        ambulanceId,
        hospitalId || null,
      );

      if (result.success) {
        res.json({ success: true, data: result.data, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Complete intervention
  async completeIntervention(req, res) {
    try {
      const { id } = req.params;
      const io = req.app.get("io"); // ← Récupérer io

      const result = await interventionService.completeIntervention(
        parseInt(id),
        io,
      );
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async confirmIntervention(req, res) {
    try {
      const { id } = req.params;
      const result = await interventionService.confirmIntervention(
        parseInt(id),
      );
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get intervention statistics
  async getStatistics(req, res) {
    try {
      const result = await interventionService.getStatistics();
      if (result.success) {
        res.json({ success: true, data: result.data });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new InterventionController();
