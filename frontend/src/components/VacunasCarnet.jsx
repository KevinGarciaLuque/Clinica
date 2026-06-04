/**
 * VacunasCarnet.jsx
 * Módulo completo de vacunación digital - Idéntico al Carnet de Vacunación Honduras / PAI
 * Pestañas: Carnet | Registro de Vacunas | Suplementación Vitamina A | Guía de Vacunación
 */
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../api/api";

// ══════════════════════════════════════════════════════════
// COLORES PAI Honduras (Pantone)
// ══════════════════════════════════════════════════════════
const PAI = {
  amarillo:   "#91b3a3",
  azulOscuro: "#608CA5",
  azulClaro:  "#c5d8e4",
  blanco: "#FFFFFF",
  gris: "#f2f2f2",
};

const PRESETS_COLORES = [
  { nombre: "Verde Salud", principal: "#608CA5", secundario: "#91b3a3", claro: "#c5d8e4" },
  { nombre: "Honduras PAI", principal: "#1D2087", secundario: "#FFD100", claro: "#99BFFF" },
  { nombre: "Verde Bosque", principal: "#2e7d32", secundario: "#81c784", claro: "#c8e6c9" },
  { nombre: "Azul Marino",  principal: "#1a3a5c", secundario: "#4a90c4", claro: "#bfd7ed" },
];

// ══════════════════════════════════════════════════════════
// CATÁLOGO COMPLETO DE VACUNAS (igual al carnet físico)
// ══════════════════════════════════════════════════════════
const VACUNAS_IZQUIERDA = [
  {
    codigo: "BCG",
    nombre: "BCG",
    descripcion: "(Tuberculosis)",
    dosis: [{ key: "unica", label: "Única" }],
  },
  {
    codigo: "HEP_B_RN",
    nombre: "Hep B(Hepatitis B)",
    descripcion: "Recién nacido",
    dosis: [{ key: "rn", label: "Recién nacido" }],
  },
  {
    codigo: "VPI",
    nombre: "VPI (Poliomielitis)",
    descripcion: "Inyectable",
    notas: "* Solo aplica para inmunosuprimidos",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera*" },
      { key: "refuerzo", label: "Refuerzo" },
    ],
  },
  {
    codigo: "VOP",
    nombre: "VOP (Oral)",
    descripcion: "Oral",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera" },
      { key: "refuerzo", label: "Refuerzo" },
    ],
  },
  {
    codigo: "PENTAVALENTE",
    nombre: "HEXAVALENTE",
    descripcion: "(Difteria, Tos Ferina,\nTétanos, Hepatitis B\ny Neumonia por Hib)",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera" },
    ],
  },
  {
    codigo: "NEUMOCOCO",
    nombre: "NEUMOCOCO",
    descripcion: "(Neumonia,\nMeningitis)",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera" },
      { key: "refuerzo", label: "Refuerzo**" },
    ],
  },
  {
    codigo: "ROTAVIRUS",
    nombre: "ROTAVIRUS",
    descripcion: "(Diarrea por Rotavirus)",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera**" },
    ],
  },
  {
    codigo: "SRP",
    nombre: "SRP",
    descripcion: "(Sarampión, Rubéola\ny Parotiditis)",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
    ],
  },
  {
    codigo: "VARICELA",
    nombre: "VARICELA**",
    descripcion: "",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
    ],
  },
  {
    codigo: "HEPATITIS_A",
    nombre: "HEPATITIS A",
    descripcion: "",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
    ],
  },
  {
    codigo: "DPT",
    nombre: "DPT",
    descripcion: "(Difteria, Tos Ferina\ny Tétanos)",
    dosis: [
      { key: "primer_refuerzo", label: "Primero" },
      { key: "segundo_refuerzo", label: "Segundo" },
    ],
  },
  {
    codigo: "DT",
    nombre: "DT (Difteria y Tétanos)***",
    descripcion: "",
    dosis: [
      { key: "primer_refuerzo", label: "Primero" },
      { key: "segundo_refuerzo", label: "Segundo" },
    ],
  },
  {
    codigo: "TD",
    nombre: "Td (Tétanos y Difteria)",
    descripcion: "",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera" },
      { key: "cuarta", label: "Cuarta" },
      { key: "quinta", label: "Quinta" },
      { key: "sexta", label: "Sexta" },
      { key: "septima", label: "Séptima" },
    ],
  },
  {
    codigo: "TDAP",
    nombre: "Tdap acélular",
    descripcion: "(Tétanos, Difteria\ny Tos Ferina)",
    dosis: [{ key: "dosis", label: "Dosis (grupos en riesgo)" }],
  },
];

const VACUNAS_DERECHA = [
  {
    codigo: "HEP_B_ADULTOS",
    nombre: "Hep B (Hepatitis B)\nAdultos",
    descripcion: "",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera" },
      { key: "cuarta", label: "Cuarta***" },
    ],
  },
  {
    codigo: "VPH",
    nombre: "VPH (Virus del\nPapiloma Humano)",
    descripcion: "",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
      { key: "tercera", label: "Tercera***" },
    ],
  },
  {
    codigo: "SRP_JL",
    nombre: "SRP-JL (Sarampión,\nRubéola, Parotiditis)****",
    descripcion: "(grupos en riesgo)",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
    ],
  },
  {
    codigo: "INFLUENZA",
    nombre: "INFLUENZA\nESTACIONAL",
    descripcion: "",
    dosis: [
      { key: "dosis_1", label: "Dosis anual" },
      { key: "dosis_2", label: "Dosis anual" },
      { key: "dosis_3", label: "Dosis anual" },
      { key: "dosis_4", label: "Dosis anual" },
      { key: "dosis_5", label: "Dosis anual" },
      { key: "dosis_6", label: "Dosis anual" },
    ],
  },
  {
    codigo: "MENINGOCOCO",
    nombre: "MENINGOCOCO\nconjugada cuadrivalente\n(Meningitis)**",
    descripcion: "(grupos en riesgo)",
    dosis: [
      { key: "primera", label: "Primera" },
      { key: "segunda", label: "Segunda" },
    ],
  },
];

// Otras vacunas y jornadas (filas abiertas)
const OTRAS_VACUNAS_ROWS = 4;
const JORNADAS_ROWS = 3;

// ══════════════════════════════════════════════════════════
// DATOS GUÍA DE VACUNACIÓN (referencia estática)
// ══════════════════════════════════════════════════════════
const GUIA_VACUNAS = [
  { vacuna: "BCG", grupo: "Niños", edad: "Recién Nacido" },
  { vacuna: "Hepatitis B", grupo: "Niños", edad: "Recién Nacido" },
  { vacuna: "VPI (Inyectable)", grupo: "Niños", edad: "2 meses, 4 meses, 6 meses" },
  { vacuna: "VOP (Oral)", grupo: "Niños", edad: "2 meses, 4 meses, 6 meses, 10 meses" },
  { vacuna: "Hexavalente", grupo: "Niños", edad: "2 meses, 4 meses, 6 meses" },
  { vacuna: "Neumococo", grupo: "Niños", edad: "2 meses, 4 meses, 6 meses, 12-15 meses" },
  { vacuna: "Rotavirus", grupo: "Niños", edad: "2 meses, 4 meses, 6 meses" },
  { vacuna: "SRP (Sarampión, Rubéola y Parotiditis)", grupo: "Niños", edad: "12 meses, 4-6 años" },
  { vacuna: "Varicela**", grupo: "Niños", edad: "12-15 meses, 4-6 años" },
  { vacuna: "Hepatitis A", grupo: "Niños 1 a 10 años", edad: "A partir de los 12 meses (2 dosis)" },
  { vacuna: "DPT (Difteria, Tétanos y Tos Ferina)", grupo: "Refuerzo", edad: "15-18 meses, 4 años" },
  { vacuna: "Td (Tétanos y Difteria)", grupo: "Embarazadas No vacunadas / Grupos en riesgo", edad: "Primera vez, al mes, 6 meses, 1 año, 1 año / Según calendario" },
  { vacuna: "Tdap acélular (Tétanos, Difteria, Tos Ferina)", grupo: "Embarazadas (27-36 SG)***/ Grupos en riesgo***", edad: "En cada embarazo/ dosis única" },
  { vacuna: "Hepatitis B Adultos", grupo: "Grupos en riesgo (mayores de 15 años)", edad: "Primera vez, al mes, 2 meses, 12 meses" },
  { vacuna: "VPH (Virus del Papiloma Humano)", grupo: "Niñas****", edad: "11 años" },
  { vacuna: "SRP-JL (Sarampión, Rubéola y Parotiditis)", grupo: "Grupos en riesgo", edad: "Mayores de 5 años (una dos dosis adicional)" },
  { vacuna: "Influenza", grupo: "Dos dosis", edad: "Niños de 6 meses a 8 años vacunados por primera vez" },
  { vacuna: "Influenza", grupo: "Dosis actual", edad: "Grupos en riesgo: embarazadas, enfermos crónicos, adultos mayores de 60 años." },
  { vacuna: "Fiebre Amarilla", grupo: "Desde dosis", edad: "Mayores de 9 meses al primer año / es recomendada al viajar a zonas de transmisión" },
  { vacuna: "Meningococo conjugada cuadrivalente (Meningitis)", grupo: "Grupos en riesgo", edad: "Niños de 9 a 23 meses (según riesgo de 2-3 dosis)" },
];

