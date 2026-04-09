import { useState, useEffect, useRef } from "react";
import api from "../api/api";
import CurvaCrecimiento from "../components/CurvaCrecimiento";

export default function CrecimientoPage() {
  const [busq,      setBusq]      = useState("");
  const [lista,     setLista]     = useState([]);
  const [paciente,  setPaciente]  = useState(null);
  const [buscando,  setBuscando]  = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (busq.length < 2) { setLista([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setBuscando(true);
      api.get("/pacientes", { params: { q: busq } })
        .then(r => setLista(r.data.data || []))
        .catch(() => setLista([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [busq]);

  const seleccionar = (p) => {
    setPaciente(p);
    setBusq(`${p.apellidos}, ${p.nombres}`);
    setLista([]);
  };

  const limpiar = () => {
    setPaciente(null);
    setBusq("");
    setLista([]);
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="mb-0 fw-bold">
          <i className="bi bi-graph-up-arrow me-2 text-primary" />
          Curvas de Crecimiento OMS
        </h4>
      </div>

      {/* Buscador de paciente */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <label className="form-label fw-semibold mb-2">Buscar paciente</label>
          <div className="position-relative" style={{ maxWidth: 420 }}>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted" />
              </span>
              <input
                className="form-control border-start-0"
                placeholder="Nombre, apellido o DNI…"
                value={busq}
                onChange={e => { setBusq(e.target.value); if (paciente) setPaciente(null); }}
                autoFocus
              />
              {(busq || paciente) && (
                <button className="btn btn-outline-secondary" type="button" onClick={limpiar}>
                  <i className="bi bi-x" />
                </button>
              )}
            </div>

            {/* Dropdown resultados */}
            {lista.length > 0 && (
              <ul
                className="list-group position-absolute z-3 shadow"
                style={{ top: "100%", left: 0, right: 0, maxHeight: 220, overflowY: "auto" }}
              >
                {lista.map(p => (
                  <li
                    key={p.id}
                    className="list-group-item list-group-item-action py-2 px-3"
                    style={{ cursor: "pointer", fontSize: "0.85rem" }}
                    onClick={() => seleccionar(p)}
                  >
                    <strong>{p.apellidos}, {p.nombres}</strong>
                    <span className="text-muted ms-2">
                      {p.dni && <>DNI {p.dni} · </>}
                      {p.fecha_nacimiento && <>Nac. {p.fecha_nacimiento.slice(0, 10)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {buscando && (
              <div className="position-absolute" style={{ top: "50%", right: 48, transform: "translateY(-50%)" }}>
                <div className="spinner-border spinner-border-sm text-secondary" />
              </div>
            )}
          </div>

          {paciente && (
            <div className="mt-2 text-success small">
              <i className="bi bi-person-check me-1" />
              <strong>{paciente.nombres} {paciente.apellidos}</strong>
              {paciente.fecha_nacimiento && (
                <span className="text-muted ms-2">
                  Nac. {paciente.fecha_nacimiento.slice(0, 10)}
                </span>
              )}
              {paciente.sexo && (
                <span className="text-muted ms-2">
                  · {paciente.sexo === "M" ? "Masculino" : "Femenino"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Curvas de Crecimiento */}
      {paciente ? (
        <CurvaCrecimiento
          key={paciente.id}
          pacienteId={paciente.id}
          sexo={paciente.sexo}
          fechaNacimiento={paciente.fecha_nacimiento}
        />
      ) : (
        <div className="text-center text-muted py-5">
          <i className="bi bi-graph-up-arrow fs-1 d-block mb-2 opacity-25" />
          <p className="mb-0">Busca y selecciona un paciente para ver sus curvas de crecimiento.</p>
        </div>
      )}
    </div>
  );
}
