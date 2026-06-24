import { useEffect, useState, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_CORTOS = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

function pad(n) { return String(n).padStart(2,"0"); }
function toYMD(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

// Convierte dia_semana (0=Lun) a getDay() (0=Dom)
function diaSemanaToGetDay(ds) { return ds === 6 ? 0 : ds + 1; }

export default function AgendarModal({ slug, color, servicios, onClose }) {
  const [paso, setPaso]         = useState(1); // 1=servicio 2=fecha 3=hora 4=datos 5=ok
  const [medicos, setMedicos]   = useState([]);
  const [medicoId, setMedicoId] = useState(null);
  const [servicio, setServicio] = useState(null);
  const [fecha, setFecha]       = useState(null);       // "YYYY-MM-DD"
  const [slots, setSlots]       = useState([]);
  const [slot, setSlot]         = useState(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [form, setForm]         = useState({ nombres:"", apellidos:"", telefono:"", email:"", motivo:"" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError]       = useState("");

  // Calendario
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const [mesVista, setMesVista] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  // Cargar médicos al abrir
  useEffect(() => {
    axios.get(`${API}/api/public/clinica/${slug}/medicos`)
      .then(r => {
        const lista = r.data.data || [];
        setMedicos(lista);
        if (lista.length === 1) setMedicoId(lista[0].id);
      })
      .catch(() => {});
  }, [slug]);

  // Médico seleccionado
  const medico = medicos.find(m => m.id === medicoId);
  const diasDisponibles = new Set(
    (medico?.dias_disponibles || []).map(d => diaSemanaToGetDay(d))
  );

  // Cargar slots cuando cambia fecha o médico
  useEffect(() => {
    if (!fecha || !medicoId) { setSlots([]); return; }
    setCargandoSlots(true);
    setSlot(null);
    axios.get(`${API}/api/public/clinica/${slug}/slots`, { params: { medico_id: medicoId, fecha } })
      .then(r => setSlots(r.data.data || []))
      .catch(() => setSlots([]))
      .finally(() => setCargandoSlots(false));
  }, [fecha, medicoId, slug]);

  // Días del mes para el calendario
  const diasDelMes = useCallback(() => {
    const año  = mesVista.getFullYear();
    const mes  = mesVista.getMonth();
    const prim = new Date(año, mes, 1);
    const ult  = new Date(año, mes + 1, 0);
    // Primer lunes antes del mes
    let inicio = new Date(prim);
    const dow  = prim.getDay(); // 0=Dom
    const offset = dow === 0 ? 6 : dow - 1;
    inicio.setDate(inicio.getDate() - offset);

    const celdas = [];
    const cur = new Date(inicio);
    while (cur <= ult || celdas.length % 7 !== 0) {
      celdas.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
      if (celdas.length > 42) break;
    }
    return celdas;
  }, [mesVista]);

  const isDiaDisponible = (d) => {
    if (d < hoy) return false;
    // Solo hasta 60 días adelante
    const limite = new Date(hoy); limite.setDate(limite.getDate() + 60);
    if (d > limite) return false;
    return diasDisponibles.size === 0 || diasDisponibles.has(d.getDay());
  };

  const handleAgendar = async () => {
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.telefono.trim()) {
      setError("Nombre, apellido y teléfono son obligatorios.");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      await axios.post(`${API}/api/public/clinica/${slug}/agendar`, {
        nombres:    form.nombres,
        apellidos:  form.apellidos,
        telefono:   form.telefono,
        email:      form.email || undefined,
        motivo:     form.motivo || undefined,
        medico_id:  medicoId,
        inicio:     slot.inicio,
        fin:        slot.fin,
        servicio_id: servicio?.id || undefined,
      });
      setPaso(5);
    } catch (e) {
      setError(e.response?.data?.msg || "Error al agendar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const colorDark = color || "#213665";
  const btnStyle = { background: colorDark, color: "#fff", border: "none", borderRadius: 12, padding: "13px 20px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%" };
  const btnOutStyle = { background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 12, padding: "13px 20px", fontWeight: 600, fontSize: 15, cursor: "pointer" };

  return (
    <>
      <style>{`
        .modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center; }
        @media(min-width:520px){ .modal-overlay { align-items:center; } }
        .modal-box { background:#fff;width:100%;max-width:480px;border-radius:24px 24px 0 0;max-height:92vh;overflow-y:auto;animation:slideUp .25s ease; }
        @media(min-width:520px){ .modal-box { border-radius:20px;max-height:88vh; } }
        @keyframes slideUp { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
        .dia-cal { width:36px;height:36px;border-radius:50%;border:none;background:transparent;cursor:pointer;font-size:13px;font-weight:500;color:#334155;transition:.15s; }
        .dia-cal:hover:not(:disabled) { background:#f1f5f9; }
        .dia-cal:disabled { color:#cbd5e1;cursor:default; }
        .slot-btn { border:1.5px solid #e2e8f0;background:#fff;border-radius:10px;padding:10px 14px;cursor:pointer;font-size:14px;font-weight:600;color:#334155;transition:.15s; }
        .slot-btn:hover { border-color:${colorDark};color:${colorDark}; }
        .slot-btn.sel { background:${colorDark};color:#fff;border-color:${colorDark}; }
        .srv-btn { display:flex;align-items:center;gap:12px;border:1.5px solid #e2e8f0;background:#fff;border-radius:14px;padding:14px 16px;cursor:pointer;text-align:left;transition:.15s;width:100%; }
        .srv-btn:hover { border-color:${colorDark}; }
        .srv-btn.sel { border-color:${colorDark};background:#f5f3ff; }
      `}</style>

      <div className="modal-overlay" onClick={paso === 5 ? undefined : onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={{ padding: "18px 20px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Agendar Cita</div>
              {paso < 5 && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  Paso {paso} de 4
                </div>
              )}
            </div>
            {paso < 5 && (
              <button onClick={onClose} style={{ border:"none", background:"#f1f5f9", borderRadius:"50%", width:36, height:36, fontSize:18, cursor:"pointer", color:"#64748b", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            )}
          </div>

          {/* Barra de progreso */}
          {paso < 5 && (
            <div style={{ margin:"12px 20px 0", height:4, background:"#f1f5f9", borderRadius:4 }}>
              <div style={{ height:"100%", width:`${(paso/4)*100}%`, background:colorDark, borderRadius:4, transition:"width .3s" }} />
            </div>
          )}

          <div style={{ padding: "16px 20px 24px" }}>

            {/* ── PASO 1: Servicio ── */}
            {paso === 1 && (
              <div>
                <p style={{ fontWeight:600, color:"#475569", fontSize:14, marginBottom:14 }}>¿Qué tipo de consulta necesitas?</p>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {servicios.map(s => (
                    <button
                      key={s.id}
                      className={`srv-btn${servicio?.id === s.id ? " sel" : ""}`}
                      onClick={() => setServicio(s)}
                    >
                      <div style={{ width:38, height:38, borderRadius:10, background:`${colorDark}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <i className="bi bi-clipboard2-pulse" style={{ color:colorDark, fontSize:18 }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{s.nombre}</div>
                        {s.descripcion && <div style={{ fontSize:12, color:"#64748b", marginTop:2, lineHeight:1.4 }}>{s.descripcion.slice(0,80)}{s.descripcion.length>80?"…":""}</div>}
                      </div>
                    </button>
                  ))}
                  <button className="srv-btn" onClick={() => setServicio(null)} style={{ borderStyle: !servicio ? "solid" : "dashed", borderColor: !servicio ? colorDark : "#e2e8f0", background: !servicio ? `${colorDark}10` : "#fff" }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <i className="bi bi-three-dots" style={{ color:"#94a3b8", fontSize:18 }} />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#475569" }}>Otro / General</div>
                    </div>
                  </button>
                </div>

                {/* Selección de médico si hay más de uno */}
                {medicos.length > 1 && (
                  <div style={{ marginTop:16 }}>
                    <p style={{ fontWeight:600, color:"#475569", fontSize:14, marginBottom:10 }}>Selecciona el médico</p>
                    {medicos.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setMedicoId(m.id)}
                        style={{
                          display:"flex", alignItems:"center", gap:10, width:"100%",
                          border:`1.5px solid ${medicoId===m.id ? colorDark : "#e2e8f0"}`,
                          background: medicoId===m.id ? `${colorDark}10` : "#fff",
                          borderRadius:12, padding:"10px 14px", cursor:"pointer", marginBottom:8,
                        }}
                      >
                        <div style={{ width:36, height:36, borderRadius:"50%", background:"#f1f5f9", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {m.foto_url
                            ? <img src={m.foto_url.startsWith("http")?m.foto_url:`${API}${m.foto_url}`} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                            : <i className="bi bi-person" style={{ color:"#94a3b8" }} />
                          }
                        </div>
                        <div style={{ textAlign:"left" }}>
                          <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{m.nombres} {m.apellidos}</div>
                          {m.especialidad && <div style={{ fontSize:12, color:"#64748b" }}>{m.especialidad}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <button style={{ ...btnStyle, marginTop:20 }} onClick={() => { if (medicoId) setPaso(2); }}>
                  Continuar
                </button>
              </div>
            )}

            {/* ── PASO 2: Fecha ── */}
            {paso === 2 && (
              <div>
                <p style={{ fontWeight:600, color:"#475569", fontSize:14, marginBottom:14 }}>Selecciona una fecha</p>

                {/* Navegación del mes */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <button style={{ ...btnOutStyle, width:"auto", padding:"6px 12px" }}
                    onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth()-1, 1))}>
                    <i className="bi bi-chevron-left" />
                  </button>
                  <span style={{ fontWeight:700, fontSize:15, color:"#1e293b" }}>
                    {MESES[mesVista.getMonth()]} {mesVista.getFullYear()}
                  </span>
                  <button style={{ ...btnOutStyle, width:"auto", padding:"6px 12px" }}
                    onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth()+1, 1))}>
                    <i className="bi bi-chevron-right" />
                  </button>
                </div>

                {/* Encabezados días */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
                  {DIAS_CORTOS.map(d => (
                    <div key={d} style={{ textAlign:"center", fontSize:12, fontWeight:700, color:"#94a3b8", padding:"4px 0" }}>{d}</div>
                  ))}
                </div>

                {/* Celdas */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
                  {diasDelMes().map((d, i) => {
                    const ymd   = toYMD(d);
                    const esMes = d.getMonth() === mesVista.getMonth();
                    const disp  = esMes && isDiaDisponible(d);
                    const sel   = fecha === ymd;
                    return (
                      <div key={i} style={{ display:"flex", justifyContent:"center" }}>
                        <button
                          className="dia-cal"
                          disabled={!disp}
                          onClick={() => { setFecha(ymd); setSlot(null); }}
                          style={{
                            opacity: esMes ? 1 : 0.3,
                            background: sel ? colorDark : undefined,
                            color: sel ? "#fff" : undefined,
                            fontWeight: sel ? 700 : undefined,
                          }}
                        >
                          {d.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display:"flex", gap:10, marginTop:20 }}>
                  <button style={{ ...btnOutStyle, flex:1 }} onClick={() => setPaso(1)}>Atrás</button>
                  <button style={{ ...btnStyle, flex:2 }} disabled={!fecha} onClick={() => setPaso(3)}>Continuar</button>
                </div>
              </div>
            )}

            {/* ── PASO 3: Hora ── */}
            {paso === 3 && (
              <div>
                <p style={{ fontWeight:600, color:"#475569", fontSize:14, marginBottom:4 }}>Selecciona el horario</p>
                <p style={{ fontSize:13, color:"#94a3b8", marginBottom:14 }}>
                  {fecha && new Date(fecha+"T12:00:00").toLocaleDateString("es-HN",{weekday:"long",day:"numeric",month:"long"})}
                </p>

                {cargandoSlots ? (
                  <div style={{ textAlign:"center", padding:32, color:"#94a3b8" }}>
                    <div style={{ width:32, height:32, border:`3px solid #f1f5f9`, borderTop:`3px solid ${colorDark}`, borderRadius:"50%", animation:"spin .7s linear infinite", margin:"0 auto 12px" }} />
                    Buscando disponibilidad...
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                ) : slots.length === 0 ? (
                  <div style={{ textAlign:"center", padding:32, color:"#94a3b8" }}>
                    <i className="bi bi-calendar-x" style={{ fontSize:36, display:"block", marginBottom:10 }} />
                    No hay slots disponibles en esta fecha.
                    <br />
                    <button style={{ ...btnOutStyle, marginTop:12, width:"auto" }} onClick={() => setPaso(2)}>Elegir otra fecha</button>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, maxHeight:240, overflowY:"auto" }}>
                    {slots.map((s, i) => (
                      <button key={i} className={`slot-btn${slot?.inicio===s.inicio?" sel":""}`} onClick={() => setSlot(s)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display:"flex", gap:10, marginTop:20 }}>
                  <button style={{ ...btnOutStyle, flex:1 }} onClick={() => setPaso(2)}>Atrás</button>
                  <button style={{ ...btnStyle, flex:2 }} disabled={!slot} onClick={() => setPaso(4)}>Continuar</button>
                </div>
              </div>
            )}

            {/* ── PASO 4: Datos personales ── */}
            {paso === 4 && (
              <div>
                <p style={{ fontWeight:600, color:"#475569", fontSize:14, marginBottom:14 }}>Tus datos de contacto</p>

                {/* Resumen */}
                <div style={{ background:"#f8fafc", borderRadius:12, padding:"12px 14px", marginBottom:16, fontSize:13 }}>
                  {servicio && <div><span style={{ color:"#64748b" }}>Servicio:</span> <strong>{servicio.nombre}</strong></div>}
                  <div><span style={{ color:"#64748b" }}>Fecha:</span> <strong>{fecha && new Date(fecha+"T12:00:00").toLocaleDateString("es-HN",{weekday:"short",day:"numeric",month:"long"})}</strong></div>
                  <div><span style={{ color:"#64748b" }}>Hora:</span> <strong>{slot?.label}</strong></div>
                  {medico && <div><span style={{ color:"#64748b" }}>Médico:</span> <strong>{medico.nombres} {medico.apellidos}</strong></div>}
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div>
                      <label style={{ fontSize:13, fontWeight:600, color:"#374151", display:"block", marginBottom:4 }}>Nombres *</label>
                      <input className="form-control" placeholder="María" value={form.nombres}
                        onChange={e => setForm({...form, nombres:e.target.value})} />
                    </div>
                    <div>
                      <label style={{ fontSize:13, fontWeight:600, color:"#374151", display:"block", marginBottom:4 }}>Apellidos *</label>
                      <input className="form-control" placeholder="García" value={form.apellidos}
                        onChange={e => setForm({...form, apellidos:e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:"#374151", display:"block", marginBottom:4 }}>Teléfono *</label>
                    <input className="form-control" placeholder="+504 9876-5432" value={form.telefono}
                      onChange={e => setForm({...form, telefono:e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:"#374151", display:"block", marginBottom:4 }}>Correo electrónico</label>
                    <input className="form-control" type="email" placeholder="correo@ejemplo.com" value={form.email}
                      onChange={e => setForm({...form, email:e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize:13, fontWeight:600, color:"#374151", display:"block", marginBottom:4 }}>Motivo de consulta</label>
                    <textarea className="form-control" rows={2} placeholder="Describe brevemente el motivo..." value={form.motivo}
                      onChange={e => setForm({...form, motivo:e.target.value})} />
                  </div>
                </div>

                {error && (
                  <div style={{ marginTop:12, background:"#fee2e2", color:"#991b1b", padding:"10px 12px", borderRadius:10, fontSize:13 }}>
                    {error}
                  </div>
                )}

                <div style={{ display:"flex", gap:10, marginTop:20 }}>
                  <button style={{ ...btnOutStyle, flex:1 }} onClick={() => setPaso(3)} disabled={enviando}>Atrás</button>
                  <button style={{ ...btnStyle, flex:2 }} onClick={handleAgendar} disabled={enviando}>
                    {enviando ? "Agendando..." : "Confirmar cita"}
                  </button>
                </div>
              </div>
            )}

            {/* ── PASO 5: Éxito ── */}
            {paso === 5 && (
              <div style={{ textAlign:"center", padding:"16px 0 8px" }}>
                {/* Icono animado */}
                <div style={{ position:"relative", width:90, height:90, margin:"0 auto 20px" }}>
                  <div style={{
                    width:90, height:90, borderRadius:"50%",
                    background:`linear-gradient(135deg, ${colorDark}, ${colorDark}aa)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:`0 8px 32px ${colorDark}40`,
                    animation:"popIn .4s cubic-bezier(.175,.885,.32,1.275) both",
                  }}>
                    <i className="bi bi-check-lg" style={{ fontSize:44, color:"#fff", fontWeight:900 }} />
                  </div>
                </div>
                <style>{`@keyframes popIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

                <h3 style={{ fontWeight:800, color:"#0f172a", fontSize:22, marginBottom:6 }}>¡Cita agendada!</h3>
                <p style={{ color:"#64748b", fontSize:14, lineHeight:1.65, marginBottom:20 }}>
                  Tu solicitud fue registrada exitosamente.
                </p>

                {/* Tarjeta resumen */}
                <div style={{
                  background:"#f8fafc", border:"1px solid #e2e8f0",
                  borderRadius:14, padding:"14px 16px", marginBottom:24, textAlign:"left",
                }}>
                  {servicio && (
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <i className="bi bi-clipboard2-pulse" style={{ color:colorDark, flexShrink:0, marginTop:1 }} />
                      <span style={{ fontSize:14, color:"#334155" }}><strong>{servicio.nombre}</strong></span>
                    </div>
                  )}
                  {fecha && (
                    <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <i className="bi bi-calendar3" style={{ color:colorDark, flexShrink:0, marginTop:1 }} />
                      <span style={{ fontSize:14, color:"#334155" }}>
                        <strong>{new Date(fecha+"T12:00:00").toLocaleDateString("es-HN",{weekday:"long",day:"numeric",month:"long"})}</strong>
                      </span>
                    </div>
                  )}
                  {slot && (
                    <div style={{ display:"flex", gap:8 }}>
                      <i className="bi bi-clock" style={{ color:colorDark, flexShrink:0, marginTop:1 }} />
                      <span style={{ fontSize:14, color:"#334155" }}><strong>{slot.label}</strong></span>
                    </div>
                  )}
                </div>

                <p style={{ fontSize:13, color:"#94a3b8", marginBottom:20 }}>
                  Si necesitas cambiar o cancelar tu cita, contáctanos directamente.
                </p>
                <button style={{ ...btnStyle, fontSize:16 }} onClick={onClose}>Listo</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
