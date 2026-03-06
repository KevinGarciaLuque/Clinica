# 🔗 Conectar Frontend (Vercel) con Backend (Railway)

## ✅ Estado Actual

- ✅ **Frontend:** https://clinica-nine-xi.vercel.app
- ✅ **Backend:** https://backend-production-dfb4.up.railway.app
- ✅ **Base de datos:** Configurada en Railway con Super Admin creado

---

## 📝 Paso 1: Configurar VITE_API_URL en Vercel

1. Ve a: https://vercel.com/kevin-garcias-proyectos-62bc76a6/clinica/settings/environment-variables
2. Click en **"Add New"**
3. Agrega:
   ```
   Name: VITE_API_URL
   Value: https://backend-production-dfb4.up.railway.app
   ```
4. Selecciona: ✅ Production, ✅ Preview, ✅ Development
5. Click **"Save"**
6. **Re-deploy:** Ve a Deployments → Click en el último deployment → **Redeploy**

---

## 📝 Paso 2: Actualizar CORS en Railway Backend

### Opción A: Desde el Dashboard de Railway

1. Ve a: https://railway.app/
2. Abre tu proyecto **Clínica Backend**
3. Click en **Variables**
4. Busca o agrega estas variables:

```env
CORS_ORIGINS=https://clinica-nine-xi.vercel.app,https://clinica-git-main-kevin-garcias-proyectos-62bc76a6.vercel.app,https://clinica-bqbytikph-kevin-garcias-proyectos-62bc76a6.vercel.app
FRONTEND_URL=https://clinica-nine-xi.vercel.app
```

5. Railway redespliegará automáticamente (espera 2-3 minutos)

### Opción B: Desde PowerShell (CLI)

```powershell
# Instalar Railway CLI (si no lo tienes)
npm install -g @railway/cli

# Login
railway login

# Ir al proyecto
cd C:\Programacion\Clinica\backend

# Configurar las variables
railway variables set CORS_ORIGINS="https://clinica-nine-xi.vercel.app,https://clinica-git-main-kevin-garcias-proyectos-62bc76a6.vercel.app"
railway variables set FRONTEND_URL="https://clinica-nine-xi.vercel.app"

# Verificar
railway variables
```

---

## 📝 Paso 3: Verificar la Conexión

1. **Espera 3-5 minutos** para que ambos servicios se redesplieguen
2. **Abre el frontend:** https://clinica-nine-xi.vercel.app
3. **Intenta hacer login:**
   - Email: `super@plataforma.com`
   - Password: `Admin12345*`

### ✅ Si funciona verás:
- Login exitoso
- Dashboard cargado
- Sin errores en la consola (F12)

### ❌ Si hay errores:

#### Error: "Network Error" o CORS
**Causa:** CORS_ORIGINS no está configurado correctamente
**Solución:** 
- Verifica que las URLs en Railway no tengan espacios
- Asegúrate de incluir `https://` (no `http://`)
- Railway debe redesplegar automáticamente

#### Error: "Cannot read properties of undefined"
**Causa:** VITE_API_URL no está configurado en Vercel
**Solución:**
- Ve a Settings → Environment Variables en Vercel
- Agrega VITE_API_URL
- Re-deploy el proyecto

#### Error 401 Unauthorized
**Causa:** Token expiró o credenciales incorrectas
**Solución:**
- Limpia localStorage: F12 → Application → Local Storage → Clear
- Intenta login nuevamente

---

## 🔍 Ver Logs en Tiempo Real

### Railway (Backend):
```powershell
railway logs
```

O desde el dashboard: 
https://railway.app/ → Tu proyecto → Click en el servicio → **Logs**

### Vercel (Frontend):
1. Ve a: https://vercel.com/kevin-garcias-proyectos-62bc76a6/clinica/deployments
2. Click en el último deployment
3. Abre la pestaña **"Functions"** o **"Build Logs"**

---

## 🎯 Testing Manual

### 1. Test de CORS (desde el navegador):

```javascript
// Abre la consola en https://clinica-nine-xi.vercel.app (F12)
fetch('https://backend-production-dfb4.up.railway.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'super@plataforma.com', 
    password: 'Admin12345*' 
  })
})
.then(r => r.json())
.then(d => console.log('✅ Backend responde:', d))
.catch(e => console.error('❌ Error:', e));
```

**Resultado esperado:** Deberías ver el token y datos del usuario

### 2. Test desde Postman:

```
POST https://backend-production-dfb4.up.railway.app/api/auth/login
Content-Type: application/json

{
  "email": "super@plataforma.com",
  "password": "Admin12345*"
}
```

---

## 📚 Variables de Entorno - Resumen

### Vercel (Frontend):
```env
VITE_API_URL=https://backend-production-dfb4.up.railway.app
```

### Railway (Backend):
```env
CORS_ORIGINS=https://clinica-nine-xi.vercel.app,https://clinica-git-main-kevin-garcias-proyectos-62bc76a6.vercel.app
FRONTEND_URL=https://clinica-nine-xi.vercel.app
NODE_ENV=production
PORT=5000
# ... (otras variables de base de datos ya configuradas)
```

---

## ✅ Checklist Final

- [ ] VITE_API_URL configurado en Vercel
- [ ] Vercel re-desplegado
- [ ] CORS_ORIGINS actualizado en Railway
- [ ] Railway re-desplegado (automático)
- [ ] Esperar 3-5 minutos
- [ ] Abrir https://clinica-nine-xi.vercel.app
- [ ] Login con super@plataforma.com / Admin12345*
- [ ] ¡Funciona! 🎉

---

## 🚀 Próximos Pasos

Una vez que funcione el login:
1. ✅ Crear tu primera clínica desde el panel de Super Admin
2. ✅ Crear usuarios (médicos, recepcionistas)
3. ✅ Registrar pacientes
4. ✅ Agendar citas
5. ✅ Usar el sistema completo
