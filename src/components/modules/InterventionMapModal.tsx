// InterventionMapModal.tsx - WITH NAVIGATION AND INFO TABS

import React, { useEffect, useRef, useState } from "react";
import { Map, View } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { OSM, Vector as VectorSource } from "ol/source";
import { Point, LineString } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Style, Icon, Text, Fill, Stroke } from "ol/style";
import { io, Socket } from "socket.io-client";
import type { Intervention } from "../../context/DataContext";

interface InterventionMapModalProps {
  intervention: Intervention;
  onClose: () => void;
}

const API_BASE_URL = "http://192.168.1.5:5000/api";
const SOCKET_URL = "http://192.168.1.5:5000";

const InterventionMapModal: React.FC<InterventionMapModalProps> = ({
  intervention,
  onClose,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [ambulanceLocation, setAmbulanceLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(
    null,
  );
  const [eta, setEta] = useState<{ minutes: number; km: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"navigation" | "info">(
    "navigation",
  );

  const interventionLat = intervention.latitude_depart || intervention.latitude;
  const interventionLng =
    intervention.longitude_depart || intervention.longitude;

  const isActive =
    intervention.statut === "en route" || intervention.statut === "en attente";

  // ─── 1. Init map once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source: vectorSource }),
      ],
      view: new View({
        center: fromLonLat([interventionLng, interventionLat]),
        zoom: 14,
      }),
    });

    mapInstanceRef.current = map;
    setTimeout(() => map.updateSize(), 100);

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, []);

  // ─── 2. Fetch initial route and ambulance info ───────────────────────────────
  const fetchInitialData = async () => {
    if (!intervention.ambulance_id) return;
    const token = localStorage.getItem("token");
    setLoading(true);

    try {
      // Get ambulance initial position
      const ambulanceRes = await fetch(
        `${API_BASE_URL}/ambulances/${intervention.ambulance_id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const ambulanceData = await ambulanceRes.json();

      if (ambulanceData.success && ambulanceData.data) {
        setAmbulanceLocation({
          lat: ambulanceData.data.latitude,
          lng: ambulanceData.data.longitude,
        });
      }

      // Get route (only if en route)
      if (intervention.statut === "en route") {
        const routeRes = await fetch(
          `${API_BASE_URL}/mobile/driver/route/${intervention.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const routeData = await routeRes.json();

        if (routeData.success && routeData.data?.route) {
          const sortedSegments = [...routeData.data.route].sort(
            (a, b) => a.seq - b.seq,
          );
          const allCoords: [number, number][] = [];

          for (let i = 0; i < sortedSegments.length; i++) {
            const segment = sortedSegments[i];
            if (segment.geometry) {
              try {
                const geo =
                  typeof segment.geometry === "string"
                    ? JSON.parse(segment.geometry)
                    : segment.geometry;

                if (geo?.coordinates && Array.isArray(geo.coordinates)) {
                  let coords = geo.coordinates.map(
                    ([lon, lat]: [number, number]) => [lon, lat],
                  );

                  if (allCoords.length > 0 && coords.length > 0) {
                    const lastPoint = allCoords[allCoords.length - 1];
                    const lastPointOfSegment = coords[coords.length - 1];
                    const distToLast = Math.hypot(
                      lastPoint[0] - lastPointOfSegment[0],
                      lastPoint[1] - lastPointOfSegment[1],
                    );
                    if (
                      distToLast <
                      Math.hypot(
                        lastPoint[0] - coords[0][0],
                        lastPoint[1] - coords[0][1],
                      )
                    ) {
                      coords = [...coords].reverse();
                    }
                  }
                  allCoords.push(...coords);
                }
              } catch (e) {
                console.error("Error parsing geometry:", e);
              }
            }
          }

          if (allCoords.length > 0) {
            const uniqueCoords: [number, number][] = [];
            for (let i = 0; i < allCoords.length; i++) {
              if (i === 0) {
                uniqueCoords.push(allCoords[i]);
              } else {
                const prev = allCoords[i - 1];
                const curr = allCoords[i];
                if (prev[0] !== curr[0] || prev[1] !== curr[1]) {
                  uniqueCoords.push(curr);
                }
              }
            }
            setRouteCoords(uniqueCoords);
          }
        }

        // Get ETA
        const etaRes = await fetch(
          `${API_BASE_URL}/mobile/eta/${intervention.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const etaData = await etaRes.json();

        if (etaData.success && etaData.data) {
          setEta({
            minutes: etaData.data.total_minutes,
            km: etaData.data.total_km,
          });
        }
      }
    } catch (error) {
      console.error("Error loading ambulance data:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── 3. Setup Socket.IO for real-time tracking ───────────────────────────────
  useEffect(() => {
    if (!isActive || !intervention.ambulance_id) return;

    const token = localStorage.getItem("token");
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Real-time tracking connected");
      setIsOnline(true);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Real-time tracking disconnected");
      setIsOnline(false);
    });

    // Listen for ambulance location updates
    socket.on(`ambulance:location:${intervention.ambulance_id}`, (data) => {
      console.log("📍 Real-time location update:", data);
      setAmbulanceLocation({
        lat: data.latitude,
        lng: data.longitude,
      });
      setLastUpdate(new Date());
    });

    // Also listen to general ambulance location events
    socket.on("ambulance_location", (data) => {
      if (data.ambulanceId === intervention.ambulance_id) {
        setAmbulanceLocation({
          lat: data.lat,
          lng: data.lon,
        });
        setLastUpdate(new Date());
      }
    });

    // Fetch initial data
    fetchInitialData();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [intervention.id, intervention.ambulance_id, isActive]);

  // ─── 4. Draw markers & route whenever data changes ───────────────────────────
  useEffect(() => {
    const vectorSource = vectorSourceRef.current;
    const map = mapInstanceRef.current;
    if (!vectorSource || !map) return;

    vectorSource.clear();

    // ── Intervention marker (custom SVG) ──
    const interventionFeature = new Feature({
      geometry: new Point(fromLonLat([interventionLng, interventionLat])),
    });
    interventionFeature.setStyle(
      new Style({
        image: new Icon({
          src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23dc2626'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
          anchor: [0.5, 1],
          scale: 0.8,
        }),
        text: new Text({
          text: "🆘 Urgence",
          offsetY: 25,
          font: "bold 12px Arial",
          fill: new Fill({ color: "#dc2626" }),
          stroke: new Stroke({ color: "#fff", width: 3 }),
        }),
      }),
    );
    vectorSource.addFeature(interventionFeature);

    if (isActive && ambulanceLocation) {
      // ── Ambulance marker (animated pulse) ──
      const ambulanceFeature = new Feature({
        geometry: new Point(
          fromLonLat([ambulanceLocation.lng, ambulanceLocation.lat]),
        ),
      });
      ambulanceFeature.setStyle(
        new Style({
          image: new Icon({
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232563eb'%3E%3Cpath d='M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63c-.75.51-1.37 1.18-1.82 1.96H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8z'/%3E%3C/svg%3E",
            anchor: [0.5, 1],
            scale: 0.8,
          }),
          text: new Text({
            text: `🚑 ${intervention.ambulance_immatriculation || "Ambulance"}`,
            offsetY: 25,
            font: "bold 12px Arial",
            fill: new Fill({ color: "#1d4ed8" }),
            stroke: new Stroke({ color: "#fff", width: 3 }),
          }),
        }),
      );
      vectorSource.addFeature(ambulanceFeature);

      // ── Route line with gradient effect ──
      if (routeCoords && routeCoords.length > 1) {
        const routeFeature = new Feature({
          geometry: new LineString(
            routeCoords.map(([lon, lat]) => fromLonLat([lon, lat])),
          ),
        });
        routeFeature.setStyle(
          new Style({
            stroke: new Stroke({
              color: "#2563eb",
              width: 5,
              lineDash: [10, 5],
            }),
          }),
        );
        vectorSource.addFeature(routeFeature);

        // Add shadow route for better visibility
        const shadowFeature = new Feature({
          geometry: new LineString(
            routeCoords.map(([lon, lat]) => fromLonLat([lon, lat])),
          ),
        });
        shadowFeature.setStyle(
          new Style({
            stroke: new Stroke({
              color: "rgba(37,99,235,0.2)",
              width: 12,
            }),
          }),
        );
        vectorSource.addFeature(shadowFeature);

        // Fit view to show entire route
        const extent = routeFeature.getGeometry()!.getExtent();
        map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 16 });
      } else {
        // Fit view to show both points
        const allPoints = [
          fromLonLat([interventionLng, interventionLat]),
          fromLonLat([ambulanceLocation.lng, ambulanceLocation.lat]),
        ];
        const xs = allPoints.map((p) => p[0]);
        const ys = allPoints.map((p) => p[1]);
        map
          .getView()
          .fit(
            [
              Math.min(...xs),
              Math.min(...ys),
              Math.max(...xs),
              Math.max(...ys),
            ],
            { padding: [60, 60, 60, 60], maxZoom: 16 },
          );
      }
    } else if (!isActive) {
      map.getView().setCenter(fromLonLat([interventionLng, interventionLat]));
      map.getView().setZoom(15);
    }
  }, [
    interventionLng,
    interventionLat,
    ambulanceLocation,
    routeCoords,
    isActive,
  ]);

  // Format last update time
  const getLastUpdateText = () => {
    const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (seconds < 5) return "À l'instant";
    if (seconds < 60) return `Il y a ${seconds} secondes`;
    return `Il y a ${Math.floor(seconds / 60)} minutes`;
  };

  return (
    <div className="intervention-map-modal">
      {/* Tab Buttons */}
      <div className="modal-tabs">
        <button
          className={`modal-tab ${activeTab === "navigation" ? "active" : ""}`}
          onClick={() => setActiveTab("navigation")}
        >
          <span className="tab-icon">🗺️</span>
          <span className="tab-label">Navigation</span>
        </button>
        <button
          className={`modal-tab ${activeTab === "info" ? "active" : ""}`}
          onClick={() => setActiveTab("info")}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">Information</span>
        </button>
        <button className="modal-tab close-btn" onClick={onClose}>
          <span className="tab-icon">✕</span>
          <span className="tab-label">Fermer</span>
        </button>
      </div>

      {/* Navigation Tab - Full Map */}
      <div
        className={`tab-content ${activeTab === "navigation" ? "active" : ""}`}
      >
        <div ref={mapRef} className="map-container-full" />
      </div>

      {/* Info Tab - All Information */}
      <div className={`tab-content ${activeTab === "info" ? "active" : ""}`}>
        <div className="map-info">
          <div className="map-info-header">
            <h3>{intervention.type}</h3>
            <div
              className={`status-badge status-${intervention.statut?.replace(" ", "-")}`}
            >
              {intervention.statut === "en route" && "🚑 En route"}
              {intervention.statut === "en attente" && "⏳ En attente"}
              {intervention.statut === "terminée" && "✅ Terminée"}
              {intervention.statut === "annulée" && "❌ Annulée"}
            </div>
          </div>

          <p className="description">{intervention.description}</p>

          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">📍 Intervention</span>
              <span className="info-value">
                {interventionLat?.toFixed(6)}, {interventionLng?.toFixed(6)}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">📞 Appelant</span>
              <span className="info-value">{intervention.caller_name}</span>
            </div>
          </div>

          {isActive && intervention.ambulance_id && (
            <div className="ambulance-info">
              <div className="ambulance-header">
                <span className="ambulance-icon">🚑</span>
                <span className="ambulance-title">
                  {intervention.ambulance_immatriculation ||
                    `Ambulance #${intervention.ambulance_id}`}
                </span>
                {isOnline && <span className="online-dot" />}
              </div>

              {ambulanceLocation ? (
                <>
                  <div className="info-item">
                    <span className="info-label">📍 Position</span>
                    <span className="info-value">
                      {ambulanceLocation.lat.toFixed(6)},{" "}
                      {ambulanceLocation.lng.toFixed(6)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">🕐 Dernière mise à jour</span>
                    <span className="info-value">{getLastUpdateText()}</span>
                  </div>
                </>
              ) : (
                <p className="loading-text">
                  {loading ? "⏳ Chargement..." : "📍 Position non disponible"}
                </p>
              )}

              {eta && (
                <div className="eta-box">
                  <div className="eta-item">
                    <span className="eta-label">⏱️ ETA</span>
                    <span className="eta-value">
                      {Math.round(eta.minutes)} min
                    </span>
                  </div>
                  <div className="eta-item">
                    <span className="eta-label">📏 Distance</span>
                    <span className="eta-value">{eta.km.toFixed(1)} km</span>
                  </div>
                </div>
              )}

              {routeCoords && routeCoords.length > 0 && (
                <p className="route-info">
                  🗺️ Itinéraire chargé ({routeCoords.length} points)
                </p>
              )}

              <p className="refresh-note">
                {isOnline ? (
                  <span className="online-text">
                    🟢 Mise à jour en temps réel
                  </span>
                ) : (
                  <span className="offline-text">
                    🔴 Mise à jour en temps réel (reconnexion...)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .intervention-map-modal { 
          width: 100%; 
          background: white; 
          border-radius: 16px; 
          overflow: hidden;
          box-shadow: 0 20px 35px -8px rgba(0,0,0,0.2);
        }
        
        /* Tabs */
        .modal-tabs {
          display: flex;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 0;
        }
        
        .modal-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          transition: all 0.2s ease;
          position: relative;
        }
        
        .modal-tab:hover {
          background: #f1f5f9;
          color: #1e293b;
        }
        
        .modal-tab.active {
          color: #7c3aed;
          background: white;
        }
        
        .modal-tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #7c3aed;
          border-radius: 3px 3px 0 0;
        }
        
        .close-btn {
          flex: 0.3;
          background: #fee2e2;
          color: #dc2626;
        }
        
        .close-btn:hover {
          background: #fecaca;
          color: #b91c1c;
        }
        
        .tab-icon {
          font-size: 16px;
        }
        
        .tab-label {
          font-size: 13px;
          font-weight: 600;
        }
        
        /* Tab Content */
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        /* Map Container */
        .map-container-full {
          width: 100%;
          height: 550px;
        }
        
        /* Info Panel */
        .map-info { 
          padding: 24px; 
          background: white;
          max-height: 550px;
          overflow-y: auto;
        }
        
        .map-info-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 16px; 
          flex-wrap: wrap;
          gap: 12px;
        }
        
        .map-info h3 { 
          margin: 0; 
          font-size: 22px; 
          font-weight: 700; 
          color: #1e293b; 
        }
        
        .description { 
          font-size: 14px; 
          color: #475569; 
          margin-bottom: 20px; 
          line-height: 1.5; 
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .info-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 16px; 
          margin-bottom: 20px; 
        }
        
        .info-item { 
          display: flex; 
          flex-direction: column; 
          gap: 6px; 
        }
        
        .info-label { 
          font-size: 11px; 
          font-weight: 600; 
          color: #64748b; 
          text-transform: uppercase; 
          letter-spacing: 0.5px; 
        }
        
        .info-value { 
          font-size: 14px; 
          font-weight: 600; 
          color: #1e293b; 
          font-family: monospace; 
          background: #f8fafc;
          padding: 6px 10px;
          border-radius: 8px;
        }
        
        .ambulance-info { 
          margin-top: 20px; 
          padding: 20px; 
          background: #e0f2fe; 
          border-radius: 14px; 
          border-left: 4px solid #2563eb; 
        }
        
        .ambulance-header { 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          margin-bottom: 16px; 
        }
        
        .ambulance-icon { 
          font-size: 24px; 
        }
        
        .ambulance-title { 
          font-size: 18px; 
          font-weight: 700; 
          color: #1e293b; 
        }
        
        .online-dot { 
          width: 10px; 
          height: 10px; 
          background: #10b981; 
          border-radius: 50%; 
          animation: pulse 1.5s infinite; 
        }
        
        .eta-box { 
          display: flex; 
          gap: 20px; 
          margin-top: 16px; 
          padding: 16px; 
          background: white; 
          border-radius: 12px; 
        }
        
        .eta-item { 
          flex: 1; 
          text-align: center; 
        }
        
        .eta-label { 
          font-size: 11px; 
          font-weight: 600; 
          color: #64748b; 
          text-transform: uppercase; 
          display: block; 
          margin-bottom: 4px;
        }
        
        .eta-value { 
          font-size: 22px; 
          font-weight: 700; 
          color: #1d4ed8; 
        }
        
        .route-info { 
          font-size: 12px; 
          color: #2563eb; 
          margin-top: 12px; 
          font-weight: 500; 
          text-align: center;
        }
        
        .refresh-note { 
          margin-top: 12px; 
          text-align: center;
        }
        
        .online-text { 
          font-size: 11px; 
          color: #10b981; 
          font-weight: 500; 
        }
        
        .offline-text { 
          font-size: 11px; 
          color: #ef4444; 
          font-weight: 500; 
        }
        
        .loading-text { 
          font-size: 13px; 
          color: #94a3b8; 
          font-style: italic; 
          text-align: center;
          padding: 12px;
        }
        
        .status-badge { 
          display: inline-flex; 
          align-items: center; 
          gap: 6px; 
          padding: 6px 14px; 
          border-radius: 30px; 
          font-size: 12px; 
          font-weight: 600; 
        }
        
        .status-en-route   { background: #fed7aa; color: #9a3412; }
        .status-en-attente { background: #fef3c7; color: #92400e; }
        .status-terminée   { background: #dcfce7; color: #166534; }
        .status-annulée    { background: #fee2e2; color: #991b1b; }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        
        .ol-zoom { position: absolute; top: 12px; left: 12px; }
        .ol-attribution { font-size: 10px; }
        
        /* Scrollbar */
        .map-info::-webkit-scrollbar {
          width: 6px;
        }
        
        .map-info::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        
        .map-info::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        
        .map-info::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default InterventionMapModal;
