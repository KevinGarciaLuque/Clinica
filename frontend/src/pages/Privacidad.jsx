import { useEffect } from "react";

/**
 * Política de Privacidad — página pública (requerida por Google para la
 * verificación / publicación de la app OAuth de Google Calendar).
 * Ruta: /privacidad
 */
export default function Privacidad() {
  useEffect(() => { document.title = "Política de Privacidad · Medic-KG"; }, []);

  const hoy = "28 de agosto de 2026";

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: "40px 16px" }}>
      <div style={{
        maxWidth: 820, margin: "0 auto", background: "#fff", borderRadius: 14,
        border: "1px solid #e2e8f0", padding: "40px 44px", lineHeight: 1.7,
        color: "#334155", fontSize: "0.95rem",
      }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
          Política de Privacidad
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: 0 }}>
          Medic-KG — Sistema de Gestión Clínica · Última actualización: {hoy}
        </p>

        <h2 style={h2}>1. Quiénes somos</h2>
        <p>
          Medic-KG es un software de gestión clínica utilizado por profesionales de la salud y
          clínicas para administrar pacientes, citas, historias clínicas, recetas, facturación
          y recordatorios. Esta política describe qué datos tratamos y cómo los protegemos.
        </p>

        <h2 style={h2}>2. Datos que tratamos</h2>
        <ul>
          <li>
            <strong>Datos de cuenta:</strong> nombre, correo electrónico, teléfono y rol del
            personal de la clínica que usa el sistema.
          </li>
          <li>
            <strong>Datos clínicos:</strong> información de pacientes, citas, consultas,
            diagnósticos, recetas y documentos, ingresada por el personal autorizado de cada
            clínica. Cada clínica es responsable de los datos de sus pacientes; Medic-KG los
            procesa por cuenta de ella.
          </li>
          <li>
            <strong>Datos técnicos:</strong> registros de acceso y actividad para seguridad y
            soporte.
          </li>
        </ul>

        <h2 style={h2}>3. Integración con Google Calendar</h2>
        <p>
          Si un profesional decide conectar su cuenta de Google, solicitamos su consentimiento
          para los siguientes permisos, con estos usos y ningún otro:
        </p>
        <ul>
          <li>
            <strong>Ver y editar eventos de tus calendarios</strong>{" "}
            (<code>calendar.events</code>): para crear, actualizar y eliminar en tu Google
            Calendar los eventos correspondientes a las citas que gestionás en Medic-KG.
          </li>
          <li>
            <strong>Ver tu disponibilidad</strong> (<code>calendar.freebusy</code>): para leer
            tus franjas ocupadas y no ofrecer esos horarios a los pacientes al agendar.
          </li>
          <li>
            <strong>Ver tu dirección de correo</strong> (<code>userinfo.email</code>): para
            identificar y mostrar qué cuenta de Google quedó vinculada.
          </li>
        </ul>
        <p>
          El uso de la información recibida de las APIs de Google se ajusta a la{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Política de Datos de Usuario de los Servicios de API de Google
          </a>, incluidos sus requisitos de <strong>Uso Limitado</strong>. En concreto:
        </p>
        <ul>
          <li>Solo usamos los datos de Google para las funciones descritas arriba.</li>
          <li>No transferimos ni vendemos esos datos a terceros, ni los usamos para publicidad.</li>
          <li>Ningún humano lee los datos de tu calendario, salvo que lo autorices para soporte, sea necesario por seguridad o lo exija la ley.</li>
        </ul>
        <p>
          Los tokens de acceso de Google se guardan <strong>cifrados</strong> y solo se usan
          para las llamadas necesarias. Podés desconectar tu cuenta en cualquier momento desde{" "}
          <em>Mi Perfil → Google Calendar → Desconectar</em>, o revocando el acceso en{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>. Al desconectar, eliminamos los tokens almacenados.
        </p>

        <h2 style={h2}>4. Cómo usamos los datos</h2>
        <ul>
          <li>Prestar el servicio de gestión clínica a la clínica contratante.</li>
          <li>Enviar recordatorios de citas y notificaciones que la clínica configure.</li>
          <li>Dar soporte técnico y garantizar la seguridad del sistema.</li>
        </ul>
        <p>No vendemos datos personales ni clínicos.</p>

        <h2 style={h2}>5. Con quién se comparten</h2>
        <ul>
          <li>Proveedores de infraestructura (alojamiento, base de datos, correo) bajo contrato y solo para operar el servicio.</li>
          <li>Google, únicamente para la integración de calendario descrita, si la activás.</li>
          <li>Autoridades, cuando lo exija la ley.</li>
        </ul>

        <h2 style={h2}>6. Seguridad</h2>
        <p>
          Usamos conexiones cifradas (HTTPS), cifrado de credenciales sensibles en reposo,
          control de acceso por roles y registros de auditoría. Ningún sistema es 100% infalible,
          pero aplicamos medidas razonables acordes al sector salud.
        </p>

        <h2 style={h2}>7. Conservación</h2>
        <p>
          Los datos se conservan mientras la clínica mantenga su cuenta activa y según los plazos
          legales aplicables a la documentación clínica. Los tokens de Google se eliminan al
          desconectar la cuenta.
        </p>

        <h2 style={h2}>8. Tus derechos</h2>
        <p>
          Podés solicitar acceso, corrección o eliminación de tus datos personales escribiendo al
          correo de contacto. Las solicitudes sobre datos de pacientes se canalizan a través de la
          clínica responsable.
        </p>

        <h2 style={h2}>9. Contacto</h2>
        <p>
          Consultas sobre privacidad:{" "}
          <a href="mailto:soporte.medickg@gmail.com">soporte.medickg@gmail.com</a>
        </p>

        <h2 style={h2}>10. Cambios</h2>
        <p>
          Podemos actualizar esta política. Publicaremos la versión vigente en esta misma página
          con su fecha de actualización.
        </p>
      </div>
    </div>
  );
}

const h2 = {
  fontSize: "1.05rem", fontWeight: 700, color: "#0f172a",
  marginTop: 28, marginBottom: 8,
};
