/**
 * ESTUDIOS E IMÁGENES
 * Gestión de solicitudes de estudios clínicos, resultados y visualización de imágenes médicas
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../api/api";

const TIPOS_ESTUDIO = [
  { value: "LABORATORIO", label: "Laboratorio" },
  { value: "RADIOLOGIA", label: "Radiología" },
  { value: "ECOGRAFIA", label: "Ecografía" },
  { value: "TAC", label: "Tomografía (TAC)" },
  { value: "RESONANCIA", label: "Resonancia Magnética (RM)" },
  { value: "ENDOSCOPIA", label: "Endoscopía" },
  { value: "CARDIOLOGIA", label: "Cardiología" },
  { value: "OTROS", label: "Otros" },
];

const ESTADOS = [
  { value: "SOLICITADO", label: "Solicitado", color: "warning" },
  { value: "EN_PROCESO", label: "En Proceso", color: "info" },
  { value: "COMPLETADO", label: "Completado", color: "success" },
  { value: "CANCELADO", label: "Cancelado", color: "secondary" },
];

export default function Estudios() {
  const navigate = useNavigate();
  
  const [estudios, setEstudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEstudio, setSelectedEstudio] = useState(null);

  // Cargar estudios
  useEffect(() => {
    loadEstudios();
  }, [filtroTipo, filtroEstado]);

  const loadEstudios = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroEstado) params.estado = filtroEstado;
      
      const res = await api.get("/estudios", { params });
      setEstudios(res.data.data || []);
    } catch (error) {
      console.error("Error al cargar estudios:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar estudios por búsqueda
  const estudiosFiltrados = estudios.filter(e => {
    if (!busqueda) return true;
    const texto = busqueda.toLowerCase();
    return (
      e.paciente_nombres?.toLowerCase().includes(texto) ||
      e.paciente_apellidos?.toLowerCase().includes(texto) ||
      e.descripcion?.toLowerCase().includes(texto) ||
      e.tipo?.toLowerCase().includes(texto)
    );
  });

  const getEstadoBadge = (estado) => {
    const est = ESTADOS.find(e => e.value === estado);
    return est ? est.color : "secondary";
  };

  const handleVerDetalle = (estudio) => {
    setSelectedEstudio(estudio);
    setShowModal(true);
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await api.put(`/estudios/${id}`, { estado: nuevoEstado });
      loadEstudios();
      if (selectedEstudio?.id === id) {
        setSelectedEstudio({ ...selectedEstudio, estado: nuevoEstado });
      }
    } catch (error) {
      alert("Error al actualizar estado");
    }
  };

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-1">🧪 Estudios e Imágenes</h4>
          <p className="text-muted small mb-0">
            Gestión de solicitudes de estudios clínicos y resultados
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Buscar por paciente o descripción..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                {TIPOS_ESTUDIO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {ESTADOS.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setFiltroTipo("");
                  setFiltroEstado("");
                  setBusqueda("");
                }}
              >
                <i className="bi bi-x-circle me-1"></i>
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de estudios */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : estudiosFiltrados.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-inbox display-1 d-block mb-3 opacity-25"></i>
            <p className="mb-0">No se encontraron estudios con los filtros aplicados</p>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="px-3">Fecha Solicitud</th>
                    <th>Paciente</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th>Médico Solicitante</th>
                    <th className="text-end px-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {estudiosFiltrados.map((estudio) => (
                    <tr key={estudio.id} style={{ cursor: "pointer" }}>
                      <td className="px-3">
                        <small className="text-muted">
                          {dayjs(estudio.fecha_solicitud || estudio.creado_en).format("DD/MM/YYYY")}
                        </small>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
                            style={{ width: 32, height: 32, fontSize: "0.75rem" }}
                          >
                            {estudio.paciente_nombres?.[0]}{estudio.paciente_apellidos?.[0]}
                          </div>
                          <div>
                            <div className="small fw-semibold">
                              {estudio.paciente_apellidos}, {estudio.paciente_nombres}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-info bg-opacity-10 text-info">
                          {estudio.tipo}
                        </span>
                      </td>
                      <td>
                        <div className="small" style={{ maxWidth: 250 }}>
                          {estudio.descripcion?.substring(0, 60)}
                          {estudio.descripcion?.length > 60 ? "..." : ""}
                        </div>
                      </td>
                      <td>
                        <span className={`badge bg-${getEstadoBadge(estudio.estado)}`}>
                          {estudio.estado}
                        </span>
                      </td>
                      <td>
                        <small className="text-muted">
                          Dr. {estudio.medico_apellidos}
                        </small>
                      </td>
                      <td className="text-end px-3">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleVerDetalle(estudio)}
                        >
                          <i className="bi bi-eye me-1"></i>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      {showModal && selectedEstudio && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Detalle del Estudio #{selectedEstudio.id}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEstudio(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small text-muted mb-1">Paciente</label>
                    <div className="fw-semibold">
                      {selectedEstudio.paciente_apellidos}, {selectedEstudio.paciente_nombres}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small text-muted mb-1">Médico Solicitante</label>
                    <div>Dr. {selectedEstudio.medico_apellidos}, {selectedEstudio.medico_nombres}</div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted mb-1">Tipo de Estudio</label>
                    <div>
                      <span className="badge bg-info bg-opacity-10 text-info">
                        {selectedEstudio.tipo}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted mb-1">Estado</label>
                    <div>
                      <select
                        className={`form-select form-select-sm bg-${getEstadoBadge(selectedEstudio.estado)} bg-opacity-10`}
                        value={selectedEstudio.estado}
                        onChange={(e) => handleCambiarEstado(selectedEstudio.id, e.target.value)}
                      >
                        {ESTADOS.map(e => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted mb-1">Fecha Solicitud</label>
                    <div>{dayjs(selectedEstudio.fecha_solicitud || selectedEstudio.creado_en).format("DD/MM/YYYY HH:mm")}</div>
                  </div>
                  <div className="col-12">
                    <label className="form-label small text-muted mb-1">Descripción / Indicaciones</label>
                    <div className="p-3 bg-light rounded" style={{ whiteSpace: "pre-wrap" }}>
                      {selectedEstudio.descripcion || "Sin descripción"}
                    </div>
                  </div>
                  {selectedEstudio.resultado && (
                    <div className="col-12">
                      <label className="form-label small text-muted mb-1">Resultado</label>
                      <div className="p-3 bg-success bg-opacity-10 rounded" style={{ whiteSpace: "pre-wrap" }}>
                        {selectedEstudio.resultado}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedEstudio(null);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
