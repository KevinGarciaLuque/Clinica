import { useEffect, useState } from "react";
import { puedeInstalar, suscribirInstalacion } from "./instalarApp";

/** true cuando se puede ofrecer "Instalar app" en este navegador. */
export default function useInstalable() {
  const [disponible, setDisponible] = useState(puedeInstalar);
  useEffect(() => suscribirInstalacion(() => setDisponible(puedeInstalar())), []);
  return disponible;
}
