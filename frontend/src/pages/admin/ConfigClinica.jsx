import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";

function pct(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function ConfigClinica() {
  const { user } = useAuth();
  const clinicaId = user?.clinica_id || import.meta.env.VITE_CLINICA_ID;

  const [clinica, setClinica] = useState(null);
  const [form, setForm] = useState({});
  const [tab, setTab] = useState("general");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });

  const [storage, setStorage] = useState(null);
  const [showEspacioModal, setShowEspacioModal] = useState(false);
  const [gbSolicitados, setGbSolicitados] = useState(10);
  const [solicitandoEspacio, setSolicitandoEspacio] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      if (!clinicaId) {
        setMsg({ tipo: "danger", texto: "No hay clinica seleccionada" });
        setCargando(false);
        return;
      }

      try {
        const [resClinica, resDetalles] = await Promise.all([
          api.get(`/clinicas/${clinicaId}`),
          api.get(`/clinicas/${clinicaId}/detalles`),
        ]);

        const data = resClinica.data?.data || {};
        setClinica(data);
        setForm({
          nombre: data.nombre || "",
          email: data.email || "",
          telefono: data.telefono || "",
          direccion: data.direccion || "",
          ciudad: data.ciudad || "",
          pais: data.pais || "HN",
          ruc: data.ruc || "",
          logo_url: data.logo_url || "",
        });

        setStorage(resDetalles.data?.data?.almacenamiento || null);
      } catch (e) {
        setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, [clinicaId]);

  const cargarStorage = async () => {
    if (!clinicaId) return;
    try {
      const r = await api.get(`/clinicas/${clinicaId}/detalles`);
      setStorage(r.data?.data?.almacenamiento || null);
    } catch {
      // no-op
    }
  };

  const guardarGeneral = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      await api.put(`/clinicas/${clinicaId}`, form);
      setMsg({ tipo: "success", texto: "Datos guardados correctamente" });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGuardando(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await api.post(`/clinicas/${clinicaId}/upload-logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const logoUrl = `${baseURL}${res.data.logo_url}`;

      setForm((prev) => ({ ...prev, logo_url: logoUrl }));
      setMsg({ tipo: "success", texto: "Logo subido correctamente" });
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally {
      setGuardando(false);
    }
  };

  const solicitarMasEspacio = async () => {
    const gb = Number(gbSolicitados || 0);
    if (!Number.isFinite(gb) || gb <= 0) {
      setMsg({ tipo: "danger", texto: "Ingresa una cantidad valida de GB" });
      return;
    }

    setSolicitandoEspacio(true);
    setMsg({ tipo: "", texto: "" });

    const precioGb = Number(storage?.precio_por_gb_lps || 0);
    const total = gb * precioGb;

    try {
      await api.post("/soporte/reportar", {
        asunto: "Solicitud de espacio adicional",
        descripcion:
          `Clinica: ${clinica?.nombre || "N/A"}\n` +
          `Clinica ID: ${clinicaId}\n` +
          `GB solicitados: ${gb}\n` +
          `Precio por GB (LPS): ${precioGb.toFixed(2)}\n` +
          `Total estimado (LPS): ${total.toFixed(2)}\n` +
          `Uso actual: ${storage?.espacio_legible || "N/A"} de ${storage?.cuota_legible || "N/A"} (${Number(storage?.uso_pct || 0).toFixed(1)}%)`,
      });

      setShowEspacioModal(false);
      setMsg({ tipo: "success", texto: "Solicitud enviada correctamente" });
      await cargarStorage();
    } catch (e) {
      setMsg({ tipo: "danger", texto: e.response?.data?.msg || e.message });
    } finally {
      setSolicitandoEspacio(false);
    }
  };

  const tabsVisibles = [
    { key: "general", label: "Datos generales", icon: "bi-building" },
    { key: "almacenamiento", label: "Almacenamiento", icon: "bi-hdd-stack" },
  ];

  const usoPct = useMemo(() => pct(storage?.uso_pct), [storage]);
  const precioGb = Number(storage?.precio_por_gb_lps || 0);
  const totalEstimado = Number(gbSolicitados || 0) * precioGb;
  const cuotaGb = Number(storage?.cuota_gb || 0);
  const planBaseGb = Math.min(cuotaGb, Number(import.meta.env.VITE_STORAGE_BASE_GB || 20));
  const extraCompradoGb = Math.max(cuotaGb - planBaseGb, 0);
  const extraPctSobreTotal = cuotaGb > 0 ? (extraCompradoGb / cuotaGb) * 100 : 0;

  if (cargando) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)",
          padding: "16px 24px 0",
          boxShadow: "0 2px 12px rgba(0,0,0,.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "rgba(255,255,255,.12)",
              border: "1px solid rgba(255,255,255,.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="bi bi-gear-fill" style={{ color: "#7dd3fc", fontSize: "1rem" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Configuracion de la clinica</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.73rem" }}>{clinica?.nombre}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {tabsVisibles.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "7px 16px",
                fontSize: "0.82rem",
                fontWeight: 600,
                borderRadius: "8px 8px 0 0",
                border: "none",
                cursor: "pointer",
                background: tab === key ? "#fff" : "rgba(255,255,255,.1)",
                color: tab === key ? "#1a2744" : "rgba(255,255,255,.75)",
                transition: "background .15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <i className={`bi ${icon}`} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {msg.texto && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 16px",
              borderRadius: 8,
              fontSize: "0.87rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: msg.tipo === "success" ? "#dcfce7" : "#fee2e2",
              color: msg.tipo === "success" ? "#166534" : "#991b1b",
              border: `1px solid ${msg.tipo === "success" ? "#bbf7d0" : "#fecaca"}`,
            }}
          >
            <span>
              <i className={`bi ${msg.tipo === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"} me-2`} />
              {msg.texto}
            </span>
            <button
              onClick={() => setMsg({ tipo: "", texto: "" })}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "inherit" }}
            >
              x
            </button>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)", padding: "24px" }}>
          {tab === "general" && (
            <form onSubmit={guardarGeneral}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Nombre de la clinica *</label>
                  <input
                    className="form-control"
                    value={form.nombre || ""}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">RUC / NIT / RFC</label>
                  <input className="form-control" value={form.ruc || ""} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Telefono</label>
                  <input
                    className="form-control"
                    value={form.telefono || ""}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Direccion</label>
                  <input
                    className="form-control"
                    value={form.direccion || ""}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Ciudad</label>
                  <input className="form-control" value={form.ciudad || ""} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Pais</label>
                  <select className="form-select" value={form.pais || "HN"} onChange={(e) => setForm({ ...form, pais: e.target.value })}>
                    {[
                      ["HN", "Honduras"],
                      ["PE", "Peru"],
                      ["CO", "Colombia"],
                      ["MX", "Mexico"],
                      ["EC", "Ecuador"],
                      ["AR", "Argentina"],
                      ["CL", "Chile"],
                      ["VE", "Venezuela"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">Logo de la clinica</label>
                  <div className="d-flex gap-2 align-items-start">
                    <div className="flex-grow-1">
                      <input
                        className="form-control"
                        placeholder="https://... o sube un archivo"
                        value={form.logo_url || ""}
                        onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                      />
                    </div>
                    <label className="btn btn-outline-primary mb-0" style={{ cursor: "pointer" }}>
                      <i className="bi bi-upload me-1" /> Subir
                      <input type="file" accept="image/*" onChange={subirLogo} style={{ display: "none" }} />
                    </label>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary mt-3" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          )}

          {tab === "almacenamiento" && (
            <div>
              <div
                style={{
                  border: "1px solid #dbe6ff",
                  background: "#f5f9ff",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#3556a8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px" }}>
                      Uso de almacenamiento
                    </div>
                    <div style={{ fontWeight: 800, color: "#102a56", fontSize: 28 }}>
                      {storage?.espacio_legible || "0 MB"} de {storage?.cuota_legible || "0 GB"}
                    </div>
                    <div style={{ color: "#51607e", fontSize: 13 }}>{usoPct.toFixed(1)}% usado</div>
                  </div>

                  <button className="btn btn-primary" onClick={() => setShowEspacioModal(true)}>
                    <i className="bi bi-plus-circle me-1" /> Solicitar espacio ahora
                  </button>
                </div>

                <div style={{ height: 12, background: "#e4edff", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${usoPct}%`,
                      background: usoPct >= 90 ? "linear-gradient(90deg,#ef4444,#f97316)" : "linear-gradient(90deg,#2563eb,#3b82f6)",
                      transition: "width .2s ease",
                    }}
                  />
                </div>

                {extraCompradoGb > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ color: "#3556a8", fontWeight: 700, fontSize: 12 }}>Espacio extra comprado</div>
                      <div style={{ color: "#51607e", fontSize: 12 }}>
                        {extraCompradoGb.toFixed(2)} GB ({extraPctSobreTotal.toFixed(1)}% del total)
                      </div>
                    </div>
                    <div style={{ height: 10, background: "#e8eafc", borderRadius: 999, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(2, extraPctSobreTotal)}%`,
                          background: "linear-gradient(90deg,#7c3aed,#a78bfa)",
                          transition: "width .2s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ color: "#4b5563", fontSize: 13 }}>
                El precio por GB adicional lo define el administrador del sistema.
              </div>
            </div>
          )}
        </div>
      </div>

      {showEspacioModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(12, 23, 46, 0.45)",
              backdropFilter: "blur(4px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 22px 70px rgba(0,0,0,.28)",
                overflow: "hidden",
                position: "relative",
                zIndex: 10000,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "18px 18px 12px", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 800, color: "#0f172a" }}>Solicitar espacio adicional</h5>
                    <div style={{ marginTop: 2, fontSize: 14, color: "#64748b" }}>Clinica: {clinica?.nombre || "-"}</div>
                  </div>
                  <button
                    onClick={() => setShowEspacioModal(false)}
                    style={{ border: "none", background: "transparent", fontSize: 24, lineHeight: 1, color: "#64748b" }}
                  >
                    x
                  </button>
                </div>
              </div>

              <div style={{ padding: 18 }}>
                <div style={{ background: "#f8fafc", border: "1px solid #dbe2ea", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                  Uso actual: <strong>{storage?.espacio_legible || "0 MB"}</strong> de <strong>{storage?.cuota_legible || "0 GB"}</strong> ({usoPct.toFixed(1)}%)
                </div>

                <label className="form-label" style={{ fontWeight: 700 }}>
                  GB adicionales
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="form-control"
                  value={gbSolicitados}
                  onChange={(e) => setGbSolicitados(e.target.value)}
                />

                <div style={{ marginTop: 14, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ color: "#1e3a8a" }}>
                    Precio por GB: <strong>L {precioGb.toFixed(2)}</strong>
                  </div>
                  <div style={{ color: "#1e3a8a" }}>
                    Modalidad: <strong>Pago unico</strong>
                  </div>
                  <div style={{ color: "#1e3a8a" }}>
                    Periodo: <strong>Cargo por ampliacion (no mensual)</strong>
                  </div>
                  <div style={{ color: "#1e3a8a", fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
                    Total estimado (pago unico): L {Number.isFinite(totalEstimado) ? totalEstimado.toFixed(2) : "0.00"}
                  </div>
                </div>
              </div>

              <div style={{ padding: 14, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-light" onClick={() => setShowEspacioModal(false)} disabled={solicitandoEspacio}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={solicitarMasEspacio} disabled={solicitandoEspacio}>
                  {solicitandoEspacio ? "Enviando..." : "Confirmar solicitud"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
