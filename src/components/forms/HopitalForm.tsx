import React, { useState } from 'react';
import type { Hopital } from '../../data/mockData';
import { MapPin, Crosshair, Map as MapIcon } from 'lucide-react';
import GpsPickerModal from '../common/GpsPickerModal';

interface HopitalFormProps {
  hopital: Hopital | null;
  onSave: (hopital: Partial<Hopital>) => void;
  onCancel: () => void;
}

const HopitalForm: React.FC<HopitalFormProps> = ({ hopital, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    nom: hopital?.nom || '',
    adresse: hopital?.adresse || '',
    telephone: hopital?.telephone || '',
    email: hopital?.email || '',
    latitude: hopital?.latitude?.toString() || '',
    longitude: hopital?.longitude?.toString() || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showGpsModal, setShowGpsModal] = useState(false);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6)
          }));
        },
        (error) => {
          alert("Impossible de récupérer votre position : " + error.message);
        }
      );
    } else {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est requis';
    }
    if (!formData.adresse.trim()) {
      newErrors.adresse = 'L\'adresse est requise';
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    const hopitalData = {
      ...formData,
      latitude: formData.latitude ? Number(formData.latitude) : undefined,
      longitude: formData.longitude ? Number(formData.longitude) : undefined
    };

    onSave(hopitalData);
  };

  return (
    <form className="ui form" onSubmit={handleSubmit}>
      <div className="required field">
        <label>Nom de l'hôpital</label>
        <input
          type="text"
          name="nom"
          value={formData.nom}
          onChange={handleChange}
          placeholder="Ex: Hôpital Universitaire Abdelkader Hassani"
          className={errors.nom ? 'error' : ''}
        />
        {errors.nom && (
          <div className="ui pointing red basic label">
            {errors.nom}
          </div>
        )}
      </div>

      <div className="required field">
        <label>Adresse</label>
        <textarea
          name="adresse"
          value={formData.adresse}
          onChange={handleChange}
          rows={3}
          placeholder="Adresse complète de l'hôpital"
          className={errors.adresse ? 'error' : ''}
        />
        {errors.adresse && (
          <div className="ui pointing red basic label">
            {errors.adresse}
          </div>
        )}
      </div>

      <div className="two fields">
        <div className="field">
          <label>Téléphone</label>
          <input
            type="tel"
            name="telephone"
            value={formData.telephone}
            onChange={handleChange}
            placeholder="Ex: +213-48-123-456"
          />
        </div>

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="contact@hopital.dz"
            className={errors.email ? 'error' : ''}
          />
          {errors.email && (
            <div className="ui pointing red basic label">
              {errors.email}
            </div>
          )}
        </div>
      </div>

      {/* GPS Coordinates */}
      <div className="col-span-2 border-t border-slate-100 pt-6 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1 bg-green-50 text-green-600 rounded-md">
            <MapPin size={16} />
          </div>
          <h4 className="text-sm font-bold text-slate-800">
            Coordonnées GPS & Localisation <span className="text-xs text-slate-400 font-normal ml-1">(Optionnel)</span>
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="field">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Latitude</label>
            <div className="ui left icon input w-full">
              <i className="map pin icon !text-slate-400"></i>
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                step="any"
                placeholder="Ex: 35.1950"
                className="!rounded-lg !border-slate-200 focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500"
              />
            </div>
          </div>

          <div className="field">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Longitude</label>
            <div className="ui left icon action input w-full">
              <i className="map pin icon !text-slate-400"></i>
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                step="any"
                placeholder="Ex: -0.6280"
                className="!rounded-lg !border-slate-200 focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500"
              />
              <button
                type="button"
                className="ui icon button !bg-slate-50 hover:!bg-blue-50 hover:!text-blue-600 !border-l !border-slate-200 !transition-colors flex items-center justify-center"
                onClick={handleGetLocation}
                title="Position actuelle"
                style={{ borderTopRightRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
              >
                <Crosshair size={15} />
              </button>
              <button
                type="button"
                className="ui icon button !bg-slate-50 hover:!bg-green-50 hover:!text-green-600 !border-l !border-slate-200 !transition-colors flex items-center justify-center"
                onClick={() => setShowGpsModal(true)}
                title="Ouvrir la carte"
                style={{ borderTopRightRadius: '0.5rem', borderBottomRightRadius: '0.5rem' }}
              >
                <MapIcon size={15} className="text-emerald-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="ui info message" style={{ marginTop: '1.5rem' }}>
        <div className="header">Information</div>
        <p>
          La position GPS permet de localiser l'hôpital sur la carte et d'optimiser 
          les transferts de patients.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100" style={{ marginTop: '1.5rem' }}>
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
          Enregistrer
        </button>
      </div>
      <GpsPickerModal 
        isOpen={showGpsModal}
        onClose={() => setShowGpsModal(false)}
        onSelect={(lat, lng, address) => {
          setFormData(prev => ({ 
            ...prev, 
            latitude: lat, 
            longitude: lng,
            ...(address && { adresse: address }) 
          }));
          setShowGpsModal(false);
        }}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
      />
    </form>
  );
};

export default HopitalForm;