# MULTI-CLÍNICA — Hoja de ruta completa

## Stack tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Backend | Node.js + Express | API REST |
| Base de datos | MySQL 8+ | Persistencia multi-tenant |
| Autenticación | JWT + Argon2 | Sesiones seguras |
| IA | OpenAI GPT-4o (function calling) | Asistente + agendamiento |
| Email | Nodemailer + SMTP | Recordatorios, verificación |
| Tareas cron | node-cron | Recordatorios automáticos |
| Archivos | multer + cloudinary | Subida de docs/imágenes |
| Frontend | React + Vite + Bootstrap 5 | UI principal |
| Calendario | react-big-calendar | Vista de agenda |
| PDFs | @react-pdf/renderer o pdfkit | Recetas y facturas |
| Mensajería RT | socket.io (fase 9) | Chat interno |

---

## Configuración inicial (una vez)

### 1. Base de datos
```sql
CREATE DATABASE multiclinica CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Luego ejecuta:
SOURCE backend/database/schema.sql;
```

### 2. Variables de entorno
```bash
cp backend/.env.example backend/.env
# Edita backend/.env con tus credenciales
```

### 3. Crear el SUPER_ADMIN inicial
```sql
-- Reemplaza el hash con el de tu contraseña (generarlo con argon2)
INSERT INTO usuarios (clinica_id, nombres, apellidos, email, password_hash, tipo)
VALUES (NULL, 'Super', 'Admin', 'super@plataforma.com',
        '$argon2id$...hash_aqui...', 'SUPER_ADMIN');
```
> Credenciales de prueba guardadas en `backend/User.txt`

### 4. Arrancar el backend
```bash
cd backend
npm install
npm run dev        # con nodemon (desarrollo)
npm start          # producción
```

### 5. Arrancar el frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Fases de desarrollo

### FASE 1 ✅ — Schema de base de datos
- [x] Todas las tablas creadas: clinicas, usuarios, pacientes, citas, historias, prescripciones, facturas, mensajes, IA, logs
- [x] Índices y foreign keys correctos
- [x] Soporte multi-tenant con `clinica_id` en cada tabla

### FASE 2 (siguiente) — Módulo Administración
- [ ] **Backend:** CRUD de clínicas (para SUPER_ADMIN)
- [ ] **Backend:** CRUD de usuarios por clínica (médicos, recepcionistas, etc.)
- [ ] **Backend:** CRUD de especialidades, horarios, servicios/tarifas
- [ ] **Frontend:** Panel SUPER_ADMIN (gestión de clínicas)
- [ ] **Frontend:** Panel ADMIN (gestión interna de su clínica)
- [ ] **Frontend:** Formulario de configuración de clínica (logo, datos SMTP, etc.)

### FASE 3 — Agendamiento visual mejorado
- [ ] Instalar `react-big-calendar` en el frontend
- [ ] Vista calendario semanal por médico
- [ ] Drag & drop de citas
- [ ] Bloques de tiempo configurables (15/30/45/60 min)
- [ ] Filtro por médico/especialidad
- [ ] Control visual de solapamientos
- [ ] Sala de espera virtual (lista de pacientes del día)

### FASE 4 — Portal de pacientes (self-service)
- [ ] Registro de paciente desde portal público
- [ ] Verificación por email (token)
- [ ] Subida de documentos (DNI, seguro)
- [ ] Aceptación de consentimientos
- [ ] Login del paciente para ver sus citas y recetas

### FASE 5 — Historia Clínica Electrónica (HCE)
- [ ] Formulario SOAP por cita
- [ ] Autocompletado de CIE-10 (importar catálogo)
- [ ] Registro de antecedentes y alergias
- [ ] Plantillas por especialidad
- [ ] Firma electrónica del médico
- [ ] Vista del historial completo del paciente

### FASE 6 — Prescripción Digital
- [ ] Catálogo de medicamentos
- [ ] Formulario de receta en el HCE
- [ ] Generación de PDF con logo, firma y QR
- [ ] Verificación QR pública

