# ✅ Checklist de Deployment - Sistema Clínica

## 🎯 Objetivo: Subir el sistema completo a Railway

---

## FASE 1: Preparación (15 minutos)

- [ ] **Instalar Railway CLI**
  ```bash
  npm install -g @railway/cli
  ```

- [ ] **Crear cuenta en Railway**
  - Ir a https://railway.app
  - Registrarse con GitHub
  - Verificar email

- [ ] **Verificar código local**
  ```bash
  git status
  # Todo debe estar commiteado
  ```

- [ ] **Revisar archivo .env.example**
  - Asegurarse de tener todos los valores necesarios
  - Preparar API keys (OpenAI, SMTP, etc.)

---

## FASE 2: Configuración en Railway (20 minutos)

- [ ] **Crear proyecto nuevo en Railway**
  - Dashboard → "New Project"
  - Nombre: "clinica-sistema"

- [ ] **Agregar base de datos MySQL**
  - Click en "+ New"
  - Seleccionar "Database" → "MySQL"
  - Esperar a que se provisione (2-3 minutos)
  - ✅ Anotar credenciales (o usar variables de referencia)

- [ ] **Conectar repositorio de GitHub**
  - Click en "+ New"
  - "GitHub Repo" → Seleccionar tu repo
  - Railway detectará automáticamente Node.js

- [ ] **Configurar Root Directory del Backend**
  - Settings → "Source"
  - Root Directory: `backend`
  - Start Command: `npm start`

---

## FASE 3: Variables de Entorno (15 minutos)

### En el servicio Backend de Railway, agregar:

#### Base de Datos
- [ ] `DB_HOST` = `${{MYSQL_RAILWAY_INTERNAL_HOST}}`
- [ ] `DB_PORT` = `${{MYSQL_RAILWAY_PORT}}`
- [ ] `DB_USER` = `${{MYSQL_RAILWAY_USER}}`
- [ ] `DB_PASSWORD` = `${{MYSQL_RAILWAY_PASSWORD}}`
- [ ] `DB_NAME` = `${{MYSQL_RAILWAY_DATABASE}}`

#### Servidor
- [ ] `PORT` = `${{PORT}}`
- [ ] `NODE_ENV` = `production`

#### JWT
- [ ] `JWT_SECRET` = `[Tu secreto largo y aleatorio]`
- [ ] `JWT_EXPIRES` = `8h`

#### CORS
- [ ] `CORS_ORIGINS` = `https://tu-frontend.vercel.app` (actualizar después)
- [ ] `FRONTEND_URL` = `https://tu-frontend.vercel.app` (actualizar después)

#### Multi-tenant
- [ ] `TENANT_MODE` = `header`

#### Email (Opcional pero recomendado)
- [ ] `SMTP_HOST` = `smtp.gmail.com`
- [ ] `SMTP_PORT` = `587`
- [ ] `SMTP_SECURE` = `false`
- [ ] `SMTP_USER` = `tu_email@gmail.com`
- [ ] `SMTP_PASS` = `[Tu app password de Gmail]`
- [ ] `EMAIL_FROM` = `Sistema Clínica <noreply@tuclinica.com>`

#### OpenAI (Opcional)
- [ ] `OPENAI_API_KEY` = `sk-...` (si usas el módulo IA)
- [ ] `OPENAI_MODEL` = `gpt-4o`
- [ ] `OPENAI_MAX_TOKENS` = `2000`

#### Almacenamiento
- [ ] `STORAGE_MODE` = `local` (cambiar a `cloudinary` después)
- [ ] `UPLOADS_DIR` = `./uploads`

#### Seguridad
- [ ] `SESSION_TIMEOUT_MIN` = `30`
- [ ] `ENCRYPTION_KEY` = `[32 caracteres hex aleatorios]`

---

## FASE 4: Migraciones de Base de Datos (15 minutos)

### Opción A: Desde Terminal Local (Recomendada)

- [ ] **Login en Railway CLI**
  ```bash
  railway login
  ```

- [ ] **Vincular proyecto**
  ```bash
  railway link
  ```

- [ ] **Ejecutar migraciones**
  ```bash
  railway run npm run migrate
  ```

### Opción B: Desde DBeaver

- [ ] **Obtener credenciales de Railway**
  - Click en servicio MySQL
  - "Connect" → Ver credenciales

- [ ] **Conectar desde DBeaver**
  - Nueva conexión MySQL
  - Pegar credenciales de Railway

- [ ] **Ejecutar SQL manualmente**
  1. `backend/database/schema.sql`
  2. `backend/migrations/004_registro_pacientes.sql`
  3. `backend/migrations/005_cie10_seed.sql`
  4. `backend/migrations/006_tipos_clinica_modulos.sql`
  5. `backend/migrations/007_galeria_estetica.sql`
  6. `backend/migrations/008_ordenar_modulos.sql`

- [ ] **Verificar tablas creadas**
  ```sql
  SHOW TABLES;
  -- Deberías ver: usuarios, pacientes, citas, clinicas, etc.
  ```

---

## FASE 5: Backend en Producción (10 minutos)

- [ ] **Verificar que el backend está corriendo**
  - Ver logs en Railway Dashboard
  - Buscar: "Server running on port..."

- [ ] **Probar endpoint de health**
  ```bash
  curl https://tu-backend.up.railway.app/api/health
  # Debería responder con status OK
  ```

- [ ] **Obtener URL del backend**
  - Railway → Backend Service → Settings → Domains
  - Copiar la URL: `https://xxx.up.railway.app`

