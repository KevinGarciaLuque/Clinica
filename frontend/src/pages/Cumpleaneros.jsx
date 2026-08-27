import { useEffect, useState, useRef } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import api from "../api/api";

dayjs.locale("es");

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const fotoUrl = (foto) => {
  if (!foto) return null;
  if (foto.startsWith("http")) return foto;
  return `${API_BASE}/uploads/${foto.replace(/^\/?uploads\//, "")}`;
};

const C = {
  muted: "#6b7280",
  text:  "#111827",
  accent:"#2563eb",
  border:"#e5e7eb",
};

/* ──────────────────────────────────────────────────────────────────────── */
/*  Modal de felicitación                                                    */
/* ──────────────────────────────────────────────────────────────────────── */
function ModalFelicitar({ paciente, onClose, whatsappActivo }) {
  const nombre = `${paciente.nombres} ${paciente.apellidos}`;
  const [canales, setCanales] = useState({
    email:    !!(paciente.email),
    whatsapp: whatsappActivo && !!(paciente.telefono),
  });
  const [mensaje, setMensaje] = useState(
    `¡Hola ${paciente.nombres}! 🎂\n\nEn el día de tu cumpleaños, todo el equipo de nuestra clínica te desea un maravilloso día lleno de salud, alegría y momentos especiales.\n\n¡Que cumplas muchos más años! 🎉\n\nCon cariño,\nEl equipo de tu clínica`
  );
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [waLink, setWaLink] = useState(null);

  const toggleCanal = (c) => setCanales(prev => ({ ...prev, [c]: !prev[c] }));

  const enviar = async () => {
    const seleccionados = Object.entries(canales).filter(([,v]) => v).map(([k]) => k);
    if (!seleccionados.length) return alert("Selecciona al menos un canal");
    setEnviando(true);
    setResultado(null);
    try {
      const res = await api.post("/cumpleanos/felicitar", {
        paciente_id: paciente.id,
        canales: seleccionados,
        mensaje,
      });
      setResultado(res.data.resultados || {});
      // Si whatsapp es fallback, extraer link
      if (res.data.resultados?.whatsapp?.fallback) {
        setWaLink(res.data.resultados.whatsapp.link);
      }
    } catch (e) {
      setResultado({ error: e.response?.data?.msg || e.message });
    } finally {
      setEnviando(false);
    }
  };

  const fotoSrc = fotoUrl(paciente.foto_perfil);

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520,
        boxShadow: "0 24px 60px rgba(0,0,0,.25)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
          padding: "18px 22px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* Avatar */}
          {fotoSrc ? (
            <img src={fotoSrc} alt={nombre} style={{
              width: 52, height: 52, borderRadius: "50%", objectFit: "cover",
              border: "3px solid rgba(255,255,255,.3)",
            }} />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "rgba(124,77,255,.35)", border: "3px solid rgba(255,255,255,.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 18,
            }}>
              {paciente.nombres?.[0]}{paciente.apellidos?.[0]}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>
              🎂 Felicitar a {nombre}
            </div>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: "0.8rem", marginTop: 2 }}>
              {paciente.edad} años hoy · {dayjs().format("D [de] MMMM [de] YYYY")}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)",
            borderRadius: "50%", width: 32, height: 32, cursor: "pointer",
            color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-x" />
          </button>
        </div>

        <div style={{ padding: "20px 22px" }}>
          {/* Selección de canales */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase",
                          letterSpacing: ".06em", marginBottom: 10 }}>
              Enviar por
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => toggleCanal("email")}
                disabled={!paciente.email}
                style={{
                  flex: 1, padding: "9px 14px", borderRadius: 10, cursor: paciente.email ? "pointer" : "not-allowed",
                  background: canales.email ? "rgba(37,99,235,.1)" : "rgba(0,0,0,.03)",
                  border: canales.email ? "2px solid #2563eb" : "2px solid #e5e7eb",
                  display: "flex", alignItems: "center", gap: 8, transition: "all .15s",
                  opacity: paciente.email ? 1 : 0.45,
                }}
              >
                <i className="bi bi-envelope-fill" style={{ color: canales.email ? "#2563eb" : "#9ca3af", fontSize: 16 }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: canales.email ? "#2563eb" : "#374151" }}>Email</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                    {paciente.email || "Sin email"}
                  </div>
                </div>
                {canales.email && <i className="bi bi-check-circle-fill" style={{ marginLeft: "auto", color: "#2563eb", fontSize: 14 }} />}
              </button>

              <button
                onClick={() => toggleCanal("whatsapp")}
                disabled={!paciente.telefono || !whatsappActivo}
                title={!whatsappActivo ? "Deshabilitado por el administrador de la clínica" : undefined}
                style={{
                  flex: 1, padding: "9px 14px", borderRadius: 10,
                  cursor: (paciente.telefono && whatsappActivo) ? "pointer" : "not-allowed",
                  background: canales.whatsapp ? "rgba(37,211,102,.1)" : "rgba(0,0,0,.03)",
                  border: canales.whatsapp ? "2px solid #25d366" : "2px solid #e5e7eb",
                  display: "flex", alignItems: "center", gap: 8, transition: "all .15s",
                  opacity: (paciente.telefono && whatsappActivo) ? 1 : 0.45,
                }}
              >
                <i className="bi bi-whatsapp" style={{ color: canales.whatsapp ? "#25d366" : "#9ca3af", fontSize: 16 }} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: canales.whatsapp ? "#25d366" : "#374151" }}>WhatsApp</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                    {!whatsappActivo ? "Deshabilitado por el admin" : (paciente.telefono || "Sin teléfono")}
                  </div>
                </div>
                {canales.whatsapp && <i className="bi bi-check-circle-fill" style={{ marginLeft: "auto", color: "#25d366", fontSize: 14 }} />}
              </button>
            </div>
          </div>

          {/* Mensaje */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase",
                          letterSpacing: ".06em", marginBottom: 8 }}>
              Mensaje de felicitación
            </div>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={6}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
                border: "1px solid #e5e7eb", color: "#374151", resize: "vertical",
                outline: "none", lineHeight: 1.6, fontFamily: "inherit",
              }}
            />
          </div>

          {/* Resultado */}
          {resultado && (
            <div style={{ marginBottom: 16 }}>
              {Object.entries(resultado).map(([canal, r]) => (
                canal === "error" ? (
                  <div key="err" style={{
                    background: "#fee2e2", border: "1px solid #fecaca",
                    borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#991b1b",
                  }}>
                    <i className="bi bi-x-circle-fill me-2" />Error: {r}
                  </div>
                ) : (
                  <div key={canal} style={{
                    background: r.ok ? "#dcfce7" : "#fee2e2",
                    border: `1px solid ${r.ok ? "#bbf7d0" : "#fecaca"}`,
                    borderRadius: 8, padding: "8px 12px", fontSize: 12,
                    color: r.ok ? "#166534" : "#991b1b", marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <i className={`bi ${r.ok ? "bi-check-circle-fill" : "bi-x-circle-fill"}`} />
                    <span><strong style={{ textTransform: "capitalize" }}>{canal}</strong>: {r.msg}</span>
                    {r.fallback && r.link && (
                      <a
                        href={r.link} target="_blank" rel="noreferrer"
                        style={{
                          marginLeft: "auto", background: "#25d366", color: "#fff",
                          borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700,
                          textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        <i className="bi bi-whatsapp" /> Abrir WhatsApp
                      </a>
                    )}
                  </div>
                )
              ))}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{
              background: "transparent", border: "1px solid #d1d5db",
              borderRadius: 8, padding: "9px 20px", color: "#374151",
              cursor: "pointer", fontWeight: 600, fontSize: "0.87rem",
            }}>
              {resultado ? "Cerrar" : "Cancelar"}
            </button>
            {!resultado && (
              <button
                onClick={enviar}
                disabled={enviando || (!canales.email && !canales.whatsapp)}
                style={{
                  background: "#7c3aed", border: "none", borderRadius: 8,
                  padding: "9px 22px", color: "#fff", fontWeight: 700,
                  fontSize: "0.87rem", cursor: enviando ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  opacity: (!canales.email && !canales.whatsapp) ? 0.5 : 1,
                }}
              >
                {enviando ? (
                  <><i className="bi bi-hourglass-split" /> Enviando...</>
                ) : (
                  <><i className="bi bi-send-fill" /> Enviar felicitación</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Página principal Cumpleañeros — Vista Calendario                         */
/* ──────────────────────────────────────────────────────────────────────── */
const DIAS_SEM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Cumpleaneros() {
  const [lista,     setLista]     = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [mesActual, setMesActual] = useState(dayjs().startOf("month"));
  const [diaSelec,  setDiaSelec]  = useState(dayjs().date());
  const [mesSelec,  setMesSelec]  = useState(dayjs().startOf("month"));
  const [modalPac,  setModalPac]  = useState(null);
  const [isMobile,  setIsMobile]  = useState(window.innerWidth < 640);
  const [whatsappActivo, setWhatsappActivo] = useState(true);
  const panelRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await api.get("/cumpleanos", { params: { dias: 365, fecha: dayjs().format("YYYY-MM-DD") } });
      setLista(res.data.data || []);
      setWhatsappActivo(res.data.whatsapp_activo !== false);
    } catch {
      setLista([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const hoy = dayjs();

  // Mapa "MM-DD" -> [pacientes]
  const cumpleMap = {};
  lista.forEach(p => {
    const key = dayjs(p.fecha_nacimiento).format("MM-DD");
    if (!cumpleMap[key]) cumpleMap[key] = [];
    cumpleMap[key].push(p);
  });

  const pacsDelDia = (mes, dia) => {
    if (!dia) return [];
    const key = mes.date(dia).format("MM-DD");
    return cumpleMap[key] || [];
  };

  // Celdas del mes
  const primerDia    = mesActual.startOf("month");
  const diasEnMes    = mesActual.daysInMonth();
  const offsetInicio = primerDia.day();
  const celdas = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const esHoyFn = (dia) => dia && mesActual.date(dia).isSame(hoy, "day");
  const esSelFn = (dia) => dia === diaSelec && mesActual.isSame(mesSelec, "month");

  const pacanesDiaSelec = pacsDelDia(mesSelec, diaSelec);

  const totalMes = celdas
    .filter(Boolean)
    .reduce((acc, d) => acc + pacsDelDia(mesActual, d).length, 0);

  const seleccionarDia = (dia) => {
    if (!dia) return;
    setDiaSelec(dia);
    setMesSelec(mesActual.clone());
  };

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,.18)", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="bi bi-cake2-fill" style={{ fontSize: "1rem", color: "#f9a8d4" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Cumpleañeros</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>
              {hoy.format("dddd D [de] MMMM [de] YYYY")} — {lista.length} registro{lista.length !== 1 ? "s" : ""} en el año
            </div>
          </div>
        </div>
        <button
          onClick={cargar}
          style={{
            background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 7, padding: "5px 14px", color: "#cbd5e1",
            fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="bi bi-arrow-clockwise" /> Actualizar
        </button>
      </div>

      {/* ── Contenido ── */}
      <div style={{
        padding: isMobile ? "12px" : "20px 24px",
        display: "flex", gap: isMobile ? 12 : 20,
        alignItems: "flex-start", flexWrap: "wrap",
      }}>

        {/* ── Calendario ── */}
        <div style={{
          flex: "1 1 280px", minWidth: 0, background: "#fff", borderRadius: 14,
          boxShadow: "0 2px 12px rgba(0,0,0,.07)", overflow: "hidden",
        }}>
          {/* Navegación de mes */}
          <div style={{
            background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
            padding: isMobile ? "10px 12px" : "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <button
              onClick={() => setMesActual(m => m.subtract(1, "month"))}
              style={{
                background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)",
                borderRadius: 7, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32,
                cursor: "pointer", color: "#fff", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 13 : 15,
              }}
            >
              <i className="bi bi-chevron-left" />
            </button>

            <div style={{ textAlign: "center" }}>
              <div style={{
                color: "#fff", fontWeight: 800, textTransform: "capitalize",
                fontSize: isMobile ? "0.9rem" : "1rem",
              }}>
                {mesActual.format("MMMM YYYY")}
              </div>
              {totalMes > 0 && (
                <div style={{ color: "rgba(255,255,255,.7)", fontSize: 10, marginTop: 1 }}>
                  🎂 {totalMes} cumpleaño{totalMes !== 1 ? "s" : ""} este mes
                </div>
              )}
            </div>

            <button
              onClick={() => setMesActual(m => m.add(1, "month"))}
              style={{
                background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)",
                borderRadius: 7, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32,
                cursor: "pointer", color: "#fff", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMobile ? 13 : 15,
              }}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>

          <div style={{ padding: isMobile ? "10px" : "14px" }}>
            {/* Encabezados de día */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
              {DIAS_SEM.map(d => (
                <div key={d} style={{
                  textAlign: "center", fontSize: isMobile ? 9 : 10, fontWeight: 700,
                  color: d === "Dom" ? "#ef4444" : C.muted, padding: "3px 0",
                }}>
                  {isMobile ? d.charAt(0) : d}
                </div>
              ))}
            </div>

            {/* Celdas */}
            {cargando ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: C.muted }}>
                <i className="bi bi-hourglass-split" style={{ fontSize: 20, display: "block", marginBottom: 8 }} />
                Cargando...
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: isMobile ? 2 : 3 }}>
                {celdas.map((dia, i) => {
                  const pacs   = pacsDelDia(mesActual, dia);
                  const tieneB = pacs.length > 0;
                  const esHoyD = esHoyFn(dia);
                  const esSelD = esSelFn(dia);
                  const esDom  = ((i % 7) === 0);

                  return (
                    <div
                      key={i}
                      onClick={() => tieneB && seleccionarDia(dia)}
                      style={{
                        aspectRatio: "1",
                        borderRadius: isMobile ? 7 : 9,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: 1,
                        cursor: tieneB ? "pointer" : "default",
                        background: esSelD
                          ? "linear-gradient(135deg,#7c3aed,#db2777)"
                          : esHoyD
                          ? "rgba(37,99,235,.08)"
                          : tieneB
                          ? "rgba(124,58,237,.05)"
                          : "transparent",
                        border: esHoyD && !esSelD
                          ? "2px solid rgba(37,99,235,.4)"
                          : "2px solid transparent",
                        transition: "all .15s",
                      }}
                      onMouseEnter={e => { if (tieneB && !esSelD) e.currentTarget.style.background = "rgba(124,58,237,.15)"; }}
                      onMouseLeave={e => { if (tieneB && !esSelD) e.currentTarget.style.background = esHoyD ? "rgba(37,99,235,.08)" : "rgba(124,58,237,.05)"; }}
                    >
                      {dia && (
                        <>
                          <span style={{
                            fontSize: isMobile ? 11 : 13,
                            fontWeight: esSelD || esHoyD ? 800 : tieneB ? 700 : 400,
                            color: esSelD ? "#fff" : esDom ? "#ef4444" : esHoyD ? "#2563eb" : C.text,
                            lineHeight: 1,
                          }}>
                            {dia}
                          </span>
                          {tieneB && (
                            <div style={{ display: "flex", gap: 1, justifyContent: "center" }}>
                              {pacs.slice(0, isMobile ? 1 : 3).map((_, pi) => (
                                <div key={pi} style={{
                                  width: isMobile ? 4 : 5, height: isMobile ? 4 : 5,
                                  borderRadius: "50%",
                                  background: esSelD ? "rgba(255,255,255,.9)" : "#7c3aed",
                                }} />
                              ))}
                              {pacs.length > (isMobile ? 1 : 3) && (
                                <span style={{ fontSize: 7, color: esSelD ? "#fff" : "#7c3aed", fontWeight: 700 }}>
                                  +{pacs.length - (isMobile ? 1 : 3)}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leyenda */}
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6",
              display: "flex", gap: 12, flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.muted }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed" }} />
                Cumpleaños
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.muted }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, border: "2px solid rgba(37,99,235,.4)", background: "rgba(37,99,235,.08)" }} />
                Hoy
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.muted }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "linear-gradient(135deg,#7c3aed,#db2777)" }} />
                Seleccionado
              </div>
            </div>
          </div>
        </div>

        {/* ── Panel lateral: Tarjetas del día ── */}
        <div ref={panelRef} style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {cargando ? null : pacanesDiaSelec.length === 0 ? (
            <div style={{
              background: "#fff", borderRadius: 16, padding: "40px 20px",
              textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18, margin: "0 auto 14px",
                background: "rgba(124,58,237,.06)", border: "1px solid rgba(124,58,237,.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <i className="bi bi-cake2" style={{ fontSize: 26, color: "#7c3aed" }} />
              </div>
              <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                Toca un día marcado con 🟣 para ver los cumpleañeros.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                background: "linear-gradient(135deg,#7c3aed,#db2777)",
                borderRadius: 12, padding: "10px 16px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 24 }}>🎂</span>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: "0.95rem" }}>
                    {mesSelec.date(diaSelec).format("D [de] MMMM")}
                    {mesSelec.date(diaSelec).isSame(hoy, "day") && (
                      <span style={{ marginLeft: 8, background: "rgba(255,255,255,.2)", borderRadius: 5, padding: "1px 7px", fontSize: 11 }}>
                        ¡Hoy!
                      </span>
                    )}
                  </div>
                  <div style={{ color: "rgba(255,255,255,.7)", fontSize: 11 }}>
                    {pacanesDiaSelec.length} paciente{pacanesDiaSelec.length !== 1 ? "s" : ""} de cumpleaños
                  </div>
                </div>
              </div>
              {pacanesDiaSelec.map(p => (
                <TarjetaGrande
                  key={p.id}
                  p={p}
                  esHoy={mesSelec.date(diaSelec).isSame(hoy, "day")}
                  onFelicitar={() => setModalPac(p)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Modal felicitación */}
      {modalPac && (
        <ModalFelicitar paciente={modalPac} onClose={() => setModalPac(null)} whatsappActivo={whatsappActivo} />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Tarjeta grande del paciente (panel lateral del calendario)               */
/* ──────────────────────────────────────────────────────────────────────── */
function TarjetaGrande({ p, esHoy, onFelicitar }) {
  const fotoSrc = fotoUrl(p.foto_perfil);

  const iniciales = `${p.nombres?.[0] || ""}${p.apellidos?.[0] || ""}`;

  return (
    <div style={{
      background: "#fff",
      border: esHoy ? "2px solid rgba(124,58,237,.35)" : "1px solid #e5e7eb",
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: esHoy
        ? "0 8px 32px rgba(124,58,237,.14)"
        : "0 2px 10px rgba(0,0,0,.06)",
    }}>
      {/* Banda superior con gradiente */}
      <div style={{
        background: esHoy
          ? "linear-gradient(135deg,#7c3aed 0%,#db2777 100%)"
          : "linear-gradient(135deg,#1e3a5f 0%,#243b72 100%)",
        padding: "22px 20px 70px",
        position: "relative",
      }}>
        {esHoy && (
          <div style={{
            position: "absolute", top: 12, right: 14,
            background: "rgba(255,255,255,.18)", borderRadius: 20,
            padding: "3px 10px", fontSize: 11, color: "#fff", fontWeight: 700,
          }}>
            🎉 ¡Cumple hoy!
          </div>
        )}
      </div>

      {/* Avatar centrado (superpuesto) */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        marginTop: -56, paddingBottom: 4,
        position: "relative", zIndex: 2,
      }}>
        {fotoSrc ? (
          <img src={fotoSrc} alt={p.nombres} style={{
            width: 96, height: 96, borderRadius: "50%", objectFit: "cover",
            border: "4px solid #fff",
            boxShadow: esHoy
              ? "0 0 0 3px #7c3aed, 0 6px 20px rgba(0,0,0,.25)"
              : "0 4px 18px rgba(0,0,0,.22)",
          }} />
        ) : (
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: esHoy
              ? "linear-gradient(135deg,#7c3aed,#db2777)"
              : "linear-gradient(135deg,#2563eb,#1e40af)",
            border: "4px solid #fff",
            boxShadow: "0 4px 18px rgba(0,0,0,.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 34,
          }}>
            {iniciales}
          </div>
        )}

        {/* Nombre */}
        <div style={{
          marginTop: 12, fontWeight: 800, fontSize: "1.1rem",
          color: C.text, textAlign: "center", padding: "0 16px",
          lineHeight: 1.25,
        }}>
          {p.nombres} {p.apellidos}
        </div>

        {/* Edad — grande y llamativa */}
        <div style={{
          marginTop: 14, marginBottom: 6,
          display: "flex", flexDirection: "column", alignItems: "center",
          background: esHoy
            ? "linear-gradient(135deg,rgba(124,58,237,.08),rgba(219,39,119,.08))"
            : "rgba(37,99,235,.05)",
          border: esHoy ? "1px solid rgba(124,58,237,.2)" : "1px solid rgba(37,99,235,.12)",
          borderRadius: 14, padding: "14px 28px", margin: "0 16px",
          width: "calc(100% - 32px)",
        }}>
          <span style={{
            fontSize: 56, fontWeight: 900, lineHeight: 1,
            background: esHoy
              ? "linear-gradient(135deg,#7c3aed,#db2777)"
              : "linear-gradient(135deg,#2563eb,#1e40af)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            {p.edad}
          </span>
          <span style={{
            fontSize: 14, fontWeight: 700, letterSpacing: ".08em",
            color: esHoy ? "#7c3aed" : "#2563eb", textTransform: "uppercase",
          }}>
            {p.edad === 1 ? "año" : "años"}
          </span>
          <span style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
            {dayjs(p.fecha_nacimiento).format("D [de] MMMM [de] YYYY")}
          </span>
        </div>
      </div>

      {/* Contacto */}
      <div style={{ padding: "10px 20px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {p.telefono && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted }}>
            <i className="bi bi-telephone-fill" style={{ color: "#25d366", fontSize: 13 }} />
            <span>{p.telefono}</span>
          </div>
        )}
        {p.email && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <i className="bi bi-envelope-fill" style={{ color: "#2563eb", fontSize: 13 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</span>
          </div>
        )}

        {/* Botón felicitar */}
        <button
          onClick={onFelicitar}
          style={{
            marginTop: 8, width: "100%",
            background: esHoy
              ? "linear-gradient(135deg,#7c3aed,#db2777)"
              : "rgba(37,99,235,.07)",
            border: esHoy ? "none" : "1px solid rgba(37,99,235,.2)",
            borderRadius: 10, padding: "10px 14px",
            color: esHoy ? "#fff" : "#2563eb",
            fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "opacity .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <i className="bi bi-send-fill" style={{ fontSize: 13 }} />
          {esHoy ? "🎂 Enviar felicitación" : "Preparar felicitación"}
        </button>
      </div>
    </div>
  );
}
