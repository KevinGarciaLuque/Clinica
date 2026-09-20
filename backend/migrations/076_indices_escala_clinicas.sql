-- ============================================================
--  076 — Índices preventivos para clínicas con muchos pacientes/citas
--  No cambian ningún comportamiento; solo evitan que MySQL tenga que
--  escanear y ordenar "a mano" según crecen citas/pacientes/historias.
-- ============================================================

-- Dashboard (/dashboard/stats) y agenda: filtra por clinica_id + rango de
-- fecha de inicio, y ordena por inicio. Ya existe (clinica_id, medico_id,
-- inicio) pero no sirve cuando NO se filtra por médico.
CREATE INDEX idx_citas_clinica_inicio ON citas (clinica_id, inicio);

-- Dashboard "últimos pacientes" y cualquier listado que filtre por
-- clinica_id + activo y ordene por id.
CREATE INDEX idx_pacientes_clinica_activo ON pacientes (clinica_id, activo, id);

-- Expediente del paciente: listado de historias por clinica_id (sin
-- paciente_id) ordenado por fecha.
CREATE INDEX idx_hce_clinica_fecha ON historias_clinicas (clinica_id, creado_en);
