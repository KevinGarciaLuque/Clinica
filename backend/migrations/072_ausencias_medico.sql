-- 072_ausencias_medico.sql
-- Ausencias / permisos / incapacidades de los médicos.
-- Es una capa APARTE de horarios_medico: no modifica el horario semanal,
-- solo resta disponibilidad en fechas concretas al generar los turnos.

CREATE TABLE IF NOT EXISTS ausencias_medico (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  clinica_id     INT NOT NULL,
  medico_id      INT NOT NULL,
  tipo           ENUM('vacaciones','permiso','incapacidad','capacitacion','otro') NOT NULL DEFAULT 'vacaciones',
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  todo_el_dia    TINYINT(1) NOT NULL DEFAULT 1,
  hora_inicio    TIME NULL,
  hora_fin       TIME NULL,
  motivo         VARCHAR(255) NULL,
  creado_por     INT NULL,
  creado_en      DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_med_rango (clinica_id, medico_id, fecha_inicio, fecha_fin)
) ENGINE=InnoDB;
