const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const { requireModulo } = require("../middlewares/moduloPermiso");

// El módulo debe estar habilitado para la clínica y el usuario (SUPER_ADMIN pasa)
const MOD = requireModulo("consulta_odontologica");

// Información clínica: solo quien atiende (decisión de la clínica: recepción y enfermería no la ven)
const ROLES           = ["SUPER_ADMIN","ADMIN","MEDICO"];
const ROLES_ESCRITURA = ["SUPER_ADMIN","ADMIN","MEDICO"];

// ─── Auto-crear tablas ────────────────────────────────────────────────────────
async function ensureTablas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sesiones_odontologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      dentista_id INT UNSIGNED NOT NULL, cita_id INT UNSIGNED,
      numero_sesion SMALLINT UNSIGNED NOT NULL DEFAULT 1,
      motivo_consulta TEXT, exploracion_clinica JSON, hallazgos JSON, procedimientos JSON,
      diagnostico_cie VARCHAR(120), diagnostico_desc TEXT,
      indicaciones TEXT, proxima_cita TEXT, observaciones TEXT,
      estado ENUM('BORRADOR','FIRMADA') DEFAULT 'BORRADOR',
      firma_at DATETIME,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_so_clinica(clinica_id), INDEX idx_so_paciente(paciente_id),
      INDEX idx_so_dentista(dentista_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odontograma_estado (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      dientes JSON NOT NULL DEFAULT ('{}'),
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_oe(clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS historia_odontologica (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      motivo_consulta_inicial TEXT,
      fecha_ultima_consulta DATE, complicaciones_previas TEXT,
      antecedentes JSON, medicamentos JSON,
      frecuencia_cepillado VARCHAR(80), usa_hilo_dental TINYINT(1) DEFAULT 0,
      usa_enjuague TINYINT(1) DEFAULT 0, habitos_nocivos TEXT,
      diabetes TINYINT(1) DEFAULT 0, hipertension TINYINT(1) DEFAULT 0,
      anticoagulantes TINYINT(1) DEFAULT 0, alergia_anestesia TINYINT(1) DEFAULT 0,
      alergia_latex TINYINT(1) DEFAULT 0, otras_condiciones TEXT,
      ortodoncia_previa TINYINT(1) DEFAULT 0, extracciones_previas TEXT,
      implantes_previos TINYINT(1) DEFAULT 0, protesis_actual VARCHAR(120),
      tratamientos_previos TEXT, historia_familiar TEXT, notas TEXT,
      declaracion_veraz TINYINT(1) DEFAULT 0,
      firma_paciente_nombre VARCHAR(150), firma_fecha DATETIME,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ho(clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogo_condiciones_medicas (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      requiere_especifique TINYINT(1) DEFAULT 0,
      es_alerta TINYINT(1) DEFAULT 0,
      orden INT DEFAULT 0,
      activo TINYINT(1) DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ccm_clinica(clinica_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_tratamiento_odontologia (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL, paciente_id INT UNSIGNED NOT NULL,
      dentista_id INT UNSIGNED NOT NULL,
      items JSON NOT NULL DEFAULT ('[]'), fases JSON,
      costo_total DECIMAL(10,2) DEFAULT 0,
      vigencia_dias INT UNSIGNED DEFAULT 90,
      formas_pago VARCHAR(255) DEFAULT 'Efectivo, Tarjeta, Transferencia',
      nota_clinica TEXT,
      notas TEXT, activo TINYINT(1) DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pto(clinica_id, paciente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Auditoría de acciones clínicas (quién hizo qué, sin guardar el contenido clínico completo)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auditoria_clinica (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL,
      modulo VARCHAR(40) NOT NULL,
      entidad VARCHAR(40) NOT NULL,
      entidad_id INT UNSIGNED NULL,
      paciente_id INT UNSIGNED NULL,
      usuario_id INT UNSIGNED NOT NULL,
      accion VARCHAR(40) NOT NULL,
      detalle JSON NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ac_clinica_paciente (clinica_id, paciente_id, creado_en),
      INDEX idx_ac_usuario (usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Fotos del odontograma: la primera es el "inicial"; cada firma de sesión guarda una
  await pool.query(`
    CREATE TABLE IF NOT EXISTS odontograma_historial (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL,
      paciente_id INT UNSIGNED NOT NULL,
      sesion_id INT UNSIGNED NULL,
      usuario_id INT UNSIGNED NULL,
      origen ENUM('INICIAL','GUARDADO','FIRMA_SESION') NOT NULL DEFAULT 'GUARDADO',
      dientes JSON NOT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_oh_paciente (clinica_id, paciente_id, creado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Versiones del plan de tratamiento (el plan vigente se sigue guardando en plan_tratamiento_odontologia)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_tratamiento_historial (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL,
      paciente_id INT UNSIGNED NOT NULL,
      version INT UNSIGNED NOT NULL,
      fases JSON NOT NULL,
      costo_total DECIMAL(10,2) DEFAULT 0,
      vigencia_dias INT UNSIGNED NULL,
      formas_pago VARCHAR(255) NULL,
      nota_clinica TEXT NULL,
      usuario_id INT UNSIGNED NULL,
      origen ENUM('INICIAL','GUARDADO') NOT NULL DEFAULT 'GUARDADO',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pth_paciente (clinica_id, paciente_id, version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Notas posteriores a la firma: solo se agregan, nunca se editan ni se borran
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sesion_addendas (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      clinica_id INT UNSIGNED NOT NULL,
      sesion_id INT UNSIGNED NOT NULL,
      paciente_id INT UNSIGNED NOT NULL,
      usuario_id INT UNSIGNED NOT NULL,
      texto TEXT NOT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sa_sesion (clinica_id, sesion_id, creado_en)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Factura ligada a la sesión (evita cobrar dos veces la misma atención)
  const [colFactura] = await pool.query("SHOW COLUMNS FROM sesiones_odontologia LIKE 'factura_id'");
  if (!colFactura.length) {
    await pool.query("ALTER TABLE sesiones_odontologia ADD COLUMN factura_id INT UNSIGNED NULL");
  }
}
ensureTablas().catch(() => {});

// Validación de los cambios que el dentista confirma al firmar (Fase 2)
const PIEZAS_FDI = new Set([
  11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48, // permanentes
  51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85,                                         // temporales
].map(String));
const CONDICIONES = new Set(["sano","caries","obturacion","corona","extraccion","endodoncia","implante","fractura","puente","sellante","mal_posicion"]);
const SUPERFICIES = new Set(["v","p","m","d","o"]);
const dienteVacio = () => ({ v: "sano", p: "sano", m: "sano", d: "sano", o: "sano", ausente: false, nota: "" });

// ─── Utilidades de la Fase 1 ──────────────────────────────────────────────────
// Registra la acción sin interrumpir nunca la operación clínica.
async function auditar(req, { entidad, entidad_id = null, paciente_id = null, accion, detalle = null }) {
  try {
    await pool.query(
      `INSERT INTO auditoria_clinica (clinica_id, modulo, entidad, entidad_id, paciente_id, usuario_id, accion, detalle)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.user.clinica_id, "odontologia", entidad, entidad_id, paciente_id, req.user.id, accion,
       detalle ? JSON.stringify(detalle) : null]
    );
  } catch (e) { console.error("[odontologia] auditoría:", e.message); }
}

// La cita debe ser de esta clínica y de este paciente; si no, se ignora (no rompe la sesión)
async function citaValida(clinicaId, pacienteId, citaId) {
  if (!citaId) return null;
  const [[c]] = await pool.query(
    "SELECT id, estado FROM citas WHERE id=? AND clinica_id=? AND paciente_id=? LIMIT 1",
    [citaId, clinicaId, pacienteId]
  );
  return c || null;
}

// JSON con llaves ordenadas para comparar estados del odontograma sin falsos cambios
const estable = (o) => JSON.stringify(o, (k, v) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((a, key) => { a[key] = v[key]; return a; }, {})
    : v);

const parseJson = (v) => (typeof v === "string" ? JSON.parse(v || "{}") : (v || {}));
const parseJsonArr = (v) => { const x = typeof v === "string" ? JSON.parse(v || "[]") : v; return Array.isArray(x) ? x : []; };

async function versionPlan(clinicaId, pacienteId, plan, { origen, usuarioId = null }) {
  const [[{ max }]] = await pool.query(
    "SELECT IFNULL(MAX(version),0) AS max FROM plan_tratamiento_historial WHERE clinica_id=? AND paciente_id=?", [clinicaId, pacienteId]
  );
  await pool.query(
    `INSERT INTO plan_tratamiento_historial
       (clinica_id, paciente_id, version, fases, costo_total, vigencia_dias, formas_pago, nota_clinica, usuario_id, origen)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [clinicaId, pacienteId, max + 1, JSON.stringify(parseJsonArr(plan.fases)), plan.costo_total || 0,
     plan.vigencia_dias || null, plan.formas_pago || null, plan.nota_clinica || null, usuarioId, origen]
  );
}

async function foto(clinicaId, pacienteId, dientes, { origen, usuarioId = null, sesionId = null, exec = pool }) {
  await exec.query(
    `INSERT INTO odontograma_historial (clinica_id, paciente_id, sesion_id, usuario_id, origen, dientes)
     VALUES (?,?,?,?,?,?)`,
    [clinicaId, pacienteId, sesionId, usuarioId, origen, JSON.stringify(dientes)]
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SESIONES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/sesiones?paciente_id=&page=1&limit=20
router.get("/sesiones", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid  = req.user.clinica_id;
    const pid  = req.query.paciente_id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const lim  = Math.min(50, parseInt(req.query.limit) || 20);
    const off  = (page - 1) * lim;

    if (!pid) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, pid]
    );
    const [rows] = await pool.query(
      `SELECT s.*, CONCAT(u.nombres,' ',IFNULL(u.apellidos,'')) AS dentista_nombre
       FROM sesiones_odontologia s
       LEFT JOIN usuarios u ON u.id = s.dentista_id
       WHERE s.clinica_id=? AND s.paciente_id=?
       ORDER BY s.creado_en DESC LIMIT ? OFFSET ?`,
      [cid, pid, lim, off]
    );
    res.json({ ok: true, data: rows, total, page, pages: Math.ceil(total / lim) });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/odontologia/sesiones/:id
router.get("/sesiones/:id", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT s.*, CONCAT(u.nombres,' ',IFNULL(u.apellidos,'')) AS dentista_nombre
       FROM sesiones_odontologia s
       LEFT JOIN usuarios u ON u.id = s.dentista_id
       WHERE s.id=? AND s.clinica_id=?`,
      [req.params.id, cid]
    );
    if (!row) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/sesiones
router.post("/sesiones", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const uid = req.user.id;
    const {
      paciente_id, cita_id, motivo_consulta, exploracion_clinica, hallazgos,
      procedimientos, diagnostico_cie, diagnostico_desc,
      indicaciones, proxima_cita, observaciones
    } = req.body;

    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });

    // Calcular número de sesión
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, paciente_id]
    );

    const citaOk = await citaValida(cid, paciente_id, cita_id);

    const [result] = await pool.query(
      `INSERT INTO sesiones_odontologia
        (clinica_id, paciente_id, dentista_id, cita_id, numero_sesion,
         motivo_consulta, exploracion_clinica, hallazgos, procedimientos,
         diagnostico_cie, diagnostico_desc, indicaciones, proxima_cita, observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cid, paciente_id, uid, citaOk ? citaOk.id : null, cnt + 1,
        motivo_consulta || null,
        exploracion_clinica ? JSON.stringify(exploracion_clinica) : null,
        hallazgos ? JSON.stringify(hallazgos) : JSON.stringify([]),
        procedimientos ? JSON.stringify(procedimientos) : JSON.stringify([]),
        diagnostico_cie || null, diagnostico_desc || null,
        indicaciones || null, proxima_cita || null, observaciones || null
      ]
    );
    // Al iniciar la atención, la cita del día pasa a EN_ATENCION (si aún no lo estaba)
    if (citaOk && ["PENDIENTE", "CONFIRMADA", "EN_ESPERA"].includes(citaOk.estado)) {
      await pool.query("UPDATE citas SET estado='EN_ATENCION' WHERE id=? AND clinica_id=?", [citaOk.id, cid]);
    }
    await auditar(req, { entidad: "sesion", entidad_id: result.insertId, paciente_id, accion: "CREAR_SESION",
                         detalle: { cita_id: citaOk ? citaOk.id : null, cita_ignorada: !!cita_id && !citaOk } });

    const [[sesion]] = await pool.query(
      `SELECT * FROM sesiones_odontologia WHERE id=?`, [result.insertId]
    );
    res.status(201).json({ ok: true, data: sesion });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// PUT /api/odontologia/sesiones/:id
router.put("/sesiones/:id", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await pool.query(
      `SELECT * FROM sesiones_odontologia WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.estado === 'FIRMADA') return res.status(400).json({ ok: false, msg: "Sesión ya firmada" });

    const {
      motivo_consulta, exploracion_clinica, hallazgos, procedimientos,
      diagnostico_cie, diagnostico_desc, indicaciones, proxima_cita, observaciones
    } = req.body;

    await pool.query(
      `UPDATE sesiones_odontologia SET
        motivo_consulta=?, exploracion_clinica=?, hallazgos=?, procedimientos=?,
        diagnostico_cie=?, diagnostico_desc=?,
        indicaciones=?, proxima_cita=?, observaciones=?
       WHERE id=? AND clinica_id=?`,
      [
        motivo_consulta ?? sesion.motivo_consulta,
        exploracion_clinica ? JSON.stringify(exploracion_clinica) : sesion.exploracion_clinica,
        hallazgos ? JSON.stringify(hallazgos) : sesion.hallazgos,
        procedimientos ? JSON.stringify(procedimientos) : sesion.procedimientos,
        diagnostico_cie ?? sesion.diagnostico_cie,
        diagnostico_desc ?? sesion.diagnostico_desc,
        indicaciones ?? sesion.indicaciones,
        proxima_cita ?? sesion.proxima_cita,
        observaciones ?? sesion.observaciones,
        req.params.id, cid
      ]
    );
    const [[updated]] = await pool.query(
      `SELECT * FROM sesiones_odontologia WHERE id=?`, [req.params.id]
    );
    await auditar(req, { entidad: "sesion", entidad_id: Number(req.params.id), paciente_id: sesion.paciente_id, accion: "ACTUALIZAR_SESION" });
    res.json({ ok: true, data: updated });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/sesiones/:id/firmar
router.post("/sesiones/:id/firmar", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await conn.query(
      `SELECT * FROM sesiones_odontologia WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.estado === 'FIRMADA') return res.status(400).json({ ok: false, msg: "Ya firmada" });

    // Cambios que el dentista revisó y confirmó en pantalla (opcionales)
    const planItems = Array.isArray(req.body?.plan_items) ? req.body.plan_items : [];
    const cambiosOdo = Array.isArray(req.body?.odontograma) ? req.body.odontograma : [];

    // Validar todo antes de tocar nada
    for (const c of cambiosOdo) {
      if (!PIEZAS_FDI.has(String(c.pieza))) return res.status(400).json({ ok: false, msg: `Pieza inválida: ${c.pieza}` });
      if (c.tipo === "ausente") continue;
      if (c.tipo !== "condicion" || !CONDICIONES.has(c.condicion)) {
        return res.status(400).json({ ok: false, msg: `Cambio de odontograma inválido en la pieza ${c.pieza}` });
      }
      if (!Array.isArray(c.superficies) || !c.superficies.length || !c.superficies.every(x => SUPERFICIES.has(x))) {
        return res.status(400).json({ ok: false, msg: `Superficies inválidas en la pieza ${c.pieza}` });
      }
    }

    await conn.beginTransaction();
    let planAplicados = 0, odoAplicados = 0;

    // 1) Avance del plan: los ítems confirmados quedan completados y ligados a esta sesión
    if (planItems.length) {
      const [[plan]] = await conn.query(
        `SELECT id, fases FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=? FOR UPDATE`,
        [cid, sesion.paciente_id]
      );
      if (plan) {
        const fases = typeof plan.fases === "string" ? JSON.parse(plan.fases || "[]") : (plan.fases || []);
        const ahora = new Date().toISOString();
        for (const sel of planItems) {
          const fase = fases.find(f => String(f.id) === String(sel.fase_id));
          const item = fase?.items?.find(i => String(i.id) === String(sel.item_id));
          if (item && !item.completado) {
            item.completado = true; item.sesion_id = sesion.id; item.completado_en = ahora;
            planAplicados++;
          }
        }
        if (planAplicados) {
          await conn.query("UPDATE plan_tratamiento_odontologia SET fases=? WHERE id=?", [JSON.stringify(fases), plan.id]);
        }
      }
    }

    // 2) Odontograma: se conserva el estado previo y se aplican solo los cambios confirmados
    const [[odo]] = await conn.query(
      "SELECT dientes FROM odontograma_estado WHERE clinica_id=? AND paciente_id=? FOR UPDATE", [cid, sesion.paciente_id]
    );
    let dientes = odo ? parseJson(odo.dientes) : {};
    if (cambiosOdo.length) {
      const [[{ n }]] = await conn.query(
        "SELECT COUNT(*) AS n FROM odontograma_historial WHERE clinica_id=? AND paciente_id=?", [cid, sesion.paciente_id]
      );
      if (odo && n === 0) await foto(cid, sesion.paciente_id, dientes, { origen: "INICIAL", exec: conn });
      dientes = { ...dientes };
      for (const c of cambiosOdo) {
        const d = { ...dienteVacio(), ...(dientes[c.pieza] || {}) };
        if (c.tipo === "ausente") d.ausente = true;
        else for (const sf of c.superficies) d[sf] = c.condicion;
        dientes[c.pieza] = d;
        odoAplicados++;
      }
      await conn.query(
        `INSERT INTO odontograma_estado (clinica_id, paciente_id, dientes) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE dientes=VALUES(dientes), actualizado_en=NOW()`,
        [cid, sesion.paciente_id, JSON.stringify(dientes)]
      );
    }

    // 3) Firma, cita COMPLETADA y foto del odontograma de esta sesión
    await conn.query(
      `UPDATE sesiones_odontologia SET estado='FIRMADA', firma_at=NOW() WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    if (sesion.cita_id) {
      await conn.query(
        "UPDATE citas SET estado='COMPLETADA' WHERE id=? AND clinica_id=? AND estado NOT IN ('CANCELADA','COMPLETADA')",
        [sesion.cita_id, cid]
      );
    }
    if (odo || cambiosOdo.length) {
      await foto(cid, sesion.paciente_id, dientes, { origen: "FIRMA_SESION", usuarioId: req.user.id, sesionId: sesion.id, exec: conn });
    }
    await conn.commit();

    await auditar(req, { entidad: "sesion", entidad_id: sesion.id, paciente_id: sesion.paciente_id, accion: "FIRMAR_SESION",
                         detalle: { cita_id: sesion.cita_id || null, plan_items_completados: planAplicados, cambios_odontograma: odoAplicados } });

    res.json({ ok: true, msg: "Sesión firmada", aplicado: { plan_items: planAplicados, odontograma: odoAplicados } });
  } catch (e) {
    try { await conn.rollback(); } catch { /* sin transacción abierta */ }
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/odontologia/sesiones/:id/addendas  → notas posteriores a la firma (más antigua primero)
router.get("/sesiones/:id/addendas", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [rows] = await pool.query(
      `SELECT a.id, a.texto, a.creado_en, CONCAT(u.nombres,' ',IFNULL(u.apellidos,'')) AS usuario_nombre
       FROM sesion_addendas a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.clinica_id=? AND a.sesion_id=?
       ORDER BY a.creado_en ASC, a.id ASC`,
      [cid, req.params.id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/sesiones/:id/addendas  { texto }  → agrega una nota a una sesión ya firmada.
// Es solo de agregado: la sesión firmada no cambia y las notas no se editan ni se eliminan.
router.post("/sesiones/:id/addendas", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const texto = String(req.body?.texto ?? "").trim();
    if (texto.length < 3) return res.status(400).json({ ok: false, msg: "Escribe la nota (mínimo 3 caracteres)" });
    if (texto.length > 2000) return res.status(400).json({ ok: false, msg: "La nota es demasiado larga (máx. 2000 caracteres)" });

    const [[sesion]] = await pool.query(
      "SELECT id, paciente_id, estado FROM sesiones_odontologia WHERE id=? AND clinica_id=?", [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.estado !== "FIRMADA") {
      return res.status(400).json({ ok: false, msg: "Las notas posteriores solo se agregan a sesiones firmadas; esta aún se puede editar." });
    }

    const [r] = await pool.query(
      "INSERT INTO sesion_addendas (clinica_id, sesion_id, paciente_id, usuario_id, texto) VALUES (?,?,?,?,?)",
      [cid, sesion.id, sesion.paciente_id, req.user.id, texto]
    );
    await auditar(req, { entidad: "sesion", entidad_id: sesion.id, paciente_id: sesion.paciente_id, accion: "AGREGAR_ADDENDUM",
                         detalle: { addendum_id: r.insertId } });
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/sesiones/:id/factura  { factura_id }  → deja constancia de que la atención ya se cobró
router.post("/sesiones/:id/factura", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const facturaId = Number(req.body?.factura_id);
    if (!facturaId) return res.status(400).json({ ok: false, msg: "factura_id requerido" });

    const [[sesion]] = await pool.query(
      "SELECT id, paciente_id, estado, factura_id FROM sesiones_odontologia WHERE id=? AND clinica_id=?", [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.factura_id) return res.status(409).json({ ok: false, msg: "Esta sesión ya tiene un cobro registrado" });

    const [[factura]] = await pool.query(
      "SELECT id FROM facturas WHERE id=? AND clinica_id=? AND paciente_id=?", [facturaId, cid, sesion.paciente_id]
    );
    if (!factura) return res.status(400).json({ ok: false, msg: "La factura no corresponde a este paciente" });

    await pool.query("UPDATE sesiones_odontologia SET factura_id=? WHERE id=? AND clinica_id=?", [facturaId, sesion.id, cid]);
    await auditar(req, { entidad: "sesion", entidad_id: sesion.id, paciente_id: sesion.paciente_id, accion: "VINCULAR_FACTURA",
                         detalle: { factura_id: facturaId } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// DELETE /api/odontologia/sesiones/:id
router.delete("/sesiones/:id", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[sesion]] = await pool.query(
      `SELECT estado, paciente_id FROM sesiones_odontologia WHERE id=? AND clinica_id=?`,
      [req.params.id, cid]
    );
    if (!sesion) return res.status(404).json({ ok: false, msg: "Sesión no encontrada" });
    if (sesion.estado === 'FIRMADA') return res.status(400).json({ ok: false, msg: "No se puede eliminar una sesión firmada" });

    await pool.query(`DELETE FROM sesiones_odontologia WHERE id=? AND clinica_id=?`, [req.params.id, cid]);
    await auditar(req, { entidad: "sesion", entidad_id: Number(req.params.id), paciente_id: sesion.paciente_id, accion: "ELIMINAR_SESION" });
    res.json({ ok: true, msg: "Sesión eliminada" });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ODONTOGRAMA
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/odontograma/:paciente_id
router.get("/odontograma/:paciente_id", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT * FROM odontograma_estado WHERE clinica_id=? AND paciente_id=?`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/odontograma/:paciente_id  (upsert)
router.post("/odontograma/:paciente_id", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const { dientes } = req.body;
    if (!dientes) return res.status(400).json({ ok: false, msg: "dientes requerido" });

    const [[previo]] = await pool.query(
      `SELECT dientes FROM odontograma_estado WHERE clinica_id=? AND paciente_id=?`, [cid, pid]
    );

    // Conserva el estado anterior antes de pisarlo. El primero que exista queda como "inicial".
    let cambio = true;
    if (previo) {
      const antes = parseJson(previo.dientes);
      cambio = estable(antes) !== estable(dientes);
      const [[{ n }]] = await pool.query(
        "SELECT COUNT(*) AS n FROM odontograma_historial WHERE clinica_id=? AND paciente_id=?", [cid, pid]
      );
      if (n === 0) await foto(cid, pid, antes, { origen: "INICIAL", usuarioId: null });
    }

    await pool.query(
      `INSERT INTO odontograma_estado (clinica_id, paciente_id, dientes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE dientes=VALUES(dientes), actualizado_en=NOW()`,
      [cid, pid, JSON.stringify(dientes)]
    );

    if (cambio) {
      const [[{ n }]] = await pool.query(
        "SELECT COUNT(*) AS n FROM odontograma_historial WHERE clinica_id=? AND paciente_id=?", [cid, pid]
      );
      await foto(cid, pid, dientes, { origen: n === 0 ? "INICIAL" : "GUARDADO", usuarioId: req.user.id });
      await auditar(req, { entidad: "odontograma", paciente_id: pid, accion: "GUARDAR_ODONTOGRAMA" });
    }

    const [[row]] = await pool.query(
      `SELECT * FROM odontograma_estado WHERE clinica_id=? AND paciente_id=?`, [cid, pid]
    );
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/odontologia/odontograma/:paciente_id/historial  → fotos del odontograma (más reciente primero)
router.get("/odontograma/:paciente_id/historial", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [rows] = await pool.query(
      `SELECT h.id, h.sesion_id, h.origen, h.dientes, h.creado_en,
              CONCAT(u.nombres,' ',IFNULL(u.apellidos,'')) AS usuario_nombre
       FROM odontograma_historial h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.clinica_id=? AND h.paciente_id=?
       ORDER BY h.creado_en DESC, h.id DESC LIMIT 100`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/odontologia/auditoria/:paciente_id  → últimas acciones clínicas sobre el paciente
router.get("/auditoria/:paciente_id", auth("SUPER_ADMIN", "ADMIN", "MEDICO"), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [rows] = await pool.query(
      `SELECT a.id, a.entidad, a.entidad_id, a.accion, a.detalle, a.creado_en,
              CONCAT(u.nombres,' ',IFNULL(u.apellidos,'')) AS usuario_nombre
       FROM auditoria_clinica a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.clinica_id=? AND a.modulo='odontologia' AND a.paciente_id=?
       ORDER BY a.creado_en DESC, a.id DESC LIMIT 100`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  HISTORIA ODONTOLÓGICA
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/historia/:paciente_id
router.get("/historia/:paciente_id", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT * FROM historia_odontologica WHERE clinica_id=? AND paciente_id=?`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/historia/:paciente_id  (upsert)
router.post("/historia/:paciente_id", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const f = req.body;

    await pool.query(
      `INSERT INTO historia_odontologica
        (clinica_id, paciente_id, motivo_consulta_inicial, fecha_ultima_consulta,
         complicaciones_previas, antecedentes, medicamentos, frecuencia_cepillado,
         usa_hilo_dental, usa_enjuague, habitos_nocivos,
         diabetes, hipertension, anticoagulantes, alergia_anestesia, alergia_latex,
         otras_condiciones, ortodoncia_previa, extracciones_previas,
         implantes_previos, protesis_actual, tratamientos_previos,
         historia_familiar, notas, declaracion_veraz, firma_paciente_nombre, firma_fecha)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         motivo_consulta_inicial=VALUES(motivo_consulta_inicial),
         fecha_ultima_consulta=VALUES(fecha_ultima_consulta),
         complicaciones_previas=VALUES(complicaciones_previas),
         antecedentes=VALUES(antecedentes), medicamentos=VALUES(medicamentos),
         frecuencia_cepillado=VALUES(frecuencia_cepillado),
         usa_hilo_dental=VALUES(usa_hilo_dental), usa_enjuague=VALUES(usa_enjuague),
         habitos_nocivos=VALUES(habitos_nocivos),
         diabetes=VALUES(diabetes), hipertension=VALUES(hipertension),
         anticoagulantes=VALUES(anticoagulantes), alergia_anestesia=VALUES(alergia_anestesia),
         alergia_latex=VALUES(alergia_latex), otras_condiciones=VALUES(otras_condiciones),
         ortodoncia_previa=VALUES(ortodoncia_previa), extracciones_previas=VALUES(extracciones_previas),
         implantes_previos=VALUES(implantes_previos), protesis_actual=VALUES(protesis_actual),
         tratamientos_previos=VALUES(tratamientos_previos),
         historia_familiar=VALUES(historia_familiar), notas=VALUES(notas),
         declaracion_veraz=VALUES(declaracion_veraz),
         firma_paciente_nombre=VALUES(firma_paciente_nombre), firma_fecha=VALUES(firma_fecha),
         actualizado_en=NOW()`,
      [
        cid, pid,
        f.motivo_consulta_inicial || null, f.fecha_ultima_consulta || null,
        f.complicaciones_previas || null,
        f.antecedentes ? JSON.stringify(f.antecedentes) : JSON.stringify([]),
        f.medicamentos ? JSON.stringify(f.medicamentos) : JSON.stringify([]),
        f.frecuencia_cepillado || null,
        f.usa_hilo_dental ? 1 : 0, f.usa_enjuague ? 1 : 0, f.habitos_nocivos || null,
        f.diabetes ? 1 : 0, f.hipertension ? 1 : 0,
        f.anticoagulantes ? 1 : 0, f.alergia_anestesia ? 1 : 0, f.alergia_latex ? 1 : 0,
        f.otras_condiciones || null,
        f.ortodoncia_previa ? 1 : 0, f.extracciones_previas || null,
        f.implantes_previos ? 1 : 0, f.protesis_actual || null,
        f.tratamientos_previos || null, f.historia_familiar || null, f.notas || null,
        f.declaracion_veraz ? 1 : 0, f.firma_paciente_nombre || null,
        f.firma_paciente_nombre ? new Date() : null
      ]
    );
    const [[row]] = await pool.query(
      `SELECT * FROM historia_odontologica WHERE clinica_id=? AND paciente_id=?`, [cid, pid]
    );
    await auditar(req, { entidad: "historia", entidad_id: row?.id, paciente_id: pid, accion: "GUARDAR_HISTORIA" });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PLAN DE TRATAMIENTO
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/odontologia/plan/:paciente_id
router.get("/plan/:paciente_id", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [[row]] = await pool.query(
      `SELECT * FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, req.params.paciente_id]
    );
    res.json({ ok: true, data: row || null });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// POST /api/odontologia/plan/:paciente_id  (upsert)
router.post("/plan/:paciente_id", auth(...ROLES_ESCRITURA), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;
    const uid = req.user.id;
    const { items = [], fases = [], notas, costo_total, vigencia_dias, formas_pago, nota_clinica } = req.body;

    const costoCalc = fases.reduce(
      (sTot, f) => sTot + (f.items || []).reduce((s, i) => s + (parseFloat(i.costo_estimado) || 0), 0),
      0
    );

    // Estado anterior: si el plan ya existía y aún no tiene historial, se conserva como versión 1
    const [[previo]] = await pool.query(
      `SELECT * FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=?`, [cid, pid]
    );
    if (previo) {
      const [[{ n }]] = await pool.query(
        "SELECT COUNT(*) AS n FROM plan_tratamiento_historial WHERE clinica_id=? AND paciente_id=?", [cid, pid]
      );
      if (n === 0) await versionPlan(cid, pid, previo, { origen: "INICIAL", usuarioId: null });
    }

    await pool.query(
      `INSERT INTO plan_tratamiento_odontologia
        (clinica_id, paciente_id, dentista_id, items, fases, costo_total, vigencia_dias, formas_pago, nota_clinica, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         items=VALUES(items), fases=VALUES(fases), costo_total=VALUES(costo_total),
         vigencia_dias=VALUES(vigencia_dias), formas_pago=VALUES(formas_pago),
         nota_clinica=VALUES(nota_clinica),
         notas=VALUES(notas), actualizado_en=NOW()`,
      [
        cid, pid, uid, JSON.stringify(items), JSON.stringify(fases),
        costo_total ?? costoCalc, vigencia_dias || 90,
        formas_pago || 'Efectivo, Tarjeta, Transferencia', nota_clinica || null,
        notas || null
      ]
    );
    const [[row]] = await pool.query(
      `SELECT * FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=?`, [cid, pid]
    );

    // Nueva versión solo si el contenido cambió respecto a la última
    const [[ultima]] = await pool.query(
      `SELECT fases, costo_total, vigencia_dias, formas_pago, nota_clinica
       FROM plan_tratamiento_historial WHERE clinica_id=? AND paciente_id=? ORDER BY version DESC LIMIT 1`, [cid, pid]
    );
    const contenido = (r) => estable([parseJsonArr(r.fases), Number(r.costo_total) || 0, r.vigencia_dias || 0, r.formas_pago || "", r.nota_clinica || ""]);
    const versionNueva = !ultima || contenido(ultima) !== contenido(row);
    if (versionNueva) await versionPlan(cid, pid, row, { origen: "GUARDADO", usuarioId: uid });

    await auditar(req, { entidad: "plan", entidad_id: row?.id, paciente_id: pid, accion: "GUARDAR_PLAN",
                         detalle: { costo_total: row?.costo_total, nueva_version: versionNueva } });
    res.json({ ok: true, data: row });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/odontologia/plan/:paciente_id/versiones  → historial de versiones (resumen)
router.get("/plan/:paciente_id/versiones", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const [rows] = await pool.query(
      `SELECT h.id, h.version, h.origen, h.fases, h.costo_total, h.creado_en,
              CONCAT(u.nombres,' ',IFNULL(u.apellidos,'')) AS usuario_nombre
       FROM plan_tratamiento_historial h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.clinica_id=? AND h.paciente_id=?
       ORDER BY h.version DESC LIMIT 50`,
      [cid, req.params.paciente_id]
    );
    const data = rows.map(r => {
      const items = parseJsonArr(r.fases).flatMap(f => f.items || []);
      return {
        id: r.id, version: r.version, origen: r.origen, costo_total: r.costo_total, creado_en: r.creado_en,
        usuario_nombre: r.usuario_nombre, total_items: items.length, completados: items.filter(i => i.completado).length,
        fases: parseJsonArr(r.fases),
      };
    });
    res.json({ ok: true, data });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// GET /api/odontologia/resumen/:paciente_id
router.get("/resumen/:paciente_id", auth(...ROLES), MOD, async (req, res) => {
  try {
    const cid = req.user.clinica_id;
    const pid = req.params.paciente_id;

    const [[{ total_sesiones }]] = await pool.query(
      `SELECT COUNT(*) AS total_sesiones FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, pid]
    );
    const [[{ sesiones_firmadas }]] = await pool.query(
      `SELECT COUNT(*) AS sesiones_firmadas FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=? AND estado='FIRMADA'`,
      [cid, pid]
    );
    const [[ultima]] = await pool.query(
      `SELECT creado_en FROM sesiones_odontologia WHERE clinica_id=? AND paciente_id=? ORDER BY creado_en DESC LIMIT 1`,
      [cid, pid]
    );
    const [[plan]] = await pool.query(
      `SELECT fases, costo_total FROM plan_tratamiento_odontologia WHERE clinica_id=? AND paciente_id=?`,
      [cid, pid]
    );

    let pendientes = 0, completados = 0;
    if (plan?.fases) {
      const fases = typeof plan.fases === 'string' ? JSON.parse(plan.fases) : plan.fases;
      const items = (fases || []).flatMap(f => f.items || []);
      pendientes  = items.filter(i => !i.completado).length;
      completados = items.filter(i => i.completado).length;
    }

    res.json({
      ok: true,
      data: {
        total_sesiones,
        sesiones_firmadas,
        ultima_sesion: ultima?.creado_en || null,
        plan_pendientes: pendientes,
        plan_completados: completados,
        costo_total: plan?.costo_total || 0
      }
    });
  } catch (e) { res.status(500).json({ ok: false, msg: e.message }); }
});

module.exports = router;
