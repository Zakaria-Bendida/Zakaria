import React, { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import type { Personnel } from "../../context/DataContext";

interface PersonnelFormProps {
  personnel: Personnel | null;
  onSave: (personnel: Partial<Personnel>) => void;
  onCancel: () => void;
}

const PersonnelForm: React.FC<PersonnelFormProps> = ({
  personnel,
  onSave,
  onCancel,
}) => {
  const { ambulances } = useData();
  const [formData, setFormData] = useState({
    id: personnel?.id || "",
    nom: personnel?.nom || "",
    prenom: personnel?.prenom || "",
    role: personnel?.role || "ambulancier",
    phone: personnel?.phone || "", // ✅ Changé telephone → phone
    email: personnel?.email || "",
    ambulanceId: personnel?.ambulanceId?.toString() || "",
    password: "", // ✅ Ajout du mot de passe
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditing = !!personnel;

  useEffect(() => {
    if (personnel) {
      console.log("📝 Editing personnel:", {
        id: personnel.id,
        nom: personnel.nom,
        prenom: personnel.prenom,
        role: personnel.role,
        phone: personnel.phone,
      });
    }
  }, [personnel]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nom.trim()) {
      newErrors.nom = "Le nom est requis";
    }
    if (!formData.prenom.trim()) {
      newErrors.prenom = "Le prénom est requis";
    }
    if (!formData.role) {
      newErrors.role = "Le rôle est requis";
    }
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Format d'email invalide";
    }
    if (!formData.phone.trim()) {
      // ✅ Changé telephone → phone
      newErrors.phone = "Le téléphone est requis";
    }
    if (!isEditing && !formData.password.trim()) {
      newErrors.password =
        "Le mot de passe est requis pour un nouvel utilisateur";
    }
    if (
      !isEditing &&
      formData.password.length > 0 &&
      formData.password.length < 6
    ) {
      newErrors.password =
        "Le mot de passe doit contenir au moins 6 caractères";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const personnelData: any = {
      nom: formData.nom,
      prenom: formData.prenom,
      role: formData.role,
      phone: formData.phone, // ✅ Changé telephone → phone
      email: formData.email,
      matricule: null,
    };

    // ✅ Gestion du mot de passe
    if (!isEditing) {
      // Si un mot de passe est fourni, l'utiliser, sinon utiliser le défaut
      personnelData.password = formData.password.trim() || "default123";
    }

    if (formData.role === "ambulancier" && formData.ambulanceId) {
      personnelData.ambulanceId = Number(formData.ambulanceId);
    }

    if (isEditing && formData.id) {
      personnelData.id = formData.id;
    }

    console.log("📤 Saving personnel data:", {
      ...personnelData,
      password: "***hidden***",
    });
    onSave(personnelData);
  };

  return (
    <form className="ui form" onSubmit={handleSubmit}>
      {/* Hidden matricule */}
      <input type="hidden" name="matricule" value="" />

      <div className="two fields">
        <div className="required field">
          <label>Rôle</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className={`ui dropdown ${errors.role ? "error" : ""}`}
          >
            <option value="manager">Administrateur</option>
            <option value="ambulancier">Chauffeur Ambulancier</option>
          </select>
          {errors.role && (
            <div className="ui pointing red basic label">{errors.role}</div>
          )}
        </div>

        <div className="required field">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="nom.prenom@urgence.dz"
            className={errors.email ? "error" : ""}
          />
          {errors.email && (
            <div className="ui pointing red basic label">{errors.email}</div>
          )}
        </div>
      </div>

      <div className="two fields">
        <div className="required field">
          <label>Nom</label>
          <input
            type="text"
            name="nom"
            value={formData.nom}
            onChange={handleChange}
            placeholder="Nom de famille"
            className={errors.nom ? "error" : ""}
          />
          {errors.nom && (
            <div className="ui pointing red basic label">{errors.nom}</div>
          )}
        </div>

        <div className="required field">
          <label>Prénom</label>
          <input
            type="text"
            name="prenom"
            value={formData.prenom}
            onChange={handleChange}
            placeholder="Prénom"
            className={errors.prenom ? "error" : ""}
          />
          {errors.prenom && (
            <div className="ui pointing red basic label">{errors.prenom}</div>
          )}
        </div>
      </div>

      <div className="two fields">
        <div className="required field">
          <label>Téléphone</label>
          <input
            type="tel"
            name="phone" // ✅ Changé telephone → phone
            value={formData.phone}
            onChange={handleChange}
            placeholder="Ex: 0555123456"
            className={errors.phone ? "error" : ""}
          />
          {errors.phone && (
            <div className="ui pointing red basic label">{errors.phone}</div>
          )}
        </div>

        <div className={`field ${!isEditing ? "required" : ""}`}>
          <label>Mot de passe</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={
              isEditing ? "Laisser vide pour garder l'actuel" : "••••••••"
            }
            className={errors.password ? "error" : ""}
            disabled={isEditing}
            style={
              isEditing
                ? { backgroundColor: "#f5f5f5", cursor: "not-allowed" }
                : {}
            }
          />
          {isEditing && (
            <div
              className="ui tiny info message"
              style={{ marginTop: "0.25rem", padding: "0.25rem 0.5rem" }}
            >
              <small>
                💡 Laisser vide pour conserver le mot de passe actuel
              </small>
            </div>
          )}
          {!isEditing && (
            <div
              className="ui tiny info message"
              style={{ marginTop: "0.25rem", padding: "0.25rem 0.5rem" }}
            >
              <small>
                💡 Par défaut: <strong>default123</strong>
              </small>
            </div>
          )}
          {errors.password && (
            <div className="ui pointing red basic label">{errors.password}</div>
          )}
        </div>
      </div>

      {/* Ambulance assignment - only for chauffeurs */}
      {formData.role === "ambulancier" && (
        <div className="field">
          <label>Ambulance assignée</label>
          <select
            name="ambulanceId"
            value={formData.ambulanceId}
            onChange={handleChange}
            className="ui dropdown"
          >
            <option value="">Aucune ambulance</option>
            {ambulances.map((ambulance) => (
              <option key={ambulance.id} value={ambulance.id}>
                🚑 {ambulance.immatriculation} - {ambulance.type} (
                {ambulance.statut})
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
              💡 L'ambulance assignée sera utilisée pour les missions de ce
              chauffeur
            </small>
          </div>
        </div>
      )}

      <div className="ui info message">
        <div className="header">Information</div>
        <p>
          <strong>Administrateur:</strong> Accès complet à toutes les
          fonctionnalités.
          <br />
          <strong>Chauffeur Ambulancier:</strong> Peut être assigné à une
          ambulance et gérer les interventions.
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
    </form>
  );
};

export default PersonnelForm;
