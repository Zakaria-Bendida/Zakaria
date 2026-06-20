import React, { useEffect, useRef, useState } from "react";
import { Map, View } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { OSM, Vector as VectorSource } from "ol/source";
import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Style, Icon, Text, Fill, Stroke } from "ol/style";
import { useData } from "../../context/DataContext";
import { MapPin, ZoomIn, ZoomOut, Crosshair, RefreshCw } from "lucide-react";

interface ParkingsMapModuleProps {
  onClose?: () => void;
  initialParkingId?: number;
}

const ParkingsMapModule: React.FC<ParkingsMapModuleProps> = ({
  onClose,
  initialParkingId,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [selectedParking, setSelectedParking] = useState<any>(null);
  const { parkings, ambulances } = useData();

  // Center coordinates for Sidi Bel Abbès
  const sidiBelAbbesCenter = fromLonLat([-0.6298, 35.1919]);

  // Create map instance
  useEffect(() => {
    if (!mapRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
    });

    const parkingsLayer = new VectorLayer({
      source: new VectorSource(),
      style: (feature) => {
        const isSelected = feature.get("selected");
        return new Style({
          image: new Icon({
            src:
              "data:image/svg+xml;base64," +
              btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                <path d="M6 3h12c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm4 14V7h4.5c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5H12v5h-2zm2-7h2.5c.3 0 .5-.2.5-.5s-.2-.5-.5-.5H12v1z" fill="${isSelected ? "#ff4444" : "#2185d0"}"/>
              </svg>
            `),
            scale: 0.8,
          }),
          text: new Text({
            offsetY: 30,
            text: feature.get("name"),
            font: "12px Arial",
            fill: new Fill({ color: "#000" }),
            stroke: new Stroke({ color: "#fff", width: 3 }),
          }),
        });
      },
    });

    const mapInstance = new Map({
      target: mapRef.current,
      layers: [osmLayer, parkingsLayer],
      view: new View({
        center: sidiBelAbbesCenter,
        zoom: 12,
      }),
    });

    setMap(mapInstance);

    // Click handler to show parking details
    mapInstance.on("click", (event) => {
      const features = mapInstance.getFeaturesAtPixel(event.pixel);
      if (features.length > 0) {
        const feature = features[0];
        const parking = {
          id: feature.get("id"),
          name: feature.get("name"),
          address: feature.get("address"),
          capacity: feature.get("capacity"),
          occupied: feature.get("occupied"),
          latitude: feature.get("lat"),
          longitude: feature.get("lng"),
        };
        setSelectedParking(parking);

        // Highlight selected parking
        parkingsLayer
          .getSource()
          ?.getFeatures()
          .forEach((f) => {
            f.set("selected", f.get("id") === parking.id);
          });
        parkingsLayer.changed();
      } else {
        setSelectedParking(null);
        parkingsLayer
          .getSource()
          ?.getFeatures()
          .forEach((f) => {
            f.set("selected", false);
          });
        parkingsLayer.changed();
      }
    });

    return () => {
      mapInstance.setTarget();
    };
  }, []);

  // Load parkings on map
  useEffect(() => {
    if (!map) return;

    const layers = map.getLayers().getArray();
    const parkingsLayer = layers[1] as VectorLayer<VectorSource>;

    parkingsLayer.getSource()?.clear();

    parkings.forEach((parking) => {
      if (parking.latitude && parking.longitude) {
        const occupied = ambulances.filter(
          (a) => a.parking_id === parking.id,
        ).length;
        const feature = new Feature({
          geometry: new Point(
            fromLonLat([parking.longitude, parking.latitude]),
          ),
          id: parking.id,
          name: parking.nom,
          address: parking.adresse,
          capacity: parking.capacite,
          occupied: occupied,
          lat: parking.latitude,
          lng: parking.longitude,
          selected: false,
        });
        parkingsLayer.getSource()?.addFeature(feature);
      }
    });

    // Center on specific parking if provided
    if (initialParkingId) {
      const parking = parkings.find((p) => p.id === initialParkingId);
      if (parking && parking.latitude && parking.longitude) {
        map.getView().animate({
          center: fromLonLat([parking.longitude, parking.latitude]),
          zoom: 16,
          duration: 1000,
        });
      }
    }
  }, [map, parkings, ambulances, initialParkingId]);

  const handleZoomIn = () => {
    if (map) {
      const view = map.getView();
      view.setZoom((view.getZoom() || 12) + 1);
    }
  };

  const handleZoomOut = () => {
    if (map) {
      const view = map.getView();
      view.setZoom((view.getZoom() || 12) - 1);
    }
  };

  const handleCenterMap = () => {
    if (map) {
      map.getView().animate({
        center: sidiBelAbbesCenter,
        zoom: 12,
        duration: 1000,
      });
      setSelectedParking(null);
    }
  };

  const handleRefresh = () => {
    if (map) {
      map.getLayers().forEach((layer) => {
        if (layer instanceof VectorLayer) {
          layer.getSource()?.changed();
        }
      });
    }
  };

  const handleParkingClick = (parking: any) => {
    if (map && parking.latitude && parking.longitude) {
      map.getView().animate({
        center: fromLonLat([parking.longitude, parking.latitude]),
        zoom: 16,
        duration: 800,
      });
      setSelectedParking(parking);
    }
  };

  return (
    <div className="ui container" style={{ padding: "1rem" }}>
      <div className="ui grid">
        <div className="sixteen wide column">
          <div className="ui segment">
            <div className="ui grid">
              <div className="eight wide column">
                <h2 className="ui header">
                  <MapPin className="mr-2" />
                  Carte des Parkings
                </h2>
              </div>
              <div className="eight wide column right aligned">
                <div className="action-buttons">
                  <button className="ui button" onClick={handleRefresh}>
                    <RefreshCw size={16} className="mr-2" />
                    Actualiser
                  </button>
                  {onClose && (
                    <button className="ui button" onClick={onClose}>
                      Fermer
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="ui grid">
              <div className="twelve wide column">
                {/* Map Controls */}
                <div className="ui segment">
                  <div className="ui buttons">
                    <button className="ui button" onClick={handleZoomIn}>
                      <ZoomIn size={16} className="mr-2" />
                      Zoom avant
                    </button>
                    <button className="ui button" onClick={handleZoomOut}>
                      <ZoomOut size={16} className="mr-2" />
                      Zoom arrière
                    </button>
                    <button className="ui button" onClick={handleCenterMap}>
                      <Crosshair size={16} className="mr-2" />
                      Centrer
                    </button>
                  </div>
                </div>

                {/* Map Container */}
                <div
                  ref={mapRef}
                  className="map-container"
                  style={{
                    width: "100%",
                    height: "60vh",
                    border: "2px solid #2185d0",
                    borderRadius: "8px",
                  }}
                />
              </div>

              {/* Sidebar with parkings list */}
              <div className="four wide column">
                <div
                  className="ui segment"
                  style={{ height: "60vh", overflowY: "auto" }}
                >
                  <h4 className="ui header">
                    <MapPin size={16} className="mr-2" />
                    Parkings (
                    {parkings.filter((p) => p.latitude && p.longitude).length})
                  </h4>
                  <div className="ui divided relaxed list">
                    {parkings
                      .filter((p) => p.latitude && p.longitude)
                      .map((parking) => {
                        const occupied = ambulances.filter(
                          (a) => a.parking_id === parking.id,
                        ).length;
                        return (
                          <div
                            key={parking.id}
                            className="item"
                            onClick={() => handleParkingClick(parking)}
                            style={{
                              cursor: "pointer",
                              padding: "0.75rem",
                              borderRadius: "0.5rem",
                              backgroundColor:
                                selectedParking?.id === parking.id
                                  ? "#e8f4fd"
                                  : "transparent",
                              transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (selectedParking?.id !== parking.id) {
                                e.currentTarget.style.backgroundColor =
                                  "#f5f5f5";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedParking?.id !== parking.id) {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }
                            }}
                          >
                            <div className="content">
                              <div
                                className="header"
                                style={{ fontWeight: "bold" }}
                              >
                                🅿️ {parking.nom}
                              </div>
                              <div
                                className="description"
                                style={{ fontSize: "0.8rem", color: "#666" }}
                              >
                                <MapPin size={10} className="mr-1" />
                                {parking.adresse}
                              </div>
                              <div
                                className="description"
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#2185d0",
                                  marginTop: "0.25rem",
                                }}
                              >
                                📊 {occupied}/{parking.capacite} places occupées
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {parkings.filter((p) => p.latitude && p.longitude).length ===
                    0 && (
                    <div className="ui info message">
                      <p>Aucun parking géolocalisé</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Parking Details */}
            {selectedParking && (
              <div className="ui segment" style={{ marginTop: "1rem" }}>
                <div className="ui grid">
                  <div className="sixteen wide column">
                    <h4 className="ui header">🅿️ {selectedParking.name}</h4>
                    <p>
                      <strong>Adresse:</strong> {selectedParking.address}
                      <br />
                      <strong>Capacité:</strong> {selectedParking.capacity}{" "}
                      places
                      <br />
                      <strong>Occupation:</strong> {selectedParking.occupied}{" "}
                      places
                      <br />
                      <strong>Taux d'occupation:</strong>{" "}
                      {Math.round(
                        (selectedParking.occupied / selectedParking.capacity) *
                          100,
                      )}
                      %
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="ui info message" style={{ marginTop: "1rem" }}>
              <div className="header">Utilisation de la carte</div>
              <p>
                Cliquez sur un parking sur la carte ou dans la liste pour voir
                ses détails. Utilisez les boutons de zoom pour naviguer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParkingsMapModule;
