/**
 * Portal del paciente — /portal
 * Sin sesión: formulario para pedir el enlace de entrada por correo.
 * Con sesión: citas (confirmar/cancelar), recetas, estudios y datos personales.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { portalApi, leerSesion, cerrarSesion, fechaHora } from "./portalApi";

const C = { verde: "#10b981", oscuro: "#0f172a", gris: "#64748b", borde: "#e2e8f0" };

const ESTADOS = {
  PENDIENTE:            { label: "Por confirmar",        color: "#f59e0b" },
  PENDIENTE_APROBACION: { label: "Solicitud en revisión", color: "#f59e0b" },
  CONFIRMADA:           { label: "Confirmada",           color: "#10b981" },
  EN_ESPERA:            { label: "En sala de espera",    color: "#3b82f6" },
  EN_ATENCION:          { label: "En atención",          color: "#3b82f6" },
  COMPLETADA:           { label: "Atendida",             color: "#64748b" },
  CANCELADA:            { label: "Cancelada",            color: "#ef4444" },
  NO_ASISTIO:           { label: "No asistió",           color: "#94a3b8" },
  SOLICITADO:           { label: "Pendiente",            color: "#f59e0b" },
  EN_PROCESO:           { label: "En proceso",           color: "#3b82f6" },
  COMPLETADO:           { label: "Completado",           color: "#10b981" },
  CANCELADO:            { label: "Cancelado",            color: "#94a3b8" },
};

const CSS = `
  .pp-wrap { min-height: 100vh; background: linear-gradient(180deg,#ecfdf5 0,#f8fafc 260px); }
  .pp-main { max-width: 760px; margin: 0 auto; padding: 20px 16px 48px; }
  .pp-card { background: #fff; border: 1px solid ${C.borde}; border-radius: 14px; padding: 16px; margin-bottom: 12px; }
  .pp-tabs { display: flex; gap: 6px; overflow-x: auto; margin: 18px 0 14px; padding-bottom: 2px; }
  .pp-tab { flex: 0 0 auto; border: 1px solid ${C.borde}; background: #fff; color: ${C.gris}; font-weight: 600; font-size: 14px;
    border-radius: 999px; padding: 8px 14px; cursor: pointer; }
  .pp-tab.on { background: ${C.verde}; border-color: ${C.verde}; color: #fff; }
  .pp-chip { display: inline-block; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 10px; }
  .pp-btn { display: inline-flex; align-items: center; gap: 6px; background: ${C.verde}; color: #fff; border: none;
    border-radius: 10px; padding: 9px 16px; font-weight: 600; font-size: 14px; text-decoration: none; }
  .pp-btn:hover { color: #fff; filter: brightness(.95); }
  .pp-btn.sec { background: #fff; color: ${C.oscuro}; border: 1px solid ${C.borde}; }
  .pp-vacio { text-align: center; color: ${C.gris}; padding: 28px 12px; font-size: 14px; }
`;

function Chip({ estado }) {
  const e = ESTADOS[estado] || { label: estado, color: C.gris };
  return <span className="pp-chip" style={{ background: `${e.color}1a`, color: e.color }}>{e.label}</span>;
}

// ─── Entrada por correo ──────────────────────────────────────────────────────
function Acceso() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState("form"); // form | enviando | enviado
  const [error, setError] = useState("");

  const enviar = async (e) => {
    e.preventDefault();
    setError(""); setEstado("enviando");
    try {
      await portalApi.pedirAcceso(email);
      setEstado("enviado");
    } catch (err) {
      setError(err?.response?.data?.msg || "No se pudo enviar el enlace. Intenta de nuevo.");
      setEstado("form");
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: "linear-gradient(135deg,#ecfdf5,#eff6ff)", padding: "2rem 1rem" }}>
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5" style={{ maxWidth: 440, width: "100%" }}>
        <div className="text-center mb-3">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#d1fae5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-person-heart" style={{ fontSize: 28, color: C.verde }} />
          </div>
          <h4 className="fw-bold mt-3 mb-1" style={{ color: C.oscuro }}>Portal del paciente</h4>
          <p className="text-muted mb-0" style={{ fontSize: "0.92rem" }}>Tus citas, recetas y estudios en un solo lugar.</p>
        </div>

        {estado === "enviado" ? (
          <div className="text-center">
            <i className="bi bi-envelope-check" style={{ fontSize: 40, color: C.verde }} />
            <p className="mt-2 mb-1 fw-semibold">Revisa tu correo</p>
            <p className="text-muted" style={{ fontSize: "0.88rem" }}>
              Si <strong>{email}</strong> está registrado en una clínica, te llegará un enlace para entrar.
              Vence en 15 minutos. Revisa también la carpeta de spam.
            </p>
            <button className="btn btn-link btn-sm" onClick={() => setEstado("form")}>Usar otro correo</button>
          </div>
        ) : (
          <form onSubmit={enviar}>
            <label className="form-label fw-semibold" style={{ fontSize: "0.88rem" }}>Correo que diste en tu clínica</label>
            <input type="email" required className="form-control mb-3" placeholder="tucorreo@ejemplo.com" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} style={{ borderRadius: 10, padding: "10px 12px" }} />
            {error && <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>{error}</div>}
            <button type="submit" className="btn w-100 fw-semibold" disabled={estado === "enviando"}
              style={{ background: C.verde, color: "#fff", borderRadius: 10, padding: 11 }}>
              {estado === "enviando" ? <span className="spinner-border spinner-border-sm" /> : "Enviarme el enlace"}
            </button>
            <p className="text-muted text-center mt-3 mb-0" style={{ fontSize: "0.8rem" }}>
              Sin contraseñas: te enviamos un enlace seguro cada vez que quieras entrar.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Secciones ───────────────────────────────────────────────────────────────
function Cita({ c }) {
  const { fecha, hora } = fechaHora(c.inicio);
  return (
    <div className="pp-card">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div className="fw-bold" style={{ color: C.oscuro }}>{fecha} · {hora}</div>
          <div style={{ fontSize: 14, color: C.gris }}>{c.medico} · {c.clinica}</div>
          {c.motivo && <div style={{ fontSize: 13, color: C.gris, marginTop: 2 }}>{c.motivo}</div>}
        </div>
        <Chip estado={c.estado} />
      </div>
      {c.enlace && (
        <div className="mt-2">
          <Link to={`/mi-cita/${c.enlace}`} className="pp-btn" style={{ padding: "7px 14px", fontSize: 13 }}>
            {c.estado === "PENDIENTE" ? <><i className="bi bi-check2-circle" />Confirmar o cancelar</> : <><i className="bi bi-calendar2-x" />Cancelar cita</>}
          </Link>
        </div>
      )}
    </div>
  );
}

function Citas({ perfiles }) {
  const [data, setData] = useState(null);
  const [verAnteriores, setVerAnteriores] = useState(false);
  useEffect(() => { portalApi.get("/citas").then((r) => setData(r.data.data)).catch(() => setData({ error: true })); }, []);
  if (!data) return <div className="pp-vacio"><span className="spinner-border spinner-border-sm" /></div>;
  if (data.error) return <div className="pp-vacio">No se pudieron cargar tus citas.</div>;

  const clinicas = perfiles.filter((p, i, a) => p.clinica_slug && a.findIndex((x) => x.clinica_slug === p.clinica_slug) === i);
  return (
    <>
      {clinicas.map((p) => (
        <Link key={p.clinica_slug} to={`/p/${p.clinica_slug}`} className="pp-btn mb-3 me-2">
          <i className="bi bi-calendar-plus" />Agendar en {clinicas.length > 1 ? p.clinica : "mi clínica"}
        </Link>
      ))}
      <h6 className="fw-bold mt-1" style={{ color: C.oscuro }}>Próximas</h6>
      {data.proximas.length ? data.proximas.map((c) => <Cita key={c.id} c={c} />)
        : <div className="pp-card pp-vacio">No tienes citas próximas.</div>}
      {data.anteriores.length > 0 && (
        <>
          <button className="btn btn-link px-0 fw-semibold" style={{ color: C.gris, textDecoration: "none" }} onClick={() => setVerAnteriores((v) => !v)}>
            <i className={`bi bi-chevron-${verAnteriores ? "up" : "down"} me-1`} />Citas anteriores ({data.anteriores.length})
          </button>
          {verAnteriores && data.anteriores.map((c) => <Cita key={c.id} c={c} />)}
        </>
      )}
    </>
  );
}

function Recetas() {
  const [data, setData] = useState(null);
  useEffect(() => { portalApi.get("/recetas").then((r) => setData(r.data.data)).catch(() => setData("error")); }, []);
  if (!data) return <div className="pp-vacio"><span className="spinner-border spinner-border-sm" /></div>;
  if (data === "error") return <div className="pp-vacio">No se pudieron cargar tus recetas.</div>;
  if (!data.length) return <div className="pp-card pp-vacio">Aún no tienes recetas.</div>;
  return data.map((r) => (
    <div key={r.id} className="pp-card">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div className="fw-bold" style={{ color: C.oscuro }}>{fechaHora(r.fecha).fecha}</div>
          <div style={{ fontSize: 14, color: C.gris }}>{r.medico} · {r.clinica}</div>
        </div>
        {r.codigo_qr && (
          <Link to={`/rx/${r.codigo_qr}`} className="pp-btn sec" style={{ padding: "6px 12px", fontSize: 13 }}>
            <i className="bi bi-qr-code" />Ver receta
          </Link>
        )}
      </div>
      {r.items?.length > 0 && (
        <ul className="mb-0 mt-2 ps-3" style={{ fontSize: 14 }}>
          {r.items.map((i, k) => (
            <li key={k}>
              <strong>{i.medicamento}</strong>
              {[i.dosis, i.duracion].filter(Boolean).length ? ` — ${[i.dosis, i.duracion].filter(Boolean).join(", ")}` : ""}
              {i.instrucciones && <div style={{ color: C.gris, fontSize: 13 }}>{i.instrucciones}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  ));
}

function Estudios() {
  const [data, setData] = useState(null);
  useEffect(() => { portalApi.get("/estudios").then((r) => setData(r.data.data)).catch(() => setData("error")); }, []);
  if (!data) return <div className="pp-vacio"><span className="spinner-border spinner-border-sm" /></div>;
  if (data === "error") return <div className="pp-vacio">No se pudieron cargar tus estudios.</div>;
  if (!data.length) return <div className="pp-card pp-vacio">No tienes estudios solicitados.</div>;
  return (
    <>
      <p style={{ fontSize: 13, color: C.gris }}>Los resultados te los explicará tu médico en tu próxima consulta.</p>
      {data.map((e) => (
        <div key={e.id} className="pp-card">
          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
            <div>
              <div className="fw-bold" style={{ color: C.oscuro }}>
                {e.descripcion || e.tipo}
                {e.urgente ? <span className="pp-chip ms-2" style={{ background: "#fee2e2", color: "#dc2626" }}>Urgente</span> : null}
              </div>
              <div style={{ fontSize: 14, color: C.gris }}>{fechaHora(e.fecha).fecha} · {e.medico} · {e.clinica}</div>
            </div>
            <Chip estado={e.estado} />
          </div>
        </div>
      ))}
    </>
  );
}

function MisDatos({ yo }) {
  return (
    <>
      {yo.perfiles.map((p) => (
        <div key={p.id} className="pp-card" style={{ fontSize: 14 }}>
          <div className="fw-bold mb-2" style={{ color: C.oscuro }}><i className="bi bi-hospital me-2" style={{ color: C.verde }} />{p.clinica}</div>
          <div><span style={{ color: C.gris }}>Nombre:</span> {p.nombres} {p.apellidos}</div>
          {p.dni && <div><span style={{ color: C.gris }}>Identidad:</span> {p.dni}</div>}
          {p.fecha_nacimiento && <div><span style={{ color: C.gris }}>Nacimiento:</span> {fechaHora(p.fecha_nacimiento).fecha}</div>}
          {p.telefono && <div><span style={{ color: C.gris }}>Teléfono:</span> {p.telefono}</div>}
          <div><span style={{ color: C.gris }}>Correo:</span> {yo.email}</div>
          {p.clinica_telefono && (
            <div className="mt-2" style={{ fontSize: 13, color: C.gris }}>
              ¿Algún dato está mal? Llama a la clínica: <a href={`tel:${p.clinica_telefono}`}>{p.clinica_telefono}</a>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

const TABS = [
  { id: "citas", label: "Citas", icon: "bi-calendar-event" },
  { id: "recetas", label: "Recetas", icon: "bi-capsule" },
  { id: "estudios", label: "Estudios", icon: "bi-clipboard2-pulse" },
  { id: "datos", label: "Mis datos", icon: "bi-person" },
];

function Panel({ onSalir }) {
  const [yo, setYo] = useState(null);
  const [tab, setTab] = useState("citas");

  useEffect(() => {
    portalApi.get("/yo").then((r) => setYo(r.data.data)).catch(() => onSalir());
  }, [onSalir]);

  if (!yo) return <div className="pp-wrap"><style>{CSS}</style><div className="pp-vacio pt-5"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div></div>;
  const p0 = yo.perfiles[0];

  return (
    <div className="pp-wrap">
      <style>{CSS}</style>
      <div className="pp-main">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
            {p0.logo_url && yo.perfiles.length === 1
              ? <img src={p0.logo_url} alt="" style={{ height: 40, maxWidth: 110, objectFit: "contain" }} />
              : <i className="bi bi-person-heart" style={{ fontSize: 28, color: C.verde }} />}
            <div style={{ minWidth: 0 }}>
              <div className="fw-bold text-truncate" style={{ color: C.oscuro, fontSize: 18 }}>Hola, {p0.nombres.split(" ")[0]}</div>
              <div className="text-truncate" style={{ fontSize: 13, color: C.gris }}>{yo.perfiles.map((p) => p.clinica).join(" · ")}</div>
            </div>
          </div>
          <button className="pp-btn sec" style={{ padding: "6px 12px", fontSize: 13 }} onClick={onSalir}>
            <i className="bi bi-box-arrow-right" />Salir
          </button>
        </div>

        <div className="pp-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`pp-tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
              <i className={`bi ${t.icon} me-1`} />{t.label}
            </button>
          ))}
        </div>

        {tab === "citas" && <Citas perfiles={yo.perfiles} />}
        {tab === "recetas" && <Recetas />}
        {tab === "estudios" && <Estudios />}
        {tab === "datos" && <MisDatos yo={yo} />}
      </div>
    </div>
  );
}

export default function PortalPaciente() {
  const [sesion, setSesion] = useState(() => leerSesion());
  const salir = useCallback(() => { cerrarSesion(); setSesion(null); }, []);
  return sesion ? <Panel onSalir={salir} /> : <Acceso />;
}
