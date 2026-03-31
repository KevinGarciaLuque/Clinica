# 📲 Módulo de Recordatorios - Instalación y Configuración

## 🚀 Instalación

### 1. Ejecutar la migración de base de datos

```powershell
cd backend
node migrations/run-011.js
```

Esto creará las siguientes tablas:
- `clinica_smtp_config` - Configuración de email SMTP
- `clinica_mensajeria_config` - Configuración de Twilio (SMS/WhatsApp)
- `plantillas_recordatorio` - Plantillas personalizables
- `clinica_recordatorios_config` - Configuración de envío automático
- `historial_recordatorios` - Registro de todos los envíos
- Actualiza `cita_recordatorios` con más opciones
- Agrega el módulo al sistema

### 2. Instalar dependencias

```powershell
cd backend
npm install twilio
```

### 3. Configurar variables de entorno (opcional)

Agrega al archivo `.env`:

```env
# Clave de encriptación para credenciales sensibles (32 caracteres)
ENCRYPTION_KEY=tu-clave-secreta-de-32-chars
```

---

## 📧 Configuración de Email (SMTP)

### Opción 1: Gmail

1. Accede a tu cuenta de Google
2. Ve a **Seguridad** → **Verificación en 2 pasos** (actívala si no la tienes)
3. Ve a **Contraseñas de aplicaciones**: https://myaccount.google.com/apppasswords
4. Crea una contraseña para "Correo" → "Otro"
5. Usa esta contraseña en la configuración SMTP

**Configuración:**
- **Servidor:** `smtp.gmail.com`
- **Puerto:** `587`
- **Conexión:** TLS
- **Usuario:** tu-email@gmail.com
- **Contraseña:** La contraseña de aplicación generada

### Opción 2: Outlook/Hotmail

**Configuración:**
- **Servidor:** `smtp-mail.outlook.com`
- **Puerto:** `587`
- **Conexión:** TLS
- **Usuario:** tu-email@outlook.com
- **Contraseña:** Tu contraseña de Outlook

### Opción 3: Office 365

**Configuración:**
- **Servidor:** `smtp.office365.com`
- **Puerto:** `587`
- **Conexión:** TLS
- **Usuario:** tu-email@tudominio.com
- **Contraseña:** Tu contraseña de Office 365

---

## 📱 Configuración de SMS (Twilio)

### 1. Crear cuenta en Twilio

1. Regístrate en https://www.twilio.com
2. Verifica tu email y número de teléfono
3. Obtén créditos gratuales para pruebas ($15 USD)

### 2. Obtener credenciales

1. En el Dashboard de Twilio, copia:
   - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token**: Tu token secreto
2. Compra un número de teléfono (Phone Numbers → Buy a Number)
3. Copia el número en formato internacional: `+15551234567`

### 3. Configurar en la aplicación

1. Ve a **Recordatorios** → **SMS**
2. Pega tus credenciales
3. Activa el servicio
4. Envía una prueba

**Costos:**
- Número de teléfono: ~$1 USD/mes
- SMS: ~$0.0075 USD por mensaje (varía según país)

---

## 💬 Configuración de WhatsApp (Twilio)

### 1. Configurar WhatsApp en Twilio

1. En Twilio, ve a **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Sigue las instrucciones para unir tu WhatsApp Sandbox
3. Copia el número sandbox (ej: `+14155238886`)

### 2. Para producción (WhatsApp Business API)

1. Solicita acceso a WhatsApp Business API en Twilio
2. Completa el proceso de verificación de negocio
3. Obtén tu número de WhatsApp Business aprobado

### 3. Configurar en la aplicación

1. Ve a **Recordatorios** → **WhatsApp**
2. Usa las mismas credenciales de Twilio (Account SID y Auth Token)
3. Pega el número de WhatsApp (sandbox o producción)
4. Activa el servicio

**Nota:** El sandbox es gratuito pero requiere que los usuarios envíen un código para unirse.

**Costos (Producción):**
- Configuración: Varía según región
- Mensajes: ~$0.005 USD por mensaje conversacional

---

## ⚙️ Configuración de Recordatorios Automáticos

### 1. Crear plantillas predeterminadas

1. Ve a **Recordatorios** → **Plantillas**
2. Haz clic en **Crear plantillas predeterminadas**
3. Se crearán plantillas para Email, SMS y WhatsApp

### 2. Personalizar plantillas

Puedes editar las plantillas con las siguientes variables:
- `{paciente}` - Nombre completo del paciente
- `{medico}` - Nombre del médico
- `{fecha}` - Fecha de la cita
- `{hora}` - Hora de la cita
- `{clinica}` - Nombre de la clínica

