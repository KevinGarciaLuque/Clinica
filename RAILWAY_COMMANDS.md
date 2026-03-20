# 🛠️ Comandos Útiles para Railway

## Instalación inicial

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Verificar instalación
railway --version
```

## 🆕 MIGRACIÓN 010 - MÓDULO DE CONSULTA

```bash
# Ejecutar migración 010 en Railway
railway run node backend/migrations/run-010.js

# O conectarse y ejecutar manualmente:
railway connect
# Luego en la terminal conectada:
cd backend
node migrations/run-010.js
```

## Comandos básicos

```bash
# Login en Railway
railway login

# Vincular proyecto existente
railway link

# Ver variables de entorno
railway variables

# Agregar variable
railway variables set KEY=value

# Ver logs en tiempo real
railway logs

# Ejecutar comando en Railway
railway run [comando]

# Abrir dashboard en navegador
railway open
```

## Deployment

```bash
# Deploy manual
railway up

# Deploy con logs
railway up --verbose

# Especificar servicio
railway up --service backend
```

## Base de datos

```bash
# Ejecutar migraciones
railway run npm run migrate

# Conectar a MySQL directamente
railway run mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME

# Backup de base de datos
railway run mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup.sql

# Restaurar backup
railway run mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < backup.sql

# Ver tablas
railway run mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TABLES;"
```

## Debugging

```bash
# Ver logs del backend
railway logs --service backend

# Ver logs de MySQL
railway logs --service mysql

# Ver últimas 100 líneas
railway logs --tail 100

# Seguir logs en tiempo real
railway logs --follow

# Connecting to shell
railway shell
```

## Git y Railway

```bash
# Commit y deploy en un comando (usa deploy.ps1)
.\deploy.ps1

# O manualmente:
git add .
git commit -m "Update"
git push
railway up
```

## Variables de entorno

```bash
# Ver todas las variables
railway variables

# Exportar variables localmente
railway variables --json > env.json

# Setear variable
railway variables set NODE_ENV=production

# Cargar desde archivo .env
railway variables set $(cat .env)

# Eliminar variable
railway variables delete KEY
```

## Servicios múltiples

```bash
# Listar servicios
railway services

# Seleccionar servicio
railway service

# Logs de servicio específico
railway logs --service backend
railway logs --service mysql

# Deploy servicio específico
railway up --service backend
```

## Gestión de proyectos

```bash
# Listar proyectos
railway list

# Cambiar de proyecto
railway switch

# Ver status del proyecto
railway status

# Información del proyecto
railway whoami
```

## Dominios

```bash
# Ver dominios
railway domain

# Agregar dominio
railway domain add tudominio.com
```

## Ejemplo: Workflow completo de deployment

```bash
# 1. Asegurarse de que todo está commiteado
git status
git add .
git commit -m "Ready for deployment"
git push

# 2. Vincular con Railway (solo primera vez)
railway login
railway link

# 3. Configurar variables (solo primera vez)
railway variables set NODE_ENV=production
railway variables set DB_HOST='${{MYSQL.HOST}}'
railway variables set DB_USER='${{MYSQL.USER}}'
railway variables set DB_PASSWORD='${{MYSQL.PASSWORD}}'
railway variables set DB_NAME='${{MYSQL.DATABASE}}'
railway variables set JWT_SECRET="mi-secreto-super-largo-y-seguro"

# 4. Deploy
railway up

# 5. Ejecutar migraciones (solo primera vez o cuando hay cambios)
railway run npm run migrate

# 6. Ver logs
railway logs --follow

# 7. Abrir en navegador
railway open
```

## Ejemplo: Backup y restore de BD

```bash
# Backup completo
railway run mysqldump \
  -h '${{MYSQL.HOST}}' \
  -u '${{MYSQL.USER}}' \
  -p'${{MYSQL.PASSWORD}}' \
  '${{MYSQL.DATABASE}}' \
  --single-transaction \
  --quick \
  --lock-tables=false \
  > "backup-$(date +%Y%m%d-%H%M%S).sql"

# Restore
railway run mysql \
  -h '${{MYSQL.HOST}}' \
  -u '${{MYSQL.USER}}' \
  -p'${{MYSQL.PASSWORD}}' \
  '${{MYSQL.DATABASE}}' \
  < backup-20260305-123000.sql
```

## Ejemplo: Ejecutar query SQL

```bash
# Una línea
railway run mysql \
  -h '${{MYSQL.HOST}}' \
  -u '${{MYSQL.USER}}' \
  -p'${{MYSQL.PASSWORD}}' \
  '${{MYSQL.DATABASE}}' \
  -e "SELECT * FROM usuarios LIMIT 5;"

# Desde archivo
railway run mysql \
  -h '${{MYSQL.HOST}}' \
  -u '${{MYSQL.USER}}' \
  -p'${{MYSQL.PASSWORD}}' \
  '${{MYSQL.DATABASE}}' \
  < consulta.sql
```

## Ejemplo: Reset completo de BD (¡CUIDADO!)

```bash
# Hacer backup primero
railway run mysqldump ... > backup-antes-reset.sql

# Drop todas las tablas
railway run mysql ... -e "DROP DATABASE IF EXISTS clinica; CREATE DATABASE clinica;"

# Re-ejecutar migraciones
railway run npm run migrate

# Ejecutar seeds
railway run node migrations/seed-superadmin.js
railway run node migrations/seed-medico.js
```

## PowerShell (Windows)

Para PowerShell, algunos comandos necesitan sintaxis diferente:

```powershell
# Ver variables
railway variables

# Set variable con comillas
railway variables set "JWT_SECRET=mi-secreto-largo"

# Ejecutar con PowerShell
railway run "npm run migrate"

# Backup (PowerShell)
$date = Get-Date -Format "yyyyMMdd-HHmmss"
railway run "mysqldump ..." | Out-File "backup-$date.sql"
```

## Troubleshooting común

### Error: "No project found"
```bash
railway link
# Seleccionar tu proyecto de la lista
```

### Error: "Not authenticated"
```bash
railway logout
railway login
```

### Error: Variables no se cargan
```bash
# Verificar que existan
railway variables

# Redesplegar para forzar recarga
railway up --force
```

### Error: CORS en producción
```bash
# Verificar CORS_ORIGINS
railway variables | grep CORS

# Actualizar con URL correcta
railway variables set CORS_ORIGINS="https://tu-frontend.vercel.app"
```

### Base de datos no conecta
```bash
# Ver logs para errores de conexión
railway logs --service backend | grep -i "database\|mysql\|connection"

# Verificar variables de BD
railway variables | grep DB_
```

## Scripts útiles (package.json)

Agrega estos scripts a tu `backend/package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "node migrate.js",
    "seed": "node migrations/seed-superadmin.js",
    "deploy": "railway up",
    "logs": "railway logs --follow"
  }
}
```

Luego puedes usar:
```bash
npm run deploy
npm run logs
railway run npm run migrate
railway run npm run seed
```

---

## 🔗 Enlaces útiles

- **Railway Dashboard**: https://railway.app/dashboard
- **Railway Docs**: https://docs.railway.app
- **Railway CLI Docs**: https://docs.railway.app/develop/cli
- **Railway Status**: https://status.railway.app

---

**Tip Pro**: Crea aliases en tu shell para comandos frecuentes:

```bash
# En ~/.bashrc o ~/.zshrc (Linux/Mac)
alias rdeploy="railway up"
alias rlogs="railway logs --follow"
alias rvars="railway variables"

# En PowerShell (Windows) - agregar a $PROFILE
Set-Alias rdeploy railway up
Set-Alias rlogs railway logs --follow
```
