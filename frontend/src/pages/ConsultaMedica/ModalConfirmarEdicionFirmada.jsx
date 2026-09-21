export default function ModalConfirmarEdicionFirmada({ onCancel, onConfirm, saving }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "rgba(15,23,42,.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 500,
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #fde68a",
        boxShadow: "0 16px 48px rgba(0,0,0,.22)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 18px",
          background: "#fffbeb",
          borderBottom: "1px solid #fde68a",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontWeight: 700,
          color: "#92400e",
        }}>
          <i className="bi bi-exclamation-triangle-fill"></i>
          Confirmar cambios en historia firmada
        </div>
        <div style={{ padding: "16px 18px", color: "#374151", fontSize: "0.92rem" }}>
          Vas a modificar una historia clínica ya firmada. Esta acción actualizará el contenido clínico registrado.
          ¿Deseas continuar?
        </div>
        <div style={{
          padding: "0 18px 16px",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}>
          <button className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary btn-sm" onClick={onConfirm} disabled={saving}>
            <i className="bi bi-save2 me-1"></i>{saving ? "Guardando..." : "Sí, guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
