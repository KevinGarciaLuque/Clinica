import { useEffect, useState } from "react";
import api from "../../api/api";

// Tarjeta de respaldos automáticos diarios (Cloudinary privado).
// Lista los últimos respaldos, permite descargarlos con un enlace temporal
// y ejecutar uno en el momento.

const C = { accent: "#2196f3", success: "#10b981", danger: "#ef4444", dark: "#0d1b2e" };

function fmtBytes(b) {
  if (b == null) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default function RespaldosAutomaticos() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [msg, setMsg] = useState(null);

  const cargar = () => {
    api.get("/database/respaldos")
      .then(r => { setLista(r.data?.data || []); setError(null); })
      .catch(e => setError(e.response?.data?.msg || "No se pudo cargar la lista de respaldos."));
  };
  useEffect(cargar, []);

  const ejecutar = async () => {
    setEjecutando(true); setMsg(null);
    try {
      const r = await api.post("/database/respaldos/ejecutar");
      setMsg({ ok: true, text: `Respaldo creado (${fmtBytes(r.data.bytes)}, ${r.data.tablas} tablas).` });
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "No se pudo crear el respaldo." });
    } finally {
      setEjecutando(false);
      cargar();
    }
  };

  const descargar = async (id) => {
    try {
      const r = await api.get(`/database/respaldos/${id}/descargar`);
      window.open(r.data.url, "_blank", "noopener");
    } catch (e) {
      setMsg({ ok: false, text: e.response?.data?.msg || "No se pudo generar el enlace de descarga." });
    }
  };

  const ultimoOk = lista?.find(r => r.estado === "OK");

  return (
    <div className="db-stat-card mb-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-1">
        <div className="d-flex align-items-center gap-2">
          <div style={{ width: 38, height: 38, borderRadius: 9, background: `${C.success}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="bi bi-shield-check" style={{ color: C.success, fontSize: "1.1rem" }} />
          </div>
          <div>
            <h6 className="mb-0 fw-bold" style={{ color: C.dark }}>Respaldos automáticos</h6>
            <p className="mb-0 text-muted" style={{ fontSize: "0.73rem" }}>
              Todos los días a las 2:30 a. m. · Archivo privado en la nube · Se guardan los últimos 14
            </p>
          </div>
        </div>
        <button onClick={ejecutar} disabled={ejecutando} className="btn btn-sm"
          style={{ background: C.success, color: "#fff", fontWeight: 600, borderRadius: 8 }}>
          {ejecutando
            ? <><span className="spinner-border spinner-border-sm me-1" />Respaldando…</>
            : <><i className="bi bi-play-fill me-1" />Respaldar ahora</>}
        </button>
      </div>

      <hr style={{ borderColor: "#f1f5f9", margin: "14px 0" }} />

      {msg && (
        <div className="alert py-2" style={{ fontSize: "0.82rem", borderRadius: 8, background: msg.ok ? "#ecfdf5" : "#fef2f2", color: msg.ok ? C.success : C.danger, border: "none" }}>
          {msg.text}
        </div>
      )}
      {error && <div className="text-danger" style={{ fontSize: "0.82rem" }}>{error}</div>}
      {lista === null && !error && <div className="text-muted" style={{ fontSize: "0.82rem" }}>Cargando…</div>}
      {lista && lista.length === 0 && (
        <div className="text-muted" style={{ fontSize: "0.82rem" }}>
          Aún no hay respaldos automáticos. El primero se hará esta madrugada, o puedes crear uno ahora.
        </div>
      )}
      {ultimoOk && (
        <div style={{ fontSize: "0.82rem", color: "#475569", marginBottom: 10 }}>
          <i className="bi bi-check-circle-fill me-1" style={{ color: C.success }} />
          Último respaldo correcto: <strong>{new Date(ultimoOk.creado_en).toLocaleString("es-HN")}</strong>
        </div>
      )}
      {lista && lista.length > 0 && (
        <div className="table-responsive" style={{ maxHeight: 260, overflowY: "auto" }}>
          <table className="table table-sm mb-0" style={{ fontSize: "0.8rem" }}>
            <thead>
              <tr>
                <th style={{ color: "#64748b" }}>Fecha</th>
                <th style={{ color: "#64748b" }}>Estado</th>
                <th style={{ color: "#64748b" }} className="text-end">Tamaño</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map(r => (
                <tr key={r.id}>
                  <td>{new Date(r.creado_en).toLocaleString("es-HN")}</td>
                  <td>
                    {r.estado === "OK"
                      ? <span style={{ color: C.success, fontWeight: 600 }}><i className="bi bi-check-circle-fill me-1" />Correcto</span>
                      : <span style={{ color: C.danger, fontWeight: 600 }} title={r.error_msg || ""}><i className="bi bi-x-circle-fill me-1" />Error</span>}
                  </td>
                  <td className="text-end">{fmtBytes(r.tamanio_bytes)}</td>
                  <td className="text-end">
                    {r.estado === "OK" && (
                      <button className="btn btn-link btn-sm p-0" onClick={() => descargar(r.id)}>
                        <i className="bi bi-download me-1" />Descargar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
