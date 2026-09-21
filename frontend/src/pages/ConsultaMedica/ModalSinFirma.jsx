export default function ModalSinFirma({ onClose, onIrAPerfil }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(15,23,42,.6)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, maxWidth: 420, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1a2744,#243b72)", padding: "18px 22px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-pen-fill" style={{ color: "#fff", fontSize: "1.1rem" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.97rem" }}>Firma digital no configurada</div>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: "0.75rem", marginTop: 1 }}>Configura tu firma para usarla en consultas</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.12)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-x" style={{ fontSize: 16 }} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef9c3", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ color: "#d97706", fontSize: "1.2rem" }} />
            </div>
            <p style={{ margin: 0, fontSize: "0.87rem", color: "#374151", lineHeight: 1.6 }}>
              Aún no tienes una firma digital guardada en tu perfil. <br />
              Puedes <strong>dibujarla</strong> o <strong>subir una imagen</strong> desde la sección <em>Mi Perfil</em>.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              Cancelar
            </button>
            <button onClick={onIrAPerfil}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1a2744,#243b72)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 7 }}>
              <i className="bi bi-person-badge-fill" /> Ir a Mi Perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
