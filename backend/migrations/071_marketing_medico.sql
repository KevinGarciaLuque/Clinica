-- ============================================================
--  071_marketing_medico.sql
--  Sección "Marketing Médico" de la web pública.
--  Página propia (/marketing-medico) + sección en el inicio.
--  Contenido gestionado desde el panel SUPER_ADMIN.
-- ============================================================

CREATE TABLE IF NOT EXISTS marketing_medico_items (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tipo               ENUM('post','video','plan') NOT NULL,
  titulo             VARCHAR(200) NOT NULL,
  descripcion        TEXT,
  media_url          VARCHAR(600),          -- post: URL de imagen (Cloudinary/local) · video: URL de YouTube/Vimeo
  media_public_id    VARCHAR(255),          -- id de Cloudinary para poder borrar la imagen
  enlace_url         VARCHAR(600),          -- post: link opcional (caso, Instagram) · plan: no se usa
  precio             VARCHAR(80),            -- plan: texto libre ("$150 / mes", "Desde $99")
  features           JSON,                   -- plan: array de strings con lo que incluye
  destacado          TINYINT(1) NOT NULL DEFAULT 0,   -- plan: tarjeta resaltada
  orden              INT NOT NULL DEFAULT 0,
  activo             TINYINT(1) NOT NULL DEFAULT 1,
  creado_en          DATETIME DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mmi_tipo (tipo, activo, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Claves de texto de la sección (editables en el panel, tabla config_sistema)
INSERT IGNORE INTO config_sistema (clave, valor) VALUES
  ('marketing_activo',        '1'),
  ('marketing_home_badge',    'Marketing Médico'),
  ('marketing_home_titulo',   'Haz crecer tu consulta'),
  ('marketing_home_texto',    'Contenido, video y estrategia digital pensados para médicos y clínicas. Atrae más pacientes con una presencia profesional y coherente.'),
  ('marketing_hero_titulo',   'Marketing Médico'),
  ('marketing_hero_texto',    'Ayudamos a médicos y clínicas a comunicar mejor, ganar confianza y llenar la agenda. Mira ejemplos reales y elige el plan que se ajusta a ti.'),
  ('marketing_whatsapp',      '');
