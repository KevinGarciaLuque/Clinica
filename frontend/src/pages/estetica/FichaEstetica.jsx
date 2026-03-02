import { useEffect, useState } from "react";
import api from "../../api/api";

const C = {
  bg: "#0d1b2e", surface: "#112240", card: "#162a45",
  border: "rgba(255,255,255,0.07)", accent: "#e91e8c",
  accentD: "#c2185b", text: "#e2e8f0", muted: "#94a3b8", inputBg: "#0d1b2e",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
};

const FOTOTIPOS = [
  { id: "I",   desc: "Siempre se quema, nunca broncea (piel muy clara)",  color: "#fde8d8" },
  { id: "II",  desc: "Siempre se quema, a veces broncea (piel clara)",    color: "#f9c784" },
  { id: "III", desc: "A veces se quema, siempre broncea (piel intermedia)", color: "#d9955e" },
  { id: "IV",  desc: "Nunca se quema, siempre broncea (piel morena)",     color: "#a0623a" },
  { id: "V",   desc: "Piel morena oscura",                               color: "#6b3a1f" },
  { id: "VI",  desc: "Piel negra",                                       color: "#3a1a0a" },
];

const PROCEDIMIENTOS_PREV = [
  "Rinoplastia", "Mamoplastia", "Liposucción", "Abdominoplastia",
  "Bichectomía", "Blefaroplastia", "Lifting facial", "Botox / Toxina botulínica",
  "Rellenos dérmicos", "Blanqueamiento", "Peeling químico",
];

function initFicha() {
  return {
    fototipo: "", piel_tipo: "Normal", cicatrizacion: "Normal",
    alergias_anestesia: "", alergias_medicamentos: "", alergias_latex: false,
    fumador: false, alcoholismo: "Ninguno",
    procedimientos_previos: [], num_cirugias_previas: "0",
    motivacion: "", zonas_interes: [], expectativas: "",
    contraindicaciones: "", notas_medico: "",
  };
}

const ZONAS = [
  "Nariz", "Mentón", "Pómulos", "Papada / Cuello", "Párpados",
  "Frente", "Labios", "Orejas", "Senos", "Abdomen",
  "Cintura / Flancos", "Caderas", "Brazos", "Muslos", "Glúteos",
];

