export interface Ambulance {
  id: number;
  immatriculation: string;
  type: string;
  statut: 'Disponible' | 'En mission' | 'En panne' | 'Maintenance';
  dateMiseService: string;
  kilometrage: number;
  latitude?: number;
  longitude?: number;
  parkingId?: number;
}

export interface Parking {
  id: number;
  nom: string;
  adresse: string;
  capacite: number;
  latitude?: number;
  longitude?: number;
}

export interface Hopital {
  id: number;
  nom: string;
  adresse: string;
  telephone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  nbInterventions: number;
}

export interface Intervention {
  id: number;
  type: string;
  dateHeure: string;
  description: string;
  latitude?: number;
  longitude?: number;
  statut: 'En cours' | 'Terminée';
  ambulanceId?: number;
  hopitalId?: number;
}

export interface Personnel {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  role: 'medecin' | 'chauffeur' | 'brancardier';
  telephone?: string;
  email?: string;
  ambulanceId?: number;
  dateCreation: string;
}

// Mock data for demonstration
export const mockAmbulances: Ambulance[] = [
  { id: 1, immatriculation: 'AMB001SBA', type: 'Type A', statut: 'Disponible', dateMiseService: '2023-01-15', kilometrage: 45000, latitude: 35.1919, longitude: -0.6298, parkingId: 1 },
  { id: 2, immatriculation: 'AMB002SBA', type: 'Type B', statut: 'En mission', dateMiseService: '2023-03-20', kilometrage: 32000, latitude: 35.1985, longitude: -0.6245, parkingId: 2 },
  { id: 3, immatriculation: 'AMB003SBA', type: 'Type A', statut: 'Maintenance', dateMiseService: '2022-11-10', kilometrage: 67000, latitude: 35.1850, longitude: -0.6350, parkingId: 1 },
  { id: 4, immatriculation: 'AMB004SBA', type: 'Type C', statut: 'Disponible', dateMiseService: '2023-05-05', kilometrage: 18000, latitude: 35.2020, longitude: -0.6180, parkingId: 3 }
];

export const mockParkings: Parking[] = [
  { id: 1, nom: 'Parking Central', adresse: 'Centre-ville Sidi Bel Abbès', capacite: 10, latitude: 35.1919, longitude: -0.6298 },
  { id: 2, nom: 'Parking Nord', adresse: 'Quartier Nord', capacite: 8, latitude: 35.1985, longitude: -0.6245 },
  { id: 3, nom: 'Parking Sud', adresse: 'Quartier Sud', capacite: 6, latitude: 35.1850, longitude: -0.6350 }
];

export const mockHopitaux: Hopital[] = [
  { id: 1, nom: 'Hôpital Universitaire Abdelkader Hassani', adresse: 'Rue de la République', telephone: '+213-48-123-456', email: 'contact@hu-hassani.dz', latitude: 35.1950, longitude: -0.6280, nbInterventions: 245 },
  { id: 2, nom: 'Clinique El Amal', adresse: 'Cité El Amal', telephone: '+213-48-789-012', email: 'info@elamal.dz', latitude: 35.1880, longitude: -0.6320, nbInterventions: 156 },
  { id: 3, nom: 'Centre de Santé Sidi Djilali', adresse: 'Boulevard Sidi Djilali', telephone: '+213-48-345-678', email: 'contact@cs-djilali.dz', latitude: 35.2000, longitude: -0.6200, nbInterventions: 89 }
];

export const mockInterventions: Intervention[] = [
  { id: 1, type: 'Accident de route', dateHeure: '2024-01-15T14:30:00', description: 'Collision entre deux véhicules', latitude: 35.1930, longitude: -0.6270, statut: 'En cours', ambulanceId: 2, hopitalId: 1 },
  { id: 2, type: 'Urgence cardiaque', dateHeure: '2024-01-15T09:15:00', description: 'Patient avec douleurs thoraciques', latitude: 35.1890, longitude: -0.6310, statut: 'Terminée', ambulanceId: 1, hopitalId: 2 },
  { id: 3, type: 'Chute', dateHeure: '2024-01-15T16:45:00', description: 'Personne âgée ayant chuté', latitude: 35.1970, longitude: -0.6250, statut: 'En cours', ambulanceId: 4, hopitalId: 1 },
  { id: 4, type: 'Malaise', dateHeure: '2024-01-14T20:30:00', description: 'Malaise dans un magasin', latitude: 35.1860, longitude: -0.6340, statut: 'Terminée', ambulanceId: 1, hopitalId: 3 }
];

export const mockPersonnels: Personnel[] = [
  { id: 1, matricule: 'MED001', nom: 'Bensaid', prenom: 'Ahmed', role: 'medecin', telephone: '+213-555-111-222', email: 'a.bensaid@urgence.dz', ambulanceId: 1, dateCreation: '2023-01-10T00:00:00' },
  { id: 2, matricule: 'CHA001', nom: 'Khelifi', prenom: 'Mohamed', role: 'chauffeur', telephone: '+213-555-333-444', email: 'm.khelifi@urgence.dz', ambulanceId: 1, dateCreation: '2023-01-10T00:00:00' },
  { id: 3, matricule: 'MED002', nom: 'Brahimi', prenom: 'Fatima', role: 'medecin', telephone: '+213-555-555-666', email: 'f.brahimi@urgence.dz', ambulanceId: 2, dateCreation: '2023-02-15T00:00:00' },
  { id: 4, matricule: 'BRA001', nom: 'Meziani', prenom: 'Karim', role: 'brancardier', telephone: '+213-555-777-888', email: 'k.meziani@urgence.dz', ambulanceId: 3, dateCreation: '2023-03-01T00:00:00' }
];