### FASE 7 — Recordatorios automáticos
```bash
npm install nodemailer node-cron
```
- [ ] Cron job cada hora que revisa citas próximas
- [ ] Email 48h antes → template HTML
- [ ] Email 24h antes → SMS opcional (Twilio)
- [ ] Registro en `cita_recordatorios`

### FASE 8 — Facturación
- [ ] Generar factura al completar cita
- [ ] PDF de factura con logo
- [ ] Registro de pagos por método
- [ ] Reporte de ingresos diario/mensual

### FASE 9 — Estudios, imágenes, reportes
- [ ] Solicitudes de laboratorio/imagenología
- [ ] Carga de resultados (PDF, imágenes)
- [ ] Alertas de valores anormales
- [ ] Reportes: consultas por médico, CIE-10, agenda del día

### FASE 10 — Seguridad avanzada
- [ ] Cifrado de datos sensibles (AES-256)
- [ ] Logout automático por inactividad (frontend)
- [ ] Registro de accesos (`accesos_log`)
- [ ] Backup automático diario (`node-cron` + mysqldump)
- [ ] 2FA opcional

---

## Estructura de archivos objetivo (backend)

```
backend/
├── server.js
├── db.js
├── .env
├── .env.example
├── database/
│   └── schema.sql
├── middlewares/
│   ├── auth.js          ✅ listo
│   ├── upload.js        (multer)
│   └── logger.js        (accesos_log)
├── routes/
│   ├── auth.js          ✅
│   ├── clinicas.js      ✅ (expandir)
│   ├── usuarios.js      (nuevo - FASE 2)
│   ├── pacientes.js     ✅
│   ├── citas.js         ✅
│   ├── horarios.js      (nuevo - FASE 2)
│   ├── servicios.js     (nuevo - FASE 2)
│   ├── historias.js     (nuevo - FASE 5)
│   ├── prescripciones.js(nuevo - FASE 6)
│   ├── estudios.js      (nuevo - FASE 9)
│   ├── facturas.js      (nuevo - FASE 8)
│   ├── mensajes.js      (nuevo - FASE 9)
│   └── ia.js            ✅ OpenAI function calling
└── utils/
    ├── email.js         (Nodemailer)
    ├── pdf.js           (pdfkit)
    └── cron.js          (recordatorios automáticos)
```

---

## IA — Cómo funciona el asistente

El asistente usa **OpenAI function calling** (GPT-4o). Cuando el usuario escribe en el chat:

```
Usuario: "Quiero una cita con el Dr. García para mañana en la mañana"
```

El flujo interno es:

```
1. OpenAI recibe el mensaje + System Prompt con info de la clínica
2. GPT-4o decide llamar: buscar_medicos("García")
3. Backend ejecuta el SQL y devuelve el resultado
4. GPT-4o decidide llamar: buscar_disponibilidad(medico_id, "mañana")
5. Backend devuelve slots libres
6. GPT-4o presenta opciones al usuario
7. Usuario confirma → crear_cita(...)
8. Se guarda en BD con canal="IA"
```

Todo el historial se almacena en `ia_conversaciones` para continuidad de la conversación.

---

## Comandos útiles

```bash
# Instalar dependencias pendientes (backend)
npm install nodemailer node-cron multer @types/multer

# Instalar dependencias pendientes (frontend)  
npm install react-big-calendar dayjs @react-pdf/renderer uuid axios

# Ejecutar el schema SQL
mysql -u root -p multiclinica < backend/database/schema.sql
```

---

## Variables API importantes por módulo

| Header/Variable | Uso |
|-----------------|-----|
| `x-clinica-id: 1` | Multi-tenant en desarrollo |
| `Authorization: Bearer <token>` | Autenticación JWT |
| `x-clinica-slug: clinica1` | Multi-tenant por subdominio |

**SUPER_ADMIN** no necesita `x-clinica-id` — tiene acceso global.
