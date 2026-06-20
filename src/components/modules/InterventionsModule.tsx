import React, { useState, useEffect, useRef } from "react";
import { useData } from "../../context/DataContext";
import {
  AlertTriangle,
  Edit,
  X,
  Plus,
  Download,
  Clock,
  CheckCircle,
  User,
  Phone,
  Ambulance,
  Map,
  PhoneCall,
  Check,
  AlertCircle,
  Search,
  Trash2,
  Ban,
  Truck,
  CheckSquare,
  Circle,
  Calendar,
  Timer,
} from "lucide-react";
import type { Intervention } from "../../context/DataContext";
import InterventionForm from "../forms/InterventionForm";
import InterventionMapModal from "../modules/InterventionMapModal";
import { io as socketIO } from "socket.io-client";

const API_BASE_URL = "http://192.168.1.5:5000/api";
const SOCKET_URL = "http://192.168.1.5:5000";

const InterventionsModule: React.FC = () => {
  const {
    interventions,
    addIntervention,
    updateIntervention,
    deleteIntervention,
    ambulances,
    hopitaux,
    refreshData,
  } = useData();

  const [showForm, setShowForm] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedInterventionForMap, setSelectedInterventionForMap] =
    useState<Intervention | null>(null);
  const [editingIntervention, setEditingIntervention] =
    useState<Intervention | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedInterventionForConfirm, setSelectedInterventionForConfirm] =
    useState<Intervention | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmedInterventions, setConfirmedInterventions] = useState<
    Set<number>
  >(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());
  const previousCountRef = useRef(interventions.length);

  // Live clock update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Status filter options
  const statusOptions = [
    {
      value: "all",
      label: "Toutes",
      icon: <Circle size={12} />,
      color: "#64748b",
    },
    {
      value: "active",
      label: "En cours",
      icon: <Truck size={12} />,
      color: "#f59e0b",
    },
    {
      value: "completed",
      label: "Terminées",
      icon: <CheckSquare size={12} />,
      color: "#10b981",
    },
    {
      value: "cancelled",
      label: "Annulées",
      icon: <Ban size={12} />,
      color: "#6b7280",
    },
  ];

  // Request browser notification permission
  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Socket.io — auto-refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    const socket = socketIO(SOCKET_URL, {
      auth: { token },
    });

    socket.on("connect", () => {
      console.log("📡 Dashboard connected to socket");
    });

    const handleRefresh = async (data: any) => {
      console.log("🔄 Socket event received, refreshing:", data);
      await refreshData();
    };

    socket.on("new_intervention", handleRefresh);
    socket.on("intervention_updated", handleRefresh);
    socket.on("intervention_completed", handleRefresh);
    socket.on("intervention_cancelled", handleRefresh);
    socket.on("driver:status", handleRefresh);
    socket.on("ambulance_location", handleRefresh);

    return () => {
      socket.off("new_intervention", handleRefresh);
      socket.off("intervention_updated", handleRefresh);
      socket.off("intervention_completed", handleRefresh);
      socket.off("intervention_cancelled", handleRefresh);
      socket.off("driver:status", handleRefresh);
      socket.off("ambulance_location", handleRefresh);
      socket.disconnect();
    };
  }, [refreshData]);

  // Fallback polling every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Browser notification on new intervention
  useEffect(() => {
    if (interventions.length > previousCountRef.current) {
      const audio = new Audio("/notification.mp3");
      audio.play().catch(() => {});

      if (Notification.permission === "granted") {
        new Notification("Nouvelle intervention", {
          body: "Une nouvelle intervention a été créée",
          icon: "/ambulance-icon.png",
        });
      }
    }
    previousCountRef.current = interventions.length;
  }, [interventions]);

  // Lock body scroll when form is open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showForm]);

  const isPending = (statut: string) =>
    statut === "en attente" || statut === "pending";
  const isActive = (statut: string) =>
    statut === "en route" ||
    statut === "transport" ||
    statut === "en_transport";
  const isCompleted = (statut: string) => statut === "terminée";
  const isCancelled = (statut: string) =>
    statut === "annulée" || statut === "cancelled";

  const getStatusKey = (statut: string) => {
    if (isPending(statut)) return "active";
    if (isActive(statut)) return "active";
    if (isCompleted(statut)) return "completed";
    if (isCancelled(statut)) return "cancelled";
    return statut;
  };

  const filteredInterventions = interventions.filter((intervention) => {
    const statusKey = getStatusKey(intervention.statut);
    const matchStatus =
      selectedStatus === "all" || statusKey === selectedStatus;
    const matchSearch =
      !searchTerm ||
      intervention.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intervention.description
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      intervention.caller_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      intervention.caller_phone?.includes(searchTerm);
    return matchStatus && matchSearch;
  });

  const activeInterventions = filteredInterventions.filter(
    (i) => isPending(i.statut) || isActive(i.statut),
  );
  const completedInterventions = filteredInterventions.filter(
    (i) => isCompleted(i.statut) || isCancelled(i.statut),
  );

  // ✅ FIXED: Format date with UTC+1 timezone (Algeria time)
  const formatDateTime = (dateTime: string) => {
    if (!dateTime) return "—";
    try {
      let date = new Date(dateTime);
      if (isNaN(date.getTime())) {
        date = new Date(dateTime.replace(" ", "T"));
      }
      if (isNaN(date.getTime())) {
        const timestamp = parseInt(dateTime);
        if (!isNaN(timestamp)) {
          date = new Date(timestamp);
        }
      }
      if (isNaN(date.getTime())) {
        return "Date invalide";
      }

      // ✅ Add UTC+1 offset for Algeria time
      const utcPlus1Date = new Date(date.getTime() + 60 * 60 * 1000);

      return utcPlus1Date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "Date invalide";
    }
  };

  const getInterventionDate = (intervention: Intervention): string => {
    return (
      intervention.created_at ||
      intervention.updated_at ||
      intervention.date_intervention ||
      intervention.dateHeure ||
      new Date().toISOString()
    );
  };

  const handleSave = async (interventionData: Partial<Intervention>) => {
    try {
      if (editingIntervention) {
        await updateIntervention(editingIntervention.id, interventionData);
        alert("Intervention modifiée avec succès");
      } else {
        await addIntervention(interventionData);
        alert("Intervention créée avec succès");
      }
      setShowForm(false);
      setEditingIntervention(null);
      await refreshData();
    } catch (error: any) {
      console.error("Save error:", error);
      alert("Erreur lors de la sauvegarde : " + error.message);
    }
  };

  const handleRealCall = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/interventions/${id}/confirm`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const result = await response.json();

      if (result.success) {
        setConfirmedInterventions((prev) => new Set([...prev, id]));
        alert("Intervention confirmée (vraie urgence).");
        setShowConfirmModal(false);
        setSelectedInterventionForConfirm(null);
        await refreshData();
      } else {
        alert("Erreur: " + result.error);
      }
    } catch (error: any) {
      alert("Erreur: " + error.message);
    }
  };

  const handleFakeCall = async (id: number) => {
    if (
      window.confirm(
        "Confirmer que c'est une FAUSSE ALERTE ? L'ambulance sera libérée.",
      )
    ) {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${API_BASE_URL}/interventions/${id}/cancel`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const result = await response.json();

        if (result.success) {
          alert("Intervention annulée (fausse alerte).");
          setShowConfirmModal(false);
          setSelectedInterventionForConfirm(null);
          await refreshData();
        } else {
          alert("Erreur: " + result.error);
        }
      } catch (error: any) {
        alert("Erreur: " + error.message);
      }
    }
  };

  const handleComplete = async (id: number) => {
    if (
      window.confirm("Terminer cette intervention ? L'ambulance sera libérée.")
    ) {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${API_BASE_URL}/interventions/${id}/complete`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const result = await response.json();

        if (result.success) {
          alert("Intervention terminée avec succès");
          await refreshData();
        } else {
          alert("Erreur: " + result.error);
        }
      } catch (error: any) {
        alert("Erreur: " + error.message);
      }
    }
  };

  const handleDelete = async (id: number) => {
    const intervention = interventions.find((i) => i.id === id);
    if (
      !isCompleted(intervention?.statut) &&
      !isCancelled(intervention?.statut)
    ) {
      alert(
        "Seules les interventions terminées ou annulées peuvent être supprimées.",
      );
      return;
    }
    if (window.confirm("Supprimer définitivement cette intervention ?")) {
      try {
        await deleteIntervention(id);
        alert("Intervention supprimée avec succès");
        await refreshData();
      } catch (error: any) {
        alert("Erreur lors de la suppression : " + error.message);
      }
    }
  };

  const handleViewOnMap = (intervention: Intervention) => {
    const lat = intervention.latitude_depart || intervention.latitude;
    const lng = intervention.longitude_depart || intervention.longitude;
    if (!lat || !lng) {
      alert("Cette intervention n'a pas de coordonnées GPS.");
      return;
    }
    setSelectedInterventionForMap(intervention);
    setShowMapModal(true);
  };

  const exportCSV = () => {
    const headers = [
      "ID",
      "Type",
      "Date/Heure",
      "Description",
      "Statut",
      "Appelant",
      "Téléphone",
      "Ambulance",
      "Hôpital",
    ];
    const csv = [
      headers.join(","),
      ...interventions.map((i) =>
        [
          i.id,
          `"${i.type}"`,
          getInterventionDate(i),
          `"${i.description?.replace(/"/g, '""') || ""}"`,
          getDisplayStatut(i.statut),
          `"${i.caller_name || "Inconnu"}"`,
          `"${i.caller_phone || ""}"`,
          `"${getAmbulanceName(i.ambulance_id || i.ambulanceId)}"`,
          `"${getHopitalName(i.hopital_id || i.hopitalId)}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interventions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getDisplayStatut = (statut: string) => {
    if (isPending(statut)) return "En attente";
    if (isActive(statut)) return "En mission";
    if (isCompleted(statut)) return "Terminée";
    if (isCancelled(statut)) return "Annulée";
    return statut || "Inconnu";
  };

  const getStatusIcon = (statut: string) => {
    if (isPending(statut)) return <AlertCircle size={14} />;
    if (isActive(statut)) return <Truck size={14} />;
    if (isCompleted(statut)) return <CheckCircle size={14} />;
    if (isCancelled(statut)) return <Ban size={14} />;
    return <Circle size={14} />;
  };

  const getStatusColor = (statut: string) => {
    if (isPending(statut)) return "#ef4444";
    if (isActive(statut)) return "#f59e0b";
    if (isCompleted(statut)) return "#10b981";
    if (isCancelled(statut)) return "#6b7280";
    return "#64748b";
  };

  const getAmbulanceName = (ambulanceId?: number) => {
    if (!ambulanceId) return "Non assignée";
    const ambulance = ambulances.find((a) => a.id === ambulanceId);
    return ambulance?.immatriculation || "Non assignée";
  };

  const getHopitalName = (hopitalId?: number) => {
    if (!hopitalId) return "Non assigné";
    const hopital = hopitaux.find((h) => h.id === hopitalId);
    return hopital?.nom || "Non assigné";
  };

  const stats = {
    total: interventions.length,
    active: interventions.filter(
      (i) => isPending(i.statut) || isActive(i.statut),
    ).length,
    completed: interventions.filter((i) => isCompleted(i.statut)).length,
    cancelled: interventions.filter((i) => isCancelled(i.statut)).length,
  };

  const formattedTime = currentTime.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const ConfirmationModal = () => {
    if (!showConfirmModal || !selectedInterventionForConfirm) return null;
    return (
      <div
        className="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowConfirmModal(false);
            setSelectedInterventionForConfirm(null);
          }
        }}
      >
        <div className="modal-content small">
          <div className="modal-header">
            <h3>Confirmation téléphonique</h3>
            <button
              className="modal-close"
              onClick={() => {
                setShowConfirmModal(false);
                setSelectedInterventionForConfirm(null);
              }}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <div className="call-info">
              <div className="caller-details">
                <div className="detail-row">
                  <strong>📞 Appelant:</strong>{" "}
                  {selectedInterventionForConfirm.caller_name ||
                    "Non renseigné"}
                </div>
                <div className="detail-row">
                  <strong>📱 Téléphone:</strong>{" "}
                  {selectedInterventionForConfirm.caller_phone ||
                    "Non renseigné"}
                </div>
                <div className="detail-row">
                  <strong>📍 Type:</strong>{" "}
                  {selectedInterventionForConfirm.type}
                </div>
                <div className="detail-row">
                  <strong>📝 Description:</strong>{" "}
                  {selectedInterventionForConfirm.description}
                </div>
              </div>
              <div className="call-actions">
                <button
                  className="btn-real"
                  onClick={() =>
                    handleRealCall(selectedInterventionForConfirm.id)
                  }
                >
                  <Check size={16} /> Urgence réelle
                </button>
                <button
                  className="btn-fake"
                  onClick={() =>
                    handleFakeCall(selectedInterventionForConfirm.id)
                  }
                >
                  <Ban size={16} /> Fausse alerte
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="interventions-module">
      <ConfirmationModal />

      <div className="module-header">
        <h2 className="module-title">
          <AlertTriangle size={22} />
          Gestion des Interventions
        </h2>
        <div className="module-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} />
            Nouvelle
          </button>
          <button className="btn-secondary" onClick={exportCSV}>
            <Download size={14} />
            Export
          </button>
          <div className="timer-watch">
            <Timer size={14} className="timer-icon" />
            <span className="timer-time">{formattedTime}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">TOTAL</div>
        </div>
        <div className="stat-card active">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">EN COURS</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">TERMINÉES</div>
        </div>
        <div className="stat-card cancelled">
          <div className="stat-value">{stats.cancelled}</div>
          <div className="stat-label">ANNULÉES</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-container">
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button className="clear-search" onClick={() => setSearchTerm("")}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="status-tabs">
        {statusOptions.map((option) => {
          let count = 0;
          if (option.value === "all") count = interventions.length;
          else if (option.value === "active") count = stats.active;
          else if (option.value === "completed") count = stats.completed;
          else if (option.value === "cancelled") count = stats.cancelled;

          const isActiveTab = selectedStatus === option.value;
          return (
            <button
              key={option.value}
              className={`status-tab ${isActiveTab ? "active" : ""}`}
              onClick={() => setSelectedStatus(option.value)}
            >
              <span className="tab-icon" style={{ color: option.color }}>
                {option.icon}
              </span>
              <span className="tab-label">{option.label}</span>
              <span
                className="tab-count"
                style={{
                  backgroundColor: option.color + "20",
                  color: option.color,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Interventions - Card View */}
      {(selectedStatus === "all" || selectedStatus === "active") &&
        activeInterventions.length > 0 && (
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">
                <Truck size={16} />
                Interventions en cours
              </h3>
              <span className="section-count">
                {activeInterventions.length}
              </span>
            </div>
            <div className="cards-grid">
              {activeInterventions.map((intervention) => {
                const lat =
                  intervention.latitude_depart || intervention.latitude;
                const lng =
                  intervention.longitude_depart || intervention.longitude;
                const hasCoordinates = lat && lng;
                const confirmed = confirmedInterventions.has(intervention.id);
                const statusColor = getStatusColor(intervention.statut);
                const displayDate = formatDateTime(
                  getInterventionDate(intervention),
                );

                return (
                  <div
                    key={intervention.id}
                    className="intervention-card"
                    style={{ borderLeftColor: statusColor }}
                  >
                    <div className="card-header">
                      <div className="card-type">
                        <span
                          className="type-badge"
                          style={{
                            backgroundColor: statusColor + "20",
                            color: statusColor,
                          }}
                        >
                          {getStatusIcon(intervention.statut)}
                          {intervention.type}
                        </span>
                        <span
                          className={`status-badge ${isPending(intervention.statut) ? "pending" : "active"}`}
                        >
                          {getDisplayStatut(intervention.statut)}
                        </span>
                      </div>
                      <div className="card-id">#{intervention.id}</div>
                    </div>

                    <div className="card-body">
                      <div className="card-info">
                        <Calendar size={12} />
                        <span>{displayDate}</span>
                      </div>
                      <div className="card-info">
                        <AlertCircle size={12} />
                        <span>{intervention.description}</span>
                      </div>
                      <div className="card-info">
                        <User size={12} />
                        <span>
                          <strong>Appelant:</strong>{" "}
                          {intervention.caller_name || "—"}
                        </span>
                      </div>
                      <div className="card-info">
                        <Phone size={12} />
                        <span>
                          <strong>Téléphone:</strong>{" "}
                          {intervention.caller_phone || "—"}
                        </span>
                      </div>
                      <div className="card-info">
                        <Ambulance size={12} />
                        <span>
                          <strong>Ambulance:</strong>{" "}
                          {getAmbulanceName(
                            intervention.ambulance_id ||
                              intervention.ambulanceId,
                          )}
                        </span>
                      </div>
                      {/* ✅ REMOVED elapsed time section */}
                      {confirmed && (
                        <div className="card-info confirmed">
                          <CheckCircle size={12} />
                          <span>Confirmée ✓</span>
                        </div>
                      )}
                    </div>

                    <div className="card-footer">
                      <div className="card-coords">
                        {hasCoordinates ? (
                          <span>
                            📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-muted">📍 Non localisé</span>
                        )}
                      </div>
                      <div className="card-actions">
                        {hasCoordinates && (
                          <button
                            className="action-btn map"
                            onClick={() => handleViewOnMap(intervention)}
                            title="Voir sur la carte"
                          >
                            <Map size={14} />
                          </button>
                        )}
                        <button
                          className="action-btn edit"
                          onClick={() => {
                            setEditingIntervention(intervention);
                            setShowForm(true);
                          }}
                          title="Modifier"
                        >
                          <Edit size={14} />
                        </button>
                        {isActive(intervention.statut) && !confirmed && (
                          <button
                            className="action-btn confirm"
                            onClick={() => {
                              setSelectedInterventionForConfirm(intervention);
                              setShowConfirmModal(true);
                            }}
                            title="Confirmer"
                          >
                            <PhoneCall size={14} />
                          </button>
                        )}
                        {isActive(intervention.statut) && (
                          <button
                            className="action-btn complete"
                            onClick={() => handleComplete(intervention.id)}
                            title="Terminer"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Completed/Cancelled Interventions - Table View */}
      {(selectedStatus === "all" ||
        selectedStatus === "completed" ||
        selectedStatus === "cancelled") &&
        completedInterventions.length > 0 && (
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">
                <CheckSquare size={16} />
                Historique
              </h3>
              <span className="section-count">
                {completedInterventions.length}
              </span>
            </div>
            <div className="table-container">
              <table className="interventions-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Appelant</th>
                    <th>Téléphone</th>
                    <th>Ambulance</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completedInterventions.map((intervention) => {
                    const lat =
                      intervention.latitude_depart || intervention.latitude;
                    const lng =
                      intervention.longitude_depart || intervention.longitude;
                    const hasCoordinates = lat && lng;
                    const isComp = isCompleted(intervention.statut);
                    const displayDate = formatDateTime(
                      getInterventionDate(intervention),
                    );

                    return (
                      <tr
                        key={intervention.id}
                        className={`status-row ${isComp ? "completed" : "cancelled"}`}
                      >
                        <td className="id-cell">#{intervention.id}</td>
                        <td className="date-cell">{displayDate}</td>
                        <td className="type-cell">{intervention.type}</td>
                        <td className="desc-cell">
                          {intervention.description?.substring(0, 60)}...
                        </td>
                        <td className="caller-cell">
                          {intervention.caller_name || "—"}
                        </td>
                        <td className="phone-cell">
                          {intervention.caller_phone || "—"}
                        </td>
                        <td className="ambulance-cell">
                          {getAmbulanceName(
                            intervention.ambulance_id ||
                              intervention.ambulanceId,
                          )}
                        </td>
                        <td className="status-cell">
                          <span
                            className={`status-badge ${isComp ? "completed" : "cancelled"}`}
                          >
                            {getStatusIcon(intervention.statut)}
                            {getDisplayStatut(intervention.statut)}
                          </span>
                        </td>
                        <td className="actions-cell">
                          {hasCoordinates && (
                            <button
                              className="action-btn map"
                              onClick={() => handleViewOnMap(intervention)}
                              title="Voir sur la carte"
                            >
                              <Map size={14} />
                            </button>
                          )}
                          <button
                            className="action-btn delete"
                            onClick={() => handleDelete(intervention.id)}
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Empty State */}
      {filteredInterventions.length === 0 && (
        <div className="empty-state">
          <AlertTriangle size={40} />
          <p>Aucune intervention trouvée</p>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
              setEditingIntervention(null);
            }
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {editingIntervention ? "Modifier" : "Créer une intervention"}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowForm(false);
                  setEditingIntervention(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <InterventionForm
                intervention={editingIntervention}
                onSave={handleSave}
                onCancel={() => {
                  setShowForm(false);
                  setEditingIntervention(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showMapModal && selectedInterventionForMap && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMapModal(false);
              setSelectedInterventionForMap(null);
            }
          }}
        >
          <div className="modal-content large">
            <div className="modal-header">
              <h3>Intervention - {selectedInterventionForMap.type}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowMapModal(false);
                  setSelectedInterventionForMap(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body p-0">
              <InterventionMapModal
                intervention={selectedInterventionForMap}
                onClose={() => {
                  setShowMapModal(false);
                  setSelectedInterventionForMap(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
  .interventions-module { padding: 20px; background: #f5f7fa; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
  
  /* Header */
  .module-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
  .module-title { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 600; color: #1e293b; margin: 0; }
  .module-actions { display: flex; align-items: center; gap: 10px; }
  .btn-primary, .btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
  .btn-primary { background: #2563eb; color: white; }
  .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); }
  .btn-secondary { background: white; color: #475569; border: 1px solid #e2e8f0; }
  .btn-secondary:hover { background: #f8fafc; }
  .btn-real, .btn-fake { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; }
  .btn-real { background: #10b981; color: white; }
  .btn-real:hover { background: #059669; }
  .btn-fake { background: #ef4444; color: white; }
  .btn-fake:hover { background: #dc2626; }
  
  /* Timer Watch */
  .timer-watch { display: flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 4px 10px; border-radius: 20px; border: 1px solid #e2e8f0; }
  .timer-icon { color: #3b82f6; }
  .timer-time { font-size: 13px; font-weight: 500; color: #0f172a; font-family: monospace; }
  
  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat-card { background: white; padding: 14px; border-radius: 12px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: transform 0.2s; }
  .stat-card:hover { transform: translateY(-1px); }
  .stat-value { font-size: 24px; font-weight: 700; color: #1e293b; }
  .stat-label { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 500; letter-spacing: 0.3px; }
  .stat-card.active .stat-value { color: #f59e0b; }
  .stat-card.completed .stat-value { color: #10b981; }
  .stat-card.cancelled .stat-value { color: #6b7280; }
  
  /* Search */
  .search-bar { margin-bottom: 16px; }
  .search-container { display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; }
  .search-container:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
  .search-input { flex: 1; border: none; outline: none; font-size: 13px; background: transparent; }
  .clear-search { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center; }
  
  /* Status Tabs */
  .status-tabs { 
    display: flex; 
    gap: 10px; 
    margin-bottom: 24px; 
    background: white; 
    padding: 8px 12px; 
    border-radius: 16px; 
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .status-tab { 
    display: flex; 
    align-items: center; 
    gap: 10px; 
    padding: 10px 24px; 
    border: none; 
    background: transparent; 
    border-radius: 12px; 
    cursor: pointer; 
    font-size: 14px; 
    font-weight: 600; 
    color: #64748b; 
    transition: all 0.2s ease;
  }
  .status-tab:hover { 
    background: #f1f5f9; 
    transform: translateY(-1px);
  }
  .tab-icon { 
    display: flex; 
    align-items: center; 
    font-size: 16px;
  }
  .tab-label { 
    font-size: 14px; 
    font-weight: 600;
  }
  .tab-count { 
    margin-left: 8px; 
    padding: 2px 12px; 
    border-radius: 24px; 
    font-size: 12px; 
    font-weight: 700; 
    background: rgba(0,0,0,0.05);
  }
  .status-tab.active .tab-count {
    background: rgba(0,0,0,0.1);
  }
  
  /* Section */
  .section { margin-bottom: 24px; }
  .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; color: #0f172a; margin: 0; }
  .section-count { background: #e2e8f0; padding: 1px 6px; border-radius: 16px; font-size: 11px; font-weight: 500; color: #475569; }
  
  /* Cards Grid - TALLER CARDS */
  .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px; }
  .intervention-card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid; transition: all 0.2s ease; }
  .intervention-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
  
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .card-type { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .type-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .card-id { font-family: monospace; font-size: 11px; color: #94a3b8; background: #f1f5f9; padding: 2px 8px; border-radius: 12px; }
  
  .card-body { display: flex; flex-direction: column; gap: 14px; margin: 16px 0; }
  .card-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; line-height: 1.4; }
  .card-info.elapsed { color: #f59e0b; font-weight: 500; }
  .card-info.confirmed { color: #10b981; }
  .card-info strong { font-weight: 600; color: #0f172a; }
  
  .card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid #e2e8f0; margin-top: 4px; }
  .card-coords { font-size: 11px; color: #64748b; font-family: monospace; background: #f8fafc; padding: 4px 8px; border-radius: 8px; }
  .card-actions { display: flex; gap: 8px; }
  
  /* Status Badge */
  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 16px; font-size: 10px; font-weight: 500; }
  .status-badge.pending { background: #fee2e2; color: #dc2626; }
  .status-badge.active { background: #fed7aa; color: #ea580c; }
  .status-badge.completed { background: #dcfce7; color: #16a34a; }
  .status-badge.cancelled { background: #f1f5f9; color: #64748b; }
  
  /* Table */
  .table-container { background: white; border-radius: 12px; overflow: auto; border: 1px solid #e2e8f0; }
  .interventions-table { width: 100%; border-collapse: collapse; min-width: 900px; }
  .interventions-table th { text-align: left; padding: 14px 16px; background: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
  .interventions-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
  .interventions-table tr:last-child td { border-bottom: none; }
  .status-row:hover { background: #f8fafc; }
  
  .id-cell { font-weight: 600; color: #0f172a; font-family: monospace; font-size: 12px; }
  .date-cell { font-size: 12px; white-space: nowrap; color: #64748b; }
  .desc-cell { max-width: 250px; color: #64748b; font-size: 12px; }
  
  /* Actions */
  .action-btn { width: 34px; height: 34px; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: transparent; transition: all 0.2s; }
  .action-btn:hover { background: #f1f5f9; transform: scale(1.05); }
  .action-btn.map { color: #10b981; }
  .action-btn.edit { color: #3b82f6; }
  .action-btn.confirm { color: #f59e0b; }
  .action-btn.complete { color: #10b981; }
  .action-btn.delete { color: #ef4444; }
  
  /* Empty State */
  .empty-state { text-align: center; padding: 60px; background: white; border-radius: 12px; color: #94a3b8; }
  .empty-state p { margin-top: 8px; font-size: 13px; }
  .text-muted { color: #94a3b8; }
  
  /* Modal */
  .call-info .caller-details { background: #f8fafc; padding: 14px; border-radius: 10px; margin-bottom: 16px; }
  .call-info .detail-row { padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  .call-info .detail-row:last-child { border-bottom: none; }
  .call-actions { display: flex; gap: 12px; justify-content: center; }
  
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-content { background: white; border-radius: 16px; width: 90%; max-width: 550px; max-height: 90vh; overflow: auto; }
  .modal-content.small { max-width: 420px; }
  .modal-content.large { max-width: 1100px; width: 95%; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; }
  .modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
  .modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #94a3b8; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
  .modal-close:hover { background: #f1f5f9; }
  .modal-body { padding: 16px; }
  .modal-body.p-0 { padding: 0; }
  
  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .module-header { flex-direction: column; align-items: stretch; }
    .module-actions { justify-content: space-between; }
    .status-tabs { overflow-x: auto; flex-wrap: nowrap; }
    .status-tab { white-space: nowrap; }
    .cards-grid { grid-template-columns: 1fr; }
    .call-actions { flex-direction: column; }
    .desc-cell { max-width: 120px; }
    .interventions-table th, .interventions-table td { padding: 10px; }
  }
`}</style>
    </div>
  );
};

export default InterventionsModule;
