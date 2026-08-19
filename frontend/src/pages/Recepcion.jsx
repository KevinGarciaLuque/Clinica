import { useState, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import api from "../api/api";

const TABS = [
  { id: "pendientes", label: "Pendientes", icon: "bi-inbox-fill" },
  { id: "historial",  label: "Historial",  icon: "bi-clock-history" },
];

async function imprimirPdf(url) {
  try {
    const r = await api.get(url, { responseType: "blob" });
    window.open(URL.createObjectURL(new Blob([r.data], { type: "application/pdf" })), "_blank");
  } catch {
    alert("Error al generar PDF");
  }
}

function BotonPdf({ url }) {
  return (
    <button
      className="btn btn-outline-primary btn-sm"
      style={{ fontSize: "0.75rem", borderRadius: 7 }}
      onClick={() => imprimirPdf(url)}
    >
      <i className="bi bi-printer me-1" />PDF
    </button>
  );
}

function Tarjeta({ tipoIcono, tipoColor, titulo, subtitulo, paciente, medico, fecha, urgente, accion }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", padding: "10px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: tipoColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className={`bi ${tipoIcono}`} style={{ color: "#fff", fontSize: "0.85rem" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
            {titulo}
            {urgente === 1 && <span className="badge bg-danger ms-2" style={{ fontSize: "0.65rem" }}>URGENTE</span>}
          </div>
          <div style={{ fontSize: "0.78rem", color: "#334155" }}>{paciente}</div>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 1 }}>
            {subtitulo} · Dr(a). {medico} · {dayjs(fecha).format("DD/MM/YYYY HH:mm")}
          </div>
        </div>
      </div>
      {accion}
    </div>
  );
}

