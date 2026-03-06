// Endpoint temporal SOLO para ejecutar migraciones iniciales
// ELIMINAR después de usarlo por seguridad

const express = require("express");
const router = express.Router();
const runMigrations = require("../migrate");

// Token de seguridad - debe coincidir con SETUP_TOKEN en variables de Railway
const SETUP_TOKEN = process.env.SETUP_TOKEN || "temporal-setup-12345";

router.post("/run-migrations", async (req, res) => {
  // Verificar token de seguridad
  const token = req.headers["x-setup-token"] || req.body.token;
  
  if (token !== SETUP_TOKEN) {
    return res.status(403).json({ 
      error: "No autorizado. Token inválido." 
    });
  }

  try {
    console.log("🚀 Ejecutando migraciones desde endpoint...");
    await runMigrations();
    
    res.json({ 
      success: true, 
      message: "✅ Migraciones ejecutadas correctamente. ELIMINA este endpoint ahora por seguridad." 
    });
  } catch (error) {
    console.error("❌ Error al ejecutar migraciones:", error);
    res.status(500).json({ 
      error: "Error al ejecutar migraciones",
      details: error.message 
    });
  }
});

module.exports = router;
