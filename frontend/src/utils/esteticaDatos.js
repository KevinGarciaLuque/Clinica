// Ficha estética, presupuestos, consentimientos y seguimiento post-op en el servidor.
// Antes se guardaban solo en el navegador (localStorage). subirDatosLocales() sube una
// sola vez lo que este navegador tenía y deja una copia de respaldo con otro nombre.
import api from "../api/api";
import { getClinicaActiva } from "./clinicaActiva";

/** Registro del servidor con la forma que usaban las pantallas: { ...datos, id, paciente_id } */
const plano = (r) => ({ ...r.datos, id: r.id, _tipo: r.tipo, historia_id: r.historia_id || null, paciente_id: r.paciente_id, paciente_nombre: r.datos?.paciente_nombre || r.paciente_nombre, _factura: r.factura || null, _creado_en: r.creado_en, _actualizado_en: r.actualizado_en });

let subida = null;
let subidaClinica = null;

/** Clínica con la que se está trabajando (para no mezclar datos de otra clínica) */
function clinicaActual() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    if (u.clinica_id) return String(u.clinica_id);
    return getClinicaActiva()?.id ? String(getClinicaActiva().id) : "";
  } catch { return ""; }
}

/**
 * Sube una vez por clínica lo que este navegador tenía guardado. Se leen tanto
 * las claves originales como las copias «__subido»: si el navegador se usó en
 * varias clínicas, al entrar a cada una se suben sus pacientes (el servidor
 * solo acepta pacientes de la clínica actual y nunca duplica).
 */
export function subirDatosLocales() {
  const cid = clinicaActual();
  if (subida && subidaClinica === cid) return subida;
  subidaClinica = cid;
  subida = (async () => {
    let claves = [];
    try { claves = Object.keys(localStorage); } catch { return; }
    const marca = `estetica_importado_c${cid || "x"}`;
    const items = [];
    const originales = [];
    const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    for (const k of claves) {
      const base = k.replace(/__subido$/, "");
      const esCopia = base !== k;
      let usada = true;
      if (base === "presupuestos_est" || base === "consentimientos_est") {
        const tipo = base === "presupuestos_est" ? "presupuesto" : "consentimiento";
        (leer(k) || []).forEach((d) => d?.paciente_id && items.push({ tipo, paciente_id: d.paciente_id, datos: d, id_local: `${tipo}-${d.id}` }));
      } else if (base.startsWith("seguimiento_postop_")) {
        const pid = base.replace("seguimiento_postop_", "");
        (leer(k) || []).forEach((d) => items.push({ tipo: "seguimiento", paciente_id: pid, datos: d, id_local: `seguimiento-${d.id}` }));
      } else if (base.startsWith("ficha_estetica_")) {
        const pid = base.replace("ficha_estetica_", "");
        const d = leer(k);
        if (d) items.push({ tipo: "ficha", paciente_id: pid, datos: d, id_local: `ficha-${pid}-${d.actualizado_en || ""}`.slice(0, 40) });
      } else usada = false;
      if (usada && !esCopia) originales.push(k);
    }
    if (!items.length) return;
    // Ya se subió para esta clínica y no hay nada nuevo: no se repite
    let yaHecho = false;
    try { yaHecho = localStorage.getItem(marca) === "1"; } catch { /* sin acceso */ }
    if (yaHecho && !originales.length) return;
    try {
      await api.post("/estetica-datos/importar", { items });
      try { localStorage.setItem(marca, "1"); } catch { /* sin espacio */ }
      // Se conserva una copia con otro nombre, por si acaso
      for (const k of originales) {
        try { localStorage.setItem(`${k}__subido`, localStorage.getItem(k)); localStorage.removeItem(k); } catch { /* sin espacio */ }
      }
    } catch {
      subida = null; // se intenta de nuevo la próxima vez
    }
  })();
  return subida;
}

export async function listarEstetica(tipo, pacienteId) {
  await subirDatosLocales();
  const r = await api.get("/estetica-datos", { params: { tipo, paciente_id: pacienteId || undefined } });
  return (r.data.data || []).map(plano);
}

export async function crearEstetica(tipo, pacienteId, datos) {
  const r = await api.post("/estetica-datos", { tipo, paciente_id: pacienteId, datos });
  return plano(r.data.data);
}

export async function actualizarEstetica(id, datos) {
  const { id: _id, paciente_id: _p, historia_id: _h, _tipo, _factura, _creado_en, _actualizado_en, ...limpio } = datos;
  const r = await api.put(`/estetica-datos/${id}`, { datos: limpio });
  return plano(r.data.data);
}

export async function eliminarEstetica(id) {
  await api.delete(`/estetica-datos/${id}`);
}
