// Sección "Perfil público" del Dashboard: enlace y QR para compartir, y las
// visitas que recibe. El médico ve su perfil; el administrador ve la clínica
// completa (página de la clínica + perfil de cada médico).
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import api from "../api/api";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const C = { azul: "#2563eb", texto: "#0f172a", gris: "#64748b", borde: "#e5e7eb" };
const tarjeta = { background: "#fff", borderRadius: 12, border: `1px solid ${C.borde}`, boxShadow: "0 2px 8px rgba(0,0,0,.06)" };

const PERIODOS = [
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "3 meses" },
  { id: "mes", label: "Este mes" },
];
const ORIGEN = {
  DIRECTO: { label: "Directo / enlace", icon: "bi-link-45deg" },
  QR: { label: "Código QR", icon: "bi-qr-code" },
  GOOGLE: { label: "Google", icon: "bi-google" },
  FACEBOOK: { label: "Facebook", icon: "bi-facebook" },
  INSTAGRAM: { label: "Instagram", icon: "bi-instagram" },
  WHATSAPP: { label: "WhatsApp", icon: "bi-whatsapp" },
  TIKTOK: { label: "TikTok", icon: "bi-tiktok" },
  OTRO: { label: "Otros sitios", icon: "bi-globe2" },
};

async function descargarQR(tipo, slug) {
  try {
    const r = await fetch(`${API}/api/perfil-publico/qr/${tipo}/${slug}.png`);
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url; a.download = `qr-${slug}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    window.open(`${API}/api/perfil-publico/qr/${tipo}/${slug}.png`, "_blank", "noopener");
  }
}

function Compartir({ titulo, url, tipo, slug, principal }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin portapapeles */ }
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(`Agenda tu cita conmigo aquí: ${url}`)}`;
  return (
    <div className="d-flex gap-3 align-items-center flex-wrap" style={{ padding: principal ? 0 : "10px 0", borderTop: principal ? "none" : "1px solid #f1f5f9" }}>
      {principal && (
        <img src={`${API}/api/perfil-publico/qr/${tipo}/${slug}.png`} alt="Código QR"
          style={{ width: 104, height: 104, borderRadius: 10, border: `1px solid ${C.borde}`, background: "#fff" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fw-semibold" style={{ color: C.texto, fontSize: principal ? 15 : 14 }}>{titulo}</div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="d-block text-truncate" style={{ fontSize: 13, color: C.azul }}>{url.replace(/^https?:\/\//, "")}</a>
        <div className="d-flex gap-2 flex-wrap mt-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={copiar} style={{ borderRadius: 8 }}>
            <i className={`bi ${copiado ? "bi-check2" : "bi-clipboard"} me-1`} />{copiado ? "Copiado" : "Copiar"}
          </button>
          <a className="btn btn-sm btn-outline-success" href={wa} target="_blank" rel="noopener noreferrer" style={{ borderRadius: 8 }}>
            <i className="bi bi-whatsapp me-1" />Compartir
          </a>
          <button className="btn btn-sm btn-outline-primary" onClick={() => descargarQR(tipo, slug)} style={{ borderRadius: 8 }}>
            <i className="bi bi-qr-code me-1" />Descargar QR
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ valor, label, icon, color, sub }) {
  return (
    <div className="col-6 col-lg">
      <div style={{ ...tarjeta, padding: 14, height: "100%", borderLeft: `3px solid ${color}` }}>
        <div className="d-flex align-items-center gap-2" style={{ color: C.gris, fontSize: 12.5, fontWeight: 600 }}>
          <i className={`bi ${icon}`} style={{ color }} />{label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.texto, lineHeight: 1.2 }}>{valor}</div>
        {sub && <div style={{ fontSize: 11.5, color: C.gris }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function PerfilPublicoPanel({ isMobile }) {
  const [enlaces, setEnlaces] = useState(null);
  const [periodo, setPeriodo] = useState("30d");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get("/perfil-publico/mis-enlaces").then((r) => setEnlaces(r.data.data)).catch(() => setError(true));
  }, []);

  const cargar = useCallback(() => {
    api.get("/perfil-publico/estadisticas", { params: { periodo } })
      .then((r) => setStats(r.data.data)).catch(() => setError(true));
  }, [periodo]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return null; // la sección es un extra: si falla, el Dashboard sigue igual
  const px = isMobile ? "px-1" : "px-3";
  const esAdmin = stats?.es_admin;
  const yo = enlaces?.medicos?.[0];
  const t = stats?.totales;
  const conversion = t && t.vistas ? Math.round((t.citas / t.vistas) * 100) : null;
  const serie = (stats?.serie || []).map((s) => ({ ...s, dia: dayjs(s.fecha).format("DD/MM") }));
  const totalOrigen = (stats?.origenes || []).reduce((a, o) => a + o.total, 0) || 1;

  return (
    <div className={px} style={{ marginTop: isMobile ? 8 : 16 }}>
      <div style={{ ...tarjeta, padding: isMobile ? 14 : 20 }}>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
          <div>
            <h6 className="mb-0" style={{ fontWeight: 800, color: C.texto, fontSize: "1rem" }}>
              <i className="bi bi-person-badge me-2" style={{ color: C.azul }} />
              {esAdmin ? "Perfil público de la clínica" : "Mi perfil público"}
            </h6>
            <div style={{ fontSize: 12.5, color: C.gris }}>Comparte tu enlace o QR: cada visita, clic y cita agendada se cuenta aquí.</div>
          </div>
          <div className="d-flex gap-1 p-1" style={{ background: "#f1f5f9", borderRadius: 10 }}>
            {PERIODOS.map((p) => (
              <button key={p.id} onClick={() => setPeriodo(p.id)} className="btn btn-sm"
                style={{ border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12.5, padding: "5px 10px",
                  background: periodo === p.id ? "#fff" : "transparent", color: periodo === p.id ? C.texto : C.gris,
                  boxShadow: periodo === p.id ? "0 1px 3px rgba(0,0,0,.12)" : "none" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Enlaces y QR */}
        {enlaces && (
          <div className="mb-3 p-3" style={{ background: "#f8fafc", borderRadius: 12 }}>
            {esAdmin ? (
              <>
                {enlaces.clinica && <Compartir principal titulo={enlaces.clinica.nombre} url={enlaces.clinica.url} tipo="clinica" slug={enlaces.clinica.slug} />}
                {enlaces.medicos.length > 0 && (
                  <div className="mt-3">
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.gris, textTransform: "uppercase", letterSpacing: ".4px" }}>Enlace de cada médico</div>
                    {enlaces.medicos.map((m) => (
                      <Compartir key={m.id} titulo={`${m.nombres} ${m.apellidos}`} url={m.url} tipo="medico" slug={m.slug} />
                    ))}
                  </div>
                )}
              </>
            ) : yo ? (
              <Compartir principal titulo="Tu enlace personal" url={yo.url} tipo="medico" slug={yo.slug} />
            ) : null}
          </div>
        )}

        {!stats ? (
          <div className="text-muted small py-3"><span className="spinner-border spinner-border-sm me-2" />Cargando visitas…</div>
        ) : (
          <>
            <div className={`row ${isMobile ? "g-2" : "g-3"} mb-3`}>
              <Tile valor={t.vistas} label="Visitas" icon="bi-eye" color="#4f46e5" />
              <Tile valor={t.qr} label="Por QR" icon="bi-qr-code" color="#8b5cf6" />
              <Tile valor={t.whatsapp} label="Clics WhatsApp" icon="bi-whatsapp" color="#16a34a" />
              <Tile valor={t.citas} label="Citas agendadas" icon="bi-calendar-check" color="#0284c7"
                sub={conversion !== null ? `${conversion}% de las visitas` : null} />
            </div>

            <div className="row g-3">
              <div className="col-lg-8">
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.texto, marginBottom: 8 }}>Visitas por día</div>
                {t.vistas === 0 ? (
                  <div className="text-muted text-center" style={{ fontSize: 13, padding: "40px 0", background: "#f8fafc", borderRadius: 10 }}>
                    Aún no hay visitas en este periodo. ¡Comparte tu enlace o imprime tu QR!
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={serie} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ppArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 11, fill: C.gris }} axisLine={false} tickLine={false} minTickGap={18} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.gris }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v, "Visitas"]} labelFormatter={(l) => `Día ${l}`} />
                      <Area type="monotone" dataKey="vistas" stroke="#4f46e5" strokeWidth={2} fill="url(#ppArea)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="col-lg-4">
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.texto, marginBottom: 8 }}>¿De dónde llegan?</div>
                {stats.origenes.length === 0 ? (
                  <div className="text-muted" style={{ fontSize: 13 }}>Sin visitas todavía.</div>
                ) : stats.origenes.map((o) => {
                  const pct = Math.round((o.total / totalOrigen) * 100);
                  const info = ORIGEN[o.origen] || { label: o.origen, icon: "bi-globe2" };
                  return (
                    <div key={o.origen} className="mb-2">
                      <div className="d-flex justify-content-between" style={{ fontSize: 12.5, marginBottom: 3 }}>
                        <span style={{ color: "#334155", fontWeight: 600 }}><i className={`bi ${info.icon} me-1`} />{info.label}</span>
                        <span style={{ color: C.gris }}>{o.total} ({pct}%)</span>
                      </div>
                      <div style={{ background: "#f1f5f9", borderRadius: 6, height: 7 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#4f46e5", borderRadius: 6 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {esAdmin && stats.por_pagina.length > 0 && (
              <div className="table-responsive mt-3">
                <table className="table table-sm mb-0 align-middle" style={{ fontSize: 13 }}>
                  <thead><tr className="text-muted small"><th>Página</th><th className="text-center">Visitas</th><th className="text-center">WhatsApp</th><th className="text-center">Citas</th></tr></thead>
                  <tbody>
                    {stats.por_pagina.map((r) => (
                      <tr key={r.medico_id}>
                        <td className="fw-semibold">{r.medico_id ? r.nombre : "Página de la clínica"}</td>
                        <td className="text-center">{r.vistas}</td>
                        <td className="text-center">{r.whatsapp}</td>
                        <td className="text-center">{r.citas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
