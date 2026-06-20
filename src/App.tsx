// import React from "react";
// import {
//   BrowserRouter as Router,
//   Routes,
//   Route,
//   Navigate,
//   useNavigate,
// } from "react-router-dom";
// import { AuthProvider } from "./context/AuthContext";
// import { DataProvider } from "./context/DataContext";
// import ProtectedRoute from "./components/ProtectedRoute";
// import LoginPage from "./pages/LoginPage";
// import Navigation from "./components/Navigation";
// import Dashboard from "./components/Dashboard";
// import AmbulancesModule from "./components/modules/AmbulancesModule";
// import ParkingsModule from "./components/modules/ParkingsModule";
// import HopitauxModule from "./components/modules/HopitauxModule";
// import InterventionsModule from "./components/modules/InterventionsModule";
// import PersonnelsModule from "./components/modules/PersonnelsModule";
// import MapModule from "./components/modules/MapModule";

// const AuthenticatedApp = () => {
//   const [activeModule, setActiveModule] = React.useState("dashboard");
//   const navigate = useNavigate();

//   const handleModuleChange = (module: string) => {
//     setActiveModule(module);
//     navigate(`/${module}`);
//   };

//   return (
//     <>
//       <Navigation
//         activeModule={activeModule}
//         onModuleChange={handleModuleChange}
//       />
//       <div className="ui container" style={{ marginTop: "2rem" }}>
//         <Routes>
//           <Route path="/dashboard" element={<Dashboard />} />
//           <Route path="/ambulances" element={<AmbulancesModule />} />
//           <Route path="/parkings" element={<ParkingsModule />} />
//           <Route path="/hopitaux" element={<HopitauxModule />} />
//           <Route path="/interventions" element={<InterventionsModule />} />
//           <Route path="/personnels" element={<PersonnelsModule />} />
//           <Route path="/carte" element={<MapModule />} />
//           <Route path="/" element={<Navigate to="/dashboard" replace />} />
//         </Routes>
//       </div>
//     </>
//   );
// };

// function App() {
//   return (
//     <Router>
//       <AuthProvider>
//         <DataProvider>
//           <Routes>
//             <Route path="/login" element={<LoginPage />} />
//             <Route
//               path="/*"
//               element={
//                 <ProtectedRoute>
//                   <AuthenticatedApp />
//                 </ProtectedRoute>
//               }
//             />
//           </Routes>
//         </DataProvider>
//       </AuthProvider>
//     </Router>
//   );
// }

// export default App;

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Layout/Sidebar";
import Dashboard from "./components/Dashboard";
import AmbulancesModule from "./components/modules/AmbulancesModule";
import ParkingsModule from "./components/modules/ParkingsModule";
import HopitauxModule from "./components/modules/HopitauxModule";
import InterventionsModule from "./components/modules/InterventionsModule";
import PersonnelsModule from "./components/modules/PersonnelsModule";
import MapModule from "./components/modules/MapModule";

function App() {
  return (
    <Router>
      <AuthProvider>
        <DataProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Sidebar>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route
                        path="/ambulances"
                        element={<AmbulancesModule />}
                      />
                      <Route path="/parkings" element={<ParkingsModule />} />
                      <Route path="/hopitaux" element={<HopitauxModule />} />
                      <Route
                        path="/interventions"
                        element={<InterventionsModule />}
                      />
                      <Route
                        path="/personnels"
                        element={<PersonnelsModule />}
                      />
                      <Route path="/carte" element={<MapModule />} />
                      <Route
                        path="/"
                        element={<Navigate to="/dashboard" replace />}
                      />
                    </Routes>
                  </Sidebar>
                </ProtectedRoute>
              }
            />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
