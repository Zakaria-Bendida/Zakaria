import React, { useState, useEffect } from "react";
import { io as socketIO } from "socket.io-client";
import { useData } from "../../context/DataContext";
import {
  Ambulance,
  Edit,
  Trash2,
  Plus,
  Download,
  MapPin,
  RefreshCw,
} from "lucide-react";
import type { Ambulance as AmbulanceType } from "../../context/DataContext";
import AmbulanceForm from "../forms/AmbulanceForm";
import AmbulanceDetailsModal from "../modules/AmbulanceDetailsModal";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

const AmbulancesModule: React.FC = () => {
  const {
    ambulances,
    addAmbulance,
    updateAmbulance,
    deleteAmbulance,
    parkings,
    refreshData,
  } = useData();

  const [showForm, setShowForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAmbulanceForDetails, setSelectedAmbulanceForDetails] =
    useState<any>(null);
  const [editingAmbulance, setEditingAmbulance] =
    useState<AmbulanceType | null>(null);
  const [filters, setFilters] = useState({ statut: "", type: "" });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ✅ Socket.io — real-time refresh for ALL ambulance events
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = socketIO(SOCKET_URL, { auth: { token } });

    socket.on("connect", () => {
      console.log("📡 Ambulances module connected to socket");
    });

    const handleRefresh = async (data: any) => {
      console.log("🔄 Ambulance socket event received:", data);
      await refreshData();
      setLastRefresh(new Date());
    };

    // ✅ ALL events that affect ambulance status
    socket.on("ambulance_status_updated", handleRefresh);
    socket.on("ambulance_updated", handleRefresh);
    socket.on("driver:status", handleRefresh);
    socket.on("intervention_updated", handleRefresh);
    socket.on("intervention_completed", handleRefresh);
    socket.on("intervention_cancelled", handleRefresh);
    socket.on("intervention_created", handleRefresh);
    socket.on("intervention_assigned", handleRefresh);
    socket.on("ambulance_assigned", handleRefresh);
    socket.on("driver:online", handleRefresh);
    socket.on("driver:offline", handleRefresh);
    socket.on("mission:started", handleRefresh);
    socket.on("mission:completed", handleRefresh);

    return () => {
      socket.off("ambulance_status_updated", handleRefresh);
      socket.off("ambulance_updated", handleRefresh);
      socket.off("driver:status", handleRefresh);
      socket.off("intervention_updated", handleRefresh);
      socket.off("intervention_completed", handleRefresh);
      socket.off("intervention_cancelled", handleRefresh);
      socket.off("intervention_created", handleRefresh);
      socket.off("intervention_assigned", handleRefresh);
      socket.off("ambulance_assigned", handleRefresh);
      socket.off("driver:online", handleRefresh);
      socket.off("driver:offline", handleRefresh);
      socket.off("mission:started", handleRefresh);
      socket.off("mission:completed", handleRefresh);
      socket.disconnect();
    };
  }, [refreshData]);

  // ✅ Fallback polling every 10s for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
      setLastRefresh(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Lock body scroll when form open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showForm]);

  const filteredAmbulances = ambulances.filter(
    (ambulance) =>
      (!filters.statut || ambulance.statut === filters.statut) &&
      (!filters.type || ambulance.type === filters.type),
  );

  const handleSave = async (ambulance: Partial<AmbulanceType>) => {
    try {
      if (editingAmbulance) {
        await updateAmbulance(editingAmbulance.id, ambulance);
        alert("Ambulance modifiée avec succès");
      } else {
        await addAmbulance(ambulance);
        alert("Ambulance ajoutée avec succès");
      }
      setShowForm(false);
      setEditingAmbulance(null);
      await refreshData();
    } catch (error: any) {
      alert("Erreur lors de la sauvegarde : " + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      window.confirm("Êtes-vous sûr de vouloir supprimer cette ambulance ?")
    ) {
      try {
        await deleteAmbulance(id);
        alert("Ambulance supprimée avec succès");
        await refreshData();
      } catch (error: any) {
        alert("Erreur lors de la suppression : " + error.message);
      }
    }
  };

  const handleUpdateStatus = async (
    ambulance: AmbulanceType,
    newStatus: string,
  ) => {
    try {
      await updateAmbulance(ambulance.id, { ...ambulance, statut: newStatus });
      await refreshData();
    } catch (error: any) {
      alert("Erreur lors de la mise à jour: " + error.message);
    }
  };

  const handleManualRefresh = async () => {
    await refreshData();
    setLastRefresh(new Date());
    alert("Données actualisées");
  };

  const exportCSV = () => {
    const headers = [
      "ID",
      "Immatriculation",
      "Type",
      "Statut",
      "Kilométrage",
      "Parking",
      "Latitude",
      "Longitude",
    ];
    const csv = [
      headers.join(","),
      ...filteredAmbulances.map((a) =>
        [
          a.id,
          a.immatriculation,
          a.type,
          a.statut,
          a.kilometrage || 0,
          parkings.find((p) => p.id === a.parking_id)?.nom || "Non assigné",
          a.latitude || "",
          a.longitude || "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ambulances_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getStatusClass = (statut: string) => {
    switch (statut) {
      case "Disponible":
        return "status-available";
      case "En mission":
        return "status-mission";
      case "Maintenance":
        return "status-maintenance";
      case "En panne":
        return "status-broken";
      default:
        return "";
    }
  };

  const getStatusIcon = (statut: string) => {
    switch (statut) {
      case "Disponible":
        return "🟢";
      case "En mission":
        return "🟠";
      case "Maintenance":
        return "🟡";
      case "En panne":
        return "🔴";
      default:
        return "⚪";
    }
  };

  const getParkingName = (parkingId?: number) => {
    if (!parkingId) return "Non assigné";
    return parkings.find((p) => p.id === parkingId)?.nom || "Non assigné";
  };

  const stats = {
    total: ambulances.length,
    disponibles: ambulances.filter((a) => a.statut === "Disponible").length,
    enMission: ambulances.filter((a) => a.statut === "En mission").length,
    horsService: ambulances.filter(
      (a) => a.statut === "Maintenance" || a.statut === "En panne",
    ).length,
  };

  return (
    <div className="ambulances-module">
      <div className="module-header">
        <h2 className="module-title">
          <Ambulance size={24} />
          Gestion des Ambulances
        </h2>
        <div className="module-actions">
          <button
            className="btn-refresh"
            onClick={handleManualRefresh}
            title="Actualiser"
          >
            <RefreshCw size={16} />
            {lastRefresh.toLocaleTimeString()}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Ajouter
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">TOTAL</div>
        </div>
        <div className="stat-card stat-available">
          <div className="stat-value">{stats.disponibles}</div>
          <div className="stat-label">DISPONIBLES</div>
        </div>
        <div className="stat-card stat-mission">
          <div className="stat-value">{stats.enMission}</div>
          <div className="stat-label">EN MISSION</div>
        </div>
        <div className="stat-card stat-broken">
          <div className="stat-value">{stats.horsService}</div>
          <div className="stat-label">HORS SERVICE</div>
        </div>
      </div>

      <div className="filters-bar">
        <select
          value={filters.statut}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, statut: e.target.value }))
          }
          className="filter-select"
        >
          <option value="">Tous les statuts</option>
          <option value="Disponible">Disponible</option>
          <option value="En mission">En mission</option>
          <option value="Maintenance">Maintenance</option>
          <option value="En panne">En panne</option>
        </select>
        <select
          value={filters.type}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, type: e.target.value }))
          }
          className="filter-select"
        >
          <option value="">Tous les types</option>
          <option value="Type A">Type A</option>
          <option value="Type B">Type B</option>
          <option value="Type C">Type C</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Immatriculation</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Kilométrage</th>
              <th>Parking</th>
              <th>Position</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAmbulances.map((ambulance) => (
              <tr key={ambulance.id}>
                <td className="cell-bold">{ambulance.immatriculation}</td>
                <td>{ambulance.type}</td>
                <td>
                  <select
                    value={ambulance.statut}
                    onChange={(e) =>
                      handleUpdateStatus(ambulance, e.target.value)
                    }
                    className={`status-select ${getStatusClass(ambulance.statut)}`}
                  >
                    <option value="Disponible">🟢 Disponible</option>
                    <option value="En mission">🟠 En mission</option>
                    <option value="Maintenance">🟡 Maintenance</option>
                    <option value="En panne">🔴 En panne</option>
                  </select>
                </td>
                <td>{ambulance.kilometrage?.toLocaleString()} km</td>
                <td>{getParkingName(ambulance.parking_id)}</td>
                <td>
                  {ambulance.latitude && ambulance.longitude ? (
                    <button
                      onClick={() => {
                        setSelectedAmbulanceForDetails(ambulance);
                        setShowDetailsModal(true);
                      }}
                      className="btn-map"
                    >
                      <MapPin size={14} />
                      Voir carte
                    </button>
                  ) : (
                    <span className="text-muted">Non localisé</span>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-edit"
                      onClick={() => {
                        setEditingAmbulance(ambulance);
                        setShowForm(true);
                      }}
                      title="Modifier"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(ambulance.id)}
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAmbulances.length === 0 && (
          <div className="empty-state">
            <Ambulance size={48} />
            <p>Aucune ambulance trouvée</p>
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setEditingAmbulance(null);
            }
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {editingAmbulance
                  ? "Modifier l'ambulance"
                  : "Ajouter une ambulance"}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowForm(false);
                  setEditingAmbulance(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <AmbulanceForm
                ambulance={editingAmbulance}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingAmbulance(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedAmbulanceForDetails && (
        <AmbulanceDetailsModal
          ambulance={selectedAmbulanceForDetails}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAmbulanceForDetails(null);
          }}
        />
      )}

      <style>{`
        .ambulances-module { padding: 20px; background: #f5f7fa; min-height: 100vh; }
        
        /* Header */
        .module-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .module-title { display: flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 600; color: #1e293b; margin: 0; }
        .module-actions { display: flex; gap: 12px; align-items: center; }
        
        /* Buttons */
        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); }
        .btn-secondary { background: white; color: #475569; border: 1px solid #e2e8f0; }
        .btn-secondary:hover { background: #f8fafc; }
        .btn-refresh { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
        .btn-refresh:hover { background: #e2e8f0; }
        .btn-map { background: #10b981; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .btn-map:hover { background: #059669; }
        
        /* Stats */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-value { font-size: 32px; font-weight: 700; color: #1e293b; }
        .stat-label { font-size: 14px; color: #64748b; margin-top: 4px; }
        .stat-available .stat-value { color: #10b981; }
        .stat-mission .stat-value { color: #f59e0b; }
        .stat-broken .stat-value { color: #ef4444; }
        
        /* Filters */
        .filters-bar { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .filter-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; font-size: 14px; min-width: 180px; }
        
        /* Table */
        .table-container { background: white; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th { text-align: left; padding: 14px 16px; background: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        .data-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 14px; }
        .data-table tr:hover { background: #f8fafc; }
        .cell-bold { font-weight: 600; color: #1e293b; }
        
        /* Status Select */
        .status-select { padding: 5px 10px; border-radius: 6px; font-size: 13px; font-weight: 500; border: 1px solid #e2e8f0; cursor: pointer; font-family: monospace; }
        .status-available { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
        .status-mission { background: #fed7aa; color: #9a3412; border-color: #fed7aa; }
        .status-maintenance { background: #fef9c3; color: #854d0e; border-color: #fef9c3; }
        .status-broken { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        
        /* Actions */
        .action-buttons { display: flex; gap: 8px; }
        .btn-edit, .btn-delete { padding: 6px; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .btn-edit { background: #e0e7ff; color: #4338ca; }
        .btn-edit:hover { background: #c7d2fe; transform: scale(1.05); }
        .btn-delete { background: #fee2e2; color: #dc2626; }
        .btn-delete:hover { background: #fecaca; transform: scale(1.05); }
        
        /* Empty State */
        .text-muted { color: #94a3b8; font-size: 13px; }
        .empty-state { text-align: center; padding: 60px; color: #94a3b8; }
        .empty-state p { margin-top: 12px; }
        
        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 16px; width: 90%; max-width: 600px; max-height: 90vh; overflow: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
        .modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8; padding: 0 8px; }
        .modal-close:hover { color: #475569; }
        .modal-body { padding: 20px; }
        
        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .module-header { flex-direction: column; align-items: stretch; }
          .module-actions { justify-content: flex-start; flex-wrap: wrap; }
          .filters-bar { flex-direction: column; }
          .filter-select { width: 100%; }
          .data-table th, .data-table td { padding: 8px 12px; }
        }
      `}</style>
    </div>
  );
};

export default AmbulancesModule;
