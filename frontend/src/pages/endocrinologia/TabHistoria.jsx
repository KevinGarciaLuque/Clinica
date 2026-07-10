import { useState } from "react";
import dayjs from "dayjs";
import { card, inputStyle, label, btn, ORANGE, ORANGE_LIGHT, CIRCUNSTANCIAS, AUTOANTICUERPOS, ANTECEDENTES_PATOLOGICOS, ANTECEDENTES_FAMILIARES, PARENTESCO_OPTIONS, QUICK_PHRASES } from "./shared";

const HABITOS_DEF = [
  { key: "tabaquismo", titulo: "Tabaquismo", opciones: ["NO", "SI", "EXPOSICION_PASIVA"] },
  { key: "alcohol", titulo: "Consumo de alcohol", opciones: ["NO", "SI"] },
  { key: "drogas", titulo: "Consumo de drogas", opciones: ["NO", "SI"] },
];
const HABITO_OPCION_LABEL = { NO: "No", SI: "Sí", EXPOSICION_PASIVA: "Exposición pasiva" };

const pill = { ...btn(ORANGE, true), padding: "3px 10px", fontSize: 11, borderRadius: 999 };

function QuickPhrases({ campo, valor, onChange, modo = "reemplazar" }) {
  const frases = QUICK_PHRASES[campo];
  if (!frases) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {frases.map(frase => (
        <button key={frase} type="button" style={pill}
          onClick={() => onChange(modo === "agregar" && valor ? `${valor}. ${frase}` : frase)}>
          {frase}
        </button>
      ))}
    </div>
  );
}

