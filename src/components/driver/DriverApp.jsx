import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import useDriverSession from "./useDriverSession.js";
import useDriverManifest from "../../hooks/useDriverManifest.js";
import DriverLogin from "./DriverLogin.jsx";
import DriverHome from "./DriverHome.jsx";
import DriverLoadSequence from "./DriverLoadSequence.jsx";
import DriverTripDone from "./DriverTripDone.jsx";
import DriverProfile from "./DriverProfile.jsx";

function Tabs() {
  const item = ({ to, label }) => (
    <NavLink to={to} end={to === "/conductor"} className={({ isActive }) => `drv-tab${isActive ? " is-on" : ""}`}>
      {label}
    </NavLink>
  );
  return (
    <nav className="drv-tabs">
      {item({ to: "/conductor", label: "Inicio" })}
      {item({ to: "/conductor/carga", label: "Carga" })}
      {item({ to: "/conductor/listo", label: "Listo" })}
      {item({ to: "/conductor/perfil", label: "Perfil" })}
    </nav>
  );
}

export default function DriverApp() {
  useDriverManifest();
  const sess = useDriverSession();
  const navigate = useNavigate();
  const location = useLocation();
  const onLoginScreen = /\/ingresar\/?$/.test(location.pathname);

  const evidence = async (file) => {
    try {
      sess.setStatus("Subiendo…");
      await sess.uploadB64("foto", file);
      sess.setStatus("");
    } catch (e) {
      sess.setStatus(e.message || String(e));
    }
  };

  return (
    <div className="drv-app">
      <Routes>
        <Route
          index
          element={
            <DriverHome
              profile={sess.profile}
              trip={sess.trip}
              plan={sess.plan}
              stops={sess.stops}
              timeline={sess.timeline}
              pendingCount={sess.pendingCount}
              online={sess.online}
              guest={!sess.token}
              status={sess.status}
              onSync={sess.syncOutbox}
              onGoCarga={() => navigate("/conductor/carga")}
              onLogin={() => navigate("/conductor/ingresar")}
              onEvidence={evidence}
            />
          }
        />
        <Route
          path="carga"
          element={
            <DriverLoadSequence
              timeline={sess.timeline}
              plan={sess.plan}
              stops={sess.stops}
              trip={sess.trip}
              sendEvent={sess.sendEvent}
              onAfterDepart={() => navigate("/conductor/listo")}
            />
          }
        />
        <Route
          path="listo"
          element={
            <DriverTripDone
              stops={sess.stops}
              timeline={sess.timeline}
              plan={sess.plan}
              trip={sess.trip}
              onHome={() => navigate("/conductor")}
              onEvidence={evidence}
            />
          }
        />
        <Route
          path="perfil"
          element={
            <DriverProfile
              profile={sess.profile}
              pendingCount={sess.pendingCount}
              online={sess.online}
              guest={!sess.token}
              onSave={sess.saveProfile}
              onLogout={sess.logout}
              onLogin={() => navigate("/conductor/ingresar")}
            />
          }
        />
        <Route
          path="ingresar"
          element={
            sess.token ? (
              <Navigate to="/conductor" replace />
            ) : (
              <DriverLogin
                onLogin={sess.loginWithIdentity}
                onGuest={() => navigate("/conductor", { replace: true })}
                status={sess.status}
              />
            )
          }
        />
        <Route path="*" element={<Navigate to="/conductor" replace />} />
      </Routes>
      {onLoginScreen ? null : <Tabs />}
    </div>
  );
}
