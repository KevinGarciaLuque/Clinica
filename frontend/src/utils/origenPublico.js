// Dirección pública para los enlaces que se copian o comparten (registro de
// pacientes, página de la clínica…). Si se está usando la dirección provisional
// de Vercel (*.vercel.app), los enlaces salen con el dominio propio medickg.com.
export const DOMINIO_PROPIO = "https://medickg.com";

export function origenPublico() {
  if (typeof window === "undefined") return DOMINIO_PROPIO;
  return /\.vercel\.app$/i.test(window.location.hostname) ? DOMINIO_PROPIO : window.location.origin;
}
