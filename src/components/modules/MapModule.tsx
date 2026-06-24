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
  X,
  EyeOff,
  Eye,
  Trash2,
  RefreshCcw,
  Clock,
  User,
  Truck,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

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

interface LatLng {
  lat: number;
  lng: number;
}

interface LiveRoute {
  route: [number, number][];
  ambulanceLocation: LatLng;
  destinationLocation: LatLng;
  eta: { minutes: number; km: number };
  ambulanceLabel: string;
  destinationType: "intervention" | "hospital";
  destinationName?: string;
}

interface Roadblock {
  id: number;
  edge_id: string;
  reason: string;
  estimated_duration: number;
  status: string;
  blocked_at: string;
  expires_at: string;
  reported_by_ambulance: string;
  reported_by_driver: string;
  cleared_by_name: string;
  center?: { lat: number; lon: number } | null;
  coords?: [number, number][];
}

// ── SAME parsePgRoute as MissionScreen ────────────────────────────────────────
// Chains segments in the correct direction using the driver's start position.
function parsePgRoute(
  segs: any[],
  fromLat: number,
  fromLon: number,
): [number, number][] {
  if (!segs || segs.length === 0) return [];

  const allPts: [number, number][][] = [];
  for (const seg of segs) {
    if (!seg?.geometry) continue;
    try {
      const geo =
        typeof seg.geometry === "string"
          ? JSON.parse(seg.geometry)
          : seg.geometry;
      if (!Array.isArray(geo?.coordinates)) continue;
      // geometry is [lon, lat] — keep as-is for OL (fromLonLat applied later)
      const coords: [number, number][] = geo.coordinates.map(
        ([lon, lat]: [number, number]) => [lon, lat],
      );
      if (coords.length >= 2) allPts.push(coords);
    } catch {
      /* ignore */
    }
  }

  if (allPts.length === 0) return [];

  const result: [number, number][] = [];
  let startPt: [number, number] = [fromLon, fromLat]; // [lon, lat]

  for (const pts of allPts) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    const df =
      Math.abs(first[0] - startPt[0]) + Math.abs(first[1] - startPt[1]);
    const dl = Math.abs(last[0] - startPt[0]) + Math.abs(last[1] - startPt[1]);

    if (dl < df) {
      // segment is in reverse — flip it
      const reversed = [...pts].reverse();
      result.push(...reversed);
      startPt = reversed[reversed.length - 1];
    } else {
      result.push(...pts);
      startPt = pts[pts.length - 1];
    }
  }

  // Deduplicate consecutive identical points
  return result.filter(
    (p, i) => i === 0 || p[0] !== result[i - 1][0] || p[1] !== result[i - 1][1],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
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

  // FIX #4: liveRoutes contient désormais TOUTES les ambulances en mission
  // (clé = ambulanceId), plus une seule à la fois — chaque trajet dessiné
  // côté driver doit aussi apparaître ici, simultanément.
  const [liveRoutes, setLiveRoutes] = useState<Record<number, LiveRoute>>({});
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<number | null>(
    null,
  );
  const [liveLoading, setLiveLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<any>(null);
  // Ne recadrer la vue qu'une seule fois (sur l'ensemble des trajets actifs)
  const hasFitAllRef = useRef(false);

  const { ambulances, parkings, hopitaux, interventions, refreshData } =
    useData();
  const sidiBelAbbesCenter = fromLonLat([-0.6298, 35.1919]);

  const activeInterventions = interventions.filter((i) =>
    ["en route", "en attente", "transport", "en_transport"].includes(i.statut),
  );
  const ambulancesEnMission = ambulances.filter((a) =>
    interventions.some(
      (i) =>
        i.ambulance_id === a.id &&
        ["en route", "en attente", "transport", "en_transport"].includes(
          i.statut,
        ),
    ),
  );

  // ── Roadblocks ─────────────────────────────────────────────────────────────
  const fetchRoadblocks = async () => {
    setLoadingRoadblocks(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/mobile/manager/roadblocks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const active = (data.data || []).filter(
          (rb: Roadblock) => rb.status === "active",
        );
        setRoadblocks(active);
        await drawRoadblocksOnMap(active);
      }
    } catch (e) {
      console.error("fetchRoadblocks:", e);
    } finally {
      setLoadingRoadblocks(false);
    }
  };

  const refreshRoadblocks = async () => {
    setRefreshingRoadblocks(true);
    await fetchRoadblocks();
    setRefreshingRoadblocks(false);
  };

  const fetchEdgeGeometry = async (edgeId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/mobile/edges/${edgeId}/center`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        let coords: [number, number][] = [];
        if (data.geometry) {
          try {
            const geo = JSON.parse(data.geometry);
            coords = geo.coordinates as [number, number][];
          } catch {
            /* ignore */
          }
        }
        return { center: data.center, coords };
      }
    } catch (e) {
      console.error("fetchEdgeGeometry:", e);
    }
    return { center: null, coords: [] };
  };

  const drawRoadblocksOnMap = async (blocks: Roadblock[]) => {
    const sources = vectorSourcesRef.current;
    if (!sources) return;
    sources.roadblocks.clear();

    for (const rb of blocks) {
      let coords = rb.coords;
      let center = rb.center;
      if ((!coords || coords.length < 2) && rb.edge_id) {
        const resolved = await fetchEdgeGeometry(rb.edge_id);
        coords = resolved.coords;
        center = resolved.center || center;
        rb.coords = coords;
        rb.center = center;
      }
      if (coords && coords.length >= 2) {
        const olCoords = coords.map(([lon, lat]) => fromLonLat([lon, lat]));
        const glow = new Feature({ geometry: new LineString(olCoords) });
        glow.setStyle(
          new Style({
            stroke: new Stroke({ color: "rgba(220,38,38,0.25)", width: 16 }),
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
              src: makeSVGIcon("🚧", "#dc2626", 30),
              anchor: [0.5, 1],
            }),
            text: new Text({
              text: rb.reason?.substring(0, 18) || "Obstacle",
              offsetY: 14,
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
        const f = new Feature({
          geometry: new Point(fromLonLat([center.lon, center.lat])),
          roadblockData: rb,
        });
        f.setStyle(
          new Style({
            image: new Icon({
              src: makeSVGIcon("🚧", "#dc2626", 32),
              anchor: [0.5, 1],
            }),
            text: new Text({
              text: rb.reason?.substring(0, 18) || "Obstacle",
              offsetY: 14,
              font: "bold 10px sans-serif",
              fill: new Fill({ color: "#7f1d1d" }),
              stroke: new Stroke({ color: "#fff", width: 2 }),
              backgroundFill: new Fill({ color: "rgba(255,255,255,0.85)" }),
              padding: [2, 4, 2, 4],
            }),
          }),
        );
        sources.roadblocks.addFeature(f);
      }
    }
  };

  const clearRoadblock = async (edge_id: string, roadblockId: number) => {
    if (!window.confirm(`Dégager cet obstacle ?\nRoute ID: ${edge_id}`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_URL}/mobile/manager/roadblock/${edge_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        setRoadblocks((prev) => prev.filter((rb) => rb.id !== roadblockId));
        await fetchRoadblocks();
        if (socketRef.current)
          socketRef.current.emit("manager:clear_roadblock", {
            edge_id,
            managerName: "Manager",
          });
      }
    } catch (e) {
      console.error("clearRoadblock:", e);
    }
  };

  const zoomToRoadblock = (rb: Roadblock) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    let target: [number, number] | null = null;
    if (rb.center) target = [rb.center.lon, rb.center.lat];
    else if (rb.coords?.length) {
      const mid = rb.coords[Math.floor(rb.coords.length / 2)];
      target = [mid[0], mid[1]];
    }
    if (target)
      map
        .getView()
        .animate({ center: fromLonLat(target), zoom: 17, duration: 600 });
  };

  // ── Focus / zoom sur une ambulance précise (parmi celles affichées) ───────
  const focusAmbulance = (ambulanceId: number) => {
    setSelectedAmbulanceId(ambulanceId);
    const lr = liveRoutes[ambulanceId];
    const map = mapInstanceRef.current;
    if (lr?.ambulanceLocation && map) {
      map.getView().animate({
        center: fromLonLat([
          lr.ambulanceLocation.lng,
          lr.ambulanceLocation.lat,
        ]),
        zoom: 16,
        duration: 600,
      });
    }
  };

  // ── Met à jour la position d'UNE ambulance précise (par ambulanceId) ──────
  const updateAmbulanceMarker = (
    ambulanceId: number,
    lat: number,
    lng: number,
  ) => {
    const sources = vectorSourcesRef.current;
    if (!sources) return;
    sources.liveMarkers.getFeatures().forEach((f) => {
      if (f.get("isAmbulance") && f.get("ambulanceId") === ambulanceId) {
        (f.getGeometry() as Point).setCoordinates(fromLonLat([lng, lat]));
      }
    });
    setLiveRoutes((prev) => {
      if (!prev[ambulanceId]) return prev;
      return {
        ...prev,
        [ambulanceId]: {
          ...prev[ambulanceId],
          ambulanceLocation: { lat, lng },
        },
      };
    });
  };

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    const handleRefresh = () => {
      refreshData();
      setLastRefresh(new Date());
      fetchRoadblocks();
    };
    [
      "intervention:created",
      "intervention:updated",
      "intervention:completed",
      "intervention:cancelled",
      "ambulance:assigned",
      "ambulance_assigned",
      "driver:status",
      "mission:started",
      "mission:completed",
      "driver:location",
    ].forEach((ev) => socket.on(ev, handleRefresh));
    socket.on("roadblock_active", () => fetchRoadblocks());
    socket.on("roadblock_cleared", () => fetchRoadblocks());
    // ── Real-time driver location → update the RIGHT ambulance marker,
    // peu importe laquelle, sans tout refetch ────────────────────────────────
    socket.on("ambulance_location", (data: any) => {
      if (!vectorSourcesRef.current || activeMapMode !== "live") return;
      const ambulanceId = data.ambulanceId;
      if (ambulanceId == null) return;
      updateAmbulanceMarker(
        ambulanceId,
        data.lat ?? data.latitude,
        data.lng ?? data.longitude,
      );
    });
    socket.emit("manager:online", {
      managerId: "manager",
      managerName: "Manager",
    });
    return () => {
      socket.emit("manager:offline");
      socket.disconnect();
    };
  }, [refreshData, activeMapMode]);

  useEffect(() => {
    const poll = setInterval(() => {
      refreshData();
      setLastRefresh(new Date());
      fetchRoadblocks();
    }, 15000);
    return () => clearInterval(poll);
  }, [refreshData]);

  useEffect(() => {
    fetchRoadblocks();
  }, []);

  // ── Fetch le trajet live d'UNE ambulance (retourne le résultat au lieu de
  // faire un setState direct — permet de les paralléliser pour TOUTES les
  // ambulances en mission) ──────────────────────────────────────────────────
  const fetchLiveRouteForAmbulance = useCallback(
    async (ambulanceId: number): Promise<LiveRoute | null> => {
      const token = localStorage.getItem("token");
      try {
        const activeIntervention = interventions.find(
          (i) =>
            i.ambulance_id === ambulanceId &&
            ["en route", "en attente", "transport", "en_transport"].includes(
              i.statut,
            ),
        );
        if (!activeIntervention) return null;

        const ambulance = ambulances.find((a) => a.id === ambulanceId);
        const ambulanceRes = await fetch(
          `${API_BASE_URL}/ambulances/${ambulanceId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const ambulanceData = await ambulanceRes.json();
        if (!ambulanceData.success || !ambulanceData.data) return null;

        const isTransport = ["transport", "en_transport"].includes(
          activeIntervention.statut,
        );
        const destinationLat = isTransport
          ? activeIntervention.hospital_lat
          : activeIntervention.latitude_depart;
        const destinationLon = isTransport
          ? activeIntervention.hospital_lon
          : activeIntervention.longitude_depart;
        const destinationType = isTransport
          ? "hospital"
          : ("intervention" as const);
        const destinationName = isTransport
          ? activeIntervention.hospital_name || "Hôpital"
          : `${activeIntervention.type} - ${activeIntervention.caller_name || "Urgence"}`;

        const fromLat = ambulanceData.data.latitude as number;
        const fromLon = ambulanceData.data.longitude as number;

        const endpoint = isTransport
          ? `${API_BASE_URL}/mobile/driver/route-to-hospital/${activeIntervention.id}`
          : `${API_BASE_URL}/mobile/driver/route/${activeIntervention.id}`;

        let routeCoords: [number, number][] = [];
        const routeRes = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const routeData = await routeRes.json();

        if (routeData.success && routeData.data) {
          let segments = [];
          if (routeData.data.route && Array.isArray(routeData.data.route))
            segments = routeData.data.route;
          else if (Array.isArray(routeData.data)) segments = routeData.data;

          if (segments.length > 0) {
            routeCoords = parsePgRoute(segments, fromLat, fromLon);
          }
        }

        if (
          routeCoords.length < 2 &&
          destinationLat &&
          destinationLon &&
          fromLat &&
          fromLon
        ) {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${destinationLon},${destinationLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.code === "Ok" && data.routes?.[0]) {
              routeCoords = data.routes[0].geometry.coordinates as [
                number,
                number,
              ][];
            }
          } catch {
            /* ignore */
          }
        }

        if (
          routeCoords.length < 2 &&
          fromLat &&
          fromLon &&
          destinationLat &&
          destinationLon
        ) {
          routeCoords = [
            [fromLon, fromLat],
            [destinationLon, destinationLat],
          ];
        }

        let etaMinutes = 0,
          etaKm = 0;
        try {
          const etaEndpoint = isTransport
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
        } catch {
          const R = 6371;
          const dLat = ((destinationLat - fromLat) * Math.PI) / 180;
          const dLon = ((destinationLon - fromLon) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((fromLat * Math.PI) / 180) *
              Math.cos((destinationLat * Math.PI) / 180) *
              Math.sin(dLon / 2) ** 2;
          etaKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          etaMinutes = etaKm / 0.666;
        }

        return {
          route: routeCoords,
          ambulanceLocation: { lat: fromLat, lng: fromLon },
          destinationLocation: { lat: destinationLat, lng: destinationLon },
          eta: { minutes: etaMinutes, km: etaKm },
          ambulanceLabel: ambulance?.immatriculation || `#${ambulanceId}`,
          destinationType,
          destinationName,
        };
      } catch (e) {
        console.error("fetchLiveRouteForAmbulance:", e);
        return null;
      }
    },
    [interventions, ambulances],
  );

  // ── FIX #4: récupère le trajet de TOUTES les ambulances en mission en
  // parallèle, pour que chaque trajet dessiné côté driver apparaisse aussi,
  // simultanément, sur la carte du manager ──────────────────────────────────
  const fetchAllLiveRoutes = useCallback(async () => {
    const ids = ambulances
      .filter((a) =>
        interventions.some(
          (i) =>
            i.ambulance_id === a.id &&
            ["en route", "en attente", "transport", "en_transport"].includes(
              i.statut,
            ),
        ),
      )
      .map((a) => a.id);

    if (ids.length === 0) {
      setLiveRoutes({});
      return;
    }

    const results = await Promise.all(
      ids.map(
        async (id) => [id, await fetchLiveRouteForAmbulance(id)] as const,
      ),
    );
    const next: Record<number, LiveRoute> = {};
    for (const [id, r] of results) if (r) next[id] = r;
    setLiveRoutes(next);
  }, [ambulances, interventions, fetchLiveRouteForAmbulance]);

  // ── Live polling — toutes les ambulances actives, pas une seule ──────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeMapMode === "live") {
      setLiveLoading(true);
      fetchAllLiveRoutes().finally(() => setLiveLoading(false));
      intervalRef.current = setInterval(fetchAllLiveRoutes, 5000);
    } else {
      setLiveRoutes({});
      setSelectedAmbulanceId(null);
      hasFitAllRef.current = false;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeMapMode, fetchAllLiveRoutes]);

  // ── Init map ───────────────────────────────────────────────────────────────
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
    map.on("click", (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f);
      if (feature && feature.get("roadblockData")) {
        zoomToRoadblock(feature.get("roadblockData"));
        setShowRoadblockPanel(true);
      } else if (feature && feature.get("isAmbulance")) {
        const id = feature.get("ambulanceId");
        if (id != null) focusAmbulance(id);
      }
    });
    mapInstanceRef.current = map;
    setTimeout(() => map.updateSize(), 100);
    return () => {
      map.setTarget(undefined);
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Entity markers ─────────────────────────────────────────────────────────
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
    if (activeLayer === "all" || activeLayer === "ambulances")
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
    if (activeLayer === "all" || activeLayer === "parkings")
      parkings.forEach((p) => {
        if (p.latitude && p.longitude)
          sources.parking.addFeature(
            mkMarker(p.longitude, p.latitude, ICONS.parking, p.nom),
          );
      });
    if (activeLayer === "all" || activeLayer === "hopitaux")
      hopitaux.forEach((h) => {
        if (h.latitude && h.longitude)
          sources.hopital.addFeature(
            mkMarker(h.longitude, h.latitude, ICONS.hopital, h.nom),
          );
      });
    if (activeLayer === "all" || activeLayer === "interventions")
      activeInterventions.forEach((i) => {
        if (i.latitude_depart && i.longitude_depart)
          sources.intervention.addFeature(
            mkMarker(
              i.longitude_depart,
              i.latitude_depart,
              i.statut === "en route" ? ICONS.enRoute : ICONS.intervention,
              `${i.type} — ${["transport", "en_transport"].includes(i.statut) ? "Transport" : i.statut}`,
            ),
          );
      });
  }, [
    ambulances,
    parkings,
    hopitaux,
    activeInterventions,
    activeLayer,
    hideIcons,
  ]);

  // ── Draw ALL live routes simultaneously — ne recadre la vue qu'une fois,
  // sur l'étendue combinée de TOUS les trajets actifs ───────────────────────
  useEffect(() => {
    const sources = vectorSourcesRef.current;
    const map = mapInstanceRef.current;
    if (!sources || !map) return;

    sources.liveRoute.clear();
    sources.liveMarkers.clear();
    if (activeMapMode !== "live") return;

    const entries: [string, LiveRoute][] = Object.entries(liveRoutes);
    if (entries.length === 0) return;

    const allExtents: number[][] = [];

    entries.forEach(([idStr, lr]) => {
      const ambulanceId = parseInt(idStr, 10);
      const {
        route,
        ambulanceLocation,
        destinationLocation,
        destinationType,
        destinationName,
        ambulanceLabel,
      } = lr;
      const isFocused = selectedAmbulanceId === ambulanceId;
      const routeColor = destinationType === "hospital" ? "#7c3aed" : "#2563eb";
      const shadowColor =
        destinationType === "hospital"
          ? "rgba(124,58,237,0.18)"
          : "rgba(37,99,235,0.18)";

      if (route && route.length >= 2) {
        try {
          const olCoords = route.map(([lon, lat]) => fromLonLat([lon, lat]));
          const shadow = new Feature({ geometry: new LineString(olCoords) });
          shadow.setStyle(
            new Style({
              stroke: new Stroke({
                color: shadowColor,
                width: isFocused ? 16 : 11,
              }),
            }),
          );
          sources.liveRoute.addFeature(shadow);
          const main = new Feature({ geometry: new LineString(olCoords) });
          main.setStyle(
            new Style({
              stroke: new Stroke({
                color: routeColor,
                width: isFocused ? 6 : 4,
                lineCap: "round",
              }),
            }),
          );
          sources.liveRoute.addFeature(main);
          if (isFocused) {
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
          }
          const extent = main.getGeometry()!.getExtent();
          if (extent.every((v) => !isNaN(v) && isFinite(v)))
            allExtents.push(extent);
        } catch (e) {
          console.error("draw live route:", e);
        }
      }

      if (ambulanceLocation?.lat && ambulanceLocation?.lng) {
        const ambF = new Feature({
          geometry: new Point(
            fromLonLat([ambulanceLocation.lng, ambulanceLocation.lat]),
          ),
          isAmbulance: true,
          ambulanceId,
        });
        ambF.setStyle(
          new Style({
            image: new Icon({
              src: ICONS.ambulance,
              anchor: [0.5, 1],
              scale: isFocused ? 1.3 : 1,
            }),
            text: new Text({
              text: ambulanceLabel,
              offsetY: 14,
              font: isFocused ? "bold 13px sans-serif" : "bold 11px sans-serif",
              fill: new Fill({ color: "#dc2626" }),
              stroke: new Stroke({ color: "#fff", width: 3 }),
            }),
          }),
        );
        sources.liveMarkers.addFeature(ambF);
      }

      if (destinationLocation?.lat && destinationLocation?.lng) {
        const destIcon =
          destinationType === "hospital" ? ICONS.hopital : ICONS.enRoute;
        const destLabel =
          destinationType === "hospital"
            ? `🏥 ${destinationName?.substring(0, 24) || "Hôpital"}`
            : `🆘 ${destinationName?.substring(0, 24) || "Urgence"}`;
        const destF = new Feature({
          geometry: new Point(
            fromLonLat([destinationLocation.lng, destinationLocation.lat]),
          ),
        });
        destF.setStyle(
          new Style({
            image: new Icon({
              src: destIcon,
              anchor: [0.5, 1],
              scale: isFocused ? 1.2 : 1,
            }),
            text: new Text({
              text: destLabel,
              offsetY: 14,
              font: "bold 10px sans-serif",
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
    });

    // FIX #4: un seul cadrage automatique, sur l'étendue de TOUS les trajets
    // actifs combinés — pas juste celui d'une ambulance sélectionnée.
    if (!hasFitAllRef.current && allExtents.length > 0) {
      let combined = allExtents[0].slice();
      for (const ext of allExtents.slice(1)) {
        combined = [
          Math.min(combined[0], ext[0]),
          Math.min(combined[1], ext[1]),
          Math.max(combined[2], ext[2]),
          Math.max(combined[3], ext[3]),
        ];
      }
      if (combined.every((v) => !isNaN(v) && isFinite(v))) {
        map.getView().fit(combined, {
          padding: [70, 70, 70, 70],
          maxZoom: 15,
          duration: 800,
        });
      }
      hasFitAllRef.current = true;
    }
  }, [activeMapMode, liveRoutes, selectedAmbulanceId]);

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

  // FIX #4: "Live" affiche désormais TOUTES les ambulances en mission d'un
  // coup — plus besoin de choisir une ambulance avant de voir quoi que ce
  // soit ; le sélecteur ne sert plus qu'à "zoomer" sur l'une d'elles.
  const handleLiveClick = () => {
    if (activeMapMode === "live") {
      setActiveMapMode(null);
      return;
    }
    if (ambulancesEnMission.length === 0) {
      alert("Aucune ambulance en mission.");
      return;
    }
    setActiveMapMode("live");
  };

  const activeCount = roadblocks.filter((r) => r.status === "active").length;
  const formatTime = (d: string) =>
    d
      ? new Date(d).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const liveEntries: [string, LiveRoute][] = Object.entries(liveRoutes);

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
            {hideIcons ? <Eye size={13} /> : <EyeOff size={13} />}{" "}
            {hideIcons ? "Afficher" : "Masquer"}
          </button>
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
          <button
            className={`btn-tool ${activeMapMode === "live" ? "active-live" : ""}`}
            onClick={handleLiveClick}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            {activeMapMode === "live" && <span className="live-dot" />}
            <Activity size={13} /> Live — toutes les ambulances
            {ambulancesEnMission.length > 0 && (
              <span className="badge">{ambulancesEnMission.length}</span>
            )}
          </button>
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

      {showRoadblockPanel && (
        <div className="roadblock-panel">
          <div className="panel-header">
            <div className="panel-title">
              <AlertTriangle size={14} />
              <span>Obstacles actifs</span>
              {loadingRoadblocks && <span className="loading-spinner" />}
            </div>
            <div className="panel-actions">
              <button
                className="panel-refresh"
                onClick={refreshRoadblocks}
                disabled={refreshingRoadblocks}
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
          <div className="panel-stats">
            <div className="stat-item active">
              <span className="stat-count">{activeCount}</span>
              <span className="stat-label">Actifs</span>
            </div>
          </div>
          <div className="panel-content">
            {loadingRoadblocks ? (
              <div className="empty-state">Chargement...</div>
            ) : roadblocks.length === 0 ? (
              <div className="empty-state">
                <span style={{ fontSize: 32 }}>✅</span>
                <p>Aucun obstacle signalé</p>
              </div>
            ) : (
              roadblocks.map((rb) => (
                <div
                  key={rb.id}
                  className="roadblock-card active"
                  onClick={() => zoomToRoadblock(rb)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="card-header">
                    <div className="card-status">
                      <AlertTriangle size={12} />
                      <span className="status-text active">Actif</span>
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
                    <button
                      className="action-btn clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearRoadblock(rb.edge_id, rb.id);
                      }}
                    >
                      <Trash2 size={12} /> Dégager
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FIX #4: bandeau "live" affichant TOUTES les ambulances actives,
          chacune cliquable pour zoomer/mettre en avant son trajet ───────── */}
      {activeMapMode === "live" && (
        <div className="live-bar-multi">
          {liveLoading && liveEntries.length === 0 ? (
            <span className="live-empty">Chargement des trajets...</span>
          ) : liveEntries.length === 0 ? (
            <span className="live-empty">
              Aucun trajet actif pour le moment
            </span>
          ) : (
            liveEntries.map(([idStr, lr]) => {
              const id = parseInt(idStr, 10);
              const isFocused = selectedAmbulanceId === id;
              return (
                <button
                  key={id}
                  className={`live-chip ${lr.destinationType === "hospital" ? "hospital" : ""} ${isFocused ? "focused" : ""}`}
                  onClick={() => focusAmbulance(id)}
                  title="Cliquer pour zoomer sur cette ambulance"
                >
                  <span className="live-chip-icon">🚑</span>
                  <span className="live-chip-plate">{lr.ambulanceLabel}</span>
                  <span className="live-chip-dest">
                    {lr.destinationType === "hospital" ? "🏥" : "🆘"}
                  </span>
                  <span className="live-chip-eta">
                    {Math.round(lr.eta.minutes)} min
                  </span>
                </button>
              );
            })
          )}
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
            <span className="legend-line" style={{ background: "#dc2626" }} />
            <span>🚧 Obstacles ({activeCount})</span>
          </div>
        )}
      </div>

      <style>{`
        .map-module{padding:20px;background:#f5f7fa;min-height:100vh;position:relative}
        .module-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px}
        .module-title{display:flex;align-items:center;gap:10px;font-size:21px;font-weight:700;color:#1e293b;margin:0}
        .refresh-badge{font-size:11px;color:#64748b;background:#f1f5f9;padding:3px 8px;border-radius:20px;border:1px solid #e2e8f0}
        .btn{display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:all .2s}
        .btn-secondary{background:white;color:#475569;border:1px solid #e2e8f0}
        .btn-secondary:hover{background:#f8fafc}
        .controls-section{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;justify-content:space-between;align-items:flex-start}
        .layer-buttons,.tool-buttons,.zoom-buttons{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
        .btn-layer,.btn-tool{padding:5px 10px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;border:1px solid #e2e8f0;background:white;color:#475569;display:inline-flex;align-items:center;gap:5px}
        .btn-layer:hover,.btn-tool:hover{background:#f1f5f9}
        .btn-layer.active,.btn-tool.active{background:#e0e7ff;border-color:#818cf8;color:#4338ca}
        .btn-tool.active-live{background:#dc2626;color:white;border-color:#dc2626}
        .btn-tool.active-warning{background:#fef3c7;border-color:#f59e0b;color:#92400e}
        .live-dot{width:7px;height:7px;border-radius:50%;background:white;animation:blink 1s infinite;display:inline-block}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        .badge{background:#dc2626;color:white;border-radius:10px;font-size:9px;padding:1px 5px;font-weight:700;margin-left:4px}
        .badge-danger{background:#ef4444;color:white;border-radius:10px;font-size:9px;padding:1px 5px;font-weight:700;margin-left:4px;animation:pulse 1s infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        .btn-icon{padding:5px;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;background:white;color:#475569;display:inline-flex;align-items:center;transition:all .2s}
        .btn-icon:hover{background:#f1f5f9}
        .live-bar-multi{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px;background:#0f172a;border-radius:12px;margin-bottom:12px;align-items:center}
        .live-empty{color:#94a3b8;font-size:12px;padding:4px 8px}
        .live-chip{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);border:1.5px solid rgba(56,189,248,0.25);color:#e2e8f0;border-radius:20px;padding:6px 12px;font-size:12px;cursor:pointer;transition:all .15s}
        .live-chip:hover{background:rgba(255,255,255,0.14)}
        .live-chip.hospital{border-color:rgba(167,139,250,0.35)}
        .live-chip.focused{background:#2563eb;border-color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,0.3)}
        .live-chip.focused.hospital{background:#7c3aed;border-color:#a78bfa}
        .live-chip-plate{font-weight:700}
        .live-chip-eta{color:#93c5fd;font-weight:600}
        .live-chip.focused .live-chip-eta{color:#dbeafe}
        .roadblock-panel{position:absolute;bottom:20px;right:20px;width:380px;background:white;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);border:1px solid #e2e8f0;z-index:1000;max-height:500px;display:flex;flex-direction:column;overflow:hidden}
        .panel-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
        .panel-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;color:#1e293b}
        .panel-actions{display:flex;gap:6px;align-items:center}
        .panel-refresh,.panel-close{background:none;border:none;cursor:pointer;color:#94a3b8;padding:6px;border-radius:6px;display:flex;align-items:center;transition:all .2s}
        .panel-refresh:hover{background:#eff6ff;color:#3b82f6}
        .panel-close:hover{background:#fee2e2;color:#dc2626}
        .panel-stats{display:flex;gap:8px;padding:12px 16px;background:white;border-bottom:1px solid #f1f5f9}
        .stat-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;border-radius:10px;background:#f8fafc}
        .stat-item.active .stat-count{color:#dc2626}
        .stat-count{font-size:20px;font-weight:700}
        .stat-label{font-size:10px;color:#64748b;font-weight:500}
        .panel-content{overflow-y:auto;padding:12px;max-height:350px}
        .roadblock-card{background:white;border-radius:12px;margin-bottom:12px;border:1px solid #e2e8f0;overflow:hidden;transition:all .2s}
        .roadblock-card:hover{box-shadow:0 2px 8px rgba(0,0,0,0.1);transform:translateY(-1px)}
        .roadblock-card.active{border-left:3px solid #dc2626;background:#fef2f2}
        .card-header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #f1f5f9}
        .card-status{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600}
        .status-text.active{color:#dc2626}
        .card-time{display:flex;align-items:center;gap:4px;font-size:10px;color:#94a3b8}
        .card-body{padding:12px}
        .card-edge{font-family:monospace;font-size:11px;font-weight:600;color:#1e293b;margin-bottom:6px}
        .card-reason{font-size:13px;font-weight:500;color:#1e293b;margin-bottom:8px}
        .card-duration{display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;margin-bottom:8px}
        .card-meta{display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap}
        .meta-item{display:flex;align-items:center;gap:4px;font-size:10px;color:#64748b}
        .card-actions{padding:8px 12px 12px;display:flex;gap:8px;flex-wrap:wrap}
        .action-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:none;transition:all .2s}
        .action-btn.clear{background:#3b82f6;color:white}
        .action-btn.clear:hover{background:#2563eb}
        .empty-state{text-align:center;padding:40px;color:#94a3b8;display:flex;flex-direction:column;align-items:center;gap:12px}
        .loading-spinner{display:inline-block;width:14px;height:14px;margin-left:8px;border:2px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.6s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;padding:9px 14px;background:white;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,0.07);align-items:center}
        .legend-item{display:flex;align-items:center;gap:6px;font-size:11px;color:#475569}
        .legend-dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0}
        .legend-line{width:20px;height:4px;border-radius:2px;display:inline-block}
        @media(max-width:768px){.controls-section{flex-direction:column}.roadblock-panel{width:calc(100% - 40px);right:20px;left:20px;bottom:20px}.live-bar-multi{overflow-x:auto;flex-wrap:nowrap}}
      `}</style>
    </div>
  );
};

export default MapModule;
