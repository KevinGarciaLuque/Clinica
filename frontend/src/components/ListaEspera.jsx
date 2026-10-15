// Pestaña "Lista de espera" de la página de Citas.
// Cuando una cita se cancela, el sistema ofrece el espacio por correo a los
// primeros pacientes de esta lista; el primero que acepta queda agendado.
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import api from "../api/api";
import { nombreMedico } from "../utils/medico";

const C = { azul: "#2563eb", verde: "#10b981", gris: "#64748b", borde: "#e5e7eb" };

const ESTADO = {
  ACTIVA:    { label: "En espera", color: "#f59e0b" },
  AGENDADA:  { label: "Agendada",  color: "#10b981" },
  CANCELADA: { label: "Retirada",  color: "#94a3b8" },
};

const fechaCorta = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "");

function FormNuevo({ medicos, onGuardado, onCancelar }) {
  const [busq, setBusq] = useState("");
  const [lista, setLista] = useState([]);
  const [pac, setPac] = useState(null);
  const [form, setForm] = useState({ medico_id: "", desde: dayjs().format("YYYY-MM-DD"), hasta: "", nota: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (pac || busq.trim().length < 2) { setLista([]); return; }
    const t = setTimeout(() => {
      api.get("/pacientes", { params: { q: busq } })
        .then((r) => setLista((r.data.data || []).slice(0, 8)))
        .catch(() => setLista([]));
    }, 300);
    return () => clearTimeout(t);
  }, [busq, pac]);

  const guardar = async (e) => {
    e.preventDefault();
    if (!pac) return setError("Elige un paciente.");
    setGuardando(true); setError("");
    try {
      await api.post("/lista-espera", { paciente_id: pac.id, ...form, medico_id: form.medico_id || null, hasta: form.hasta || null });
      onGuardado();
    } catch (err) {
      setError(err?.response?.data?.msg || "No se pudo agregar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} style={{ border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 16, background: "#f8fafc" }}>
      <div className="row g-2">
        <div className="col-12 col-md-6 position-relative">
          <label className="form-label small fw-semibold mb-1">Paciente</label>
          {pac ? (
            <div className="form-control form-control-sm d-flex justify-content-between align-items-center">
              <span>{pac.nombres} {pac.apellidos}</span>
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { setPac(null); setBusq(""); }}>Cambiar</button>
            </div>
          ) : (
            <input className="form-control form-control-sm" placeholder="Buscar por nombre o DNI…" value={busq} onChange={(e) => setBusq(e.target.value)} autoFocus />
          )}
          {!pac && lista.length > 0 && (
            <div className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 20, maxHeight: 220, overflowY: "auto" }}>
              {lista.map((p) => (
                <button type="button" key={p.id} className="list-group-item list-group-item-action py-1 small" onClick={() => setPac(p)}>
                  {p.nombres} {p.apellidos} {p.dni ? <span className="text-muted">· {p.dni}</span> : null}
                  {!p.email && <span className="text-danger ms-1">(sin correo)</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small fw-semibold mb-1">Médico</label>
          <select className="form-select form-select-sm" value={form.medico_id} onChange={(e) => setForm({ ...form, medico_id: e.target.value })}>
            <option value="">Cualquier médico</option>
            {medicos.map((m) => <option key={m.id} value={m.id}>{nombreMedico(m)}</option>)}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold mb-1">Disponible desde</label>
          <input type="date" className="form-control form-control-sm" required value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold mb-1">Hasta <span className="text-muted fw-normal">(opcional)</span></label>
          <input type="date" className="form-control form-control-sm" min={form.desde} value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small fw-semibold mb-1">Motivo o nota <span className="text-muted fw-normal">(opcional)</span></label>
          <input className="form-control form-control-sm" maxLength={300} placeholder="Ej. control, prefiere mañanas" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
        </div>
      </div>
      {pac && !pac.email && (
        <div className="small text-danger mt-2"><i className="bi bi-exclamation-triangle me-1" />Este paciente no tiene correo: no podrá recibir el aviso automático. Agrega su correo en su ficha.</div>
      )}
      {error && <div className="small text-danger mt-2">{error}</div>}
      <div className="d-flex gap-2 justify-content-end mt-3">
        <button type="button" className="btn btn-light btn-sm" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-sm fw-semibold" disabled={guardando} style={{ background: C.azul, color: "#fff" }}>
          {guardando ? <span className="spinner-border spinner-border-sm" /> : "Agregar a la lista"}
        </button>
      </div>
    </form>
  );
}

export default function ListaEspera({ medicos = [] }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [verCerradas, setVerCerradas] = useState(false);

  const cargar = useCallback(() => {
    api.get("/lista-espera")
      .then((r) => { setData(r.data.data); setError(""); })
      .catch((e) => setError(e?.response?.data?.msg || "No se pudo cargar la lista de espera."));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (id, estado) => {
    try { await api.patch(`/lista-espera/${id}`, { estado }); cargar(); }
    catch (e) { setError(e?.response?.data?.msg || "No se pudo actualizar."); }
  };

  const Fila = ({ r }) => {
    const est = ESTADO[r.estado];
    return (
      <tr>
        <td data-label="Paciente">
          <div className="fw-semibold">{r.paciente_nombres} {r.paciente_apellidos}</div>
          <div className="text-muted small">
            {r.paciente_telefono || ""}
            {!r.tiene_email && <span className="text-danger ms-1"><i className="bi bi-envelope-slash" /> sin correo</span>}
          </div>
        </td>
        <td className="small" data-label="Médico">{r.medico || <span className="text-muted">Cualquiera</span>}</td>
        <td className="small" data-label="Fechas">{fechaCorta(r.desde)}{r.hasta ? ` – ${fechaCorta(r.hasta)}` : " en adelante"}</td>
        <td className="small text-muted le-nota" data-label="Nota" style={{ maxWidth: 200 }}>{r.nota}</td>
        <td className="small" data-label="Estado">
          <span style={{ color: est.color, fontWeight: 700 }}>{est.label}</span>
          {r.estado === "AGENDADA" && r.cita_inicio && <div className="text-muted">{dayjs(r.cita_inicio).format("DD/MM h:mm A")}</div>}
          {r.estado === "ACTIVA" && r.ofertas > 0 && <div className="text-muted">{r.ofertas} aviso(s) enviado(s)</div>}
        </td>
        <td className="text-end le-acciones">
          {r.estado === "ACTIVA" && (
            <button className="btn btn-link btn-sm text-danger p-0" onClick={() => cambiarEstado(r.id, "CANCELADA")}>Quitar</button>
          )}
          {r.estado === "CANCELADA" && (
            <button className="btn btn-link btn-sm p-0" onClick={() => cambiarEstado(r.id, "ACTIVA")}>Reactivar</button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <style>{`
        /* En teléfonos cada paciente se muestra como tarjeta en vez de fila */
        @media (max-width: 767.98px) {
          .le-tabla thead { display: none; }
          .le-tabla, .le-tabla tbody, .le-tabla tr, .le-tabla td { display: block; width: 100%; }
          .le-tabla tr { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; position: relative; }
          .le-tabla td { border: none !important; padding: 2px 0 !important; text-align: left !important; }
          .le-tabla td[data-label]:not([data-label="Paciente"])::before {
            content: attr(data-label) ": "; color: #94a3b8; font-weight: 600; }
          .le-tabla td.le-nota:empty { display: none; }
          .le-tabla td.le-acciones { position: absolute; top: 10px; right: 12px; width: auto; }
        }
      `}</style>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <p className="text-muted mb-0" style={{ fontSize: "0.85rem", maxWidth: 560 }}>
          <i className="bi bi-lightning-charge-fill me-1" style={{ color: "#f59e0b" }} />
          Cuando una cita se cancela, el sistema avisa por correo a los 3 primeros de esta lista para ese médico y esa fecha.
          El primero que acepta queda agendado y confirmado automáticamente.
        </p>
        {!nuevo && (
          <button className="btn btn-sm fw-semibold" style={{ background: C.azul, color: "#fff", borderRadius: 8 }} onClick={() => setNuevo(true)}>
            <i className="bi bi-person-plus me-1" />Agregar paciente
          </button>
        )}
      </div>

      {nuevo && <FormNuevo medicos={medicos} onCancelar={() => setNuevo(false)} onGuardado={() => { setNuevo(false); cargar(); }} />}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!data && !error && <div className="text-muted small py-3"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>}

      {data && (
        <>
          {data.activas.length === 0 ? (
            <div className="text-center text-muted py-4" style={{ fontSize: "0.88rem" }}>
              <i className="bi bi-hourglass d-block mb-2" style={{ fontSize: 28 }} />
              No hay pacientes en lista de espera.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle le-tabla" style={{ fontSize: "0.87rem" }}>
                <thead><tr className="text-muted small"><th>Paciente</th><th>Médico</th><th>Fechas</th><th>Nota</th><th>Estado</th><th /></tr></thead>
                <tbody>{data.activas.map((r) => <Fila key={r.id} r={r} />)}</tbody>
              </table>
            </div>
          )}
          {data.cerradas.length > 0 && (
            <>
              <button className="btn btn-link btn-sm px-0 text-muted" style={{ textDecoration: "none" }} onClick={() => setVerCerradas((v) => !v)}>
                <i className={`bi bi-chevron-${verCerradas ? "up" : "down"} me-1`} />Historial ({data.cerradas.length})
              </button>
              {verCerradas && (
                <div className="table-responsive">
                  <table className="table table-sm align-middle le-tabla" style={{ fontSize: "0.87rem" }}>
                    <tbody>{data.cerradas.map((r) => <Fila key={r.id} r={r} />)}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
