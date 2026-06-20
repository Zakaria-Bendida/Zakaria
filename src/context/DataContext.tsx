import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Types
export interface Ambulance {
  id: number;
  immatriculation: string;
  type: string;
  statut: string;
  latitude: number;
  longitude: number;
  kilometrage: number;
  parking_id?: number;
  date_mise_service?: string;
}

export interface Parking {
  id: number;
  nom: string;
  adresse: string;
  capacite: number;
  latitude: number;
  longitude: number;
}

export interface Hopital {
  id: number;
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  latitude: number;
  longitude: number;
  nb_interventions?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Intervention {
  id: number;
  type: string;
  description: string;
  statut: string;
  latitude_depart: number;
  longitude_depart: number;
  caller_name: string;
  caller_phone: string;
  ambulance_id?: number;
  hospital_id?: number;
  hopital_id?: number;
  ambulance_immatriculation?: string;
  date_intervention?: string;
  created_at?: string;
  updated_at?: string;
  priority?: string;
}

export interface Personnel {
  id: string;
  _id?: string;
  matricule?: string;
  nom: string;
  prenom: string;
  role: string;
  email: string;
  telephone: string;
  fullName?: string;
  ambulanceId?: number;
  isActive?: boolean;
  created_at?: string;
  isOnline?: boolean; // ✅ ADD THIS
  currentInterventionId?: number; // ✅ ADD THIS
}

interface DataContextType {
  ambulances: Ambulance[];
  parkings: Parking[];
  hopitaux: Hopital[];
  interventions: Intervention[];
  personnels: Personnel[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => void;
  addAmbulance: (data: Partial<Ambulance>) => Promise<any>;
  updateAmbulance: (id: number, data: Partial<Ambulance>) => Promise<any>;
  deleteAmbulance: (id: number) => Promise<any>;
  addParking: (data: Partial<Parking>) => Promise<any>;
  updateParking: (id: number, data: Partial<Parking>) => Promise<any>;
  deleteParking: (id: number) => Promise<any>;
  addHopital: (data: Partial<Hopital>) => Promise<any>;
  updateHopital: (id: number, data: Partial<Hopital>) => Promise<any>;
  deleteHopital: (id: number) => Promise<any>;
  addIntervention: (data: Partial<Intervention>) => Promise<any>;
  updateIntervention: (id: number, data: Partial<Intervention>) => Promise<any>;
  deleteIntervention: (id: number) => Promise<any>;
  addPersonnel: (data: Partial<Personnel>) => Promise<any>;
  updatePersonnel: (id: string, data: Partial<Personnel>) => Promise<any>;
  deletePersonnel: (id: string) => Promise<any>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [hopitaux, setHopitaux] = useState<Hopital[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [personnels, setPersonnels] = useState<Personnel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const isAuthenticated = !!user;

  const extractData = (response: any) => {
    if (!response) return [];
    if (response.success === true && response.data) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  };

  const mapIntervention = (intervention: any): Intervention => ({
    id: intervention.id,
    type: intervention.type,
    description: intervention.description,
    statut: intervention.statut,
    latitude_depart: intervention.latitude_depart,
    longitude_depart: intervention.longitude_depart,
    caller_name: intervention.caller_name,
    caller_phone: intervention.caller_phone,
    ambulance_id: intervention.ambulance_id,
    hospital_id: intervention.hospital_id || intervention.hopital_id,
    hopital_id: intervention.hopital_id || intervention.hospital_id,
    ambulance_immatriculation: intervention.ambulance_immatriculation,
    date_intervention: intervention.date_intervention,
    created_at: intervention.created_at,
    updated_at: intervention.updated_at,
    priority: intervention.priority,
  });

  const mapPersonnel = (user: any): Personnel => ({
    id: user._id || user.id,
    _id: user._id || user.id,
    matricule: user.matricule,
    nom:
      user.fullName?.split(" ").slice(1).join(" ") ||
      user.nom ||
      user.fullName ||
      "",
    prenom: user.fullName?.split(" ")[0] || user.prenom || "",
    role: user.role || "user",
    email: user.email,
    telephone: user.phone || user.telephone || "",
    fullName: user.fullName,
    ambulanceId: user.ambulanceId,
    isActive: user.isActive,
    created_at: user.createdAt,
    isOnline: user.isOnline === true,
    lastOnline: user.lastOnline, // ← MAKE SURE THIS LINE EXISTS
    currentInterventionId: user.currentInterventionId,
  });

  const loadAllData = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const headers = getAuthHeaders();

      const [ambData, parkData, hopData, intData, usersData] =
        await Promise.all([
          fetch(`${API_BASE_URL}/ambulances`, { headers }).then((res) =>
            res.ok ? res.json() : null,
          ),
          fetch(`${API_BASE_URL}/parkings`, { headers }).then((res) =>
            res.ok ? res.json() : null,
          ),
          fetch(`${API_BASE_URL}/hospitals`, { headers }).then((res) =>
            res.ok ? res.json() : null,
          ),
          fetch(`${API_BASE_URL}/interventions`, { headers }).then((res) =>
            res.ok ? res.json() : null,
          ),
          fetch(`${API_BASE_URL}/users`, { headers }).then((res) =>
            res.ok ? res.json() : null,
          ),
        ]);

      if (ambData) setAmbulances(extractData(ambData));
      if (parkData) setParkings(extractData(parkData));
      if (hopData) setHopitaux(extractData(hopData));
      if (intData) setInterventions(extractData(intData).map(mapIntervention));
      if (usersData) setPersonnels(extractData(usersData).map(mapPersonnel));
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    } else {
      setAmbulances([]);
      setParkings([]);
      setHopitaux([]);
      setInterventions([]);
      setPersonnels([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadAllData]);

  const addItem = async (endpoint: string, data: any) => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) await loadAllData();
    return result;
  };

