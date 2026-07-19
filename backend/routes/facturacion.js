/**
 * routes/facturacion.js
 * Módulo de facturación — recibos internos + facturas con numeración CAI (SAR Honduras).
 * GET    /api/facturacion             → listar (filtros: estado, desde, hasta, paciente_id)
 * GET    /api/facturacion/:id         → detalle (items + pagos)
 * POST   /api/facturacion             → crear (manual o automática)
 * PUT    /api/facturacion/:id         → editar mientras esté PENDIENTE
 * POST   /api/facturacion/:id/pagos   → registrar pago (permite parciales)
 * POST   /api/facturacion/:id/anular  → anular (ADMIN/SUPER_ADMIN)
 * GET    /api/facturacion/:id/pdf     → generar PDF
 */
const router = require("express").Router();
const pool   = require("../db");
const auth   = require("../middlewares/auth");
const { generarPdfDesdeHtml } = require("../utils/pdfFromHtml");

function escHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Convierte un número a su representación en letras (español), para el "Valor en letras" de la factura.
function numeroALetras(num) {
  const entero = Math.floor(Math.abs(Number(num) || 0));
  const centavos = Math.round((Math.abs(Number(num) || 0) - entero) * 100);

  const unidades = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const especiales = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  function convertirGrupo(n) {
    let out = "";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (n === 100) return "CIEN";
    if (c > 0) out += centenas[c] + " ";
    if (d === 1) { out += especiales[u] + " "; return out.trim(); }
    if (d === 2 && u > 0) { out += "VEINTI" + unidades[u] + " "; return out.trim(); }
    if (d > 0) out += decenas[d] + (u > 0 ? " Y " : " ");
    if (u > 0) out += unidades[u] + " ";
    return out.trim();
  }

  function convertir(n) {
    if (n === 0) return "CERO";
    let out = "";
    const millones = Math.floor(n / 1000000);
    const miles = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;
    if (millones > 0) out += (millones === 1 ? "UN MILLÓN " : convertirGrupo(millones) + " MILLONES ");
    if (miles > 0) out += (miles === 1 ? "MIL " : convertirGrupo(miles) + " MIL ");
    if (resto > 0) out += convertirGrupo(resto);
    return out.trim();
  }

  const letras = convertir(entero);
  return `${letras} LEMPIRAS CON ${String(centavos).padStart(2, "0")}/100`;
}


async function getClinicaConfig(clinicaId, claves) {
  const [rows] = await pool.query(
    `SELECT clave, valor FROM clinica_config WHERE clinica_id=? AND clave IN (${claves.map(() => "?").join(",")})`,
    [clinicaId, ...claves]
  );
  const map = {};
  rows.forEach(r => { map[r.clave] = r.valor; });
  return map;
}

async function recalcularTotales(conn, facturaId) {
  const [[sub]] = await conn.query(
    "SELECT COALESCE(SUM(total),0) AS bruto FROM factura_items WHERE factura_id=?",
    [facturaId]
  );
  const [[factura]] = await conn.query("SELECT isv_porcentaje FROM facturas WHERE id=?", [facturaId]);
  // Los precios se ingresan con ISV incluido: el impuesto se extrae por dentro del monto.
  const bruto = Number(sub.bruto);
  const isv = Number(factura?.isv_porcentaje ?? 15);
  const subtotal = isv > 0 ? Math.round((bruto / (1 + isv / 100)) * 100) / 100 : bruto;
  const impuestos = Math.round((bruto - subtotal) * 100) / 100;
  const total = Math.round(bruto * 100) / 100;
  await conn.query(
    "UPDATE facturas SET subtotal=?, impuestos=?, total=? WHERE id=?",
    [subtotal, impuestos, total, facturaId]
  );
  return { subtotal, impuestos, total };
}

