/**
 * Página pública — Verificación de receta por QR
 * URL: /rx/:codigo  (sin autenticación)
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/es";
dayjs.locale("es");

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ESTADO_META = {
  ACTIVA:    { color: "#15803d", bg: "#dcfce7", border: "#86efac", label: "✓ Válida" },
  ENTREGADA: { color: "#92400e", bg: "#fef3c7", border: "#fde68a", label: "Dispensada" },
  CANCELADA: { color: "#991b1b", bg: "#fee2e2", border: "#fecaca", label: "Cancelada" },
};

export default function RecetaPublica() {
  const { codigo } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/rx/${codigo}`)
      .then(async r => {
        const body = await r.json();
        if (r.ok && body.ok) setData(body.data);
        else if (r.status === 410) setError({ expired: true, msg: body.msg });
        else if (r.status === 429) setError({ msg: "Demasiadas solicitudes. Espera unos minutos e intenta de nuevo." });
        else setError({ msg: body.msg || "Receta no encontrada" });
      })
      .catch(() => setError({ msg: "No se pudo conectar con el servidor" }))
      .finally(() => setCargando(false));
  }, [codigo]);

  if (cargando) return (
    <div style={styles.centrado}>
      <div style={styles.spinner}></div>
      <p style={{ marginTop: 16, color: "#6b7280", fontSize: "0.9rem" }}>Verificando receta…</p>
    </div>
  );

  if (error) return (
    <div style={styles.centrado}>
      <div style={{ fontSize: "3rem", marginBottom: 12 }}>{error.expired ? "⏰" : "❌"}</div>
      <h2 style={{ color: error.expired ? "#92400e" : "#991b1b", margin: 0, fontSize: "1.1rem" }}>
        {error.expired ? "Receta expirada" : "Receta no válida"}
      </h2>
      <p style={{ color: "#6b7280", fontSize: "0.87rem", marginTop: 8 }}>{error.msg}</p>
    </div>
  );

  const est = ESTADO_META[data.estado] || ESTADO_META.ACTIVA;

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.55)", marginBottom: 2 }}>SISTEMA DE GESTIÓN CLÍNICA</div>
            <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "#fff" }}>{data.clinica}</div>
            {data.clinica_dir && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.65)", marginTop: 2 }}>{data.clinica_dir}</div>}
            {data.clinica_tel && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.65)" }}>Tel: {data.clinica_tel}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.5)" }}>Receta N°</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#fff" }}>{String(data.id).padStart(6, "0")}</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.55)", marginTop: 4 }}>
              {dayjs(data.creado_en).format("DD MMM YYYY")}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.body}>

        {/* Badge de estado */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <span style={{
            background: est.bg, color: est.color,
            border: `1px solid ${est.border}`,
            borderRadius: 20, padding: "5px 18px",
            fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em",
          }}>
            {est.label}
          </span>
        </div>

        {/* Paciente y Médico */}
        <div style={styles.grid2}>
          <div style={styles.card}>
            <div style={styles.cardLabel}>
              <i style={{ marginRight: 6 }}>👤</i>PACIENTE
            </div>
            <div style={styles.cardTitle}>{data.paciente}</div>
            {data.fecha_nac && (
              <div style={styles.cardSub}>
                F. Nac: {dayjs(data.fecha_nac).format("DD/MM/YYYY")}
                {" · "}
                {dayjs().diff(dayjs(data.fecha_nac), "year")} años
              </div>
            )}
          </div>
          <div style={styles.card}>
            <div style={styles.cardLabel}>
              <i style={{ marginRight: 6 }}>🩺</i>MÉDICO PRESCRIPTOR
            </div>
            <div style={styles.cardTitle}>{data.medico}</div>
            {data.especialidad && <div style={styles.cardSub}>{data.especialidad}</div>}
            {data.colegiatura && <div style={{ ...styles.cardSub, color: "#9ca3af" }}>Colegiatura: {data.colegiatura}</div>}
          </div>
        </div>

        {/* Medicamentos */}
        <div style={{ marginBottom: 20 }}>
          <div style={styles.sectionTitle}>
            <span style={{ marginRight: 8 }}>💊</span>Medicamentos Prescritos
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.items.map((item, i) => (
              <div key={i} style={styles.medCard}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: "0.95rem" }}>
                      {item.medicamento}
                    </div>
                    {item.presentacion && (
                      <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: 2 }}>
                        {item.presentacion}
                        {item.via_administracion && ` · ${item.via_administracion}`}
                      </div>
                    )}
                  </div>
                  <span style={styles.numBadge}>{i + 1}</span>
                </div>
                <div style={styles.pillRow}>
                  {item.dosis && <span style={styles.pill}>💉 {item.dosis}</span>}
                  {item.duracion && <span style={styles.pill}>📅 {item.duracion}</span>}
                  {item.cantidad && <span style={styles.pill}>📦 {item.cantidad}</span>}
                </div>
                {item.instrucciones && (
                  <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#374151", background: "#f8faff", borderRadius: 6, padding: "6px 10px", borderLeft: "3px solid #3b82f6" }}>
                    {item.instrucciones}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        {data.notas && (
          <div style={{ marginBottom: 20 }}>
            <div style={styles.sectionTitle}><span style={{ marginRight: 8 }}>📝</span>Indicaciones adicionales</div>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", fontSize: "0.87rem", color: "#78350f", fontStyle: "italic" }}>
              {data.notas}
            </div>
          </div>
        )}

        {/* Código de verificación */}
        <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Código de verificación</div>
          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.05rem", color: "#1e3a5f", letterSpacing: "0.12em" }}>{codigo}</div>
          <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 4 }}>
            Emitida el {dayjs(data.creado_en).format("DD [de] MMMM [de] YYYY [a las] HH:mm")}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px", fontSize: "0.72rem", color: "#9ca3af" }}>
        Documento generado digitalmente · {data.clinica} · Válido 30 días desde emisión
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "#f0f2f5",
    maxWidth: 560,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  centrado: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    minHeight: "100vh", padding: 24, textAlign: "center",
  },
  spinner: {
    width: 36, height: 36, borderRadius: "50%",
    border: "3px solid #e5e7eb",
    borderTopColor: "#2563eb",
    animation: "spin 0.8s linear infinite",
  },
  header: {
    background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
    padding: "20px 24px",
    boxShadow: "0 2px 12px rgba(0,0,0,.2)",
  },
  headerInner: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    maxWidth: 512, margin: "0 auto",
  },
  body: {
    padding: "20px 16px",
  },
  grid2: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20,
  },
  card: {
    background: "#fff", borderRadius: 12, padding: "14px 16px",
    boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e5e7eb",
  },
  cardLabel: {
    fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
  },
  cardTitle: {
    fontWeight: 700, fontSize: "0.9rem", color: "#111827",
  },
  cardSub: {
    fontSize: "0.76rem", color: "#6b7280", marginTop: 3,
  },
  sectionTitle: {
    fontWeight: 700, fontSize: "0.8rem", color: "#374151",
    textTransform: "uppercase", letterSpacing: "0.05em",
    marginBottom: 10,
  },
  medCard: {
    background: "#fff", borderRadius: 12, padding: "14px 16px",
    boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e5e7eb",
  },
  pillRow: {
    display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8,
  },
  pill: {
    background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
    borderRadius: 20, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600,
  },
  numBadge: {
    width: 24, height: 24, borderRadius: "50%",
    background: "#1a2744", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.72rem", fontWeight: 700, flexShrink: 0,
  },
};
