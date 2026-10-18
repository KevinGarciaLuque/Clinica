/** Abre la videollamada del médico en una ventana aparte, para tenerla al lado de la consulta */
export function abrirVideollamada(citaId) {
  const ancho = Math.min(560, window.screen.availWidth);
  const alto = Math.min(820, window.screen.availHeight);
  const izq = Math.max(0, window.screen.availWidth - ancho);
  const v = window.open(`/videollamada/${citaId}`, `mkg-video-${citaId}`, `width=${ancho},height=${alto},left=${izq},top=0`);
  if (!v) window.location.href = `/videollamada/${citaId}`; // ventanas emergentes bloqueadas
}

let estado = null;
/** ¿Está activada la videoconsulta en el servidor? (se consulta una vez) */
export function videoActiva(api) {
  if (!estado) estado = api.get("/videoconsultas/estado").then((r) => !!r.data?.activo).catch(() => { estado = null; return false; });
  return estado;
}