export default function FichaEstetica() {
  const [pacientes,   setPacientes]  = useState([]);
  const [pacId,       setPacId]      = useState("");
  const [ficha,       setFicha]      = useState(null);
  const [editando,    setEditando]   = useState(false);
  const [formFicha,   setFormFicha]  = useState(initFicha());
  const [guardado,    setGuardado]   = useState(false);

  useEffect(() => {
    api.get("/pacientes").then(r => setPacientes(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pacId) { setFicha(null); setEditando(false); return; }
    const saved = JSON.parse(localStorage.getItem(`ficha_estetica_${pacId}`) || "null");
    if (saved) { setFicha(saved); setEditando(false); }
    else       { setFicha(null);  setEditando(true); setFormFicha(initFicha()); }
  }, [pacId]);

  const abrir = () => {
    setFormFicha(ficha ? { ...ficha } : initFicha());
    setEditando(true);
  };

  const guardar = (e) => {
    e.preventDefault();
    const nuevaFicha = { ...formFicha, pac_id: pacId, actualizado_en: new Date().toISOString() };
    localStorage.setItem(`ficha_estetica_${pacId}`, JSON.stringify(nuevaFicha));
    setFicha(nuevaFicha);
    setEditando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  const toggleProc = (p) => setFormFicha(f => ({
    ...f, procedimientos_previos: f.procedimientos_previos.includes(p)
      ? f.procedimientos_previos.filter(x => x !== p)
      : [...f.procedimientos_previos, p],
  }));

  const toggleZona = (z) => setFormFicha(f => ({
    ...f, zonas_interes: f.zonas_interes.includes(z)
      ? f.zonas_interes.filter(x => x !== z)
      : [...f.zonas_interes, z],
  }));

  const pacSeleccionado = pacientes.find(p => String(p.id) === String(pacId));

  return (
    <div style={{ color: C.text, minHeight: "100vh" }}>
      {/* Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, #2d0a1f 100%)`,
        borderRadius: 16, padding: "24px 28px", marginBottom: 24,
        border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-vcard-fill" style={{ fontSize: 22, color: "#fff" }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 22, color: C.text }}>Ficha Estética del Paciente</h4>
            <span style={{ color: C.muted, fontSize: 13 }}>
              Fototipo, procedimientos previos, zonas de interés y expectativas
            </span>
          </div>
        </div>
        {ficha && !editando && (
          <button onClick={abrir}
            style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
              border: "none", borderRadius: 10, padding: "10px 20px",
              color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}>
            <i className="bi bi-pencil-square" /> Editar ficha
          </button>
        )}
      </div>

      {/* Selector paciente */}
      <div style={{ maxWidth: 380, marginBottom: 24 }}>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                         letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Paciente</label>
        <select style={inputSt} value={pacId} onChange={e => setPacId(e.target.value)}>
          <option value="">— Seleccionar paciente —</option>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>)}
        </select>
      </div>

      {/* Toast guardado */}
      {guardado && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "rgba(16,185,129,.9)", borderRadius: 12, padding: "12px 20px",
          color: "#fff", fontWeight: 600, fontSize: 14,
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,.3)",
        }}>
          <i className="bi bi-check-circle-fill" /> Ficha estética guardada correctamente
        </div>
      )}

      {!pacId ? (
        <div style={{ textAlign: "center", padding: "72px 0" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto 18px",
            background: "rgba(233,30,140,.07)", border: "1px solid rgba(233,30,140,.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-person-circle" style={{ fontSize: 30, color: C.accent }} />
          </div>
          <p style={{ color: C.muted, fontSize: 15, fontWeight: 600, margin: 0 }}>Selecciona un paciente</p>
        </div>
      ) : ficha && !editando ? (
        /* Vista de ficha guardada */
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Datos básicos */}
          <SeccionCard titulo="Piel y tipo de paciente" icono="bi-person-fill">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
              <ItemFicha label="Fototipo Fitzpatrick" value={ficha.fototipo ? `Tipo ${ficha.fototipo}` : "—"} />
              <ItemFicha label="Tipo de piel" value={ficha.piel_tipo} />
              <ItemFicha label="Cicatrización" value={ficha.cicatrizacion} />
              <ItemFicha label="Fumador/a" value={ficha.fumador ? "Sí" : "No"} />
              <ItemFicha label="Consumo alcohol" value={ficha.alcoholismo} />
              <ItemFicha label="Alergia al látex" value={ficha.alergias_latex ? "Sí" : "No"} />
            </div>
          </SeccionCard>
          <SeccionCard titulo="Procedimientos previos" icono="bi-scissors">
            {ficha.procedimientos_previos?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ficha.procedimientos_previos.map(p => (
                  <span key={p} style={{
                    background: `${C.accent}15`, border: `1px solid ${C.accent}30`,
                    borderRadius: 8, padding: "4px 12px", fontSize: 13,
                    color: C.text, fontWeight: 500,
                  }}>{p}</span>
                ))}
              </div>
            ) : <span style={{ color: C.muted, fontSize: 13 }}>Ninguno</span>}
          </SeccionCard>
          <SeccionCard titulo="Zonas de interés" icono="bi-geo-alt-fill">
            {ficha.zonas_interes?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ficha.zonas_interes.map(z => (
                  <span key={z} style={{
                    background: "rgba(255,255,255,.05)", border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "4px 12px", fontSize: 13, color: C.text,
                  }}>{z}</span>
                ))}
              </div>
            ) : <span style={{ color: C.muted, fontSize: 13 }}>No especificadas</span>}
          </SeccionCard>
          {(ficha.motivacion || ficha.expectativas) && (
            <SeccionCard titulo="Motivaciones y expectativas" icono="bi-star-fill">
              {ficha.motivacion && <ItemFicha label="Motivación del paciente" value={ficha.motivacion} />}
              {ficha.expectativas && <ItemFicha label="Expectativas" value={ficha.expectativas} />}
            </SeccionCard>
          )}
          {ficha.notas_medico && (
            <SeccionCard titulo="Notas del médico" icono="bi-journal-medical">
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{ficha.notas_medico}</div>
            </SeccionCard>
          )}
        </div>
      ) : editando ? (
        /* Formulario edición */
        <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Sección 1: Piel */}
          <SeccionCard titulo="Características de la piel" icono="bi-person-fill">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
              <div>
                <Lbl>Tipo de piel</Lbl>
                <select style={inputSt} value={formFicha.piel_tipo}
                  onChange={e => setFormFicha(f => ({ ...f, piel_tipo: e.target.value }))}>
                  {["Normal","Seca","Grasa","Mixta","Sensible"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Cicatrización habitual</Lbl>
                <select style={inputSt} value={formFicha.cicatrizacion}
                  onChange={e => setFormFicha(f => ({ ...f, cicatrizacion: e.target.value }))}>
                  {["Normal","Queloide","Hipertrófica","Atrófica"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <Lbl>Consumo de alcohol</Lbl>
                <select style={inputSt} value={formFicha.alcoholismo}
                  onChange={e => setFormFicha(f => ({ ...f, alcoholismo: e.target.value }))}>
                  {["Ninguno","Ocasional","Frecuente","Diario"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "center", paddingTop: 24 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={formFicha.fumador}
                    onChange={e => setFormFicha(f => ({ ...f, fumador: e.target.checked }))} />
                  Fumador/a
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={formFicha.alergias_latex}
                    onChange={e => setFormFicha(f => ({ ...f, alergias_latex: e.target.checked }))} />
                  Alergia al látex
                </label>
              </div>
            </div>
          </SeccionCard>

          {/* Fototipo */}
          <SeccionCard titulo="Fototipo de Fitzpatrick" icono="bi-brightness-high-fill">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>
              {FOTOTIPOS.map(ft => {
                const sel = formFicha.fototipo === ft.id;
                return (
                  <div
                    key={ft.id}
                    onClick={() => setFormFicha(f => ({ ...f, fototipo: sel ? "" : ft.id }))}
                    style={{
                      background: sel ? `${C.accent}18` : "rgba(255,255,255,.03)",
                      border: `2px solid ${sel ? C.accent : C.border}`,
                      borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, transition: "all .18s",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: ft.color, flexShrink: 0,
                      border: "2px solid rgba(255,255,255,.2)",
                    }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: sel ? C.accent : C.text }}>Tipo {ft.id}</div>
                      <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.3 }}>{ft.desc.split("(")[0]}</div>
                    </div>
                    {sel && <i className="bi bi-check-circle-fill" style={{ color: C.accent, marginLeft: "auto" }} />}
                  </div>
                );
              })}
            </div>
          </SeccionCard>

          {/* Procedimientos previos */}
          <SeccionCard titulo="Procedimientos estéticos previos" icono="bi-scissors">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PROCEDIMIENTOS_PREV.map(p => {
                const sel = formFicha.procedimientos_previos.includes(p);
                return (
                  <button type="button" key={p} onClick={() => toggleProc(p)}
                    style={{
                      background: sel ? `${C.accent}20` : "rgba(255,255,255,.04)",
                      border: `1px solid ${sel ? C.accent : C.border}`,
                      borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                      color: sel ? C.accent : C.muted, fontSize: 13, fontWeight: sel ? 600 : 400,
                      transition: "all .15s",
                    }}>
                    {sel && <i className="bi bi-check me-1" />}{p}
                  </button>
                );
              })}
            </div>
          </SeccionCard>

          {/* Zonas de interés */}
          <SeccionCard titulo="Zonas de interés del paciente" icono="bi-geo-alt-fill">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ZONAS.map(z => {
                const sel = formFicha.zonas_interes.includes(z);
                return (
                  <button type="button" key={z} onClick={() => toggleZona(z)}
                    style={{
                      background: sel ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.03)",
                      border: `1px solid ${sel ? "rgba(255,255,255,.25)" : C.border}`,
                      borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                      color: sel ? C.text : C.muted, fontSize: 13, fontWeight: sel ? 600 : 400,
                      transition: "all .15s",
                    }}>
                    {sel && <i className="bi bi-check me-1" />}{z}
                  </button>
                );
              })}
            </div>
          </SeccionCard>

          {/* Motivaciones */}
          <SeccionCard titulo="Motivación y expectativas" icono="bi-star-fill">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <Lbl>Motivación principal del paciente</Lbl>
                <textarea style={{ ...inputSt, minHeight: 70, resize: "vertical" }}
                  placeholder="¿Por qué desea este procedimiento?" value={formFicha.motivacion}
                  onChange={e => setFormFicha(f => ({ ...f, motivacion: e.target.value }))} />
              </div>
              <div>
                <Lbl>Expectativas del resultado</Lbl>
                <textarea style={{ ...inputSt, minHeight: 70, resize: "vertical" }}
                  placeholder="¿Qué resultado espera obtener?" value={formFicha.expectativas}
                  onChange={e => setFormFicha(f => ({ ...f, expectativas: e.target.value }))} />
              </div>
              <div>
                <Lbl>Notas del médico (privadas)</Lbl>
                <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical" }}
                  placeholder="Evaluación preoperatoria, contraindicaciones, observaciones clínicas..."
                  value={formFicha.notas_medico}
                  onChange={e => setFormFicha(f => ({ ...f, notas_medico: e.target.value }))} />
              </div>
            </div>
          </SeccionCard>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            {ficha && (
              <button type="button" onClick={() => setEditando(false)}
                style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 9,
                           padding: "11px 24px", color: C.muted, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
            )}
            <button type="submit"
              style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                border: "none", borderRadius: 9, padding: "11px 28px",
                color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15,
                boxShadow: `0 4px 16px rgba(233,30,140,.4)`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
              <i className="bi bi-check-lg" /> Guardar ficha estética
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function SeccionCard({ titulo, icono, children }) {
  return (
    <div style={{
      background: "#162a45", border: "rgba(255,255,255,0.07) solid 1px",
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(0,0,0,.15)",
      }}>
        <i className={`bi ${icono}`} style={{ color: "#e91e8c", fontSize: 14 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{titulo}</span>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function ItemFicha({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );
}

function Lbl({ children }) {
  return (
    <label style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: ".05em", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}
