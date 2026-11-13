/**
 * Página pública «Mi estética»: el paciente llega desde el enlace que le envió
 * la clínica (correo o WhatsApp), sin iniciar sesión.
 *   - firma:        lee el consentimiento y lo firma con el dedo.
 *   - indicaciones: sus cuidados para la casa, controles y mantenimiento.
 * URL: /mi-estetica/:token
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import FirmaPad from "../components/FirmaPad";

const RAIZ = import.meta.env.VITE_API_URL || "http://localhost:5000";
const BASE = `${RAIZ}/api`;
const ROSA = "#db2777";

const fechaLarga = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "");
const hora12 = (h) => {
  if (!h) return "";
  const [H, M] = String(h).split(":").map(Number);
  return `${((H + 11) % 12) + 1}:${String(M || 0).padStart(2, "0")} ${H < 12 ? "a. m." : "p. m."}`;
};
const logoUrl = (u) => (!u ? null : /^(https?:|data:)/.test(u) ? u : `${RAIZ}${u.startsWith("/") ? "" : "/"}${u}`);
const soloDigitos = (t) => String(t || "").replace(/\D/g, "");

export default function MiEstetica() {
  const { token } = useParams();
  const [estado, setEstado] = useState({ cargando: true });

  const cargar = useCallback(() => {
    axios.get(`${BASE}/estetica-publico/${token}`)
      .then((r) => setEstado({ data: r.data.data }))
      .catch((e) => setEstado({ error: e.response?.data?.msg || "No se pudo abrir el enlace." }));
  }, [token]);
  useEffect(() => { cargar(); }, [cargar]);

  const d = estado.data;
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #fdf2f8 0%, #f8fafc 280px)", padding: "18px 14px 40px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Clínica */}
        {d && (
          <div className="d-flex align-items-center gap-3 mb-3">
            {logoUrl(d.clinica.logo_url) && <img src={logoUrl(d.clinica.logo_url)} alt="" style={{ height: 48, maxWidth: 120, objectFit: "contain" }} />}
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#111827" }}>{d.clinica.nombre}</div>
              {d.clinica.telefono && <div className="text-muted" style={{ fontSize: "0.82rem" }}>{d.clinica.telefono}</div>}
            </div>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 18, boxShadow: "0 10px 30px rgba(190,24,93,.08)", padding: "22px 18px" }}>
          {estado.cargando && <div className="text-center py-5"><span className="spinner-border" style={{ color: ROSA }} /></div>}
          {estado.error && (
            <div className="text-center py-4">
              <i className="bi bi-link-45deg" style={{ fontSize: "2.6rem", color: "#f9a8d4" }} />
              <h5 className="mt-2" style={{ fontWeight: 800 }}>No se pudo abrir</h5>
              <p className="text-muted mb-0">{estado.error}</p>
            </div>
          )}
          {d?.tipo === "firma" && <Firma d={d} token={token} onListo={cargar} />}
          {d?.tipo === "indicaciones" && <Indicaciones d={d} />}
        </div>
        <div className="text-center text-muted mt-3" style={{ fontSize: "0.75rem" }}>Enlace personal enviado por su clínica · Medic-KG</div>
      </div>
    </div>
  );
}

