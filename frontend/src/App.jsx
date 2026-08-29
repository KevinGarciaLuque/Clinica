import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import PrivateRoute from "./auth/PrivateRoute";
import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";

const Dashboard       = lazy(() => import("./pages/Dashboard"));
const Estadisticas    = lazy(() => import("./pages/Estadisticas"));
const Facturacion     = lazy(() => import("./pages/Facturacion"));
const Caja            = lazy(() => import("./pages/Caja"));
const Pacientes       = lazy(() => import("./pages/Pacientes"));
const ExportarPacientes = lazy(() => import("./pages/ExportarPacientes"));
const Citas           = lazy(() => import("./pages/Citas"));
const ChatIA          = lazy(() => import("./pages/ChatIA"));
const Consulta        = lazy(() => import("./pages/Consulta"));
const ConsultaMedica  = lazy(() => import("./pages/ConsultaMedica"));
const HistoriaClinica = lazy(() => import("./pages/HistoriaClinica"));
const PerfilPaciente  = lazy(() => import("./pages/PerfilPaciente"));
const Estudios        = lazy(() => import("./pages/Estudios"));
// Páginas públicas (sin auth)
const RegistroPaciente  = lazy(() => import("./pages/RegistroPaciente"));
const VerificarEmail    = lazy(() => import("./pages/VerificarEmail"));
const OlvideContrasena      = lazy(() => import("./pages/OlvideContrasena"));
const RestablecerContrasena = lazy(() => import("./pages/RestablecerContrasena"));
const RecetaPublica     = lazy(() => import("./pages/RecetaPublica"));
const PublicClinicaPage = lazy(() => import("./pages/PublicClinicaPage"));
const DirectorioMedicos = lazy(() => import("./pages/DirectorioMedicos"));
const SolicitarPlan     = lazy(() => import("./pages/SolicitarPlan"));
const ResenaPublica     = lazy(() => import("./pages/ResenaPublica"));

// Admin
const Usuarios     = lazy(() => import("./pages/admin/Usuarios"));
const Servicios    = lazy(() => import("./pages/admin/Servicios"));
const Horarios     = lazy(() => import("./pages/admin/Horarios"));
const ConfigClinica = lazy(() => import("./pages/admin/ConfigClinica"));
const Plantillas    = lazy(() => import("./pages/admin/Plantillas"));

// Super Admin
const Clinicas                 = lazy(() => import("./pages/superadmin/Clinicas"));
const Database                 = lazy(() => import("./pages/superadmin/Database"));
const Reportes                 = lazy(() => import("./pages/superadmin/Reportes"));
const SoporteHistorial         = lazy(() => import("./pages/superadmin/SoporteHistorial"));
const SolicitudesPlan          = lazy(() => import("./pages/superadmin/SolicitudesPlan"));
const ResenasMedicos           = lazy(() => import("./pages/superadmin/ResenasMedicos"));
const SuperAdminPersonalizacion = lazy(() => import("./pages/superadmin/SuperAdminPersonalizacion"));
const LandingPageAdmin          = lazy(() => import("./pages/superadmin/LandingPageAdmin"));
const LandingPage               = lazy(() => import("./pages/LandingPage"));
const LinksPage                 = lazy(() => import("./pages/LinksPage"));
const Privacidad                = lazy(() => import("./pages/Privacidad"));

// Módulos de Cirugía Estética
const GaleriaEstetica          = lazy(() => import("./pages/estetica/GaleriaEstetica"));
const Presupuestos             = lazy(() => import("./pages/estetica/Presupuestos"));
const ConsentimientosEsteticos = lazy(() => import("./pages/estetica/ConsentimientosEsteticos"));
const SeguimientoPostOp        = lazy(() => import("./pages/estetica/SeguimientoPostOp"));
const FichaEstetica            = lazy(() => import("./pages/estetica/FichaEstetica"));
const BiopsiaPatologia         = lazy(() => import("./pages/estetica/BiopsiaPatologia"));

