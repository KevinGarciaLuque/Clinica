# 🚀 Guía Rápida de Despliegue en Railway

## Respuesta rápida a tu pregunta:

**SÍ, puedes subir la base de datos MySQL directamente a Railway** ✅

Railway crea y gestiona la base de datos por ti, NO necesitas usar DBeaver como servicio externo (como en el proyecto de la cooperativa).

## 📋 Pasos Rápidos:

### 1. Crear proyecto en Railway
```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Inicializar proyecto
railway init
```

### 2. Agregar MySQL desde Railway
- En el dashboard de Railway, click **"+ New" → "Database" → "MySQL"**
- Railway crea la base de datos automáticamente
- Obtienes las credenciales al instante

### 3. Vincular variables automáticamente
Railway genera estas variables automáticamente:
- `${{MYSQL.HOST}}`
- `${{MYSQL.USER}}`
- `${{MYSQL.PASSWORD}}`
- `${{MYSQL.DATABASE}}`
- `${{MYSQL.PORT}}`

### 4. Desplegar backend
```bash
railway up
```

### 5. Ejecutar migraciones
Opción A - Desde tu computadora:
```bash
railway run npm run migrate
```

Opción B - Conectar con DBeaver:
- Tomar las credenciales de Railway
- Conectar desde DBeaver
- Ejecutar el archivo `backend/database/schema.sql`
- Ejecutar las migraciones 004, 005, 006, 007, 008

## ✨ Ventajas de Railway sobre DBeaver externo:

1. **Todo en un lugar**: BD + Backend en el mismo proyecto
2. **Backups automáticos**: Railway hace backups de tu MySQL
3. **Variables automáticas**: No necesitas copiar credenciales manualmente
4. **Escalabilidad**: Crece según tu uso
5. **Logs y monitoreo**: Ves todo desde el dashboard

## 🎯 ¿Cuándo usar DBeaver?

- Solo para **conectarte** y administrar la BD
- Para ejecutar las migraciones iniciales
- Para hacer consultas manuales

Pero la base de datos **vive en Railway**, no en DBeaver.

## 📞 ¿Dudas?

Lee el archivo `DEPLOYMENT.md` para la guía completa paso a paso.
