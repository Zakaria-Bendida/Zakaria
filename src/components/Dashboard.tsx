import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chart, registerables } from "chart.js";
import { useData } from "../context/DataContext";
import {
  Ambulance,
  Building2,
  MapPin,
  AlertTriangle,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
} from "lucide-react";

Chart.register(...registerables);

const Dashboard: React.FC = () => {
  const {
    ambulances,
    parkings,
    hopitaux,
    interventions,
    personnels,
    isLoading,
    error,
  } = useData();
  const interventionChartRef = useRef<HTMLCanvasElement>(null);
  const parkingChartRef = useRef<HTMLCanvasElement>(null);
  const interventionChartInstance = useRef<Chart | null>(null);
  const parkingChartInstance = useRef<Chart | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mettre à jour l'heure toutes les secondes
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate statistics with useMemo to prevent unnecessary recalculation
  const stats = useMemo(
    () => ({
      ambulances: {
        total: ambulances.length,
        disponibles: ambulances.filter((a) => a.statut === "Disponible").length,
        enMission: ambulances.filter((a) => a.statut === "En mission").length,
        horsService: ambulances.filter(
          (a) => a.statut === "Maintenance" || a.statut === "En panne",
        ).length,
      },
      interventions: {
        total: interventions.length,
        enCours: interventions.filter(
          (i) => i.statut === "en route" || i.statut === "en cours",
        ).length,
        terminees: interventions.filter((i) => i.statut === "terminée").length,
        enAttente: interventions.filter((i) => i.statut === "en attente")
          .length,
        aujourdhui: interventions.filter((i) => {
          const dateField = i.date_intervention || i.created_at;
          if (!dateField) return false;
          const today = new Date().toDateString();
          return new Date(dateField).toDateString() === today;
        }).length,
      },
      personnels: {
        total: personnels.length,
        managers: personnels.filter((p) => p.role === "manager").length,
        drivers: personnels.filter((p) => p.role === "ambulancier").length,
      },
      parkings: {
        total: parkings.length,
        capaciteTotal: parkings.reduce((acc, p) => acc + (p.capacite || 0), 0),
        occupation: ambulances.filter((a) => a.parking_id).length,
      },
      hopitaux: {
        total: hopitaux.length,
        geolocalises: hopitaux.filter((h) => h.latitude && h.longitude).length,
      },
    }),
    [ambulances, interventions, parkings, hopitaux, personnels],
  );

  const occupationRate =
    stats.parkings.capaciteTotal > 0
      ? Math.round(
          (stats.parkings.occupation / stats.parkings.capaciteTotal) * 100,
        )
      : 0;

  // Initialize charts only once and update when data changes
  useEffect(() => {
    // Cleanup function to destroy charts
    const cleanup = () => {
      if (interventionChartInstance.current) {
        interventionChartInstance.current.destroy();
        interventionChartInstance.current = null;
      }
      if (parkingChartInstance.current) {
        parkingChartInstance.current.destroy();
        parkingChartInstance.current = null;
      }
    };

    // Create or update Interventions Chart
    if (interventionChartRef.current) {
      if (interventionChartInstance.current) {
        // Update existing chart data
        interventionChartInstance.current.data.datasets[0].data = [
          stats.interventions.enAttente,
          stats.interventions.enCours,
          stats.interventions.terminees,
        ];
        interventionChartInstance.current.update();
      } else {
        // Create new chart
        interventionChartInstance.current = new Chart(
          interventionChartRef.current,
          {
            type: "doughnut",
            data: {
              labels: ["En attente", "En cours", "Terminées"],
              datasets: [
                {
                  data: [
                    stats.interventions.enAttente,
                    stats.interventions.enCours,
                    stats.interventions.terminees,
                  ],
                  backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
                  borderWidth: 0,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "bottom" } },
              animation: { duration: 500 },
            },
          },
        );
      }
    }

    // Create or update Parking Chart
    if (parkingChartRef.current && parkings.length > 0) {
      const parkingData = parkings.map((p) => ({
        nom: p.nom,
        occupation: ambulances.filter((a) => a.parking_id === p.id).length,
        capacite: p.capacite,
      }));

      if (parkingChartInstance.current) {
        // Update existing chart data
        parkingChartInstance.current.data.labels = parkingData.map(
          (p) => p.nom,
        );
        parkingChartInstance.current.data.datasets[0].data = parkingData.map(
          (p) => p.occupation,
        );
        parkingChartInstance.current.data.datasets[1].data = parkingData.map(
          (p) => p.capacite - p.occupation,
        );
        parkingChartInstance.current.update();
      } else {
        // Create new chart
        parkingChartInstance.current = new Chart(parkingChartRef.current, {
          type: "bar",
          data: {
            labels: parkingData.map((p) => p.nom),
            datasets: [
              {
                label: "Ambulances stationnées",
                data: parkingData.map((p) => p.occupation),
                backgroundColor: "#3b82f6",
                borderRadius: 8,
              },
              {
                label: "Places disponibles",
                data: parkingData.map((p) => p.capacite - p.occupation),
                backgroundColor: "#10b981",
                borderRadius: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "top" } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 },
                title: { display: true, text: "Nombre de places" },
              },
            },
            animation: { duration: 500 },
          },
        });
      }
    }

    return cleanup;
  }, [
    stats.interventions,
    stats.interventions.enAttente,
    stats.interventions.enCours,
    stats.interventions.terminees,
    ambulances,
    parkings,
  ]);

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Chargement des données...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <AlertCircle size={48} />
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Tableau de Bord</h1>
          <p className="subtitle">Vue d'ensemble temps réel • Sidi Bel Abbès</p>
        </div>
        <div className="header-time">
          <Clock size={16} />
          <span>{currentTime.toLocaleString("fr-FR")}</span>
        </div>
      </div>

      {/* Main Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-ambulances">
          <div className="stat-icon">
            <Ambulance size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.ambulances.total}</div>
            <div className="stat-label">Ambulances</div>
            <div className="stat-detail">
              <span className="available">
                {stats.ambulances.disponibles} disponibles
              </span>
              <span className="mission">
                {stats.ambulances.enMission} en mission
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-interventions">
          <div className="stat-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.interventions.total}</div>
            <div className="stat-label">Interventions</div>
            <div className="stat-detail">
              <span className="pending">
                {stats.interventions.enAttente} en attente
              </span>
              <span className="today">
                {stats.interventions.aujourdhui} aujourd'hui
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-personnels">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.personnels.total}</div>
            <div className="stat-label">Personnels</div>
            <div className="stat-detail">
              <span className="managers">
                {stats.personnels.managers} administrateurs
              </span>
              <span className="drivers">
                {stats.personnels.drivers} chauffeurs
              </span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-hopitaux">
          <div className="stat-icon">
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.hopitaux.total}</div>
            <div className="stat-label">Hôpitaux</div>
            <div className="stat-detail">
              <span className="geolocated">
                {stats.hopitaux.geolocalises} géolocalisés
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Status Section */}
      <div className="details-grid">
        {/* Ambulance Status */}
        <div className="detail-card">
          <h3>
            <Ambulance size={18} /> État des Ambulances
          </h3>
          <div className="status-list">
            <div className="status-item">
              <CheckCircle size={16} className="status-icon available" />
              <span className="status-label">Disponibles</span>
              <span className="status-value">
                {stats.ambulances.disponibles}
              </span>
            </div>
            <div className="status-item">
              <Clock size={16} className="status-icon mission" />
              <span className="status-label">En mission</span>
              <span className="status-value">{stats.ambulances.enMission}</span>
            </div>
            <div className="status-item">
              <AlertCircle size={16} className="status-icon broken" />
              <span className="status-label">Hors service</span>
              <span className="status-value">
                {stats.ambulances.horsService}
              </span>
            </div>
          </div>
        </div>

        {/* Parking Occupation */}
        <div className="detail-card">
          <h3>
            <MapPin size={18} /> Occupation des Parkings
          </h3>
          <div className="parking-stats">
            <div className="parking-numbers">
              <span className="occupied">{stats.parkings.occupation}</span>
              <span className="separator">/</span>
              <span className="total">{stats.parkings.capaciteTotal}</span>
              <span className="label">places</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${occupationRate}%` }}
              />
            </div>
            <div className="occupation-rate">
              {occupationRate}% d'occupation
            </div>
          </div>
        </div>

        {/* Recent Interventions */}
        <div className="detail-card">
          <h3>
            <Activity size={18} /> Dernières Interventions
          </h3>
          <div className="interventions-list">
            {interventions.slice(0, 5).map((intervention) => (
              <div className="intervention-item" key={intervention.id}>
                <div className="intervention-type">{intervention.type}</div>
                <div className="intervention-meta">
                  <span className="intervention-time">
                    {intervention.created_at &&
                      new Date(intervention.created_at).toLocaleTimeString(
                        "fr-FR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                  </span>
                  <span
                    className={`intervention-status status-${intervention.statut?.replace(" ", "-")}`}
                  >
                    {intervention.statut === "en route"
                      ? "En cours"
                      : intervention.statut === "terminée"
                        ? "Terminée"
                        : intervention.statut === "en attente"
                          ? "En attente"
                          : intervention.statut}
                  </span>
                </div>
              </div>
            ))}
            {interventions.length === 0 && (
              <p className="no-data">Aucune intervention</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Répartition des Interventions</h3>
          <div className="chart-container">
            <canvas ref={interventionChartRef} style={{ maxHeight: "250px" }} />
          </div>
          <div className="chart-legend">
            <span>
              <span className="legend-color pending"></span>En attente (
              {stats.interventions.enAttente})
            </span>
            <span>
              <span className="legend-color active"></span>En cours (
              {stats.interventions.enCours})
            </span>
            <span>
              <span className="legend-color completed"></span>Terminées (
              {stats.interventions.terminees})
            </span>
          </div>
        </div>

        <div className="chart-card">
          <h3>Occupation des Parkings</h3>
          <div className="chart-container">
            <canvas ref={parkingChartRef} style={{ maxHeight: "250px" }} />
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="system-info">
        <Activity size={14} />
        <span>Mise à jour automatique toutes les 30 secondes</span>
        <span className="separator">•</span>
        <span>{ambulances.length} ambulances</span>
        <span className="separator">•</span>
        <span>{interventions.length} interventions</span>
      </div>

      <style>{`
        .dashboard {
          padding: 20px;
          background: #f5f7fa;
          min-height: 100vh;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .dashboard-header h1 {
          font-size: 24px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 4px 0;
        }

        .subtitle {
          color: #64748b;
          font-size: 14px;
          margin: 0;
        }

        .header-time {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: white;
          border-radius: 8px;
          font-size: 14px;
          color: #475569;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.2s;
        }

        .stat-card:hover { transform: translateY(-2px); }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-ambulances .stat-icon { background: #dbeafe; color: #2563eb; }
        .stat-interventions .stat-icon { background: #fee2e2; color: #dc2626; }
        .stat-personnels .stat-icon { background: #dcfce7; color: #16a34a; }
        .stat-hopitaux .stat-icon { background: #f3e8ff; color: #9333ea; }

        .stat-content { flex: 1; }
        .stat-value { font-size: 28px; font-weight: 700; color: #1e293b; }
        .stat-label { font-size: 14px; color: #64748b; margin-top: 2px; }

        .stat-detail {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 6px;
          display: flex;
          gap: 12px;
        }

        .stat-detail .available { color: #10b981; }
        .stat-detail .mission { color: #f59e0b; }
        .stat-detail .pending { color: #ef4444; }
        .stat-detail .today { color: #3b82f6; }
        .stat-detail .geolocated { color: #10b981; }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .detail-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .detail-card h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
          padding-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .status-list { display: flex; flex-direction: column; gap: 12px; }
        .status-item { display: flex; align-items: center; gap: 12px; }
        .status-icon.available { color: #10b981; }
        .status-icon.mission { color: #f59e0b; }
        .status-icon.broken { color: #ef4444; }
        .status-label { flex: 1; font-size: 14px; color: #475569; }
        .status-value { font-size: 18px; font-weight: 600; color: #1e293b; }

        .parking-stats { text-align: center; }
        .parking-numbers { font-size: 36px; font-weight: 700; margin-bottom: 12px; }
        .parking-numbers .occupied { color: #3b82f6; }
        .parking-numbers .total { color: #94a3b8; }
        .parking-numbers .label { font-size: 14px; font-weight: 400; color: #64748b; }

        .progress-bar {
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
          margin: 12px 0;
        }

        .progress-fill {
          height: 100%;
          background: #3b82f6;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .occupation-rate { font-size: 14px; font-weight: 500; color: #3b82f6; }

        .interventions-list { display: flex; flex-direction: column; gap: 12px; }
        .intervention-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .intervention-type { font-weight: 500; color: #1e293b; font-size: 14px; }
        .intervention-meta { display: flex; gap: 12px; align-items: center; }
        .intervention-time { font-size: 12px; color: #94a3b8; }

        .intervention-status {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .intervention-status.status-en-attente { background: #fee2e2; color: #dc2626; }
        .intervention-status.status-en-route { background: #fed7aa; color: #ea580c; }
        .intervention-status.status-terminée { background: #dcfce7; color: #16a34a; }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }

        .chart-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .chart-card h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0 0 16px 0; }
        .chart-container { height: 250px; }

        .chart-legend {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 16px;
          font-size: 12px;
        }

        .legend-color {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 3px;
          margin-right: 6px;
        }

        .legend-color.pending { background: #ef4444; }
        .legend-color.active { background: #f59e0b; }
        .legend-color.completed { background: #10b981; }

        .system-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          color: #64748b;
        }

        .system-info .separator { color: #cbd5e1; }
        .no-data { text-align: center; color: #94a3b8; padding: 20px; }

        .dashboard-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 16px;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .dashboard-error {
          text-align: center;
          padding: 60px;
          color: #ef4444;
        }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .details-grid { grid-template-columns: 1fr; }
          .charts-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
          .dashboard-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
