// 🩺 "Antes de entrar": lo esencial del paciente en 5 segundos al abrir la consulta.
// Alergias (siempre visibles), antecedentes, últimos signos vitales, medicamentos de
// la última receta, estudios, asistencia, control pendiente y saldo.
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import api from "../../api/api";
import { edadDetallada } from "../../utils/edadDetallada";

const SEVERIDAD = {
  MORTAL:   { bg: "#7f1d1d", fg: "#fff" },
  SEVERA:   { bg: "#dc2626", fg: "#fff" },
  MODERADA: { bg: "#fee2e2", fg: "#b91c1c" },
  LEVE:     { bg: "#fef2f2", fg: "#b91c1c" },
};
const SEXO = { M: "Masculino", F: "Femenino", OTRO: "Otro" };
const CLAVE_PLEGADO = "antes_de_entrar_plegado";

const fecha = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "");
const haceCuanto = (f) => {
  if (!f) return "";
  const dias = dayjs().startOf("day").diff(dayjs(f), "day");
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : `hace ${Math.round(meses / 12)} año(s)`;
};

function Bloque({ icono, color, titulo, extra, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".03em" }}>
        <i className={`bi ${icono}`} style={{ color, fontSize: "0.85rem" }} />
        <span style={{ flex: 1 }}>{titulo}</span>
        {extra && <span style={{ textTransform: "none", fontWeight: 500, color: "#94a3b8", letterSpacing: 0 }}>{extra}</span>}
      </div>
      <div style={{ fontSize: "0.83rem", color: "#334155" }}>{children}</div>
    </div>
  );
}

// Diferencia de peso respecto a la consulta anterior
function Tendencia({ actual, anterior, unidad }) {
  const a = parseFloat(actual); const b = parseFloat(anterior);
  if (!isFinite(a) || !isFinite(b) || a === b) return null;
  const dif = Math.round((a - b) * 10) / 10;
  return (
    <span style={{ color: dif > 0 ? "#b45309" : "#0369a1", fontSize: "0.72rem", fontWeight: 700, marginLeft: 4 }}>
      {dif > 0 ? "▲" : "▼"} {Math.abs(dif)} {unidad}
    </span>
  );
}

