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

interface HopitauxMapModuleProps {
  onClose?: () => void;
  initialHospitalId?: number;
}

const HopitauxMapModule: React.FC<HopitauxMapModuleProps> = ({
  onClose,
  initialHospitalId,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const { hopitaux } = useData();

  // Center coordinates for Sidi Bel Abbès
  const sidiBelAbbesCenter = fromLonLat([-0.6298, 35.1919]);

  // Create map instance
  useEffect(() => {
    if (!mapRef.current) return;

    const osmLayer = new TileLayer({
      source: new OSM(),
    });

    const hospitalsLayer = new VectorLayer({
      source: new VectorSource(),
      style: (feature) => {
        const isSelected = feature.get("selected");
        return new Style({
          image: new Icon({
            src:
              "data:image/svg+xml;base64," +
              btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" fill="${isSelected ? "#ff4444" : "#21ba45"}"/>
                <path d="M14 9h-2V7h-2v2H8v2h2v2h2v-2h2V9z" fill="white"/>
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
      layers: [osmLayer, hospitalsLayer],
      view: new View({
        center: sidiBelAbbesCenter,
        zoom: 12,
      }),
    });

    setMap(mapInstance);

    // Click handler to show hospital details
    mapInstance.on("click", (event) => {
      const features = mapInstance.getFeaturesAtPixel(event.pixel);
      if (features.length > 0) {
        const feature = features[0];
        const hospital = {
          id: feature.get("id"),
          name: feature.get("name"),
          address: feature.get("address"),
          phone: feature.get("phone"),
          email: feature.get("email"),
          interventions: feature.get("interventions"),
          latitude: feature.get("lat"),
          longitude: feature.get("lng"),
        };
        setSelectedHospital(hospital);

        // Highlight selected hospital
        hospitalsLayer
          .getSource()
          ?.getFeatures()
          .forEach((f) => {
            f.set("selected", f.get("id") === hospital.id);
          });
        hospitalsLayer.changed();
      } else {
        setSelectedHospital(null);
        // Remove highlight
        hospitalsLayer
          .getSource()
          ?.getFeatures()
          .forEach((f) => {
            f.set("selected", false);
          });
        hospitalsLayer.changed();
      }
    });

    return () => {
      mapInstance.setTarget();
    };
  }, []);

  // Load hospitals on map
  useEffect(() => {
    if (!map) return;

    const layers = map.getLayers().getArray();
    const hospitalsLayer = layers[1] as VectorLayer<VectorSource>;

    hospitalsLayer.getSource()?.clear();

    hopitaux.forEach((hopital) => {
      if (hopital.latitude && hopital.longitude) {
        const feature = new Feature({
          geometry: new Point(
            fromLonLat([hopital.longitude, hopital.latitude]),
          ),
          id: hopital.id,
          name: hopital.nom,
          address: hopital.adresse,
          phone: hopital.telephone,
          email: hopital.email,
          interventions: hopital.nb_interventions || 0,
          lat: hopital.latitude,
          lng: hopital.longitude,
          selected: false,
        });
        hospitalsLayer.getSource()?.addFeature(feature);
      }
    });

    // Center on specific hospital if provided
    if (initialHospitalId) {
      const hospital = hopitaux.find((h) => h.id === initialHospitalId);
      if (hospital && hospital.latitude && hospital.longitude) {
        map.getView().animate({
          center: fromLonLat([hospital.longitude, hospital.latitude]),
          zoom: 16,
          duration: 1000,
        });
      }
    }
  }, [map, hopitaux, initialHospitalId]);

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
      setSelectedHospital(null);
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

  const handleHospitalClick = (hospital: any) => {
    if (map && hospital.latitude && hospital.longitude) {
      map.getView().animate({
        center: fromLonLat([hospital.longitude, hospital.latitude]),
        zoom: 16,
        duration: 800,
      });
      setSelectedHospital(hospital);
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
                  Carte des Hôpitaux
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

              {/* Sidebar with hospitals list */}
              <div className="four wide column">
                <div
                  className="ui segment"
                  style={{ height: "60vh", overflowY: "auto" }}
                >
                  <h4 className="ui header">
                    <MapPin size={16} className="mr-2" />
                    Hôpitaux (
                    {hopitaux.filter((h) => h.latitude && h.longitude).length})
                  </h4>
                  <div className="ui divided relaxed list">
                    {hopitaux
                      .filter((h) => h.latitude && h.longitude)
                      .map((hopital) => (
                        <div
                          key={hopital.id}
                          className="item"
                          onClick={() => handleHospitalClick(hopital)}
                          style={{
                            cursor: "pointer",
                            padding: "0.75rem",
                            borderRadius: "0.5rem",
                            backgroundColor:
                              selectedHospital?.id === hopital.id
                                ? "#e8f4fd"
                                : "transparent",
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (selectedHospital?.id !== hopital.id) {
                              e.currentTarget.style.backgroundColor = "#f5f5f5";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedHospital?.id !== hopital.id) {
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
                              {hopital.nom}
                            </div>
                            <div
                              className="description"
                              style={{ fontSize: "0.8rem", color: "#666" }}
                            >
                              <MapPin size={10} className="mr-1" />
                              {hopital.adresse}
                            </div>
                            {hopital.telephone && (
                              <div
                                className="description"
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#888",
                                  marginTop: "0.25rem",
                                }}
                              >
                                📞 {hopital.telephone}
                              </div>
                            )}
                            <div
                              className="description"
                              style={{
                                fontSize: "0.75rem",
                                color: "#21ba45",
                                marginTop: "0.25rem",
                              }}
                            >
                              📊 {hopital.nb_interventions || 0} interventions
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {hopitaux.filter((h) => h.latitude && h.longitude).length ===
                    0 && (
                    <div className="ui info message">
                      <p>Aucun hôpital géolocalisé</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Hospital Details */}
            {selectedHospital && (
              <div className="ui segment" style={{ marginTop: "1rem" }}>
                <div className="ui grid">
                  <div className="sixteen wide column">
                    <h4 className="ui header">🏥 {selectedHospital.name}</h4>
                    <p>
                      <strong>Adresse:</strong> {selectedHospital.address}
                      <br />
                      <strong>Téléphone:</strong>{" "}
                      {selectedHospital.phone || "Non renseigné"}
                      <br />
                      <strong>Email:</strong>{" "}
                      {selectedHospital.email || "Non renseigné"}
                      <br />
                      <strong>Interventions:</strong>{" "}
                      {selectedHospital.interventions}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="ui info message" style={{ marginTop: "1rem" }}>
              <div className="header">Utilisation de la carte</div>
              <p>
                Cliquez sur un hôpital sur la carte ou dans la liste pour voir
                ses détails. Utilisez les boutons de zoom pour naviguer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HopitauxMapModule;
