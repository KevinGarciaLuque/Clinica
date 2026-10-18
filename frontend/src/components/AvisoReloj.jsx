import { useEffect, useState } from "react";
import { cargarZonaClinica, horaEnZona, offsetZona } from "../utils/zonaClinica";
import { useAuth } from "../auth/AuthContext";

const CLAVE_OCULTO = "aviso_reloj_oculto";

/**
 * Aviso si la hora del equipo (computadora o celular) no coincide con la de la
 * clínica: reloj adelantado/atrasado o zona horaria distinta. El sistema ya usa
 * la hora de la clínica, pero el aviso evita confusiones al leer horas.
 */
export default function AvisoReloj() {
  const [aviso, setAviso] = useState(null);
  const { user } = useAuth();
  const esSuper = user?.tipo === "SUPER_ADMIN"; // no pertenece a una clínica: el aviso no aplica

  useEffect(() => {
    if (esSuper) return undefined;
    let vivo = true;
    cargarZonaClinica().then((r) => {
      if (!vivo || !r?.timezone) return;
      const offClinica = offsetZona(r.timezone);
      const offEquipo = -new Date().getTimezoneOffset();
      const minDesfase = Math.round(r.desfaseMs / 60000);
      let tipo = null;
      if (Math.abs(minDesfase) >= 3) tipo = "reloj";
      else if (offClinica != null && offClinica !== offEquipo) tipo = "zona";
      if (!tipo) return;
      const marca = `${r.timezone}|${tipo}|${new Date().toDateString()}`;
      try { if (localStorage.getItem(CLAVE_OCULTO) === marca) return; } catch { /* sin almacenamiento */ }
      setAviso({ tipo, tz: r.timezone, minDesfase, marca });
    });
    return () => { vivo = false; };
  }, [esSuper]);

  if (!aviso) return null;

  const cerrar = () => {
    try { localStorage.setItem(CLAVE_OCULTO, aviso.marca); } catch { /* sin almacenamiento */ }
    setAviso(null);
  };

  const horaEquipo = new Date().toLocaleTimeString("es-HN", { hour: "numeric", minute: "2-digit" });
  const texto = aviso.tipo === "reloj"
    ? `La hora de este equipo está ${aviso.minDesfase > 0 ? "atrasada" : "adelantada"} unos ${Math.abs(aviso.minDesfase)} minutos.`
    : "Este equipo está configurado en otra zona horaria distinta a la de la clínica.";

  return (
    <div className="alert alert-warning d-flex align-items-start gap-2 py-2 px-3 mb-3 small" role="alert" style={{ borderRadius: 12 }}>
      <i className="bi bi-clock-history fs-5 flex-shrink-0" />
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <strong>{texto}</strong>{" "}
        Hora de la clínica: <strong>{horaEnZona(aviso.tz)}</strong> · Hora de este equipo: {horaEquipo}
        <span className="d-block text-muted">
          Medic-KG usa siempre la hora de la clínica para citas y reportes. Revise la fecha y hora de su equipo para evitar confusiones.
        </span>
      </div>
      <button type="button" className="btn-close flex-shrink-0" aria-label="Cerrar" onClick={cerrar} />
    </div>
  );
}
