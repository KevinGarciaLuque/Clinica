-- 068_clinica_bloqueada.sql
-- Candado de protección por clínica (solo SUPER_ADMIN puede manipular).
-- 1 = bloqueada: no se puede editar, desactivar, eliminar ni gestionar licencia desde el panel.
-- 0 (default) = comportamiento normal.
ALTER TABLE clinicas ADD COLUMN bloqueada TINYINT(1) NOT NULL DEFAULT 0 AFTER activo;

-- Bloquear por defecto a los clientes de pago (semestral / anual); las de prueba quedan libres.
UPDATE clinicas SET bloqueada = 1 WHERE plan_tipo IN ('semestral', 'anual');
