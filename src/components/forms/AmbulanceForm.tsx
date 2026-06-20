import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import type { Ambulance } from "../../context/DataContext";
import {
  MapPin,
  Crosshair,
  Map,
  FileText,
  Calendar,
  Gauge,
  Shield,
  Compass,
  Activity,
} from "lucide-react";
import GpsPickerModal from "../common/GpsPickerModal";

interface AmbulanceFormProps {
  ambulance: Ambulance | null;
  onSave: (ambulance: Partial<Ambulance>) => void;
  onCancel: () => void;
}

const AmbulanceForm: React.FC<AmbulanceFormProps> = ({
  ambulance,
  onSave,
  onCancel,
}) => {
  const { parkings } = useData();
  const [formData, setFormData] = useState({
    immatriculation: ambulance?.immatriculation || "",
    type: ambulance?.type || "Type A",
    statut: ambulance?.statut || "Disponible",
    dateMiseService:
      ambulance?.date_mise_service?.split("T")[0] ||
      ambulance?.dateMiseService ||
      new Date().toISOString().split("T")[0],
    kilometrage: ambulance?.kilometrage || 0,
    latitude: ambulance?.latitude?.toString() || "",
    longitude: ambulance?.longitude?.toString() || "",
    parkingId:
      ambulance?.parking_id?.toString() ||
      ambulance?.parkingId?.toString() ||
      "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showMapModal, setShowMapModal] = useState(false);

  // Auto-fill latitude/longitude when parking is selected
  const handleParkingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parkingId = e.target.value;
    setFormData((prev) => ({ ...prev, parkingId }));

    // Find the selected parking
    const selectedParking = parkings.find((p) => p.id === Number(parkingId));

    if (
      selectedParking &&
      selectedParking.latitude &&
      selectedParking.longitude
    ) {
      // Auto-fill coordinates from parking
      setFormData((prev) => ({
        ...prev,
        latitude: selectedParking.latitude.toString(),
        longitude: selectedParking.longitude.toString(),
      }));

      // Optional: Show a small notification
      console.log(
        `📍 Position auto-fillée depuis parking: ${selectedParking.nom}`,
      );
    } else if (!parkingId) {
      // If no parking selected, clear coordinates (optional)
      // setFormData(prev => ({ ...prev, latitude: '', longitude: '' }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    // If it's not the parking field, just update normally
    if (name !== "parkingId") {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.immatriculation) {
      newErrors.immatriculation = "L'immatriculation est requise";
    }
    if (!formData.type) {
      newErrors.type = "Le type est requis";
    }
    if (!formData.statut) {
      newErrors.statut = "Le statut est requis";
    }
    if (!formData.dateMiseService) {
      newErrors.dateMiseService = "La date de mise en service est requise";
    }
    if (formData.kilometrage < 0) {
      newErrors.kilometrage = "Le kilométrage ne peut pas être négatif";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInstantGeolocate = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
      },
      (error) => {
        alert("Impossible d'obtenir votre position : " + error.message);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const ambulanceData = {
      immatriculation: formData.immatriculation,
      type: formData.type,
      statut: formData.statut,
      date_mise_service: formData.dateMiseService,
      kilometrage: Number(formData.kilometrage),
      latitude: formData.latitude ? Number(formData.latitude) : undefined,
      longitude: formData.longitude ? Number(formData.longitude) : undefined,
      parking_id: formData.parkingId ? Number(formData.parkingId) : undefined,
    };

    onSave(ambulanceData);
  };

  // Get parking name for display (helps user understand where coordinates come from)
  const getSelectedParkingName = () => {
    const parking = parkings.find((p) => p.id === Number(formData.parkingId));
    return parking?.nom;
  };

  // Check if coordinates came from parking auto-fill
  const isCoordinatesFromParking = () => {
    const selectedParking = parkings.find(
      (p) => p.id === Number(formData.parkingId),
    );
    if (selectedParking && formData.latitude && formData.longitude) {
      return (
        selectedParking.latitude.toString() === formData.latitude &&
        selectedParking.longitude.toString() === formData.longitude
      );
    }
    return false;
  };

  return (
    <form className="ui form" onSubmit={handleSubmit}>
      <div className="two fields">
        <div className="required field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Immatriculation
          </label>
          <div className="ui left icon input w-full">
            <input
              type="text"
              name="immatriculation"
              value={formData.immatriculation}
              onChange={handleChange}
              placeholder="Ex: AMB001SBA"
              className={errors.immatriculation ? "error" : ""}
            />
            <FileText
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
          </div>
          {errors.immatriculation && (
            <div className="ui pointing red basic label mt-1">
              {errors.immatriculation}
            </div>
          )}
        </div>

        <div className="required field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Type
          </label>
          <div className="ui left icon input w-full">
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className={`ui dropdown ${errors.type ? "error" : ""} w-full pl-10`}
              style={{ paddingLeft: "2.7em" }}
            >
              <option value="Type A">Type A</option>
              <option value="Type B">Type B</option>
              <option value="Type C">Type C</option>
            </select>
            <Shield
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
          </div>
          {errors.type && (
            <div className="ui pointing red basic label mt-1">
              {errors.type}
            </div>
          )}
        </div>
      </div>

      <div className="two fields">
        <div className="required field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Statut
          </label>
          <div className="ui left icon input w-full">
            <select
              name="statut"
              value={formData.statut}
              onChange={handleChange}
              className={`ui dropdown ${errors.statut ? "error" : ""} w-full pl-10`}
              style={{ paddingLeft: "2.7em" }}
            >
              <option value="Disponible">Disponible</option>
              <option value="En mission">En mission</option>
              <option value="En panne">En panne</option>
              <option value="Maintenance">Maintenance</option>
            </select>
            <Activity
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
          </div>
          {errors.statut && (
            <div className="ui pointing red basic label mt-1">
              {errors.statut}
            </div>
          )}
        </div>

        <div className="field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Parking assigné
          </label>
          <div className="ui left icon input w-full">
            <select
              name="parkingId"
              value={formData.parkingId}
              onChange={handleParkingChange}
              className="ui dropdown w-full pl-10"
              style={{ paddingLeft: "2.7em" }}
            >
              <option value="">Aucun parking</option>
              {parkings.map((parking) => (
                <option key={parking.id} value={parking.id}>
                  {parking.nom}
                </option>
              ))}
            </select>
            <Compass
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
          </div>
          {formData.parkingId && getSelectedParkingName() && (
            <div
              className="ui info message"
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem",
                fontSize: "0.75rem",
              }}
            >
              <small>
                📍 La position du parking sera automatiquement utilisée comme
                position de départ
              </small>
            </div>
          )}
        </div>
      </div>

      <div className="two fields">
        <div className="required field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Date de mise en service
          </label>
          <div className="ui left icon input w-full">
            <input
              type="date"
              name="dateMiseService"
              value={formData.dateMiseService}
              onChange={handleChange}
              className={errors.dateMiseService ? "error" : ""}
            />
            <Calendar
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
          </div>
          {errors.dateMiseService && (
            <div className="ui pointing red basic label mt-1">
              {errors.dateMiseService}
            </div>
          )}
        </div>

        <div className="field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Kilométrage (km)
          </label>
          <div className="ui left icon input w-full">
            <input
              type="number"
              name="kilometrage"
              value={formData.kilometrage}
              onChange={handleChange}
              min="0"
              placeholder="0"
              className={errors.kilometrage ? "error" : ""}
            />
            <Gauge
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
          </div>
          {errors.kilometrage && (
            <div className="ui pointing red basic label mt-1">
              {errors.kilometrage}
            </div>
          )}
        </div>
      </div>

      {/* GPS Coordinates */}
      <div className="ui divider my-6"></div>

      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-green-50 text-green-600 rounded-md">
          <MapPin size={16} />
        </div>
        <h4 className="ui header m-0 text-slate-800 font-bold">
          Coordonnées GPS & Localisation
          <span className="text-xs text-slate-400 font-normal ml-2">
            (Optionnel)
          </span>
        </h4>
        {isCoordinatesFromParking() && (
          <div className="ui tiny green label">Auto-fill depuis parking</div>
        )}
      </div>

      <div className="two fields">
        <div className="field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Latitude
          </label>
          <div className="ui left icon input w-full">
            <input
              type="number"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              step="any"
              placeholder={
                formData.parkingId ? "Auto-fill depuis parking" : "Ex: 35.1919"
              }
              readOnly={isCoordinatesFromParking()}
              style={
                isCoordinatesFromParking() ? { backgroundColor: "#f0fdf4" } : {}
              }
            />
            <MapPin
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
              }}
            />
          </div>
          {isCoordinatesFromParking() && (
            <div
              className="ui tiny green message"
              style={{ marginTop: "0.25rem", padding: "0.25rem 0.5rem" }}
            >
              <small>
                ✓ Position auto-remplie depuis {getSelectedParkingName()}
              </small>
            </div>
          )}
        </div>

        <div className="field">
          <label className="text-slate-700 font-semibold mb-1 block">
            Longitude
          </label>
          <div className="ui left icon action input w-full">
            <input
              type="number"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              step="any"
              placeholder={
                formData.parkingId ? "Auto-fill depuis parking" : "Ex: -0.6298"
              }
              readOnly={isCoordinatesFromParking()}
              style={
                isCoordinatesFromParking() ? { backgroundColor: "#f0fdf4" } : {}
              }
            />
            <MapPin
              className="icon text-slate-400"
              size={16}
              style={{
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                position: "absolute",
                pointerEvents: "none",
                zIndex: 10,
              }}
            />
            <button
              type="button"
              className="ui basic icon button hover:bg-slate-100 transition-colors cursor-pointer"
              style={{
                margin: 0,
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={handleInstantGeolocate}
              title="Position actuelle"
            >
              <Crosshair
                size={15}
                className="text-blue-500 hover:text-blue-600"
              />
            </button>
            <button
              type="button"
              className="ui basic icon button hover:bg-slate-100 transition-colors cursor-pointer"
              style={{
                margin: 0,
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setShowMapModal(true)}
              title="Ouvrir la carte"
            >
              <Map size={15} className="text-green-500 hover:text-green-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="ui divider my-6"></div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="ui button hover:bg-slate-100 transition-colors py-3 px-6 rounded-lg cursor-pointer"
          onClick={onCancel}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="ui primary button py-3 px-6 rounded-lg cursor-pointer shadow-md hover:shadow-lg transition-all"
        >
          {ambulance ? "Enregistrer les modifications" : "Créer l'ambulance"}
        </button>
      </div>
      <GpsPickerModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        onSelect={(lat, lng) => {
          setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
          setShowMapModal(false);
        }}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
      />
    </form>
  );
};

export default AmbulanceForm;