export default function AntesDeEntrar({ pacienteId, excluirHistoria }) {
  const [d, setD] = useState(null);
  const [plegado, setPlegado] = useState(() => {
    try { return localStorage.getItem(CLAVE_PLEGADO) === "1"; } catch { return false; }
  });

  const [evo, setEvo] = useState([]); // puntos de atención de la Evolución del paciente

  useEffect(() => {
    if (!pacienteId) return;
    api.get(`/antes-de-entrar/${pacienteId}`, { params: excluirHistoria ? { excluir_historia: excluirHistoria } : {} })
      .then((r) => setD(r.data.data))
      .catch(() => setD(null));
    api.get(`/evolucion/${pacienteId}`)
      .then((r) => setEvo((r.data.data?.avisos || []).filter((a) => a.nivel !== "bueno" && a.icono !== "bi-calendar2-x").slice(0, 3)))
      .catch(() => setEvo([]));
  }, [pacienteId, excluirHistoria]);

  if (!d) return null;
  const alternar = () => {
    setPlegado((v) => { try { localStorage.setItem(CLAVE_PLEGADO, v ? "0" : "1"); } catch { /* sin almacenamiento */ } return !v; });
  };

  const { paciente: p, alergias, antecedentes, vitales, medicamentos, estudios, asistencia, control, saldo } = d;
  const pendientes = estudios.filter((e) => ["SOLICITADO", "EN_PROCESO"].includes(e.estado) && !e.resultados);
  const conResultado = estudios.filter((e) => e.resultados > 0);
  const v = vitales?.ultimo; const va = vitales?.anterior;
  const avisos = [];
  if (asistencia?.falto) avisos.push({ icono: "bi-calendar-x", color: "#dc2626", texto: `Faltó a ${asistencia.falto} cita(s) en el último año` });
  if (control) avisos.push({ icono: "bi-arrow-repeat", color: "#0891b2", texto: `Control indicado para el ${fecha(control.fecha)}${control.motivo ? `: ${control.motivo}` : ""}` });
  // Puntos de atención de la evolución (presión, laboratorios fuera de rango, peso…)
  for (const a of evo) avisos.push({ icono: a.icono || "bi-graph-up-arrow", color: a.nivel === "alto" ? "#dc2626" : "#d97706", texto: a.texto });
  if (saldo) avisos.push({ icono: "bi-cash-coin", color: "#b45309", texto: `${saldo.facturas} factura(s) pendiente(s): ${saldo.moneda} ${saldo.total.toLocaleString("es-HN", { minimumFractionDigits: 2 })}` });

  const hayDetalle = antecedentes.length || v || medicamentos || estudios.length || avisos.length;

  return (
    <div style={{ background: "linear-gradient(135deg,#f8fafc,#eef2ff)", border: "1px solid #c7d2fe", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
      <style>{`.ade-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-top: 10px; }`}</style>

      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, color: "#312e81", fontSize: "0.88rem" }}>
          <i className="bi bi-clipboard2-pulse me-1" />Antes de entrar
        </span>
        <span style={{ fontSize: "0.78rem", color: "#475569" }}>
          {[edadDetallada(p.fecha_nacimiento) || (p.edad != null ? `${p.edad} años` : null), SEXO[p.sexo], p.grupo_sanguineo ? `Sangre ${p.grupo_sanguineo}` : null].filter(Boolean).join(" · ")}
        </span>
        <a href={`/pacientes/${pacienteId}/perfil?tab=evolucion`} target="_blank" rel="noopener noreferrer"
          className="ms-auto" style={{ fontSize: "0.76rem", textDecoration: "none", fontWeight: 600, color: "#4338ca" }}
          title="Abre la evolución del paciente (gráficas) en otra pestaña, sin salir de la consulta">
          <i className="bi bi-graph-up-arrow me-1" />Ver evolución
        </a>
        {hayDetalle ? (
          <button type="button" onClick={alternar} className="btn btn-link btn-sm p-0" style={{ fontSize: "0.76rem", textDecoration: "none" }}>
            {plegado ? <>Ver resumen <i className="bi bi-chevron-down" /></> : <>Ocultar <i className="bi bi-chevron-up" /></>}
          </button>
        ) : null}
      </div>

      {/* Alergias: siempre visibles, aunque el resumen esté plegado */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {alergias.length ? alergias.map((a, i) => {
          const c = SEVERIDAD[a.severidad] || SEVERIDAD.MODERADA;
          return (
            <span key={i} title={a.reaccion || ""} style={{ background: c.bg, color: c.fg, borderRadius: 999, padding: "3px 10px", fontSize: "0.78rem", fontWeight: 700 }}>
              <i className="bi bi-exclamation-triangle-fill me-1" />Alergia: {a.agente}
              {a.severidad && <span style={{ fontWeight: 500, opacity: .9 }}> · {a.severidad.toLowerCase()}</span>}
            </span>
          );
        }) : (
          <span style={{ fontSize: "0.76rem", color: "#64748b" }}><i className="bi bi-shield-check me-1" style={{ color: "#16a34a" }} />Sin alergias registradas</span>
        )}
      </div>

      {!plegado && hayDetalle ? (
        <div className="ade-grid">
          {avisos.length > 0 && (
            <Bloque icono="bi-bell" color="#f59e0b" titulo="Tener en cuenta">
              {avisos.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                  <i className={`bi ${a.icono}`} style={{ color: a.color }} /><span>{a.texto}</span>
                </div>
              ))}
            </Bloque>
          )}

          {v && (
            <Bloque icono="bi-heart-pulse" color="#ef4444" titulo="Últimos signos" extra={haceCuanto(v.fecha)}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
                {v.pa && <span><strong>P.A.</strong> {v.pa}</span>}
                {v.fc && <span><strong>F.C.</strong> {v.fc}</span>}
                {v.temp && <span><strong>Temp.</strong> {v.temp}°</span>}
                {v.spo2 && <span><strong>SpO₂</strong> {v.spo2}%</span>}
                {v.peso && <span><strong>Peso</strong> {v.peso} kg<Tendencia actual={v.peso} anterior={va?.peso} unidad="kg" /></span>}
                {v.talla && <span><strong>Talla</strong> {v.talla} cm</span>}
              </div>
              {va?.pa && v.pa && va.pa !== v.pa && <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>P.A. anterior: {va.pa} ({fecha(va.fecha)})</div>}
            </Bloque>
          )}

          {medicamentos && (
            <Bloque icono="bi-capsule" color="#8b5cf6" titulo="Última receta" extra={haceCuanto(medicamentos.fecha)}>
              {medicamentos.items.slice(0, 5).map((m, i) => (
                <div key={i} className="text-truncate" title={[m.medicamento, m.dosis, m.duracion].filter(Boolean).join(" · ")}>
                  • <strong>{m.medicamento}</strong>{m.dosis ? ` — ${m.dosis}` : ""}
                </div>
              ))}
              {medicamentos.items.length > 5 && <div style={{ color: "#94a3b8", fontSize: "0.74rem" }}>y {medicamentos.items.length - 5} más</div>}
            </Bloque>
          )}

          {antecedentes.length > 0 && (
            <Bloque icono="bi-journal-medical" color="#0ea5e9" titulo="Antecedentes">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {antecedentes.map((a, i) => (
                  <span key={i} title={a.tipo} style={{ background: "#e0f2fe", color: "#075985", borderRadius: 6, padding: "1px 7px", fontSize: "0.76rem", fontWeight: 600 }}>
                    {String(a.descripcion || a.tipo).slice(0, 60)}
                  </span>
                ))}
              </div>
            </Bloque>
          )}

          {estudios.length > 0 && (
            <Bloque icono="bi-clipboard2-data" color="#10b981" titulo="Estudios" extra="últimos 6 meses">
              {conResultado.slice(0, 3).map((e) => (
                <div key={e.id}>
                  <i className="bi bi-check-circle-fill me-1" style={{ color: e.anormales ? "#dc2626" : "#16a34a" }} />
                  {e.descripcion || e.tipo} — <strong style={{ color: e.anormales ? "#dc2626" : "#16a34a" }}>{e.anormales ? `${e.anormales} valor(es) fuera de rango` : "resultado listo"}</strong>
                </div>
              ))}
              {pendientes.slice(0, 3).map((e) => (
                <div key={e.id}>
                  <i className="bi bi-hourglass-split me-1" style={{ color: "#f59e0b" }} />
                  {e.descripcion || e.tipo} — pendiente{e.urgente ? <strong style={{ color: "#dc2626" }}> · urgente</strong> : ""}
                </div>
              ))}
              {!conResultado.length && !pendientes.length && <span style={{ color: "#94a3b8" }}>Sin estudios pendientes</span>}
            </Bloque>
          )}
        </div>
      ) : null}
    </div>
  );
}
