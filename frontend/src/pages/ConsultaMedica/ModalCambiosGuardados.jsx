import { FaCheckCircle } from "react-icons/fa";

export default function ModalCambiosGuardados({ onClose }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10001,
      background: "rgba(15,23,42,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      backdropFilter: "blur(2px)",
    }}>
      <style>{`
        @keyframes successPop {
          0% { transform: scale(.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkPulse {
          0% { transform: scale(.6); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .saved-modal-pop { animation: successPop .25s ease-out; }
        .saved-check-pop { animation: checkPulse .45s ease-out; }
      `}</style>

      <div className="saved-modal-pop" style={{
        width: "100%",
        maxWidth: 430,
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #dcfce7",
        boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        padding: "22px 18px 16px",
        textAlign: "center",
      }}>
        <div className="saved-check-pop" style={{ marginBottom: 10 }}>
          <FaCheckCircle size={60} color="#16a34a" />
        </div>
        <div style={{ fontWeight: 800, color: "#166534", fontSize: "1.05rem", marginBottom: 6 }}>
          Cambios guardados correctamente
        </div>
        <div style={{ color: "#4b5563", fontSize: "0.9rem", marginBottom: 14 }}>
          La historia clínica firmada fue actualizada.
        </div>
        <button className="btn btn-success btn-sm" onClick={onClose}>
          Aceptar
        </button>
      </div>
    </div>
  );
}