  const updateItem = async (
    endpoint: string,
    id: number | string,
    data: any,
  ) => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) await loadAllData();
    return result;
  };

  const deleteItem = async (endpoint: string, id: number | string) => {
    if (!user) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const result = await res.json();
    if (result.success) await loadAllData();
    return result;
  };

  // Handlers
  const addAmbulance = (data: Partial<Ambulance>) =>
    addItem("ambulances", data);
  const updateAmbulance = (id: number, data: Partial<Ambulance>) =>
    updateItem("ambulances", id, data);
  const deleteAmbulance = (id: number) => deleteItem("ambulances", id);

  const addParking = (data: Partial<Parking>) => addItem("parkings", data);
  const updateParking = (id: number, data: Partial<Parking>) =>
    updateItem("parkings", id, data);
  const deleteParking = (id: number) => deleteItem("parkings", id);

  const addHopital = (data: Partial<Hopital>) => addItem("hospitals", data);
  const updateHopital = (id: number, data: Partial<Hopital>) =>
    updateItem("hospitals", id, data);
  const deleteHopital = (id: number) => deleteItem("hospitals", id);

  const addIntervention = (data: Partial<Intervention>) =>
    addItem("interventions", data);
  // In DataContext.tsx, make sure updateIntervention is properly defined
  const updateIntervention = async (
    id: number,
    data: Partial<Intervention>,
  ) => {
    return updateItem("interventions", id, data);
  };
  const deleteIntervention = (id: number) => deleteItem("interventions", id);

  const addPersonnel = (data: Partial<Personnel>) => addItem("users", data);
  const updatePersonnel = (id: string, data: Partial<Personnel>) =>
    updateItem("users", id, data);
  const deletePersonnel = (id: string) => deleteItem("users", id);

  const refreshData = () => {
    if (isAuthenticated) loadAllData();
  };

  const value: DataContextType = {
    ambulances,
    parkings,
    hopitaux,
    interventions,
    personnels,
    isLoading,
    error,
    refreshData,
    addAmbulance,
    updateAmbulance,
    deleteAmbulance,
    addParking,
    updateParking,
    deleteParking,
    addHopital,
    updateHopital,
    deleteHopital,
    addIntervention,
    updateIntervention,
    deleteIntervention,
    addPersonnel,
    updatePersonnel,
    deletePersonnel,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
