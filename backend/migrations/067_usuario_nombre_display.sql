-- 067_usuario_nombre_display.sql
-- "Nombre para mostrar" opcional del médico/usuario. Si está definido, se usa
-- tal cual en toda la app en lugar de "Dr. Nombre Apellido".
ALTER TABLE usuarios ADD COLUMN nombre_display VARCHAR(150) NULL AFTER apellidos;
