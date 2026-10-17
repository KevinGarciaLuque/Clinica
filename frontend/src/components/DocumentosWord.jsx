// 📝 Mis documentos (tipo Word): la clínica sube sus Word (.docx) o los escribe
// aquí, los edita (negritas, tablas, listas…), les pone datos automáticos como
// {{paciente}} o {{fecha}}, y al elegir un paciente se llenan solos para
// imprimir, descargar en PDF o Word, o guardarlos en el expediente.
import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import api from "../api/api";
import {
  CATEGORIAS_WORD, PAPELES, VARIABLES, NOMBRE_VARIABLE, llenarDatos, datosUsados, docxAHtml, paginaCompleta, normalizarBloques,
} from "../utils/documentosWord";

const categoriaLabel = (v) => CATEGORIAS_WORD.find((c) => c.value === v)?.label || "Otro";
const papelInfo = (v) => PAPELES.find((p) => p.value === v) || PAPELES[0];

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const nombreArchivo = (t) => String(t || "documento").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9 _-]+/g, "").trim().slice(0, 80) || "documento";

const CSS = `
  .dw-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 8px 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  /* Encabezado del editor + barra de herramientas fijos al desplazarse (debajo del título de la página) */
  .dw-fijo { position: sticky; top: calc(var(--dc-cab-h, 0px) - 1.5rem); z-index: 15; background: #fff; box-shadow: 0 4px 10px -8px rgba(15,23,42,.35); }
  @media (max-width: 767.98px) {
    /* En el teléfono solo queda fija la barra de herramientas (el encabezado completo ocuparía media pantalla) */
    .dw-fijo { display: contents; }
    .dw-fijo .dw-bar { position: sticky; top: -1rem; z-index: 15; }
  }
  .dw-bar .dw-sep { width: 1px; height: 22px; background: #e2e8f0; margin: 0 3px; }
  .dw-btn { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; min-width: 32px; height: 32px; padding: 0 7px; font-size: 14px; color: #1f2937; display: inline-flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; }
  .dw-btn:hover { background: #eef2ff; }
  .dw-btn small { font-size: 11.5px; font-weight: 600; }
  .dw-select { height: 32px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12.5px; padding: 0 6px; background: #fff; }
  .dw-hoja-wrap { background: #e5e9f0; padding: 20px 12px; overflow-x: auto; }
  .dw-hoja { background: #fff; margin: 0 auto; box-shadow: 0 3px 14px rgba(0,0,0,.14); padding: 56px 64px; max-width: 100%; box-sizing: border-box;
    font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; outline: none; overflow-wrap: break-word; }
  .dw-hoja h1 { font-size: 18pt; } .dw-hoja h2 { font-size: 15pt; } .dw-hoja h3 { font-size: 13pt; }
  .dw-hoja p { margin: 0 0 8px; } .dw-hoja table { border-collapse: collapse; max-width: 100%; } .dw-hoja img { max-width: 100%; }
  .dw-hoja td, .dw-hoja th { min-width: 30px; }
  .dw-hoja .dw-var { background: #e0e7ff; color: #3730a3; border-radius: 4px; padding: 0 3px; white-space: nowrap; }
  .dw-hoja:empty:before { content: "Escribe aquí tu documento…"; color: #9ca3af; }
  .dw-menu { position: absolute; z-index: 30; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.16); padding: 6px; max-height: 340px; overflow-y: auto; width: 270px; }
  .dw-menu button { display: block; width: 100%; text-align: left; border: none; background: none; padding: 6px 8px; border-radius: 6px; font-size: 13px; }
  .dw-menu button:hover { background: #eef2ff; }
  .dw-menu .dw-grupo { font-size: 10.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; padding: 6px 8px 2px; }
  .dw-card { display: flex; gap: 12px; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; min-width: 0; }
  .dw-card-acc { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  @media (max-width: 640px) {
    .dw-hoja { padding: 22px 16px; }
    .dw-card { flex-wrap: wrap; }
    .dw-card-acc { width: 100%; justify-content: stretch; }
    .dw-card-acc .btn { flex: 1; }
  }
`;

