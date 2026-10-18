/**
 * Sucursal elegida arriba (selector de la barra). Se guarda por usuario en este
 * navegador y viaja al servidor en el encabezado "x-sucursal-id".
 * Vacío = todas las sucursales.
 */
const clave = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return `sucursal_activa_${u?.id || "x"}`;
  } catch {
    return "sucursal_activa_x";
  }
};

export function getSucursalActiva() {
  try { return Number(localStorage.getItem(clave())) || null; } catch { return null; }
}

export function setSucursalActiva(id) {
  try {
    if (id) localStorage.setItem(clave(), String(id));
    else localStorage.removeItem(clave());
  } catch { /* sin almacenamiento */ }
}

// Lista de sucursales (una sola consulta por carga de página)
let pedido = null;
export function cargarSucursales(api) {
  if (!pedido) {
    pedido = api.get("/sucursales")
      .then((r) => r.data?.data || { multiple: false, sucursales: [], puede_todas: true })
      .catch(() => ({ multiple: false, sucursales: [], puede_todas: true }));
  }
  return pedido;
}
export const olvidarSucursales = () => { pedido = null; };
