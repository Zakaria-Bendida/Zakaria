import React, { useEffect, useRef, useState } from "react";
import { Map, View } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { OSM, Vector as VectorSource } from "ol/source";
import { Point, LineString } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Style, Icon, Text, Fill, Stroke } from "ol/style";
import { useData } from "../../context/DataContext";
import {
  MapPin,
  Car,
  User,
  Navigation,
  Phone,
  X,
  Wifi,
  WifiOff,
  Users,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

interface AmbulanceDetailsModalProps {
  ambulance: any;
  onClose: () => void;
}

const AmbulanceDetailsModal: React.FC<AmbulanceDetailsModalProps> = ({
  ambulance,
  onClose,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { personnels, interventions, refreshData } = useData();

  // Real-time WebSocket listener for driver status updates
  useEffect(() => {
    const socket = io("http://192.168.1.5:5000", {
      transports: ["websocket"],
    });

    socket.on("driver:status", (data) => {
      console.log("🔄 Real-time driver status update:", data);
      if (data.ambulanceId === ambulance.id) {
        refreshData();
        setLastUpdate(new Date());
      }
    });

    socket.on("mission:started", (data) => {
      if (data.ambulanceId === ambulance.id || data.interventionId) {
        refreshData();
        setLastUpdate(new Date());
      }
    });

    socket.on("mission:completed", (data) => {
      if (data.ambulanceId === ambulance.id || data.interventionId) {
        refreshData();
        setLastUpdate(new Date());
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ambulance.id, refreshData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
      setLastUpdate(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshData]);

  // Find ALL drivers assigned to this ambulance
  const assignedDrivers = personnels.filter(
    (p) => p.ambulanceId === ambulance.id && p.role === "ambulancier",
  );

  // Find online drivers
  const onlineDrivers = assignedDrivers.filter((d) => d.isOnline === true);
  const offlineDrivers = assignedDrivers.filter((d) => d.isOnline !== true);

  // DEBUG: Log online drivers before sorting
  console.log(
    "📊 Online drivers before sort:",
    onlineDrivers.map((d) => ({
      name: d.fullName || d.nom,
      lastOnline: d.lastOnline,
      lastOnlineStr: d.lastOnline
        ? new Date(d.lastOnline).toLocaleString()
        : "no date",
    })),
  );

  // Sort online drivers - MOST RECENT FIRST (newest lastOnline at top)
  const sortedOnlineDrivers = [...onlineDrivers].sort((a, b) => {
    const dateA = a.lastOnline
      ? new Date(a.lastOnline).getTime()
      : a.updatedAt
        ? new Date(a.updatedAt).getTime()
        : 0;
    const dateB = b.lastOnline
      ? new Date(b.lastOnline).getTime()
      : b.updatedAt
        ? new Date(b.updatedAt).getTime()
        : 0;
    console.log(
      `📊 Comparing: ${a.fullName || a.nom} (${dateA}) vs ${b.fullName || b.nom} (${dateB}) -> ${dateB - dateA}`,
    );
    return dateB - dateA; // Descending = newest first
  });

  // Log sorted results
  console.log(
    "📊 Sorted online drivers:",
    sortedOnlineDrivers.map((d) => ({
      name: d.fullName || d.nom,
      lastOnline: d.lastOnline
        ? new Date(d.lastOnline).toLocaleString()
        : "no date",
    })),
  );

  // Primary driver = most recent online
  const primaryDriver = sortedOnlineDrivers[0];
  const otherOnlineDrivers = sortedOnlineDrivers.slice(1);

  // Find current intervention assigned to this ambulance
  const currentIntervention = interventions.find(
    (i) =>
      i.ambulance_id === ambulance.id &&
      (i.statut === "en route" || i.statut === "en cours"),
  );

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Create map instance
  useEffect(() => {
    if (!mapRef.current || !ambulance.latitude || !ambulance.longitude) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
    });

    const ambulanceMarker = new Feature({
      geometry: new Point(
        fromLonLat([ambulance.longitude, ambulance.latitude]),
      ),
      name: ambulance.immatriculation,
    });

    ambulanceMarker.setStyle(
      new Style({
        image: new Icon({
          src:
            "data:image/svg+xml;base64," +
            btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
              <path d="M9 10v1H7V9.5C7 8.1 8.1 7 9.5 7H11V5.5C11 4.7 11.7 4 12.5 4S14 4.7 14 5.5V7h1.5C16.9 7 18 8.1 18 9.5V11h-1v-1h-2v4h-2v-4H9z" fill="red"/>
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12v7c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-7l-2.08-5.99z" fill="white"/>
            </svg>
          `),
          scale: 0.8,
        }),
        text: new Text({
          offsetY: 30,
          text: ambulance.immatriculation,
          font: "bold 14px Arial",
          fill: new Fill({ color: "#000" }),
          stroke: new Stroke({ color: "#fff", width: 3 }),
        }),
      }),
    );

    const vectorSource = new VectorSource({
      features: [ambulanceMarker],
    });

    if (
      currentIntervention &&
      currentIntervention.latitude_depart &&
      currentIntervention.longitude_depart
    ) {
      const interventionMarker = new Feature({
        geometry: new Point(
          fromLonLat([
            currentIntervention.longitude_depart,
            currentIntervention.latitude_depart,
          ]),
        ),
        name: currentIntervention.type,
      });

      interventionMarker.setStyle(
        new Style({
          image: new Icon({
            src:
              "data:image/svg+xml;base64," +
              btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" fill="orange"/>
                <path d="M12 7.5L8.5 11l-1-1L6 11.5 8.5 14 12 10.5 17 15.5 18.5 14 12 7.5z" fill="white"/>
              </svg>
            `),
            scale: 0.8,
          }),
          text: new Text({
            offsetY: 25,
            text: currentIntervention.type.substring(0, 15),
            font: "12px Arial",
            fill: new Fill({ color: "#000" }),
            stroke: new Stroke({ color: "#fff", width: 3 }),
          }),
        }),
      );

      vectorSource.addFeature(interventionMarker);

      const line = new Feature({
        geometry: new LineString([
          fromLonLat([ambulance.longitude, ambulance.latitude]),
          fromLonLat([
            currentIntervention.longitude_depart,
            currentIntervention.latitude_depart,
          ]),
        ]),
      });

      line.setStyle(
        new Style({
          stroke: new Stroke({
            color: "#ff4444",
            width: 3,
            lineDash: [10, 10],
          }),
        }),
      );

      vectorSource.addFeature(line);
    }

    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });

    const mapInstance = new Map({
      target: mapRef.current,
      layers: [osmLayer, vectorLayer],
      view: new View({
        center: fromLonLat([ambulance.longitude, ambulance.latitude]),
        zoom: 14,
      }),
    });

    setMap(mapInstance);

    return () => {
      mapInstance.setTarget();
    };
  }, [ambulance, currentIntervention]);

  return (
    <div
      className="ui active dimmer page transition visible active backdrop-blur-md bg-slate-900/60"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="ui active modal rounded-2xl shadow-2xl border border-slate-100/50"
        style={{
          width: "90%",
          maxWidth: "1000px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          margin: "auto",
          top: "auto",
          left: "auto",
          bottom: "auto",
          right: "auto",
          transform: "none",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        <i
          className="close icon absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer transition-all duration-200 p-2 hover:bg-slate-100 rounded-full"
          style={{
            margin: 0,
            padding: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backgroundColor: "white",
            borderRadius: "50%",
          }}
          onClick={onClose}
        ></i>

        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Car size={28} />
              <div>
                <h2 className="text-xl font-bold">
                  {ambulance.immatriculation}
                </h2>
                <p className="text-sm opacity-90">
                  {ambulance.type} - {ambulance.statut}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs opacity-75">Dernière mise à jour</div>
                <div className="text-sm font-medium">
                  {lastUpdate.toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
                title="Actualiser"
              >
                <RefreshCw
                  size={18}
                  className={`text-white ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="content p-0 overflow-auto">
          <div className="ui grid" style={{ margin: 0 }}>
            {/* Left Column - Info */}
            <div
              className="five wide column"
              style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRight: "1px solid #e2e8f0",
              }}
            >
              <h4 className="ui header">Informations générales</h4>
              <div className="ui list">
                <div className="item" style={{ padding: "0.5rem 0" }}>
                  <strong>Immatriculation:</strong> {ambulance.immatriculation}
                </div>
                <div className="item" style={{ padding: "0.5rem 0" }}>
                  <strong>Type:</strong> {ambulance.type}
                </div>
                <div className="item" style={{ padding: "0.5rem 0" }}>
                  <strong>Statut:</strong>
                  <span
                    className={`ui mini ${ambulance.statut === "Disponible" ? "green" : "orange"} label`}
                    style={{ marginLeft: "0.5rem" }}
                  >
                    {ambulance.statut}
                  </span>
                </div>
                <div className="item" style={{ padding: "0.5rem 0" }}>
                  <strong>Kilométrage:</strong>{" "}
                  {ambulance.kilometrage?.toLocaleString()} km
                </div>
                <div className="item" style={{ padding: "0.5rem 0" }}>
                  <strong>Position:</strong>
                  <br />
                  <span className="ui tiny grey label">
                    📍 {ambulance.latitude?.toFixed(6)},{" "}
                    {ambulance.longitude?.toFixed(6)}
                  </span>
                </div>
              </div>

              <div className="ui divider"></div>

              {/* Multiple Drivers Section with Auto-Logout */}
              <h4 className="ui header">
                <Users size={16} className="mr-2" />
                Chauffeurs assignés ({assignedDrivers.length})
              </h4>

              {assignedDrivers.length > 0 ? (
                <div className="drivers-container">
                  {/* Warning when multiple drivers online */}
                  {sortedOnlineDrivers.length > 1 && (
                    <div
                      className="ui warning message"
                      style={{
                        marginBottom: "0.75rem",
                        padding: "0.5rem",
                      }}
                    >
                      <AlertTriangle size={14} className="mr-1" />
                      ⚠️ Attention: {sortedOnlineDrivers.length} chauffeurs en
                      ligne! Seul le plus récent reçoit les notifications.
                    </div>
                  )}

                  {/* Primary online driver (most recent) */}
                  {primaryDriver && (
                    <div
                      className="ui segment"
                      style={{
                        backgroundColor: "#dcfce7",
                        borderLeft: "4px solid #10b981",
                        marginBottom: "0.75rem",
                        padding: "0.75rem",
                      }}
                    >
                      <div
                        className="driver-status"
                        style={{ marginBottom: "0.5rem" }}
                      >
                        <span className="ui tiny green label">
                          <Wifi size={12} className="mr-1" />
                          🟢 En ligne - Actif{" "}
                          {sortedOnlineDrivers.length > 1
                            ? "(reçoit les notifications)"
                            : ""}
                        </span>
                        {sortedOnlineDrivers.length > 1 && (
                          <span
                            className="ui tiny blue label"
                            style={{ marginLeft: "0.5rem" }}
                          >
                            ⭐ Principal (le plus récent)
                          </span>
                        )}
                      </div>
                      <div className="driver-info">
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {primaryDriver.prenom} {primaryDriver.nom}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#166534" }}>
                          📧 {primaryDriver.email}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#166534" }}>
                          📞 {primaryDriver.telephone}
                        </div>
                        {primaryDriver.lastOnline && (
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "#166534",
                              marginTop: "0.25rem",
                            }}
                          >
                            Connecté:{" "}
                            {new Date(
                              primaryDriver.lastOnline,
                            ).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Other online drivers (standby) */}
                  {otherOnlineDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      className="ui segment"
                      style={{
                        backgroundColor: "#fef3c7",
                        opacity: 0.8,
                        marginBottom: "0.5rem",
                        padding: "0.75rem",
                      }}
                    >
                      <div
                        className="driver-status"
                        style={{ marginBottom: "0.5rem" }}
                      >
                        <span className="ui tiny orange label">
                          <Wifi size={12} className="mr-1" />
                          🟡 En ligne - Standby (ne reçoit pas les
                          notifications)
                        </span>
                      </div>
                      <div className="driver-info">
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {driver.prenom} {driver.nom}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#92400e" }}>
                          📧 {driver.email}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#92400e" }}>
                          📞 {driver.telephone}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Offline drivers */}
                  {offlineDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      className="ui segment"
                      style={{
                        backgroundColor: "#f1f5f9",
                        opacity: 0.7,
                        marginBottom: "0.5rem",
                        padding: "0.75rem",
                      }}
                    >
                      <div
                        className="driver-status"
                        style={{ marginBottom: "0.5rem" }}
                      >
                        <span className="ui tiny grey label">
                          <WifiOff size={12} className="mr-1" />⚫ Hors ligne
                        </span>
                      </div>
                      <div className="driver-info">
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {driver.prenom} {driver.nom}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                          📧 {driver.email}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#475569" }}>
                          📞 {driver.telephone}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ui warning message">
                  <p>Aucun chauffeur assigné à cette ambulance</p>
                </div>
              )}

              <div className="ui divider"></div>

              <h4 className="ui header">
                <Navigation size={16} className="mr-2" />
                Intervention en cours
              </h4>
              {currentIntervention ? (
                <div
                  className="ui segment"
                  style={{ backgroundColor: "#fff3e0" }}
                >
                  <div className="ui list">
                    <div className="item">
                      <strong>Type:</strong> {currentIntervention.type}
                    </div>
                    <div className="item">
                      <strong>Statut:</strong>
                      <span
                        className="ui mini orange label"
                        style={{ marginLeft: "0.5rem" }}
                      >
                        En cours
                      </span>
                    </div>
                    <div className="item">
                      <strong>Appelant:</strong>{" "}
                      {currentIntervention.caller_name || "Non renseigné"}
                    </div>
                    <div className="item">
                      <strong>Téléphone:</strong>{" "}
                      {currentIntervention.caller_phone || "Non renseigné"}
                    </div>
                    <div className="item">
                      <strong>Description:</strong>{" "}
                      {currentIntervention.description}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ui info message">
                  <p>Aucune intervention en cours</p>
                </div>
              )}
            </div>

            {/* Right Column - Map */}
            <div className="eleven wide column" style={{ padding: "1rem" }}>
              <h4 className="ui header">
                <MapPin size={16} className="mr-2" />
                Localisation en temps réel
              </h4>
              <div
                ref={mapRef}
                className="map-container"
                style={{
                  width: "100%",
                  height: "50vh",
                  border: "2px solid #2185d0",
                  borderRadius: "8px",
                }}
              />

              {currentIntervention && currentIntervention.latitude_depart && (
                <div className="ui info message" style={{ marginTop: "1rem" }}>
                  <div className="header">Trajet en cours</div>
                  <p>
                    🚑 Ambulance en route vers l'intervention
                    <br />
                    📍 Intervention:{" "}
                    {currentIntervention.latitude_depart.toFixed(4)},{" "}
                    {currentIntervention.longitude_depart.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbulanceDetailsModal;
