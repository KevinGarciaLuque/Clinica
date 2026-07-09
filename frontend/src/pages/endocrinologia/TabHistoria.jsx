import dayjs from "dayjs";
import { card, inputStyle, label, btn, CIRCUNSTANCIAS, ANTECEDENTES_PATOLOGICOS, ANTECEDENTES_FAMILIARES } from "./shared";

// Historia Clínica (Secciones I y II del PDF) — reutilizado tanto en la página
// completa de Control de Seguimiento como en el tab "Historia Clínica" del
// perfil del paciente.
export default function TabHistoria({ paciente, formHistoria: f, setFormHistoria: setF, guardando, guardarHistoria }) {
  const upd = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const updNested = (k, sk, v) => setF(prev => ({ ...prev, [k]: { ...prev[k], [sk]: v } }));
  const edad = paciente?.fecha_nacimiento ? dayjs().diff(paciente.fecha_nacimiento, "year") : null;
  const procedencia = [paciente?.departamento, paciente?.ciudad].filter(Boolean).join(", ");

  return (
    <div>
      <style>{`
        .endo-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .endo-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .endo-check-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
        @media (max-width: 767px) {
          .endo-grid-2, .endo-grid-3 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>I. Datos Personales</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>Estos datos vienen del expediente del paciente — para corregirlos, edítalos en "Datos Generales".</div>
        <div className="endo-grid-3" style={{ marginBottom: 6 }}>
          <div><span style={label}>Nombre</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{paciente?.nombres} {paciente?.apellidos}</div></div>
          <div><span style={label}>Edad</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{edad !== null ? `${edad} años` : "—"}</div></div>
          <div><span style={label}>ID / DNI</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{paciente?.dni || "—"}</div></div>
          <div><span style={label}>Sexo</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{paciente?.sexo || "—"}</div></div>
          <div><span style={label}>Teléfono</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{paciente?.telefono || "—"}</div></div>
          <div><span style={label}>Dirección</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{paciente?.direccion || "—"}</div></div>
          <div><span style={label}>Religión</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{paciente?.religion || "—"}</div></div>
          <div><span style={label}>Procedencia</span><div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{procedencia || "—"}</div></div>
        </div>
        <div className="endo-grid-3" style={{ marginTop: 10 }}>
          <div><span style={label}>Médico tratante</span><input style={inputStyle} value={f.medico} onChange={e => upd("medico", e.target.value)} /></div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>II.1 Historia de Diabetes Tipo 1</div>
        <div className="endo-grid-3">
          <div><span style={label}>Fecha de diagnóstico</span><input type="date" style={inputStyle} value={f.fecha_diagnostico || ""} onChange={e => {
            const fecha = e.target.value;
            upd("fecha_diagnostico", fecha);
            // Sugiere la edad al diagnóstico a partir de la fecha de nacimiento del paciente (editable)
            if (fecha && paciente?.fecha_nacimiento) upd("edad_diagnostico", dayjs(fecha).diff(paciente.fecha_nacimiento, "year"));
          }} /></div>
          <div><span style={label}>Edad al diagnóstico {paciente?.fecha_nacimiento && <span style={{ fontWeight: 400, color: "#94a3b8" }}>(sugerida)</span>}</span><input type="number" style={inputStyle} value={f.edad_diagnostico} onChange={e => upd("edad_diagnostico", e.target.value)} /></div>
          <div>
            <span style={label}>Circunstancias del diagnóstico</span>
            <select style={inputStyle} value={f.circunstancia_diagnostico} onChange={e => upd("circunstancia_diagnostico", e.target.value)}>
              <option value="">—</option>
              {CIRCUNSTANCIAS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
        </div>
        {f.circunstancia_diagnostico === "OTRO" && (
          <div style={{ marginBottom: 12 }}><span style={label}>Especificar otro</span><input style={inputStyle} value={f.circunstancia_otro} onChange={e => upd("circunstancia_otro", e.target.value)} /></div>
        )}

        <div style={{ marginBottom: 10 }}>
          <span style={label}>Presencia de autoanticuerpos al diagnóstico</span>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
            {["na", "no_realizados", "anti_gad", "ia2", "znt8"].map(k => (
              <label key={k} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <input type="checkbox" checked={!!f.autoanticuerpos[k]} onChange={e => updNested("autoanticuerpos", k, e.target.checked)} />
                {{ na: "N/A", no_realizados: "No realizados", anti_gad: "Anti-GAD", ia2: "IA-2", znt8: "ZnT8" }[k]}
              </label>
            ))}
            <input style={{ ...inputStyle, width: 160 }} placeholder="Otro" value={f.autoanticuerpos.otro} onChange={e => updNested("autoanticuerpos", "otro", e.target.value)} />
          </div>
        </div>

        <div>
          <span style={label}>Tratamiento inicial (al diagnóstico)</span>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
            <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <input type="checkbox" checked={!!f.tratamiento_inicial.basal_bolo} onChange={e => updNested("tratamiento_inicial", "basal_bolo", e.target.checked)} /> Insulina basal-bolo
            </label>
            <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <input type="checkbox" checked={!!f.tratamiento_inicial.bomba} onChange={e => updNested("tratamiento_inicial", "bomba", e.target.checked)} /> Infusión continua (bomba)
            </label>
            <input style={{ ...inputStyle, width: 200 }} placeholder="Otro" value={f.tratamiento_inicial.otro} onChange={e => updNested("tratamiento_inicial", "otro", e.target.value)} />
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>Antecedentes Personales Patológicos</div>
        <div className="endo-check-grid">
          {ANTECEDENTES_PATOLOGICOS.map(([k, l]) => {
            const v = f.antecedentes_patologicos[k] || { valor: false, comentario: "" };
            return (
              <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5, minWidth: 150 }}>
                  <input type="checkbox" checked={!!v.valor} onChange={e => setF(prev => ({ ...prev, antecedentes_patologicos: { ...prev.antecedentes_patologicos, [k]: { ...v, valor: e.target.checked } } }))} /> {l}
                </label>
                {v.valor && <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} placeholder="Comentario" value={v.comentario}
                  onChange={e => setF(prev => ({ ...prev, antecedentes_patologicos: { ...prev.antecedentes_patologicos, [k]: { ...v, comentario: e.target.value } } }))} />}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10 }}><span style={label}>Otros</span><textarea style={{ ...inputStyle, minHeight: 50 }} value={f.antecedentes_otros} onChange={e => upd("antecedentes_otros", e.target.value)} /></div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>Hábitos</div>
        {[["tabaquismo", "Tabaquismo"], ["alcohol", "Consumo de alcohol"], ["drogas", "Consumo de drogas"]].map(([k, l]) => (
          <div key={k} className="endo-grid-2" style={{ alignItems: "center" }}>
            <div>
              <span style={label}>{l}</span>
              <div style={{ display: "flex", gap: 14 }}>
                <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input type="radio" name={k} checked={f[k] === "AFIRMA"} onChange={() => upd(k, "AFIRMA")} /> Afirma</label>
                <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}><input type="radio" name={k} checked={f[k] === "NIEGA"} onChange={() => upd(k, "NIEGA")} /> Niega</label>
              </div>
            </div>
            <div><span style={label}>Comentario</span><input style={inputStyle} value={f[`${k}_comentario`]} onChange={e => upd(`${k}_comentario`, e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>Antecedentes Familiares Patológicos</div>
        <div className="endo-check-grid">
          {ANTECEDENTES_FAMILIARES.map(([k, l]) => {
            const v = f.antecedentes_familiares[k] || { valor: false, parentesco: "" };
            return (
              <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5, minWidth: 150 }}>
                  <input type="checkbox" checked={!!v.valor} onChange={e => setF(prev => ({ ...prev, antecedentes_familiares: { ...prev.antecedentes_familiares, [k]: { ...v, valor: e.target.checked } } }))} /> {l}
                </label>
                {v.valor && <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} placeholder="Parentesco" value={v.parentesco}
                  onChange={e => setF(prev => ({ ...prev, antecedentes_familiares: { ...prev.antecedentes_familiares, [k]: { ...v, parentesco: e.target.value } } }))} />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "#1e293b" }}>Antecedentes Gineco-Obstétricos</div>
          <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={!!f.gineco_obstetricos.na} onChange={e => updNested("gineco_obstetricos", "na", e.target.checked)} /> N/A
          </label>
        </div>
        {!f.gineco_obstetricos.na && (
          <>
            <div className="endo-grid-3">
              <div><span style={label}>Menarquia (años)</span><input style={inputStyle} value={f.gineco_obstetricos.menarquia} onChange={e => updNested("gineco_obstetricos", "menarquia", e.target.value)} /></div>
              <div><span style={label}>FUM</span><input type="date" style={inputStyle} value={f.gineco_obstetricos.fum} onChange={e => updNested("gineco_obstetricos", "fum", e.target.value)} /></div>
              <div><span style={label}>Ciclos</span><input style={inputStyle} value={f.gineco_obstetricos.ciclos} onChange={e => updNested("gineco_obstetricos", "ciclos", e.target.value)} /></div>
            </div>
            <div className="endo-grid-3">
              {["g", "p", "a", "c"].map(k => (
                <div key={k}><span style={label}>{k.toUpperCase()}</span><input style={inputStyle} value={f.gineco_obstetricos[k]} onChange={e => updNested("gineco_obstetricos", k, e.target.value)} /></div>
              ))}
            </div>
            <div className="endo-grid-2">
              <div><span style={label}>¿Complicaciones en embarazos previos?</span><input style={inputStyle} placeholder="Especificar" value={f.gineco_obstetricos.complicaciones_detalle} onChange={e => updNested("gineco_obstetricos", "complicaciones_detalle", e.target.value)} /></div>
              <div><span style={label}>Método de planificación</span><input style={inputStyle} value={f.gineco_obstetricos.planificacion_cual} onChange={e => updNested("gineco_obstetricos", "planificacion_cual", e.target.value)} /></div>
            </div>
          </>
        )}
      </div>

      <button style={btn()} disabled={guardando} onClick={guardarHistoria}>
        <i className="bi bi-save" /> {guardando ? "Guardando..." : "Guardar Historia Clínica"}
      </button>
    </div>
  );
}
