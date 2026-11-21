/**
 * Página pública — Verificación de una solicitud de estudios por QR
 * URL: /ex/:codigo  (sin autenticación, solo lectura; no muestra resultados)
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/es";
dayjs.locale("es");

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ESTADO = {
  SOLICITADO: { label: "Pendiente", color: "#92400e", bg: "#fef3c7" },
  EN_PROCESO: { label: "En proceso", color: "#1d4ed8", bg: "#dbeafe" },
  COMPLETADO: { label: "Completado", color: "#15803d", bg: "#dcfce7" },
  CANCELADO: { label: "Cancelado", color: "#991b1b", bg: "#fee2e2" },
};
const TIPO_ICONO = { LABORATORIO: "🧪", IMAGEN: "🩻", IMAGENES: "🩻", RADIOLOGIA: "🩻", OTRO: "📋" };

export default function EstudiosPublica() {
  const { codigo } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/ex/${encodeURIComponent(codigo)}`)
      .then(async (r) => {
        const body = await r.json();
        if (r.ok && body.ok) setData(body.data);
        else if (r.status === 410) setError({ expirada: true, msg: body.msg });
        else if (r.status === 429) setError({ msg: "Demasiadas solicitudes. Espera unos minutos e intenta de nuevo." });
        else setError({ msg: body.msg || "Solicitud no encontrada" });
      })
      .catch(() => setError({ msg: "No se pudo conectar con el servidor" }))
      .finally(() => setCargando(false));
  }, [codigo]);

  if (cargando) return (
    <div style={S.centrado}>
      <div style={S.spinner} />
      <p style={{ marginTop: 16, color: "#6b7280", fontSize: "0.9rem" }}>Verificando solicitud…</p>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );

  if (error) return (
    <div style={S.centrado}>
      <div style={{ fontSize: "3rem", marginBottom: 12 }}>{error.expirada ? "⏰" : "❌"}</div>
      <h2 style={{ color: error.expirada ? "#92400e" : "#991b1b", margin: 0, fontSize: "1.1rem" }}>
        {error.expirada ? "Solicitud expirada" : "Solicitud no válida"}
      </h2>
      <p style={{ color: "#6b7280", fontSize: "0.87rem", marginTop: 8 }}>{error.msg}</p>
    </div>
  );

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.headerInner}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.55)", marginBottom: 2 }}>SOLICITUD DE ESTUDIOS</div>
            <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "#fff", overflowWrap: "anywhere" }}>{data.clinica}</div>
            {data.clinica_dir && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.65)", marginTop: 2 }}>{data.clinica_dir}</div>}
            {data.clinica_tel && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.65)" }}>Tel: {data.clinica_tel}</div>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.5)" }}>Solicitud N°</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#fff" }}>{String(data.numero).padStart(6, "0")}</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.55)", marginTop: 4 }}>{dayjs(data.creado_en).format("DD MMM YYYY")}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <span style={{
            background: data.cancelada ? "#fee2e2" : "#dcfce7", color: data.cancelada ? "#991b1b" : "#15803d",
            border: `1px solid ${data.cancelada ? "#fecaca" : "#86efac"}`, borderRadius: 20, padding: "5px 18px", fontSize: "0.82rem", fontWeight: 700,
          }}>
            {data.cancelada ? "Cancelada" : "✓ Válida"}
          </span>
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.label}>👤 PACIENTE</div>
            <div style={S.titulo}>{data.paciente}</div>
            {data.fecha_nac && <div style={S.sub}>F. Nac: {dayjs(data.fecha_nac).format("DD/MM/YYYY")} · {dayjs().diff(dayjs(data.fecha_nac), "year")} años</div>}
          </div>
          <div style={S.card}>
            <div style={S.label}>🩺 MÉDICO QUE SOLICITA</div>
            <div style={S.titulo}>{data.medico}</div>
            {data.especialidad && <div style={S.sub}>{data.especialidad}</div>}
            {data.colegiatura && <div style={{ ...S.sub, color: "#9ca3af" }}>Colegiatura: {data.colegiatura}</div>}
          </div>
        </div>

        <div style={{ ...S.label, fontSize: "0.8rem", color: "#374151", marginBottom: 10 }}>Estudios solicitados</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {data.estudios.map((e, i) => {
            const est = ESTADO[e.estado] || ESTADO.SOLICITADO;
            return (
              <div key={i} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700, letterSpacing: "0.05em" }}>
                      {TIPO_ICONO[e.tipo] || "📋"} {String(e.tipo || "").toUpperCase()}
                      {e.urgente && <span style={{ marginLeft: 8, color: "#dc2626" }}>⚠ URGENTE</span>}
                    </div>
                    <div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: "0.95rem", marginTop: 4, overflowWrap: "anywhere" }}>{e.descripcion}</div>
                  </div>
                  <span style={{ background: est.bg, color: est.color, borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>{est.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Emitida</div>
          <div style={{ fontWeight: 700, color: "#1e3a5f" }}>{dayjs(data.creado_en).format("DD [de] MMMM [de] YYYY [a las] HH:mm")}</div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: 16, fontSize: "0.72rem", color: "#9ca3af" }}>
        Documento generado digitalmente · {data.clinica}
      </div>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#f0f2f5", maxWidth: 560, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" },
  centrado: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, textAlign: "center" },
  spinner: { width: 36, height: 36, borderRadius: "50%", border: "3px solid #e5e7eb", borderTopColor: "#2563eb", animation: "spin 0.8s linear infinite" },
  header: { background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)", padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,.2)" },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, maxWidth: 512, margin: "0 auto" },
  // En pantallas angostas los datos del paciente y del médico se apilan
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 },
  card: { background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", border: "1px solid #e5e7eb" },
  label: { fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  titulo: { fontWeight: 700, fontSize: "0.9rem", color: "#111827" },
  sub: { fontSize: "0.76rem", color: "#6b7280", marginTop: 3 },
};
