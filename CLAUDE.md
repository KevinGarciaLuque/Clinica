# Medic-KG — guía para trabajar en este repositorio

Sistema de gestión clínica multi-clínica (medickg.com). **Está en producción con clínicas reales.**

- `frontend/`: React + Vite, desplegado en Vercel.
- `backend/`: Node/Express + MySQL (mysql2), desplegado en Railway.

## Reglas de trabajo

- **Idioma:** responder a Kevin (dueño del proyecto) en español, con lenguaje claro y no técnico.
- **Rama:** trabajar y subir directo a `main` solo con fast-forward:
  `git fetch origin main && git merge-base --is-ancestor origin/main HEAD && git push origin HEAD:main`.
  Nunca usar force-push.
- **No afectar datos ni funciones en uso.** Los cambios deben ser aditivos:
  - Para tablas nuevas, usar `CREATE TABLE IF NOT EXISTS`.
  - Para columnas nuevas, comprobar antes con `SHOW COLUMNS` y crearlas como opcionales (`NULL`).
  - Las migraciones van en el auto-migrate de `backend/server.js` o en un `asegurarTabla()` del propio módulo.
  - Si algo cambia el comportamiento actual, avisarlo explícitamente a Kevin.
  - Las correcciones de datos se hacen **una sola vez**, con marca en `migraciones_unicas`.
- **Probar antes de subir:** levantar backend y frontend en local (MariaDB de prueba) y verificar con Playwright, también en el ancho de un teléfono (390px). Luego correr `npx eslint` sobre los archivos tocados (no agregar errores nuevos) y `npx vite build`.
- **Responsivo:** toda pantalla nueva debe verse bien en el teléfono, sin desbordar horizontalmente.

## ⭐ Siempre publicar una novedad

**Cada vez que se agregue o mejore algo visible para las clínicas, hay que publicar una novedad corta** para que la vean en el botón ✨ Novedades. Se hace agregando una entrada al final de `backend/data/novedades.js`:

- `clave`: única y estable.
- `version`: la siguiente a la última (1.12, 1.13…).
- `titulo`: corto.
- `descripcion`: 1–3 frases en lenguaje de la clínica que digan qué cambió y dónde encontrarlo.
- `icono`: clase `bi-…` de Bootstrap Icons.
- `audiencia`: `TODOS`, `MEDICOS` o `ADMIN`.
- `importante`: `true` solo para cambios grandes.

El servidor la publica sola al arrancar y nunca la duplica. Los arreglos internos sin efecto visible no llevan novedad.

## Convenciones útiles

- **Fechas de citas:** `citas.inicio` es hora local de la clínica, sin zona horaria. Para comparar con "ahora", usar `dayjs().tz(clinica.timezone)` y comparar como texto.
- **Título del médico:** se arma con `utils/tituloMedico.js` (backend) y `utils/medico.js` (frontend), según `usuarios.sexo` y `nombre_display`.
- **Correos a pacientes:** usar `utils/mailer.js` (`enviarEmail`). Los enlaces públicos se arman con `FRONTEND_URL`.
- **Avisos a la clínica:** insertar en `notificaciones_usuario`, avisar en tiempo real con `sse.notifyUser` y enviar push con `webPush.sendToUsers`.
- **No guardar credenciales en el repositorio** (el repo es público).