export default function Recepcion() {
  const [tab, setTab] = useState("pendientes");
  const [pendientes, setPendientes] = useState({ recetas: [], estudios: [] });
  const [historial, setHistorial]   = useState({ recetas: [], estudios: [] });
  const [cargando, setCargando]     = useState(false);
  const [aceptando, setAceptando]   = useState(null);

  const cargarPendientes = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get("/recepcion/pendientes");
      setPendientes(r.data.data || { recetas: [], estudios: [] });
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, []);

  const cargarHistorial = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get("/recepcion/historial");
      setHistorial(r.data.data || { recetas: [], estudios: [] });
    } catch { /* noop */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => {
    if (tab === "pendientes") cargarPendientes();
    else cargarHistorial();
  }, [tab, cargarPendientes, cargarHistorial]);

  // Refresco en tiempo real: NavbarApp dispara este evento al recibir por SSE
  // una notificación de receta/estudio enviado a recepción.
  useEffect(() => {
    const onNuevoEnvio = () => {
      api.get("/recepcion/pendientes")
        .then(r => setPendientes(r.data.data || { recetas: [], estudios: [] }))
        .catch(() => {});
    };
    window.addEventListener("recepcion:nuevo-envio", onNuevoEnvio);
    return () => window.removeEventListener("recepcion:nuevo-envio", onNuevoEnvio);
  }, []);

  const aceptarReceta = async (id) => {
    setAceptando(`r${id}`);
    try {
      await api.put(`/recepcion/recetas/${id}/aceptar`);
      setPendientes(prev => ({ ...prev, recetas: prev.recetas.filter(x => x.id !== id) }));
    } catch { /* noop */ }
    finally { setAceptando(null); }
  };

  const aceptarEstudio = async (id) => {
    setAceptando(`e${id}`);
    try {
      await api.put(`/recepcion/estudios/${id}/aceptar`);
      setPendientes(prev => ({ ...prev, estudios: prev.estudios.filter(x => x.id !== id) }));
    } catch { /* noop */ }
    finally { setAceptando(null); }
  };

  const totalPendientes = pendientes.recetas.length + pendientes.estudios.length;

  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="bi bi-inbox-fill" style={{ color: "#fff", fontSize: 20 }} />
        </div>
        <div>
          <h5 style={{ margin: 0, fontWeight: 700 }}>Recepción</h5>
          <span style={{ fontSize: 13, color: "#64748b" }}>Recetas y estudios enviados desde consulta</span>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3">
        {TABS.map(t => (
          <li className="nav-item" key={t.id}>
            <button
              className={`nav-link ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              style={{ fontSize: "0.85rem", fontWeight: 600 }}
            >
              <i className={`bi ${t.icon} me-1`} />
              {t.label}
              {t.id === "pendientes" && totalPendientes > 0 && (
                <span className="badge bg-danger ms-2">{totalPendientes}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {cargando && (
        <div className="text-center py-4">
          <span className="spinner-border spinner-border-sm" /> Cargando...
        </div>
      )}

      {!cargando && tab === "pendientes" && (
        <>
          <h6 className="text-muted small text-uppercase mt-2 mb-2">
            <i className="bi bi-capsule-pill me-1" /> Recetas ({pendientes.recetas.length})
          </h6>
          {pendientes.recetas.length === 0 && (
            <p className="text-muted small mb-3">Sin recetas pendientes.</p>
          )}
          {pendientes.recetas.map(p => (
            <Tarjeta
              key={`r${p.id}`}
              tipoIcono="bi-capsule-pill"
              tipoColor="linear-gradient(135deg,#3b82f6,#2563eb)"
              titulo={`${p.total_items} medicamento(s)`}
              subtitulo="Receta"
              paciente={`${p.pac_nombres} ${p.pac_apellidos}`}
              medico={`${p.med_nombres} ${p.med_apellidos}`}
              fecha={p.enviado_recepcion_en}
              accion={
                <div className="d-flex gap-1">
                  <BotonPdf url={`/prescripciones/${p.id}/pdf`} />
                  <button
                    className="btn btn-success btn-sm"
                    disabled={aceptando === `r${p.id}`}
                    style={{ fontSize: "0.75rem", borderRadius: 7 }}
                    onClick={() => aceptarReceta(p.id)}
                  >
                    <i className="bi bi-check-lg me-1" />
                    {aceptando === `r${p.id}` ? "Aceptando..." : "Aceptar"}
                  </button>
                </div>
              }
            />
          ))}

          <h6 className="text-muted small text-uppercase mt-4 mb-2">
            <i className="bi bi-eyedropper me-1" /> Estudios ({pendientes.estudios.length})
          </h6>
          {pendientes.estudios.length === 0 && (
            <p className="text-muted small mb-3">Sin estudios pendientes.</p>
          )}
          {pendientes.estudios.map(s => (
            <Tarjeta
              key={`e${s.id}`}
              tipoIcono="bi-eyedropper"
              tipoColor="linear-gradient(135deg,#0891b2,#0e7490)"
              titulo={s.tipo}
              subtitulo="Estudio"
              paciente={`${s.pac_nombres} ${s.pac_apellidos}`}
              medico={`${s.med_nombres} ${s.med_apellidos}`}
              fecha={s.enviado_recepcion_en}
              urgente={s.urgente}
              accion={
                <div className="d-flex gap-1">
                  <BotonPdf url={`/estudios/pdf?estudio_id=${s.id}`} />
                  <button
                    className="btn btn-success btn-sm"
                    disabled={aceptando === `e${s.id}`}
                    style={{ fontSize: "0.75rem", borderRadius: 7 }}
                    onClick={() => aceptarEstudio(s.id)}
                  >
                    <i className="bi bi-check-lg me-1" />
                    {aceptando === `e${s.id}` ? "Aceptando..." : "Aceptar"}
                  </button>
                </div>
              }
            />
          ))}
        </>
      )}

      {!cargando && tab === "historial" && (
        <>
          <h6 className="text-muted small text-uppercase mt-2 mb-2">
            <i className="bi bi-capsule-pill me-1" /> Recetas ({historial.recetas.length})
          </h6>
          {historial.recetas.length === 0 && (
            <p className="text-muted small mb-3">Sin historial de recetas.</p>
          )}
          {historial.recetas.map(p => (
            <Tarjeta
              key={`r${p.id}`}
              tipoIcono="bi-capsule-pill"
              tipoColor="linear-gradient(135deg,#3b82f6,#2563eb)"
              titulo={`${p.total_items} medicamento(s)`}
              subtitulo="Receta recibida"
              paciente={`${p.pac_nombres} ${p.pac_apellidos}`}
              medico={`${p.med_nombres} ${p.med_apellidos}`}
              fecha={p.recibido_recepcion_en}
              accion={
                <div className="d-flex align-items-center gap-2">
                  <BotonPdf url={`/prescripciones/${p.id}/pdf`} />
                  <span className="badge bg-success" style={{ fontSize: "0.7rem" }}><i className="bi bi-check2-circle me-1" />Recibida</span>
                </div>
              }
            />
          ))}

          <h6 className="text-muted small text-uppercase mt-4 mb-2">
            <i className="bi bi-eyedropper me-1" /> Estudios ({historial.estudios.length})
          </h6>
          {historial.estudios.length === 0 && (
            <p className="text-muted small mb-3">Sin historial de estudios.</p>
          )}
          {historial.estudios.map(s => (
            <Tarjeta
              key={`e${s.id}`}
              tipoIcono="bi-eyedropper"
              tipoColor="linear-gradient(135deg,#0891b2,#0e7490)"
              titulo={s.tipo}
              subtitulo="Estudio recibido"
              paciente={`${s.pac_nombres} ${s.pac_apellidos}`}
              medico={`${s.med_nombres} ${s.med_apellidos}`}
              fecha={s.recibido_recepcion_en}
              urgente={s.urgente}
              accion={
                <div className="d-flex align-items-center gap-2">
                  <BotonPdf url={`/estudios/pdf?estudio_id=${s.id}`} />
                  <span className="badge bg-success" style={{ fontSize: "0.7rem" }}><i className="bi bi-check2-circle me-1" />Recibido</span>
                </div>
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
