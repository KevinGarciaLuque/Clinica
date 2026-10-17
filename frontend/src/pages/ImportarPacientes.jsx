import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { zonaActual } from "../utils/zonaClinica";

// Importar pacientes desde Excel / CSV: plantilla → vista previa → confirmar.
// Nunca modifica pacientes existentes; cada importación se puede deshacer.

const ESTADOS = {
  nuevo:    { label: "Nuevos",               corto: "Nuevo",            color: "#15803d", fondo: "#dcfce7", icono: "bi-person-plus-fill" },
  existe:   { label: "Ya registrados",       corto: "Ya registrado",    color: "#475569", fondo: "#e2e8f0", icono: "bi-person-check-fill" },
  posible:  { label: "Posibles duplicados",  corto: "Posible duplicado", color: "#b45309", fondo: "#fef3c7", icono: "bi-exclamation-triangle-fill" },
  repetido: { label: "Repetidos en el archivo", corto: "Repetido",      color: "#475569", fondo: "#f1f5f9", icono: "bi-files" },
  error:    { label: "Con errores",          corto: "Con error",        color: "#b91c1c", fondo: "#fee2e2", icono: "bi-x-octagon-fill" },
};
const POR_PAGINA = 100;

const fechaCorta = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

function fechaHora(valor) {
  try {
    return new Date(valor).toLocaleString("es-HN", {
      timeZone: zonaActual() || undefined, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return String(valor || ""); }
}

const tarjeta = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(15,23,42,.06)", padding: "18px 20px", marginBottom: 16 };

function Insignia({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.error;
  return (
    <span style={{ background: e.fondo, color: e.color, borderRadius: 999, padding: "2px 10px", fontSize: ".75rem", fontWeight: 600, whiteSpace: "nowrap" }}>
      <i className={`bi ${e.icono} me-1`} />{e.corto}
    </span>
  );
}

function Historial({ lista, puedeDeshacer, onDeshacer, deshaciendo }) {
  if (!lista.length) return null;
  return (
    <div style={tarjeta}>
      <div className="fw-bold mb-2"><i className="bi bi-clock-history me-2 text-primary" />Importaciones anteriores</div>
      <div className="d-flex flex-column gap-2">
        {lista.map((h) => (
          <div key={h.id} className="d-flex flex-wrap align-items-center gap-2 p-2 rounded-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="flex-grow-1" style={{ minWidth: 200 }}>
              <div className="fw-semibold text-break" style={{ fontSize: ".9rem" }}>
                <i className="bi bi-file-earmark-spreadsheet me-1 text-success" />{h.archivo_nombre || "Archivo"}
              </div>
              <div className="text-muted" style={{ fontSize: ".78rem" }}>
                {fechaHora(h.creado_en)}{h.usuario ? ` · ${h.usuario}` : ""} · {h.importados} importados{h.omitidos ? ` · ${h.omitidos} omitidos` : ""}
              </div>
              {h.estado === "DESHECHA" && (
                <div style={{ fontSize: ".78rem", color: "#b45309" }}>
                  <i className="bi bi-arrow-counterclockwise me-1" />
                  Deshecha el {fechaHora(h.deshecho_en)}: se quitaron {h.deshechos ?? 0} pacientes
                  {h.importados - (h.deshechos ?? 0) > 0 ? ` (se conservaron ${h.importados - (h.deshechos ?? 0)} que ya tenían datos)` : ""}.
                </div>
              )}
            </div>
            {h.estado === "ACTIVA" && puedeDeshacer && (
              <button className="btn btn-sm btn-outline-danger" disabled={deshaciendo === h.id} onClick={() => onDeshacer(h)}>
                {deshaciendo === h.id ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-arrow-counterclockwise me-1" />}
                Deshacer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ImportarPacientes() {
  const { user } = useAuth();
  const puedeDeshacer = user?.tipo !== "RECEPCIONISTA";
  const inputRef = useRef(null);

  const [analizando, setAnalizando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState("");
  const [vista, setVista] = useState(null); // respuesta de /analizar
  const [filtro, setFiltro] = useState("nuevo");
  const [pagina, setPagina] = useState(1);
  const [incluirPosibles, setIncluirPosibles] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [deshaciendo, setDeshaciendo] = useState(null);
  const [aviso, setAviso] = useState("");
  const [descargando, setDescargando] = useState(false);

  const cargarHistorial = () =>
    api.get("/pacientes-importar/historial").then((r) => setHistorial(r.data.data || [])).catch(() => {});
  useEffect(() => { cargarHistorial(); }, []);

  const descargarPlantilla = async () => {
    setDescargando(true);
    try {
      const r = await api.get("/pacientes-importar/plantilla", { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url; a.download = "plantilla_pacientes_medickg.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError("No se pudo descargar la plantilla. Intente de nuevo.");
    } finally {
      setDescargando(false);
    }
  };

  const analizar = async (archivo) => {
    if (!archivo) return;
    setError(""); setResultado(null); setVista(null); setAviso("");
    setAnalizando(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const r = await api.post("/pacientes-importar/analizar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setVista(r.data);
      setIncluirPosibles(false);
      setPagina(1);
      const res = r.data.resumen;
      setFiltro(res.nuevo ? "nuevo" : res.posible ? "posible" : res.error ? "error" : "existe");
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo leer el archivo.");
    } finally {
      setAnalizando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const aImportar = useMemo(() => {
    if (!vista) return [];
    return vista.filas.filter((f) => f.estado === "nuevo" || (incluirPosibles && f.estado === "posible"));
  }, [vista, incluirPosibles]);

  const filasFiltro = useMemo(() => (vista ? vista.filas.filter((f) => f.estado === filtro) : []), [vista, filtro]);

  const confirmar = async () => {
    if (!aImportar.length) return;
    setGuardando(true); setError("");
    try {
      const r = await api.post("/pacientes-importar/confirmar", {
        archivo: vista.archivo,
        total_archivo: vista.resumen.total,
        incluir_posibles: incluirPosibles,
        filas: aImportar.map((f) => ({ fila: f.fila, datos: f.datos })),
      });
      setResultado(r.data);
      setVista(null);
      cargarHistorial();
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo completar la importación. No se guardó ningún paciente.");
    } finally {
      setGuardando(false);
    }
  };

  const deshacer = async (h) => {
    const ok = window.confirm(
      `¿Deshacer la importación de «${h.archivo_nombre || "archivo"}»?\n\n` +
      `Se quitarán los ${h.importados} pacientes que se agregaron con ella. ` +
      "Los que ya tengan citas, consultas, facturas u otros datos se conservarán."
    );
    if (!ok) return;
    setDeshaciendo(h.id); setAviso(""); setError("");
    try {
      const r = await api.post(`/pacientes-importar/${h.id}/deshacer`);
      setAviso(`Importación deshecha: se quitaron ${r.data.borrados} pacientes${r.data.conservados ? ` y se conservaron ${r.data.conservados} que ya tenían datos` : ""}.`);
      cargarHistorial();
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo deshacer la importación.");
    } finally {
      setDeshaciendo(null);
    }
  };

  const reiniciar = () => { setVista(null); setResultado(null); setError(""); setAviso(""); };

  return (
    <div className="imp-root" style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.5rem", width: "calc(100% + 3rem)" }}>
      <style>{`
        .imp-cuerpo { padding: 20px 24px; max-width: 1100px; }
        .imp-zona { border: 2px dashed #93c5fd; border-radius: 14px; background: #f8fbff; padding: 28px 16px; text-align: center; cursor: pointer; transition: .15s; }
        .imp-zona:hover, .imp-zona.activa { background: #eff6ff; border-color: #2563eb; }
        .imp-filtros { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .imp-filtro { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 5px 12px; font-size: .8rem; white-space: nowrap; color: #334155; }
        .imp-filtro.sel { border-color: transparent; font-weight: 700; }
        .imp-tabla td, .imp-tabla th { font-size: .84rem; vertical-align: top; }
        @media (max-width: 767.98px) { .imp-cuerpo { padding: 14px 12px; } }
      `}</style>

      {/* Encabezado */}
      <div style={{ background: "linear-gradient(135deg, #1a2744 0%, #243b72 100%)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,.18)" }}>
        <Link to="/pacientes" title="Volver a Pacientes" style={{ color: "#cbd5e1", fontSize: "1.2rem" }}><i className="bi bi-arrow-left" /></Link>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="bi bi-file-earmark-arrow-up-fill" style={{ color: "#86efac" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem" }}>Importar pacientes</div>
          <div style={{ color: "rgba(255,255,255,.55)", fontSize: "0.75rem" }}>Desde Excel (.xlsx) o CSV · los pacientes que ya existen no se modifican</div>
        </div>
      </div>

      <div className="imp-cuerpo">
        {error && (
          <div className="alert alert-danger d-flex gap-2 align-items-start py-2">
            <i className="bi bi-x-circle-fill mt-1" /><div className="flex-grow-1">{error}</div>
            <button className="btn-close" aria-label="Cerrar" onClick={() => setError("")} />
          </div>
        )}
        {aviso && (
          <div className="alert alert-success d-flex gap-2 align-items-start py-2">
            <i className="bi bi-check-circle-fill mt-1" /><div className="flex-grow-1">{aviso}</div>
            <button className="btn-close" aria-label="Cerrar" onClick={() => setAviso("")} />
          </div>
        )}

        {/* Resultado final */}
        {resultado && (
          <div style={{ ...tarjeta, borderLeft: "5px solid #16a34a" }}>
            <div className="d-flex align-items-start gap-3">
              <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "2rem" }} />
              <div className="flex-grow-1">
                <div className="fw-bold" style={{ fontSize: "1.1rem" }}>¡Listo! Se importaron {resultado.importados} pacientes.</div>
                <div className="text-muted small">
                  {resultado.omitidos ? `${resultado.omitidos} filas no se importaron (ya registrados, repetidos o con errores). ` : ""}
                  Si algo salió mal, puede deshacer esta importación abajo.
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <Link to="/pacientes" className="btn btn-primary btn-sm"><i className="bi bi-people-fill me-1" />Ver pacientes</Link>
                  <button className="btn btn-outline-secondary btn-sm" onClick={reiniciar}><i className="bi bi-upload me-1" />Importar otro archivo</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paso 1: archivo */}
        {!vista && !resultado && (
          <div style={tarjeta}>
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
              <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                <div className="fw-bold">1. Prepare su lista de pacientes</div>
                <div className="text-muted small">
                  Descargue la plantilla y llénela, o suba directamente el Excel que ya tiene: el sistema reconoce columnas
                  como «Nombre», «Apellidos», «Identidad», «Celular», «Correo» o «Fecha de nacimiento».
                </div>
              </div>
              <button className="btn btn-outline-success btn-sm" onClick={descargarPlantilla} disabled={descargando}>
                {descargando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-download me-1" />}
                Descargar plantilla
              </button>
            </div>

            <div className="fw-bold mb-2">2. Suba el archivo</div>
            <div
              className={`imp-zona ${arrastrando ? "activa" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => !analizando && inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); analizar(e.dataTransfer.files?.[0]); }}
            >
              {analizando ? (
                <>
                  <div className="spinner-border text-primary mb-2" />
                  <div className="fw-semibold">Leyendo el archivo…</div>
                </>
              ) : (
                <>
                  <i className="bi bi-cloud-arrow-up-fill text-primary" style={{ fontSize: "2.4rem" }} />
                  <div className="fw-semibold mt-1">Toque aquí para elegir el archivo</div>
                  <div className="text-muted small">o arrástrelo a este recuadro · Excel (.xlsx) o CSV · hasta 5,000 pacientes</div>
                </>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => analizar(e.target.files?.[0])} />
            </div>
            <div className="text-muted mt-2" style={{ fontSize: ".78rem" }}>
              <i className="bi bi-shield-check me-1 text-success" />
              Antes de guardar verá una vista previa. Nada se guarda hasta que usted confirme.
            </div>
          </div>
        )}

        {/* Paso 2: vista previa */}
        {vista && (
          <>
            <div style={tarjeta}>
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                <div style={{ minWidth: 0 }}>
                  <div className="fw-bold">Vista previa</div>
                  <div className="text-muted small text-break">
                    <i className="bi bi-file-earmark-spreadsheet me-1 text-success" />{vista.archivo} · {vista.resumen.total} filas con datos
                  </div>
                </div>
                <button className="btn btn-link btn-sm text-decoration-none p-0" onClick={reiniciar}><i className="bi bi-arrow-repeat me-1" />Elegir otro archivo</button>
              </div>

              {/* Columnas reconocidas */}
              <div className="mb-3" style={{ fontSize: ".78rem" }}>
                <span className="text-muted me-1">Columnas:</span>
                {vista.columnas.map((c, i) => (
                  <span key={i} className="d-inline-block me-1 mb-1 px-2 py-1 rounded-2"
                    title={c.campo ? `Se usa como «${c.nombre}»` : "Esta columna no se usará"}
                    style={{ background: c.campo ? "#e0f2fe" : "#f1f5f9", color: c.campo ? "#075985" : "#94a3b8", textDecoration: c.campo ? "none" : "line-through" }}>
                    {c.encabezado}{c.campo && c.nombre !== c.encabezado ? ` → ${c.nombre}` : ""}
                  </span>
                ))}
              </div>

              {/* Filtros por estado */}
              <div className="imp-filtros mb-2">
                {Object.entries(ESTADOS).map(([k, e]) => (
                  vista.resumen[k] > 0 && (
                    <button key={k} className={`imp-filtro ${filtro === k ? "sel" : ""}`}
                      style={filtro === k ? { background: e.fondo, color: e.color } : {}}
                      onClick={() => { setFiltro(k); setPagina(1); }}>
                      <i className={`bi ${e.icono} me-1`} style={{ color: e.color }} />{e.label}: <strong>{vista.resumen[k]}</strong>
                    </button>
                  )
                ))}
              </div>
              <div className="text-muted mb-2" style={{ fontSize: ".78rem" }}>
                {filtro === "nuevo" && "Estos pacientes se agregarán."}
                {filtro === "existe" && "Ya están registrados en la clínica (mismo DNI, o mismo nombre y fecha de nacimiento). No se tocarán."}
                {filtro === "posible" && "Hay un paciente con el mismo nombre. Pueden ser personas distintas: revíselos y decida abajo si los agrega."}
                {filtro === "repetido" && "Aparecen más de una vez en el archivo: solo se toma la primera."}
                {filtro === "error" && "Les faltan datos obligatorios (nombre y apellido). Corríjalos en el Excel y vuelva a subirlo."}
              </div>

              <div className="table-responsive">
                <table className="table table-sm imp-tabla mb-0">
                  <thead>
                    <tr className="text-muted">
                      <th style={{ width: 50 }}>Fila</th>
                      <th>Paciente</th>
                      <th className="d-none d-md-table-cell">Nacimiento</th>
                      <th className="d-none d-md-table-cell">Teléfono</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltro.slice(0, pagina * POR_PAGINA).map((f) => (
                      <tr key={f.fila}>
                        <td className="text-muted">{f.fila}</td>
                        <td style={{ minWidth: 0 }}>
                          <div className="fw-semibold text-break">{`${f.datos.nombres} ${f.datos.apellidos}`.trim() || <em className="text-muted">Sin nombre</em>}</div>
                          <div className="text-muted" style={{ fontSize: ".76rem" }}>
                            {f.datos.dni ? `DNI ${f.datos.dni}` : "Sin DNI"}
                            <span className="d-md-none">{f.datos.fecha_nacimiento ? ` · ${fechaCorta(f.datos.fecha_nacimiento)}` : ""}{f.datos.telefono ? ` · ${f.datos.telefono}` : ""}</span>
                          </div>
                          {f.coincide && (
                            <div style={{ fontSize: ".76rem", color: "#b45309" }}>
                              {f.coincide.fila ? `Igual a la fila ${f.coincide.fila}` : <>{f.coincide.motivo}: <Link to={`/pacientes/${f.coincide.id}/perfil`} target="_blank">{f.coincide.nombre}</Link></>}
                            </div>
                          )}
                          {f.errores.map((t, i) => <div key={`e${i}`} style={{ fontSize: ".76rem", color: "#b91c1c" }}><i className="bi bi-x-circle me-1" />{t}</div>)}
                          {f.avisos.filter((t) => t !== "Sin DNI.").map((t, i) => <div key={`a${i}`} style={{ fontSize: ".76rem", color: "#92400e" }}><i className="bi bi-info-circle me-1" />{t}</div>)}
                        </td>
                        <td className="d-none d-md-table-cell">{fechaCorta(f.datos.fecha_nacimiento)}</td>
                        <td className="d-none d-md-table-cell">{f.datos.telefono}</td>
                        <td><Insignia estado={f.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filasFiltro.length > pagina * POR_PAGINA && (
                <button className="btn btn-light btn-sm w-100 mt-2" onClick={() => setPagina((p) => p + 1)}>
                  Mostrar más ({filasFiltro.length - pagina * POR_PAGINA} restantes)
                </button>
              )}
            </div>

            {/* Confirmar */}
            <div style={{ ...tarjeta, position: "sticky", bottom: 0, zIndex: 5, boxShadow: "0 -4px 18px rgba(15,23,42,.10)" }}>
              {vista.resumen.posible > 0 && (
                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id="imp-posibles" checked={incluirPosibles} onChange={(e) => setIncluirPosibles(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="imp-posibles">
                    Agregar también los {vista.resumen.posible} posibles duplicados (son personas distintas con el mismo nombre)
                  </label>
                </div>
              )}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <div className="flex-grow-1 small text-muted" style={{ minWidth: 180 }}>
                  {aImportar.length
                    ? <>Se agregarán <strong className="text-dark">{aImportar.length}</strong> pacientes nuevos. Los demás no se tocan.</>
                    : "No hay pacientes nuevos para agregar en este archivo."}
                </div>
                <button className="btn btn-outline-secondary btn-sm" onClick={reiniciar} disabled={guardando}>Cancelar</button>
                <button className="btn btn-success btn-sm" onClick={confirmar} disabled={!aImportar.length || guardando}>
                  {guardando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2-circle me-1" />}
                  {guardando ? "Importando…" : `Importar ${aImportar.length} pacientes`}
                </button>
              </div>
            </div>
          </>
        )}

        <Historial lista={historial} puedeDeshacer={puedeDeshacer} onDeshacer={deshacer} deshaciendo={deshaciendo} />
      </div>
    </div>
  );
}
