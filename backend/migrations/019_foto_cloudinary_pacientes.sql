-- Migración 019: Agrega columna foto_cloudinary_id a pacientes
-- Las fotos de perfil ahora se suben a Cloudinary en lugar de disco local.
-- foto_perfil: almacena la URL segura de Cloudinary (secure_url)
-- foto_cloudinary_id: almacena el public_id para poder eliminarla después

ALTER TABLE pacientes
  ADD COLUMN foto_cloudinary_id VARCHAR(255) NULL DEFAULT NULL
  AFTER foto_perfil;
