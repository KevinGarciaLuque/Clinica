/**
 * routes/novedades.js — Novedades de la plataforma  (/api/novedades)
 *
 * El SUPER_ADMIN publica las mejoras ("¿Qué hay de nuevo?") y cada usuario de
 * las clínicas las ve en el botón ✨ Novedades de la barra superior. Las marcadas
 * como importantes se muestran una vez en una ventana al entrar.
 *
 * Tablas nuevas (no modifica ninguna existente):
 *   novedades         cada anuncio (versión, título, descripción, audiencia…)
 *   novedades_vistas  hasta qué anuncio vio cada usuario
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");

const AUDIENCIAS = ["TODOS", "MEDICOS", "ADMIN"];

let tablasListas = null;
function asegurarTablas() {
  if (!tablasListas) {
    tablasListas = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS novedades (
          id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          version      VARCHAR(20) NULL,
          titulo       VARCHAR(150) NOT NULL,
          descripcion  TEXT NOT NULL,
          icono        VARCHAR(40) NULL COMMENT 'clase Bootstrap Icons, p. ej. bi-calendar-check',
          imagen_url   VARCHAR(500) NULL,
          audiencia    ENUM('TODOS','MEDICOS','ADMIN') NOT NULL DEFAULT 'TODOS',
          importante   TINYINT(1) NOT NULL DEFAULT 0,
          publicada    TINYINT(1) NOT NULL DEFAULT 1,
          publicado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
          creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_nov_publicada (publicada, publicado_en)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS novedades_vistas (
          usuario_id      INT UNSIGNED NOT NULL PRIMARY KEY,
          ultima_vista_id INT UNSIGNED NOT NULL DEFAULT 0,
          visto_en        DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      // Quién vio cada novedad y cuándo (una fila por novedad y usuario)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS novedades_lecturas (
          novedad_id  INT UNSIGNED NOT NULL,
          usuario_id  INT UNSIGNED NOT NULL,
          visto_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
          aproximado  TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = vista anterior a este registro; la hora es aproximada',
          PRIMARY KEY (novedad_id, usuario_id),
          INDEX idx_nl_usuario (usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await sembrarIniciales();
      await sincronizarDesdeArchivo();
      await respaldarLecturasAnteriores();
    })().catch((e) => { tablasListas = null; throw e; });
  }
  return tablasListas;
}

// Anuncios iniciales con las mejoras ya publicadas (una sola vez)
async function sembrarIniciales() {
  await pool.query(`CREATE TABLE IF NOT EXISTS migraciones_unicas (
    clave VARCHAR(100) PRIMARY KEY, aplicada_en DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [m] = await pool.query("INSERT IGNORE INTO migraciones_unicas (clave) VALUES ('novedades_iniciales_v1')");
  if (!m.affectedRows) return;
  const iniciales = [
    ["1.1", "bi-check2-circle", "TODOS", 0, "Confirmar o cancelar desde el recordatorio",
      "Los recordatorios de cita ahora traen un botón para que el paciente confirme o cancele con un clic. La cita cambia de estado sola y te llega el aviso a la campanita."],
    ["1.2", "bi-person-heart", "TODOS", 0, "Portal del paciente",
      "Tus pacientes pueden entrar en medickg.com/portal con su correo (sin contraseña) para ver sus citas, recetas y estudios, y confirmar o cancelar sus próximas citas."],
    ["1.3", "bi-hourglass-split", "TODOS", 0, "Lista de espera automática",
      "En Citas → Lista de espera anota a los pacientes que quieren un espacio antes. Cuando una cita se cancela, el sistema les ofrece el horario por correo y el primero que acepta queda agendado."],
    ["1.4", "bi-graph-up-arrow", "ADMIN", 0, "Tablero de asistencia",
      "En Estadísticas ahora ves tu tasa de asistencia, cuántos pacientes faltan o cancelan, el efecto de los recordatorios y qué pacientes faltan seguido."],
    ["1.5", "bi-qr-code", "TODOS", 1, "Tu perfil público con QR y estadísticas",
      "En el Dashboard tienes tu enlace y tu código QR para compartir o imprimir, y ves cuántas personas visitan tu página, de dónde llegan (Google, Facebook, QR…) y cuántas agendan."],
    ["1.6", "bi-star-fill", "TODOS", 1, "Opiniones verificadas de pacientes",
      "Activa desde el Dashboard la encuesta automática: al día siguiente de la consulta el paciente califica su atención. Tú eliges qué comentarios publicar en tu página, y a quienes te dan 5 estrellas se les invita a dejar reseña en Google."],
    ["1.7", "bi-arrow-repeat", "MEDICOS", 0, "Recordatorio de control",
      "Desde el detalle de una cita usa el botón “Control” (1 mes, 3 meses…). Siete días antes el paciente recibe un correo para agendar, y en Citas → Controles ves a quién hay que llamar."],
    ["1.8", "bi-calendar2-range", "TODOS", 0, "Citas que se repiten",
      "Al crear una cita elige “Se repite”: cada semana, cada 2 semanas o cada mes, como en Google Calendar. Ideal para terapias, controles y tratamientos por sesiones."],
    ["1.9", "bi-gender-ambiguous", "MEDICOS", 0, "Dr. o Dra. automático",
      "En Mi perfil elige tu sexo y el sistema escribirá “Dr.” o “Dra.” en citas, recetas, tu página pública y los correos a tus pacientes."],
  ];
  for (const [i, [version, icono, audiencia, importante, titulo, descripcion]] of iniciales.entries()) {
    await pool.query(
      `INSERT INTO novedades (version, icono, audiencia, importante, titulo, descripcion, publicado_en)
       VALUES (?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? MINUTE)`,
      [version, icono, audiencia, importante, titulo, descripcion, iniciales.length - i]);
  }
}

// Publica las novedades de backend/data/novedades.js que aún no existan (por clave)
async function sincronizarDesdeArchivo() {
  const [col] = await pool.query("SHOW COLUMNS FROM novedades LIKE 'clave'");
  if (!col.length) {
    await pool.query("ALTER TABLE novedades ADD COLUMN clave VARCHAR(80) NULL UNIQUE AFTER id");
  }
  let lista = [];
  try { lista = require("../data/novedades"); } catch { return; }
  for (const n of lista) {
    if (!n?.clave || !n.titulo || !n.descripcion) continue;
    await pool.query(
      `INSERT IGNORE INTO novedades (clave, version, titulo, descripcion, icono, audiencia, importante)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(n.clave).slice(0, 80), n.version || null, String(n.titulo).slice(0, 150), String(n.descripcion),
       n.icono || "bi-stars", AUDIENCIAS.includes(n.audiencia) ? n.audiencia : "TODOS", n.importante ? 1 : 0]);
  }
}

// Las vistas registradas antes de existir novedades_lecturas solo guardaban "hasta qué
// novedad llegó" y la última hora: se pasan una vez, marcadas como aproximadas.
async function respaldarLecturasAnteriores() {
  const [m] = await pool.query("INSERT IGNORE INTO migraciones_unicas (clave) VALUES ('novedades_lecturas_respaldo')");
  if (!m.affectedRows) return;
  await pool.query(
    `INSERT IGNORE INTO novedades_lecturas (novedad_id, usuario_id, visto_en, aproximado)
     SELECT n.id, v.usuario_id, v.visto_en, 1
     FROM novedades_vistas v
     JOIN usuarios u ON u.id = v.usuario_id
     JOIN novedades n ON n.id <= v.ultima_vista_id AND n.publicada = 1
       AND (n.audiencia = 'TODOS'
            OR (n.audiencia = 'MEDICOS' AND u.tipo IN ('MEDICO','PSICOLOGO','ADMIN'))
            OR (n.audiencia = 'ADMIN' AND u.tipo = 'ADMIN'))`);
}

// Qué audiencias ve cada rol
function audienciasDe(tipo) {
  if (tipo === "SUPER_ADMIN") return AUDIENCIAS;
  if (tipo === "ADMIN") return ["TODOS", "ADMIN", "MEDICOS"]; // el admin también ve lo de los médicos
  if (["MEDICO", "PSICOLOGO"].includes(tipo)) return ["TODOS", "MEDICOS"];
  return ["TODOS"];
}

const versionActual = async () => {
  const [[v]] = await pool.query(
    "SELECT version FROM novedades WHERE publicada=1 AND version IS NOT NULL AND version<>'' ORDER BY publicado_en DESC, id DESC LIMIT 1");
  return v?.version || "1.0";
};

// ── GET /api/novedades → lista para el usuario + no leídas + versión ─────────
router.get("/", auth(), async (req, res) => {
  try {
    await asegurarTablas();
    const uid = req.user.uid ?? req.user.id;
    const [rows] = await pool.query(
      `SELECT id, version, titulo, descripcion, icono, imagen_url, importante,
              DATE_FORMAT(publicado_en, '%Y-%m-%d') AS fecha
       FROM novedades
       WHERE publicada = 1 AND publicado_en <= NOW() AND audiencia IN (?)
       ORDER BY publicado_en DESC, id DESC
       LIMIT 40`, [audienciasDe(req.user.tipo)]);
    const [[v]] = await pool.query("SELECT ultima_vista_id FROM novedades_vistas WHERE usuario_id=?", [uid]);
    const ultima = v?.ultima_vista_id || 0;
    const nuevas = rows.filter((r) => r.id > ultima);
    res.json({
      ok: true,
      data: {
        version: await versionActual(),
        novedades: rows.map((r) => ({ ...r, importante: Boolean(r.importante), nueva: r.id > ultima })),
        no_leidas: nuevas.length,
        // Ventana al entrar: importantes que aún no vio (como mucho 3)
        // (el SUPER_ADMIN es quien las publica: a él no se le muestra la ventana)
        anuncio: req.user.tipo === "SUPER_ADMIN" ? [] : nuevas.filter((r) => r.importante).slice(0, 3).map((r) => r.id),
      },
    });
  } catch (e) {
    console.error("[novedades] GET:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar las novedades" });
  }
});

// ── POST /api/novedades/vistas → marca todo como visto ───────────────────────
router.post("/vistas", auth(), async (req, res) => {
  try {
    await asegurarTablas();
    const uid = req.user.uid ?? req.user.id;
    const [[m]] = await pool.query("SELECT COALESCE(MAX(id),0) AS maxid FROM novedades WHERE publicada=1 AND publicado_en <= NOW()");
    await pool.query(
      `INSERT INTO novedades_vistas (usuario_id, ultima_vista_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE ultima_vista_id = GREATEST(ultima_vista_id, VALUES(ultima_vista_id)), visto_en = NOW()`,
      [uid, m.maxid]);
    // Una fila por cada novedad visible para este usuario que aún no había visto
    await pool.query(
      `INSERT IGNORE INTO novedades_lecturas (novedad_id, usuario_id)
       SELECT id, ? FROM novedades
       WHERE publicada = 1 AND publicado_en <= NOW() AND audiencia IN (?)`,
      [uid, audienciasDe(req.user.tipo)]);
    res.json({ ok: true });
  } catch (e) {
    console.error("[novedades] vistas:", e.message);
    res.status(500).json({ ok: false });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// SUPER_ADMIN: administrar anuncios
// ═════════════════════════════════════════════════════════════════════════════
function validar(body) {
  const titulo = String(body?.titulo || "").trim().slice(0, 150);
  const descripcion = String(body?.descripcion || "").trim().slice(0, 4000);
  if (!titulo || !descripcion) return { error: "Título y descripción son obligatorios" };
  const imagen = String(body?.imagen_url || "").trim();
  if (imagen && !/^https:\/\//.test(imagen)) return { error: "La imagen debe ser un enlace https://" };
  const icono = String(body?.icono || "").trim();
  return {
    datos: {
      version: String(body?.version || "").trim().slice(0, 20) || null,
      titulo, descripcion,
      icono: /^bi-[a-z0-9-]{1,35}$/.test(icono) ? icono : null,
      imagen_url: imagen || null,
      audiencia: AUDIENCIAS.includes(body?.audiencia) ? body.audiencia : "TODOS",
      importante: body?.importante ? 1 : 0,
      publicada: body?.publicada === false ? 0 : 1,
    },
  };
}

router.get("/admin", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTablas();
    const [rows] = await pool.query(
      `SELECT n.*, DATE_FORMAT(n.publicado_en, '%Y-%m-%d %H:%i') AS publicado_txt,
              (SELECT COUNT(*) FROM novedades_lecturas l JOIN usuarios u ON u.id = l.usuario_id
                WHERE l.novedad_id = n.id AND u.tipo <> 'SUPER_ADMIN') AS vistas
       FROM novedades n ORDER BY n.publicado_en DESC, n.id DESC LIMIT 200`);
    res.json({ ok: true, data: { novedades: rows, version: await versionActual() } });
  } catch (e) {
    console.error("[novedades] admin:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudieron cargar" });
  }
});

// GET /api/novedades/:id/lecturas → quién la vio (usuario, clínica, hora) y quién falta
router.get("/:id/lecturas", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTablas();
    const [[n]] = await pool.query("SELECT id, titulo, version, audiencia FROM novedades WHERE id=?", [req.params.id]);
    if (!n) return res.status(404).json({ ok: false, msg: "No encontrada" });
    // A quién va dirigida (usuarios activos de clínicas, sin SUPER_ADMIN)
    const roles = n.audiencia === "ADMIN" ? ["ADMIN"]
      : n.audiencia === "MEDICOS" ? ["MEDICO", "PSICOLOGO", "ADMIN"] : null;
    const filtroRol = roles ? "AND u.tipo IN (?)" : "";
    const params = roles ? [n.id, roles] : [n.id];
    const [usuarios] = await pool.query(
      `SELECT u.id, u.nombres, u.apellidos, u.nombre_display, u.email, u.tipo,
              c.id AS clinica_id, c.nombre AS clinica,
              DATE_FORMAT(l.visto_en, '%Y-%m-%d %H:%i') AS visto_en, l.aproximado
       FROM usuarios u
       LEFT JOIN clinicas c ON c.id = u.clinica_id
       LEFT JOIN novedades_lecturas l ON l.usuario_id = u.id AND l.novedad_id = ?
       WHERE u.activo = 1 AND u.tipo <> 'SUPER_ADMIN' AND (c.id IS NULL OR c.activo = 1) ${filtroRol}
       ORDER BY l.visto_en IS NULL, l.visto_en DESC, c.nombre, u.nombres`, params);
    const fila = (u) => ({
      id: u.id,
      nombre: (u.nombre_display || `${u.nombres} ${u.apellidos}`).trim(),
      email: u.email, tipo: u.tipo, clinica: u.clinica || "—",
      visto_en: u.visto_en, aproximado: Boolean(u.aproximado),
    });
    res.json({
      ok: true,
      data: {
        novedad: n,
        vieron: usuarios.filter((u) => u.visto_en).map(fila),
        pendientes: usuarios.filter((u) => !u.visto_en).map(fila),
      },
    });
  } catch (e) {
    console.error("[novedades] lecturas:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo cargar quién la vio" });
  }
});

router.post("/", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTablas();
    const { error, datos } = validar(req.body);
    if (error) return res.status(400).json({ ok: false, msg: error });
    const [r] = await pool.query(
      `INSERT INTO novedades (version, titulo, descripcion, icono, imagen_url, audiencia, importante, publicada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.version, datos.titulo, datos.descripcion, datos.icono, datos.imagen_url, datos.audiencia, datos.importante, datos.publicada]);
    res.status(201).json({ ok: true, id: r.insertId });
  } catch (e) {
    console.error("[novedades] POST:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo publicar" });
  }
});

router.put("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTablas();
    const { error, datos } = validar(req.body);
    if (error) return res.status(400).json({ ok: false, msg: error });
    const [r] = await pool.query(
      `UPDATE novedades SET version=?, titulo=?, descripcion=?, icono=?, imagen_url=?, audiencia=?, importante=?, publicada=?
       WHERE id=?`,
      [datos.version, datos.titulo, datos.descripcion, datos.icono, datos.imagen_url, datos.audiencia, datos.importante, datos.publicada, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "No encontrada" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[novedades] PUT:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo guardar" });
  }
});

router.delete("/:id", auth("SUPER_ADMIN"), async (req, res) => {
  try {
    await asegurarTablas();
    await pool.query("DELETE FROM novedades WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("[novedades] DELETE:", e.message);
    res.status(500).json({ ok: false, msg: "No se pudo eliminar" });
  }
});

module.exports = router;
module.exports.asegurarTablas = asegurarTablas;
