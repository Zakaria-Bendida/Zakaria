import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import {
  MapPin,
  Edit,
  Trash2,
  Plus,
  Download,
  Car,
  AlertCircle,
  CheckCircle,
  Map,
} from "lucide-react";
import type { Parking } from "../../context/DataContext";
import ParkingForm from "../forms/ParkingForm";
import ParkingsMapModule from "../modules/ParkingsMapModule";

const ParkingsModule: React.FC = () => {
  const {
    parkings,
    ambulances,
    addParking,
    updateParking,
    deleteParking,
    refreshData,
  } = useData();
  const [showForm, setShowForm] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedParkingForMap, setSelectedParkingForMap] =
    useState<Parking | null>(null);
  const [editingParking, setEditingParking] = useState<Parking | null>(null);
  const [filters, setFilters] = useState({ search: "" });

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showForm]);

  const getParkingOccupation = (parkingId: number) => {
    return ambulances.filter(
      (a) => a.parking_id === parkingId || a.parkingId === parkingId,
    ).length;
  };

  const getParkingOccupationRate = (parking: Parking) => {
    if (!parking.capacite || parking.capacite === 0) return 0;
    const occupation = getParkingOccupation(parking.id);
    return Math.round((occupation / parking.capacite) * 100);
  };

  const getOccupationInfo = (rate: number) => {
    if (rate >= 80)
      return {
        color: "red",
        status: "Presque plein",
        icon: <AlertCircle size={12} />,
      };
    if (rate >= 50)
      return {
        color: "orange",
        status: "Occupation modérée",
        icon: <AlertCircle size={12} />,
      };
    return {
      color: "green",
      status: "Disponible",
      icon: <CheckCircle size={12} />,
    };
  };

  const filteredParkings = parkings.filter((parking) => {
    const matchSearch =
      !filters.search ||
      parking.nom.toLowerCase().includes(filters.search.toLowerCase()) ||
      parking.adresse.toLowerCase().includes(filters.search.toLowerCase());
    return matchSearch;
  });

  const stats = {
    total: parkings.length,
    totalPlaces: parkings.reduce((acc, p) => acc + (p.capacite || 0), 0),
    occupiedPlaces: parkings.reduce(
      (acc, p) => acc + getParkingOccupation(p.id),
      0,
    ),
    freePlaces:
      parkings.reduce((acc, p) => acc + (p.capacite || 0), 0) -
      parkings.reduce((acc, p) => acc + getParkingOccupation(p.id), 0),
  };

  const handleSave = async (parking: Partial<Parking>) => {
    try {
      if (editingParking) {
        await updateParking(editingParking.id, parking);
        alert("Parking modifié avec succès");
      } else {
        await addParking(parking as Omit<Parking, "id">);
        alert("Parking ajouté avec succès");
      }
      setShowForm(false);
      setEditingParking(null);
      refreshData();
    } catch (error: any) {
      alert("Erreur lors de la sauvegarde : " + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    const parkingAmbulances = ambulances.filter(
      (a) => a.parking_id === id || a.parkingId === id,
    );
    if (parkingAmbulances.length > 0) {
      if (
        !window.confirm(
          `Ce parking contient ${parkingAmbulances.length} ambulance(s). Les ambulances seront déassignées. Continuer ?`,
        )
      ) {
        return;
      }
    }

    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce parking ?")) {
      try {
        await deleteParking(id);
        alert("Parking supprimé avec succès");
        refreshData();
      } catch (error: any) {
        alert("Erreur lors de la suppression : " + error.message);
      }
    }
  };

  const handleViewOnMap = (parking: Parking) => {
    if (!parking.latitude || !parking.longitude) {
      alert(
        "Ce parking n'a pas de coordonnées GPS. Veuillez d'abord les configurer.",
      );
      return;
    }
    setSelectedParkingForMap(parking);
    setShowMap(true);
  };

  const exportCSV = () => {
    const headers = [
      "ID",
      "Nom",
      "Adresse",
      "Capacité",
      "Occupation",
      "Taux d'occupation",
      "Latitude",
      "Longitude",
    ];
    const csv = [
      headers.join(","),
      ...filteredParkings.map((p) => {
        const occupation = getParkingOccupation(p.id);
        const rate = getParkingOccupationRate(p);
        return [
          p.id,
          `"${p.nom}"`,
          `"${p.adresse}"`,
          p.capacite || 0,
          occupation,
          `${rate}%`,
          p.latitude || "",
          p.longitude || "",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "parkings.csv";
    a.click();
  };

  return (
    <div className="parkings-module">
      <div className="module-header">
        <h2 className="module-title">
          <MapPin size={24} />
          Gestion des Parkings
        </h2>
        <div className="module-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingParking(null);
              setShowForm(true);
            }}
          >
            <Plus size={16} />
            Ajouter
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">TOTAL PARKINGS</div>
        </div>
        <div className="stat-card stat-total-places">
          <div className="stat-value">{stats.totalPlaces}</div>
          <div className="stat-label">PLACES TOTALES</div>
        </div>
        <div className="stat-card stat-occupied">
          <div className="stat-value">{stats.occupiedPlaces}</div>
          <div className="stat-label">PLACES OCCUPÉES</div>
        </div>
        <div className="stat-card stat-free">
          <div className="stat-value">{stats.freePlaces}</div>
          <div className="stat-label">PLACES LIBRES</div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Rechercher un parking par nom ou adresse..."
          value={filters.search}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
          className="filter-input"
        />
      </div>

      {/* Parkings Cards */}
      <div className="cards-grid">
        {filteredParkings.map((parking) => {
          const occupation = getParkingOccupation(parking.id);
          const occupationRate = getParkingOccupationRate(parking);
          const { color, status, icon } = getOccupationInfo(occupationRate);

          return (
            <div className="parking-card" key={parking.id}>
              <div className="card-header">
                <div className="card-title">
                  <MapPin size={18} />
                  <span>{parking.nom}</span>
                </div>
                <div className="card-actions-header">
                  <button
                    className="btn-icon btn-edit"
                    onClick={() => {
                      setEditingParking(parking);
                      setShowForm(true);
                    }}
                    title="Modifier"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    onClick={() => handleDelete(parking.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="card-address">
                <MapPin size={12} />
                <span>{parking.adresse}</span>
              </div>

              <div className="occupation-stats">
                <div className="occupation-number">
                  <span className="occupation-count">{occupation}</span>
                  <span className="occupation-total">/{parking.capacite}</span>
                  <span className="occupation-label">places occupées</span>
                </div>
                <div className={`occupation-percent ${color}`}>
                  {occupationRate}%
                </div>
              </div>

              <div className="progress-bar">
                <div
                  className={`progress-fill ${color}`}
                  style={{ width: `${occupationRate}%` }}
                />
              </div>

              <div className={`status-badge status-${color}`}>
                {icon}
                {status}
              </div>

              {occupation > 0 && (
                <div className="ambulances-list">
                  <strong>Ambulances stationnées :</strong>
                  <div className="ambulance-badges">
                    {ambulances
                      .filter(
                        (a) =>
                          a.parking_id === parking.id ||
                          a.parkingId === parking.id,
                      )
                      .slice(0, 3)
                      .map((ambulance) => (
                        <span key={ambulance.id} className="ambulance-badge">
                          <Car size={10} />
                          {ambulance.immatriculation}
                        </span>
                      ))}
                    {occupation > 3 && (
                      <span className="more-badge">
                        +{occupation - 3} autres
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Map button - small, on the right like hospital page */}
              <div className="card-footer">
                <div className="card-footer-left">
                  {parking.latitude && parking.longitude ? (
                    <span className="coordinates-display">
                      📍 {parking.latitude.toFixed(4)},{" "}
                      {parking.longitude.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-muted">📍 Non géolocalisé</span>
                  )}
                </div>
                <div className="card-footer-right">
                  {parking.latitude && parking.longitude && (
                    <button
                      className="btn-map"
                      onClick={() => handleViewOnMap(parking)}
                    >
                      <Map size={14} />
                      Voir sur la carte
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredParkings.length === 0 && parkings.length > 0 && (
          <div className="empty-state">
            <MapPin size={48} />
            <p>Aucun parking ne correspond à votre recherche</p>
          </div>
        )}

        {parkings.length === 0 && (
          <div className="empty-state">
            <MapPin size={48} />
            <p>Aucun parking configuré</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} />
              Ajouter un parking
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setEditingParking(null);
            }
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {editingParking ? "Modifier le parking" : "Ajouter un parking"}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowForm(false);
                  setEditingParking(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <ParkingForm
                parking={editingParking}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingParking(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMap && selectedParkingForMap && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMap(false);
              setSelectedParkingForMap(null);
            }
          }}
        >
          <div className="modal-content large">
            <div className="modal-header">
              <h3>Carte - {selectedParkingForMap.nom}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowMap(false);
                  setSelectedParkingForMap(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body p-0">
              <ParkingsMapModule
                onClose={() => {
                  setShowMap(false);
                  setSelectedParkingForMap(null);
                }}
                initialParkingId={selectedParkingForMap?.id}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .parkings-module {
          padding: 20px;
          background: #f5f7fa;
          min-height: 100vh;
        }

        .module-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .module-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 24px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .module-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-primary:hover { background: #1d4ed8; }

        .btn-secondary {
          background: white;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .btn-secondary:hover { background: #f8fafc; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #1e293b;
        }

        .stat-label {
          font-size: 14px;
          color: #64748b;
          margin-top: 4px;
        }

        .stat-total-places .stat-value { color: #3b82f6; }
        .stat-occupied .stat-value { color: #f59e0b; }
        .stat-free .stat-value { color: #10b981; }

        .filters-bar {
          margin-bottom: 24px;
        }

        .filter-input {
          width: 100%;
          max-width: 400px;
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          font-size: 14px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .parking-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .parking-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 16px;
          color: #1e293b;
        }

        .card-actions-header {
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          padding: 6px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .btn-edit { background: #e0e7ff; color: #4338ca; }
        .btn-edit:hover { background: #c7d2fe; }

        .btn-delete { background: #fee2e2; color: #dc2626; }
        .btn-delete:hover { background: #fecaca; }

        .card-address {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #64748b;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .occupation-stats {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 8px;
        }

        .occupation-number {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
        }

        .occupation-count { font-size: 28px; }
        .occupation-total { font-size: 16px; font-weight: 400; color: #94a3b8; }
        .occupation-label { font-size: 11px; font-weight: 400; color: #94a3b8; margin-left: 4px; }
        .occupation-percent { font-size: 20px; font-weight: 700; }
        .occupation-percent.red { color: #ef4444; }
        .occupation-percent.orange { color: #f59e0b; }
        .occupation-percent.green { color: #10b981; }

        .progress-bar {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
        .progress-fill.red { background: #ef4444; }
        .progress-fill.orange { background: #f59e0b; }
        .progress-fill.green { background: #10b981; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 12px;
        }

        .status-red { background: #fee2e2; color: #dc2626; }
        .status-orange { background: #fed7aa; color: #ea580c; }
        .status-green { background: #dcfce7; color: #16a34a; }

        .ambulances-list {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .ambulances-list strong { font-size: 12px; color: #64748b; }
        .ambulance-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .ambulance-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500; }
        .more-badge { display: inline-flex; align-items: center; padding: 2px 8px; background: #f1f5f9; color: #64748b; border-radius: 12px; font-size: 11px; }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .card-footer-left { flex: 1; }
        .coordinates-display { font-size: 12px; color: #64748b; font-family: monospace; }
        .card-footer-right { display: flex; gap: 8px; }


        .btn-map {
          background: #10b981;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .btn-map:hover { background: #059669; }

        .text-muted { color: #94a3b8; font-size: 12px; }

        .empty-state {
          text-align: center;
          padding: 60px;
          color: #94a3b8;
          grid-column: 1 / -1;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow: auto;
        }

        .modal-content.large { max-width: 1200px; width: 95%; }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h3 { margin: 0; font-size: 18px; font-weight: 600; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8; }
        .modal-body { padding: 20px; }
        .modal-body.p-0 { padding: 0; }

        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .cards-grid { grid-template-columns: 1fr; }
          .module-header { flex-direction: column; align-items: stretch; }
          .module-actions { justify-content: flex-start; }
          .card-footer { flex-direction: column; gap: 8px; align-items: flex-start; }
          .card-footer-right { align-self: flex-end; }
        }
      `}</style>
    </div>
  );
};

export default ParkingsModule;
