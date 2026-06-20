import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Ambulance,
  MapPin,
  Building2,
  AlertTriangle,
  Users,
  Map as MapIcon,
  Menu,
  LogOut,
  UserCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { path: "/dashboard", name: "Tableau de Bord", icon: LayoutDashboard },
    { path: "/ambulances", name: "Ambulances", icon: Ambulance },
    { path: "/parkings", name: "Parkings", icon: MapPin },
    { path: "/hopitaux", name: "Hôpitaux", icon: Building2 },
    { path: "/interventions", name: "Interventions", icon: AlertTriangle },
    { path: "/personnels", name: "Personnels", icon: Users },
    { path: "/carte", name: "Carte", icon: MapIcon },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getRoleLabel = () => {
    if (!user) return "Utilisateur";
    switch (user.role) {
      case "manager":
        return "Administrateur";
      case "ambulancier":
        return "Chauffeur";
      default:
        return "Utilisateur";
    }
  };

  return (
    <div className="app-layout">
      <button
        className="mobile-menu-btn"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        <Menu size={24} />
      </button>

      {isMobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <div
        className={`sidebar ${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">
            <AlertTriangle size={28} />
          </div>
          {!isCollapsed && (
            <div className="logo-text">
              <h1>Gestion d'Urgence</h1>
              <p>Sidi Bel Abbès</p>
            </div>
          )}
        </div>

        <button
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.name : ""}
              >
                <Icon size={20} />
                {!isCollapsed && <span>{item.name}</span>}
                {active && !isCollapsed && <div className="active-dot" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="user-info">
            <div className="user-avatar">
              <UserCircle size={24} />
            </div>
            {!isCollapsed && (
              <div className="user-details">
                <p className="user-name">
                  {user?.fullName?.split(" ")[0] || "Utilisateur"}
                </p>
                <p className="user-role">{getRoleLabel()}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Déconnexion</span>
            </button>
          )}
          {isCollapsed && (
            <button
              className="logout-btn-icon"
              onClick={handleLogout}
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>

      <main
        className={`main-content ${isCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <div className="content-wrapper">{children}</div>
      </main>

      <style>{`
        .app-layout {
          display: flex;
          min-height: 100vh;
          background: #f1f5f9;
        }

        .mobile-menu-btn {
          position: fixed;
          top: 16px;
          left: 16px;
          z-index: 1000;
          background: #2563eb;
          border: none;
          color: white;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          display: none;
        }

        .mobile-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 900;
          display: none;
        }

        /* Sidebar - Light grey (darker than body) */
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          height: 100vh;
          width: 260px;
          background: #e2e8f0;
          border-right: 1px solid #cbd5e1;
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
          z-index: 1000;
          overflow-x: hidden;
        }

        .sidebar.collapsed {
          width: 72px;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 16px;
          border-bottom: 1px solid #cbd5e1;
        }

        .logo-icon {
          background: #2563eb;
          padding: 8px;
          border-radius: 12px;
          min-width: 44px;
        }

        .logo-icon svg {
          color: white;
        }

        .logo-text h1 {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .logo-text p {
          font-size: 11px;
          color: #475569;
          margin: 2px 0 0;
        }

        .collapse-btn {
          position: absolute;
          right: -12px;
          top: 80px;
          background: white;
          border: 1px solid #cbd5e1;
          color: #475569;
          width: 24px;
          height: 24px;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .collapse-btn:hover {
          background: #f8fafc;
        }

        .sidebar-nav {
          flex: 1;
          padding: 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          color: #334155;
          text-decoration: none;
          transition: all 0.2s;
          font-weight: 500;
        }

        .nav-item:hover {
          background: #cbd5e1;
          color: #0f172a;
        }

        .nav-item.active {
          background: #2563eb;
          color: white;
        }

        .active-dot {
          width: 4px;
          height: 4px;
          background: white;
          border-radius: 2px;
          margin-left: auto;
        }

        .sidebar.collapsed .nav-item {
          justify-content: center;
          padding: 10px;
        }

        .sidebar.collapsed .nav-item span {
          display: none;
        }

        .sidebar-user {
          padding: 16px;
          border-top: 1px solid #cbd5e1;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .user-avatar {
          background: #cbd5e1;
          padding: 6px;
          border-radius: 10px;
          min-width: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .user-avatar svg {
          color: #334155;
        }

        .user-name {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .user-role {
          font-size: 11px;
          color: #475569;
          margin: 2px 0 0;
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          border: none;
          background: #ef4444;
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: #dc2626;
        }

        .logout-btn-icon {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 8px;
          border-radius: 8px;
          border: none;
          background: #ef4444;
          color: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn-icon:hover {
          background: #dc2626;
        }

        /* Main content */
        .main-content {
          flex: 1;
          margin-left: 260px;
          transition: margin-left 0.3s ease;
          background: #f1f5f9;
          min-height: 100vh;
        }

        .main-content.sidebar-collapsed {
          margin-left: 72px;
        }

        .content-wrapper {
          padding: 24px 32px 32px 32px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .content-wrapper {
            padding: 20px 24px;
          }
        }

        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .mobile-overlay {
            display: block;
          }
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          .sidebar.mobile-open {
            transform: translateX(0);
          }
          .main-content {
            margin-left: 0;
          }
          .main-content.sidebar-collapsed {
            margin-left: 0;
          }
          .content-wrapper {
            padding: 16px;
          }
        }

        @media (min-width: 1400px) {
          .content-wrapper {
            padding: 32px 40px;
          }
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
