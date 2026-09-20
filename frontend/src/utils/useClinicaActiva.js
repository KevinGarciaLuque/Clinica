import { useEffect, useState } from "react";
import { getClinicaActiva, onClinicaActivaChange } from "./clinicaActiva";

/** Se re-renderiza cuando cambia la clínica activa del SUPER_ADMIN. */
export default function useClinicaActiva() {
  const [clinica, setClinica] = useState(getClinicaActiva);

  useEffect(() => onClinicaActivaChange(setClinica), []);

  return clinica; // { id, nombre } | null
}
