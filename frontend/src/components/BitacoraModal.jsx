import { useEffect, useState, useCallback } from "react";
import api from "../api/api";

const C = {
  bg:      "#0d1b2e",
  surface: "#112240",
  card:    "#162a45",
  border:  "rgba(255,255,255,0.07)",
  accent:  "#2196f3",
  success: "#10b981",
  warning: "#f59e0b",
  danger:  "#ef4444",
  text:    "#e2e8f0",
  muted:   "#94a3b8",
};

const TIPOS = ["", "ADMIN", "MEDICO", "ENFERMERA", "RECEPCIONISTA"];
const TIPO_COLOR = {
  ADMIN: C.accent, MEDICO: C.success,
  ENFERMERA: "#f59e0b", RECEPCIONISTA: "#06b6d4",
  SUPER_ADMIN: "#ef4444",
};

function BadgeTipo({ tipo }) {
  const col = TIPO_COLOR[tipo] || C.muted;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: col,
      background: `${col}18`, border: `1px solid ${col}35`,
      borderRadius: 20, padding: "2px 8px",
    }}>
      {tipo}
    </span>
  );
}

function BadgeExito({ exito }) {
  return exito ? (
    <span style={{
      fontSize: 10, fontWeight: 700, color: C.success,
      background: `${C.success}18`, border: `1px solid ${C.success}35`,
      borderRadius: 20, padding: "2px 8px",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <i className="bi bi-check-circle-fill" style={{ fontSize: 9 }} /> Exitoso
    </span>
  ) : (
    <span style={{
      fontSize: 10, fontWeight: 700, color: C.danger,
      background: `${C.danger}18`, border: `1px solid ${C.danger}35`,
      borderRadius: 20, padding: "2px 8px",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <i className="bi bi-x-circle-fill" style={{ fontSize: 9 }} /> Fallido
    </span>
  );
}

function formatFecha(raw) {
  if (!raw) return "—";
  const d = new Date(raw);
  return d.toLocaleString("es", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function BitacoraModal({ clinicaId, clinicaNombre, onClose }) {
  const [registros, setRegistros] = useState([]);
  const [paginacion, setPaginacion] = useState({ total: 0, pagina: 1, limite: 50, paginas: 1 });
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState("");

  // Filtros
  const [busqueda, setBusqueda]   = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroExito, setFiltroExito] = useState("");
  const [pagina, setPagina]       = useState(1);

  const cargar = useCallback(async (pag = 1) => {
    if (!clinicaId) return;
    setCargando(true);
    setError("");
    try {
      const params = { pagina: pag, limite: 50 };
      if (filtroTipo)   params.tipo    = filtroTipo;
      if (filtroExito !== "") params.exito = filtroExito;
      if (busqueda)     params.busqueda = busqueda;

      const r = await api.get(`/clinicas/${clinicaId}/bitacora`, { params });
      setRegistros(r.data.data);
      setPaginacion(r.data.paginacion);
      setPagina(pag);
    } catch (e) {
      setError(e.response?.data?.msg || e.message);
    } finally {
      setCargando(false);
    }
  }, [clinicaId, filtroTipo, filtroExito, busqueda]);

  useEffect(() => { cargar(1); }, [cargar]);

  const handleBuscar = (e) => {
    e.preventDefault();
    cargar(1);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,.78)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        width: "100%", maxWidth: 900,
        maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 100px rgba(0,0,0,.65)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "20px 28px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: 14,
          background: "linear-gradient(135deg, #1a0f2e 0%, #2a1a3c 100%)",
          flexShrink: 0,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(139,92,246,.4)",
          }}>
            <i className="bi bi-journal-text" style={{ color: "#fff", fontSize: 19 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h5 style={{ margin: 0, fontWeight: 700, color: C.text, fontSize: 16 }}>
              Bitácora de accesos
            </h5>
            <span style={{
              fontSize: 13, color: C.muted,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              display: "block",
            }}>
              {clinicaNombre} · {paginacion.total} registros
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
              borderRadius: 8, width: 34, height: 34,
              color: C.muted, cursor: "pointer", fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* ── Filtros ── */}
        <form
          onSubmit={handleBuscar}
          style={{
            padding: "14px 28px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex", gap: 10, flexWrap: "wrap",
            flexShrink: 0, background: C.bg,
          }}
        >
          <input
            placeholder="Buscar por nombre o email..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              flex: "1 1 200px", padding: "7px 12px", borderRadius: 8, fontSize: 13,
              background: C.card, border: `1px solid ${C.border}`, color: C.text,
              outline: "none",
            }}
          />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{
              padding: "7px 10px", borderRadius: 8, fontSize: 13,
              background: C.card, border: `1px solid ${C.border}`, color: C.text,
              cursor: "pointer",
            }}
          >
            <option value="">Todos los tipos</option>
            {TIPOS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filtroExito}
            onChange={(e) => setFiltroExito(e.target.value)}
            style={{
              padding: "7px 10px", borderRadius: 8, fontSize: 13,
              background: C.card, border: `1px solid ${C.border}`, color: C.text,
              cursor: "pointer",
            }}
          >
            <option value="">Todos</option>
            <option value="1">Exitosos</option>
            <option value="0">Fallidos</option>
          </select>
          <button
            type="submit"
            style={{
              padding: "7px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer",
              background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
              border: "none", color: "#fff", fontWeight: 600,
            }}
          >
            <i className="bi bi-search me-2" />
            Buscar
          </button>
        </form>

        {/* ── Tabla ── */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {cargando && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{
                width: 36, height: 36, border: `3px solid ${C.border}`,
                borderTopColor: "#8b5cf6", borderRadius: "50%",
                animation: "spin .8s linear infinite", margin: "0 auto 12px",
              }} />
              <span style={{ color: C.muted, fontSize: 14 }}>Cargando bitácora...</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {error && !cargando && (
            <div style={{
              margin: "20px 28px",
              background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)",
              borderRadius: 10, padding: "12px 16px", color: "#f87171",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <i className="bi bi-exclamation-triangle-fill" /> {error}
            </div>
          )}

          {!cargando && !error && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, position: "sticky", top: 0, zIndex: 1 }}>
                  {["Fecha / Hora", "Usuario", "Tipo", "Estado", "IP"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 14px", textAlign: "left",
                      fontSize: 11, fontWeight: 600, color: C.muted,
                      textTransform: "uppercase", letterSpacing: ".05em",
                      borderBottom: `1px solid ${C.border}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      transition: "background .15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,.03)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 14px", color: C.muted, whiteSpace: "nowrap" }}>
                      <i className="bi bi-clock me-1" style={{ color: "#8b5cf6", fontSize: 11 }} />
                      {formatFecha(r.creado_en)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 600, color: C.text }}>
                        {r.nombres} {r.apellidos}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{r.email}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <BadgeTipo tipo={r.tipo} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <BadgeExito exito={!!r.exito} />
                    </td>
                    <td style={{ padding: "10px 14px", color: C.muted, fontFamily: "monospace", fontSize: 12 }}>
                      {r.ip || "—"}
                    </td>
                  </tr>
                ))}
                {!registros.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px 0", textAlign: "center", color: C.muted }}>
                      <i className="bi bi-journal-x" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
                      Sin registros en la bitácora
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Paginación / Footer ── */}
        <div style={{
          padding: "12px 28px", borderTop: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            Página {paginacion.pagina} de {paginacion.paginas} · {paginacion.total} registros totales
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={pagina <= 1 || cargando}
              onClick={() => cargar(pagina - 1)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: pagina <= 1 ? "rgba(255,255,255,.03)" : C.card,
                border: `1px solid ${C.border}`, color: pagina <= 1 ? C.muted : C.text,
              }}
            >
              <i className="bi bi-chevron-left" />
            </button>
            <button
              disabled={pagina >= paginacion.paginas || cargando}
              onClick={() => cargar(pagina + 1)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: pagina >= paginacion.paginas ? "rgba(255,255,255,.03)" : C.card,
                border: `1px solid ${C.border}`, color: pagina >= paginacion.paginas ? C.muted : C.text,
              }}
            >
              <i className="bi bi-chevron-right" />
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "6px 18px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: "rgba(255,255,255,.06)", border: `1px solid ${C.border}`,
                color: C.muted, fontWeight: 600,
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
