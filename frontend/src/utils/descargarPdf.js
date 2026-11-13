// Descarga de PDFs del sistema, con plan B si el servidor no lo puede generar.

/** Descarga un Blob como archivo (no lo bloquea el navegador aunque llegue tarde) */
export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** En el teléfono: menú de compartir (WhatsApp, correo…). Devuelve true si se compartió */
export async function compartirEnTelefono(blob, nombre) {
  const archivo = new File([blob], nombre, { type: blob.type || "application/pdf" });
  if (!window.matchMedia("(pointer: coarse)").matches || !navigator.canShare?.({ files: [archivo] })) return false;
  await navigator.share({ files: [archivo], title: nombre }).catch(() => {});
  return true;
}

/** Abre el cuadro de imprimir con una página HTML (ahí se elige «Guardar como PDF») */
export function imprimirHtml(html) {
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  marco.srcdoc = html;
  marco.onload = () => {
    setTimeout(() => {
      try { marco.contentWindow.focus(); marco.contentWindow.print(); } catch { /* sin impresión */ }
      setTimeout(() => marco.remove(), 60000);
    }, 300);
  };
  document.body.appendChild(marco);
}

/** Mensaje y detalle técnico de un error de axios con responseType "blob" */
export async function errorDeBlob(e) {
  try {
    const datos = JSON.parse(await e.response?.data?.text?.());
    if (datos?.detalle) console.warn("[pdf] detalle:", datos.detalle);
    return datos || {};
  } catch {
    return {};
  }
}
