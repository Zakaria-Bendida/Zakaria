import React from "react";
import {
  Ambulance,
  Building2,
  MapPin,
  AlertTriangle,
  Users,
  Map,
  LayoutDashboard,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface NavigationProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({
  activeModule,
  onModuleChange,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { key: "dashboard", name: "Tableau de Bord", icon: LayoutDashboard },
    { key: "ambulances", name: "Ambulances", icon: Ambulance },
    { key: "parkings", name: "Parkings", icon: MapPin },
    { key: "hopitaux", name: "Hôpitaux", icon: Building2 },
    { key: "interventions", name: "Interventions", icon: AlertTriangle },
    { key: "personnels", name: "Personnels", icon: Users },
    { key: "carte", name: "Carte", icon: Map },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div
      className="ui secondary pointing menu"
      style={{ marginBottom: "2rem" }}
    >
      <div className="ui container">
        <div className="item">
          <h2 className="ui header">
            <Ambulance className="mr-2" />
            <div className="content">
              Gestion d'Urgence
              <div className="sub header">Sidi Bel Abbès</div>
            </div>
          </h2>
        </div>

        <div className="right menu">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <a
                key={item.key}
                className={`item ${activeModule === item.key ? "active" : ""}`}
                onClick={() => onModuleChange(item.key)}
                style={{ cursor: "pointer" }}
              >
                <IconComponent size={16} className="mr-2" />
                {item.name}
              </a>
            );
          })}

          {/* User info and logout */}
          <div
            className="item"
            style={{
              borderLeft: "1px solid rgba(0,0,0,0.1)",
              marginLeft: "0.5rem",
            }}
          >
            <div className="ui compact menu">
              <div className="ui simple dropdown item">
                <UserCircle size={16} className="mr-2" />
                <span>{user?.fullName?.split(" ")[0] || "Utilisateur"}</span>
                <i className="dropdown icon"></i>
                <div className="menu">
                  <div className="item" style={{ padding: "0.5rem 1rem" }}>
                    <strong>{user?.fullName}</strong>
                    <br />
                    <small className="text-muted">
                      {user?.role === "manager"
                        ? "Administrateur"
                        : user?.role === "ambulancier"
                          ? "Chauffeur"
                          : "Utilisateur"}
                    </small>
                  </div>
                  <div className="divider" style={{ margin: 0 }}></div>
                  <div
                    className="item"
                    onClick={handleLogout}
                    style={{ cursor: "pointer" }}
                  >
                    <LogOut size={14} className="mr-2" />
                    Déconnexion
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
