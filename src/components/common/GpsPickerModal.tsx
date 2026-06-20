import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Map, View, Feature } from 'ol';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Vector as VectorSource } from 'ol/source';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Point } from 'ol/geom';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';
import 'ol/ol.css';
import { MapPin, X } from 'lucide-react';

interface GpsPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: string, lng: string, address: string) => void;
  initialLat?: string;
  initialLng?: string;
}

const GpsPickerModal: React.FC<GpsPickerModalProps> = ({ isOpen, onClose, onSelect, initialLat, initialLng }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const [tempCoords, setTempCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialLat && initialLng && !isNaN(Number(initialLat)) && !isNaN(Number(initialLng))) {
        setTempCoords({ lat: Number(initialLat), lng: Number(initialLng) });
      } else {
        setTempCoords(null);
        setAddress('');
      }
    }
  }, [isOpen, initialLat, initialLng]);

  // Reverse geocoding when tempCoords changes
  useEffect(() => {
    if (tempCoords) {
      setIsLoadingAddress(true);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${tempCoords.lat}&lon=${tempCoords.lng}&zoom=18&addressdetails=1`)
        .then((res) => res.json())
        .then((data) => {
          const displayAddress = data.display_name || `${tempCoords.lat.toFixed(6)}, ${tempCoords.lng.toFixed(6)}`;
          setAddress(displayAddress);
        })
        .catch(() => {
          setAddress(`${tempCoords.lat.toFixed(6)}, ${tempCoords.lng.toFixed(6)}`);
        })
        .finally(() => {
          setIsLoadingAddress(false);
        });
    } else {
      setAddress('');
    }
  }, [tempCoords]);

  useEffect(() => {
    if (isOpen && mapRef.current && !mapInstanceRef.current) {
      const initialCenter = (initialLng && initialLat && !isNaN(Number(initialLng)) && !isNaN(Number(initialLat)))
        ? fromLonLat([Number(initialLng), Number(initialLat)])
        : fromLonLat([-0.6337, 35.1981]); // Sidi Bel Abbès default

      const vectorSource = new VectorSource();
      vectorSourceRef.current = vectorSource;

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#ef4444' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 })
          })
        }),
        zIndex: 10
      });

      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM()
          }),
          vectorLayer
        ],
        view: new View({
          center: initialCenter,
          zoom: 14
        })
      });

      // Add initial marker if exists
      if (initialLng && initialLat && !isNaN(Number(initialLng)) && !isNaN(Number(initialLat))) {
        const feature = new Feature({
          geometry: new Point(initialCenter)
        });
        vectorSource.addFeature(feature);
      }

      map.on('click', (event) => {
        const coords = toLonLat(event.coordinate);
        const lat = coords[1];
        const lng = coords[0];

        setTempCoords({ lat, lng });

        // Update marker
        vectorSource.clear();
        const feature = new Feature({
          geometry: new Point(event.coordinate)
        });
        vectorSource.addFeature(feature);

        // Animate center
        map.getView().animate({
          center: event.coordinate,
          duration: 500
        });
      });

      // Force a map update after modal renders properly
      setTimeout(() => {
        map.updateSize();
      }, 100);

      mapInstanceRef.current = map;
    }

    return () => {
      if (!isOpen && mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
        vectorSourceRef.current = null;
      }
    };
  }, [isOpen]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      const center = fromLonLat([-0.6337, 35.1981]); // Sidi Bel Abbès
      mapInstanceRef.current.getView().animate({
        center: center,
        zoom: 14,
        duration: 800
      });
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-[6000] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full h-[600px] max-h-[90vh] overflow-hidden flex flex-col relative animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white shrink-0">
          <span className="font-bold text-lg text-gray-900">
            Choisir l'emplacement sur la carte
          </span>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 flex items-center justify-center cursor-pointer"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 min-h-0 relative bg-gray-100 w-full overflow-hidden">
          <div
            ref={mapRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Recentering widget (top right) */}
          <button
            type="button"
            className="absolute top-4 right-4 z-10 bg-white p-2 rounded-lg shadow-md hover:bg-gray-50 text-blue-600 transition-colors flex items-center justify-center cursor-pointer border border-gray-100"
            onClick={handleRecenter}
            title="Recentrer sur Sidi Bel Abbès"
          >
            <MapPin size={20} />
          </button>

          {/* Coordinates widget (bottom left) */}
          <div className="absolute bottom-4 left-4 z-10 bg-white px-3 py-2 rounded-lg shadow-md font-mono text-sm font-bold text-gray-900 border border-gray-100 flex items-center gap-1.5">
            {tempCoords ? (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 text-xs font-sans font-normal">LAT:</span>
                <span>{tempCoords.lat.toFixed(6)}</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-400 text-xs font-sans font-normal">LNG:</span>
                <span>{tempCoords.lng.toFixed(6)}</span>
              </div>
            ) : (
              <span className="text-gray-500 font-sans font-normal text-xs">
                Aucun point sélectionné
              </span>
            )}
          </div>

          {/* Address widget (bottom right) */}
          {tempCoords && (
            <div className="absolute bottom-4 right-4 z-10 bg-white px-3 py-2 rounded-lg shadow-md max-w-[250px] border border-gray-100 text-xs text-gray-700 font-medium transition-all duration-300 flex items-center">
              {isLoadingAddress ? (
                <div className="flex items-center">
                  <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full mr-2 flex-shrink-0" />
                  <span className="text-gray-400 font-normal">Recherche...</span>
                </div>
              ) : (
                <span className="line-clamp-2 leading-snug">{address}</span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 flex justify-end space-x-3 border-t border-gray-100 shrink-0">
          <button
            type="button"
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-200 text-gray-700 font-medium rounded-lg shadow-sm transition-colors duration-200 cursor-pointer text-sm"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!tempCoords}
            onClick={() => {
              if (tempCoords) {
                const finalAddress = address || 'Adresse non disponible';
                onSelect(tempCoords.lat.toFixed(6), tempCoords.lng.toFixed(6), finalAddress);
              }
            }}
          >
            Valider la position
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GpsPickerModal;
