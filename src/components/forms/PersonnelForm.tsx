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
    matricule: personnel?.matricule || "",
    nom: personnel?.nom || "",
    prenom: personnel?.prenom || "",
    role: personnel?.role || "ambulancier",
    telephone: personnel?.telephone || "",
    email: personnel?.email || "",
    ambulanceId: personnel?.ambulanceId?.toString() || "",
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
        matricule: personnel.matricule,
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

    if (!isEditing && !formData.matricule.trim()) {
      newErrors.matricule = "Le matricule est requis";
    }
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
    if (!formData.telephone.trim()) {
      newErrors.telephone = "Le téléphone est requis";
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
      telephone: formData.telephone,
      email: formData.email,
    };

    // Only include matricule for new users
    if (!isEditing) {
      personnelData.matricule = formData.matricule;
      personnelData.password = "default123"; // Add a default password for new users
    }

    // Only include ambulanceId for ambulancier role
    if (formData.role === "ambulancier" && formData.ambulanceId) {
      personnelData.ambulanceId = Number(formData.ambulanceId);
    }

    // Include id when editing
    if (isEditing && formData.id) {
      personnelData.id = formData.id;
    }

    console.log("📤 Saving personnel data:", personnelData);
    onSave(personnelData);
  };
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "manager":
        return "Administrateur";
      case "ambulancier":
        return "Chauffeur Ambulancier";
      default:
        return role;
    }
  };

  return (
    <form className="ui form" onSubmit={handleSubmit}>
      <div className="two fields">
        <div className={`${!isEditing ? "required" : ""} field`}>
          <label>Matricule</label>
          <input
            type="text"
            name="matricule"
            value={formData.matricule}
            onChange={handleChange}
            placeholder="Ex: DRV001"
            readOnly={isEditing}
            disabled={isEditing}
            style={
              isEditing
                ? { backgroundColor: "#f5f5f5", cursor: "not-allowed" }
                : {}
            }
            className={errors.matricule ? "error" : ""}
          />
          {isEditing && (
            <div
              className="ui tiny info message"
              style={{ marginTop: "0.25rem", padding: "0.25rem 0.5rem" }}
            >
              <small>⚠️ Le matricule ne peut pas être modifié</small>
            </div>
          )}
          {errors.matricule && (
            <div className="ui pointing red basic label">
              {errors.matricule}
            </div>
          )}
        </div>

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
            name="telephone"
            value={formData.telephone}
            onChange={handleChange}
            placeholder="Ex: 0555123456"
            className={errors.telephone ? "error" : ""}
          />
          {errors.telephone && (
            <div className="ui pointing red basic label">
              {errors.telephone}
            </div>
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
