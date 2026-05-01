import { useEffect, useState } from "react";
import api from "../../api/api";

const C = {
  bg: "#f0f2f5", surface: "#f8fafc", card: "#ffffff",
  border: "#e5e7eb", accent: "#e91e8c", accentD: "#c2185b",
  text: "#111827", textSub: "#374151", muted: "#6b7280",
  mutedLt: "#9ca3af", inputBg: "#ffffff", success: "#10b981",
};

const inputSt = {
  background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, padding: "8px 12px", width: "100%", fontSize: 14, outline: "none",
};

const ESTADOS = ["BORRADOR","ENVIADO","APROBADO","RECHAZADO"];
const ESTADO_COL = {
  BORRADOR:  { bg: "rgba(148,163,184,.12)", border: "rgba(148,163,184,.3)", color: "#94a3b8" },
  ENVIADO:   { bg: "rgba(33,150,243,.12)",  border: "rgba(33,150,243,.3)",  color: "#2196f3" },
  APROBADO:  { bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.3)",  color: "#10b981" },
  RECHAZADO: { bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.3)",   color: "#f87171" },
};

export default function Presupuestos() {
  const [pacientes,    setPacientes]   = useState([]);
  const [servicios,    setServicios]   = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [showModal,    setShowModal]   = useState(false);
  const [form,         setForm]        = useState(initForm());
  const [filtroEst,    setFiltroEst]   = useState("");

  function initForm() {
    return {
      paciente_id: "", titulo: "", procedimientos: [{ nombre: "", precio: "" }],
      observaciones: "", validez_dias: "30", estado: "BORRADOR",
    };
  }

  useEffect(() => {
    Promise.all([
      api.get("/pacientes"),
      api.get("/servicios"),
    ]).then(([rP, rS]) => {
      setPacientes(rP.data.data || []);
      setServicios(rS.data.data || []);
    }).catch(() => {});
    cargar();
  }, []);

  const cargar = () => {
    // Simulamos lista local mientras no hay endpoint dedicado
    const saved = JSON.parse(localStorage.getItem("presupuestos_est") || "[]");
    setPresupuestos(saved);
  };

  const guardar = (e) => {
    e.preventDefault();
    const pac = pacientes.find(p => String(p.id) === String(form.paciente_id));
    const total = form.procedimientos.reduce((s, p) => s + (parseFloat(p.precio) || 0), 0);
    const nuevo = {
      ...form,
      id: Date.now(),
      paciente_nombre: pac ? `${pac.nombres} ${pac.apellidos}` : "—",
      total,
      creado_en: new Date().toISOString(),
    };
    const lista = [...presupuestos, nuevo];
    localStorage.setItem("presupuestos_est", JSON.stringify(lista));
    setPresupuestos(lista);
    setShowModal(false);
    setForm(initForm());
  };

  const cambiarEstado = (id, estado) => {
    const lista = presupuestos.map(p => p.id === id ? { ...p, estado } : p);
    localStorage.setItem("presupuestos_est", JSON.stringify(lista));
    setPresupuestos(lista);
  };

  const eliminar = (id) => {
    const lista = presupuestos.filter(p => p.id !== id);
    localStorage.setItem("presupuestos_est", JSON.stringify(lista));
    setPresupuestos(lista);
  };

  const addProc = () => setForm(f => ({ ...f, procedimientos: [...f.procedimientos, { nombre: "", precio: "" }] }));
  const updProc = (i, k, v) => setForm(f => ({
    ...f, procedimientos: f.procedimientos.map((p, idx) => idx === i ? { ...p, [k]: v } : p),
  }));
  const delProc = (i) => setForm(f => ({
    ...f, procedimientos: f.procedimientos.filter((_, idx) => idx !== i),
  }));

  const filtrados = filtroEst ? presupuestos.filter(p => p.estado === filtroEst) : presupuestos;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1a1035 0%, #2d1045 50%, #1a2744 100%)",
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 14px rgba(233,30,140,.4)`,
          }}>
            <i className="bi bi-receipt-cutoff" style={{ fontSize: 20, color: "#fff" }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: "#fff" }}>Presupuestos Estéticos</h4>
            <span style={{ color: "rgba(255,255,255,.5)", fontSize: 13 }}>Cotizaciones y planes de tratamiento</span>
          </div>
        </div>
        <button
          onClick={() => { setForm(initForm()); setShowModal(true); }}
          style={{
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
            border: "none", borderRadius: 10, padding: "9px 18px",
            color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: `0 4px 14px rgba(233,30,140,.4)`,
          }}
        >
          <i className="bi bi-plus-lg" /> Nuevo presupuesto
        </button>
      </div>
      <div style={{ padding: "20px 24px" }}>

      {/* Filtro estado */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["", ...ESTADOS].map(est => (
          <button
            key={est}
            onClick={() => setFiltroEst(est)}
            style={{
              background: filtroEst === est ? `${C.accent}10` : C.card,
              border: `1px solid ${filtroEst === est ? C.accent : C.border}`,
              borderRadius: 8, padding: "6px 14px", color: filtroEst === est ? C.accentD : C.muted,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,.05)",
            }}
          >
            {est || "Todos"} {est && `(${presupuestos.filter(p => p.estado === est).length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {!filtrados.length ? (
        <EmptyState icon="bi-receipt-cutoff" titulo="Sin presupuestos" desc="Crea el primer presupuesto para un paciente." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtrados.map(p => {
            const col = ESTADO_COL[p.estado] || ESTADO_COL.BORRADOR;
            return (
              <div key={p.id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.06)",
              }}>
                <div style={{
                  padding: "14px 20px", display: "flex", alignItems: "center",
                  justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 11, background: `${C.accent}10`,
                      border: `1px solid ${C.accent}25`, display: "flex", alignItems: "center",
                      justifyContent: "center", flexShrink: 0,
                    }}>
                      <i className="bi bi-receipt-cutoff" style={{ fontSize: 18, color: C.accent }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{p.titulo}</div>
                      <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                        <i className="bi bi-person me-1" />{p.paciente_nombre}
                        <span style={{ margin: "0 8px", opacity: .4 }}>·</span>
                        <i className="bi bi-calendar2 me-1" />
                        {new Date(p.creado_en).toLocaleDateString("es-PE")}
                        <span style={{ margin: "0 8px", opacity: .4 }}>·</span>
                        Vigencia: {p.validez_dias} días
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.accent }}>
                        S/ {Number(p.total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{p.procedimientos.length} procedimiento{p.procedimientos.length !== 1 ? "s" : ""}</div>
                    </div>
                    <span style={{
                      background: col.bg, border: `1px solid ${col.border}`,
                      borderRadius: 8, padding: "4px 12px", fontSize: 12,
                      color: col.color, fontWeight: 700,
                    }}>
                      {p.estado}
                    </span>
                  </div>
                </div>
                {/* Acciones */}
                <div style={{
                  padding: "10px 20px", borderTop: `1px solid ${C.border}`,
                  background: C.surface, display: "flex", gap: 8, flexWrap: "wrap",
                }}>
                  {ESTADOS.filter(e => e !== p.estado).map(e => (
                    <button key={e} onClick={() => cambiarEstado(p.id, e)}
                      style={{
                        background: C.card, border: `1px solid ${C.border}`,
                        borderRadius: 7, padding: "5px 12px", color: C.muted,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>
                      → {e}
                    </button>
                  ))}
                  <button onClick={() => eliminar(p.id)}
                    style={{
                      marginLeft: "auto", background: "rgba(239,68,68,.07)",
                      border: "1px solid rgba(239,68,68,.2)", borderRadius: 7,
                      padding: "5px 12px", color: "#f87171", fontSize: 12, cursor: "pointer",
                    }}>
                    <i className="bi bi-trash" /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>{/* fin padding */}

      {/* Modal nuevo presupuesto */}
      {showModal && (
        <>
          <div style={{
            position: "fixed", inset: 0, zIndex: 1049,
            background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
          }} onClick={() => setShowModal(false)} />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            zIndex: 1050,
            background: C.card, borderRadius: 16, width: "calc(100% - 32px)", maxWidth: 640,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            border: `1px solid ${C.border}`,
          }}>
            <div style={{
              background: "linear-gradient(135deg, #1a1035 0%, #2d1045 50%, #1a2744 100%)",
              padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderRadius: "16px 16px 0 0",
            }}>
              <h5 style={{ margin: 0, fontWeight: 700, color: "#fff", fontSize: 16 }}>
                <i className="bi bi-receipt-cutoff me-2" style={{ color: "#f9a8d4" }} />
                Nuevo Presupuesto Estético
              </h5>
              <button onClick={() => setShowModal(false)}
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: "rgba(239,68,68,.2)", border: "1px solid rgba(239,68,68,.4)",
                  color: "#fca5a5", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <i className="bi bi-x-lg" style={{ fontSize: 14 }} />
              </button>
            </div>
            <form onSubmit={guardar} style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Paciente *</label>
                  <select style={{ ...inputSt }} value={form.paciente_id}
                    onChange={e => setForm(f => ({ ...f, paciente_id: e.target.value }))} required>
                    <option value="">— Seleccionar —</option>
                    {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Título *</label>
                  <input style={inputSt} value={form.titulo} required
                    placeholder="Ej: Plan Rinoplastia + Mentoplastia"
                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
                </div>
              </div>

              {/* Procedimientos */}
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                 letterSpacing: ".05em", display: "block", marginBottom: 10 }}>
                  Procedimientos incluidos
                </label>
                {form.procedimientos.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
                    <input style={{ ...inputSt, flex: 2 }} placeholder="Procedimiento"
                      value={p.nombre} onChange={e => updProc(i, "nombre", e.target.value)} />
                    <input style={{ ...inputSt, flex: 1 }} placeholder="S/ 0.00" type="number"
                      value={p.precio} onChange={e => updProc(i, "precio", e.target.value)} />
                    {form.procedimientos.length > 1 && (
                      <button type="button" onClick={() => delProc(i)}
                        style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18 }}>
                        <i className="bi bi-dash-circle" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addProc}
                  style={{ background: `${C.accent}08`, border: `1px dashed ${C.accent}40`,
                             borderRadius: 8, padding: "7px 14px", color: C.accentD,
                             fontSize: 13, cursor: "pointer", width: "100%" }}>
                  <i className="bi bi-plus me-1" /> Agregar procedimiento
                </button>
                <div style={{ textAlign: "right", marginTop: 10, fontWeight: 700, fontSize: 16, color: C.accent }}>
                  Total: S/ {form.procedimientos.reduce((s, p) => s + (parseFloat(p.precio) || 0), 0).toFixed(2)}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Vigencia (días)</label>
                  <input style={inputSt} type="number" value={form.validez_dias}
                    onChange={e => setForm(f => ({ ...f, validez_dias: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Estado</label>
                  <select style={inputSt} value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase",
                                 letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Observaciones</label>
                <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical" }} value={form.observaciones}
                  placeholder="Notas, condiciones especiales, financiamiento..."
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 9,
                             padding: "10px 22px", color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                  Cancelar
                </button>
                <button type="submit"
                  style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentD})`,
                             border: "none", borderRadius: 9, padding: "10px 26px",
                             color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
                             boxShadow: `0 4px 14px rgba(233,30,140,.35)` }}>
                  <i className="bi bi-check-lg me-1" /> Guardar presupuesto
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ icon, titulo, desc }) {
  return (
    <div style={{ textAlign: "center", padding: "72px 0" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, margin: "0 auto 18px",
        background: `${C.accent}08`, border: `1px solid ${C.accent}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`bi ${icon}`} style={{ fontSize: 30, color: C.accent }} />
      </div>
      <p style={{ color: C.muted, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{titulo}</p>
      <p style={{ color: C.mutedLt, fontSize: 13, margin: 0 }}>{desc}</p>
    </div>
  );
}
