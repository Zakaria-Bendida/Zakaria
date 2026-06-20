import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import {
  Users,
  Edit,
  Trash2,
  Plus,
  Download,
  Phone,
  Mail,
  Car,
  Shield,
  UserCog,
} from "lucide-react";
import type { Personnel } from "../../context/DataContext";
import PersonnelForm from "../forms/PersonnelForm";

const PersonnelsModule: React.FC = () => {
  const {
    personnels,
    addPersonnel,
    updatePersonnel,
    deletePersonnel,
    ambulances,
    refreshData,
  } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(
    null,
  );
  const [filters, setFilters] = useState({
    role: "",
    search: "",
  });

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

  const filteredPersonnels = personnels.filter((personnel) => {
    const matchRole = !filters.role || personnel.role === filters.role;
    const matchSearch =
      !filters.search ||
      personnel.nom?.toLowerCase().includes(filters.search.toLowerCase()) ||
      personnel.prenom?.toLowerCase().includes(filters.search.toLowerCase()) ||
      personnel.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      personnel.telephone?.includes(filters.search);
    return matchRole && matchSearch;
  });

  const handleSave = async (personnelData: Partial<Personnel>) => {
    try {
      if (editingPersonnel) {
        const idToUse = editingPersonnel.id || editingPersonnel._id;
        await updatePersonnel(idToUse as string, personnelData);
        alert("Personnel modifié avec succès");
      } else {
        await addPersonnel(personnelData as Personnel);
        alert("Personnel ajouté avec succès");
      }
      setShowForm(false);
      setEditingPersonnel(null);
      refreshData();
    } catch (error: any) {
      console.error("Save error:", error);
      alert("Erreur lors de la sauvegarde : " + error.message);
    }
  };

  const handleDelete = async (personnel: Personnel) => {
    const name = `${personnel.prenom} ${personnel.nom}`;
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${name} ?`)) {
      try {
        const idToUse = personnel.id || personnel._id;
        await deletePersonnel(idToUse as any);
        alert("Personnel supprimé avec succès");
        refreshData();
      } catch (error: any) {
        console.error("Delete error:", error);
        alert("Erreur lors de la suppression : " + error.message);
      }
    }
  };

  const exportCSV = () => {
    const headers = [
      "ID",
      "Matricule",
      "Nom",
      "Prénom",
      "Rôle",
      "Téléphone",
      "Email",
      "Ambulance",
    ];
    const csv = [
      headers.join(","),
      ...filteredPersonnels.map((p) =>
        [
          p.id || p._id,
          p.matricule || "",
          `"${p.nom || ""}"`,
          `"${p.prenom || ""}"`,
          getRoleLabel(p.role),
          p.telephone || "",
          p.email || "",
          getAmbulanceName(p.ambulanceId),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "personnels.csv";
    a.click();
  };

  const getRoleClass = (role: string) => {
    switch (role?.toLowerCase()) {
      case "manager":
        return "role-manager";
      case "ambulancier":
        return "role-driver";
      default:
        return "";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case "manager":
        return <Shield size={14} />;
      case "ambulancier":
        return <Car size={14} />;
      default:
        return <UserCog size={14} />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role?.toLowerCase()) {
      case "manager":
        return "Administrateur";
      case "ambulancier":
        return "Chauffeur Ambulancier";
      default:
        return role || "Chauffeur Ambulancier";
    }
  };

  const getAmbulanceName = (ambulanceId?: number) => {
    if (!ambulanceId) return "Non assigné";
    const ambulance = ambulances.find((a) => a.id === ambulanceId);
    return ambulance?.immatriculation || "Non assigné";
  };

  const stats = {
    total: personnels.length,
    managers: personnels.filter((p) => p.role?.toLowerCase() === "manager")
      .length,
    drivers: personnels.filter((p) => p.role?.toLowerCase() === "ambulancier")
      .length,
  };

  return (
    <div className="personnels-module">
      <div className="module-header">
        <h2 className="module-title">
          <Users size={24} />
          Gestion du Personnel
        </h2>
        <div className="module-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingPersonnel(null);
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
          <div className="stat-label">TOTAL</div>
        </div>
        <div className="stat-card stat-manager">
          <div className="stat-value">{stats.managers}</div>
          <div className="stat-label">ADMINISTRATEURS</div>
        </div>
        <div className="stat-card stat-driver">
          <div className="stat-value">{stats.drivers}</div>
          <div className="stat-label">CHAUFFEURS</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          value={filters.role}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, role: e.target.value }))
          }
          className="filter-select"
        >
          <option value="">Tous les rôles</option>
          <option value="manager">Administrateurs</option>
          <option value="ambulancier">Chauffeurs Ambulanciers</option>
        </select>
        <input
          type="text"
          placeholder="Rechercher par nom, email ou téléphone..."
          value={filters.search}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
          className="filter-input"
        />
      </div>

      {/* Personnel Cards */}
      <div className="cards-grid">
        {filteredPersonnels.map((personnel) => (
          <div className="personnel-card" key={personnel.id || personnel._id}>
            <div className="card-header">
              <div className="card-title">
                <Users size={18} />
                <span>
                  {personnel.prenom} {personnel.nom}
                </span>
              </div>
              <div className="card-actions-header">
                <button
                  className="btn-icon btn-edit"
                  onClick={() => {
                    setEditingPersonnel(personnel);
                    setShowForm(true);
                  }}
                  title="Modifier"
                >
                  <Edit size={16} />
                </button>
                <button
                  className="btn-icon btn-delete"
                  onClick={() => handleDelete(personnel)}
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className={`role-badge ${getRoleClass(personnel.role)}`}>
              {getRoleIcon(personnel.role)}
              <span>{getRoleLabel(personnel.role)}</span>
            </div>

            <div className="card-details">
              {personnel.matricule && (
                <div className="detail-item">
                  <strong>Matricule:</strong> {personnel.matricule}
                </div>
              )}
              {personnel.telephone && (
                <div className="detail-item">
                  <Phone size={14} />
                  <span>{personnel.telephone}</span>
                </div>
              )}
              {personnel.email && (
                <div className="detail-item">
                  <Mail size={14} />
                  <span>{personnel.email}</span>
                </div>
              )}
              {personnel.role === "ambulancier" && (
                <div className="detail-item">
                  <Car size={14} />
                  <span>
                    <strong>Ambulance:</strong>{" "}
                    {getAmbulanceName(personnel.ambulanceId)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredPersonnels.length === 0 && personnels.length > 0 && (
          <div className="empty-state">
            <Users size={48} />
            <p>Aucun personnel ne correspond à votre recherche</p>
          </div>
        )}

        {personnels.length === 0 && (
          <div className="empty-state">
            <Users size={48} />
            <p>Aucun personnel enregistré</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} />
              Ajouter du personnel
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
              setEditingPersonnel(null);
            }
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {editingPersonnel
                  ? "Modifier le membre du personnel"
                  : "Ajouter du personnel"}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowForm(false);
                  setEditingPersonnel(null);
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <PersonnelForm
                personnel={editingPersonnel}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingPersonnel(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .personnels-module {
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
          grid-template-columns: repeat(3, 1fr);
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

        .stat-manager .stat-value { color: #8b5cf6; }
        .stat-driver .stat-value { color: #10b981; }

        .filters-bar {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .filter-select, .filter-input {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          font-size: 14px;
          min-width: 200px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .personnel-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .personnel-card:hover {
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

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 16px;
        }

        .role-manager {
          background: #ede9fe;
          color: #6d28d9;
        }

        .role-driver {
          background: #dcfce7;
          color: #166534;
        }

        .card-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
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

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .cards-grid {
            grid-template-columns: 1fr;
          }
          .module-header {
            flex-direction: column;
            align-items: stretch;
          }
          .filters-bar {
            flex-direction: column;
          }
          .filter-select, .filter-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default PersonnelsModule;
