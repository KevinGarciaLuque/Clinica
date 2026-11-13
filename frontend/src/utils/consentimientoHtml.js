// Hoja imprimible del consentimiento informado (con la firma del paciente si la tiene)
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fecha = (v) => (v ? new Date(v).toLocaleString("es", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export function consentimientoHtml(c) {
  const firma = c.firma_paciente && /^data:image\/(png|jpeg);base64,/.test(c.firma_paciente) ? c.firma_paciente : null;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Consentimiento informado</title>
  <style>body{font-family:Arial,sans-serif;color:#111;padding:28px;font-size:13px;line-height:1.55}
  h1{font-size:18px;margin:0 0 4px;color:#be185d}.meta{color:#555;margin-bottom:14px}
  .texto{white-space:pre-wrap;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
  .firmas{display:flex;justify-content:space-between;gap:30px;margin-top:40px}.firmas>div{flex:1;text-align:center}
  .linea{border-top:1px solid #333;padding-top:4px;margin-top:6px}.img{height:90px;display:flex;align-items:flex-end;justify-content:center}
  .img img{max-height:90px;max-width:100%}</style></head><body>
  <h1>Consentimiento informado — ${esc(c.procedimiento)}</h1>
  <div class="meta">Paciente: <strong>${esc(c.paciente_nombre)}</strong>${c.creado_en ? ` · Emitido: ${esc(fecha(c.creado_en))}` : ""}</div>
  <div class="texto">${esc(c.contenido)}</div>
  ${(c.riesgos || []).length ? `<p><strong>Riesgos explicados:</strong></p><ul>${c.riesgos.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
  ${c.notas ? `<p><strong>Notas:</strong> ${esc(c.notas)}</p>` : ""}
  <div class="firmas">
    <div><div class="img">${firma ? `<img src="${firma}" alt="Firma">` : ""}</div>
      <div class="linea">${esc(c.firmante_nombre || c.paciente_nombre)}${c.firmante_relacion && c.firmante_relacion !== "Paciente" ? ` (${esc(c.firmante_relacion)})` : ""}</div>
      ${c.firmado && c.firmado_en ? `<div style="color:#555;font-size:11px">Firmado ${c.firma_papel ? "en papel" : "electrónicamente"} el ${esc(fecha(c.firmado_en))}</div>` : ""}</div>
    <div><div class="img"></div><div class="linea">Firma y sello del médico</div></div>
  </div></body></html>`;
}