/* ══════════════════════════════════════════════════════════════════════════
   Lista de documentos
   ══════════════════════════════════════════════════════════════════════════ */
export default function DocumentosWord({ pacienteInicial = null }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState({ modo: "lista" }); // lista | editar | generar
  const [msg, setMsg] = useState("");
  const [borrar, setBorrar] = useState(null);
  const inputWord = useRef(null);

  const cargar = () => {
    api.get("/documentos-word")
      .then((r) => { setLista(r.data.data || []); setError(""); })
      .catch((e) => setError(e.response?.data?.msg || "No se pudieron cargar los documentos"));
  };
  useEffect(cargar, []);

  const avisar = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2600); };

  const abrir = async (doc, modo) => {
    try {
      const r = await api.get(`/documentos-word/${doc.id}`);
      setVista({ modo, doc: r.data.data });
    } catch (e) { avisar(e.response?.data?.msg || "No se pudo abrir el documento"); }
  };

  const subirWord = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { avisar("Solo se pueden subir archivos de Word .docx (en Word: Archivo → Guardar como → .docx)."); return; }
    try {
      const html = await docxAHtml(file);
      setVista({ modo: "editar", doc: { nombre: file.name.replace(/\.docx$/i, ""), categoria: "constancia", papel: "LETTER", contenido: html }, importado: true });
    } catch { avisar("No se pudo leer el archivo de Word."); }
  };

  const eliminar = async () => {
    try {
      await api.delete(`/documentos-word/${borrar.id}`);
      setBorrar(null); avisar("Documento eliminado."); cargar();
    } catch (e) { avisar(e.response?.data?.msg || "No se pudo eliminar"); }
  };

  if (vista.modo === "editar") {
    return <EditorWord doc={vista.doc} importado={vista.importado}
      onCerrar={(guardado) => { setVista({ modo: "lista" }); if (guardado) { avisar("Documento guardado."); cargar(); } }}
      onUsar={(doc) => setVista({ modo: "generar", doc })} />;
  }
  if (vista.modo === "generar") {
    return <GenerarDocumento doc={vista.doc} pacienteInicial={pacienteInicial} onCerrar={() => { setVista({ modo: "lista" }); cargar(); }} />;
  }

  const q = busqueda.trim().toLowerCase();
  const filtrados = (lista || []).filter((d) => !q || d.nombre.toLowerCase().includes(q) || categoriaLabel(d.categoria).toLowerCase().includes(q));

  return (
    <div>
      <style>{CSS}</style>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setVista({ modo: "editar", doc: { nombre: "", categoria: "constancia", papel: "LETTER", contenido: "" } })}>
          <i className="bi bi-plus-lg me-1" />Nuevo documento
        </button>
        <button className="btn btn-outline-primary" onClick={() => inputWord.current?.click()}>
          <i className="bi bi-file-earmark-word me-1" />Subir Word (.docx)
        </button>
        <input ref={inputWord} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={subirWord} style={{ display: "none" }} />
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <i className="bi bi-search" style={{ position: "absolute", left: 11, top: 9, color: "#64748b" }} />
          <input className="form-control" style={{ paddingLeft: 34 }} placeholder="Buscar documento…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        {msg && <span style={{ fontSize: ".8rem", color: "#166534", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, padding: "6px 10px" }}>{msg}</span>}
      </div>

      {pacienteInicial && (
        <div className="alert alert-info py-2 small">
          <i className="bi bi-person-check me-1" />Elige un documento y toca <strong>Usar con paciente</strong>: se llenará con los datos de <strong>{pacienteInicial.nombres} {pacienteInicial.apellidos}</strong>.
        </div>
      )}

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {!lista && !error && <div className="text-center py-5 text-muted"><span className="spinner-border spinner-border-sm me-2" />Cargando…</div>}

      {lista && filtrados.length === 0 && (
        <div style={{ textAlign: "center", padding: "46px 16px", color: "#64748b", background: "#fff", borderRadius: 12, border: "1px dashed #cbd5e1" }}>
          <i className="bi bi-file-earmark-word" style={{ fontSize: 44, opacity: .35 }} />
          <div style={{ marginTop: 10, fontWeight: 700, color: "#334155" }}>{q ? "Ningún documento coincide" : "Aún no hay documentos"}</div>
          <div style={{ fontSize: ".86rem", maxWidth: 460, margin: "4px auto 0" }}>
            Sube el Word que ya usas (constancias, consentimientos, informes) o crea uno nuevo. Luego agrégale datos automáticos como el nombre o el DNI del paciente.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {filtrados.map((d) => (
          <div key={d.id} className="dw-card">
            <div style={{ width: 42, height: 42, borderRadius: 9, background: "#eff6ff", color: "#1d4ed8", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
              <i className="bi bi-file-earmark-word-fill" style={{ fontSize: 20 }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }} className="text-truncate">{d.nombre}</div>
              <div style={{ fontSize: ".78rem", color: "#64748b", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{categoriaLabel(d.categoria)}</span>
                <span>{papelInfo(d.papel).label}</span>
                <span>Editado {dayjs(d.actualizado_en).format("DD/MM/YYYY")}{d.autor_nombres ? ` por ${d.autor_nombres}` : ""}</span>
              </div>
            </div>
            <div className="dw-card-acc">
              <button className="btn btn-sm btn-success" onClick={() => abrir(d, "generar")}><i className="bi bi-person-fill-check me-1" />Usar con paciente</button>
              <button className="btn btn-sm btn-outline-primary" onClick={() => abrir(d, "editar")}><i className="bi bi-pencil me-1" />Editar</button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => setBorrar(d)} title="Eliminar"><i className="bi bi-trash" /></button>
            </div>
          </div>
        ))}
      </div>

      {borrar && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setBorrar(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, padding: 20 }}>
            <h6 className="fw-bold"><i className="bi bi-trash text-danger me-2" />Eliminar documento</h6>
            <p className="mb-3">¿Eliminar <strong>{borrar.nombre}</strong>? Los documentos ya generados y guardados en expedientes no se borran.</p>
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-light" onClick={() => setBorrar(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={eliminar}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonBarra({ t, i, onClick, children }) {
  return (
    <button type="button" className="dw-btn" title={t} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {i ? <i className={`bi ${i}`} /> : children}
    </button>
  );
}

function BotonAccion({ t, i, txt, cls = "btn-outline-primary", disabled, trabajando, onAccion }) {
  return (
    <button className={`btn btn-sm ${cls}`} disabled={!!trabajando || disabled} onClick={() => onAccion(t)}>
      {trabajando === t ? <span className="spinner-border spinner-border-sm me-1" /> : <i className={`bi ${i} me-1`} />}{txt}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Barra de herramientas tipo Word (sirve al editor y a la hoja final)
   ══════════════════════════════════════════════════════════════════════════ */
function BarraWord({ editorRef, conDatos = true }) {
  const rango = useRef(null);
  const [menuDatos, setMenuDatos] = useState(false);
  const [menuTabla, setMenuTabla] = useState(false);
  const [tabla, setTabla] = useState({ filas: 3, columnas: 3 });

  // Recordar dónde estaba el cursor (al tocar un botón el editor pierde el foco)
  useEffect(() => {
    const guardar = () => {
      const sel = window.getSelection();
      if (sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) rango.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", guardar);
    // Al presionar Enter se crean párrafos (<p>), como en Word
    const alEnfocar = () => { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* navegador sin soporte */ } };
    const ed = editorRef.current;
    ed?.addEventListener("focus", alEnfocar);
    return () => { document.removeEventListener("selectionchange", guardar); ed?.removeEventListener("focus", alEnfocar); };
  }, [editorRef]);

  const enfocar = () => {
    const ed = editorRef.current; if (!ed) return;
    ed.focus();
    if (rango.current) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(rango.current); }
  };
  const cmd = (c, v = null) => { enfocar(); document.execCommand("styleWithCSS", false, c === "fontSize" ? false : true); document.execCommand(c, false, v); };

  const tamano = (pt) => {
    enfocar();
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7");
    editorRef.current.querySelectorAll('font[size="7"]').forEach((f) => {
      const s = document.createElement("span"); s.style.fontSize = `${pt}pt`; s.innerHTML = f.innerHTML; f.replaceWith(s);
    });
  };

  const celdaActual = () => {
    const sel = window.getSelection();
    const nodo = rango.current?.startContainer || sel.anchorNode;
    const el = nodo?.nodeType === 3 ? nodo.parentElement : nodo;
    const celda = el?.closest?.("td,th");
    return celda && editorRef.current.contains(celda) ? celda : null;
  };

  const insertarTabla = () => {
    const f = Math.min(30, Math.max(1, tabla.filas)); const c = Math.min(10, Math.max(1, tabla.columnas));
    const celda = '<td style="border:1px solid #444;padding:4px 6px;vertical-align:top"><br></td>';
    const html = `<table style="border-collapse:collapse;width:100%"><tbody>${Array.from({ length: f }, () => `<tr>${celda.repeat(c)}</tr>`).join("")}</tbody></table><p><br></p>`;
    enfocar(); document.execCommand("insertHTML", false, html); setMenuTabla(false);
  };
  const filaColumna = (accion) => {
    const td = celdaActual();
    if (!td) { alert("Coloca el cursor dentro de una celda de la tabla."); return; }
    const tr = td.parentElement; const idx = [...tr.children].indexOf(td); const tbl = td.closest("table");
    if (accion === "fila") { const n = tr.cloneNode(true); n.querySelectorAll("td,th").forEach((x) => { x.innerHTML = "<br>"; }); tr.after(n); }
    if (accion === "columna") tbl.querySelectorAll("tr").forEach((r) => { const ref = r.children[idx]; if (ref) { const n = ref.cloneNode(false); n.innerHTML = "<br>"; ref.after(n); } });
    if (accion === "borrarFila") { if (tbl.querySelectorAll("tr").length > 1) tr.remove(); else tbl.remove(); }
    if (accion === "borrarColumna") { const filas = tbl.querySelectorAll("tr"); if ((filas[0]?.children.length || 0) <= 1) tbl.remove(); else filas.forEach((r) => r.children[idx]?.remove()); }
    if (accion === "borrarTabla") tbl.remove();
    setMenuTabla(false);
  };

  const insertarDato = (clave) => {
    enfocar();
    // Si se reemplaza un texto en negrita/cursiva/subrayado, el dato conserva ese formato
    let chip = `<span class="dw-var" contenteditable="false">{{${clave}}}</span>`;
    if (document.queryCommandState("underline")) chip = `<u>${chip}</u>`;
    if (document.queryCommandState("italic")) chip = `<em>${chip}</em>`;
    if (document.queryCommandState("bold")) chip = `<strong>${chip}</strong>`;
    document.execCommand("insertHTML", false, `${chip}&nbsp;`);
    setMenuDatos(false);
  };

  return (
    <div className="dw-bar" onMouseDown={(e) => { if (e.target.tagName !== "SELECT" && e.target.tagName !== "INPUT") e.preventDefault(); }}>
      <BotonBarra t="Deshacer" i="bi-arrow-counterclockwise" onClick={() => cmd("undo")} />
      <BotonBarra t="Rehacer" i="bi-arrow-clockwise" onClick={() => cmd("redo")} />
      <span className="dw-sep" />
      <select className="dw-select" title="Tamaño de letra" defaultValue="" onChange={(e) => { if (e.target.value) tamano(e.target.value); e.target.value = ""; }}>
        <option value="" disabled>Tamaño</option>
        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select className="dw-select" title="Estilo de párrafo" defaultValue="" onChange={(e) => { if (e.target.value) cmd("formatBlock", e.target.value); e.target.value = ""; }}>
        <option value="" disabled>Estilo</option>
        <option value="P">Normal</option><option value="H1">Título 1</option><option value="H2">Título 2</option><option value="H3">Título 3</option>
      </select>
      <span className="dw-sep" />
      <BotonBarra t="Negrita (Ctrl+B)" onClick={() => cmd("bold")}><b>B</b></BotonBarra>
      <BotonBarra t="Cursiva (Ctrl+I)" onClick={() => cmd("italic")}><i>I</i></BotonBarra>
      <BotonBarra t="Subrayado (Ctrl+U)" onClick={() => cmd("underline")}><u>U</u></BotonBarra>
      <BotonBarra t="Tachado" onClick={() => cmd("strikeThrough")}><s>S</s></BotonBarra>
      <label className="dw-btn" title="Color de letra" style={{ position: "relative" }}>
        <i className="bi bi-fonts" style={{ color: "#dc2626" }} />
        <input type="color" onChange={(e) => cmd("foreColor", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
      </label>
      <label className="dw-btn" title="Resaltar" style={{ position: "relative" }}>
        <i className="bi bi-highlighter" style={{ color: "#ca8a04" }} />
        <input type="color" defaultValue="#fff59d" onChange={(e) => cmd("hiliteColor", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
      </label>
      <span className="dw-sep" />
      <BotonBarra t="Alinear a la izquierda" i="bi-text-left" onClick={() => cmd("justifyLeft")} />
      <BotonBarra t="Centrar" i="bi-text-center" onClick={() => cmd("justifyCenter")} />
      <BotonBarra t="Alinear a la derecha" i="bi-text-right" onClick={() => cmd("justifyRight")} />
      <BotonBarra t="Justificar" i="bi-justify" onClick={() => cmd("justifyFull")} />
      <span className="dw-sep" />
      <BotonBarra t="Viñetas" i="bi-list-ul" onClick={() => cmd("insertUnorderedList")} />
      <BotonBarra t="Numeración" i="bi-list-ol" onClick={() => cmd("insertOrderedList")} />
      <BotonBarra t="Disminuir sangría" i="bi-text-indent-right" onClick={() => cmd("outdent")} />
      <BotonBarra t="Aumentar sangría" i="bi-text-indent-left" onClick={() => cmd("indent")} />
      <BotonBarra t="Línea horizontal" i="bi-hr" onClick={() => cmd("insertHorizontalRule")} />
      <span className="dw-sep" />
      <div style={{ position: "relative" }}>
        <button type="button" className="dw-btn" title="Tabla" onClick={() => { setMenuTabla((x) => !x); setMenuDatos(false); }}>
          <i className="bi bi-table" /><small>Tabla</small><i className="bi bi-caret-down-fill" style={{ fontSize: 9 }} />
        </button>
        {menuTabla && (
          <div className="dw-menu" style={{ top: 36, left: 0, width: 230 }}>
            <div className="dw-grupo">Insertar tabla</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 8px" }}>
              <input type="number" min={1} max={30} className="form-control form-control-sm" value={tabla.filas} onChange={(e) => setTabla((t) => ({ ...t, filas: Number(e.target.value) }))} aria-label="Filas" />
              <span style={{ fontSize: 12 }}>×</span>
              <input type="number" min={1} max={10} className="form-control form-control-sm" value={tabla.columnas} onChange={(e) => setTabla((t) => ({ ...t, columnas: Number(e.target.value) }))} aria-label="Columnas" />
            </div>
            <div style={{ fontSize: 10.5, color: "#94a3b8", padding: "0 8px 4px" }}>filas × columnas</div>
            <button onClick={insertarTabla}><i className="bi bi-plus-square me-2" />Insertar tabla</button>
            <div className="dw-grupo">Tabla donde está el cursor</div>
            <button onClick={() => filaColumna("fila")}><i className="bi bi-arrow-down-square me-2" />Agregar fila</button>
            <button onClick={() => filaColumna("columna")}><i className="bi bi-arrow-right-square me-2" />Agregar columna</button>
            <button onClick={() => filaColumna("borrarFila")}><i className="bi bi-dash-square me-2" />Quitar fila</button>
            <button onClick={() => filaColumna("borrarColumna")}><i className="bi bi-dash-square me-2" />Quitar columna</button>
            <button onClick={() => filaColumna("borrarTabla")} style={{ color: "#dc2626" }}><i className="bi bi-trash me-2" />Eliminar tabla</button>
          </div>
        )}
      </div>
      {conDatos && (
        <div style={{ position: "relative" }}>
          <button type="button" className="dw-btn" title="Insertar un dato que se llena solo" onClick={() => { setMenuDatos((x) => !x); setMenuTabla(false); }}
            style={{ background: "#eef2ff", borderColor: "#c7d2fe", color: "#3730a3" }}>
            <i className="bi bi-person-vcard" /><small>Dato del paciente</small><i className="bi bi-caret-down-fill" style={{ fontSize: 9 }} />
          </button>
          {menuDatos && (
            <div className="dw-menu" style={{ top: 36, right: 0, maxWidth: "calc(100vw - 24px)" }}>
              {VARIABLES.map((g) => (
                <div key={g.grupo}>
                  <div className="dw-grupo">{g.grupo}</div>
                  {g.items.map(([k, l]) => <button key={k} onClick={() => insertarDato(k)}>{l}</button>)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <BotonBarra t="Quitar formato" i="bi-eraser" onClick={() => cmd("removeFormat")} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Editor de la plantilla
   ══════════════════════════════════════════════════════════════════════════ */
function EditorWord({ doc, importado, onCerrar, onUsar }) {
  const editorRef = useRef(null);
  const [nombre, setNombre] = useState(doc.nombre || "");
  const [categoria, setCategoria] = useState(doc.categoria || "constancia");
  const [papel, setPapel] = useState(doc.papel || "LETTER");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = doc.contenido || "";
    editorRef.current.querySelectorAll("span.dw-var").forEach((s) => s.setAttribute("contenteditable", "false"));
  }, [doc]);

  const guardar = async (usarDespues = false) => {
    if (!nombre.trim()) { setError("Ponle un nombre al documento."); return; }
    setGuardando(true); setError("");
    const datos = { nombre: nombre.trim(), categoria, papel, contenido: normalizarBloques(editorRef.current.innerHTML) };
    try {
      let id = doc.id;
      if (id) await api.put(`/documentos-word/${id}`, datos);
      else id = (await api.post("/documentos-word", datos)).data.id;
      if (usarDespues) onUsar({ ...datos, id });
      else onCerrar(true);
    } catch (e) {
      setError(e.response?.data?.msg || "No se pudo guardar el documento.");
    } finally { setGuardando(false); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #dbe4ef", overflow: "clip" }}>
      <style>{CSS}</style>
      <div className="dw-fijo">
      <div style={{ padding: "12px 14px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
        <button className="btn btn-sm btn-light" onClick={() => onCerrar(false)} title="Volver sin guardar"><i className="bi bi-arrow-left" /></button>
        <input className="form-control form-control-sm" style={{ flex: "1 1 220px", fontWeight: 600 }} placeholder="Nombre del documento (ej. Constancia médica)" value={nombre} onChange={(e) => setNombre(e.target.value)} data-sin-dictado />
        <select className="form-select form-select-sm" style={{ width: "auto" }} value={categoria} onChange={(e) => setCategoria(e.target.value)} title="Categoría">
          {CATEGORIAS_WORD.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ width: "auto" }} value={papel} onChange={(e) => setPapel(e.target.value)} title="Tamaño de hoja">
          {PAPELES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button className="btn btn-sm btn-outline-success" onClick={() => guardar(true)} disabled={guardando}><i className="bi bi-person-fill-check me-1" />Guardar y usar</button>
        <button className="btn btn-sm btn-primary" onClick={() => guardar(false)} disabled={guardando}>
          {guardando ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-floppy me-1" />}Guardar
        </button>
      </div>
      {error && <div className="alert alert-danger m-2 py-2">{error}</div>}
      {importado && (
        <div className="alert alert-info m-2 py-2 small mb-0">
          <i className="bi bi-file-earmark-word me-1" />Se cargó tu Word. Revisa que se vea bien (negritas, tablas y listas se conservan; algunos detalles como colores o centrados pueden necesitar ajuste) y usa <strong>Dato del paciente</strong> para poner el nombre, DNI, edad… donde corresponda.
        </div>
      )}
      <BarraWord editorRef={editorRef} />
      </div>
      <div className="dw-hoja-wrap">
        <div ref={editorRef} className="dw-hoja" contentEditable suppressContentEditableWarning spellCheck
          style={{ width: papelInfo(papel).ancho, minHeight: papelInfo(papel).alto }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Usar con un paciente: datos llenados → revisar → imprimir / PDF / Word / expediente
   ══════════════════════════════════════════════════════════════════════════ */
function GenerarDocumento({ doc, pacienteInicial, onCerrar }) {
  const hojaRef = useRef(null);
  const [paciente, setPaciente] = useState(pacienteInicial);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [valores, setValores] = useState(null);
  const [trabajando, setTrabajando] = useState("");
  const [aviso, setAviso] = useState(null);
  const papel = doc.papel || "LETTER";

  // Buscar pacientes
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2 || paciente) return;
    let vivo = true;
    const t = setTimeout(() => {
      api.get("/pacientes", { params: { q } }).then((r) => { if (vivo) setResultados((r.data.data || []).slice(0, 8)); }).catch(() => {});
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [busqueda, paciente]);

  // Datos del paciente (y del médico/clínica/fecha) → documento llenado
  useEffect(() => {
    let vivo = true;
    api.get("/documentos-word/contexto", { params: paciente ? { paciente_id: paciente.id } : {} })
      .then((r) => { if (vivo) setValores(r.data.data || {}); })
      .catch(() => { if (vivo) setValores({}); });
    return () => { vivo = false; };
  }, [paciente]);

  useEffect(() => {
    if (!hojaRef.current || !valores) return;
    hojaRef.current.innerHTML = llenarDatos(doc.contenido, valores);
  }, [valores, doc.contenido]);

  const usados = datosUsados(doc.contenido);
  const sinValor = valores ? usados.filter((k) => !(valores[k] && String(valores[k]).trim())) : [];
  const nombreBase = `${doc.nombre}${paciente ? ` - ${paciente.nombres} ${paciente.apellidos}` : ""}`;
  const htmlFinal = () => normalizarBloques(hojaRef.current?.innerHTML || "");

  const pdfBlob = async () => {
    const r = await api.post("/documentos/generar-pdf", {
      html: paginaCompleta(htmlFinal(), papel, nombreBase), paper_size: papel, nombre_archivo: nombreArchivo(nombreBase),
    }, { responseType: "blob" });
    return new Blob([r.data], { type: "application/pdf" });
  };

  const accion = async (tipo) => {
    setAviso(null);
    if (tipo === "imprimir") {
      const w = window.open("", "_blank");
      if (!w) { setAviso({ t: "danger", m: "El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para medickg.com." }); return; }
      w.document.write(paginaCompleta(htmlFinal(), papel, nombreBase)); w.document.close();
      w.focus(); setTimeout(() => w.print(), 400);
      return;
    }
    setTrabajando(tipo);
    try {
      if (tipo === "pdf") descargarBlob(await pdfBlob(), `${nombreArchivo(nombreBase)}.pdf`);
      if (tipo === "word") {
        const r = await api.post("/documentos-word/exportar-docx", { html: htmlFinal(), nombre: nombreBase, papel }, { responseType: "blob" });
        descargarBlob(new Blob([r.data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `${nombreArchivo(nombreBase)}.docx`);
      }
      if (tipo === "expediente") {
        const blob = await pdfBlob();
        const fd = new FormData();
        fd.append("archivo", new File([blob], `${nombreArchivo(nombreBase)}.pdf`, { type: "application/pdf" }));
        fd.append("tipo", doc.categoria === "consentimiento" ? "consentimiento" : "otro");
        fd.append("descripcion", doc.nombre);
        await api.post(`/pacientes/${paciente.id}/documentos`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        setAviso({ t: "success", m: `Guardado en el expediente de ${paciente.nombres} ${paciente.apellidos} (pestaña Documentos).` });
      }
    } catch (e) {
      let m = "No se pudo completar la acción.";
      try { const txt = await e.response?.data?.text?.(); m = JSON.parse(txt).msg || m; } catch { m = e.response?.data?.msg || m; }
      setAviso({ t: "danger", m });
    } finally { setTrabajando(""); }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #dbe4ef", overflow: "clip" }}>
      <style>{CSS}</style>
      <div className="dw-fijo">
      <div style={{ padding: "12px 14px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
        <button className="btn btn-sm btn-light" onClick={onCerrar} title="Volver"><i className="bi bi-arrow-left" /></button>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontWeight: 700 }} className="text-truncate">{doc.nombre}</div>
          <div style={{ fontSize: ".76rem", color: "#64748b" }}>Revisa el documento: puedes corregir cualquier texto antes de imprimir</div>
        </div>
        <BotonAccion t="imprimir" i="bi-printer" txt="Imprimir" trabajando={trabajando} onAccion={accion} />
        <BotonAccion t="pdf" i="bi-file-earmark-pdf" txt="PDF" trabajando={trabajando} onAccion={accion} />
        <BotonAccion t="word" i="bi-file-earmark-word" txt="Word" trabajando={trabajando} onAccion={accion} />
        <BotonAccion t="expediente" i="bi-folder-plus" txt="Guardar en expediente" cls="btn-success" disabled={!paciente} trabajando={trabajando} onAccion={accion} />
      </div>
      <BarraWord editorRef={hojaRef} conDatos={false} />
      </div>

      {/* Paciente */}
      <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "relative" }}>
        {paciente ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <i className="bi bi-person-check-fill" style={{ color: "#16a34a", fontSize: 18 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{paciente.nombres} {paciente.apellidos}</strong>
              <span style={{ color: "#64748b", fontSize: ".8rem" }}>{paciente.dni ? ` · DNI ${paciente.dni}` : ""}</span>
            </div>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setPaciente(null); setBusqueda(""); }}>Cambiar paciente</button>
          </div>
        ) : (
          <>
            <label className="form-label small fw-semibold mb-1">Paciente (sus datos se llenan solos)</label>
            <input className="form-control" placeholder="Buscar por nombre, DNI o teléfono…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoFocus data-sin-dictado />
            {resultados.length > 0 && busqueda.trim().length >= 2 && (
              <div className="dw-menu" style={{ left: 14, right: 14, width: "auto", top: "100%" }}>
                {resultados.map((p) => (
                  <button key={p.id} onClick={() => { setPaciente(p); setResultados([]); }}>
                    <strong>{p.nombres} {p.apellidos}</strong>
                    <span style={{ color: "#64748b", fontSize: 12 }}>{p.dni ? ` · ${p.dni}` : ""}{p.edad != null ? ` · ${p.edad} años` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {aviso && <div className={`alert alert-${aviso.t} m-2 py-2`}>{aviso.m}</div>}
      {paciente && sinValor.length > 0 && (
        <div className="alert alert-warning m-2 py-2 small">
          <i className="bi bi-exclamation-triangle me-1" />Sin dato registrado: <strong>{sinValor.map((k) => NOMBRE_VARIABLE[k] || k).join(", ")}</strong>. Quedó una línea "________" para completarlo a mano aquí abajo.
        </div>
      )}

      <div className="dw-hoja-wrap">
        {!valores && <div className="text-center text-muted py-4"><span className="spinner-border spinner-border-sm me-2" />Llenando datos…</div>}
        <div ref={hojaRef} className="dw-hoja" contentEditable suppressContentEditableWarning spellCheck
          style={{ width: papelInfo(papel).ancho, minHeight: papelInfo(papel).alto, display: valores ? "block" : "none" }} />
      </div>
    </div>
  );
}