---

## FASE 6: Frontend en Vercel (20 minutos)

- [ ] **Crear cuenta en Vercel**
  - Ir a https://vercel.com
  - Registrarse con GitHub

- [ ] **Importar proyecto**
  - "Add New" → "Project"
  - Seleccionar tu repositorio

- [ ] **Configurar proyecto**
  - Root Directory: `frontend`
  - Framework Preset: "Vite"
  - Build Command: `npm run build`
  - Output Directory: `dist`

- [ ] **Agregar variable de entorno**
  - `VITE_API_URL` = `https://[tu-backend].up.railway.app`

- [ ] **Deploy**
  - Click "Deploy"
  - Esperar 2-3 minutos

- [ ] **Obtener URL del frontend**
  - Copiar: `https://tu-proyecto.vercel.app`

---

## FASE 7: Actualizar CORS (5 minutos)

- [ ] **Volver a Railway**
  - Backend Service → Variables

- [ ] **Actualizar variables**
  - `CORS_ORIGINS` = `https://tu-proyecto.vercel.app`
  - `FRONTEND_URL` = `https://tu-proyecto.vercel.app`

- [ ] **Redesplegar backend**
  - Railway lo hace automáticamente al cambiar variables

---

## FASE 8: Crear Usuario Inicial (10 minutos)

### Opción A: Desde DBeaver
- [ ] **Conectar a la BD de Railway**
- [ ] **Ejecutar script seed**
  ```bash
  railway run node backend/migrations/seed-superadmin.js
  ```

### Opción B: SQL Directo
- [ ] **En DBeaver, ejecutar:**
  ```sql
  -- Crear una clínica de prueba
  INSERT INTO clinicas (nombre, slug, email, telefono, activo) 
  VALUES ('Mi Clínica', 'mi-clinica', 'contacto@miclinica.com', '123456789', 1);

  -- Crear superadmin (password: Admin123!)
  INSERT INTO usuarios (clinica_id, email, password, nombre, apellido, rol, estado)
  VALUES (1, 'admin@miclinica.com', '[hash-argon2]', 'Admin', 'Sistema', 'superadmin', 'activo');
  ```

- [ ] **Mejor: Usar el endpoint de registro temporal**
  - Crear un endpoint /api/setup-admin (con token secreto)
  - Llamarlo una vez para crear el admin inicial

---

## FASE 9: Pruebas Finales (15 minutos)

- [ ] **Probar login**
  - Ir a `https://tu-proyecto.vercel.app`
  - Intentar login con admin creado

- [ ] **Verificar funcionalidades clave**
  - [ ] Dashboard carga
  - [ ] Lista de pacientes
  - [ ] Crear nueva cita
  - [ ] Subir documento (verificar uploads)

- [ ] **Revisar Console del navegador**
  - No debe haber errores de CORS
  - API debe responder correctamente

- [ ] **Revisar logs en Railway**
  - Ver requests llegando
  - No debe haber errores 500

---

## FASE 10: Optimizaciones (Opcional)

### Dominio Personalizado
- [ ] Comprar dominio (Namecheap, GoDaddy, etc.)
- [ ] Configurar en Railway y Vercel
- [ ] Actualizar variables CORS

### Cloudinary para Uploads
- [ ] Crear cuenta en Cloudinary
- [ ] Obtener API keys
- [ ] Actualizar variables:
  - `STORAGE_MODE` = `cloudinary`
  - `CLOUDINARY_CLOUD_NAME` = `xxx`
  - `CLOUDINARY_API_KEY` = `xxx`
  - `CLOUDINARY_API_SECRET` = `xxx`

### Monitoreo
- [ ] Configurar alertas en Railway
- [ ] Sentry para error tracking (opcional)

### Backups
- [ ] Configurar backups automáticos de MySQL en Railway
- [ ] Exportar SQL manualmente cada semana (DBeaver)

---

## 🎉 DEPLOYMENT COMPLETADO

¡Felicidades! Tu sistema está en producción.

### URLs importantes:
- 🌐 Frontend: `https://tu-proyecto.vercel.app`
- 🔧 Backend: `https://tu-backend.up.railway.app`
- 🗄️ Base de Datos: MySQL en Railway (privada)

### Credenciales de acceso:
- 👤 Email: `admin@miclinica.com`
- 🔒 Password: `[tu-password]`

### Próximos pasos:
1. Crear usuarios médicos
2. Configurar la clínica
3. Cargar pacientes
4. Configurar horarios
5. ¡Empezar a usar el sistema!

---

## 📞 ¿Problemas?

### Backend no inicia
- ✅ Verificar variables de entorno
- ✅ Ver logs en Railway
- ✅ Verificar que las migraciones se ejecutaron

### CORS errors
- ✅ Verificar CORS_ORIGINS tiene la URL correcta
- ✅ Incluir https:// en la URL
- ✅ Redesplegar backend después de cambiar

### Base de datos no conecta
- ✅ Verificar credenciales MySQL
- ✅ Usar variables de referencia de Railway: `${{MYSQL...}}`
- ✅ Verificar que el servicio MySQL está corriendo

### Frontend no carga
- ✅ Verificar VITE_API_URL apunta al backend correcto
- ✅ Redesplegar en Vercel
- ✅ Ver logs en Vercel

---

**Archivo creado**: `DEPLOYMENT_CHECKLIST.md`
**Última actualización**: Marzo 2026

¡Éxito con tu deployment! 🚀
