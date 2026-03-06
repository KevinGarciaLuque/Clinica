-- ============================================================
-- INSERTAR SUPER ADMINISTRADOR
-- Email: super@plataforma.com
-- Password: Admin12345*
-- ============================================================

INSERT INTO usuarios (
  clinica_id,
  nombres,
  apellidos,
  email,
  password_hash,
  tipo,
  activo
) VALUES (
  NULL,
  'Super',
  'Admin',
  'super@plataforma.com',
  '$argon2id$v=19$m=65536,t=3,p=4$sqoLVQrqe0ZTPvb2AHeDLQ$BG6WRiEPSapqZY/IALXzLHGusvFhb7B4pHqf0sBmXOk',
  'SUPER_ADMIN',
  1
);

-- Verificar que se insertó correctamente:
SELECT id, nombres, apellidos, email, tipo FROM usuarios WHERE email = 'super@plataforma.com';