// Módulo Psicología
const ConsultaPsicologia = lazy(() => import("./pages/psicologia/ConsultaPsicologia"));

// Módulo Odontología
const ConsultaOdontologia = lazy(() => import("./pages/odontologia/ConsultaOdontologia"));
const HojaAnaliticaNefrologia = lazy(() => import("./pages/nefrologia/HojaAnaliticaNefrologia"));

// Módulo Endocrinología
const ConsultaEndocrinologia = lazy(() => import("./pages/endocrinologia/ConsultaEndocrinologia"));

// Módulo Educación en Diabetes
const ConsultaEducacion = lazy(() => import("./pages/educacion/ConsultaEducacion"));

// Módulos adicionales
const Recordatorios   = lazy(() => import("./pages/Recordatorios"));
const Recepcion       = lazy(() => import("./pages/Recepcion"));
const PerfilUsuario   = lazy(() => import("./pages/PerfilUsuario"));
const Catalogos       = lazy(() => import("./pages/Catalogos"));
const CrecimientoPage = lazy(() => import("./pages/CrecimientoPage"));
const VacunasPage     = lazy(() => import("./pages/VacunasPage"));
const Cumpleaneros    = lazy(() => import("./pages/Cumpleaneros"));
const Inventario      = lazy(() => import("./pages/Inventario"));
const DocumentosClinicos = lazy(() => import("./pages/DocumentosClinicos"));

