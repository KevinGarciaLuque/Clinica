export default function ModalHistoriaFirmada({ paciente, onClose, onVerHistorial }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(15,23,42,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(3px)",
    }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(.86); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        .signed-modal {
          animation: popIn .28s ease-out;
        }
        .signed-check {
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
          animation: checkDraw .5s ease-out .15s forwards;
        }
      `}</style>

      <div className="signed-modal" style={{
        width: "100%",
        maxWidth: 460,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #dcfce7",
        boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "22px 22px 16px", textAlign: "center" }}>
          <div style={{
            width: 76,
            height: 76,
            margin: "0 auto 14px",
            borderRadius: "50%",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 22px rgba(34,197,94,.35)",
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path className="signed-check" d="M5 12.5L10 17L19 8.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#166534", marginBottom: 6 }}>
            Historia firmada
          </div>
          <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>
            La consulta de <strong>{paciente?.nombres} {paciente?.apellidos}</strong> se guardó correctamente.
          </div>
        </div>

        <div style={{
          padding: "14px 16px 18px",
          borderTop: "1px solid #ecfdf5",
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn-success btn-sm" onClick={onVerHistorial}>
            <i className="bi bi-journal-medical me-1"></i>Ver historial clínico
          </button>
        </div>
      </div>
    </div>
  );
}
