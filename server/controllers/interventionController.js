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

  // Create intervention
  // FIX: respecte l'ambulance choisie manuellement dans le formulaire (req.body.ambulance_id).
  // L'auto-assign GPS ne se déclenche QUE si aucune ambulance n'a été choisie manuellement.
  // Avant: le code écrasait systématiquement le choix manuel par l'ambulance la plus proche
  // dès que des coordonnées GPS étaient fournies, et ignorait ambulance_id à la création.
  async createIntervention(req, res) {
    try {
      const io = req.app.get("io");

      // First create the intervention (le service insère désormais ambulance_id si fourni,
      // mais SANS notifier personne — la notification se fait uniquement via assignAmbulance
      // pour garantir un seul chemin de code qui gère la notif + le statut de l'ambulance)
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
      const manualAmbulanceId = req.body.ambulance_id || null;

      // CAS 1 — une ambulance a été choisie manuellement dans le formulaire :
      // on l'assigne via assignAmbulance (= statut ambulance + notif socket driver + ETA/distance).
      // On ne touche PAS à findNearestAmbulance ici : le choix du manager est respecté.
      if (manualAmbulanceId) {
        const assignResult = await interventionService.assignAmbulance(
          intervention.id,
          manualAmbulanceId,
          req.body.hospital_id || null,
          true, // skipHospital - inchangé par rapport au comportement existant
          io,
        );

        if (assignResult.success) {
          return res.status(201).json({
            success: true,
            data: assignResult.data,
            message: "Intervention created with manually assigned ambulance",
          });
        }

        // L'ambulance choisie n'a pas pu être assignée (ex: plus disponible) :
        // on renvoie l'intervention créée + l'erreur d'assignation, plutôt que
        // de basculer silencieusement sur l'auto-assign (qui surprendrait le manager
        // en lui montrant une ambulance différente de celle choisie).
        return res.status(201).json({
          success: true,
          data: intervention,
          warning: assignResult.error,
          message:
            "Intervention created but the selected ambulance could not be assigned",
        });
      }

      // CAS 2 — aucune ambulance choisie manuellement : comportement auto-assign existant,
      // uniquement si des coordonnées GPS sont fournies.
      if (req.body.latitude_depart && req.body.longitude_depart) {
        const nearestAmbulance = await interventionService.findNearestAmbulance(
          req.body.latitude_depart,
          req.body.longitude_depart,
        );

        if (nearestAmbulance.success && nearestAmbulance.data) {
          const assignResult = await interventionService.assignAmbulance(
            intervention.id,
            nearestAmbulance.data.id,
            req.body.hospital_id || null,
            true,
            io,
          );

          if (assignResult.success) {
            return res.status(201).json({
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
      const io = req.app.get("io");

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
      const io = req.app.get("io");

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
      const io = req.app.get("io"); // FIX: io n'était jamais récupéré ici,
      // donc cette route ne notifiait jamais le driver ni le dashboard.

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
        true,
        io,
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
      const io = req.app.get("io");

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
