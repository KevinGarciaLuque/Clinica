import { useState } from "react";
import api from "../api/api";

export default function Citas() {
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    paciente_id: "",
    medico_id: "",
    inicio: "",
    fin: "",
    tipo_consulta: "CONTROL",
    motivo: "",
  });

  const agendar = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const payload = { ...form, canal: "RECEPCION" };
      const res = await api.post("/api/citas", payload);
      setMsg("Cita creada ✅ ID: " + res.data.id);
    } catch (err) {
      setMsg(err?.response?.data?.msg || "Error creando cita");
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 800 }}>
      <h4 className="mb-3">Citas</h4>

      {msg && <div className="alert alert-secondary">{msg}</div>}

      <form className="card p-3 shadow-sm" onSubmit={agendar}>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label">Paciente ID</label>
            <input className="form-control"
              value={form.paciente_id}
              onChange={(e)=>setForm({ ...form, paciente_id: e.target.value })}
              required
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Médico ID</label>
            <input className="form-control"
              value={form.medico_id}
              onChange={(e)=>setForm({ ...form, medico_id: e.target.value })}
              required
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Inicio</label>
            <input className="form-control"
              type="datetime-local"
              value={form.inicio}
              onChange={(e)=>setForm({ ...form, inicio: e.target.value })}
              required
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Fin</label>
            <input className="form-control"
              type="datetime-local"
              value={form.fin}
              onChange={(e)=>setForm({ ...form, fin: e.target.value })}
              required
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Tipo</label>
            <select className="form-select"
              value={form.tipo_consulta}
              onChange={(e)=>setForm({ ...form, tipo_consulta: e.target.value })}
            >
              <option value="PRIMERA_VEZ">Primera vez</option>
              <option value="CONTROL">Control</option>
              <option value="EMERGENCIA">Emergencia</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label">Motivo</label>
            <input className="form-control"
              value={form.motivo}
              onChange={(e)=>setForm({ ...form, motivo: e.target.value })}
              placeholder="Ej: Dolor de cabeza"
            />
          </div>
        </div>

        <div className="mt-3">
          <button className="btn btn-dark">Agendar</button>
        </div>
      </form>
    </div>
  );
}
