-- ============================================================
--  078_usuario_funcion_clinica.sql
--  Función clínica del usuario en clínicas de endocrinología:
--  EDUCADOR_DIABETES | CONTROL_SEGUIMIENTO | NULL (médico normal).
--  Define a qué pantalla lo lleva el botón "Consulta".
--  Nota: routes/usuarios.js también agrega esta columna sola
--  al usarla (ensureFuncionColumn), así que correrla a mano es opcional.
-- ============================================================

ALTER TABLE usuarios ADD COLUMN funcion_clinica VARCHAR(30) NULL;
