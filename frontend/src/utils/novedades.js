// Estado compartido de "Novedades" (botón de la barra superior, versión del menú
// lateral y ventana de anuncios). Se pide una sola vez y se comparte entre componentes.
import { useEffect, useState } from "react";
import api from "../api/api";

let estado = null;          // { version, novedades, no_leidas, anuncio }
let pendiente = null;
const suscriptores = new Set();
const avisar = () => suscriptores.forEach((fn) => fn(estado));

export function cargarNovedades(forzar = false) {
  if (pendiente && !forzar) return pendiente;
  pendiente = api.get("/novedades")
    .then((r) => { estado = r.data.data; avisar(); return estado; })
    .catch(() => { pendiente = null; return null; });
  return pendiente;
}

export async function marcarNovedadesVistas() {
  if (!estado || !estado.no_leidas) return;
  estado = { ...estado, no_leidas: 0, anuncio: [], novedades: estado.novedades.map((n) => ({ ...n, nueva: false })) };
  avisar();
  try { await api.post("/novedades/vistas"); } catch { /* se reintenta la próxima vez */ }
}

export function useNovedades() {
  const [d, setD] = useState(estado);
  useEffect(() => {
    suscriptores.add(setD);
    if (!estado) cargarNovedades();
    return () => suscriptores.delete(setD);
  }, []);
  return d;
}

// Abrir el panel desde cualquier parte (p. ej. la versión del menú lateral)
export const abrirPanelNovedades = () => window.dispatchEvent(new Event("abrir-novedades"));
