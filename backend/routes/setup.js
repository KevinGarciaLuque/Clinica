// Endpoint para ejecutar migraciones de forma remota.
// Queda DESHABILITADO (404) salvo que SETUP_TOKEN esté definido en las
// variables del servidor (Railway). Ya no existe una clave por defecto en el
// código: el repositorio es público y cualquiera podría leerla.

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const runMigrations = require("../migrate");

// Comparación en tiempo constante para no filtrar la clave por tiempos de respuesta
function tokenValido(recibido, esperado) {
  const a = Buffer.from(String(recibido || ""));
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post("/run-migrations", async (req, res) => {
  const SETUP_TOKEN = process.env.SETUP_TOKEN;
  // Sin clave configurada (o demasiado corta) el endpoint no existe
  if (!SETUP_TOKEN || SETUP_TOKEN.length < 24) {
    return res.status(404).json({ ok: false, msg: "Ruta no encontrada" });
  }

  const token = req.headers["x-setup-token"];
  if (!tokenValido(token, SETUP_TOKEN)) {
    return res.status(403).json({ error: "No autorizado. Token inválido." });
  }

  try {
    console.log("🚀 Ejecutando migraciones desde endpoint...");
    await runMigrations();
    res.json({ success: true, message: "✅ Migraciones ejecutadas correctamente." });
  } catch (error) {
    console.error("❌ Error al ejecutar migraciones:", error);
    res.status(500).json({ error: "Error al ejecutar migraciones" });
  }
});

module.exports = router;
