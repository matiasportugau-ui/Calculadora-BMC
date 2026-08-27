import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import useDriverSession from "./useDriverSession.js";
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
  const sess = useDriverSession();
  const navigate = useNavigate();

  if (!sess.token) {
    return (
      <div className="drv-app">
        <DriverLogin onLogin={sess.loginWithIdentity} status={sess.status} />
      </div>
    );
  }

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
              status={sess.status}
              onSync={sess.syncOutbox}
              onGoCarga={() => navigate("/conductor/carga")}
              onEvidence={evidence}
            />
          }
        />
        <Route
          path="carga"
          element={
            <DriverLoadSequence
              phase={sess.phase}
              plan={sess.plan}
              stops={sess.stops}
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
              onHome={() => navigate("/conductor")}
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
              onSave={sess.saveProfile}
              onLogout={sess.logout}
            />
          }
        />
        <Route path="*" element={<Navigate to="/conductor" replace />} />
      </Routes>
      <Tabs />
    </div>
  );
}