// ══════════════════════════════════════════════════════════
// SUPLEMENTACIÓN VITAMINA A - estructura del carnet
// ══════════════════════════════════════════════════════════
const VITAMINA_A_ESTRUCTURA = [
  {
    tipo_dosis: "dosis_unica",
    label: "Dosis única",
    celdas: [
      { edad_rango: "6_11_meses", dosis_ui: 100000, activo: true },
      { edad_rango: "1_ano",      dosis_ui: 200000, activo: false },
      { edad_rango: "2_anos",     dosis_ui: 200000, activo: false },
      { edad_rango: "3_anos",     dosis_ui: 200000, activo: false },
      { edad_rango: "4_anos",     dosis_ui: 200000, activo: false },
    ],
  },
  {
    tipo_dosis: "primera_dosis",
    label: "Primera Dosis",
    celdas: [
      { edad_rango: "6_11_meses", dosis_ui: 100000, activo: false },
      { edad_rango: "1_ano",      dosis_ui: 200000, activo: true },
      { edad_rango: "2_anos",     dosis_ui: 200000, activo: true },
      { edad_rango: "3_anos",     dosis_ui: 200000, activo: true },
      { edad_rango: "4_anos",     dosis_ui: 200000, activo: true },
    ],
  },
  {
    tipo_dosis: "segunda_dosis",
    label: "Segunda Dosis",
    celdas: [
      { edad_rango: "6_11_meses", dosis_ui: 100000, activo: false },
      { edad_rango: "1_ano",      dosis_ui: 200000, activo: true },
      { edad_rango: "2_anos",     dosis_ui: 200000, activo: true },
      { edad_rango: "3_anos",     dosis_ui: 200000, activo: true },
      { edad_rango: "4_anos",     dosis_ui: 200000, activo: true },
    ],
  },
];

const EDADES_VITAMINA = [
  { rango: "6_11_meses", label: "6 a 11 meses" },
  { rango: "1_ano",      label: "1 año" },
  { rango: "2_anos",     label: "2 años" },
  { rango: "3_anos",     label: "3 años" },
  { rango: "4_anos",     label: "4 años" },
];

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
function encontrarRegistro(registros, codigo, dosisKey) {
  return registros.find(r => r.vacuna_codigo === codigo && r.dosis_nombre === dosisKey) || null;
}

function encontrarVitamina(registros, edad_rango, tipo_dosis) {
  return registros.find(r => r.edad_rango === edad_rango && r.tipo_dosis === tipo_dosis) || null;
}

