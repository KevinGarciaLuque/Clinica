-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN 012 — Módulo Curvas de Crecimiento OMS
-- ══════════════════════════════════════════════════════════════

-- Tabla principal: mediciones antropométricas del paciente
CREATE TABLE IF NOT EXISTS mediciones_crecimiento (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id    INT UNSIGNED NOT NULL,
  paciente_id   INT UNSIGNED NOT NULL,
  usuario_id    INT UNSIGNED DEFAULT NULL COMMENT 'Médico que registró',
  
  fecha_medicion DATE NOT NULL,
  edad_meses     DECIMAL(6,2) NOT NULL COMMENT 'Edad en meses al momento de la medición',
  
  peso_kg        DECIMAL(6,3) DEFAULT NULL COMMENT 'Peso en kilogramos',
  talla_cm       DECIMAL(6,2) DEFAULT NULL COMMENT 'Talla/longitud en centímetros',
  perimetro_cefalico_cm DECIMAL(6,2) DEFAULT NULL COMMENT 'Perímetro cefálico en cm',
  imc            DECIMAL(6,2) DEFAULT NULL COMMENT 'IMC calculado automáticamente',
  
  -- Z-scores calculados
  zscore_peso_edad      DECIMAL(5,2) DEFAULT NULL,
  zscore_talla_edad     DECIMAL(5,2) DEFAULT NULL,
  zscore_peso_talla     DECIMAL(5,2) DEFAULT NULL,
  zscore_imc_edad       DECIMAL(5,2) DEFAULT NULL,
  zscore_pc_edad        DECIMAL(5,2) DEFAULT NULL,
  
  -- Percentiles calculados
  percentil_peso_edad   DECIMAL(5,1) DEFAULT NULL,
  percentil_talla_edad  DECIMAL(5,1) DEFAULT NULL,
  percentil_peso_talla  DECIMAL(5,1) DEFAULT NULL,
  percentil_imc_edad    DECIMAL(5,1) DEFAULT NULL,
  percentil_pc_edad     DECIMAL(5,1) DEFAULT NULL,
  
  notas          TEXT DEFAULT NULL,
  
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_mc_paciente (paciente_id),
  INDEX idx_mc_clinica  (clinica_id),
  INDEX idx_mc_fecha    (fecha_medicion),
  
  FOREIGN KEY (clinica_id)  REFERENCES clinicas(id) ON DELETE CASCADE,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nota: Si existe tabla 'modulos' en tu esquema, ejecuta manualmente:
-- INSERT IGNORE INTO modulos (nombre, slug, descripcion, icono, orden, activo)
-- VALUES ('Curvas de Crecimiento', 'curva-crecimiento', 'Seguimiento antropométrico según estándares OMS', 'bi-graph-up-arrow', 15, 1);
