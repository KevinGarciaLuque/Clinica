// 📲 "Instalar app": opción del menú de usuario y ventana con los pasos.
// En Chrome/Edge (Android y computadora) abre el diálogo de instalación del navegador;
// en iPhone/iPad explica cómo agregarla a la pantalla de inicio desde Safari.
import { useState } from "react";
import { createPortal } from "react-dom";
import { esIOS, instalar } from "../utils/instalarApp";

const PASO = { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 };
const NUM = {
  width: 26, height: 26, borderRadius: "50%", background: "#eff6ff", color: "#2563eb",
  fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};

export function ModalInstalarApp({ onClose }) {
  const ios = esIOS();
  const [estado, setEstado] = useState(ios ? "ios" : "listo"); // listo | instalando | instalada | cancelada | ios

  const iniciar = async () => {
    setEstado("instalando");
    const r = await instalar();
    setEstado(r === "instalada" ? "instalada" : r === "ios" ? "ios" : "cancelada");
  };

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div role="dialog" aria-label="Instalar Medic-KG" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", color: "#1e293b" }}>
        <div style={{ background: "linear-gradient(135deg,#0d1b2e,#1e3a8a)", color: "#fff", padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/icons/icon-192.png" alt="" style={{ width: 52, height: 52, borderRadius: 13, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Instalar Medic-KG</div>
            <div style={{ fontSize: "0.8rem", opacity: .8 }}>Ábrela con un toque, como cualquier app</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: "#fff", fontSize: 20 }}><i className="bi bi-x-lg" /></button>
        </div>

        <div style={{ padding: 20, fontSize: "0.9rem" }}>
          {estado === "ios" && (
            <>
              <p style={{ marginTop: 0, color: "#475569" }}>En iPhone o iPad, desde <strong>Safari</strong>:</p>
              <div style={PASO}><span style={NUM}>1</span><span>Toca el botón <strong>Compartir</strong> <i className="bi bi-box-arrow-up" style={{ color: "#2563eb" }} /> (abajo en iPhone, arriba en iPad).</span></div>
              <div style={PASO}><span style={NUM}>2</span><span>Elige <strong>“Agregar a inicio”</strong> <i className="bi bi-plus-square" /></span></div>
              <div style={PASO}><span style={NUM}>3</span><span>Toca <strong>Agregar</strong>. El ícono de Medic-KG aparecerá en tu pantalla de inicio.</span></div>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>Si usas Chrome en iPhone, abre medickg.com en Safari para instalarla.</p>
            </>
          )}

          {(estado === "listo" || estado === "instalando") && (
            <>
              <ul style={{ paddingLeft: 18, color: "#475569", marginTop: 0 }}>
                <li>Ícono propio en el celular o en la computadora.</li>
                <li>Se abre en pantalla completa, sin barra del navegador.</li>
                <li>Accesos directos a Citas, Pacientes y Sala de espera.</li>
              </ul>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Es la misma cuenta y la misma información: no ocupa casi espacio y se actualiza sola.</p>
              <button className="btn btn-primary w-100 fw-semibold" onClick={iniciar} disabled={estado === "instalando"}>
                {estado === "instalando" ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-download me-2" />}
                Instalar ahora
              </button>
            </>
          )}

          {estado === "instalada" && (
            <div className="text-center py-2">
              <i className="bi bi-check-circle-fill" style={{ fontSize: 44, color: "#16a34a" }} />
              <p className="fw-semibold mt-2 mb-1">¡Listo! Medic-KG quedó instalada.</p>
              <p className="text-muted small mb-0">Búscala en tu pantalla de inicio o en tus aplicaciones.</p>
            </div>
          )}

          {estado === "cancelada" && (
            <div className="text-center py-2">
              <p className="mb-1">No se instaló.</p>
              <p className="text-muted small mb-0">Puedes hacerlo cuando quieras desde el menú del navegador: <strong>“Instalar Medic-KG”</strong> o <strong>“Agregar a pantalla de inicio”</strong>.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
