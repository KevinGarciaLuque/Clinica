# 🚀 Desplegar Frontend en Vercel

## Paso 1: Crear cuenta en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Click en **"Sign Up"**
3. Selecciona **"Continue with GitHub"**
4. Autoriza Vercel a acceder a tus repositorios

---

## Paso 2: Importar el proyecto

1. En el dashboard de Vercel, click en **"Add New..."** → **"Project"**
2. Busca tu repositorio **"Clinica"**
3. Click en **"Import"**

---

## Paso 3: Configurar el proyecto

Vercel debería detectar automáticamente que es Vite, pero verifica:

### ⚙️ Build & Development Settings:

```
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 📌 Si no lo detecta automáticamente:
- Click en **"Edit"** junto a cada campo
- Ingresa los valores de arriba

---

## Paso 4: Variables de entorno

En la sección **"Environment Variables"**, agrega:

```
VITE_API_URL = https://tu-backend.up.railway.app
```

**⚠️ IMPORTANTE**: 
- Obtén la URL del backend desde Railway
- NO incluyas `/api` al final
- Debe ser `https://`, no `http://`

### Cómo obtener la URL del backend:
1. Ve a Railway
2. Click en tu servicio Backend (Clínica)
3. Ve a **Settings** → **Networking**
4. Copia la URL pública (ejemplo: `https://clinica-production-abc123.up.railway.app`)

---

## Paso 5: Deploy! 🚀

1. Click en **"Deploy"**
2. Espera 2-3 minutos mientras Vercel construye tu aplicación
3. ¡Listo! Vercel te dará una URL como: `https://clinica.vercel.app`

---

## Paso 6: Actualizar CORS en Railway

Ahora que tienes la URL del frontend, actualiza el backend:

1. Ve a Railway → Servicio Backend → **Variables**
2. Actualiza estas variables:

```env
CORS_ORIGINS=https://clinica.vercel.app,https://clinica-git-main-tuusuario.vercel.app
FRONTEND_URL=https://clinica.vercel.app
```

3. Railway redespliegará automáticamente

---

## 🎯 Verificar que funciona

1. Abre tu frontend: `https://clinica.vercel.app`
2. Intenta hacer login
3. Abre la consola del navegador (F12)
4. NO deberías ver errores de CORS
5. Las peticiones deberían ir a tu backend en Railway

---

## 🔧 Troubleshooting

### Error: "Network Error" o CORS

**Solución**: Verifica que:
- `VITE_API_URL` en Vercel apunta al backend correcto
- `CORS_ORIGINS` en Railway incluye la URL de Vercel
- Ambas URLs son HTTPS

### Error: "Cannot GET /ruta"

**Solución**: Vercel ya tiene el `vercel.json` configurado que redirige todo a `index.html`

### Error: Variables de entorno no se cargan

**Solución**: 
- Las variables en Vercel deben empezar con `VITE_`
- Redespliega desde Vercel después de agregar variables

---

## 🔄 Redesplegar después de cambios

### Automático (Recomendado):
Cada vez que hagas `git push`, Vercel despliega automáticamente.

### Manual:
1. Ve a Vercel Dashboard
2. Click en tu proyecto
3. **Deployments** → **"Redeploy"**

---

## 💰 Costo

**GRATIS** para proyectos personales:
- ✅ Despliegues ilimitados
- ✅ SSL automático
- ✅ CDN global
- ✅ Analytics básico

---

## 🌐 Dominio personalizado (Opcional)

Para usar tu propio dominio:

1. **Deployments** → **Settings** → **Domains**
2. Agrega tu dominio: `www.tuclinica.com`
3. Configura los DNS según instrucciones de Vercel
4. Actualiza `CORS_ORIGINS` en Railway con el nuevo dominio

---

## ✅ Checklist Final

- [ ] Proyecto importado en Vercel
- [ ] Root Directory: `frontend`
- [ ] Variable `VITE_API_URL` configurada
- [ ] Deploy exitoso
- [ ] URL del frontend obtenida
- [ ] `CORS_ORIGINS` actualizado en Railway
- [ ] Login funciona correctamente
- [ ] No hay errores en la consola

---

¡Tu sistema ya está en producción! 🎉

**URLs importantes:**
- Frontend: `https://clinica.vercel.app`
- Backend: `https://tu-backend.up.railway.app`
