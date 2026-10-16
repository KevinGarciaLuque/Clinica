/**
 * utils/listaEspera.js
 * Lista de espera: cuando una cita se cancela, se ofrece el espacio por correo
 * a los primeros pacientes en espera de ese médico. El primero que acepta se
 * queda con el espacio (se crea su cita CONFIRMADA); los demás ven "ya fue tomado".
 *
 * Tablas nuevas (no modifica ninguna existente):
 *   lista_espera          pacientes esperando un espacio
 *   lista_espera_espacios un registro por cita cancelada ofrecida (evita dobles ofertas
 *                         y decide quién se queda con el espacio)
 *   lista_espera_ofertas  cada correo enviado, con su token aleatorio
 */
const crypto = require("crypto");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));
const pool = require("../db");
const { enviarEmail } = require("./mailer");
const { urlPublica } = require("./urlPublica");

const OFERTAS_POR_ESPACIO = 3;
const HORAS_MINIMAS = 2; // no se ofrecen espacios que empiezan en menos de 2 horas

let tablasListas = null;
function asegurarTablas() {
  if (!tablasListas) {
    tablasListas = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lista_espera (
          id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          clinica_id   INT UNSIGNED NOT NULL,
          paciente_id  INT UNSIGNED NOT NULL,
          medico_id    INT UNSIGNED NULL COMMENT 'NULL = cualquier médico',
          desde        DATE NOT NULL,
          hasta        DATE NULL,
          nota         VARCHAR(300) NULL,
          estado       ENUM('ACTIVA','AGENDADA','CANCELADA') NOT NULL DEFAULT 'ACTIVA',
          cita_id      INT UNSIGNED NULL,
          creado_por   INT UNSIGNED NULL,
          creado_en    DATETIME DEFAULT CURRENT_TIMESTAMP,
          actualizado_en DATETIME NULL,
          INDEX idx_le_clinica_estado (clinica_id, estado, creado_en),
          INDEX idx_le_paciente (paciente_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lista_espera_espacios (
          cita_origen_id  INT UNSIGNED NOT NULL PRIMARY KEY,
          clinica_id      INT UNSIGNED NOT NULL,
          medico_id       INT UNSIGNED NOT NULL,
          inicio          DATETIME NOT NULL,
          fin             DATETIME NOT NULL,
          tomado_oferta_id INT UNSIGNED NULL,
          cita_nueva_id   INT UNSIGNED NULL,
          creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lista_espera_ofertas (
          id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          cita_origen_id  INT UNSIGNED NOT NULL,
          lista_espera_id INT UNSIGNED NOT NULL,
          token           CHAR(64) NOT NULL UNIQUE,
          estado          ENUM('ENVIADA','ACEPTADA','RECHAZADA','TARDE','ERROR') NOT NULL DEFAULT 'ENVIADA',
          enviado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
          respondido_en   DATETIME NULL,
          INDEX idx_leo_origen (cita_origen_id),
          INDEX idx_leo_lista (lista_espera_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch((e) => { tablasListas = null; throw e; });
  }
  return tablasListas;
}

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function etiquetaFecha(inicio) {
  const d = dayjs(inicio);
  const fecha = d.toDate().toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long" });
  return `${fecha.charAt(0).toUpperCase() + fecha.slice(1)} a las ${d.format("h:mm A")}`;
}

/** ¿El médico tiene ese horario libre? (ignora la cita indicada) */
async function horarioLibre(conn, { medico_id, inicio, fin, ignorarCitaId = 0 }) {
  const [[ocupada]] = await conn.query(
    `SELECT id FROM citas
     WHERE medico_id = ? AND id <> ? AND estado NOT IN ('CANCELADA','NO_ASISTIO')
       AND inicio < ? AND fin > ? LIMIT 1`,
    [medico_id, ignorarCitaId, fin, inicio]
  );
  return !ocupada;
}

/**
 * Se llama cuando una cita queda CANCELADA. Nunca lanza error y nunca bloquea
 * la cancelación: si algo falla, solo se registra en el log.
 */
async function ofrecerEspacio(citaId) {
  try {
    await asegurarTablas();
    const [[cita]] = await pool.query(
      `SELECT c.id, c.clinica_id, c.medico_id, c.paciente_id, c.estado,
              DATE_FORMAT(c.inicio, '%Y-%m-%d %H:%i:%s') AS inicio,
              DATE_FORMAT(c.fin,    '%Y-%m-%d %H:%i:%s') AS fin,
              cl.nombre AS clinica, COALESCE(cl.timezone, 'America/Tegucigalpa') AS tz,
              CONCAT(u.nombres, ' ', u.apellidos) AS medico
       FROM citas c
       JOIN clinicas cl ON cl.id = c.clinica_id
       JOIN usuarios u  ON u.id = c.medico_id
       WHERE c.id = ?`,
      [citaId]
    );
    if (!cita || cita.estado !== "CANCELADA") return;

    const limite = dayjs().tz(cita.tz).add(HORAS_MINIMAS, "hour").format("YYYY-MM-DD HH:mm:ss");
    if (cita.inicio <= limite) return;
    if (!process.env.FRONTEND_URL) return;

    // Un espacio se ofrece una sola vez aunque la cita se cancele varias veces
    const [ins] = await pool.query(
      `INSERT IGNORE INTO lista_espera_espacios (cita_origen_id, clinica_id, medico_id, inicio, fin)
       VALUES (?, ?, ?, ?, ?)`,
      [cita.id, cita.clinica_id, cita.medico_id, cita.inicio, cita.fin]
    );
    if (!ins.affectedRows) return;
    if (!(await horarioLibre(pool, { ...cita, ignorarCitaId: cita.id }))) return;

    const fechaCita = cita.inicio.slice(0, 10);
    const [candidatos] = await pool.query(
      `SELECT le.id, p.nombres, p.email
       FROM lista_espera le
       JOIN pacientes p ON p.id = le.paciente_id
       WHERE le.clinica_id = ? AND le.estado = 'ACTIVA'
         AND (le.medico_id = ? OR le.medico_id IS NULL)
         AND le.desde <= ? AND (le.hasta IS NULL OR le.hasta >= ?)
         AND le.paciente_id <> ?
         AND p.activo = 1 AND p.email IS NOT NULL AND p.email <> ''
         AND NOT EXISTS (
           SELECT 1 FROM citas c2
           WHERE c2.paciente_id = le.paciente_id AND c2.estado NOT IN ('CANCELADA','NO_ASISTIO')
             AND c2.inicio < ? AND c2.fin > ?)
       ORDER BY le.creado_en ASC
       LIMIT ?`,
      [cita.clinica_id, cita.medico_id, fechaCita, fechaCita, cita.paciente_id, cita.fin, cita.inicio, OFERTAS_POR_ESPACIO]
    );

    const base = urlPublica();
    for (const c of candidatos) {
      const token = crypto.randomBytes(32).toString("hex");
      const [o] = await pool.query(
        "INSERT INTO lista_espera_ofertas (cita_origen_id, lista_espera_id, token) VALUES (?, ?, ?)",
        [cita.id, c.id, token]
      );
      try {
        await enviarEmail({
          to: c.email,
          subject: `Se liberó un espacio: ${etiquetaFecha(cita.inicio)}`,
          html: plantillaOferta({
            nombre: String(c.nombres || "").split(" ")[0],
            fecha: etiquetaFecha(cita.inicio),
            medico: cita.medico,
            clinica: cita.clinica,
            link: `${base}/espacio/${token}`,
          }),
        });
      } catch (e) {
        await pool.query("UPDATE lista_espera_ofertas SET estado='ERROR' WHERE id=?", [o.insertId]);
        console.error("[listaEspera] correo:", e.message);
      }
    }
    if (candidatos.length) {
      console.log(`📨 [listaEspera] Cita #${cita.id} cancelada: espacio ofrecido a ${candidatos.length} paciente(s)`);
    }
  } catch (e) {
    console.error("[listaEspera] ofrecerEspacio:", e.message);
  }
}

function plantillaOferta({ nombre, fecha, medico, clinica, link }) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:24px">
    <div style="background:#fff;border-radius:12px;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#0f766e;margin:0 0 8px">¡Se liberó un espacio, ${esc(nombre)}!</h2>
      <p style="color:#475569">Estabas en la lista de espera de <strong>${esc(clinica)}</strong> y hay un espacio disponible:</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:16px 0;color:#0f172a">
        📅 <strong>${esc(fecha)}</strong><br/>👨‍⚕️ ${esc(medico)}
      </div>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Quiero este espacio</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">Se lo ofrecimos a otras personas en la lista: el primero que lo acepte se queda con él.</p>
    </div>
  </div>`;
}

module.exports = { asegurarTablas, ofrecerEspacio, horarioLibre, etiquetaFecha };