// ── GET / — listar ──────────────────────────────────────────────────────────
router.get("/", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const { estado, desde, hasta, paciente_id } = req.query;

    let sql = `
      SELECT f.*, p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
             u.nombres AS medico_nombres, u.apellidos AS medico_apellidos,
             COALESCE((SELECT SUM(monto) FROM pagos WHERE factura_id=f.id), 0) AS total_pagado
      FROM facturas f
      JOIN pacientes p ON p.id = f.paciente_id
      LEFT JOIN usuarios u ON u.id = f.medico_id
      WHERE f.clinica_id = ?
    `;
    const params = [clinicaId];

    if (req.user.tipo === "MEDICO") {
      sql += " AND f.medico_id = ? ";
      params.push(req.user.id);
    }
    if (estado) { sql += " AND f.estado = ? "; params.push(estado); }
    if (desde)  { sql += " AND DATE(f.creado_en) >= ? "; params.push(desde); }
    if (hasta)  { sql += " AND DATE(f.creado_en) <= ? "; params.push(hasta); }
    if (paciente_id) { sql += " AND f.paciente_id = ? "; params.push(paciente_id); }

    sql += " ORDER BY f.creado_en DESC LIMIT 500";

    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /prefill — datos precargados para una nueva factura ─────────────────
// Query: ?paciente_id=&cita_id=  → resuelve cliente (paciente o responsable si es menor)
// y el ítem de consulta con su precio (según el tipo de cita).
router.get("/prefill", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    let { paciente_id, cita_id } = req.query;

    let cita = null;
    if (cita_id) {
      const [[c]] = await pool.query(
        "SELECT id, paciente_id, medico_id, tipo_consulta FROM citas WHERE id=? AND clinica_id=?",
        [cita_id, clinicaId]
      );
      cita = c || null;
      if (cita && !paciente_id) paciente_id = cita.paciente_id;
    }
    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id o cita_id requerido" });

    const [[pac]] = await pool.query(
      `SELECT id, nombres, apellidos, dni, direccion, fecha_nacimiento,
              responsable_nombre, responsable_dni, responsable_direccion, responsable_parentesco,
              TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad
       FROM pacientes WHERE id=? AND clinica_id=?`,
      [paciente_id, clinicaId]
    );
    if (!pac) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    // Resolver cliente fiscal: si es menor de 18 y hay responsable, se factura al responsable.
    const esMenor = pac.edad != null && pac.edad < 18;
    let cliente;
    if (esMenor && pac.responsable_nombre) {
      cliente = {
        tipo: "RESPONSABLE",
        nombre: pac.responsable_nombre,
        rtn: pac.responsable_dni || "",
        direccion: pac.responsable_direccion || "",
        parentesco: pac.responsable_parentesco || "",
      };
    } else {
      cliente = {
        tipo: "PACIENTE",
        nombre: `${pac.nombres} ${pac.apellidos}`.trim(),
        rtn: pac.dni || "",
        direccion: pac.direccion || "",
        parentesco: "",
      };
    }

    // Ítem de consulta con precio según el tipo de cita (si existe en el catálogo).
    let descripcion = "Consulta médica";
    let precio = "";
    if (cita?.tipo_consulta) {
      descripcion = cita.tipo_consulta;
      const [[tipoCita]] = await pool.query(
        "SELECT precio FROM catalogos_tipos_cita WHERE clinica_id=? AND LOWER(nombre)=LOWER(?) AND activo=1",
        [clinicaId, cita.tipo_consulta]
      );
      if (tipoCita && tipoCita.precio != null) precio = Number(tipoCita.precio);
    }

    res.json({
      ok: true,
      data: {
        paciente: { id: pac.id, nombres: pac.nombres, apellidos: pac.apellidos, edad: pac.edad },
        cita_id: cita?.id || null,
        medico_id: cita?.medico_id || null,
        cliente,
        es_menor: esMenor,
        items: [{ descripcion, cantidad: 1, precio_unit: precio }],
        tipo_comprobante: "RECIBO",
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /:id — detalle ──────────────────────────────────────────────────────
router.get("/:id", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const [[factura]] = await pool.query(
      `SELECT f.*, p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
              p.dni AS paciente_dni, p.telefono AS paciente_telefono,
              u.nombres AS medico_nombres, u.apellidos AS medico_apellidos
       FROM facturas f
       JOIN pacientes p ON p.id = f.paciente_id
       LEFT JOIN usuarios u ON u.id = f.medico_id
       WHERE f.id=? AND f.clinica_id=?`,
      [req.params.id, clinicaId]
    );
    if (!factura) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (req.user.tipo === "MEDICO" && factura.medico_id !== req.user.id) {
      return res.status(403).json({ ok: false, msg: "No tienes acceso a esta factura" });
    }

    const [items] = await pool.query("SELECT * FROM factura_items WHERE factura_id=?", [factura.id]);
    const [pagos] = await pool.query(
      "SELECT * FROM pagos WHERE factura_id=? ORDER BY registrado_en ASC",
      [factura.id]
    );

    res.json({ ok: true, data: { ...factura, items, pagos } });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── POST / — crear (manual o automática) ────────────────────────────────────
router.post("/", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const clinicaId = req.user.clinica_id;
    const {
      paciente_id, cita_id, medico_id, items,
      tipo_comprobante = "RECIBO", rtn_cliente, direccion_cliente, nombre_cliente,
    } = req.body;

    if (!paciente_id) return res.status(400).json({ ok: false, msg: "paciente_id requerido" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, msg: "Debe incluir al menos un ítem" });
    }

    const [[paciente]] = await conn.query(
      "SELECT nombres, apellidos FROM pacientes WHERE id=? AND clinica_id=?",
      [paciente_id, clinicaId]
    );
    if (!paciente) return res.status(404).json({ ok: false, msg: "Paciente no encontrado" });

    await conn.beginTransaction();

    let numero = null, numeroCompleto = null, cai = null, fechaLimite = null;
    let isvPorcentaje = 15;

    if (tipo_comprobante === "FACTURA") {
      const cfg = await getClinicaConfig(clinicaId, [
        "factura_cai", "factura_establecimiento", "factura_punto_emision",
        "factura_tipo_documento", "factura_rango_inicio", "factura_rango_fin",
        "factura_correlativo_actual", "factura_fecha_limite_emision", "factura_isv_porcentaje",
      ]);

      if (!cfg.factura_cai || !cfg.factura_rango_inicio || !cfg.factura_rango_fin) {
        await conn.rollback();
        return res.status(400).json({
          ok: false,
          msg: "Falta configurar el CAI de la clínica (Configuración → Facturación) antes de emitir facturas formales.",
        });
      }
      if (cfg.factura_fecha_limite_emision && new Date(cfg.factura_fecha_limite_emision) < new Date()) {
        await conn.rollback();
        return res.status(400).json({ ok: false, msg: "El CAI vigente ya venció. Carga uno nuevo en Configuración → Facturación." });
      }

      const inicio = parseInt(cfg.factura_rango_inicio, 10);
      const fin    = parseInt(cfg.factura_rango_fin, 10);
      const actual = cfg.factura_correlativo_actual ? parseInt(cfg.factura_correlativo_actual, 10) : inicio;

      if (actual > fin) {
        await conn.rollback();
        return res.status(400).json({ ok: false, msg: "El rango autorizado del CAI se agotó. Carga uno nuevo en Configuración → Facturación." });
      }

      numero = String(actual).padStart(8, "0");
      numeroCompleto = `${cfg.factura_establecimiento || "001"}-${cfg.factura_punto_emision || "001"}-${cfg.factura_tipo_documento || "01"}-${numero}`;
      cai = cfg.factura_cai;
      fechaLimite = cfg.factura_fecha_limite_emision || null;
      isvPorcentaje = Number(cfg.factura_isv_porcentaje || 15);

      await conn.query(
        `INSERT INTO clinica_config (clinica_id, clave, valor) VALUES (?, 'factura_correlativo_actual', ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [clinicaId, String(actual + 1)]
      );
    } else {
      const [[{ maxNum }]] = await conn.query(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(numero, 3) AS UNSIGNED)), 0) AS maxNum FROM facturas WHERE clinica_id=? AND tipo_comprobante='RECIBO'",
        [clinicaId]
      );
      numero = `R-${String(maxNum + 1).padStart(6, "0")}`;
    }

    const [r] = await conn.query(
      `INSERT INTO facturas (
        clinica_id, paciente_id, cita_id, medico_id, creado_por,
        numero, numero_completo, tipo_comprobante, cai, fecha_limite_emision,
        rtn_cliente, nombre_cliente, direccion_cliente, isv_porcentaje, estado
      ) VALUES (?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, 'PENDIENTE')`,
      [
        clinicaId, paciente_id, cita_id || null, medico_id || req.user.id, req.user.id,
        numero, numeroCompleto, tipo_comprobante, cai, fechaLimite,
        rtn_cliente || null, (nombre_cliente && nombre_cliente.trim()) || `${paciente.nombres} ${paciente.apellidos}`, direccion_cliente || null, isvPorcentaje,
      ]
    );
    const facturaId = r.insertId;

    for (const it of items) {
      const cantidad = Number(it.cantidad || 1);
      const precioUnit = Number(it.precio_unit);
      if (!it.descripcion || !Number.isFinite(precioUnit)) continue;
      const total = Math.round(cantidad * precioUnit * 100) / 100;
      await conn.query(
        "INSERT INTO factura_items (factura_id, descripcion, cantidad, precio_unit, total) VALUES (?,?,?,?,?)",
        [facturaId, it.descripcion, cantidad, precioUnit, total]
      );
    }

    await recalcularTotales(conn, facturaId);
    await conn.commit();

    res.status(201).json({ ok: true, id: facturaId });
  } catch (e) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ── PUT /:id — editar mientras PENDIENTE ────────────────────────────────────
router.put("/:id", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const clinicaId = req.user.clinica_id;
    const { items, rtn_cliente, direccion_cliente } = req.body;

    const [[factura]] = await conn.query(
      "SELECT estado, medico_id FROM facturas WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!factura) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (factura.estado !== "PENDIENTE") {
      return res.status(400).json({ ok: false, msg: "Solo se puede editar una factura PENDIENTE" });
    }
    if (req.user.tipo === "MEDICO" && factura.medico_id !== req.user.id) {
      return res.status(403).json({ ok: false, msg: "No tienes acceso a esta factura" });
    }

    await conn.beginTransaction();

    if (rtn_cliente !== undefined || direccion_cliente !== undefined) {
      await conn.query(
        "UPDATE facturas SET rtn_cliente=COALESCE(?,rtn_cliente), direccion_cliente=COALESCE(?,direccion_cliente) WHERE id=?",
        [rtn_cliente || null, direccion_cliente || null, req.params.id]
      );
    }

    if (Array.isArray(items)) {
      await conn.query("DELETE FROM factura_items WHERE factura_id=?", [req.params.id]);
      for (const it of items) {
        const cantidad = Number(it.cantidad || 1);
        const precioUnit = Number(it.precio_unit);
        if (!it.descripcion || !Number.isFinite(precioUnit)) continue;
        const total = Math.round(cantidad * precioUnit * 100) / 100;
        await conn.query(
          "INSERT INTO factura_items (factura_id, descripcion, cantidad, precio_unit, total) VALUES (?,?,?,?,?)",
          [req.params.id, it.descripcion, cantidad, precioUnit, total]
        );
      }
      await recalcularTotales(conn, req.params.id);
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ── POST /:id/pagos — registrar pago ────────────────────────────────────────
router.post("/:id/pagos", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const clinicaId = req.user.clinica_id;
    const { metodo = "EFECTIVO", monto, referencia } = req.body;
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ ok: false, msg: "Monto inválido" });
    }

    const [[factura]] = await conn.query(
      "SELECT estado, total, medico_id FROM facturas WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!factura) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (factura.estado === "ANULADA") {
      return res.status(400).json({ ok: false, msg: "No se puede pagar una factura anulada" });
    }
    if (req.user.tipo === "MEDICO" && factura.medico_id !== req.user.id) {
      return res.status(403).json({ ok: false, msg: "No tienes acceso a esta factura" });
    }

    await conn.beginTransaction();

    await conn.query(
      "INSERT INTO pagos (clinica_id, factura_id, metodo, monto, referencia, registrado_por) VALUES (?,?,?,?,?,?)",
      [clinicaId, req.params.id, metodo, montoNum, referencia || null, req.user.id]
    );

    const [[{ totalPagado }]] = await conn.query(
      "SELECT COALESCE(SUM(monto),0) AS totalPagado FROM pagos WHERE factura_id=?",
      [req.params.id]
    );

    if (Number(totalPagado) >= Number(factura.total)) {
      await conn.query("UPDATE facturas SET estado='PAGADA' WHERE id=?", [req.params.id]);
    }

    await conn.commit();
    res.status(201).json({ ok: true, total_pagado: Number(totalPagado) });
  } catch (e) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ── POST /:id/cobrar — registrar varios pagos a la vez (pago mixto) ──────────
router.post("/:id/cobrar", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const clinicaId = req.user.clinica_id;
    const { pagos } = req.body; // [{ metodo, monto, referencia }]

    if (!Array.isArray(pagos) || pagos.length === 0) {
      return res.status(400).json({ ok: false, msg: "Debe incluir al menos un pago" });
    }
    const limpios = pagos
      .map(p => ({ metodo: p.metodo || "EFECTIVO", monto: Number(p.monto), referencia: p.referencia || null }))
      .filter(p => Number.isFinite(p.monto) && p.monto > 0);
    if (limpios.length === 0) {
      return res.status(400).json({ ok: false, msg: "Montos inválidos" });
    }

    const [[factura]] = await conn.query(
      "SELECT estado, total, medico_id FROM facturas WHERE id=? AND clinica_id=?",
      [req.params.id, clinicaId]
    );
    if (!factura) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (factura.estado === "ANULADA") {
      return res.status(400).json({ ok: false, msg: "No se puede cobrar una factura anulada" });
    }
    if (req.user.tipo === "MEDICO" && factura.medico_id !== req.user.id) {
      return res.status(403).json({ ok: false, msg: "No tienes acceso a esta factura" });
    }

    await conn.beginTransaction();

    for (const p of limpios) {
      await conn.query(
        "INSERT INTO pagos (clinica_id, factura_id, metodo, monto, referencia, registrado_por) VALUES (?,?,?,?,?,?)",
        [clinicaId, req.params.id, p.metodo, p.monto, p.referencia, req.user.id]
      );
    }

    const [[{ totalPagado }]] = await conn.query(
      "SELECT COALESCE(SUM(monto),0) AS totalPagado FROM pagos WHERE factura_id=?",
      [req.params.id]
    );

    if (Number(totalPagado) >= Number(factura.total)) {
      await conn.query("UPDATE facturas SET estado='PAGADA' WHERE id=?", [req.params.id]);
    }

    await conn.commit();
    res.status(201).json({ ok: true, total_pagado: Number(totalPagado) });
  } catch (e) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ ok: false, msg: e.message });
  } finally {
    conn.release();
  }
});

// ── POST /:id/anular — anular (ADMIN/SUPER_ADMIN) ───────────────────────────
router.post("/:id/anular", auth("ADMIN", "SUPER_ADMIN"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const [r] = await pool.query(
      "UPDATE facturas SET estado='ANULADA' WHERE id=? AND clinica_id=? AND estado != 'ANULADA'",
      [req.params.id, clinicaId]
    );
    if (!r.affectedRows) return res.status(404).json({ ok: false, msg: "No encontrada o ya anulada" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── GET /:id/pdf — generar PDF ──────────────────────────────────────────────
router.get("/:id/pdf", auth("ADMIN", "MEDICO", "SUPER_ADMIN", "RECEPCIONISTA"), async (req, res) => {
  try {
    const clinicaId = req.user.clinica_id;
    const [[factura]] = await pool.query(
      `SELECT f.*, c.nombre AS clinica_nombre, c.ruc AS clinica_ruc, c.direccion AS clinica_direccion,
              c.telefono AS clinica_telefono, c.email AS clinica_email, c.ciudad AS clinica_ciudad,
              c.logo_url AS clinica_logo
       FROM facturas f JOIN clinicas c ON c.id = f.clinica_id
       WHERE f.id=? AND f.clinica_id=?`,
      [req.params.id, clinicaId]
    );
    if (!factura) return res.status(404).json({ ok: false, msg: "No encontrada" });
    if (req.user.tipo === "MEDICO" && factura.medico_id !== req.user.id) {
      return res.status(403).json({ ok: false, msg: "No tienes acceso a esta factura" });
    }

    const [items] = await pool.query("SELECT * FROM factura_items WHERE factura_id=?", [factura.id]);
    const [pagos] = await pool.query("SELECT * FROM pagos WHERE factura_id=? ORDER BY registrado_en ASC", [factura.id]);
    const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0);

    const esFactura = factura.tipo_comprobante === "FACTURA";

    // Datos fiscales de la clínica (emisor) para el bloque SAR
    const cfg = await getClinicaConfig(clinicaId, [
      "factura_rtn_clinica", "factura_establecimiento", "factura_punto_emision",
      "factura_tipo_documento", "factura_rango_inicio", "factura_rango_fin",
    ]);

    const rtnEmisor = cfg.factura_rtn_clinica || factura.clinica_ruc || "";
    const rangoInicio = cfg.factura_rango_inicio || "";
    const rangoFin = cfg.factura_rango_fin || "";
    const estab = cfg.factura_establecimiento || "001";
    const punto = cfg.factura_punto_emision || "001";
    const tipoDoc = cfg.factura_tipo_documento || "01";
    const rangoAutorizado = (rangoInicio && rangoFin)
      ? `${estab}-${punto}-${tipoDoc}-${String(rangoInicio).padStart(8, "0")} AL ${estab}-${punto}-${tipoDoc}-${String(rangoFin).padStart(8, "0")}`
      : "";

    const fecha = new Date(factura.creado_en).toLocaleDateString("es-HN", { day: "2-digit", month: "long", year: "numeric" });
    const lugar = factura.clinica_ciudad || "Honduras";

    // Desglose fiscal
    const subtotal = Number(factura.subtotal);
    const isvPct = Number(factura.isv_porcentaje);
    const impuestos = Number(factura.impuestos);
    const total = Number(factura.total);
    // En este modelo el subtotal es la base gravada al porcentaje configurado.
    const gravado15 = isvPct === 15 ? subtotal : 0;
    const gravado18 = isvPct === 18 ? subtotal : 0;
    const isv15 = isvPct === 15 ? impuestos : 0;
    const isv18 = isvPct === 18 ? impuestos : 0;
    const exento = (!esFactura || isvPct === 0) ? subtotal : 0;

    const superaLimite = total > 5000;
    const clienteIncompleto = superaLimite && (!factura.rtn_cliente || !factura.nombre_cliente);

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${esFactura ? "Factura" : "Recibo"} ${escHtml(factura.numero_completo || factura.numero)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #1a1a1a; padding: 12px 14px; }
  .doc { border: 1px solid #cbd5e1; border-radius: 5px; padding: 10px 12px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #0f2f5f; padding-bottom: 6px; }
  .emisor h1 { font-size: 12px; color: #0f2f5f; letter-spacing: .3px; }
  .emisor .logo { max-height: 34px; margin-bottom: 3px; }
  .emisor p { font-size: 7.5px; color: #444; margin-top: 1px; }
  .doc-info { text-align: right; min-width: 150px; }
  .doc-info .tipo { font-size: 11px; font-weight: 800; color: #0f2f5f; letter-spacing: .5px; }
  .doc-info .num { font-size: 10px; font-weight: 800; color: #b91c1c; margin-top: 1px; }
  .doc-info p { font-size: 7.5px; color: #444; margin-top: 1px; }
  .fiscal { display: flex; gap: 6px; margin: 7px 0; }
  .fiscal .box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 5px 7px; font-size: 7px; color: #334155; line-height: 1.4; }
  .fiscal .box b { color: #0f2f5f; }
  .cliente { border: 1px solid #e2e8f0; border-radius: 5px; padding: 5px 7px; margin-bottom: 7px; font-size: 7.5px; display: flex; justify-content: space-between; gap: 8px; }
  .cliente .aviso { color: #b91c1c; font-weight: 700; font-size: 6.5px; text-align: right; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
  table.items th { background: #0f2f5f; color: #fff; padding: 4px 7px; font-size: 7px; text-transform: uppercase; text-align: left; }
  table.items th.r, table.items td.r { text-align: right; }
  table.items th.c, table.items td.c { text-align: center; }
  table.items td { padding: 3.5px 7px; border-bottom: 1px solid #eef2f7; font-size: 8px; }
  .bottom { display: flex; justify-content: space-between; gap: 10px; margin-top: 6px; }
  .letras { flex: 1; }
  .letras .cap { font-size: 6.5px; color: #64748b; text-transform: uppercase; letter-spacing: .3px; }
  .letras .val { border: 1px solid #e2e8f0; border-radius: 5px; padding: 5px 7px; font-size: 7.5px; font-weight: 700; color: #0f2f5f; margin-top: 2px; min-height: 26px; }
  .totales { width: 175px; }
  .totales div { display: flex; justify-content: space-between; padding: 1.5px 0; font-size: 7.5px; }
  .totales .sep { border-top: 1px solid #e2e8f0; margin-top: 2px; padding-top: 3px; }
  .totales .total { font-weight: 800; font-size: 10px; color: #b91c1c; border-top: 1.5px solid #0f2f5f; margin-top: 3px; padding-top: 4px; }
  .leyenda { text-align: center; font-weight: 700; color: #0f2f5f; font-size: 7.5px; margin: 8px 0 4px; letter-spacing: .3px; }
  .pie { display: flex; justify-content: space-between; font-size: 6.5px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 5px; margin-top: 5px; }
  .estado-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 6.5px; font-weight: 700; }
</style></head>
<body>
  <div class="doc">
    <div class="top">
      <div class="emisor">
        ${factura.clinica_logo ? `<img class="logo" src="${escHtml(factura.clinica_logo)}" alt="logo"/>` : ""}
        <h1>${escHtml(factura.clinica_nombre)}</h1>
        <p><b>RTN:</b> ${escHtml(rtnEmisor) || "—"}</p>
        ${factura.clinica_direccion ? `<p>${escHtml(factura.clinica_direccion)}</p>` : ""}
        ${factura.clinica_telefono ? `<p>Tel: ${escHtml(factura.clinica_telefono)}</p>` : ""}
        ${factura.clinica_email ? `<p>${escHtml(factura.clinica_email)}</p>` : ""}
      </div>
      <div class="doc-info">
        <div class="tipo">${esFactura ? "FACTURA" : "RECIBO"}</div>
        <div class="num">No. ${escHtml(factura.numero_completo || factura.numero)}</div>
        <p><b>Fecha de emisión:</b> ${fecha}</p>
        <p><b>Lugar de emisión:</b> ${escHtml(lugar)}</p>
        <p>Estado: <span class="estado-badge" style="background:${factura.estado === "PAGADA" ? "#dcfce7;color:#166534" : factura.estado === "ANULADA" ? "#fee2e2;color:#991b1b" : "#fef3c7;color:#92400e"}">${escHtml(factura.estado)}</span></p>
      </div>
    </div>

    ${esFactura ? `<div class="fiscal">
      <div class="box">
        <b>C.A.I.:</b> ${escHtml(factura.cai) || "—"}<br>
        <b>Rango autorizado:</b> ${escHtml(rangoAutorizado) || "—"}
      </div>
      <div class="box">
        <b>Fecha límite de emisión:</b> ${factura.fecha_limite_emision ? new Date(factura.fecha_limite_emision).toLocaleDateString("es-HN") : "—"}<br>
        <b>Correlativo:</b> ${escHtml(factura.numero_completo || factura.numero)}
      </div>
    </div>` : ""}

    <div class="cliente">
      <div>
        <b>Cliente:</b> ${escHtml(factura.nombre_cliente) || "Consumidor final"}
        ${factura.rtn_cliente ? `&nbsp;·&nbsp; <b>RTN:</b> ${escHtml(factura.rtn_cliente)}` : ""}
        ${factura.direccion_cliente ? `<br>${escHtml(factura.direccion_cliente)}` : ""}
      </div>
      ${clienteIncompleto ? `<div class="aviso">Monto &gt; L 5,000: se requiere nombre y RTN del cliente</div>` : ""}
    </div>

    <table class="items">
      <thead><tr>
        <th class="c">Cant.</th>
        <th>Descripción</th>
        <th class="r">Precio unit.</th>
        <th class="r">Total</th>
      </tr></thead>
      <tbody>
        ${items.map(it => `<tr>
          <td class="c">${Number(it.cantidad)}</td>
          <td>${escHtml(it.descripcion)}</td>
          <td class="r">L ${Number(it.precio_unit).toFixed(2)}</td>
          <td class="r">L ${Number(it.total).toFixed(2)}</td>
        </tr>`).join("")}
      </tbody>
    </table>

    <div class="bottom">
      <div class="letras">
        <div class="cap">Valor en letras</div>
        <div class="val">${escHtml(numeroALetras(total))}</div>
      </div>
      <div class="totales">
        <div><span>Importe exento</span><span>L ${exento.toFixed(2)}</span></div>
        <div><span>Importe gravado 15%</span><span>L ${gravado15.toFixed(2)}</span></div>
        <div><span>Importe gravado 18%</span><span>L ${gravado18.toFixed(2)}</span></div>
        <div class="sep"><span>Subtotal</span><span>L ${subtotal.toFixed(2)}</span></div>
        <div><span>I.S.V. 15%</span><span>L ${isv15.toFixed(2)}</span></div>
        <div><span>I.S.V. 18%</span><span>L ${isv18.toFixed(2)}</span></div>
        <div class="total"><span>TOTAL A PAGAR</span><span>L ${total.toFixed(2)}</span></div>
        <div><span>Pagado</span><span>L ${totalPagado.toFixed(2)}</span></div>
        <div><span>Saldo</span><span>L ${(total - totalPagado).toFixed(2)}</span></div>
      </div>
    </div>

    ${esFactura ? `<div class="leyenda">"LA FACTURA ES BENEFICIO DE TODOS, ¡EXÍJALA!"</div>` : ""}

    <div class="pie">
      <span>Original: Cliente &nbsp;·&nbsp; Copia: Emisor</span>
      <span>Documento generado el ${new Date().toLocaleDateString("es-HN")} — Medic-KG</span>
    </div>
  </div>
</body></html>`;

    const pdfBuffer = await generarPdfDesdeHtml(html, { paper_size: "HALF_LETTER", orientacion: "portrait" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${escHtml(factura.numero_completo || factura.numero || factura.id)}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
