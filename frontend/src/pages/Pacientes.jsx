import { useEffect, useState } from "react";
import api from "../api/api";

export default function Pacientes() {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    dni: "",
    telefono: "",
    email: "",
  });

  const cargar = async () => {
    setMsg("");
    const res = await api.get("/api/pacientes", { params: { q } });
    setLista(res.data.data || []);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line
  }, []);

  const crear = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await api.post("/api/pacientes", form);
      setForm({ nombres: "", apellidos: "", dni: "", telefono: "", email: "" });
      await cargar();
      setMsg("Paciente creado ✅");
    } catch (err) {
      setMsg(err?.response?.data?.msg || "Error creando paciente");
    }
  };

  return (
    <div className="container py-4">
      <h4 className="mb-3">Pacientes</h4>

      {msg && <div className="alert alert-secondary">{msg}</div>}

      <div className="row g-3">
        <div className="col-lg-4">
          <form className="card p-3 shadow-sm" onSubmit={crear}>
            <div className="fw-bold mb-2">Nuevo paciente</div>

            <input className="form-control mb-2" placeholder="Nombres"
              value={form.nombres}
              onChange={(e)=>setForm({ ...form, nombres: e.target.value })}
              required
            />
            <input className="form-control mb-2" placeholder="Apellidos"
              value={form.apellidos}
              onChange={(e)=>setForm({ ...form, apellidos: e.target.value })}
              required
            />
            <input className="form-control mb-2" placeholder="DNI"
              value={form.dni}
              onChange={(e)=>setForm({ ...form, dni: e.target.value })}
            />
            <input className="form-control mb-2" placeholder="Teléfono"
              value={form.telefono}
              onChange={(e)=>setForm({ ...form, telefono: e.target.value })}
            />
            <input className="form-control mb-3" placeholder="Email"
              value={form.email}
              onChange={(e)=>setForm({ ...form, email: e.target.value })}
            />

            <button className="btn btn-dark">Guardar</button>
          </form>
        </div>

        <div className="col-lg-8">
          <div className="card p-3 shadow-sm">
            <div className="d-flex gap-2 mb-3">
              <input
                className="form-control"
                placeholder="Buscar por nombre, DNI o teléfono..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="btn btn-outline-dark" onClick={cargar}>
                Buscar
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>DNI</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombres} {p.apellidos}</td>
                      <td>{p.dni || "-"}</td>
                      <td>{p.telefono || "-"}</td>
                      <td>{p.email || "-"}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        Sin resultados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
