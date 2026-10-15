// Tablero de asistencia (página Estadísticas): cuántos pacientes llegan, faltan
// o cancelan, el efecto de los recordatorios y la lista de espera, y quiénes
// faltan seguido. Usa el mismo mes que el resto de la página.
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import api from "../api/api";
import { prefijoDr } from "../utils/medico";

// Colores de estado (validados para daltonismo; siempre acompañados de leyenda y números)
const COL = { asistio: "#10b981", cancelada: "#f59e0b", falto: "#ef4444", gris: "#94a3b8" };
const tarjeta = { background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
const titulo = { fontWeight: 700, margin: "0 0 14px", fontSize: "0.92rem", color: "#1e293b" };

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

function Tile({ label, valor, sub, icon, color }) {
  return (
    <div className="col-6 col-lg-3">
      <div style={{ ...tarjeta, padding: 16, height: "100%" }}>
        <div className="d-flex align-items-center gap-2 mb-1" style={{ color: "#64748b", fontSize: 12.5, fontWeight: 600 }}>
          <i className={`bi ${icon}`} style={{ color }} />{label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1.15 }}>{valor}</div>
        {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function AsistenciaPanel({ desde, hasta, isMobile }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get("/estadisticas/asistencia", { params: { desde, hasta } })
      .then((r) => setD(r.data.data))
      .catch(() => setError(true));
  }, [desde, hasta]);

  const px = isMobile ? "px-1" : "px-3";
  if (error) return <div className={`${px} text-muted small py-3`}>No se pudo cargar el tablero de asistencia.</div>;
  if (!d) return <div className={`${px} text-muted small py-3`}><span className="spinner-border spinner-border-sm me-2" />Calculando asistencia…</div>;

  const t = d.totales;
  const marcadas = t.asistieron + t.no_asistio;
  const tasa = pct(t.asistieron, marcadas);
  const tasaCancel = pct(t.canceladas, t.total);
  const tendencia = d.tendencia.map((m) => ({
    mes: dayjs(`${m.mes}-01`).format("MMM YY"),
    Asistieron: m.asistieron, "No asistió": m.no_asistio, Canceladas: m.canceladas,
  }));

  return (
    <div className={px} style={{ paddingBottom: isMobile ? 8 : 24 }}>
      <h5 style={{ fontWeight: 800, color: "#1e293b", fontSize: "1rem", margin: isMobile ? "16px 4px 10px" : "24px 0 12px" }}>
        <i className="bi bi-person-check me-2" style={{ color: COL.asistio }} />Asistencia de pacientes
      </h5>

      <div className={`row ${isMobile ? "g-1" : "g-3"} mb-3`}>
        <Tile label="Tasa de asistencia" icon="bi-check-circle-fill" color={COL.asistio}
          valor={tasa === null ? "—" : `${tasa}%`}
          sub={marcadas ? `${t.asistieron} de ${marcadas} citas atendidas o ausentes` : "Sin citas pasadas en el mes"} />
        <Tile label="No asistieron" icon="bi-x-circle-fill" color={COL.falto}
          valor={t.no_asistio} sub={t.sin_marcar ? `${t.sin_marcar} cita(s) pasadas sin marcar` : "Todas las citas marcadas"} />
        <Tile label="Canceladas" icon="bi-calendar-x" color={COL.cancelada}
          valor={t.canceladas} sub={tasaCancel === null ? null : `${tasaCancel}% de las citas · ${d.enlaces.canceladas} desde el recordatorio`} />
        <Tile label="Espacios recuperados" icon="bi-hourglass-split" color="#2563eb"
          valor={d.lista_espera.recuperadas} sub="Citas tomadas desde la lista de espera" />
      </div>

      <div className={`row ${isMobile ? "g-1" : "g-3"}`}>
        <div className="col-lg-7">
          <div style={{ ...tarjeta, padding: isMobile ? 12 : 20, height: "100%" }}>
            <h6 style={titulo}>Últimos 6 meses</h6>
            {tendencia.length === 0 ? (
              <p style={{ color: "#999", fontSize: 13 }}>Sin datos todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={tendencia} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "#f1f5f9" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar dataKey="Asistieron" stackId="a" fill={COL.asistio} stroke="#fff" strokeWidth={2} maxBarSize={36} />
                  <Bar dataKey="No asistió" stackId="a" fill={COL.falto} stroke="#fff" strokeWidth={2} maxBarSize={36} />
                  <Bar dataKey="Canceladas" stackId="a" fill={COL.cancelada} stroke="#fff" strokeWidth={2} maxBarSize={36} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div style={{ ...tarjeta, padding: isMobile ? 12 : 20, height: "100%" }}>
            <h6 style={titulo}>Recordatorios este mes</h6>
            <div style={{ fontSize: 13.5, color: "#334155" }}>
              <div className="d-flex justify-content-between py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <span><i className="bi bi-send me-2 text-primary" />Recordatorios enviados</span><strong>{d.recordatorios.enviados}</strong>
              </div>
              <div className="d-flex justify-content-between py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
                <span><i className="bi bi-hand-thumbs-up me-2" style={{ color: COL.asistio }} />Confirmaron desde el enlace</span><strong>{d.enlaces.confirmadas}</strong>
              </div>
              <div className="d-flex justify-content-between py-2">
                <span><i className="bi bi-calendar-x me-2" style={{ color: COL.cancelada }} />Cancelaron desde el enlace</span><strong>{d.enlaces.canceladas}</strong>
              </div>
            </div>
            <p className="text-muted mb-0 mt-2" style={{ fontSize: 12 }}>
              Una cancelación avisada a tiempo libera el espacio para la lista de espera; una ausencia sin aviso se pierde.
            </p>
          </div>
        </div>
      </div>

      {d.por_medico.length > 0 && (
        <div style={{ ...tarjeta, padding: isMobile ? 12 : 20, marginTop: isMobile ? 8 : 16 }}>
          <h6 style={titulo}>Por médico</h6>
          <div className="table-responsive">
            <table className="table table-sm mb-0 align-middle" style={{ fontSize: 13 }}>
              <thead>
                <tr className="text-muted small">
                  <th>Médico</th><th className="text-center">Citas</th><th className="text-center">Asistieron</th>
                  <th className="text-center">No asistió</th><th className="text-center">Canceladas</th><th className="text-center">Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {d.por_medico.map((m) => {
                  const tm = pct(m.asistieron, m.asistieron + m.no_asistio);
                  return (
                    <tr key={m.medico_id}>
                      <td className="fw-semibold">{prefijoDr()}{m.nombres} {m.apellidos}</td>
                      <td className="text-center">{m.total}</td>
                      <td className="text-center">{m.asistieron}</td>
                      <td className="text-center">{m.no_asistio}</td>
                      <td className="text-center">{m.canceladas}</td>
                      <td className="text-center fw-bold">{tm === null ? "—" : `${tm}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ ...tarjeta, padding: isMobile ? 12 : 20, marginTop: isMobile ? 8 : 16 }}>
        <h6 style={titulo}>Pacientes que más faltan <span className="text-muted fw-normal" style={{ fontSize: 12 }}>(2 o más ausencias en 6 meses)</span></h6>
        {d.ausentes.length === 0 ? (
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>Ningún paciente con ausencias repetidas. 🎉</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm mb-0 align-middle" style={{ fontSize: 13 }}>
              <thead><tr className="text-muted small"><th>Paciente</th><th>Teléfono</th><th className="text-center">Ausencias</th><th className="text-center">De citas</th><th>Última ausencia</th></tr></thead>
              <tbody>
                {d.ausentes.map((p) => (
                  <tr key={p.id}>
                    <td className="fw-semibold">{p.nombres} {p.apellidos}</td>
                    <td>{p.telefono ? <a href={`tel:${p.telefono}`}>{p.telefono}</a> : <span className="text-muted">—</span>}</td>
                    <td className="text-center fw-bold">{p.ausencias}</td>
                    <td className="text-center">{p.citas}</td>
                    <td>{p.ultima ? dayjs(p.ultima).format("DD/MM/YYYY") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
