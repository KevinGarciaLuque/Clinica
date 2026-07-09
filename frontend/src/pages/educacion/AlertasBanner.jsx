import { ALERTA_COLOR, ALERTA_ICONO } from "./shared";

// Banner de alertas de seguridad/prioridad, reutilizado en la página completa
// y en el tab de Educación en Diabetes del perfil del paciente.
export default function AlertasBanner({ alertas }) {
  if (!alertas || alertas.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      {alertas.map((a, i) => {
        const col = ALERTA_COLOR[a.nivel];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: `${col}12`, border: `1px solid ${col}40`, color: col, fontSize: 13, fontWeight: 600 }}>
            <i className={`bi ${ALERTA_ICONO[a.nivel]}`} style={{ fontSize: 15, flexShrink: 0 }} />
            <span style={{ color: "#374151" }}>{a.texto}</span>
          </div>
        );
      })}
    </div>
  );
}
