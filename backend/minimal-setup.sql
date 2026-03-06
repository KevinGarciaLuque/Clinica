-- Script mínimo para crear tablas básicas
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS clinicas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  logo_url VARCHAR(300),
  email VARCHAR(120),
  telefono VARCHAR(30),
  activo TINYINT(1) DEFAULT 1,
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT UNSIGNED NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(100),
  apellido VARCHAR(100),
  rol ENUM('superadmin','admin','medico','recepcionista','enfermera') DEFAULT 'medico',
  estado ENUM('activo','inactivo','suspendido') DEFAULT 'activo',
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pacientes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT UNSIGNED NOT NULL,
  nombres VARCHAR(100),
  apellidos VARCHAR(100),
  documento_tipo ENUM('DNI','CE','PASAPORTE','RUC') DEFAULT 'DNI',
  documento_numero VARCHAR(30),
  email VARCHAR(120),
  telefono VARCHAR(30),
  fecha_nacimiento DATE,
  sexo ENUM('M','F','Otro'),
  direccion VARCHAR(250),
  creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Insertar clínica y usuario de prueba
INSERT INTO clinicas (nombre, slug, email, activo) VALUES 
('Clínica Demo', 'demo', 'admin@clinica.com', 1);

-- Contraseña: Admin123! (deberás hashearla con argon2)
INSERT INTO usuarios (clinica_id, email, password, nombre, apellido, rol, estado) VALUES 
(1, 'admin@clinica.com', 'cambiar_por_hash', 'Admin', 'Sistema', 'superadmin', 'activo');

SET FOREIGN_KEY_CHECKS = 1;