function PageSkeleton() {
  const isClient = typeof window !== "undefined";
  const w = isClient ? window.innerWidth : 1200;
  const isMobile = w < 768;
  const isTablet = w >= 768 && w < 1024;

  const pad = isMobile ? "12px 14px" : isTablet ? "16px 18px" : "20px 24px";
  const headH = isMobile ? 60 : isTablet ? 68 : 76;
  const cardH = isMobile ? 180 : isTablet ? 220 : 260;

  return (
    <div style={{ padding: pad }}>
      <div style={{ height: headH, borderRadius: 12, background: "#eef2f7", marginBottom: 14 }} />
      <div style={{ height: isMobile ? 34 : 42, borderRadius: 10, background: "#f3f6fb", marginBottom: 12, width: isMobile ? "78%" : isTablet ? "65%" : "55%" }} />
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ height: 14, borderRadius: 8, background: "#f3f6fb", width: "95%" }} />
        <div style={{ height: 14, borderRadius: 8, background: "#f3f6fb", width: "88%" }} />
        {!isMobile && <div style={{ height: 14, borderRadius: 8, background: "#f3f6fb", width: "92%" }} />}
      </div>
      <div style={{ height: cardH, borderRadius: 12, background: "#eef2f7", marginTop: 14 }} />
    </div>
  );
}

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
    <Suspense fallback={null}>
    <Routes>
      {/* Rutas públicas */}
      <Route path="/login"           element={<Login />} />
      <Route path="/registro"        element={<RegistroPaciente />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      <Route path="/olvide-password"       element={<OlvideContrasena />} />
      <Route path="/restablecer-password"  element={<RestablecerContrasena />} />
      <Route path="/rx/:codigo"       element={<RecetaPublica />} />
      <Route path="/p/:slug"          element={<PublicClinicaPage />} />
      <Route path="/agenda-tu-consulta" element={<DirectorioMedicos />} />
      <Route path="/solicitar-plan"   element={<SolicitarPlan />} />
      <Route path="/resena/:token"    element={<ResenaPublica />} />
      <Route path="/inicio"           element={<LandingPage />} />
      <Route path="/links"            element={<LinksPage />} />
      <Route path="/privacidad"       element={<Privacidad />} />
      <Route path="/"                         element={<LandingPage />} />

      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        {/* Rutas generales */}
        <Route path="/dashboard"              element={<Dashboard />} />
        <Route path="/estadisticas"           element={<Estadisticas />} />
        <Route path="/pacientes"              element={<Pacientes />} />
        <Route path="/pacientes/exportar"     element={<Suspense fallback={<PageSkeleton />}><ExportarPacientes /></Suspense>} />
        <Route path="/pacientes/:id/perfil"   element={<Suspense fallback={<PageSkeleton />}><PerfilPaciente /></Suspense>} />
        <Route path="/citas"                  element={<Citas />} />
        <Route path="/facturacion"            element={<Facturacion />} />
        <Route path="/caja"                   element={<Caja />} />
        <Route path="/chat-ia"                element={<ChatIA />} />
        <Route path="/consulta"               element={<Consulta />} />
        <Route path="/consulta-medica"        element={<Suspense fallback={<PageSkeleton />}><ConsultaMedica /></Suspense>} />
        <Route path="/historia/:paciente_id"  element={<Suspense fallback={<PageSkeleton />}><HistoriaClinica /></Suspense>} />
        <Route path="/historia"               element={<Suspense fallback={<PageSkeleton />}><HistoriaClinica /></Suspense>} />
        <Route path="/estudios"               element={<Estudios />} />
        <Route path="/perfil"                 element={<PerfilUsuario />} />
        <Route path="/catalogos"              element={<Catalogos />} />
        <Route path="/crecimiento"            element={<CrecimientoPage />} />
        <Route path="/vacunas"                element={<VacunasPage />} />
        <Route path="/cumpleaneros"           element={<Cumpleaneros />} />
        <Route path="/inventario"             element={<Inventario />} />
        <Route path="/documentos-clinicos"    element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Suspense fallback={<PageSkeleton />}>
              <DocumentosClinicos />
            </Suspense>
          </RolRoute>
        } />

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

        {/* Módulo de recepción — cola de recetas/estudios enviados desde consulta */}
        <Route path="/recepcion" element={
          <RolRoute roles={["RECEPCIONISTA","ADMIN","SUPER_ADMIN"]}>
            <Recepcion />
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
        <Route path="/superadmin/solicitudes-plan" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <SolicitudesPlan />
          </RolRoute>
        } />
        <Route path="/superadmin/resenas" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <ResenasMedicos />
          </RolRoute>
        } />
        <Route path="/superadmin/personalizacion" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <SuperAdminPersonalizacion />
          </RolRoute>
        } />
        <Route path="/superadmin/landing" element={
          <RolRoute roles={["SUPER_ADMIN"]}>
            <LandingPageAdmin />
          </RolRoute>
        } />

        {/* ── Módulo Psicología ── */}
        <Route path="/psicologia/consulta" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Suspense fallback={<PageSkeleton />}>
              <ConsultaPsicologia />
            </Suspense>
          </RolRoute>
        } />

        {/* ── Módulo Odontología ── */}
        <Route path="/odontologia/consulta" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Suspense fallback={<PageSkeleton />}>
              <ConsultaOdontologia />
            </Suspense>
          </RolRoute>
        } />

        {/* ── Módulo Nefrología ── */}
        <Route path="/nefrologia/hoja-analitica" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO","ENFERMERA"]}>
            <Suspense fallback={<PageSkeleton />}>
              <HojaAnaliticaNefrologia />
            </Suspense>
          </RolRoute>
        } />

        {/* ── Módulo Endocrinología ── */}
        <Route path="/endocrinologia/seguimiento" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO"]}>
            <Suspense fallback={<PageSkeleton />}>
              <ConsultaEndocrinologia />
            </Suspense>
          </RolRoute>
        } />

        {/* ── Módulo Educación en Diabetes ── */}
        <Route path="/educacion/consulta" element={
          <RolRoute roles={["ADMIN","SUPER_ADMIN","MEDICO","ENFERMERA"]}>
            <Suspense fallback={<PageSkeleton />}>
              <ConsultaEducacion />
            </Suspense>
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

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
    </Suspense>
  );
}

