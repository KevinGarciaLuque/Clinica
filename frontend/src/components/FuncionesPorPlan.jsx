import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Sección "Todo lo que tu clínica necesita" con selector de plan.
// Las funciones salen de la misma lista que se edita para cada plan en el
// panel de administración, así esta sección y la de precios siempre coinciden.

// Icono según palabras clave del texto de la función (el primero que coincida)
const ICONOS = [
  [/usuario|rol(es)?\b/, "bi-people-fill"],
  [/paciente|expediente/, "bi-person-vcard-fill"],
  [/recordatorio/, "bi-bell-fill"],
  [/felicitacion|cumplea/, "bi-gift-fill"],
  [/agenda|\bcitas?\b|calendario|sala de espera/, "bi-calendar2-check-fill"],
  [/historia|consulta|soap|cie-?10/, "bi-file-medical-fill"],
  [/receta|prescrip/, "bi-capsule-pill"],
  [/estudio|laboratorio/, "bi-clipboard2-pulse-fill"],
  [/documento|constancia|incapacidad|referencia|firma/, "bi-file-earmark-text-fill"],
  [/vacuna|crecimiento|pediatr/, "bi-balloon-heart-fill"],
  [/dashboard|estadistica/, "bi-speedometer2"],
  [/reporte/, "bi-graph-up-arrow"],
  [/redes sociales|perfil/, "bi-share-fill"],
  [/almacenamiento|\bgb\b|nube/, "bi-cloud-check-fill"],
  [/soporte|capacitacion|asistencia/, "bi-headset"],
  [/especialidad|modulo/, "bi-grid-3x3-gap-fill"],
  [/portal|online|en linea/, "bi-globe2"],
  [/seguridad|cifrado|auditoria/, "bi-shield-lock-fill"],
  [/whatsapp/, "bi-whatsapp"],
];

function iconoPara(texto) {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return ICONOS.find(([re]) => re.test(t))?.[1] || "bi-check2-circle";
}

const CSS = `
  .fpp-tabs { display: inline-flex; gap: 4px; padding: 5px; border-radius: 16px; background: #fff;
    border: 1px solid #e2e8f0; box-shadow: 0 6px 24px rgba(15,23,42,.06); flex-wrap: wrap; justify-content: center; }
  .fpp-tab { position: relative; border: none; background: none; padding: 10px 20px; border-radius: 12px;
    font-weight: 700; font-size: 14px; color: #475569; cursor: pointer; transition: color .2s ease; }
  .fpp-tab:hover { color: #0f172a; }
  .fpp-tab.is-active { color: #fff; }
  .fpp-tab:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
  .fpp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
  .fpp-card { display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 16px; padding: 18px;
    border: 1px solid #e2e8f0; box-shadow: 0 2px 12px rgba(15,23,42,.04);
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
  .fpp-card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--c) 35%, #e2e8f0);
    box-shadow: 0 14px 32px color-mix(in srgb, var(--c) 16%, transparent); }
  .fpp-ico { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--c) 10%, #fff); border: 1px solid color-mix(in srgb, var(--c) 22%, transparent);
    transition: background .2s ease, transform .2s ease; }
  .fpp-ico i { font-size: 20px; color: var(--c); transition: color .2s ease; }
  .fpp-card:hover .fpp-ico { background: var(--c); transform: rotate(-6deg) scale(1.06); }
  .fpp-card:hover .fpp-ico i { color: #fff; }
  .fpp-txt { font-weight: 600; font-size: 14px; color: #0f172a; line-height: 1.45; }
  @media (max-width: 640px) {
    .fpp-tab { padding: 9px 14px; font-size: 13.5px; }
    .fpp-grid { grid-template-columns: 1fr; gap: 10px; }
    .fpp-card { padding: 14px 16px; }
  }
  @media (prefers-reduced-motion: reduce) { .fpp-card, .fpp-ico, .fpp-ico i { transition: none; } }
`;

export default function FuncionesPorPlan({ planes, onVerPrecio }) {
  const conFunciones = planes.filter(p => p.features?.length);
  // Empieza en el plan más completo (el último con funciones)
  const [activoId, setActivoId] = useState(() => conFunciones[conFunciones.length - 1]?.id);
  const plan = conFunciones.find(p => p.id === activoId) || conFunciones[conFunciones.length - 1];
  if (!plan) return null;
  const c = plan.color;

  return (
    <div style={{ "--c": c }}>
      <style>{CSS}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 34 }}>
        <div className="fpp-tabs" role="tablist" aria-label="Elegir plan">
          {conFunciones.map(p => {
            const activo = p.id === plan.id;
            return (
              <button key={p.id} type="button" role="tab" aria-selected={activo}
                className={`fpp-tab${activo ? " is-active" : ""}`}
                style={{ "--c": p.color }}
                onClick={() => setActivoId(p.id)}>
                {activo && (
                  <motion.span layoutId="fpp-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{ position: "absolute", inset: 0, borderRadius: 12, background: p.color, zIndex: 0 }} />
                )}
                <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <i className={`bi ${p.icon}`} />{p.label}
                  {p.badge && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", padding: "2px 7px", borderRadius: 999,
                      background: activo ? "rgba(255,255,255,.22)" : `color-mix(in srgb, ${p.color} 12%, #fff)`,
                      color: activo ? "#fff" : p.color,
                    }}>{p.badge}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={plan.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: .2 }} style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>
            <strong style={{ color: c, fontSize: 16 }}>{plan.features.length}</strong> funciones incluidas en el plan{" "}
            <strong style={{ color: "#0f172a" }}>{plan.label}</strong>
            {plan.subtitulo && <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{plan.subtitulo}</div>}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={plan.id} className="fpp-grid" role="tabpanel" aria-label={`Funciones del plan ${plan.label}`}
          initial="oculto" animate="visible" exit="salida"
          variants={{
            oculto: {},
            visible: { transition: { staggerChildren: 0.035 } },
            salida: { opacity: 0, transition: { duration: .15 } },
          }}>
          {plan.features.map((f, i) => (
            <motion.div key={`${plan.id}-${i}`} className="fpp-card"
              variants={{ oculto: { opacity: 0, y: 14, scale: .97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: .3, ease: "easeOut" } } }}>
              <div className="fpp-ico"><i className={`bi ${iconoPara(f)}`} /></div>
              <div className="fpp-txt">{f}</div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      <div style={{ textAlign: "center", marginTop: 34 }}>
        <button type="button" onClick={() => onVerPrecio?.(plan.id)}
          style={{
            background: c, color: "#fff", border: "none", borderRadius: 14, padding: "13px 28px", fontSize: 15, fontWeight: 700,
            cursor: "pointer", boxShadow: `0 10px 26px color-mix(in srgb, ${c} 35%, transparent)`,
            display: "inline-flex", alignItems: "center", gap: 8, transition: "transform .2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
          Ver precio del plan {plan.label} <i className="bi bi-arrow-right" />
        </button>
      </div>
    </div>
  );
}
