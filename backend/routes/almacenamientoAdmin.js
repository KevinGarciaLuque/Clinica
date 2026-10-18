/**
 * routes/almacenamientoAdmin.js — Módulo «Almacenamiento» del super admin.
 *
 *  GET /api/superadmin/almacenamiento            → resumen + todas las clínicas con su uso + solicitudes de espacio pendientes
 *  PUT /api/superadmin/almacenamiento/:id/cuota  → ampliar/cambiar la cuota de una clínica (y atender su solicitud)
 *  GET /api/superadmin/almacenamiento/exportar   → Excel con el uso de cada clínica
 *
 * Solo lee y escribe la cuota (clinica_config.storage_quota_gb); no toca archivos.
 */
const router = require("express").Router();
const pool = require("../db");
const auth = require("../middlewares/auth");
const sse = require("../utils/sseManager");
const { usoClinica, revisarAviso } = require("../utils/almacenamiento");

const ASUNTO_SOLICITUD = "Solicitud de espacio adicional";

async function listado() {
  const [clinicas] = await pool.query("SELECT id, nombre, activo, plan_tipo FROM clinicas ORDER BY nombre");
  const filas = [];
  for (const c of clinicas) {
    const { almacenamiento: a, conteos } = await usoClinica(c.id);
    filas.push({
      id: c.id, nombre: c.nombre, activo: !!c.activo, plan_tipo: c.plan_tipo,
      espacio_kb: a.espacio_kb, espacio_legible: a.espacio_legible,
      cuota_gb: a.cuota_gb, cuota_legible: a.cuota_legible,
      uso_pct: a.uso_pct, lleno: a.lleno,
      documentos: conteos.total_documentos, fotos: conteos.fotos_galeria + conteos.fotos_perfil_pacientes + conteos.fotos_perfil_usuarios,
      kb_documentos: a.desglose.documentos.kb,
      kb_fotos: a.desglose.galeria_fotos.kb + a.desglose.perfil_pacientes.kb + a.desglose.perfil_usuarios.kb,
    });
  }
  filas.sort((x, y) => y.uso_pct - x.uso_pct || y.espacio_kb - x.espacio_kb);
  return filas;
}

const legible = (kb) => (kb < 1024 ? `${kb.toFixed(0)} KB` : kb < 1048576 ? `${(kb / 1024).toFixed(2)} MB` : `${(kb / 1048576).toFixed(2)} GB`);

router.get("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicas = await listado();
    const usado = clinicas.reduce((s, c) => s + c.espacio_kb, 0);
    const asignado = clinicas.reduce((s, c) => s + c.cuota_gb * 1024 * 1024, 0);

    let solicitudes = [];
    try {
      const [rows] = await pool.query(
        `SELECT r.id, r.clinica_id, r.usuario_nombre, r.usuario_email, r.descripcion, r.estado, r.creado_en, c.nombre AS clinica
         FROM reportes_soporte r LEFT JOIN clinicas c ON c.id = r.clinica_id
         WHERE r.asunto = ? AND r.estado <> 'atendido' ORDER BY r.creado_en DESC`,
        [ASUNTO_SOLICITUD]
      );
      solicitudes = rows.map((r) => ({
        ...r,
        gb_solicitados: Number(String(r.descripcion || "").match(/GB solicitados:\s*([\d.]+)/i)?.[1]) || null,
        total_lps: Number(String(r.descripcion || "").match(/Total estimado \(LPS\):\s*([\d.]+)/i)?.[1]) || null,
      }));
    } catch { /* sin tabla de soporte */ }

    res.json({
      ok: true,
      data: {
        totales: {
          clinicas: clinicas.length,
          usado_kb: usado, usado_legible: legible(usado),
          asignado_kb: asignado, asignado_legible: legible(asignado),
          sobre_80: clinicas.filter((c) => c.uso_pct >= 80 && !c.lleno).length,
          llenas: clinicas.filter((c) => c.lleno).length,
        },
        clinicas,
        solicitudes,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.put("/:id(\\d+)/cuota", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const gb = Number(req.body?.gb);
    if (!Number.isFinite(gb) || gb <= 0 || gb > 5000) return res.status(400).json({ ok: false, msg: "La cuota debe ser entre 0.01 y 5000 GB." });
    const [[c]] = await pool.query("SELECT id, nombre FROM clinicas WHERE id = ?", [id]);
    if (!c) return res.status(404).json({ ok: false, msg: "Clínica no encontrada." });
    const cuota = Math.round(gb * 100) / 100;
    await pool.query(
      `INSERT INTO clinica_config (clinica_id, clave, valor) VALUES (?, 'storage_quota_gb', ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [id, String(cuota)]
    );
    // Recalcula el nivel de aviso (si bajó del 80% se reinicia para avisar de nuevo)
    await revisarAviso(id);

    // Si venía de una solicitud de la clínica, se marca atendida y se le responde
    const solicitudId = Number(req.body?.solicitud_id) || null;
    if (solicitudId) {
      const respuesta = `¡Listo! Ampliamos el espacio de almacenamiento de su clínica a ${cuota} GB.`;
      await pool.query(
        "UPDATE reportes_soporte SET estado='atendido', respuesta=?, atendido_en=NOW(), leido_usuario=0 WHERE id=? AND clinica_id=?",
        [respuesta, solicitudId, id]
      );
      const [[r]] = await pool.query("SELECT usuario_id, asunto FROM reportes_soporte WHERE id=?", [solicitudId]);
      if (r?.usuario_id) sse.notifyUser(r.usuario_id, "respuesta_reporte", { id: solicitudId, asunto: r.asunto, respuesta, estado: "atendido" });
    }
    const { almacenamiento: a } = await usoClinica(id);
    res.json({ ok: true, data: { cuota_gb: cuota, uso_pct: a.uso_pct, lleno: a.lleno } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

router.get("/exportar", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const clinicas = await listado();
    const wb = new ExcelJS.Workbook();
    const h = wb.addWorksheet("Almacenamiento");
    h.columns = [
      { header: "Clínica", key: "nombre", width: 34 }, { header: "Activa", key: "activa", width: 8 },
      { header: "Usado (MB)", key: "usado", width: 13 }, { header: "Cuota (GB)", key: "cuota_gb", width: 11 },
      { header: "% usado", key: "uso_pct", width: 9 }, { header: "Documentos", key: "documentos", width: 12 },
      { header: "Fotos", key: "fotos", width: 8 }, { header: "Estado", key: "estado", width: 12 },
    ];
    const cab = h.getRow(1);
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A6E" } };
    clinicas.forEach((c) => h.addRow({
      ...c, activa: c.activo ? "Sí" : "No", usado: Math.round((c.espacio_kb / 1024) * 100) / 100,
      estado: c.lleno ? "Lleno" : c.uso_pct >= 80 ? "Más de 80%" : "Normal",
    }));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="almacenamiento_clinicas.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
