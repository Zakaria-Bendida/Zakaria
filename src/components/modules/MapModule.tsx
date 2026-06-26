// MapModule.tsx - COMPLETE FIXED VERSION
// FIX v5 (CE PATCH) :
// 1. Retrait complet de la logique "pending / approve / reject". Le vrai
//    backend (driverController.reportRoadblock) insère les obstacles
//    DIRECTEMENT en statut 'active' dès la confirmation du driver — il n'y
//    a jamais d'étape de validation manager dans ce système. Le panneau
//    affichait pourtant des boutons "Approuver"/"Refuser" et un compteur
//    "En attente" qui ne pouvaient jamais recevoir de données réelles
//    (aucun obstacle n'arrive jamais avec status='pending' depuis ce
//    backend) — code mort et trompeur, retiré.
// 2. Le manager dispose maintenant d'UNE seule action sur un obstacle actif :
//    "Dégager" (clearRoadblock). C'est la seule action qui fait disparaître
//    l'obstacle de la carte et du panneau — un changement de mission de
//    l'ambulance qui l'a signalé n'a AUCUN effet sur la visibilité de
//    l'obstacle, qui reste affiché jusqu'au dégagement explicite (le
//    backend a été corrigé en parallèle dans driverController.js pour ne
//    plus laisser un obstacle 'active' disparaître silencieusement à cause
//    de l'expiration automatique d'estimated_duration).
// 3. La carte affiche désormais les obstacles avec leur VRAIE géométrie de
//    rue (via /mobile/edges/:edgeId/center, qui renvoie aussi la geometry
//    complète) au lieu d'un simple point centroïde — cohérent avec ce que
//    voit le driver sur sa propre carte (segment de rue tracé, pas juste un
//    marqueur).
// 4. La partie "Live" (fetchLiveRoute, sélection manuelle d'une ambulance,
//    affichage du trajet identique à celui du driver) n'a PAS été modifiée
//    — elle fonctionnait déjà correctement et n'est pas concernée par ce
//    patch.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Map, View } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { OSM, Vector as VectorSource } from "ol/source";
import { Point, LineString } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Style, Icon, Text, Fill, Stroke } from "ol/style";
import { useData } from "../../context/DataContext";
import { io } from "socket.io-client";
import {
  MapPin,
  Layers,
  ZoomIn,
  ZoomOut,
  Crosshair,
  RefreshCw,
  Activity,
  Building,
  AlertTriangle,
  ChevronDown,
  X,
  EyeOff,
  Eye,
  CheckCircle,
  Trash2,
  RefreshCcw,
  Clock,
  User,
  Truck,
} from "lucide-react";

const API_BASE_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