// ══════════════════════════════════════════════════════════
// MODAL PARA REGISTRAR / EDITAR VACUNA
// ══════════════════════════════════════════════════════════
function ModalVacuna({ datos, onClose, onGuardar, cargando, pal = PAI }) {
  const hoy = new Date();
  const [form, setForm] = useState({
    fecha_dia: datos?.registro?.fecha_dia || hoy.getDate(),
    fecha_mes: datos?.registro?.fecha_mes || (hoy.getMonth() + 1),
    fecha_ano: datos?.registro?.fecha_ano || hoy.getFullYear(),
    proxima_cita: datos?.registro?.proxima_cita || "",
    nombre_vacunador: datos?.registro?.nombre_vacunador || "",
    lote: datos?.registro?.lote || "",
    observaciones: datos?.registro?.observaciones || "",
  });

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    onGuardar({ ...form });
  };

  return createPortal(
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,.28)", overflow: "hidden",
        maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ background: pal.azulOscuro, color: pal.blanco, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-capsule" style={{ fontSize: "1rem" }} />
            <span style={{ fontWeight: 700, fontSize: "0.97rem" }}>
              {datos?.registro ? "Editar" : "Registrar"} Vacuna
            </span>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            <i className="bi bi-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px", overflowY: "auto" }}>
          <p className="fw-bold mb-1" style={{ color: pal.azulOscuro, fontSize: "0.9rem" }}>{datos?.vacunaNombre}</p>
          <p className="text-muted small mb-3">Dosis: {datos?.dosisLabel}</p>

          <form onSubmit={handleSubmit}>
            {/* Fecha */}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label small fw-semibold">Fecha de aplicación</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <input name="fecha_dia" type="number" min="1" max="31" className="form-control form-control-sm"
                    value={form.fecha_dia} onChange={handleChange} placeholder="DD" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Día</div>
                </div>
                <div style={{ flex: 1 }}>
                  <input name="fecha_mes" type="number" min="1" max="12" className="form-control form-control-sm"
                    value={form.fecha_mes} onChange={handleChange} placeholder="MM" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Mes</div>
                </div>
                <div style={{ flex: 2 }}>
                  <input name="fecha_ano" type="number" min="2000" max="2100" className="form-control form-control-sm"
                    value={form.fecha_ano} onChange={handleChange} placeholder="AAAA" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Año</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Próxima Cita</label>
              <input name="proxima_cita" className="form-control form-control-sm"
                value={form.proxima_cita} onChange={handleChange} placeholder="Ej: 6 meses, 12/2026, etc." />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Nombre del Vacunador</label>
              <input name="nombre_vacunador" className="form-control form-control-sm"
                value={form.nombre_vacunador} onChange={handleChange} />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Lote <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
              <input name="lote" className="form-control form-control-sm" value={form.lote} onChange={handleChange} />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Observaciones</label>
              <textarea name="observaciones" className="form-control form-control-sm" rows={2}
                value={form.observaciones} onChange={handleChange} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-sm text-white" disabled={cargando}
                style={{ background: pal.azulOscuro, minWidth: 90 }}>
                {cargando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check-lg me-1" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════
// MODAL PARA OTRAS VACUNAS / JORNADAS (nombre libre)
// ══════════════════════════════════════════════════════════
function ModalOtraVacuna({ datos, onClose, onGuardar, onEliminar, cargando, pal = PAI }) {
  const hoy = new Date();
  const [form, setForm] = useState({
    vacuna_nombre: datos?.registro?.vacuna_nombre || "",
    dosis_nombre:  datos?.registro?.dosis_nombre  || "",
    fecha_dia:     datos?.registro?.fecha_dia      || hoy.getDate(),
    fecha_mes:     datos?.registro?.fecha_mes      || (hoy.getMonth() + 1),
    fecha_ano:     datos?.registro?.fecha_ano      || hoy.getFullYear(),
    proxima_cita:  datos?.registro?.proxima_cita   || "",
    nombre_vacunador: datos?.registro?.nombre_vacunador || "",
    lote:          datos?.registro?.lote           || "",
    observaciones: datos?.registro?.observaciones  || "",
  });

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const titulo = datos?.seccion === "OTRAS" ? "Otra Vacuna" : "Vacuna Jornada / Campaña";
  const esEdicion = !!datos?.registro;

  return createPortal(
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,.28)", overflow: "hidden",
        maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ background: pal.amarillo, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="bi bi-capsule" style={{ fontSize: "1rem" }} />
            <span style={{ fontWeight: 700, fontSize: "0.97rem", color: "#000" }}>
              {esEdicion ? "Editar" : "Registrar"} — {titulo}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,.1)", border: "1px solid rgba(0,0,0,.15)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            <i className="bi bi-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px", overflowY: "auto" }}>
          <form onSubmit={e => { e.preventDefault(); onGuardar(form); }}>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Nombre de la Vacuna <span className="text-danger">*</span></label>
              <input name="vacuna_nombre" className="form-control form-control-sm"
                value={form.vacuna_nombre} onChange={handleChange}
                placeholder="Ej: Hepatitis A, Fiebre Tifoidea, COVID-19..." required />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Dosis</label>
              <input name="dosis_nombre" className="form-control form-control-sm"
                value={form.dosis_nombre} onChange={handleChange} placeholder="Ej: Primera, Única, Refuerzo..." />
            </div>

            {/* Fecha */}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label small fw-semibold">Fecha de aplicación</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <input name="fecha_dia" type="number" min="1" max="31" className="form-control form-control-sm"
                    value={form.fecha_dia} onChange={handleChange} placeholder="DD" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Día</div>
                </div>
                <div style={{ flex: 1 }}>
                  <input name="fecha_mes" type="number" min="1" max="12" className="form-control form-control-sm"
                    value={form.fecha_mes} onChange={handleChange} placeholder="MM" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Mes</div>
                </div>
                <div style={{ flex: 2 }}>
                  <input name="fecha_ano" type="number" min="2000" max="2100" className="form-control form-control-sm"
                    value={form.fecha_ano} onChange={handleChange} placeholder="AAAA" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Año</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Próxima Cita</label>
              <input name="proxima_cita" className="form-control form-control-sm"
                value={form.proxima_cita} onChange={handleChange} placeholder="Ej: 6 meses, 03/2027..." />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Nombre del Vacunador</label>
              <input name="nombre_vacunador" className="form-control form-control-sm"
                value={form.nombre_vacunador} onChange={handleChange} />
            </div>
            <div className="mb-3">
              <label className="form-label small fw-semibold">Lote <span style={{ color: "#9ca3af", fontWeight: 400 }}>(opcional)</span></label>
              <input name="lote" className="form-control form-control-sm" value={form.lote} onChange={handleChange} />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Observaciones</label>
              <textarea name="observaciones" className="form-control form-control-sm" rows={2}
                value={form.observaciones} onChange={handleChange} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
              {esEdicion && (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onEliminar(datos.registro.id)}>
                  <i className="bi bi-trash me-1" />Eliminar
                </button>
              )}
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn btn-sm fw-bold text-dark" disabled={cargando}
                  style={{ background: pal.amarillo, minWidth: 90 }}>
                  {cargando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check-lg me-1" />}
                  Guardar
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════
// MODAL PARA VITAMINA A
// ══════════════════════════════════════════════════════════
function ModalVitaminaA({ datos, onClose, onGuardar, cargando, pal = PAI }) {
  const hoy = new Date();
  const [form, setForm] = useState({
    fecha_dia: datos?.registro?.fecha_dia || hoy.getDate(),
    fecha_mes: datos?.registro?.fecha_mes || (hoy.getMonth() + 1),
    fecha_ano: datos?.registro?.fecha_ano || hoy.getFullYear(),
    nombre_vacunador: datos?.registro?.nombre_vacunador || "",
    observaciones: datos?.registro?.observaciones || "",
  });

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  return createPortal(
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400,
        boxShadow: "0 20px 60px rgba(0,0,0,.28)", overflow: "hidden",
        maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ background: pal.amarillo, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#000" }}>
            Vitamina A — {datos?.edadLabel} — {datos?.dosisLabel}
          </span>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,.1)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
            <i className="bi bi-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px", overflowY: "auto" }}>
          <form onSubmit={e => { e.preventDefault(); onGuardar(form); }}>
            <p className="small text-muted mb-3">Dosis: <strong>{datos?.dosis_ui?.toLocaleString()} UI</strong></p>

            {/* Fecha */}
            <div style={{ marginBottom: 12 }}>
              <label className="form-label small fw-semibold">Fecha de aplicación</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <input name="fecha_dia" type="number" min="1" max="31" className="form-control form-control-sm"
                    value={form.fecha_dia} onChange={handleChange} placeholder="DD" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Día</div>
                </div>
                <div style={{ flex: 1 }}>
                  <input name="fecha_mes" type="number" min="1" max="12" className="form-control form-control-sm"
                    value={form.fecha_mes} onChange={handleChange} placeholder="MM" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Mes</div>
                </div>
                <div style={{ flex: 2 }}>
                  <input name="fecha_ano" type="number" min="2000" max="2100" className="form-control form-control-sm"
                    value={form.fecha_ano} onChange={handleChange} placeholder="AAAA" />
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>Año</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Nombre del Vacunador</label>
              <input name="nombre_vacunador" className="form-control form-control-sm"
                value={form.nombre_vacunador} onChange={handleChange} />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-semibold">Observaciones</label>
              <textarea name="observaciones" className="form-control form-control-sm" rows={2}
                value={form.observaciones} onChange={handleChange} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-sm fw-bold" disabled={cargando}
                style={{ background: pal.amarillo, minWidth: 80 }}>
                {cargando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check-lg me-1" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════
// CELDA DE VACUNA (fila en el registro)
// ══════════════════════════════════════════════════════════
function CeldaVacuna({ registro, onClickCelda, editable }) {
  if (!registro) {
    return (
      <td
        className="text-center align-middle"
        style={{
          cursor: editable ? "pointer" : "default",
          minWidth: 36,
          background: editable ? "#fff8e1" : "#f9f9f9",
          border: "1px solid #ccc",
          padding: "2px",
        }}
        onClick={editable ? onClickCelda : undefined}
        title={editable ? "Clic para registrar" : ""}
      >
        {editable && <span style={{ color: "#ccc", fontSize: 16 }}>+</span>}
      </td>
    );
  }

  const dia  = registro.fecha_dia  ? String(registro.fecha_dia).padStart(2, "0")  : "—";
  const mes  = registro.fecha_mes  ? String(registro.fecha_mes).padStart(2, "0")  : "—";
  const ano  = registro.fecha_ano  ? String(registro.fecha_ano)                   : "—";
  const prox = registro.proxima_cita || "—";
  const vac  = registro.nombre_vacunador || "—";

  return (
    <>
      <td className="text-center align-middle"
        style={{ border: "1px solid #ccc", padding: "1px 3px", fontSize: 11, cursor: editable ? "pointer" : "default", background: "#e8f5e9" }}
        onClick={editable ? onClickCelda : undefined}>
        {dia}
      </td>
      <td className="text-center align-middle"
        style={{ border: "1px solid #ccc", padding: "1px 3px", fontSize: 11, cursor: editable ? "pointer" : "default", background: "#e8f5e9" }}
        onClick={editable ? onClickCelda : undefined}>
        {mes}
      </td>
      <td className="text-center align-middle"
        style={{ border: "1px solid #ccc", padding: "1px 3px", fontSize: 11, cursor: editable ? "pointer" : "default", background: "#e8f5e9" }}
        onClick={editable ? onClickCelda : undefined}>
        {ano}
      </td>
      <td className="text-center align-middle"
        style={{ border: "1px solid #ccc", padding: "1px 3px", fontSize: 10, cursor: editable ? "pointer" : "default", background: "#e8f5e9" }}
        onClick={editable ? onClickCelda : undefined}>
        {prox}
      </td>
      <td className="text-center align-middle"
        style={{ border: "1px solid #ccc", padding: "1px 3px", fontSize: 10, cursor: editable ? "pointer" : "default", background: "#e8f5e9" }}
        onClick={editable ? onClickCelda : undefined}>
        {vac}
      </td>
    </>
  );
}

// ══════════════════════════════════════════════════════════
// FUNCIÓN DE IMPRESIÓN DEL CARNET
// ══════════════════════════════════════════════════════════
function imprimirCarnet(paciente, registros, vitaminaRegistros, pal = PAI) {
  const calcEdad = () => {
    if (!paciente?.fecha_nacimiento) return "";
    const hoy = new Date();
    const nac = new Date(paciente.fecha_nacimiento);
    const anos = hoy.getFullYear() - nac.getFullYear();
    const meses = hoy.getMonth() - nac.getMonth();
    return meses < 0 ? `${anos - 1} años ${meses + 12} meses` : `${anos} años ${meses} meses`;
  };

  const todasVacunas = [...VACUNAS_IZQUIERDA, ...VACUNAS_DERECHA];

  const filaVacuna = (v) => v.dosis.map((d, i) => {
    const reg = encontrarRegistro(registros, v.codigo, d.key);
    const dia = reg?.fecha_dia ? String(reg.fecha_dia).padStart(2, "0") : "";
    const mes = reg?.fecha_mes ? String(reg.fecha_mes).padStart(2, "0") : "";
    const ano = reg?.fecha_ano ? String(reg.fecha_ano) : "";
    const bg = reg ? "#e8f5e9" : "#fff";
    return `<tr>
      ${i === 0 ? `<td rowspan="${v.dosis.length}" style="border:1px solid #999;padding:3px 6px;vertical-align:middle;font-size:11px;font-weight:bold;background:#d9e8ff;">${v.nombre.replace(/\n/g, "<br>")}<br><small style='font-weight:normal;color:#555'>${v.descripcion || ""}</small></td>` : ""}
      <td style="border:1px solid #999;padding:2px 4px;font-size:10px;">${d.label}</td>
      <td style="border:1px solid #999;padding:2px 4px;font-size:10px;background:${bg}">${dia}</td>
      <td style="border:1px solid #999;padding:2px 4px;font-size:10px;background:${bg}">${mes}</td>
      <td style="border:1px solid #999;padding:2px 4px;font-size:10px;background:${bg}">${ano}</td>
      <td style="border:1px solid #999;padding:2px 4px;font-size:9px;background:${bg}">${reg?.proxima_cita || ""}</td>
      <td style="border:1px solid #999;padding:2px 4px;font-size:9px;background:${bg}">${reg?.nombre_vacunador || ""}</td>
    </tr>`;
  }).join("");

  const tablaVacunasHtml = todasVacunas.map(v => filaVacuna(v)).join("");

  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Carnet de Vacunación — ${paciente?.nombres || ""} ${paciente?.apellidos || ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 16px; }
  h1 { font-size: 18px; color: ${pal.azulOscuro}; text-align:center; margin-bottom: 4px; }
  h2 { font-size: 14px; color: ${pal.azulOscuro}; margin: 10px 0 4px; }
  .header { background: ${pal.azulOscuro}; color: #fff; padding: 10px 16px; margin-bottom: 12px; border-radius: 4px; }
  .header h1 { color: #fff; }
  .datos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 12px; }
  .dato { display: flex; gap: 6px; border-bottom: 1px solid #ddd; padding: 2px 0; }
  .dato .etiqueta { font-weight: bold; min-width: 110px; color: ${pal.azulOscuro}; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
  th { background: ${pal.azulOscuro}; color: #fff; padding: 4px; border: 1px solid #999; }
  @media print { body { padding: 8px; } }
</style></head><body>
<div class="header">
  <h1>CARNET DE VACUNACIÓN</h1>
  <p style="text-align:center;font-size:12px;margin-top:4px">Secretaría de Salud — Programa Ampliado de Inmunizaciones (PAI)</p>
</div>
<div class="datos">
  <div class="dato"><span class="etiqueta">Nombre:</span><span>${paciente?.nombres || ""} ${paciente?.apellidos || ""}</span></div>
  <div class="dato"><span class="etiqueta">No. Identidad:</span><span>${paciente?.dni || ""}</span></div>
  <div class="dato"><span class="etiqueta">Fecha Nacimiento:</span><span>${paciente?.fecha_nacimiento || ""}</span></div>
  <div class="dato"><span class="etiqueta">Sexo:</span><span>${paciente?.sexo || ""}</span></div>
  <div class="dato"><span class="etiqueta">Edad Actual:</span><span>${calcEdad()}</span></div>
  <div class="dato"><span class="etiqueta">Teléfono:</span><span>${paciente?.telefono || ""}</span></div>
  <div class="dato"><span class="etiqueta">Responsable/Tutor:</span><span>${paciente?.responsable_nombre || ""}</span></div>
  <div class="dato"><span class="etiqueta">Dirección:</span><span>${paciente?.direccion || ""}</span></div>
</div>
<h2>REGISTRO DE VACUNAS APLICADAS</h2>
<table>
  <thead><tr>
    <th style="min-width:130px">Vacuna</th>
    <th>Dosis</th>
    <th>Día</th><th>Mes</th><th>Año</th>
    <th>Próxima Cita</th>
    <th>Nombre del Vacunador</th>
  </tr></thead>
  <tbody>${tablaVacunasHtml}</tbody>
</table>
<p style="text-align:center;font-size:9px;margin-top:8px">
  * Solo aplica para inmunosuprimidos &nbsp;|&nbsp; ** Solo aplica para sector privado &nbsp;|&nbsp; *** Solo aplica para pacientes de diálisis y víctimas de agresión sexual &nbsp;|&nbsp; **** Solo aplica para mayores de cinco años
</p>
<script>window.onload = () => window.print();</script>
</body></html>`);
  w.document.close();
}

// ══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function VacunasCarnet({ paciente, pacienteId }) {
  const [subTab, setSubTab] = useState("carnet");
  const [registros, setRegistros] = useState([]);
  const [vitaminaRegs, setVitaminaRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [showColorPanel, setShowColorPanel] = useState(false);

  // ── Colores personalizables (persistidos en localStorage) ──────────────
  const [colores, setColores] = useState(() => {
    try {
      const saved = localStorage.getItem("vacunas_colores");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { principal: PAI.azulOscuro, secundario: PAI.amarillo, claro: PAI.azulClaro };
  });

  const pal = {
    ...PAI,
    azulOscuro: colores.principal,
    amarillo:   colores.secundario,
    azulClaro:  colores.claro,
  };

  const actualizarColor = (campo, valor) => {
    setColores(c => {
      const nuevo = { ...c, [campo]: valor };
      try { localStorage.setItem("vacunas_colores", JSON.stringify(nuevo)); } catch {}
      return nuevo;
    });
  };

  const aplicarPreset = (preset) => {
    const nuevo = { principal: preset.principal, secundario: preset.secundario, claro: preset.claro };
    setColores(nuevo);
    try { localStorage.setItem("vacunas_colores", JSON.stringify(nuevo)); } catch {}
  };

  const editable = true;

  // ── Carga de datos ─────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get(`/vacunas/paciente/${pacienteId}`),
        api.get(`/vacunas/vitamina-a/paciente/${pacienteId}`),
      ]);
      setRegistros(r1.data.data || []);
      setVitaminaRegs(r2.data.data || []);
    } catch (e) {
      console.error("Error cargando vacunas:", e.message);
      setRegistros([]);
      setVitaminaRegs([]);
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ── Guardar vacuna ─────────────────────────────────────
  const handleGuardarVacuna = async (formData) => {
    setGuardando(true);
    try {
      const { datos } = modal;
      if (datos.registro) {
        await api.put(`/vacunas/${datos.registro.id}`, formData);
      } else {
        await api.post("/vacunas", {
          ...formData,
          paciente_id: pacienteId,
          vacuna_codigo: datos.codigo,
          vacuna_nombre: datos.vacunaNombre,
          dosis_nombre: datos.dosisKey,
          dosis_orden: datos.dosisOrden,
        });
      }
      await cargarDatos();
      setModal(null);
      setMsg("✅ Vacuna guardada correctamente");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("❌ Error: " + (e?.response?.data?.msg || e.message));
    } finally {
      setGuardando(false);
    }
  };

  // ── Borrar vacuna ──────────────────────────────────────
  const handleEliminarVacuna = async (id) => {
    if (!window.confirm("¿Eliminar este registro de vacuna?")) return;
    try {
      await api.delete(`/vacunas/${id}`);
      await cargarDatos();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // ── Guardar vitamina A ─────────────────────────────────
  const handleGuardarVitamina = async (formData) => {
    setGuardando(true);
    try {
      const { datos } = modal;
      if (datos.registro) {
        await api.put(`/vacunas/vitamina-a/${datos.registro.id}`, formData);
      } else {
        await api.post("/vacunas/vitamina-a", {
          ...formData,
          paciente_id: pacienteId,
          edad_rango: datos.edad_rango,
          tipo_dosis: datos.tipo_dosis,
          dosis_ui: datos.dosis_ui,
        });
      }
      await cargarDatos();
      setModal(null);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  // ── Abrir modal vacuna ────────────────────────────────
  const abrirModalVacuna = (vacuna, dosisIdx) => {
    const dosis = vacuna.dosis[dosisIdx];
    const registro = encontrarRegistro(registros, vacuna.codigo, dosis.key);
    setModal({
      tipo: "vacuna",
      datos: {
        codigo: vacuna.codigo,
        vacunaNombre: vacuna.nombre.replace(/\n/g, " "),
        dosisKey: dosis.key,
        dosisLabel: dosis.label,
        dosisOrden: dosisIdx + 1,
        registro,
      },
    });
  };

  // ── Abrir modal vitamina ──────────────────────────────
  const abrirModalVitamina = (edad_rango, tipo_dosis, dosis_ui, edadLabel, dosisLabel) => {
    const registro = encontrarVitamina(vitaminaRegs, edad_rango, tipo_dosis);
    setModal({
      tipo: "vitamina",
      datos: { edad_rango, tipo_dosis, dosis_ui, edadLabel, dosisLabel, registro },
    });
  };

  // ── Abrir modal otra vacuna (nombre libre) ─────────────
  const abrirModalOtraVacuna = (seccion, registro = null) => {
    setModal({ tipo: "otra", datos: { seccion, registro } });
  };

  // ── Guardar otra vacuna ────────────────────────────────
  const handleGuardarOtraVacuna = async (formData) => {
    setGuardando(true);
    const { datos } = modal;
    try {
      if (datos.registro) {
        await api.put(`/vacunas/${datos.registro.id}`, formData);
      } else {
        await api.post("/vacunas", {
          ...formData,
          paciente_id: pacienteId,
          vacuna_codigo: datos.seccion === "OTRAS" ? "OTRAS" : "JORNADAS",
          dosis_orden: 1,
        });
      }
      await cargarDatos();
      setModal(null);
    } catch (e) {
      alert("Error: " + (e?.response?.data?.msg || e.message));
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminar otra vacuna ───────────────────────────────
  const handleEliminarOtraVacuna = async (id) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    try {
      await api.delete(`/vacunas/${id}`);
      await cargarDatos();
      setModal(null);
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // ── Calcular edad ──────────────────────────────────────
  const calcEdad = () => {
    if (!paciente?.fecha_nacimiento) return "";
    const hoy = new Date();
    const nac = new Date(paciente.fecha_nacimiento);
    let anos = hoy.getFullYear() - nac.getFullYear();
    let meses = hoy.getMonth() - nac.getMonth();
    if (meses < 0) { anos--; meses += 12; }
    return `${anos} años ${meses} meses`;
  };

  // ──────────────────────────────────────────────────────
  // RENDER DE TABLA DE REGISTRO (izquierda o derecha)
  // ──────────────────────────────────────────────────────
  const renderTablaRegistro = (vacunasList, titulo) => (
    <div className="mb-0">
      <div style={{
        background: pal.azulOscuro,
        color: pal.blanco,
        textAlign: "center",
        fontWeight: "bold",
        fontSize: 13,
        padding: "6px 10px",
        letterSpacing: 1,
      }}>
        {titulo}
      </div>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 11,
        tableLayout: "fixed",
      }}>
        <colgroup>
          <col style={{ width: "18%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "37%" }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ background: pal.amarillo, color: "#000", border: "1px solid #999", padding: "4px 6px", fontSize: 11 }}>
              Vacuna / Enfermedad que protege
            </th>
            <th style={{ background: pal.amarillo, color: "#000", border: "1px solid #999", padding: "4px 6px", fontSize: 11 }}>
              Dosis
            </th>
            <th colSpan={3} style={{ background: pal.amarillo, color: "#000", border: "1px solid #999", padding: "4px 6px", textAlign: "center", fontSize: 11 }}>
              Fecha de aplicación
            </th>
            <th style={{ background: pal.amarillo, color: "#000", border: "1px solid #999", padding: "4px 6px", fontSize: 10, textAlign: "center" }}>
              Próxima cita
            </th>
            <th style={{ background: pal.amarillo, color: "#000", border: "1px solid #999", padding: "4px 6px", fontSize: 11 }}>
              Nombre del vacunador
            </th>
          </tr>
          <tr>
            <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "2px 4px" }}></th>
            <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "2px 4px" }}></th>
            <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "2px 4px", textAlign: "center", fontSize: 10 }}>Día</th>
            <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "2px 4px", textAlign: "center", fontSize: 10, whiteSpace: "nowrap" }}>Mes</th>
            <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "2px 4px", textAlign: "center", fontSize: 10 }}>Año</th>
            <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "2px 4px", textAlign: "center", fontSize: 10 }}>(Día, nombre del mes y año)</th>
            <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "2px 4px" }}></th>
          </tr>
        </thead>
        <tbody>
          {vacunasList.map((vacuna, vi) =>
            vacuna.dosis.map((dosis, di) => {
              const reg = encontrarRegistro(registros, vacuna.codigo, dosis.key);
              const dia  = reg?.fecha_dia  ? String(reg.fecha_dia).padStart(2, "0")  : "";
              const mes  = reg?.fecha_mes  ? String(reg.fecha_mes).padStart(2, "0")  : "";
              const ano  = reg?.fecha_ano  ? String(reg.fecha_ano) : "";
              const bg   = reg ? "#e8f5e9" : "#fff";

              return (
                <tr key={`${vi}-${di}`} style={{ background: bg }}>
                  {di === 0 && (
                    <td
                      rowSpan={vacuna.dosis.length}
                      style={{
                        border: "1px solid #ccc",
                        padding: "3px 6px",
                        verticalAlign: "middle",
                        fontWeight: "bold",
                        fontSize: 11,
                        background: "#d9e8ff",
                        lineHeight: 1.3,
                      }}
                    >
                      {vacuna.nombre.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}
                      {vacuna.descripcion && (
                        <span style={{ fontWeight: "normal", fontSize: 9, color: "#444" }}>
                          {vacuna.descripcion.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}
                        </span>
                      )}
                    </td>
                  )}
                  <td style={{ border: "1px solid #ccc", padding: "2px 4px", fontSize: 11 }}>
                    {dosis.label}
                  </td>
                  {/* Día */}
                  <td
                    style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "center", fontSize: 11, cursor: "pointer", background: bg }}
                    onClick={() => abrirModalVacuna(vacuna, di)}
                  >
                    {dia}
                  </td>
                  {/* Mes */}
                  <td
                    style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "center", fontSize: 11, cursor: "pointer", background: bg }}
                    onClick={() => abrirModalVacuna(vacuna, di)}
                  >
                    {mes}
                  </td>
                  {/* Año */}
                  <td
                    style={{ border: "1px solid #ccc", padding: "2px 3px", textAlign: "center", fontSize: 11, cursor: "pointer", background: bg }}
                    onClick={() => abrirModalVacuna(vacuna, di)}
                  >
                    {ano}
                  </td>
                  {/* Próxima cita */}
                  <td
                    style={{ border: "1px solid #ccc", padding: "2px 4px", fontSize: 10, cursor: "pointer", background: bg }}
                    onClick={() => abrirModalVacuna(vacuna, di)}
                  >
                    {reg?.proxima_cita || ""}
                  </td>
                  {/* Vacunador */}
                  <td
                    style={{ border: "1px solid #ccc", padding: "2px 4px", fontSize: 10, cursor: "pointer", background: bg }}
                    onClick={() => abrirModalVacuna(vacuna, di)}
                  >
                    {reg?.nombre_vacunador || (
                      <span style={{ color: "#bbb", fontSize: 10 }}>Clic para registrar</span>
                    )}
                    {reg && (
                      <button
                        className="btn btn-sm p-0 ms-1"
                        style={{ lineHeight: 1, fontSize: 10, color: "#dc3545" }}
                        onClick={e => { e.stopPropagation(); handleEliminarVacuna(reg.id); }}
                        title="Eliminar"
                      >
                        <i className="bi bi-x-circle" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  // ──────────────────────────────────────────────────────
  // RENDER OTRAS VACUNAS Y JORNADAS (filas clickeables)
  // ──────────────────────────────────────────────────────
  const renderFilasAbiertas = (seccion, n) => {
    const codigo = seccion === "OTRAS" ? "OTRAS" : "JORNADAS";
    const filasRegistro = registros.filter(r => r.vacuna_codigo === codigo);
    // Siempre mostrar al menos n filas vacías adicionales para nuevas entradas
    const filasVacias = Math.max(n - filasRegistro.length, 1);

    const tdStyle = { border: "1px solid #ccc", padding: "5px 4px", fontSize: 11, verticalAlign: "middle" };
    const thStyle = { background: pal.amarillo, border: "1px solid #999", padding: "3px 4px", fontSize: 10 };

    return (
      <div className="mb-1">
        {/* Encabezado con botón agregar */}
        <div style={{
          background: pal.amarillo,
          fontWeight: "bold",
          fontSize: 11,
          padding: "3px 8px",
          border: "1px solid #999",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{seccion === "OTRAS" ? "OTRAS VACUNAS:" : "VACUNAS APLICADAS EN JORNADAS / CAMPAÑAS:"}</span>
          <button
            className="btn btn-sm py-0 px-2"
            style={{ background: pal.azulOscuro, color: "#fff", fontSize: 10, lineHeight: 1.4 }}
            onClick={() => abrirModalOtraVacuna(seccion)}
            title="Agregar vacuna"
          >
            <i className="bi bi-plus-lg me-1" />Agregar
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "37%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>Vacuna</th>
              <th style={thStyle}>Dosis</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Día</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Mes</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Año</th>
              <th style={thStyle}>Próxima Cita</th>
              <th style={thStyle}>Nombre del vacunador</th>
            </tr>
          </thead>
          <tbody>
            {/* Filas con registros existentes (editables) */}
            {filasRegistro.map((reg) => {
              const dia = reg.fecha_dia ? String(reg.fecha_dia).padStart(2, "0") : "";
              const mes = reg.fecha_mes ? String(reg.fecha_mes).padStart(2, "0") : "";
              const ano = reg.fecha_ano ? String(reg.fecha_ano) : "";
              return (
                <tr
                  key={reg.id}
                  style={{ background: "#e8f5e9", cursor: "pointer" }}
                  onClick={() => abrirModalOtraVacuna(seccion, reg)}
                  title="Clic para editar"
                >
                  <td style={{ ...tdStyle, fontWeight: "bold", color: "#1a5e29" }}>
                    {reg.vacuna_nombre}
                  </td>
                  <td style={tdStyle}>{reg.dosis_nombre || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{dia}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{mes}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{ano}</td>
                  <td style={tdStyle}>{reg.proxima_cita || ""}</td>
                  <td style={tdStyle}>
                    <span>{reg.nombre_vacunador || ""}</span>
                    <i className="bi bi-pencil-square ms-2 text-secondary" style={{ fontSize: 10 }} />
                  </td>
                </tr>
              );
            })}
            {/* Filas vacías clickeables para agregar */}
            {Array.from({ length: filasVacias }).map((_, i) => (
              <tr
                key={`empty-${i}`}
                style={{ background: "#fffde7", cursor: "pointer" }}
                onClick={() => abrirModalOtraVacuna(seccion)}
                title="Clic para registrar nueva vacuna"
              >
                <td style={{ ...tdStyle, color: "#bbb", fontStyle: "italic" }}>
                  {i === 0 ? "Clic para registrar..." : ""}
                </td>
                <td style={{ border: "1px solid #ccc", height: 28 }}>&nbsp;</td>
                <td style={{ border: "1px solid #ccc" }}>&nbsp;</td>
                <td style={{ border: "1px solid #ccc" }}>&nbsp;</td>
                <td style={{ border: "1px solid #ccc" }}>&nbsp;</td>
                <td style={{ border: "1px solid #ccc" }}>&nbsp;</td>
                <td style={{ border: "1px solid #ccc" }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border" style={{ color: pal.azulOscuro }} />
        <span className="ms-3">Cargando carnet de vacunación...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Alerta temporal */}
      {msg && (
        <div className={`alert ${msg.startsWith("✅") ? "alert-success" : "alert-danger"} py-2 mb-3`}>
          {msg}
        </div>
      )}

      {/* Sub-pestañas del módulo */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: `3px solid ${pal.azulOscuro}` }}>
        <ul className="nav nav-tabs mb-0 flex-grow-1" style={{ borderBottom: "none" }}>
          {[
            { key: "carnet",   label: "Carnet",             icon: "bi-person-vcard" },
            { key: "registro", label: "Registro Vacunas",   icon: "bi-capsule" },
            { key: "vitamina", label: "Supl. Vitamina A",   icon: "bi-capsule" },
            { key: "guia",     label: "Guía de Vacunación", icon: "bi-journal-medical" },
          ].map(t => (
            <li key={t.key} className="nav-item">
              <button
                className={`nav-link ${subTab === t.key ? "active fw-bold" : ""}`}
                style={subTab === t.key
                  ? { background: pal.azulOscuro, color: pal.blanco, borderColor: pal.azulOscuro }
                  : { color: pal.azulOscuro }
                }
                onClick={() => setSubTab(t.key)}
              >
                <i className={`bi ${t.icon} me-1`} />{t.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Botón personalizar colores */}
        <button
          title="Personalizar colores del carnet"
          onClick={() => setShowColorPanel(v => !v)}
          style={{
            background: showColorPanel ? pal.azulOscuro : "transparent",
            border: `1px solid ${pal.azulOscuro}`,
            borderRadius: 6, padding: "4px 10px", marginRight: 4,
            color: showColorPanel ? "#fff" : pal.azulOscuro,
            cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 5,
            transition: "all .15s",
          }}
        >
          <i className="bi bi-palette-fill" /> Colores
        </button>
      </div>

      {/* Panel de personalización de colores */}
      {showColorPanel && (
        <div style={{
          background: "#f8fafc", border: `1px solid ${pal.azulOscuro}33`,
          borderTop: "none", padding: "12px 16px",
          display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end",
        }}>
          {/* Pickers */}
          {[
            { campo: "principal",  label: "Color principal",    valor: colores.principal },
            { campo: "secundario", label: "Color secundario",   valor: colores.secundario },
            { campo: "claro",      label: "Color encabezados",  valor: colores.claro },
          ].map(({ campo, label, valor }) => (
            <div key={campo}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="color"
                  value={valor}
                  onChange={e => actualizarColor(campo, e.target.value)}
                  style={{ width: 36, height: 28, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", padding: 2 }}
                />
                <span style={{ fontSize: 11, color: "#374151", fontFamily: "monospace" }}>{valor}</span>
              </div>
            </div>
          ))}

          {/* Separador */}
          <div style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch", margin: "0 4px" }} />

          {/* Presets */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Presets</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESETS_COLORES.map(p => (
                <button
                  key={p.nombre}
                  onClick={() => aplicarPreset(p)}
                  title={p.nombre}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    border: "1px solid #d1d5db", borderRadius: 6,
                    padding: "4px 10px", cursor: "pointer",
                    background: "#fff", fontSize: 11, fontWeight: 500,
                    transition: "border-color .15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = p.principal}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}
                >
                  <span style={{
                    display: "inline-flex", gap: 2,
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: p.principal, display: "inline-block" }} />
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: p.secundario, display: "inline-block" }} />
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: p.claro, display: "inline-block" }} />
                  </span>
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ */}
      {/* TAB: CARNET */}
      {/* ════════════════════════════════ */}
      {subTab === "carnet" && (
        <div className="card shadow-sm border-0 mt-0" style={{ borderTop: `3px solid ${pal.azulOscuro}` }}>
          {/* Header amarillo */}
          <div style={{
            background: pal.amarillo,
            padding: "8px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div style={{ fontWeight: "bold", fontSize: 14, color: "#000" }}>
              <i className="bi bi-person-vcard me-2" />CARNET DE VACUNACIÓN
            </div>
            <button
              className="btn btn-sm"
              style={{ background: pal.azulOscuro, color: "#fff", fontSize: 12 }}
              onClick={() => imprimirCarnet(paciente, registros, vitaminaRegs, pal)}
            >
              <i className="bi bi-printer me-1" />Imprimir Carnet
            </button>
          </div>

          <div className="card-body" style={{ background: "#f7f9ff" }}>
            <div className="row">
              {/* Datos del paciente */}
              <div className="col-md-8">
                <h6 className="fw-bold mb-3" style={{ color: pal.azulOscuro }}>
                  <i className="bi bi-person-fill me-2" />Datos del Paciente
                </h6>
                <table className="table table-sm table-bordered" style={{ fontSize: 13 }}>
                  <tbody>
                    <tr>
                      <th style={{ background: pal.azulClaro, width: "30%" }}>Nombre</th>
                      <td>{paciente?.nombres} {paciente?.apellidos}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>No. Identidad (DNI)</th>
                      <td>{paciente?.dni || <span className="text-muted fst-italic">No registrado</span>}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Fecha de Nacimiento</th>
                      <td>{paciente?.fecha_nacimiento || "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Sexo</th>
                      <td>{paciente?.sexo || "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Edad Actual</th>
                      <td>{calcEdad()}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>No. en el LINVI</th>
                      <td className="text-muted">&nbsp;</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Dirección de Residencia</th>
                      <td>{paciente?.direccion || paciente?.ciudad || "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Responsable o Tutor</th>
                      <td>{paciente?.responsable_nombre || "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Teléfono / Celular</th>
                      <td>{paciente?.telefono || "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Nombre del Establecimiento</th>
                      <td className="text-muted">&nbsp;</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Código Establecimiento</th>
                      <td className="text-muted">&nbsp;</td>
                    </tr>
                    <tr>
                      <th style={{ background: pal.azulClaro }}>Dirección y Teléfono del Establecimiento</th>
                      <td className="text-muted">&nbsp;</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Resumen de vacunas aplicadas */}
              <div className="col-md-4">
                <h6 className="fw-bold mb-3" style={{ color: pal.azulOscuro }}>
                  <i className="bi bi-bar-chart-fill me-2" />Resumen
                </h6>
                <div className="card text-center mb-3" style={{ border: `2px solid ${pal.azulOscuro}` }}>
                  <div className="card-body py-3">
                    <div style={{ fontSize: 36, fontWeight: "bold", color: pal.azulOscuro }}>
                      {registros.length}
                    </div>
                    <div className="text-muted" style={{ fontSize: 13 }}>Vacunas registradas</div>
                  </div>
                </div>

                {/* Últimas vacunas */}
                {registros.length > 0 && (
                  <div>
                    <p className="small fw-bold mb-2" style={{ color: pal.azulOscuro }}>Últimas aplicadas:</p>
                    {registros.slice(-5).reverse().map(r => (
                      <div key={r.id} className="d-flex justify-content-between align-items-center mb-1 p-1 rounded"
                        style={{ background: "#e8f5e9", fontSize: 11 }}>
                        <span className="fw-semibold">{r.vacuna_nombre}</span>
                        <span className="text-muted">
                          {r.fecha_dia ? `${String(r.fecha_dia).padStart(2,"0")}/${String(r.fecha_mes).padStart(2,"0")}/${r.fecha_ano}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Frase motivacional */}
                <div className="mt-3 p-3 text-center rounded" style={{ background: pal.amarillo }}>
                  <p className="fw-bold mb-1" style={{ fontSize: 13, color: "#000" }}>
                    "Por nuestras familias,<br />vacunemos hoy"
                  </p>
                  <p style={{ fontSize: 10, color: "#333" }}>
                    Las vacunas son gratuitas en el sector público.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ */}
      {/* TAB: REGISTRO DE VACUNAS */}
      {/* ════════════════════════════════ */}
      {subTab === "registro" && (
        <div className="card shadow-sm border-0 mt-0">
          <div style={{
            background: pal.azulOscuro,
            color: pal.blanco,
            padding: "10px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span className="fw-bold">
              <i className="bi bi-capsule me-2" />REGISTRO DE VACUNAS APLICADAS
            </span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              Haga clic en cualquier celda para registrar o editar
            </span>
          </div>

          <div className="card-body p-0" style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, minWidth: 900 }}>
              {/* Columna izquierda */}
              <div>
                {renderTablaRegistro(VACUNAS_IZQUIERDA, "REGISTRO DE VACUNAS APLICADAS")}
              </div>
              {/* Columna derecha */}
              <div style={{ borderLeft: `3px solid ${pal.azulOscuro}` }}>
                {renderTablaRegistro(VACUNAS_DERECHA, "REGISTRO DE VACUNAS APLICADAS")}
                {/* Otras vacunas */}
                {renderFilasAbiertas("OTRAS", OTRAS_VACUNAS_ROWS)}
                {/* Jornadas */}
                {renderFilasAbiertas("JORNADAS", JORNADAS_ROWS)}
              </div>
            </div>

            {/* Notas al pie */}
            <div style={{ background: "#f0f4ff", borderTop: `2px solid ${pal.azulOscuro}`, padding: "8px 16px", fontSize: 10, color: "#333" }}>
              <p>* Solo aplica para inmunosuprimidos.</p>
              <p>** Solo aplica para sector privado.</p>
              <p>*** Solo aplica para pacientes de diálisis y víctimas de agresión sexual.</p>
              <p>**** Solo aplica para mayores de cinco años.</p>
              <p className="mt-1 fw-bold" style={{ color: "red" }}>
                No se debe administrar acetaminofén al niño antes de recibir la vacuna.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ */}
      {/* TAB: SUPLEMENTACIÓN VITAMINA A */}
      {/* ════════════════════════════════ */}
      {subTab === "vitamina" && (
        <div className="card shadow-sm border-0 mt-0">
          <div style={{
            background: pal.azulOscuro,
            color: pal.blanco,
            padding: "10px 20px",
            fontWeight: "bold",
            fontSize: 14,
            letterSpacing: 1,
          }}>
            <i className="bi bi-capsule me-2" />SUPLEMENTACIÓN DE VITAMINA "A"
          </div>

          <div className="card-body">
            <p className="text-muted small mb-3">
              <i className="bi bi-info-circle me-1" />
              Haga clic en una celda activa para registrar la suplementación de Vitamina A.
            </p>

            <div style={{ overflowX: "auto" }}>
              <table style={{
                borderCollapse: "collapse",
                width: "100%",
                maxWidth: 700,
                fontSize: 12,
              }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{
                      background: pal.azulOscuro, color: pal.blanco,
                      border: "1px solid #999", padding: "8px 12px",
                      textAlign: "left", verticalAlign: "middle",
                    }}>
                    </th>
                    <th style={{
                      background: pal.amarillo, color: "#000", fontWeight: "bold",
                      border: "1px solid #999", padding: "6px 10px",
                      textAlign: "center",
                    }}>
                      Dar 100.000 UI
                    </th>
                    <th colSpan={4} style={{
                      background: pal.amarillo, color: "#000", fontWeight: "bold",
                      border: "1px solid #999", padding: "6px 10px",
                      textAlign: "center",
                    }}>
                      Dar 200.000 UI
                    </th>
                  </tr>
                  <tr>
                    {EDADES_VITAMINA.map(e => (
                      <th key={e.rango} style={{
                        background: pal.azulClaro, color: "#000",
                        border: "1px solid #999", padding: "5px 8px",
                        textAlign: "center", fontWeight: "bold",
                        minWidth: 80,
                      }}>
                        {e.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VITAMINA_A_ESTRUCTURA.map((fila) => (
                    <tr key={fila.tipo_dosis}>
                      <td style={{
                        background: pal.azulOscuro, color: pal.blanco,
                        border: "1px solid #999", padding: "8px 12px",
                        fontWeight: "bold", fontSize: 12,
                      }}>
                        {fila.label}
                      </td>
                      {fila.celdas.map((celda) => {
                        if (!celda.activo) {
                          return (
                            <td key={celda.edad_rango} style={{
                              border: "1px solid #999", background: "#e0e0e0",
                              textAlign: "center", padding: "8px",
                            }}>
                              <span style={{ color: "#bbb" }}>—</span>
                            </td>
                          );
                        }
                        const reg = encontrarVitamina(vitaminaRegs, celda.edad_rango, fila.tipo_dosis);
                        const edad = EDADES_VITAMINA.find(e => e.rango === celda.edad_rango)?.label || "";
                        return (
                          <td
                            key={celda.edad_rango}
                            style={{
                              border: "1px solid #999",
                              background: reg ? "#e8f5e9" : "#fffde7",
                              textAlign: "center",
                              padding: "4px",
                              cursor: "pointer",
                              minHeight: 50,
                              verticalAlign: "middle",
                            }}
                            onClick={() => abrirModalVitamina(
                              celda.edad_rango, fila.tipo_dosis, celda.dosis_ui, edad, fila.label
                            )}
                            title={reg ? "Clic para editar" : "Clic para registrar"}
                          >
                            {reg ? (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: "bold", color: "#2e7d32" }}>
                                  {reg.fecha_dia ? `${String(reg.fecha_dia).padStart(2,"0")}/${String(reg.fecha_mes).padStart(2,"0")}/${reg.fecha_ano}` : "Registrado"}
                                </div>
                                {reg.nombre_vacunador && (
                                  <div style={{ fontSize: 9, color: "#555" }}>{reg.nombre_vacunador}</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#bbb", fontSize: 18 }}>+</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notas al pie */}
            <div className="mt-3 p-3 rounded" style={{ background: "#f0f4ff", fontSize: 11, color: "#333" }}>
              <p className="fw-bold mb-1">Notas relacionadas a la vacunación (antecedentes alérgicos, reacciones, etc.):</p>
              <div style={{
                border: "1px solid #ccc",
                minHeight: 80,
                background: "#fff",
                padding: "8px",
                borderRadius: 4,
                fontSize: 11,
                color: "#888"
              }}>
                {vitaminaRegs
                  .filter(r => r.observaciones)
                  .map(r => (
                    <p key={r.id} className="mb-1">
                      • [{r.edad_rango.replace(/_/g, " ")} - {r.tipo_dosis.replace(/_/g, " ")}]: {r.observaciones}
                    </p>
                  ))
                }
                {vitaminaRegs.filter(r => r.observaciones).length === 0 && (
                  <span>Sin observaciones registradas.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ */}
      {/* TAB: GUÍA DE VACUNACIÓN */}
      {/* ════════════════════════════════ */}
      {subTab === "guia" && (
        <div className="card shadow-sm border-0 mt-0">
          <div style={{
            background: pal.azulOscuro,
            color: pal.blanco,
            padding: "10px 20px",
            fontWeight: "bold",
            fontSize: 14,
            letterSpacing: 1,
          }}>
            <i className="bi bi-journal-medical me-2" />GUÍA DE VACUNACIÓN
          </div>

          <div className="card-body p-0">
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 600,
              }}>
                <thead>
                  <tr>
                    <th style={{
                      background: pal.azulOscuro, color: pal.blanco,
                      border: "1px solid #999", padding: "8px 12px",
                      textAlign: "center",
                    }}>
                      Vacuna
                    </th>
                    <th colSpan={2} style={{
                      background: pal.amarillo, color: "#000",
                      border: "1px solid #999", padding: "8px 12px",
                      textAlign: "center", fontWeight: "bold",
                    }}>
                      Edad recomendada
                    </th>
                  </tr>
                  <tr>
                    <th style={{ background: pal.azulOscuro, color: pal.blanco, border: "1px solid #999", padding: "6px 12px" }}></th>
                    <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "6px 12px", textAlign: "center" }}>
                      Grupo de población
                    </th>
                    <th style={{ background: pal.azulClaro, border: "1px solid #999", padding: "6px 12px", textAlign: "center" }}>
                      Edad recomendada
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {GUIA_VACUNAS.map((g, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#f9fbff" : "#ffffff" }}>
                      <td style={{
                        border: "1px solid #ccc", padding: "6px 12px",
                        fontWeight: "bold", color: pal.azulOscuro,
                        verticalAlign: "middle",
                      }}>
                        {g.vacuna}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "6px 12px", verticalAlign: "middle" }}>
                        {g.grupo}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "6px 12px", verticalAlign: "middle" }}>
                        {g.edad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notas PAI */}
            <div style={{ background: "#fff9e6", borderTop: `2px solid ${pal.amarillo}`, padding: "12px 16px", fontSize: 11 }}>
              <p className="fw-bold mb-2" style={{ color: pal.azulOscuro }}>Notas importantes:</p>
              <ul className="mb-0" style={{ paddingLeft: 16 }}>
                <li>* Solo aplica para inmunosuprimidos.</li>
                <li>** Solo aplica para sector privado.</li>
              <li>*** Opcional en caso de efectos adversos al componente pertussis de la vacuna Hexavalente.</li>
                <li>**** Solo aplica para pacientes de diálisis y víctimas de agresión sexual.</li>
                <li>***** Solo aplica para mayores de cinco años.</li>
              </ul>
              <div className="mt-3 p-2 text-center rounded" style={{ background: pal.amarillo }}>
                <p className="fw-bold mb-0" style={{ fontSize: 13 }}>
                  "Por nuestras familias, vacunemos hoy"
                </p>
              </div>
              <p className="mt-2 text-center" style={{ fontSize: 10, color: "#555" }}>
                Las vacunas son gratuitas en el sector público. •
                Es obligatorio presentar el carnet para solicitar atención médica, ingresar a centros educativos y de trabajo.
              </p>
              <p className="text-center fw-bold mt-1" style={{ fontSize: 10 }}>
                Proteja y guarde el carnet de vacunación
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ */}
      {/* MODALES */}
      {/* ════════════════════════════════ */}
      {modal?.tipo === "vacuna" && (
        <ModalVacuna
          datos={modal.datos}
          onClose={() => setModal(null)}
          onGuardar={handleGuardarVacuna}
          cargando={guardando}
          pal={pal}
        />
      )}
      {modal?.tipo === "vitamina" && (
        <ModalVitaminaA
          datos={modal.datos}
          onClose={() => setModal(null)}
          onGuardar={handleGuardarVitamina}
          cargando={guardando}
          pal={pal}
        />
      )}
      {modal?.tipo === "otra" && (
        <ModalOtraVacuna
          datos={modal.datos}
          onClose={() => setModal(null)}
          onGuardar={handleGuardarOtraVacuna}
          onEliminar={handleEliminarOtraVacuna}
          cargando={guardando}
          pal={pal}
        />
      )}
    </div>
  );
}
