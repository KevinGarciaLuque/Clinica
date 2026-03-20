# ============================================================
# Instrucciones para Aplicar la Migración 010 en Railway
# ============================================================

## OPCIÓN 1: Usando Railway CLI (Recomendado)

1. **Conectar a Railway:**
   ```bash
   railway login
   railway link
   ```

2. **Ejecutar la migración directamente:**
   ```bash
   railway run node backend/migrations/run-010.js
   ```

## OPCIÓN 2: Usando el Panel Web de Railway

1. **Ir a Railway Dashboard:**
   https://railway.app/

2. **Seleccionar tu proyecto de la clínica**

3. **Click en el servicio MySQL/PostgreSQL**

4. **Click en "Query" o "Connect"**

5. **Ejecutar este SQL:**
   ```sql
   -- Insertar el módulo de Consulta
   INSERT IGNORE INTO modulos_sistema (clave, nombre, icono, ruta, orden, descripcion, disponible) 
   VALUES ('consulta', 'Consulta', 'bi-clipboard2-pulse-fill', '/consulta', 35, 'Vista de citas del día y sala de espera', 1);

   -- Asignar el módulo a todos los tipos de clínica
   INSERT IGNORE INTO tipo_clinica_modulos (tipo_id, modulo_id)
   SELECT t.id, m.id
   FROM tipos_clinica t
   CROSS JOIN modulos_sistema m
   WHERE m.clave = 'consulta';

   -- Verificar
   SELECT * FROM modulos_sistema WHERE clave = 'consulta';
   ```

## OPCIÓN 3: Ejecutar el script SQL directamente

1. **Copiar el contenido del archivo:**
   `backend/migrations/RAILWAY_010_CONSULTA.sql`

2. **Ejecutarlo en el Query Editor de Railway**

## ✅ Verificación

Después de ejecutar la migración:
1. Recargar la página en producción (Ctrl+F5)
2. El módulo "Consulta" debería aparecer en el sidebar
3. Vercel ya desplegó automáticamente el frontend actualizado

## 🔄 Estado Actual

✅ Frontend subido a GitHub → Vercel desplegará automáticamente
⏳ Base de datos Railway → Necesita ejecutar migración manualmente