// Historia Clínica (Secciones I y II del PDF) — reutilizado tanto en la página
// completa de Control de Seguimiento como en el tab "Historia Clínica" del
// perfil del paciente.
export default function TabHistoria({ paciente, formHistoria: f, setFormHistoria: setF, guardando, guardarHistoria, esPrimeraConsulta }) {
  const [expandido, setExpandido] = useState("datos_personales");
  const upd = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const updNested = (k, sk, v) => setF(prev => ({ ...prev, [k]: { ...prev[k], [sk]: v } }));
  const edad = paciente?.fecha_nacimiento ? dayjs().diff(paciente.fecha_nacimiento, "year") : null;
  const procedencia = [paciente?.departamento, paciente?.ciudad].filter(Boolean).join(", ");

  const toggleFamiliarSlug = (slug, checked) => {
    setF(prev => {
      const actual = prev.antecedentes_familiares[slug] || { valor: false, familiares: [] };
      const familiares = checked ? (actual.familiares?.length ? actual.familiares : [{ parentesco: "", parentesco_otro: "" }]) : [];
      return { ...prev, antecedentes_familiares: { ...prev.antecedentes_familiares, [slug]: { valor: checked, familiares } } };
    });
  };
  const addFamiliar = (slug) => {
    setF(prev => {
      const actual = prev.antecedentes_familiares[slug] || { valor: true, familiares: [] };
      return { ...prev, antecedentes_familiares: { ...prev.antecedentes_familiares, [slug]: { ...actual, familiares: [...(actual.familiares || []), { parentesco: "", parentesco_otro: "" }] } } };
    });
  };
  const removeFamiliar = (slug, idx) => {
    setF(prev => {
      const actual = prev.antecedentes_familiares[slug];
      if (!actual) return prev;
      return { ...prev, antecedentes_familiares: { ...prev.antecedentes_familiares, [slug]: { ...actual, familiares: actual.familiares.filter((_, i) => i !== idx) } } };
    });
  };
  const updateFamiliar = (slug, idx, campo, valor) => {
    setF(prev => {
      const actual = prev.antecedentes_familiares[slug];
      if (!actual) return prev;
      const familiares = actual.familiares.map((fam, i) => i === idx ? { ...fam, [campo]: valor } : fam);
      return { ...prev, antecedentes_familiares: { ...prev.antecedentes_familiares, [slug]: { ...actual, familiares } } };
    });
  };

  const toggleAutoanticuerpoExclusivo = (campo, checked) => {
    setF(prev => {
      if (!checked) return { ...prev, autoanticuerpos: { ...prev.autoanticuerpos, [campo]: false } };
      // Marcar N/A o No realizados limpia y deshabilita los anticuerpos individuales.
      const limpios = Object.fromEntries(AUTOANTICUERPOS.map(([k]) => [k, { valor: false, comentario: "" }]));
      return {
        ...prev,
        autoanticuerpos: {
          ...prev.autoanticuerpos, ...limpios,
          na: campo === "na", no_realizados: campo === "no_realizados",
          otro: { ...prev.autoanticuerpos.otro, activo: false },
        },
      };
    });
  };

  const setMenarquia = (val) => {
    setF(prev => {
      const g = { ...prev.gineco_obstetricos, menarquia_presento: val };
      // Premenárquica implica sin antecedentes obstétricos — se fuerza y bloquea ese toggle.
      if (val === "NO") g.obstetrico = { tiene_antecedentes: "NO", g: "0", p: "0", a: "0", c: "0", complicaciones_detalle: "" };
      return { ...prev, gineco_obstetricos: g };
    });
  };
  const setObstetricoTiene = (val) => {
    setF(prev => {
      const o = { ...prev.gineco_obstetricos.obstetrico, tiene_antecedentes: val };
      if (val === "NO") { o.g = "0"; o.p = "0"; o.a = "0"; o.c = "0"; o.complicaciones_detalle = ""; }
      return { ...prev, gineco_obstetricos: { ...prev.gineco_obstetricos, obstetrico: o } };
    });
  };
  const updGineco = (sk, v) => setF(prev => ({ ...prev, gineco_obstetricos: { ...prev.gineco_obstetricos, [sk]: v } }));
  const updGinecoSub = (grupo, sk, v) => setF(prev => ({ ...prev, gineco_obstetricos: { ...prev.gineco_obstetricos, [grupo]: { ...prev.gineco_obstetricos[grupo], [sk]: v } } }));

  const setAntecedentesEstado = (estado) => {
    setF(prev => {
      const next = { ...prev, antecedentes_patologicos_estado: estado };
      if (estado === "SIN_ANTECEDENTES") {
        next.antecedentes_patologicos = Object.fromEntries(
          ANTECEDENTES_PATOLOGICOS.map(([k]) => [k, { valor: false, comentario: "" }])
        );
      }
      return next;
    });
  };

  // ── Resúmenes de una línea (colapsado del acordeón + resumen clínico #9) ──
  const resumenDatosPersonales = `${paciente?.nombres || ""} ${paciente?.apellidos || ""} · Médico: ${f.medico || "—"}`.trim();
  const resumenDiabetes = f.fecha_diagnostico
    ? `Dx: ${dayjs(f.fecha_diagnostico).format("DD/MM/YYYY")}${f.edad_diagnostico ? ` (${f.edad_diagnostico} años)` : ""}`
    : "Sin registrar";
  const countPatologicos = Object.values(f.antecedentes_patologicos).filter(v => v?.valor).length;
  const resumenPatologicos = f.antecedentes_patologicos_estado === "SIN_ANTECEDENTES"
    ? "Sin antecedentes relevantes"
    : (countPatologicos > 0 ? `${countPatologicos} antecedente(s) registrado(s)` : "Sin registrar");
  const resumenHabitos = HABITOS_DEF.map(h => `${h.titulo.replace("Consumo de ", "")}: ${HABITO_OPCION_LABEL[f[h.key]] || "—"}`).join(" · ");
  const countFamiliares = Object.values(f.antecedentes_familiares).filter(v => v?.valor).reduce((acc, v) => acc + (v.familiares?.length || 0), 0);
  const resumenFamiliares = countFamiliares > 0 ? `${countFamiliares} antecedente(s) familiar(es)` : "Sin antecedentes familiares";
  const resumenGineco = f.gineco_obstetricos.menarquia_presento === "NO"
    ? "Premenárquica"
    : (f.gineco_obstetricos.menarquia_presento === "SI" ? `Menarquia a los ${f.gineco_obstetricos.menarquia_edad} años` : "Sin registrar");
  const resumenObstetrico = f.gineco_obstetricos.obstetrico.tiene_antecedentes === "NO"
    ? "Sin antecedentes obstétricos"
    : (f.gineco_obstetricos.obstetrico.tiene_antecedentes === "SI"
      ? `G${f.gineco_obstetricos.obstetrico.g || 0}P${f.gineco_obstetricos.obstetrico.p || 0}A${f.gineco_obstetricos.obstetrico.a || 0}C${f.gineco_obstetricos.obstetrico.c || 0}`
      : "Sin registrar");

  // ── Resumen clínico compacto (#9) ──
  const bulletsResumen = [];
  if (f.fecha_diagnostico) bulletsResumen.push(`Diagnóstico: ${dayjs(f.fecha_diagnostico).format("DD/MM/YYYY")}${f.edad_diagnostico ? ` a los ${f.edad_diagnostico} años` : ""}`);
  if (f.autoanticuerpos.na) bulletsResumen.push("Autoanticuerpos: N/A");
  else if (f.autoanticuerpos.no_realizados) bulletsResumen.push("Autoanticuerpos: no realizados");
  else {
    const positivos = AUTOANTICUERPOS.filter(([k]) => f.autoanticuerpos[k]?.valor).map(([, l]) => l);
    if (f.autoanticuerpos.otro.activo) positivos.push(`Otro (${f.autoanticuerpos.otro.nombre}${f.autoanticuerpos.otro.resultado ? `: ${f.autoanticuerpos.otro.resultado}` : ""})`);
    if (positivos.length) bulletsResumen.push(`Autoanticuerpos positivos: ${positivos.join(", ")}`);
  }
  const tratamientos = [];
  if (f.tratamiento_inicial.basal_bolo) tratamientos.push("Basal-bolo");
  if (f.tratamiento_inicial.bomba) tratamientos.push("Bomba de infusión");
  if (f.tratamiento_inicial.otro) tratamientos.push(f.tratamiento_inicial.otro);
  if (tratamientos.length) bulletsResumen.push(`Tratamiento inicial: ${tratamientos.join(", ")}`);
  const familiaresResumen = ANTECEDENTES_FAMILIARES
    .filter(([k]) => f.antecedentes_familiares[k]?.valor)
    .map(([k, l]) => {
      const nombres = (f.antecedentes_familiares[k].familiares || [])
        .map(fam => (fam.parentesco === "Otro" ? (fam.parentesco_otro || "Otro") : fam.parentesco))
        .filter(Boolean);
      return nombres.length ? `${l} (${nombres.join(", ")})` : l;
    });
  if (familiaresResumen.length) bulletsResumen.push(`Antecedentes familiares: ${familiaresResumen.join(", ")}`);
  if (paciente?.sexo === "F") {
    if (f.gineco_obstetricos.menarquia_presento === "NO") bulletsResumen.push("Estado gineco-obstétrico: premenárquica");
    else if (f.gineco_obstetricos.menarquia_presento === "SI") bulletsResumen.push(`Estado gineco-obstétrico: menarquia a los ${f.gineco_obstetricos.menarquia_edad} años`);
  }

  const SECCIONES_HISTORIA = [
    { key: "datos_personales", titulo: "I. Datos Personales", icon: "bi-person-badge", resumen: resumenDatosPersonales },
    { key: "diabetes", titulo: "II.1 Historia de Diabetes", icon: "bi-droplet-half", resumen: resumenDiabetes },
    { key: "patologicos", titulo: "Antecedentes Personales Patológicos", icon: "bi-clipboard2-pulse", resumen: resumenPatologicos },
    { key: "habitos", titulo: "Hábitos", icon: "bi-cup-straw", resumen: resumenHabitos },
    { key: "familiares", titulo: "Antecedentes Familiares Patológicos", icon: "bi-people", resumen: resumenFamiliares },
    // Solo aplica a pacientes femeninas
    ...(paciente?.sexo === "F" ? [
      { key: "gineco", titulo: "Antecedentes Ginecológicos", icon: "bi-gender-female", resumen: resumenGineco },
      { key: "obstetrico", titulo: "Antecedentes Obstétricos", icon: "bi-heart", resumen: resumenObstetrico },
    ] : []),
  ];

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

      {bulletsResumen.length > 0 && (
        <div style={{ ...card, background: ORANGE_LIGHT, border: `1px solid ${ORANGE}30` }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="bi bi-clipboard2-data" style={{ color: ORANGE }} /> Resumen clínico
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#374151", lineHeight: 1.7 }}>
            {bulletsResumen.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {SECCIONES_HISTORIA.map(({ key, titulo, icon, resumen }) => {
        const desplegada = expandido === key;
        return (
          <div key={key} style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer", background: desplegada ? ORANGE_LIGHT : "#fff" }}
              onClick={() => setExpandido(desplegada ? null : key)}>
              <i className={`bi ${icon}`} style={{ color: ORANGE }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{titulo}</span>
              {!desplegada && <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{resumen}</span>}
              {desplegada && <span style={{ flex: 1 }} />}
              <i className={`bi bi-chevron-${desplegada ? "up" : "down"}`} style={{ color: "#94a3b8" }} />
            </div>
            {desplegada && (
              <div style={{ padding: "14px 18px", borderTop: "1px solid #f1f5f9" }}>
                {key === "datos_personales" && (
                  <>
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
                      <div><span style={label}>Médico que refiere</span><input style={inputStyle} value={f.medico_refiere} onChange={e => upd("medico_refiere", e.target.value)} /></div>
                    </div>
                  </>
                )}

                {key === "diabetes" && (
                  <>
                    <div className="endo-grid-2">
                      <div><span style={label}>Fecha de diagnóstico</span><input type="date" style={inputStyle} value={f.fecha_diagnostico || ""} onChange={e => {
                        const fecha = e.target.value;
                        upd("fecha_diagnostico", fecha);
                        // Sugiere la edad al diagnóstico a partir de la fecha de nacimiento del paciente (editable)
                        if (fecha && paciente?.fecha_nacimiento) upd("edad_diagnostico", dayjs(fecha).diff(paciente.fecha_nacimiento, "year"));
                      }} /></div>
                      <div><span style={label}>Edad al diagnóstico {paciente?.fecha_nacimiento && <span style={{ fontWeight: 400, color: "#94a3b8" }}>(sugerida)</span>}</span><input type="number" style={inputStyle} value={f.edad_diagnostico} onChange={e => upd("edad_diagnostico", e.target.value)} /></div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <span style={label}>Circunstancias del diagnóstico</span>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13 }}>
                        {CIRCUNSTANCIAS.map(c => (
                          <label key={c.v} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            <input type="checkbox" checked={!!f.circunstancias_diagnostico[c.v]} onChange={e => updNested("circunstancias_diagnostico", c.v, e.target.checked)} />
                            {c.l}
                          </label>
                        ))}
                      </div>
                      {f.circunstancias_diagnostico.OTRO && (
                        <input style={{ ...inputStyle, marginTop: 8 }} placeholder="Especificar otro" value={f.circunstancia_otro} onChange={e => upd("circunstancia_otro", e.target.value)} />
                      )}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <span style={label}>Presencia de autoanticuerpos al diagnóstico</span>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, marginBottom: 8 }}>
                        {["na", "no_realizados"].map(k => (
                          <label key={k} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            <input type="checkbox" checked={!!f.autoanticuerpos[k]} onChange={e => toggleAutoanticuerpoExclusivo(k, e.target.checked)} />
                            {{ na: "N/A", no_realizados: "No realizados" }[k]}
                          </label>
                        ))}
                      </div>
                      {(() => {
                        const antibodiesDisabled = f.autoanticuerpos.na || f.autoanticuerpos.no_realizados;
                        return (
                          <>
                            <div className="endo-check-grid">
                              {AUTOANTICUERPOS.map(([k, l]) => {
                                const v = f.autoanticuerpos[k] || { valor: false, comentario: "" };
                                return (
                                  <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5, minWidth: 90 }}>
                                      <input type="checkbox" disabled={antibodiesDisabled} checked={!!v.valor}
                                        onChange={e => setF(prev => ({ ...prev, autoanticuerpos: { ...prev.autoanticuerpos, [k]: { ...v, valor: e.target.checked } } }))} /> {l}
                                    </label>
                                    {v.valor && <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12 }} placeholder="Valor" value={v.comentario}
                                      onChange={e => setF(prev => ({ ...prev, autoanticuerpos: { ...prev.autoanticuerpos, [k]: { ...v, comentario: e.target.value } } }))} />}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                              <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5 }}>
                                <input type="checkbox" disabled={antibodiesDisabled} checked={!!f.autoanticuerpos.otro.activo}
                                  onChange={e => updNested("autoanticuerpos", "otro", { ...f.autoanticuerpos.otro, activo: e.target.checked })} /> Otro
                              </label>
                              {f.autoanticuerpos.otro.activo && (
                                <>
                                  <input style={{ ...inputStyle, width: 150, padding: "5px 8px", fontSize: 12 }} placeholder="Nombre"
                                    value={f.autoanticuerpos.otro.nombre} onChange={e => updNested("autoanticuerpos", "otro", { ...f.autoanticuerpos.otro, nombre: e.target.value })} />
                                  <input style={{ ...inputStyle, width: 150, padding: "5px 8px", fontSize: 12 }} placeholder="Resultado"
                                    value={f.autoanticuerpos.otro.resultado} onChange={e => updNested("autoanticuerpos", "otro", { ...f.autoanticuerpos.otro, resultado: e.target.value })} />
                                </>
                              )}
                            </div>
                          </>
                        );
                      })()}
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
                  </>
                )}

                {key === "patologicos" && (
                  <>
                    <div style={{ display: "flex", gap: 14, marginBottom: 12, fontSize: 13 }}>
                      <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <input type="radio" name="antecedentes_estado" checked={f.antecedentes_patologicos_estado === "SIN_ANTECEDENTES"} onChange={() => setAntecedentesEstado("SIN_ANTECEDENTES")} />
                        Sin antecedentes relevantes
                      </label>
                      <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <input type="radio" name="antecedentes_estado" checked={f.antecedentes_patologicos_estado !== "SIN_ANTECEDENTES"} onChange={() => setAntecedentesEstado("PRESENTA")} />
                        Presenta antecedentes
                      </label>
                    </div>
                    {f.antecedentes_patologicos_estado === "SIN_ANTECEDENTES" ? (
                      <div style={{ fontSize: 13, color: "#64748b" }}>Sin antecedentes personales patológicos relevantes.</div>
                    ) : (
                      <>
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
                        <div style={{ marginTop: 10 }}>
                          <span style={label}>Otros</span>
                          <textarea style={{ ...inputStyle, minHeight: 50 }} value={f.antecedentes_otros} onChange={e => upd("antecedentes_otros", e.target.value)} />
                          <QuickPhrases campo="antecedentes_otros" valor={f.antecedentes_otros} modo="agregar" onChange={v => upd("antecedentes_otros", v)} />
                        </div>
                      </>
                    )}
                  </>
                )}

                {key === "habitos" && HABITOS_DEF.map(({ key: hk, titulo, opciones }, idx) => {
                  const valorActual = f[hk];
                  const muestraComentario = valorActual === "SI" || valorActual === "EXPOSICION_PASIVA";
                  return (
                    <div key={hk} className="endo-grid-2" style={{ alignItems: "start", marginBottom: idx === HABITOS_DEF.length - 1 ? 0 : undefined }}>
                      <div>
                        <span style={label}>{titulo}</span>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {opciones.map(op => (
                            <button key={op} type="button"
                              style={{ ...btn(ORANGE, valorActual !== op), padding: "6px 14px", fontSize: 12.5 }}
                              onClick={() => upd(hk, op)}>
                              {HABITO_OPCION_LABEL[op]}
                            </button>
                          ))}
                        </div>
                      </div>
                      {muestraComentario && (
                        <div>
                          <span style={label}>Comentario</span>
                          <input style={inputStyle} value={f[`${hk}_comentario`]} onChange={e => upd(`${hk}_comentario`, e.target.value)} />
                          <QuickPhrases campo={`${hk}_comentario`} valor={f[`${hk}_comentario`]} onChange={v => upd(`${hk}_comentario`, v)} />
                        </div>
                      )}
                    </div>
                  );
                })}

                {key === "familiares" && (
                  <div className="endo-check-grid">
                    {ANTECEDENTES_FAMILIARES.map(([k, l]) => {
                      const v = f.antecedentes_familiares[k] || { valor: false, familiares: [] };
                      return (
                        <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5, fontWeight: 600 }}>
                            <input type="checkbox" checked={!!v.valor} onChange={e => toggleFamiliarSlug(k, e.target.checked)} /> {l}
                          </label>
                          {v.valor && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 20 }}>
                              {(v.familiares || []).map((fam, idx) => (
                                <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <select style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, width: 150 }} value={fam.parentesco}
                                    onChange={e => updateFamiliar(k, idx, "parentesco", e.target.value)}>
                                    <option value="">—</option>
                                    {PARENTESCO_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                  {fam.parentesco === "Otro" && (
                                    <input style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, width: 120 }} placeholder="Especificar"
                                      value={fam.parentesco_otro} onChange={e => updateFamiliar(k, idx, "parentesco_otro", e.target.value)} />
                                  )}
                                  <button type="button" title="Quitar familiar" onClick={() => removeFamiliar(k, idx)}
                                    style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
                                </div>
                              ))}
                              <button type="button" style={{ ...pill, alignSelf: "flex-start" }} onClick={() => addFamiliar(k)}>
                                <i className="bi bi-plus" /> Agregar familiar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {key === "gineco" && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <span style={label}>¿Ha presentado menarquia?</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={{ ...btn(ORANGE, f.gineco_obstetricos.menarquia_presento !== "NO"), padding: "6px 14px", fontSize: 12.5 }}
                          onClick={() => setMenarquia("NO")}>No</button>
                        <button type="button" style={{ ...btn(ORANGE, f.gineco_obstetricos.menarquia_presento !== "SI"), padding: "6px 14px", fontSize: 12.5 }}
                          onClick={() => setMenarquia("SI")}>Sí</button>
                      </div>
                    </div>
                    {f.gineco_obstetricos.menarquia_presento === "NO" && (
                      <div style={{ fontSize: 13, color: "#64748b" }}>Estado: Premenárquica</div>
                    )}
                    {f.gineco_obstetricos.menarquia_presento === "SI" && (
                      <>
                        <div className="endo-grid-3">
                          <div><span style={label}>Edad de menarquia (años)</span><input style={inputStyle} value={f.gineco_obstetricos.menarquia_edad} onChange={e => updGineco("menarquia_edad", e.target.value)} /></div>
                          <div><span style={label}>FUM</span><input type="date" style={inputStyle} value={f.gineco_obstetricos.gineco.fum} onChange={e => updGinecoSub("gineco", "fum", e.target.value)} /></div>
                          <div><span style={label}>Ciclos</span><input style={inputStyle} value={f.gineco_obstetricos.gineco.ciclos} onChange={e => updGinecoSub("gineco", "ciclos", e.target.value)} /></div>
                        </div>
                        <div><span style={label}>Método de planificación</span><input style={inputStyle} value={f.gineco_obstetricos.gineco.planificacion_cual} onChange={e => updGinecoSub("gineco", "planificacion_cual", e.target.value)} /></div>
                      </>
                    )}
                    {!f.gineco_obstetricos.menarquia_presento && (
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>Selecciona una opción para continuar.</div>
                    )}
                  </>
                )}

                {key === "obstetrico" && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <span style={label}>¿Tiene antecedentes obstétricos?</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" disabled={f.gineco_obstetricos.menarquia_presento === "NO"}
                          style={{ ...btn(ORANGE, f.gineco_obstetricos.obstetrico.tiene_antecedentes !== "NO"), padding: "6px 14px", fontSize: 12.5, opacity: f.gineco_obstetricos.menarquia_presento === "NO" ? 0.5 : 1 }}
                          onClick={() => setObstetricoTiene("NO")}>No</button>
                        <button type="button" disabled={f.gineco_obstetricos.menarquia_presento === "NO"}
                          style={{ ...btn(ORANGE, f.gineco_obstetricos.obstetrico.tiene_antecedentes !== "SI"), padding: "6px 14px", fontSize: 12.5, opacity: f.gineco_obstetricos.menarquia_presento === "NO" ? 0.5 : 1 }}
                          onClick={() => setObstetricoTiene("SI")}>Sí</button>
                      </div>
                      {f.gineco_obstetricos.menarquia_presento === "NO" && (
                        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>Bloqueado: la paciente es premenárquica.</div>
                      )}
                    </div>
                    {f.gineco_obstetricos.obstetrico.tiene_antecedentes === "NO" && (
                      <div style={{ fontSize: 13, color: "#64748b" }}>Sin antecedentes obstétricos.</div>
                    )}
                    {f.gineco_obstetricos.obstetrico.tiene_antecedentes === "SI" && (
                      <>
                        <div className="endo-grid-3">
                          {["g", "p", "a", "c"].map(k => (
                            <div key={k}><span style={label}>{k.toUpperCase()}</span><input style={inputStyle} value={f.gineco_obstetricos.obstetrico[k]} onChange={e => updGinecoSub("obstetrico", k, e.target.value)} /></div>
                          ))}
                        </div>
                        <div><span style={label}>¿Complicaciones en embarazos previos?</span><input style={inputStyle} placeholder="Especificar" value={f.gineco_obstetricos.obstetrico.complicaciones_detalle} onChange={e => updGinecoSub("obstetrico", "complicaciones_detalle", e.target.value)} /></div>
                      </>
                    )}
                    {!f.gineco_obstetricos.obstetrico.tiene_antecedentes && (
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>Selecciona una opción para continuar.</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button style={btn()} disabled={guardando} onClick={guardarHistoria}>
        <i className={`bi ${esPrimeraConsulta ? "bi-arrow-right-circle" : "bi-save"}`} />
        {guardando ? "Guardando..." : (esPrimeraConsulta ? "Guardar historia e ir al primer seguimiento" : "Guardar Historia Clínica")}
      </button>
    </div>
  );
}