function Firma({ d, token, onListo }) {
  const [leido, setLeido] = useState(false);
  const [nombre, setNombre] = useState(d.paciente_completo || "");
  const [relacion, setRelacion] = useState("Paciente");
  const [firma, setFirma] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [gracias, setGracias] = useState(false);
  const alCambiar = useCallback((v) => setFirma(v), []);

  if (gracias || d.firmado) {
    return (
      <div className="text-center py-4">
        <i className="bi bi-check-circle-fill" style={{ fontSize: "3rem", color: "#16a34a" }} />
        <h4 className="mt-2" style={{ fontWeight: 800 }}>{gracias ? `¡Gracias, ${d.paciente}!` : "Ya está firmado"}</h4>
        <p className="text-muted mb-0">
          {gracias ? "Su consentimiento quedó firmado. La clínica ya fue avisada." : `Este consentimiento se firmó${d.firmado_en ? ` el ${fechaLarga(d.firmado_en)}` : ""}.`}
        </p>
      </div>
    );
  }

  const enviar = async () => {
    setEnviando(true); setError("");
    try {
      await axios.post(`${BASE}/estetica-publico/${token}/firmar`, { firma, nombre, relacion, leido });
      setGracias(true);
      onListo?.();
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo guardar la firma. Intente de nuevo.");
    }
    setEnviando(false);
  };

  const inp = { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: "1rem" };
  return (
    <div>
      <div style={{ color: ROSA, fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".05em", textTransform: "uppercase" }}>Consentimiento informado</div>
      <h4 style={{ fontWeight: 800, margin: "4px 0 12px" }}>{d.procedimiento}</h4>
      <p className="text-muted" style={{ fontSize: "0.92rem" }}>Hola {d.paciente}, lea con calma este documento. Si tiene dudas, consulte a la clínica antes de firmar.</p>
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, fontSize: "0.95rem", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 340, overflowY: "auto" }}>
        {d.contenido}
        {d.riesgos?.length > 0 && (
          <div className="mt-3">
            <strong>Riesgos que se me explicaron:</strong>
            <ul className="mb-0 mt-1">{d.riesgos.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
      </div>
      <label className="d-flex align-items-start gap-2 my-3" style={{ fontSize: "0.95rem", cursor: "pointer" }}>
        <input type="checkbox" className="form-check-input mt-1" style={{ width: 20, height: 20, flexShrink: 0 }} checked={leido} onChange={(e) => setLeido(e.target.checked)} />
        <span>Leí este documento, entiendo el procedimiento y sus riesgos, y pude hacer preguntas.</span>
      </label>
      <div className="mb-2">
        <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Nombre de quien firma</label>
        <input style={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" />
      </div>
      <div className="mb-3">
        <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Firma como</label>
        <select style={inp} value={relacion} onChange={(e) => setRelacion(e.target.value)}>
          <option>Paciente</option><option>Padre, madre o tutor</option><option>Representante legal</option>
        </select>
      </div>
      <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>Su firma</label>
      <FirmaPad onChange={alCambiar} alto={190} />
      {error && <div className="alert alert-danger py-2 mt-2 mb-0" style={{ fontSize: "0.9rem" }}>{error}</div>}
      <button type="button" className="btn w-100 mt-3" disabled={enviando || !leido || !firma || !nombre.trim()} onClick={enviar}
        style={{ background: ROSA, color: "#fff", fontWeight: 800, padding: "12px", borderRadius: 12, fontSize: "1.02rem" }}>
        {enviando ? "Guardando…" : "Firmar consentimiento"}
      </button>
      {(!leido || !firma) && (
        <div className="text-center text-muted mt-2" style={{ fontSize: "0.8rem" }}>
          {!leido ? "Marque la casilla de lectura" : "Falta su firma"} para continuar.
        </div>
      )}
    </div>
  );
}

function Indicaciones({ d }) {
  const lineas = String(d.indicaciones || "").split(/\n+/).map((t) => t.trim().replace(/^[-•*]\s*/, "")).filter(Boolean);
  const tel = soloDigitos(d.clinica.telefono);
  return (
    <div>
      <div style={{ color: ROSA, fontWeight: 800, fontSize: "0.78rem", letterSpacing: ".05em", textTransform: "uppercase" }}>Sus indicaciones</div>
      <h4 style={{ fontWeight: 800, margin: "4px 0 4px" }}>{d.procedimiento}</h4>
      <div className="text-muted mb-3" style={{ fontSize: "0.88rem" }}>
        {d.fecha ? fechaLarga(d.fecha) : ""}{d.medico ? ` · ${d.medico}` : ""}
      </div>

      {lineas.length > 0 && (
        <div className="mb-3">
          <div style={{ fontWeight: 800, marginBottom: 8 }}><i className="bi bi-clipboard2-heart me-2" style={{ color: ROSA }} />Cuidados en casa</div>
          {lineas.map((l, i) => (
            <div key={i} className="d-flex gap-2 mb-2" style={{ background: "#fdf2f8", borderRadius: 10, padding: "9px 12px", fontSize: "0.95rem" }}>
              <i className="bi bi-check2-circle" style={{ color: ROSA, marginTop: 2 }} /><span>{l}</span>
            </div>
          ))}
        </div>
      )}

      {d.controles?.length > 0 && (
        <div className="mb-3">
          <div style={{ fontWeight: 800, marginBottom: 8 }}><i className="bi bi-calendar-check me-2" style={{ color: "#7c3aed" }} />Sus controles</div>
          {d.controles.map((c) => (
            <div key={`${c.label}-${c.fecha}`} className="d-flex justify-content-between flex-wrap gap-1 mb-2" style={{ background: "#f5f3ff", borderRadius: 10, padding: "9px 12px", fontSize: "0.95rem" }}>
              <strong>{c.label}</strong><span style={{ textTransform: "capitalize" }}>{fechaLarga(c.fecha)}{c.hora ? `, ${hora12(c.hora)}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {d.mantenimiento_fecha && (
        <div className="mb-3" style={{ background: "#f0f9ff", borderRadius: 10, padding: "10px 12px", fontSize: "0.92rem" }}>
          <i className="bi bi-arrow-repeat me-2" style={{ color: "#0369a1" }} />
          Su próximo mantenimiento sería alrededor del <strong>{fechaLarga(d.mantenimiento_fecha)}</strong>. Le avisaremos unos días antes.
        </div>
      )}

      <div style={{ background: "#fef2f2", borderRadius: 10, padding: "10px 12px", fontSize: "0.88rem", color: "#7f1d1d" }}>
        <i className="bi bi-exclamation-triangle me-2" />
        Si tiene dolor fuerte, mucha inflamación, cambio de color de la piel, fiebre o algo le preocupa, comuníquese con la clínica de inmediato.
      </div>

      {tel && (
        <div className="d-flex gap-2 mt-3 flex-wrap">
          <a className="btn flex-fill" href={`tel:${tel}`} style={{ border: `1px solid ${ROSA}`, color: ROSA, fontWeight: 700, borderRadius: 12 }}>
            <i className="bi bi-telephone me-1" />Llamar
          </a>
          <a className="btn flex-fill" href={`https://wa.me/${tel.length === 8 ? `504${tel}` : tel}`} target="_blank" rel="noreferrer"
            style={{ background: "#16a34a", color: "#fff", fontWeight: 700, borderRadius: 12 }}>
            <i className="bi bi-whatsapp me-1" />Escribir por WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
