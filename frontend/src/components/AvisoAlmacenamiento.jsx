import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";

const CLAVE_OCULTO = "aviso_almacenamiento_oculto";
const PUEDE_SOLICITAR = ["ADMIN", "MEDICO", "PSICOLOGO"];

/** Aviso cuando la clínica usa el 80% o más de su espacio de almacenamiento */
export default function AvisoAlmacenamiento() {
  const { user } = useAuth();
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    if (!user || user.tipo === "SUPER_ADMIN") return undefined;
    let vivo = true;
    api.get("/clinicas/almacenamiento/estado").then((r) => {
      const d = r.data?.data;
      if (!vivo || !d || d.uso_pct < 80) return;
      const marca = `${d.lleno ? "lleno" : "80"}|${new Date().toDateString()}`;
      try { if (localStorage.getItem(CLAVE_OCULTO) === marca) return; } catch { /* sin almacenamiento */ }
      setEstado({ ...d, marca });
    }).catch(() => {});
    return () => { vivo = false; };
  }, [user]);

  if (!estado) return null;
  const cerrar = () => {
    try { localStorage.setItem(CLAVE_OCULTO, estado.marca); } catch { /* sin almacenamiento */ }
    setEstado(null);
  };
  const pct = Math.min(Math.round(estado.uso_pct), 100);

  return (
    <div className={`alert ${estado.lleno ? "alert-danger" : "alert-warning"} d-flex align-items-start gap-2 py-2 px-3 mb-3 small`} role="alert" style={{ borderRadius: 12 }}>
      <i className={`bi ${estado.lleno ? "bi-hdd-fill" : "bi-hdd"} fs-5 flex-shrink-0`} />
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <strong>
          {estado.lleno
            ? "Su clínica llegó al límite de su espacio: ya no se pueden subir archivos nuevos."
            : `Su clínica ya usa el ${pct}% de su espacio de almacenamiento.`}
        </strong>{" "}
        {estado.espacio_legible} de {estado.cuota_legible}.
        <span className="d-block">
          {estado.lleno ? "Todo lo guardado sigue disponible. " : "Al llenarse no se podrán subir más documentos ni fotos. "}
          {PUEDE_SOLICITAR.includes(user?.tipo)
            ? <Link to="/admin/config?tab=almacenamiento" className="fw-semibold">Solicitar más espacio</Link>
            : "Avise al administrador de la clínica."}
        </span>
      </div>
      <button type="button" className="btn-close flex-shrink-0" aria-label="Cerrar" onClick={cerrar} />
    </div>
  );
}
