# 🚀 Despliegue en Railway

## Pasos para desplegar tu sistema de clínica en Railway

### 1️⃣ Preparar el proyecto

Asegúrate de tener todo commiteado en Git:
```bash
git add .
git commit -m "Preparar para deployment en Railway"
git push
```

### 2️⃣ Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Regístrate con GitHub
3. Conecta tu repositorio

### 3️⃣ Crear servicios en Railway

#### A. Crear base de datos MySQL

1. En Railway, haz clic en **"+ New"**
2. Selecciona **"Database" → "MySQL"**
3. Railway creará automáticamente la base de datos
4. Anota las credenciales que te da (o déjalas, las usaremos con variables)

#### B. Crear servicio del Backend

1. Haz clic en **"+ New"**
2. Selecciona **"GitHub Repo"**
3. Busca y selecciona tu repositorio
4. Railway detectará automáticamente que es Node.js

#### C. Configurar variables de entorno del Backend

En el servicio del Backend, ve a **"Variables"** y agrega:

```env
# Puerto (Railway lo asigna automáticamente)
PORT=${{PORT}}

# Ambiente
NODE_ENV=production

# Base de datos (usa las variables del servicio MySQL)
DB_HOST=${{MYSQL.HOST}}
DB_PORT=${{MYSQL.PORT}}
DB_USER=${{MYSQL.USER}}
DB_PASSWORD=${{MYSQL.PASSWORD}}
DB_NAME=${{MYSQL.DATABASE}}

# JWT
JWT_SECRET=TU_SECRETO_LARGO_Y_SEGURO_MINIMO_32_CARACTERES
JWT_EXPIRES=8h

# Multi-tenant
TENANT_MODE=header

# CORS (agrega el dominio del frontend cuando lo despliegues)
CORS_ORIGINS=https://tu-frontend.up.railway.app,https://tudominio.com

# Frontend URL (actualiza cuando tengas el dominio)
FRONTEND_URL=https://tu-frontend.up.railway.app

# OpenAI (si usas el módulo IA)
OPENAI_API_KEY=sk-tu-api-key
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=2000

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_password_de_aplicacion
EMAIL_FROM=Multi-Clínica <noreply@tuclinica.com>

# Almacenamiento
STORAGE_MODE=local
UPLOADS_DIR=./uploads

# Seguridad
SESSION_TIMEOUT_MIN=30
ENCRYPTION_KEY=cambia_esto_por_32_caracteres_hex_seguros
```

### 4️⃣ Ejecutar migraciones de base de datos

Hay dos opciones:

#### Opción A: Desde Railway CLI (Recomendada)

1. Instala Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login:
```bash
railway login
```

3. Conecta al proyecto:
```bash
railway link
```

4. Ejecuta las migraciones:
```bash
railway run mysql -h ${{MYSQL.HOST}} -u ${{MYSQL.USER}} -p${{MYSQL.PASSWORD}} ${{MYSQL.DATABASE}} < backend/database/schema.sql
```

#### Opción B: Crear un script de migración

Crea un endpoint temporal en el backend para ejecutar las migraciones:

```javascript
// backend/routes/database.js - Solo para deployment inicial
app.post('/api/setup-database', async (req, res) => {
  // Agregar autenticación con un token secreto
  if (req.headers['x-setup-token'] !== process.env.SETUP_TOKEN) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  
  const fs = require('fs');
  const sql = fs.readFileSync('./database/schema.sql', 'utf8');
  
  // Ejecutar SQL
  await pool.query(sql);
  
  res.json({ success: true });
});
```

Luego llama al endpoint desde Postman o curl.

#### Opción C: Usar DBeaver o MySQL Workbench

1. En Railway, ve al servicio MySQL
2. Haz clic en **"Connect"**
3. Copia las credenciales
4. Conéctate desde DBeaver/MySQL Workbench
5. Ejecuta el archivo `backend/database/schema.sql`
6. Ejecuta las migraciones en orden:
   - `004_registro_pacientes.sql`
   - `005_cie10_seed.sql`
   - `006_tipos_clinica_modulos.sql`
   - `007_galeria_estetica.sql`
   - `008_ordenar_modulos.sql`

### 5️⃣ Desplegar el Frontend

#### Opción A: En Railway

1. Haz clic en **"+ New"**
2. Selecciona **"GitHub Repo"** (mismo repo)
3. Configura en **"Settings" → "Build"**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run preview` o usa un servidor estático

#### Opción B: En Vercel (Más fácil para React)

1. Ve a [vercel.com](https://vercel.com)
2. Importa el proyecto desde GitHub
3. Configura:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Variables de entorno:
```env
VITE_API_URL=https://tu-backend.up.railway.app
```

### 6️⃣ Actualizar CORS

Una vez que tengas las URLs de Railway/Vercel, actualiza la variable `CORS_ORIGINS` en el backend con las URLs reales.

### 7️⃣ Verificar el despliegue

1. Ve a la URL del backend: `https://tu-backend.up.railway.app/api/health`
2. Ve a la URL del frontend: `https://tu-frontend.up.railway.app`
3. Prueba el login y las funcionalidades

## 🔧 Solución de problemas

### La base de datos no se conecta
- Verifica que las variables `DB_HOST`, `DB_USER`, `DB_PASSWORD` estén correctas
- Asegúrate de usar las referencias `${{MYSQL.HOST}}` en Railway

### Error de CORS
- Agrega las URLs de Railway/Vercel a `CORS_ORIGINS`
- Incluye tanto HTTP como HTTPS si es necesario

### Archivos uploads no se guardan
- En producción, considera migrar a Cloudinary
- Los archivos en Railway se borran al redesplegar
- Cambia `STORAGE_MODE=cloudinary` y configura las variables

### 🎯 Siguiente nivel

1. **Dominio personalizado**: Configura tu dominio en Railway
2. **SSL automático**: Railway lo incluye gratis
3. **Backups**: Configure backups de MySQL en Railway
4. **Monitoreo**: Usa las métricas de Railway
5. **Cloudinary**: Para almacenar imágenes de forma persistente

## 💰 Costos estimados

- **Railway**: $5-20/mes (incluye $5 gratis)
- **MySQL**: Incluido en el plan
- **Alternativa gratuita**: Render.com (más lento pero gratis)

## 📝 Checklist final

- [ ] Código en Git y pusheado
- [ ] Cuenta en Railway creada
- [ ] Servicio MySQL creado
- [ ] Servicio Backend desplegado
- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas
- [ ] Frontend desplegado
- [ ] CORS configurado
- [ ] Login funcionando
- [ ] Crear usuario superadmin inicial

---

**¿Necesitas ayuda?** Pregúntame cualquier duda sobre el proceso.