// SVG pin icons
const makeSVGIcon = (emoji: string, bg: string, size = 36) =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 10}" viewBox="0 0 ${size} ${size + 10}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${bg}" stroke="white" stroke-width="2.5"/>
      <text x="${size / 2}" y="${size / 2 + 6}" text-anchor="middle" font-size="${size * 0.45}px">${emoji}</text>
      <polygon points="${size / 2 - 6},${size - 1} ${size / 2 + 6},${size - 1} ${size / 2},${size + 9}" fill="${bg}"/>
    </svg>
  `);

const ICONS = {
  ambulance: makeSVGIcon("🚑", "#dc2626"),
  parking: makeSVGIcon("🅿️", "#2563eb"),
  hopital: makeSVGIcon("🏥", "#059669"),
  intervention: makeSVGIcon("🆘", "#d97706"),
  enRoute: makeSVGIcon("🚨", "#ea580c"),
};

interface LiveRoute {
  route: [number, number][];
  ambulanceLocation: { lat: number; lng: number };
  destinationLocation: { lat: number; lng: number };
  eta: { minutes: number; km: number };
  ambulanceLabel: string;
  destinationType: "intervention" | "hospital";
  destinationName?: string;
}

// FIX v5: le seul statut réellement produit par le backend est 'active'
// (insertion immédiate côté reportRoadblock) puis 'cleared' une fois que le
// manager a cliqué "Dégager". 'pending'/'rejected' retirés du typage car
// ils ne correspondent à aucun flux réel.
interface Roadblock {
  id: number;
  edge_id: string;
  reason: string;
  estimated_duration: number;
  status: "active" | "cleared";
  blocked_at: string;
  expires_at: string;
  reported_by_ambulance: string;
  reported_by_driver: string;
  cleared_by_name: string;
  // Géométrie résolue côté client (mise en cache après le premier fetch de
  // /mobile/edges/:edgeId/center) pour dessiner le VRAI segment de rue.
  coords?: [number, number][];
  center?: { lat: number; lon: number } | null;
}

const MapModule: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourcesRef = useRef<{
    ambulance: VectorSource;
    parking: VectorSource;
    hopital: VectorSource;
    intervention: VectorSource;
    liveRoute: VectorSource;
    liveMarkers: VectorSource;
    roadblocks: VectorSource;
  } | null>(null);

  const [activeLayer, setActiveLayer] = useState("all");
  const [activeMapMode, setActiveMapMode] = useState<string | null>(null);
  const [hideIcons, setHideIcons] = useState(false);
  const [showRoadblockPanel, setShowRoadblockPanel] = useState(false);
  const [roadblocks, setRoadblocks] = useState<Roadblock[]>([]);
  const [loadingRoadblocks, setLoadingRoadblocks] = useState(false);
  const [refreshingRoadblocks, setRefreshingRoadblocks] = useState(false);
  const [selectedRoadblock, setSelectedRoadblock] = useState<Roadblock | null>(
    null,
  );

  const [liveAmbulanceRoute, setLiveAmbulanceRoute] =
    useState<LiveRoute | null>(null);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<number | null>(
    null,
  );
  const [showAmbulancePicker, setShowAmbulancePicker] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<any>(null);
  // FIX v5: cache des géométries de rue déjà résolues, pour ne pas refaire
  // un fetch réseau à chaque rafraîchissement (toutes les 15s) pour des
  // obstacles déjà connus.
  const edgeGeometryCacheRef = useRef<
    Record<string, { coords: [number, number][]; center: any }>
  >({});

  const { ambulances, parkings, hopitaux, interventions, refreshData } =
    useData();
  const sidiBelAbbesCenter = fromLonLat([-0.6298, 35.1919]);

  // Only active interventions (en route, en attente, transport)
  const activeInterventions = interventions.filter(
    (i) =>
      i.statut === "en route" ||
      i.statut === "en attente" ||
      i.statut === "transport" ||
      i.statut === "en_transport",
  );

  // Ambulances with active intervention
  const ambulancesEnMission = ambulances.filter((ambulance) => {
    const hasActiveIntervention = interventions.some(
      (i) =>
        i.ambulance_id === ambulance.id &&
        (i.statut === "en route" ||
          i.statut === "en attente" ||
          i.statut === "transport" ||
          i.statut === "en_transport"),
    );
    return hasActiveIntervention;
  });

  // ── Fetch roadblocks from API ────────────────────────────────────────────
  // FIX v5: le serveur (driverController.getRoadblocks corrigé) renvoie
  // maintenant tous les obstacles 'active' sans condition d'expiration —
  // ils restent dans la liste tant que le manager ne les a pas dégagés.
  const fetchRoadblocks = async () => {
    setLoadingRoadblocks(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/mobile/manager/roadblocks`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (data.success) {
        // On ne garde que active/cleared (filet de sécurité si le backend
        // renvoie encore d'anciennes lignes avec un autre statut résiduel)
        const filtered = (data.data || []).filter(
          (rb: Roadblock) => rb.status === "active" || rb.status === "cleared",
        );
        setRoadblocks(filtered);
        await drawRoadblocksOnMap(
          filtered.filter((rb: Roadblock) => rb.status === "active"),
        );
      }
    } catch (error) {
      console.error("Error fetching roadblocks:", error);
    } finally {
      setLoadingRoadblocks(false);
    }
  };

  // Refresh roadblocks manually
  const refreshRoadblocks = async () => {
    setRefreshingRoadblocks(true);
    await fetchRoadblocks();
    setRefreshingRoadblocks(false);
  };

  // ── Resolve real street geometry for an edge (with cache) ────────────────
  // FIX v5: récupère la géométrie complète du segment (pas seulement son
  // centroïde) pour dessiner le VRAI tracé de la rue bloquée, cohérent avec
  // ce que le driver voit sur sa propre carte.
  const resolveEdgeGeometry = async (
    edgeId: string,
  ): Promise<{ coords: [number, number][]; center: any }> => {
    if (edgeGeometryCacheRef.current[edgeId]) {
      return edgeGeometryCacheRef.current[edgeId];
    }
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/mobile/edges/${edgeId}/center`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      let coords: [number, number][] = [];
      let center: any = null;
      if (data.success) {
        center = data.center
          ? { lat: data.center.lat, lng: data.center.lon }
          : null;
        if (data.geometry) {
          try {
            const geo =
              typeof data.geometry === "string"
                ? JSON.parse(data.geometry)
                : data.geometry;
            if (Array.isArray(geo?.coordinates)) {
              coords = geo.coordinates as [number, number][];
            }
          } catch {
            /* ignore */
          }
        }
      }
      const resolved = { coords, center };
      edgeGeometryCacheRef.current[edgeId] = resolved;
      return resolved;
    } catch (error) {
      console.error("Error fetching edge geometry:", error);
      return { coords: [], center: null };
    }
  };

  // ── Draw active roadblocks on map with real street geometry ──────────────
  const drawRoadblocksOnMap = async (activeBlocks: Roadblock[]) => {
    const sources = vectorSourcesRef.current;
    if (!sources) return;

    sources.roadblocks.clear();

    for (const rb of activeBlocks) {
      if (!rb.edge_id) continue;

      const { coords, center } = await resolveEdgeGeometry(rb.edge_id);

      if (coords.length >= 2) {
        // Vrai segment de rue : ligne pointillée rouge + label au milieu
        const olCoords = coords.map(([lon, lat]) => fromLonLat([lon, lat]));

        const glow = new Feature({ geometry: new LineString(olCoords) });
        glow.setStyle(
          new Style({
            stroke: new Stroke({ color: "rgba(220,38,38,0.22)", width: 16 }),
          }),
        );
        sources.roadblocks.addFeature(glow);

        const line = new Feature({
          geometry: new LineString(olCoords),
          roadblockData: rb,
        });
        line.setStyle(
          new Style({
            stroke: new Stroke({
              color: "#dc2626",
              width: 6,
              lineDash: [10, 6],
            }),
          }),
        );
        sources.roadblocks.addFeature(line);

        const midIdx = Math.floor(olCoords.length / 2);
        const label = new Feature({
          geometry: new Point(olCoords[midIdx]),
          roadblockData: rb,
        });
        label.setStyle(
          new Style({
            image: new Icon({
              src: makeSVGIcon("🚧", "#dc2626", 32),
              anchor: [0.5, 1],
            }),
            text: new Text({
              text: rb.reason?.substring(0, 18) || "Obstacle",
              offsetY: 16,
              font: "bold 10px sans-serif",
              fill: new Fill({ color: "#7f1d1d" }),
              stroke: new Stroke({ color: "#fff", width: 2 }),
              backgroundFill: new Fill({ color: "rgba(255,255,255,0.85)" }),
              padding: [2, 4, 2, 4],
            }),
          }),
        );
        sources.roadblocks.addFeature(label);
      } else if (center) {
        // Fallback: pas de géométrie résolue, marqueur ponctuel au centroïde
        const feature = new Feature({
          geometry: new Point(fromLonLat([center.lng, center.lat])),
          roadblockData: rb,
        });
        feature.setStyle(
          new Style({
            image: new Icon({
              src: makeSVGIcon("🚧", "#dc2626", 34),
              anchor: [0.5, 1],
              scale: 1,
            }),
            text: new Text({
              text: rb.reason?.substring(0, 15) || "Obstacle",
              offsetY: 18,
              font: "bold 9px sans-serif",
              fill: new Fill({ color: "#1e293b" }),
              stroke: new Stroke({ color: "#fff", width: 2 }),
              backgroundFill: new Fill({ color: "rgba(255,255,255,0.8)" }),
              padding: [2, 4, 2, 4],
            }),
          }),
        );
        sources.roadblocks.addFeature(feature);
      }
    }
  };

  // ── Clear roadblock (la SEULE action manager sur un obstacle) ────────────
  // FIX v5: c'est désormais la seule façon de faire disparaître un obstacle
  // de la carte/panneau — pas de "pending" intermédiaire, pas d'effet de
  // bord lié au changement de mission de l'ambulance qui l'a signalé.
  const clearRoadblock = async (edge_id: string, roadblockId: number) => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir dégager cet obstacle ?\nRoute ID: ${edge_id}`,
      )
    ) {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${API_BASE_URL}/mobile/manager/roadblock/${edge_id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await response.json();
        if (data.success) {
          setRoadblocks((prev) => prev.filter((rb) => rb.id !== roadblockId));
          setSelectedRoadblock(null);
          await fetchRoadblocks();
          if (socketRef.current) {
            socketRef.current.emit("manager:clear_roadblock", {
              edge_id,
              managerName: "Manager",
            });
          }
        }
      } catch (error) {
        console.error("Error clearing roadblock:", error);
      }
    }
  };

  // ── Socket.IO auto-refresh ─────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    const handleRefresh = () => {
      refreshData();
      setLastRefresh(new Date());
      fetchRoadblocks();
    };

    socket.on("intervention:created", handleRefresh);
    socket.on("intervention:updated", handleRefresh);
    socket.on("intervention:completed", handleRefresh);
    socket.on("intervention:cancelled", handleRefresh);
    socket.on("ambulance:assigned", handleRefresh);
    socket.on("ambulance_assigned", handleRefresh);
    socket.on("driver:status", handleRefresh);
    socket.on("mission:started", handleRefresh);
    socket.on("mission:completed", handleRefresh);
    socket.on("driver:location", handleRefresh);
    // FIX v5: un obstacle est actif immédiatement côté serveur — on écoute
    // directement "roadblock_active" (émis par reportRoadblock) pour
    // rafraîchir la liste sans délai. "roadblock_pending"/"roadblock_rejected"
    // retirés : ils ne sont plus jamais émis par le backend réel.
    socket.on("roadblock_active", handleRefresh);
    socket.on("roadblock_cleared", handleRefresh);

    socket.emit("manager:online", {
      managerId: "manager",
      managerName: "Manager",
    });

    return () => {
      socket.emit("manager:offline");
      socket.disconnect();
    };
  }, [refreshData]);

  // Poll every 15s as safety net
  useEffect(() => {
    const poll = setInterval(() => {
      refreshData();
      setLastRefresh(new Date());
      fetchRoadblocks();
    }, 15000);
    return () => clearInterval(poll);
  }, [refreshData]);

  // Fetch roadblocks on mount
  useEffect(() => {
    fetchRoadblocks();
  }, []);

  // ── Fetch live route (supports BOTH driver and manager roles) ──────────────
  // Logique inchangée par rapport à la version fournie — elle fonctionne
  // déjà correctement selon confirmation.
  const fetchLiveRoute = useCallback(
    async (ambulanceId: number) => {
      const token = localStorage.getItem("token");
      try {
        const activeIntervention = interventions.find(
          (i) =>
            i.ambulance_id === ambulanceId &&
            (i.statut === "en route" ||
              i.statut === "en attente" ||
              i.statut === "transport" ||
              i.statut === "en_transport"),
        );

        if (!activeIntervention) {
          setLiveAmbulanceRoute(null);
          return;
        }

        const ambulance = ambulances.find((a) => a.id === ambulanceId);

        const ambulanceRes = await fetch(
          `${API_BASE_URL}/ambulances/${ambulanceId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const ambulanceData = await ambulanceRes.json();
        if (!ambulanceData.success || !ambulanceData.data) return;

        // Determine destination based on status
        let destinationLat, destinationLon;
        let destinationType: "intervention" | "hospital" = "intervention";
        let destinationName = "";

        const isTransport =
          activeIntervention.statut === "transport" ||
          activeIntervention.statut === "en_transport";

        if (isTransport) {
          destinationLat = activeIntervention.hospital_lat;
          destinationLon = activeIntervention.hospital_lon;
          destinationType = "hospital";
          destinationName = activeIntervention.hospital_name || "Hôpital";
        } else {
          destinationLat = activeIntervention.latitude_depart;
          destinationLon = activeIntervention.longitude_depart;
          destinationType = "intervention";
          destinationName = `${activeIntervention.type} - ${activeIntervention.caller_name || "Urgence"}`;
        }

        let routeCoords: [number, number][] = [];

        // ✅ Use different endpoint based on destination type
        // The backend now handles both driver and manager roles
        let endpoint;
        if (isTransport) {
          endpoint = `${API_BASE_URL}/mobile/driver/route-to-hospital/${activeIntervention.id}`;
        } else {
          endpoint = `${API_BASE_URL}/mobile/driver/route/${activeIntervention.id}`;
        }

        console.log(`📡 Fetching ${destinationType} route from: ${endpoint}`);

        const routeRes = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const routeData = await routeRes.json();
        console.log(`📡 ${destinationType} route API response:`, {
          success: routeData.success,
          hasData: !!routeData.data,
          routeLength: routeData.data?.route?.length,
          status: routeRes.status,
        });

        // Parse route geometry
        if (routeData.success && routeData.data) {
          let routeSegments = [];

          if (routeData.data.route && Array.isArray(routeData.data.route)) {
            routeSegments = routeData.data.route;
          } else if (Array.isArray(routeData.data)) {
            routeSegments = routeData.data;
          }

          if (routeSegments.length > 0) {
            const sortedSegments = [...routeSegments].sort(
              (a, b) => (a.seq || 0) - (b.seq || 0),
            );
            const allCoords: [number, number][] = [];

            for (const segment of sortedSegments) {
              if (!segment.geometry) continue;

              try {
                const geo =
                  typeof segment.geometry === "string"
                    ? JSON.parse(segment.geometry)
                    : segment.geometry;

                if (geo?.coordinates && Array.isArray(geo.coordinates)) {
                  let coords: [number, number][] = geo.coordinates.map(
                    ([lon, lat]: [number, number]) => [lon, lat],
                  );

                  if (allCoords.length > 0 && coords.length > 0) {
                    const last = allCoords[allCoords.length - 1];
                    const first = coords[0];
                    const lastOfSegment = coords[coords.length - 1];

                    const distToFirst = Math.hypot(
                      last[0] - first[0],
                      last[1] - first[1],
                    );
                    const distToLast = Math.hypot(
                      last[0] - lastOfSegment[0],
                      last[1] - lastOfSegment[1],
                    );

                    if (distToLast < distToFirst) {
                      coords = [...coords].reverse();
                    }
                  }
                  allCoords.push(...coords);
                }
              } catch (e) {
                console.error("Error parsing geometry segment:", e);
              }
            }

            // Deduplicate consecutive points
            if (allCoords.length > 0) {
              routeCoords = [allCoords[0]];
              for (let i = 1; i < allCoords.length; i++) {
                const p = allCoords[i];
                const prev = allCoords[i - 1];
                if (p[0] !== prev[0] || p[1] !== prev[1]) {
                  routeCoords.push(p);
                }
              }
            }

            console.log(
              `✅ Parsed ${routeCoords.length} route points for ${destinationType}`,
            );
          }
        }

        // If no route found, create a direct line (fallback)
        if (routeCoords.length < 2 && destinationLat && destinationLon) {
          console.log(
            `⚠️ No route found, using direct line for ${destinationType}`,
          );
          const startLon = ambulanceData.data.longitude;
          const startLat = ambulanceData.data.latitude;

          if (startLon && startLat) {
            routeCoords = [
              [startLon, startLat],
              [destinationLon, destinationLat],
            ];
            console.log(
              `✅ Created direct line from (${startLon}, ${startLat}) to (${destinationLon}, ${destinationLat})`,
            );
          }
        }

        // Get ETA
        let etaMinutes = 0;
        let etaKm = 0;

        try {
          let etaEndpoint = isTransport
            ? `${API_BASE_URL}/mobile/eta-hospital/${activeIntervention.id}`
            : `${API_BASE_URL}/mobile/eta/${activeIntervention.id}`;

          const etaRes = await fetch(etaEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (etaRes.ok) {
            const etaData = await etaRes.json();
            if (etaData.success && etaData.data) {
              etaMinutes = etaData.data.total_minutes;
              etaKm = etaData.data.total_km;
            }
          }
        } catch (err) {
          // Calculate simple distance using Haversine formula as fallback
          const R = 6371;
          const dLat =
            ((destinationLat - ambulanceData.data.latitude) * Math.PI) / 180;
          const dLon =
            ((destinationLon - ambulanceData.data.longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((ambulanceData.data.latitude * Math.PI) / 180) *
              Math.cos((destinationLat * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          etaKm = R * c;
          etaMinutes = etaKm / 0.666; // Assume 40 km/h average
        }

        setLiveAmbulanceRoute({
          route: routeCoords,
          ambulanceLocation: {
            lat: ambulanceData.data.latitude,
            lng: ambulanceData.data.longitude,
          },
          destinationLocation: {
            lat: destinationLat,
            lng: destinationLon,
          },
          eta: { minutes: etaMinutes, km: etaKm },
          ambulanceLabel: ambulance?.immatriculation || `#${ambulanceId}`,
          destinationType: destinationType,
          destinationName: destinationName,
        });
      } catch (error) {
        console.error("Erreur récupération live:", error);
      }
    },
    [interventions, ambulances],
  );

  // Live polling
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (activeMapMode === "live" && selectedAmbulanceId) {
      const activeIntervention = interventions.find(
        (i) =>
          i.ambulance_id === selectedAmbulanceId &&
          (i.statut === "en route" ||
            i.statut === "en attente" ||
            i.statut === "transport" ||
            i.statut === "en_transport"),
      );

      if (!activeIntervention) {
        alert("Cette ambulance n'a pas de mission active.");
        setActiveMapMode(null);
        setSelectedAmbulanceId(null);
        return;
      }

      setLiveLoading(true);
      fetchLiveRoute(selectedAmbulanceId).finally(() => setLiveLoading(false));
      intervalRef.current = setInterval(
        () => fetchLiveRoute(selectedAmbulanceId),
        10000,
      );
    } else if (activeMapMode !== "live") {
      setLiveAmbulanceRoute(null);
      setSelectedAmbulanceId(null);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeMapMode, selectedAmbulanceId, fetchLiveRoute, interventions]);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mkSrc = () => new VectorSource();
    const mkLayer = (src: VectorSource) => new VectorLayer({ source: src });

    const sources = {
      ambulance: mkSrc(),
      parking: mkSrc(),
      hopital: mkSrc(),
      intervention: mkSrc(),
      liveRoute: mkSrc(),
      liveMarkers: mkSrc(),
      roadblocks: mkSrc(),
    };
    vectorSourcesRef.current = sources;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        mkLayer(sources.ambulance),
        mkLayer(sources.parking),
        mkLayer(sources.hopital),
        mkLayer(sources.intervention),
        mkLayer(sources.liveRoute),
        mkLayer(sources.liveMarkers),
        mkLayer(sources.roadblocks),
      ],
      view: new View({ center: sidiBelAbbesCenter, zoom: 13 }),
    });

    // Click handler: roadblocks → ouvre le détail (avec bouton Dégager)
    map.on("click", (event) => {
      const feature = map.forEachFeatureAtPixel(
        event.pixel,
        (feature) => feature,
      );
      if (feature && feature.get("roadblockData")) {
        const rbData = feature.get("roadblockData");
        setSelectedRoadblock(rbData);
        setShowRoadblockPanel(true);
      }
    });

    mapInstanceRef.current = map;
    setTimeout(() => map.updateSize(), 100);

    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, []);

  // Draw entity markers
  useEffect(() => {
    const sources = vectorSourcesRef.current;
    if (!sources) return;

    const mkMarker = (
      lon: number,
      lat: number,
      iconSrc: string,
      label: string,
    ) => {
      const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
      f.setStyle(
        hideIcons
          ? new Style({})
          : new Style({
              image: new Icon({ src: iconSrc, anchor: [0.5, 1], scale: 1 }),
              text: new Text({
                text: label,
                offsetY: 12,
                font: "bold 11px sans-serif",
                fill: new Fill({ color: "#1e293b" }),
                stroke: new Stroke({ color: "#fff", width: 3 }),
                backgroundFill: new Fill({ color: "rgba(255,255,255,0.75)" }),
                padding: [2, 4, 2, 4],
              }),
            }),
      );
      return f;
    };

    sources.ambulance.clear();
    sources.parking.clear();
    sources.hopital.clear();
    sources.intervention.clear();

    if (activeLayer === "all" || activeLayer === "ambulances") {
      ambulances.forEach((a) => {
        if (a.latitude && a.longitude)
          sources.ambulance.addFeature(
            mkMarker(
              a.longitude,
              a.latitude,
              ICONS.ambulance,
              a.immatriculation,
            ),
          );
      });
    }
    if (activeLayer === "all" || activeLayer === "parkings") {
      parkings.forEach((p) => {
        if (p.latitude && p.longitude)
          sources.parking.addFeature(
            mkMarker(p.longitude, p.latitude, ICONS.parking, p.nom),
          );
      });
    }
    if (activeLayer === "all" || activeLayer === "hopitaux") {
      hopitaux.forEach((h) => {
        if (h.latitude && h.longitude)
          sources.hopital.addFeature(
            mkMarker(h.longitude, h.latitude, ICONS.hopital, h.nom),
          );
      });
    }
    if (activeLayer === "all" || activeLayer === "interventions") {
      activeInterventions.forEach((i) => {
        if (i.latitude_depart && i.longitude_depart) {
          const icon =
            i.statut === "en route" ? ICONS.enRoute : ICONS.intervention;
          sources.intervention.addFeature(
            mkMarker(
              i.longitude_depart,
              i.latitude_depart,
              icon,
              `${i.type} — ${i.statut === "transport" || i.statut === "en_transport" ? "Transport" : i.statut}`,
            ),
          );
        }
      });
    }
  }, [
    ambulances,
    parkings,
    hopitaux,
    activeInterventions,
    activeLayer,
    hideIcons,
  ]);

  // Draw live route with color based on destination type
  useEffect(() => {
    const sources = vectorSourcesRef.current;
    const map = mapInstanceRef.current;
    if (!sources || !map) return;

    sources.liveRoute.clear();
    sources.liveMarkers.clear();

    if (activeMapMode !== "live" || !liveAmbulanceRoute) return;

    const {
      route,
      ambulanceLocation,
      destinationLocation,
      destinationType,
      destinationName,
    } = liveAmbulanceRoute;

    // Validate route points before drawing
    if (!route || route.length < 2) {
      console.warn(
        `⚠️ Cannot draw ${destinationType} route - insufficient points: ${route?.length || 0}`,
      );
    } else {
      // Check if points are valid (not identical)
      const firstPoint = route[0];
      const lastPoint = route[route.length - 1];
      const isIdentical =
        firstPoint &&
        lastPoint &&
        firstPoint[0] === lastPoint[0] &&
        firstPoint[1] === lastPoint[1];

      if (isIdentical) {
        console.warn(`⚠️ Route points are identical - cannot draw line`);
      } else if (!firstPoint || !lastPoint) {
        console.warn(`⚠️ Invalid route points - first or last point undefined`);
      } else {
        const routeColor =
          destinationType === "hospital" ? "#7c3aed" : "#2563eb";
        const routeShadowColor =
          destinationType === "hospital"
            ? "rgba(124,58,237,0.15)"
            : "rgba(37,99,235,0.15)";

        console.log(
          `🎨 Drawing ${destinationType} route with ${route.length} points, color: ${routeColor}`,
        );
        console.log(`📍 First point: ${firstPoint[0]}, ${firstPoint[1]}`);
        console.log(`📍 Last point: ${lastPoint[0]}, ${lastPoint[1]}`);

        try {
          const olCoords = route.map(([lon, lat]) => fromLonLat([lon, lat]));

          const shadow = new Feature({ geometry: new LineString(olCoords) });
          shadow.setStyle(
            new Style({
              stroke: new Stroke({ color: routeShadowColor, width: 14 }),
            }),
          );
          sources.liveRoute.addFeature(shadow);

          const main = new Feature({ geometry: new LineString(olCoords) });
          main.setStyle(
            new Style({ stroke: new Stroke({ color: routeColor, width: 5 }) }),
          );
          sources.liveRoute.addFeature(main);

          const dash = new Feature({ geometry: new LineString(olCoords) });
          dash.setStyle(
            new Style({
              stroke: new Stroke({
                color: "rgba(255,255,255,0.7)",
                width: 2,
                lineDash: [12, 10],
              }),
            }),
          );
          sources.liveRoute.addFeature(dash);

          // Only fit bounds if we have valid geometry
          const extent = main.getGeometry()!.getExtent();
          if (
            extent &&
            !isNaN(extent[0]) &&
            !isNaN(extent[1]) &&
            !isNaN(extent[2]) &&
            !isNaN(extent[3])
          ) {
            map.getView().fit(extent, {
              padding: [60, 60, 60, 60],
              maxZoom: 16,
              duration: 800,
            });
          }
        } catch (error) {
          console.error("Error drawing route:", error);
        }
      }
    }

    // Ambulance marker (always draw)
    if (ambulanceLocation && ambulanceLocation.lat && ambulanceLocation.lng) {
      const ambF = new Feature({
        geometry: new Point(
          fromLonLat([ambulanceLocation.lng, ambulanceLocation.lat]),
        ),
      });
      ambF.setStyle(
        new Style({
          image: new Icon({
            src: ICONS.ambulance,
            anchor: [0.5, 1],
            scale: 1.2,
          }),
          text: new Text({
            text: liveAmbulanceRoute.ambulanceLabel,
            offsetY: 14,
            font: "bold 12px sans-serif",
            fill: new Fill({ color: "#dc2626" }),
            stroke: new Stroke({ color: "#fff", width: 3 }),
          }),
        }),
      );
      sources.liveMarkers.addFeature(ambF);
    }

    // Destination marker (always draw)
    if (
      destinationLocation &&
      destinationLocation.lat &&
      destinationLocation.lng
    ) {
      const destIcon =
        destinationType === "hospital" ? ICONS.hopital : ICONS.enRoute;
      const destLabel =
        destinationType === "hospital"
          ? `🏥 ${destinationName?.substring(0, 30) || "Hôpital"}`
          : `🆘 ${destinationName?.substring(0, 30) || "Urgence"}`;

      const destF = new Feature({
        geometry: new Point(
          fromLonLat([destinationLocation.lng, destinationLocation.lat]),
        ),
      });
      destF.setStyle(
        new Style({
          image: new Icon({ src: destIcon, anchor: [0.5, 1], scale: 1.2 }),
          text: new Text({
            text: destLabel,
            offsetY: 14,
            font: "bold 11px sans-serif",
            fill: new Fill({
              color: destinationType === "hospital" ? "#059669" : "#ea580c",
            }),
            stroke: new Stroke({ color: "#fff", width: 3 }),
            backgroundFill: new Fill({ color: "rgba(255,255,255,0.8)" }),
            padding: [2, 4, 2, 4],
          }),
        }),
      );
      sources.liveMarkers.addFeature(destF);
    }
  }, [activeMapMode, liveAmbulanceRoute]);

  const handleZoomIn = () =>
    mapInstanceRef.current
      ?.getView()
      .setZoom((mapInstanceRef.current.getView().getZoom() || 13) + 1);
  const handleZoomOut = () =>
    mapInstanceRef.current
      ?.getView()
      .setZoom((mapInstanceRef.current.getView().getZoom() || 13) - 1);
  const handleCenter = () =>
    mapInstanceRef.current
      ?.getView()
      .animate({ center: sidiBelAbbesCenter, zoom: 13, duration: 800 });
  const handleRefresh = () => {
    refreshData();
    fetchRoadblocks();
    setLastRefresh(new Date());
  };

  const handleLiveClick = () => {
    if (activeMapMode === "live") {
      setActiveMapMode(null);
      setShowAmbulancePicker(false);
    } else {
      if (ambulancesEnMission.length === 0) {
        alert("Aucune ambulance en mission.");
        return;
      }
      setActiveMapMode("live");
      setShowAmbulancePicker(true);
    }
  };

  // FIX v5: un seul compteur pertinent désormais — le nombre d'obstacles
  // actifs. "pendingCount" retiré (aucun obstacle n'a jamais ce statut).
  const activeCount = roadblocks.filter((r) => r.status === "active").length;
  const clearedCount = roadblocks.filter((r) => r.status === "cleared").length;

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="map-module">
      <div className="module-header">
        <h2 className="module-title">
          <MapPin size={22} /> Carte Interactive
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="refresh-badge">
            🔄 {lastRefresh.toLocaleTimeString()}
          </span>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      </div>

      <div className="controls-section">
        <div className="layer-buttons">
          {[
            { key: "all", label: "Toutes", icon: <Layers size={13} /> },
            { key: "ambulances", label: "Ambulances", icon: <span>🚑</span> },
            {
              key: "parkings",
              label: "Parkings",
              icon: <Building size={13} />,
            },
            { key: "hopitaux", label: "Hôpitaux", icon: <span>🏥</span> },
            {
              key: "interventions",
              label: `Interventions (${activeInterventions.length})`,
              icon: <AlertTriangle size={13} />,
            },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              className={`btn-layer ${activeLayer === key ? "active" : ""}`}
              onClick={() => setActiveLayer(key)}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <div className="tool-buttons">
          <button
            className={`btn-tool ${hideIcons ? "active-warning" : ""}`}
            onClick={() => setHideIcons(!hideIcons)}
          >
            {hideIcons ? <Eye size={13} /> : <EyeOff size={13} />}
            {hideIcons ? "Afficher" : "Masquer"}
          </button>

          {/* Roadblock button — affiche uniquement le compteur d'obstacles ACTIFS */}
          <div style={{ position: "relative" }}>
            <button
              className={`btn-tool ${showRoadblockPanel ? "active-live" : ""}`}
              onClick={() => {
                setShowRoadblockPanel(!showRoadblockPanel);
                if (!showRoadblockPanel) fetchRoadblocks();
              }}
            >
              <AlertTriangle size={13} /> Obstacles
              {activeCount > 0 && (
                <span className="badge-danger">{activeCount}</span>
              )}
            </button>
          </div>

          {/* Live button */}
          <div style={{ position: "relative" }}>
            <button
              className={`btn-tool ${activeMapMode === "live" ? "active-live" : ""}`}
              onClick={handleLiveClick}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              {activeMapMode === "live" && <span className="live-dot" />}
              <Activity size={13} /> Live
              {ambulancesEnMission.length > 0 && (
                <span className="badge">{ambulancesEnMission.length}</span>
              )}
              <ChevronDown size={11} />
            </button>

            {showAmbulancePicker && ambulancesEnMission.length > 0 && (
              <div className="ambulance-picker">
                <div className="picker-header">
                  <span>Choisir l'ambulance</span>
                  <button onClick={() => setShowAmbulancePicker(false)}>
                    <X size={13} />
                  </button>
                </div>
                {ambulancesEnMission.map((amb) => {
                  const intervention = interventions.find(
                    (i) =>
                      i.ambulance_id === amb.id &&
                      (i.statut === "en route" ||
                        i.statut === "en attente" ||
                        i.statut === "transport" ||
                        i.statut === "en_transport"),
                  );
                  const isTransport =
                    intervention?.statut === "transport" ||
                    intervention?.statut === "en_transport";
                  const statusText = isTransport ? "Transport" : "En route";
                  const destIcon = isTransport ? "🏥" : "🆘";
                  return (
                    <button
                      key={amb.id}
                      className={`picker-item ${selectedAmbulanceId === amb.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedAmbulanceId(amb.id);
                        setShowAmbulancePicker(false);
                      }}
                    >
                      <span className="picker-icon">🚑</span>
                      <div className="picker-info">
                        <div className="picker-plate">
                          {amb.immatriculation}
                        </div>
                        {intervention && (
                          <div className="picker-dest">
                            {destIcon} {intervention.type}
                            {intervention.caller_name &&
                              ` — ${intervention.caller_name}`}
                          </div>
                        )}
                      </div>
                      <span
                        className={`picker-status ${isTransport ? "transport" : ""}`}
                      >
                        {statusText}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="zoom-buttons">
          <button className="btn-icon" onClick={handleZoomIn}>
            <ZoomIn size={14} />
          </button>
          <button className="btn-icon" onClick={handleZoomOut}>
            <ZoomOut size={14} />
          </button>
          <button className="btn-icon" onClick={handleCenter}>
            <Crosshair size={14} />
          </button>
        </div>
      </div>

      {/* Roadblock Panel — FIX v5: uniquement Actifs / Dégagés, plus de
          notion d'attente/validation. Action unique sur un obstacle actif :
          "Dégager". */}
      {showRoadblockPanel && (
        <div className="roadblock-panel">
          <div className="panel-header">
            <div className="panel-title">
              <AlertTriangle size={14} />
              <span>Obstacles signalés</span>
              {loadingRoadblocks && <span className="loading-spinner" />}
            </div>
            <div className="panel-actions">
              <button
                className="panel-refresh"
                onClick={refreshRoadblocks}
                disabled={refreshingRoadblocks}
                title="Rafraîchir"
              >
                <RefreshCcw size={14} />
              </button>
              <button
                className="panel-close"
                onClick={() => setShowRoadblockPanel(false)}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Stats Summary — uniquement actif/dégagé */}
          <div className="panel-stats">
            <div className="stat-item active">
              <span className="stat-count">{activeCount}</span>
              <span className="stat-label">Actifs</span>
            </div>
            <div className="stat-item cleared">
              <span className="stat-count">{clearedCount}</span>
              <span className="stat-label">Dégagés</span>
            </div>
          </div>

          <div className="panel-content">
            {loadingRoadblocks ? (
              <div className="empty-state">Chargement...</div>
            ) : roadblocks.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={32} />
                <p>Aucun obstacle signalé</p>
              </div>
            ) : (
              roadblocks.map((rb) => (
                <div
                  key={rb.id}
                  className={`roadblock-card ${rb.status}`}
                  onClick={() => setSelectedRoadblock(rb)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="card-header">
                    <div className="card-status">
                      {rb.status === "active" ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <CheckCircle size={12} />
                      )}
                      <span className={`status-text ${rb.status}`}>
                        {rb.status === "active" ? "Actif" : "Dégagé"}
                      </span>
                    </div>
                    <div className="card-time">
                      <Clock size={10} />
                      <span>{formatTime(rb.blocked_at)}</span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-edge">
                      <strong>Route #{rb.edge_id}</strong>
                    </div>
                    <div className="card-reason">
                      {rb.reason || "Accident / Obstacle"}
                    </div>
                    {rb.estimated_duration && (
                      <div className="card-duration">
                        <Clock size={10} />
                        <span>Durée estimée: {rb.estimated_duration} min</span>
                      </div>
                    )}
                    <div className="card-meta">
                      <div className="meta-item">
                        <Truck size={10} />
                        <span>
                          Ambulance: {rb.reported_by_ambulance || "—"}
                        </span>
                      </div>
                      <div className="meta-item">
                        <User size={10} />
                        <span>Conducteur: {rb.reported_by_driver || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-actions">
                    {rb.status === "active" && (
                      <button
                        className="action-btn clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearRoadblock(rb.edge_id, rb.id);
                        }}
                      >
                        <Trash2 size={12} /> Dégager
                      </button>
                    )}
                    {rb.status === "cleared" && (
                      <div className="cleared-badge">
                        <CheckCircle size={12} /> Dégagé par{" "}
                        {rb.cleared_by_name || "Manager"}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeMapMode === "live" && liveAmbulanceRoute && (
        <div
          className={`live-bar ${liveAmbulanceRoute.destinationType === "hospital" ? "hospital-mode" : ""}`}
        >
          <span className="live-ambulance">
            🚑 <strong>{liveAmbulanceRoute.ambulanceLabel}</strong>
          </span>
          <span className="live-destination">
            {liveAmbulanceRoute.destinationType === "hospital" ? "🏥" : "🆘"}
            <strong>
              {liveAmbulanceRoute.destinationName?.substring(0, 30)}
            </strong>
          </span>
          <span className="live-eta">
            ⏱️ ETA:{" "}
            <strong>{Math.round(liveAmbulanceRoute.eta.minutes)} min</strong>
          </span>
          <span className="live-distance">
            📏 <strong>{liveAmbulanceRoute.eta.km.toFixed(1)} km</strong>
          </span>
          <button
            className="live-change-btn"
            onClick={() => setShowAmbulancePicker(true)}
          >
            Changer <ChevronDown size={11} />
          </button>
        </div>
      )}

      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "70vh",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
      />

      {/* Detail popup au clic sur un obstacle de la carte — action unique:
          Dégager (si actif) */}
      {selectedRoadblock && (
        <div
          className="roadblock-detail-overlay"
          onClick={() => setSelectedRoadblock(null)}
        >
          <div
            className="roadblock-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-header">
              <span
                className={`detail-status-dot ${selectedRoadblock.status}`}
              />
              <span>Route #{selectedRoadblock.edge_id}</span>
              <button onClick={() => setSelectedRoadblock(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="detail-body">
              <p className="detail-reason">
                {selectedRoadblock.reason || "Accident / Obstacle"}
              </p>
              <div className="detail-meta">
                <span>
                  <Truck size={11} />{" "}
                  {selectedRoadblock.reported_by_ambulance || "—"}
                </span>
                <span>
                  <Clock size={11} /> {formatTime(selectedRoadblock.blocked_at)}
                </span>
              </div>
            </div>
            {selectedRoadblock.status === "active" ? (
              <button
                className="detail-clear-btn"
                onClick={() =>
                  clearRoadblock(
                    selectedRoadblock.edge_id,
                    selectedRoadblock.id,
                  )
                }
              >
                <Trash2 size={13} /> Dégager cet obstacle
              </button>
            ) : (
              <div className="detail-cleared-note">
                <CheckCircle size={13} /> Déjà dégagé
              </div>
            )}
          </div>
        </div>
      )}

      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "#dc2626" }} />
          <span>🚑 Ambulances</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "#059669" }} />
          <span>🏥 Hôpitaux</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "#ea580c" }} />
          <span>🆘 Interventions actives</span>
        </div>
        {activeMapMode === "live" && (
          <>
            <div className="legend-item">
              <span className="legend-line" style={{ background: "#2563eb" }} />
              <span>🔵 Itinéraire intervention</span>
            </div>
            <div className="legend-item">
              <span className="legend-line" style={{ background: "#7c3aed" }} />
              <span>🟣 Itinéraire hôpital</span>
            </div>
          </>
        )}
        {activeCount > 0 && (
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#dc2626" }} />
            <span>🚧 Obstacles actifs ({activeCount})</span>
          </div>
        )}
      </div>

      <style>{`
        .map-module { padding: 20px; background: #f5f7fa; min-height: 100vh; position: relative; }
        .module-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
        .module-title { display: flex; align-items: center; gap: 10px; font-size: 21px; font-weight: 700; color: #1e293b; margin: 0; }
        .refresh-badge { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 20px; border: 1px solid #e2e8f0; }
        .btn { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; transition: all .2s; }
        .btn-secondary { background: white; color: #475569; border: 1px solid #e2e8f0; }
        .btn-secondary:hover { background: #f8fafc; }
        .controls-section { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; justify-content: space-between; align-items: flex-start; }
        .layer-buttons, .tool-buttons, .zoom-buttons { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .btn-layer, .btn-tool { padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all .2s; border: 1px solid #e2e8f0; background: white; color: #475569; display: inline-flex; align-items: center; gap: 5px; }
        .btn-layer:hover, .btn-tool:hover { background: #f1f5f9; }
        .btn-layer.active, .btn-tool.active { background: #e0e7ff; border-color: #818cf8; color: #4338ca; }
        .btn-tool.active-primary { background: #1e293b; color: white; border-color: #1e293b; }
        .btn-tool.active-live { background: #dc2626; color: white; border-color: #dc2626; }
        .btn-tool.active-warning { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
        .live-dot { width: 7px; height: 7px; border-radius: 50%; background: white; animation: blink 1s infinite; display: inline-block; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
        .badge { background: #dc2626; color: white; border-radius: 10px; font-size: 9px; padding: 1px 5px; font-weight: 700; margin-left: 4px; }
        .badge-danger { background: #ef4444; color: white; border-radius: 10px; font-size: 9px; padding: 1px 5px; font-weight: 700; margin-left: 4px; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        .btn-icon { padding: 5px; border-radius: 6px; cursor: pointer; border: 1px solid #e2e8f0; background: white; color: #475569; display: inline-flex; align-items: center; transition: all .2s; }
        .btn-icon:hover { background: #f1f5f9; }
        
        /* Ambulance Picker */
        .ambulance-picker { position: absolute; top: calc(100% + 6px); right: 0; z-index: 1000; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; min-width: 300px; overflow: hidden; }
        .picker-header { display: flex; align-items: center; justify-content: space-between; padding: 9px 13px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 600; color: #475569; }
        .picker-header button { background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; }
        .picker-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 13px; border: none; background: white; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background .15s; text-align: left; }
        .picker-item:hover { background: #f8fafc; }
        .picker-item.selected { background: #eff6ff; }
        .picker-icon { font-size: 22px; }
        .picker-info { flex: 1; }
        .picker-plate { font-size: 13px; font-weight: 700; color: #1e293b; }
        .picker-dest { font-size: 11px; color: #64748b; margin-top: 2px; }
        .picker-status { font-size: 10px; background: #fef3c7; color: #92400e; padding: 2px 7px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
        .picker-status.transport { background: #e9d5ff; color: #6b21a5; }
        
        /* Live Bar */
        .live-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 10px 16px; background: #1e40af; border-radius: 10px; margin-bottom: 12px; color: white; font-size: 13px; }
        .live-bar.hospital-mode { background: #6d28d9; }
        .live-ambulance { display: flex; align-items: center; gap: 6px; }
        .live-destination { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .live-eta, .live-distance { display: flex; align-items: center; gap: 4px; }
        .live-change-btn { background: rgba(255,255,255,.2); border: none; color: white; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: auto; }
        .live-change-btn:hover { background: rgba(255,255,255,.3); }
        
        /* Roadblock Panel */
        .roadblock-panel { position: absolute; bottom: 20px; right: 20px; width: 380px; background: white; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; z-index: 1000; max-height: 500px; display: flex; flex-direction: column; overflow: hidden; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .panel-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: #1e293b; }
        .panel-actions { display: flex; gap: 6px; align-items: center; }
        .panel-refresh, .panel-close { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 6px; border-radius: 6px; display: flex; align-items: center; transition: all .2s; }
        .panel-refresh:hover { background: #eff6ff; color: #3b82f6; }
        .panel-close:hover { background: #fee2e2; color: #dc2626; }
        
        .panel-stats { display: flex; gap: 8px; padding: 12px 16px; background: white; border-bottom: 1px solid #f1f5f9; }
        .stat-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; border-radius: 10px; background: #f8fafc; }
        .stat-item.active .stat-count { color: #dc2626; }
        .stat-item.cleared .stat-count { color: #10b981; }
        .stat-count { font-size: 20px; font-weight: 700; }
        .stat-label { font-size: 10px; color: #64748b; font-weight: 500; }
        
        .panel-content { overflow-y: auto; padding: 12px; max-height: 350px; }
        .roadblock-card { background: white; border-radius: 12px; margin-bottom: 12px; border: 1px solid #e2e8f0; overflow: hidden; transition: all .2s; }
        .roadblock-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .roadblock-card.active { border-left: 3px solid #dc2626; background: #fef2f2; }
        .roadblock-card.cleared { border-left: 3px solid #10b981; opacity: 0.7; }
        
        .card-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; }
        .card-status { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; }
        .status-text.active { color: #dc2626; }
        .status-text.cleared { color: #10b981; }
        .card-time { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #94a3b8; }
        
        .card-body { padding: 12px; }
        .card-edge { font-family: monospace; font-size: 11px; font-weight: 600; color: #1e293b; margin-bottom: 6px; }
        .card-reason { font-size: 13px; font-weight: 500; color: #1e293b; margin-bottom: 8px; }
        .card-duration { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #64748b; margin-bottom: 8px; }
        .card-meta { display: flex; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #64748b; }
        
        .card-actions { padding: 8px 12px 12px; display: flex; gap: 8px; flex-wrap: wrap; }
        .action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; transition: all .2s; }
        .action-btn.clear { background: #3b82f6; color: white; }
        .action-btn.clear:hover { background: #2563eb; }
        .cleared-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #059669; }
        
        .empty-state { text-align: center; padding: 40px; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .loading-spinner { display: inline-block; width: 14px; height: 14px; margin-left: 8px; border: 2px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Roadblock detail popup (clic sur la carte) */
        .roadblock-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .roadblock-detail-card { background: white; border-radius: 16px; padding: 18px; width: 320px; box-shadow: 0 12px 40px rgba(0,0,0,0.25); }
        .detail-header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #1e293b; margin-bottom: 12px; }
        .detail-header button { margin-left: auto; background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; }
        .detail-status-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
        .detail-status-dot.active { background: #dc2626; }
        .detail-status-dot.cleared { background: #10b981; }
        .detail-body { margin-bottom: 14px; }
        .detail-reason { font-size: 14px; color: #1e293b; margin: 0 0 8px; }
        .detail-meta { display: flex; gap: 14px; font-size: 11px; color: #64748b; }
        .detail-meta span { display: flex; align-items: center; gap: 4px; }
        .detail-clear-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: #dc2626; color: white; border: none; border-radius: 10px; padding: 11px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .detail-clear-btn:hover { background: #b91c1c; }
        .detail-cleared-note { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: #dcfce7; color: #059669; border-radius: 10px; padding: 11px; font-size: 13px; font-weight: 700; }
        
        /* Legend */
        .legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; padding: 9px 14px; background: white; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); align-items: center; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #475569; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .legend-line { width: 20px; height: 4px; border-radius: 2px; display: inline-block; }
        
        @media (max-width: 768px) { 
          .controls-section { flex-direction: column; } 
          .roadblock-panel { width: calc(100% - 40px); right: 20px; left: 20px; bottom: 20px; } 
          .live-bar { flex-direction: column; align-items: flex-start; } 
          .live-change-btn { margin-left: 0; }
          .live-destination { max-width: 100%; overflow: visible; white-space: normal; }
        }
      `}</style>
    </div>
  );
};

export default MapModule;
