const router = require("express").Router();
const pool = require("../db");

// POST /api/ia/chat
// Aquí luego conectas OpenAI / modelo y le das "tools" (consultar disponibilidad / crear cita)
router.post("/chat", async (req, res) => {
  try {
    const clinicaId = req.tenant?.clinica_id;
    if (!clinicaId) return res.status(400).json({ ok: false, msg: "Falta x-clinica-id" });

    const { mensaje } = req.body;
    if (!mensaje) return res.status(400).json({ ok: false, msg: "mensaje requerido" });

    // Respuesta dummy por ahora
    res.json({
      ok: true,
      respuesta:
        "Aún no tengo IA conectada. Pero ya estoy listo para agendar cuando conectes el proveedor. " +
        "Por ahora dime: ¿para qué fecha y con qué médico?",
    });
  } catch (e) {
    res.status(500).json({ ok: false, msg: e.message });
  }
});

module.exports = router;
