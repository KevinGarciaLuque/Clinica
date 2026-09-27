import { useEffect, useState } from "react";
import api from "../api/api";

// Función clínica del usuario en clínicas de endocrinología:
// "EDUCADOR_DIABETES" | "CONTROL_SEGUIMIENTO" | null (médico normal).
// Se consulta en cada montaje (sin caché global) para no arrastrarla entre sesiones.
export function useFuncionClinica() {
  const [funcion, setFuncion] = useState(null);
  useEffect(() => {
    let vivo = true;
    api.get("/usuarios/mi-funcion")
      .then((r) => { if (vivo) setFuncion(r.data?.data?.funcion_clinica || null); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return funcion;
}

// Pantalla a la que lleva "Consulta" / "Nueva Consulta" según la función del usuario
export function rutaConsulta(funcion, pacienteId, citaId) {
  const q = `paciente_id=${pacienteId}${citaId ? `&cita_id=${citaId}` : ""}`;
  if (funcion === "EDUCADOR_DIABETES") return `/educacion/consulta?${q}`;
  if (funcion === "CONTROL_SEGUIMIENTO") return `/endocrinologia/seguimiento?${q}`;
  return `/consulta-medica?${q}`;
}
