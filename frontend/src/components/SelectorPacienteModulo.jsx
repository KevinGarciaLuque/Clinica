/**
 * Pantalla de inicio de un módulo que trabaja por paciente (Control de Seguimiento,
 * Educación en Diabetes…): buscar un paciente, citas de hoy y pacientes atendidos
 * recientemente en el módulo. Al elegir uno se abre el módulo con ese paciente.
 */
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import api from "../api/api";

const edad = (f) => (f ? dayjs().diff(dayjs(String(f).slice(0, 10)), "year") : null);
const iniciales = (p) => `${(p.nombres || "?")[0] || ""}${(p.apellidos || "")[0] || ""}`.toUpperCase();
const fechaCorta = (f) => (f ? dayjs(String(f).slice(0, 10)).format("D MMM YYYY") : "");

function Fila({ p, color, sub, onClick }) {
  return (
    <button type="button" onClick={onClick} className="spm-fila">
      <span className="spm-av" style={{ background: `${color}1a`, color }}>{iniciales(p)}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="spm-nom">{p.nombres} {p.apellidos}</span>
        <span className="spm-sub">{sub}</span>
      </span>
      <i className="bi bi-chevron-right" style={{ color: "#94a3b8" }} />
    </button>
  );
}

export default function SelectorPacienteModulo({ titulo, descripcion, icono, color, recientesUrl, etiquetaRecientes, conteo, onElegir, derivacionesUrl = null }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [recientes, setRecientes] = useState(null);
  const [citas, setCitas] = useState(null);
  const [derivados, setDerivados] = useState([]);

  useEffect(() => {
    api.get(recientesUrl).then((r) => setRecientes(r.data.data || [])).catch(() => setRecientes([]));
    const hoy = dayjs().format("YYYY-MM-DD");
    api.get("/citas", { params: { desde: hoy, hasta: hoy } })
      .then((r) => setCitas((r.data.data || []).filter((c) => !["CANCELADA", "NO_ASISTIO"].includes(c.estado) && c.paciente_id)))
      .catch(() => setCitas([]));
    if (derivacionesUrl) api.get(derivacionesUrl).then((r) => setDerivados(r.data.data || [])).catch(() => {});
  }, [recientesUrl, derivacionesUrl]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return undefined;
    let vivo = true;
    const id = setTimeout(() => {
      setBuscando(true);
      api.get("/pacientes", { params: { q: t } })
        .then((r) => { if (vivo) setResultados((r.data.data || []).slice(0, 8)); })
        .catch(() => {})
        .finally(() => { if (vivo) setBuscando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(id); };
  }, [q]);

  const datosPac = (p) => [p.dni, edad(p.fecha_nacimiento) != null ? `${edad(p.fecha_nacimiento)} años` : null].filter(Boolean).join(" · ");

  return (
    <div className="spm">
      <style>{`
        .spm { max-width: 980px; margin: 0 auto; padding: 8px 0 30px; }
        .spm-head { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
        .spm-ico { width:54px; height:54px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:1.6rem; flex-shrink:0; }
        .spm-buscar { position:relative; margin-bottom:18px; }
        .spm-buscar input { width:100%; border:1.5px solid #e2e8f0; border-radius:14px; padding:13px 14px 13px 44px; font-size:1rem; background:#fff; outline:none; }
        .spm-buscar input:focus { border-color: var(--spm-color); box-shadow: 0 0 0 3px var(--spm-sombra); }
        .spm-buscar > i { position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#94a3b8; font-size:1.05rem; }
        .spm-res { position:absolute; left:0; right:0; top:calc(100% + 6px); background:#fff; border:1px solid #e2e8f0; border-radius:14px; box-shadow:0 14px 34px rgba(15,23,42,.14); z-index:20; overflow:hidden; }
        .spm-dos { display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1.3fr); gap:14px; }
        .spm-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
        .spm-card-h { display:flex; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid #f1f5f9; font-weight:800; font-size:.85rem; color:#1e293b; }
        .spm-fila { display:flex; align-items:center; gap:10px; width:100%; text-align:left; background:#fff; border:none; border-bottom:1px solid #f1f5f9; padding:10px 14px; cursor:pointer; }
        .spm-fila:hover { background:#f8fafc; }
        .spm-av { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:.8rem; flex-shrink:0; }
        .spm-nom { display:block; font-weight:700; color:#1e293b; font-size:.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .spm-sub { display:block; color:#64748b; font-size:.76rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .spm-vacio { padding:18px 14px; color:#94a3b8; font-size:.85rem; text-align:center; }
        @media (max-width: 767px) { .spm-dos { grid-template-columns: minmax(0,1fr); } }
      `}</style>

      <div className="spm-head">
        <div className="spm-ico" style={{ background: `${color}1a`, color }}><i className={`bi ${icono}`} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1e293b" }}>{titulo}</div>
          <div style={{ fontSize: "0.86rem", color: "#64748b" }}>{descripcion}</div>
        </div>
      </div>

      <div className="spm-buscar" style={{ "--spm-color": color, "--spm-sombra": `${color}26` }}>
        <i className="bi bi-search" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente por nombre, identidad o teléfono…" autoFocus />
        {q.trim().length >= 2 && (
          <div className="spm-res">
            {buscando && !resultados.length ? <div className="spm-vacio"><span className="spinner-border spinner-border-sm me-2" />Buscando…</div>
              : resultados.length === 0 ? <div className="spm-vacio">No se encontraron pacientes.</div>
                : resultados.map((p) => <Fila key={p.id} p={p} color={color} sub={datosPac(p) || "Paciente"} onClick={() => onElegir(p)} />)}
          </div>
        )}
      </div>

      {derivados.length > 0 && (
        <div className="spm-card" style={{ marginBottom: 14, borderColor: `${color}55` }}>
          <div className="spm-card-h" style={{ background: `${color}0f` }}>
            <i className="bi bi-send-check" style={{ color }} />Enviados por el médico
            <span style={{ marginLeft: "auto", background: color, color: "#fff", borderRadius: 999, padding: "0 8px", fontSize: ".72rem" }}>{derivados.length}</span>
          </div>
          {derivados.map((x) => (
            <Fila key={x.id} color={color}
              p={{ id: x.paciente_id, nombres: x.nombres, apellidos: x.apellidos }}
              sub={[x.temas_texto?.length ? x.temas_texto.join(", ") : null, x.nota, `${String(x.medico || "").trim() || "médico"} · ${fechaCorta(x.creado_en)}`].filter(Boolean).join(" · ")}
              onClick={() => onElegir({ id: x.paciente_id, nombres: x.nombres, apellidos: x.apellidos })} />
          ))}
        </div>
      )}

      <div className="spm-dos">
        <div className="spm-card">
          <div className="spm-card-h"><i className="bi bi-calendar-check" style={{ color }} />Citas de hoy</div>
          {citas === null ? <div className="spm-vacio"><span className="spinner-border spinner-border-sm" /></div>
            : citas.length === 0 ? <div className="spm-vacio">No hay citas para hoy.</div>
              : citas.map((c) => (
                <Fila key={c.id} color={color}
                  p={{ id: c.paciente_id, nombres: c.paciente_nombres || c.nombres || "", apellidos: c.paciente_apellidos || c.apellidos || "" }}
                  sub={`${dayjs(c.inicio).format("h:mm A")} · ${String(c.estado || "").replace(/_/g, " ").toLowerCase()}`}
                  onClick={() => onElegir({ id: c.paciente_id, nombres: c.paciente_nombres, apellidos: c.paciente_apellidos })} />
              ))}
        </div>
        <div className="spm-card">
          <div className="spm-card-h"><i className="bi bi-clock-history" style={{ color }} />{etiquetaRecientes}</div>
          {recientes === null ? <div className="spm-vacio"><span className="spinner-border spinner-border-sm" /></div>
            : recientes.length === 0 ? <div className="spm-vacio">Todavía no hay pacientes atendidos en este módulo. Busque uno arriba para empezar.</div>
              : recientes.map((p) => (
                <Fila key={p.id} p={p} color={color}
                  sub={[datosPac(p), p.ultima ? `último: ${fechaCorta(p.ultima)}` : null, conteo ? conteo(p) : null].filter(Boolean).join(" · ")}
                  onClick={() => onElegir(p)} />
              ))}
        </div>
      </div>
    </div>
  );
}