Ejemplo:
```
Hola {paciente},

Te recordamos tu cita médica:
📅 {fecha} a las {hora}
👨‍⚕️ Dr/a. {medico}

¡Te esperamos!
{clinica}
```

### 3. Activar envío automático

1. Ve a **Recordatorios** → **Automático**
2. Activa los canales que desees usar (Email, SMS, WhatsApp)
3. Selecciona cuándo enviar: 48h, 24h o 2h antes de cada cita
4. Configura la hora de ejecución diaria (ej: 8:00 AM)
5. Guarda la configuración

### 4. Configurar un cron job (producción)

Para envío automático, necesitas un proceso que ejecute el envío:

#### Opción A: Cron en Linux/Mac
```bash
# Editar crontab
crontab -e

# Agregar línea (ejecuta a las 8 AM diariamente)
0 8 * * * cd /ruta/a/tu/backend && node scripts/enviar-recordatorios.js
```

#### Opción B: Task Scheduler en Windows
1. Abre "Programador de tareas"
2. Crea una tarea nueva
3. Programa: `node C:\ruta\backend\scripts\enviar-recordatorios.js`
4. Frecuencia: Diaria a las 8:00 AM

#### Opción C: Servicio en Railway/Heroku
Usa un servicio de cron como **EasyCron** o **cron-job.org** para hacer peticiones HTTP a un endpoint:
```
POST https://tu-api.railway.app/api/recordatorios/enviar-automaticos
Authorization: Bearer TU_TOKEN_ADMIN
```

---

## 📊 Monitoreo

### Ver historial de envíos

1. Ve a **Recordatorios** → **Historial**
2. Verás todos los recordatorios enviados con:
   - Estado (Enviado/Fallido)
   - Paciente
   - Canal (Email/SMS/WhatsApp)
   - Fecha de envío

### Estadísticas

En la vista principal verás:
- Total de recordatorios enviados (últimos 30 días)
- Exitosos vs. fallidos
- Desglose por canal (Email, SMS, WhatsApp)

---

## 🔒 Seguridad

Las credenciales sensibles (contraseñas SMTP, tokens de Twilio) se almacenan **encriptadas** en la base de datos usando AES-256-CBC.

**Importante:** Cambia la variable `ENCRYPTION_KEY` en `.env` por una clave única de 32 caracteres:

```env
ENCRYPTION_KEY=mi-clave-super-secreta-2026-xxyyzz
```

---

## 🧪 Pruebas

### Probar Email
1. Configura SMTP
2. Haz clic en "Enviar prueba"
3. Ingresa tu email
4. Verifica que llegó el correo

### Probar SMS
1. Configura Twilio SMS
2. Haz clic en "Enviar prueba"
3. Ingresa tu número con código de país (ej: +51987654321)
4. Verifica que llegó el SMS

### Probar WhatsApp
1. Configura Twilio WhatsApp
2. Si usas sandbox, únete primero enviando el código desde tu WhatsApp
3. Haz clic en "Enviar prueba"
4. Ingresa tu número
5. Verifica el mensaje en WhatsApp

---

## ❓ Preguntas frecuentes

### ¿Puedo usar solo email sin SMS/WhatsApp?
Sí, cada canal es opcional. Activa solo los que necesites.

### ¿Cuánto cuesta Twilio?
- **Cuenta gratuita:** $15 USD de crédito para pruebas
- **SMS:** ~$0.0075 USD por mensaje
- **WhatsApp:** ~$0.005 USD por mensaje conversacional
- Los precios varían según el país de destino

### ¿Cómo envío recordatorios automáticos?
Necesitas configurar un cron job o scheduler que ejecute el proceso de envío diariamente. Ver sección "Configurar un cron job".

### ¿Puedo personalizar los mensajes?
Sí, en **Recordatorios** → **Plantillas** puedes crear y editar plantillas totalmente personalizadas.

### ¿Los pacientes pueden responder los mensajes?
Depende del servicio:
- **Email:** Sí, si usas un email real
- **SMS:** No automáticamente (requiere lógica adicional)
- **WhatsApp:** Sí, pero requiere manejo de webhooks de Twilio

---

## 🆘 Soporte

Para problemas o dudas:
1. Revisa el **Historial** para ver si hay errores
2. Verifica que las credenciales sean correctas
3. Revisa los logs en la consola del backend
4. Para Gmail, verifica que tienes activada la verificación en 2 pasos

---

¡Listo! 🎉 Ya tienes un sistema profesional de recordatorios configurado.
