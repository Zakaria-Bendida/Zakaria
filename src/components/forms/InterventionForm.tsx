import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import type { Intervention } from "../../context/DataContext";
import {
  MapPin,
  Crosshair,
  Map as MapIcon,
  User,
  Phone,
  AlertTriangle,
  Calendar,
  Clock,
  Building2,
} from "lucide-react";
import GpsPickerModal from "../common/GpsPickerModal";

interface InterventionFormProps {
  intervention: Intervention | null;
  onSave: (intervention: Partial<Intervention>) => void;
  onCancel: () => void;
}

const InterventionForm: React.FC<InterventionFormProps> = ({
  intervention,
  onSave,
  onCancel,
}) => {
  const { ambulances, hopitaux } = useData();
  const isEditing = !!intervention?.id;

  const getInitialDateTime = () => {
    if (intervention?.date_intervention) {
      return new Date(intervention.date_intervention)
        .toISOString()
        .slice(0, 16);
    }
    if (intervention?.dateHeure) {
      return intervention.dateHeure;
    }
    return new Date().toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    id: intervention?.id || "",
    type: intervention?.type || "",
    dateTime: getInitialDateTime(),
    description: intervention?.description || "",
    statut: intervention?.statut || "en attente",
    latitude:
      intervention?.latitude_depart?.toString() ||
      intervention?.latitude?.toString() ||
      "",
    longitude:
      intervention?.longitude_depart?.toString() ||
      intervention?.longitude?.toString() ||
      "",
    ambulance_id:
      intervention?.ambulance_id?.toString() ||
      intervention?.ambulanceId?.toString() ||
      "",
    hospital_id:
      intervention?.hopital_id?.toString() ||
      intervention?.hospital_id?.toString() ||
      intervention?.hopitalId?.toString() ||
      "",
    caller_name: intervention?.caller_name || "",
    caller_phone: intervention?.caller_phone || "",
    priority: intervention?.priority || "normal",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showGpsModal, setShowGpsModal] = useState(false);

  useEffect(() => {
    if (intervention) {
      console.log("📝 Editing intervention - Data:", {
        id: intervention.id,
        type: intervention.type,
        statut: intervention.statut,
        latitude_depart: intervention.latitude_depart,
        longitude_depart: intervention.longitude_depart,
        caller_name: intervention.caller_name,
        ambulance_id: intervention.ambulance_id,
      });
    }
  }, [intervention]);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          }));
        },
        (error) => {
          alert("Impossible de récupérer votre position : " + error.message);
        },
      );
    } else {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
    }
  };

  const interventionTypes = [
    "Accident de route",
    "Urgence cardiaque",
    "AVC (Accident Vasculaire Cérébral)",
    "Détresse respiratoire",
    "Chute",
    "Malaise",
    "Fracture",
    "Brûlure",
    "Intoxication",
    "Noyade",
    "Accident domestique",
    "Agression",
    "Femme enceinte",
    "new Medical Emergency",
    "Autre",
  ];

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.type.trim()) {
      newErrors.type = "Le type d'intervention est requis";
    }
    if (!formData.dateTime) {
      newErrors.dateTime = "La date et heure sont requises";
    }
    if (!formData.caller_name.trim()) {
      newErrors.caller_name = "Le nom de l'appelant est requis";
    }
    if (!formData.caller_phone.trim()) {
      newErrors.caller_phone = "Le téléphone de l'appelant est requis";
    } else if (!/^[0-9+\-\s]{8,15}$/.test(formData.caller_phone)) {
      newErrors.caller_phone = "Numéro de téléphone invalide (8-15 chiffres)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const dateTimeValue = new Date(formData.dateTime);

    const interventionData: Partial<Intervention> = {
      type: formData.type,
      description: formData.description,
      date_intervention: dateTimeValue.toISOString(),
      heure_intervention: dateTimeValue.toTimeString().slice(0, 8),
      caller_name: formData.caller_name,
      caller_phone: formData.caller_phone,
      statut: formData.statut,
      priority: formData.priority,
    };

    if (formData.latitude && formData.longitude) {
      interventionData.latitude_depart = Number(formData.latitude);
      interventionData.longitude_depart = Number(formData.longitude);
    }

    if (formData.ambulance_id) {
      interventionData.ambulance_id = Number(formData.ambulance_id);
    }

    if (isEditing && formData.id) {
      interventionData.id = Number(formData.id);
    }

    console.log("📤 Saving intervention data:", interventionData);
    onSave(interventionData);
  };

  return (
    <form className="ui form" onSubmit={handleSubmit}>
      {/* Caller Information Section */}
      <div
        className="ui segment"
        style={{
          backgroundColor: "#f0f9ff",
          borderLeft: "4px solid #3b82f6",
          marginBottom: "1.5rem",
        }}
      >
        <div
          className="ui header"
          style={{ fontSize: "0.9rem", marginBottom: "1rem", color: "#1e40af" }}
        >
          <User size={16} className="mr-2" style={{ color: "#3b82f6" }} />
          Informations de l'appelant
        </div>
        <div className="two fields">
          <div className="required field">
            <label>Nom de l'appelant</label>
            <div className="ui left icon input">
              <User
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "12px",
                  zIndex: 1,
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                name="caller_name"
                value={formData.caller_name}
                onChange={handleChange}
                placeholder="Ex: Ahmed Bensaid"
                style={{ paddingLeft: "40px" }}
                className={errors.caller_name ? "error" : ""}
              />
            </div>
            {errors.caller_name && (
              <div className="ui pointing red basic label">
                {errors.caller_name}
              </div>
            )}
          </div>

          <div className="required field">
            <label>Téléphone de l'appelant</label>
            <div className="ui left icon input">
              <Phone
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "12px",
                  zIndex: 1,
                  color: "#94a3b8",
                }}
              />
              <input
                type="tel"
                name="caller_phone"
                value={formData.caller_phone}
                onChange={handleChange}
                placeholder="Ex: 0555123456"
                style={{ paddingLeft: "40px" }}
                className={errors.caller_phone ? "error" : ""}
              />
            </div>
            {errors.caller_phone && (
              <div className="ui pointing red basic label">
                {errors.caller_phone}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Type */}
      <div className="two fields">
        <div className="required field">
          <label>Type d'intervention</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className={`ui dropdown ${errors.type ? "error" : ""}`}
          >
            <option value="">Sélectionner un type</option>
            {interventionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.type && (
            <div className="ui pointing red basic label">{errors.type}</div>
          )}
        </div>

        {/* ✅ Priority - Caché (utilisé mais non affiché) */}
        <input type="hidden" name="priority" value={formData.priority} />
      </div>

      {/* Status and Date */}
      <div className="two fields">
        <div className="field">
          <label>Statut</label>
          <select
            name="statut"
            value={formData.statut}
            onChange={handleChange}
            className="ui dropdown"
          >
            <option value="en attente">En attente</option>
            <option value="en route">En route</option>
            <option value="arrived">Arrivée</option>
            <option value="terminée">Terminée</option>
          </select>
        </div>

        <div className="required field">
          <label>Date et heure</label>
          <input
            type="datetime-local"
            name="dateTime"
            value={formData.dateTime}
            onChange={handleChange}
            className={errors.dateTime ? "error" : ""}
          />
          {errors.dateTime && (
            <div className="ui pointing red basic label">{errors.dateTime}</div>
          )}
        </div>
      </div>

      {/* ✅ Description - Caché (utilisé mais non affiché) */}
      <input type="hidden" name="description" value={formData.description} />

      <div className="two fields">
        <div className="field">
          <label>Ambulance assignée</label>
          <select
            name="ambulance_id"
            value={formData.ambulance_id}
            onChange={handleChange}
            className="ui dropdown"
          >
            <option value="">Non assignée</option>
            {ambulances
              .filter(
                (amb) =>
                  amb.statut === "Disponible" ||
                  amb.id.toString() === formData.ambulance_id,
              )
              .map((ambulance) => (
                <option key={ambulance.id} value={ambulance.id}>
                  🚑 {ambulance.immatriculation} - {ambulance.type}
                </option>
              ))}
          </select>
          <div
            className="ui info message"
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
            }}
          >
            <small>
              💡 Sélectionnez une ambulance pour l'assigner à cette intervention
            </small>
          </div>
        </div>

        {/* ✅ Hospital destination - Caché (utilisé mais non affiché) */}
        <input type="hidden" name="hospital_id" value={formData.hospital_id} />
      </div>

      {/* GPS Coordinates */}
      <div className="col-span-2 border-t border-slate-100 pt-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1 bg-green-50 text-green-600 rounded-md">
            <MapPin size={16} />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            Coordonnées GPS & Localisation{" "}
            <span className="text-xs text-slate-400 font-normal ml-1">
              (Optionnel)
            </span>
          </h4>
          {formData.latitude && formData.longitude && (
            <span className="ui tiny green label">✓ Localisé</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="field">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Latitude
            </label>
            <div className="ui left icon input w-full">
              <i className="map pin icon !text-slate-400"></i>
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                step="any"
                placeholder="Ex: 35.1930"
                className="!rounded-lg !border-slate-200 focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500"
              />
            </div>
          </div>

          <div className="field">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Longitude
            </label>
            <div className="ui left icon action input w-full">
              <i className="map pin icon !text-slate-400"></i>
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                step="any"
                placeholder="Ex: -0.6270"
                className="!rounded-lg !border-slate-200 focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500"
              />
              <button
                type="button"
                className="ui icon button !bg-slate-50 hover:!bg-blue-50 hover:!text-blue-600 !border-l !border-slate-200 !transition-colors flex items-center justify-center"
                onClick={handleGetLocation}
                title="Position actuelle"
                style={{
                  borderTopRightRadius: "0.5rem",
                  borderBottomRightRadius: "0.5rem",
                }}
              >
                <Crosshair size={15} />
              </button>
              <button
                type="button"
                className="ui icon button !bg-slate-50 hover:!bg-green-50 hover:!text-green-600 !border-l !border-slate-200 !transition-colors flex items-center justify-center"
                onClick={() => setShowGpsModal(true)}
                title="Ouvrir la carte"
                style={{
                  borderTopRightRadius: "0.5rem",
                  borderBottomRightRadius: "0.5rem",
                }}
              >
                <MapIcon size={15} className="text-emerald-600" />
              </button>
            </div>
          </div>
        </div>

        {formData.latitude && formData.longitude && (
          <div
            className="ui info message"
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem",
              fontSize: "0.75rem",
            }}
          >
            <small>
              📍 Position: {Number(formData.latitude).toFixed(4)},{" "}
              {Number(formData.longitude).toFixed(4)}
            </small>
          </div>
        )}
      </div>

      <div className="ui info message" style={{ marginTop: "1.5rem" }}>
        <div className="header">Information</div>
        <p>
          La localisation GPS permet de positionner précisément l'intervention
          sur la carte et d'optimiser le dispatch des ambulances.
        </p>
      </div>

      <div
        className="flex justify-end gap-3 pt-6 border-t border-slate-100"
        style={{ marginTop: "1.5rem" }}
      >
        <button
          type="button"
          className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 text-gray-700 font-semibold rounded-lg shadow-sm transition-all duration-200 cursor-pointer text-sm"
          onClick={onCancel}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 cursor-pointer text-sm"
        >
          {isEditing ? "Mettre à jour" : "Créer"}
        </button>
      </div>

      <GpsPickerModal
        isOpen={showGpsModal}
        onClose={() => setShowGpsModal(false)}
        onSelect={(lat, lng) => {
          setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
          setShowGpsModal(false);
        }}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
      />
    </form>
  );
};

export default InterventionForm;
