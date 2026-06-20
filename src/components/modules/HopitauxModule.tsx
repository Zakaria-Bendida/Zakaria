import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import {
  Building2,
  Edit,
  Trash2,
  Plus,
  Download,
  MapPin,
  Phone,
  Mail,
  Map,
} from "lucide-react";
import type { Hopital } from "../../context/DataContext";
import HopitalForm from "../forms/HopitalForm";
import HopitauxMapModule from "../modules/HopitauxMapModule";

const HopitauxModule: React.FC = () => {
  const { hopitaux, addHopital, updateHopital, deleteHopital, refreshData } =
    useData();
  const [showForm, setShowForm] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedHospitalForMap, setSelectedHospitalForMap] =
    useState<Hopital | null>(null);
  const [editingHopital, setEditingHopital] = useState<Hopital | null>(null);
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

  const filteredHopitaux = hopitaux.filter((hopital) => {
    const matchSearch =
      !filters.search ||
      hopital.nom.toLowerCase().includes(filters.search.toLowerCase()) ||
      hopital.adresse.toLowerCase().includes(filters.search.toLowerCase());
    return matchSearch;
  });

  const handleSave = async (hopital: Partial<Hopital>) => {
    try {
      if (editingHopital) {
        await updateHopital(editingHopital.id, hopital);
        alert("Hôpital modifié avec succès");
      } else {
        await addHopital(hopital);
        alert("Hôpital ajouté avec succès");
      }
      setShowForm(false);
      setEditingHopital(null);
      refreshData();
    } catch (error: any) {
      alert("Erreur lors de la sauvegarde : " + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet hôpital ?")) {
      try {
        await deleteHopital(id);
        alert("Hôpital supprimé avec succès");
        refreshData();
      } catch (error: any) {
        alert("Erreur lors de la suppression : " + error.message);
      }
    }
  };

  const handleViewOnMap = (hopital: Hopital) => {
    if (!hopital.latitude || !hopital.longitude) {
      alert(
        "Cet hôpital n'a pas de coordonnées GPS. Veuillez d'abord les configurer.",
      );
      return;
    }
    setSelectedHospitalForMap(hopital);
    setShowMap(true);
  };

  const exportCSV = () => {
    const headers = [
      "ID",
      "Nom",
      "Adresse",
      "Téléphone",
      "Email",
      "Latitude",
      "Longitude",
    ];
    const csv = [
      headers.join(","),
      ...filteredHopitaux.map((h) =>
        [
          h.id,
          `"${h.nom}"`,
          `"${h.adresse}"`,
          h.telephone || "",
          h.email || "",
          h.latitude || "",
          h.longitude || "",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hopitaux.csv";
    a.click();
  };

  const stats = {
    total: hopitaux.length,
    geolocalises: hopitaux.filter((h) => h.latitude && h.longitude).length,
  };

  return (
    <div className="hopitaux-module">
      <div className="module-header">
        <h2 className="module-title">
          <Building2 size={24} />
          Gestion des Hôpitaux
        </h2>
        <div className="module-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingHopital(null);
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
          <div className="stat-label">TOTAL HÔPITAUX</div>
        </div>
        <div className="stat-card stat-geo">
          <div className="stat-value">{stats.geolocalises}</div>
          <div className="stat-label">GÉOLOCALISÉS</div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Rechercher par nom ou adresse..."
          value={filters.search}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
          className="filter-input"
        />
      </div>

      {/* Hopitaux Cards */}
      <div className="cards-grid">
        {filteredHopitaux.map((hopital) => (
          <div className="hospital-card" key={hopital.id}>
            <div className="card-header">
              <div className="card-title">
                <Building2 size={18} />
                <span>{hopital.nom}</span>
              </div>
              <div className="card-actions-header">
                <button
                  className="btn-icon btn-edit"
                  onClick={() => {
                    setEditingHopital(hopital);
                    setShowForm(true);
                  }}
                  title="Modifier"
                >
                  <Edit size={16} />
                </button>
                <button
                  className="btn-icon btn-delete"
                  onClick={() => handleDelete(hopital.id)}
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="card-address">
              <MapPin size={14} />
              <span>{hopital.adresse}</span>
            </div>

            <div className="card-details">
              {hopital.telephone && (
                <div className="detail-item">
                  <Phone size={14} />
                  <span>{hopital.telephone}</span>
                </div>
              )}
              {hopital.email && (
                <div className="detail-item">
                  <Mail size={14} />
                  <span>{hopital.email}</span>
                </div>
              )}
            </div>

            <div className="card-footer">
              {hopital.latitude && hopital.longitude ? (
                <button
                  className="btn-map"
                  onClick={() => handleViewOnMap(hopital)}
                >
                  <Map size={14} />
                  Voir sur la carte
                </button>
              ) : (
                <span className="text-muted">Non géolocalisé</span>
              )}
            </div>
          </div>
        ))}

        {filteredHopitaux.length === 0 && hopitaux.length > 0 && (
          <div className="empty-state">
            <Building2 size={48} />
            <p>Aucun hôpital ne correspond à votre recherche</p>
          </div>
        )}

        {hopitaux.length === 0 && (
          <div className="empty-state">
            <Building2 size={48} />
            <p>Aucun hôpital configuré</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} />
              Ajouter un hôpital
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
              setEditingHopital(null);
            }
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {editingHopital ? "Modifier l'hôpital" : "Ajouter un hôpital"}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowForm(false);
                  setEditingHopital(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <HopitalForm
                hopital={editingHopital}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingHopital(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMap && selectedHospitalForMap && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMap(false);
              setSelectedHospitalForMap(null);
            }
          }}
        >
          <div className="modal-content large">
            <div className="modal-header">
              <h3>Carte - {selectedHospitalForMap.nom}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowMap(false);
                  setSelectedHospitalForMap(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body p-0">
              <HopitauxMapModule
                onClose={() => {
                  setShowMap(false);
                  setSelectedHospitalForMap(null);
                }}
                initialHospitalId={selectedHospitalForMap?.id}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hopitaux-module {
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

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
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

        .stat-geo .stat-value { color: #10b981; }

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

        .hospital-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .hospital-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
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
          gap: 8px;
          font-size: 13px;
          color: #64748b;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .card-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
        }

        .card-footer {
          display: flex;
          justify-content: flex-end;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .text-muted {
          color: #94a3b8;
          font-size: 13px;
        }

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

        .modal-content.large {
          max-width: 1200px;
          width: 95%;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #94a3b8;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-body.p-0 {
          padding: 0;
        }

        @media (max-width: 768px) {
          .cards-grid {
            grid-template-columns: 1fr;
          }
          .module-header {
            flex-direction: column;
            align-items: stretch;
          }
          .module-actions {
            justify-content: flex-start;
          }
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default HopitauxModule;
