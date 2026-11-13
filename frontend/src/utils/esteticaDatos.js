// Ficha estética, presupuestos, consentimientos y seguimiento post-op en el servidor.
// Antes se guardaban solo en el navegador (localStorage). subirDatosLocales() sube una
// sola vez lo que este navegador tenía y deja una copia de respaldo con otro nombre.
import api from "../api/api";

/** Registro del servidor con la forma que usaban las pantallas: { ...datos, id, paciente_id } */
const plano = (r) => ({ ...r.datos, id: r.id, _tipo: r.tipo, historia_id: r.historia_id || null, paciente_id: r.paciente_id, paciente_nombre: r.datos?.paciente_nombre || r.paciente_nombre, _creado_en: r.creado_en, _actualizado_en: r.actualizado_en });

let subida = null;
export function subirDatosLocales() {
  if (subida) return subida;
  subida = (async () => {
    let claves = [];
    try { claves = Object.keys(localStorage); } catch { return; }
    const items = [];
    const usadas = [];
    const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    for (const k of claves) {
      if (k.endsWith("__subido")) continue;
      if (k === "presupuestos_est" || k === "consentimientos_est") {
        const tipo = k === "presupuestos_est" ? "presupuesto" : "consentimiento";
        (leer(k) || []).forEach((d) => d?.paciente_id && items.push({ tipo, paciente_id: d.paciente_id, datos: d, id_local: `${tipo}-${d.id}` }));
        usadas.push(k);
      } else if (k.startsWith("seguimiento_postop_")) {
        const pid = k.replace("seguimiento_postop_", "");
        (leer(k) || []).forEach((d) => items.push({ tipo: "seguimiento", paciente_id: pid, datos: d, id_local: `seguimiento-${d.id}` }));
        usadas.push(k);
      } else if (k.startsWith("ficha_estetica_")) {
        const pid = k.replace("ficha_estetica_", "");
        const d = leer(k);
        if (d) items.push({ tipo: "ficha", paciente_id: pid, datos: d, id_local: `ficha-${pid}-${d.actualizado_en || ""}`.slice(0, 40) });
        usadas.push(k);
      }
    }
    if (!items.length) return;
    try {
      await api.post("/estetica-datos/importar", { items });
      // Se conserva una copia con otro nombre, por si acaso; ya no se vuelve a leer
      for (const k of usadas) {
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
  const { id: _id, paciente_id: _p, historia_id: _h, _tipo, _creado_en, _actualizado_en, ...limpio } = datos;
  const r = await api.put(`/estetica-datos/${id}`, { datos: limpio });
  return plano(r.data.data);
}

export async function eliminarEstetica(id) {
  await api.delete(`/estetica-datos/${id}`);
}
