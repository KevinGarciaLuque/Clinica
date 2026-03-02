import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./auth/PrivateRoute";
import AppLayout from "./components/AppLayout";

import Login           from "./pages/Login";
import Dashboard       from "./pages/Dashboard";
import Pacientes       from "./pages/Pacientes";
import Citas           from "./pages/Citas";
import ChatIA          from "./pages/ChatIA";
import Consulta        from "./pages/Consulta";
import HistoriaClinica from "./pages/HistoriaClinica";
import PerfilPaciente  from "./pages/PerfilPaciente";
// Páginas públicas (sin auth)
import RegistroPaciente from "./pages/RegistroPaciente";
import VerificarEmail   from "./pages/VerificarEmail";

// Admin
import Usuarios    from "./pages/admin/Usuarios";
import Servicios   from "./pages/admin/Servicios";
import Horarios    from "./pages/admin/Horarios";
import ConfigClinica from "./pages/admin/ConfigClinica";

// Super Admin
import Clinicas  from "./pages/superadmin/Clinicas";
import Database  from "./pages/superadmin/Database";

/** Componente para proteger rutas por rol */
function RolRoute({ children, roles }) {
  const raw = localStorage.getItem("user");
  const user = raw ? JSON.parse(raw) : null;
  if (!user || !roles.includes(user.tipo)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login"           element={<Login />} />
      <Route path="/registro"        element={<RegistroPaciente />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />

      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        {/* Rutas generales */}
        <Route path="/"                       element={<Dashboard />} />
        <Route path="/pacientes"              element={<Pacientes />} />
        <Route path="/pacientes/:id/perfil"   element={<PerfilPaciente />} />
        <Route path="/citas"                  element={<Citas />} />
        <Route path="/chat-ia"                element={<ChatIA />} />
        <Route path="/consulta"               element={<Consulta />} />
        <Route path="/historia/:paciente_id"  element={<HistoriaClinica />} />
        <Route path="/historia"               element={<HistoriaClinica />} />

        {/* Rutas de administración (ADMIN + SUPER_ADMIN) */}
        <Route path="/admin/usuarios" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN"]}>
            <Usuarios />
          </RolRoute>
        } />
        <Route path="/admin/servicios" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN"]}>
            <Servicios />
          </RolRoute>
        } />
        <Route path="/admin/horarios" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN"]}>
            <Horarios />
          </RolRoute>
        } />
        <Route path="/admin/config" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN"]}>
            <ConfigClinica />
          </RolRoute>
        } />

        {/* Rutas SUPER_ADMIN */}
        <Route path="/superadmin/clinicas" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <Clinicas />
          </RolRoute>
        } />
        <Route path="/superadmin/database" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <Database />
          </RolRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

