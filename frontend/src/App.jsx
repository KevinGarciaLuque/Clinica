import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import PrivateRoute from "./auth/PrivateRoute";
import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";

const Dashboard       = lazy(() => import("./pages/Dashboard"));
const Pacientes       = lazy(() => import("./pages/Pacientes"));
const Citas           = lazy(() => import("./pages/Citas"));
const ChatIA          = lazy(() => import("./pages/ChatIA"));
const Consulta        = lazy(() => import("./pages/Consulta"));
const ConsultaMedica  = lazy(() => import("./pages/ConsultaMedica"));
const HistoriaClinica = lazy(() => import("./pages/HistoriaClinica"));
const PerfilPaciente  = lazy(() => import("./pages/PerfilPaciente"));
const Estudios        = lazy(() => import("./pages/Estudios"));
// Páginas públicas (sin auth)
const RegistroPaciente = lazy(() => import("./pages/RegistroPaciente"));
const VerificarEmail   = lazy(() => import("./pages/VerificarEmail"));
const RecetaPublica    = lazy(() => import("./pages/RecetaPublica"));

// Admin
const Usuarios     = lazy(() => import("./pages/admin/Usuarios"));
const Servicios    = lazy(() => import("./pages/admin/Servicios"));
const Horarios     = lazy(() => import("./pages/admin/Horarios"));
const ConfigClinica = lazy(() => import("./pages/admin/ConfigClinica"));
const Plantillas    = lazy(() => import("./pages/admin/Plantillas"));

// Super Admin
const Clinicas         = lazy(() => import("./pages/superadmin/Clinicas"));
const Database         = lazy(() => import("./pages/superadmin/Database"));
const Reportes         = lazy(() => import("./pages/superadmin/Reportes"));
const SoporteHistorial = lazy(() => import("./pages/superadmin/SoporteHistorial"));

// Módulos de Cirugía Estética
const GaleriaEstetica          = lazy(() => import("./pages/estetica/GaleriaEstetica"));
const Presupuestos             = lazy(() => import("./pages/estetica/Presupuestos"));
const ConsentimientosEsteticos = lazy(() => import("./pages/estetica/ConsentimientosEsteticos"));
const SeguimientoPostOp        = lazy(() => import("./pages/estetica/SeguimientoPostOp"));
const FichaEstetica            = lazy(() => import("./pages/estetica/FichaEstetica"));
const BiopsiaPatologia         = lazy(() => import("./pages/estetica/BiopsiaPatologia"));

// Módulos adicionales
const Recordatorios   = lazy(() => import("./pages/Recordatorios"));
const PerfilUsuario   = lazy(() => import("./pages/PerfilUsuario"));
const Catalogos       = lazy(() => import("./pages/Catalogos"));
const CrecimientoPage = lazy(() => import("./pages/CrecimientoPage"));
const VacunasPage     = lazy(() => import("./pages/VacunasPage"));
const Cumpleaneros    = lazy(() => import("./pages/Cumpleaneros"));
const Inventario      = lazy(() => import("./pages/Inventario"));

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
    <Suspense fallback={<div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",color:"#6c757d"}}>Cargando...</div>}>
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login"           element={<Login />} />
      <Route path="/registro"        element={<RegistroPaciente />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      <Route path="/rx/:codigo"       element={<RecetaPublica />} />

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
        <Route path="/consulta-medica"        element={<ConsultaMedica />} />
        <Route path="/historia/:paciente_id"  element={<HistoriaClinica />} />
        <Route path="/historia"               element={<HistoriaClinica />} />
        <Route path="/estudios"               element={<Estudios />} />
        <Route path="/perfil"                 element={<PerfilUsuario />} />
        <Route path="/catalogos"              element={<Catalogos />} />
        <Route path="/crecimiento"            element={<CrecimientoPage />} />
        <Route path="/vacunas"                element={<VacunasPage />} />
        <Route path="/cumpleaneros"           element={<Cumpleaneros />} />
        <Route path="/inventario"             element={<Inventario />} />

        {/* Rutas de administración (ADMIN + SUPER_ADMIN) */}
        <Route path="/admin/usuarios" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN"]}>
            <Usuarios />
          </RolRoute>
        } />
        <Route path="/admin/servicios" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Servicios />
          </RolRoute>
        } />
        <Route path="/admin/horarios" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Horarios />
          </RolRoute>
        } />
        <Route path="/admin/config" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <ConfigClinica />
          </RolRoute>
        } />
        <Route path="/admin/plantillas" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Plantillas />
          </RolRoute>
        } />

        {/* Módulo de recordatorios */}
        <Route path="/recordatorios" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Recordatorios />
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
        <Route path="/superadmin/reportes" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <Reportes />
          </RolRoute>
        } />
        <Route path="/superadmin/soporte" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <SoporteHistorial />
          </RolRoute>
        } />

        {/* ── Módulos Cirugía Estética ── */}
        <Route path="/estetica/galeria"          element={<GaleriaEstetica />} />
        <Route path="/estetica/presupuestos"     element={<Presupuestos />} />
        <Route path="/estetica/consentimientos"  element={<ConsentimientosEsteticos />} />
        <Route path="/estetica/seguimiento"      element={<SeguimientoPostOp />} />
        <Route path="/estetica/ficha"            element={<FichaEstetica />} />
        <Route path="/estetica/biopsias"          element={<BiopsiaPatologia />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </Suspense>
  );
}

