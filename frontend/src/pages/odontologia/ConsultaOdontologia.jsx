import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import Odontograma from "./Odontograma";
import { proponerCambios, estable } from "./propuestasFirma.js";
import { precioSugerido, lineasCobro, dinero, sugerirProximaSesion } from "./presupuesto.js";
import ModalAgendarProximaCita from "../ConsultaMedica/ModalAgendarProximaCita";
import PresupuestoPrint from "./PresupuestoPrint.jsx";
import ModalCobroSesion from "./ModalCobroSesion.jsx";
import PrescripcionTab from "../ConsultaMedica/PrescripcionTab";
import {
  CONDITIONS, PROCEDIMIENTOS, DX_RAPIDOS, MATERIALES,
  SURFACE_LABEL, EXAMEN_CLINICO_GRUPOS, HIGIENE_DETALLE_CAMPOS, TODAS_LAS_PIEZAS,
  PLAN_FASES_DEFAULT
} from "./constantes_odontologia";

const Odontograma3D = lazy(() => import("./Odontograma3D"));

// ─── Paleta naranja odontología ───────────────────────────────────────────────
const COLOR = '#FF9800';
const COLOR_D = '#e65100';
const BG_LIGHT = '#fff7ed';
const BORDER = '#fed7aa';

// ─── Superficies neutras (el naranja queda solo como acento) ─────────────────
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const CARD = {
  background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14,
  boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 6px 18px -10px rgba(15,23,42,.12)',
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'odontograma', label: 'Odontograma',          icon: 'bi-grid-3x3-gap-fill' },
  { id: 'sesion',      label: 'Consulta',             icon: 'bi-clipboard2-pulse' },
  { id: 'plan',        label: 'Plan de Tratamiento',  icon: 'bi-list-check' },
  { id: 'receta',      label: 'Receta',               icon: 'bi-prescription2' },
  { id: 'historia',    label: 'Historia',             icon: 'bi-journal-medical' },
  { id: 'cuenta',      label: 'Estudios y Cuenta',    icon: 'bi-wallet2' },
];

// ─── Buscador CIE-10 ──────────────────────────────────────────────────────────
function BuscadorCIE({ value, desc, onChange, onClear, readOnly }) {
  const [q, setQ]         = useState('');
  const [lista, setLista] = useState([]);
  const [open, setOpen]   = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) { setLista([]); setOpen(false); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!q || q.length < 2) { setLista([]); return; }
    const t = setTimeout(() => {
      api.get('/historias/cie10/buscar', { params: { q } })
        .then(r => setLista(r.data.data || []))
        .catch(() => setLista([]));
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  if (readOnly) {
    return (
      <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }}>
        {value ? <><strong>{value}</strong> — {desc}</> : <span style={{ color: '#94a3b8' }}>Sin diagnóstico registrado</span>}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: BG_LIGHT, borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: COLOR_D }}>{value}</span>
          <span style={{ color: '#475569', flex: 1 }}>{desc}</span>
          <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: 0 }}>✕</button>
        </div>
      ) : (
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          placeholder="Buscar diagnóstico CIE-10..."
          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box' }}
        />
      )}
      {open && lista.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px #0002', maxHeight: 220, overflowY: 'auto' }}>
          {lista.map(it => (
            <div key={it.codigo} onClick={() => { onChange(it.codigo, it.descripcion); setQ(''); setLista([]); setOpen(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.background = BG_LIGHT}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span style={{ fontWeight: 700, color: COLOR, minWidth: 60 }}>{it.codigo}</span>
              <span style={{ color: '#334155' }}>{it.descripcion}</span>
            </div>
          ))}
        </div>
      )}
      {/* Accesos rápidos CIE-10 odontológicos */}
      {!value && (
        <div style={{ marginTop: 8 }}>
          {DX_RAPIDOS.map(g => (
            <div key={g.grupo} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3, fontWeight: 600 }}>{g.grupo}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {g.items.map(it => (
                  <button key={it.c}
                    onClick={() => onChange(it.c, it.d)}
                    title={it.d}
                    style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, border: `1px solid ${g.color}44`, background: `${g.color}11`, color: g.color, cursor: 'pointer', fontWeight: 600 }}>
                    {it.c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Estado inicial sesión ────────────────────────────────────────────────────
const initExploracionClinica = () => ({
  ...Object.fromEntries(EXAMEN_CLINICO_GRUPOS.map(g => [g.key, ''])),
  higiene_detalle: Object.fromEntries(HIGIENE_DETALLE_CAMPOS.map(c => [c.key, ''])),
});

const initSesion = () => ({
  motivo_consulta: '',
  exploracion_clinica: initExploracionClinica(),
  hallazgos: [],
  procedimientos: [],
  diagnostico_cie: '', diagnostico_desc: '',
  indicaciones: '', proxima_cita: '', observaciones: '',
});

const initHistoria = () => ({
  motivo_consulta_inicial: '', fecha_ultima_consulta: '', complicaciones_previas: '',
  antecedentes: [], medicamentos: [],
  frecuencia_cepillado: '', usa_hilo_dental: false, usa_enjuague: false, habitos_nocivos: '',
  diabetes: false, hipertension: false, anticoagulantes: false,
  alergia_anestesia: false, alergia_latex: false, otras_condiciones: '',
  ortodoncia_previa: false, extracciones_previas: '', implantes_previos: false,
  protesis_actual: '', tratamientos_previos: '', historia_familiar: '', notas: '',
  declaracion_veraz: false, firma_paciente_nombre: '',
});

const initPlan = () => ({
  fases: PLAN_FASES_DEFAULT(),
  vigencia_dias: 90,
  formas_pago: 'Efectivo, Tarjeta, Transferencia',
  nota_clinica: 'El plan puede variar si se detectan condiciones internas no visibles radiográficamente.',
});

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ConsultaOdontologia() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const pacienteId  = sp.get('paciente_id');
  const citaId      = sp.get('cita_id');

  const [tab, setTab]               = useState('odontograma');
  const [paciente, setPaciente]     = useState(null);
  const [resumen, setResumen]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState(null);

  // Odontograma
  const [odontograma, setOdontograma] = useState({});
  const [odoGuardado, setOdoGuardado] = useState(false);
  const [odoView, setOdoView]         = useState('2d'); // '2d' | '3d'

  // Sesiones
  const [sesiones, setSesiones]       = useState([]);
  const [sesionActual, setSesionActual] = useState(null);
  const [sesionForm, setSesionForm]   = useState(initSesion());
  const [verSesionId, setVerSesionId] = useState(null);

  // Historia
  const [historia, setHistoria]       = useState(initHistoria());
  const [historiaGuardada, setHistoriaGuardada] = useState(false);
  const [catalogoCondiciones, setCatalogoCondiciones] = useState([]);
  const [sinHistoria, setSinHistoria] = useState(false);

  // Revisión previa a la firma (Fase 2) y control de cambios sin guardar
  const [revisionFirma, setRevisionFirma] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [cobro, setCobro] = useState(null);            // { sesion, lineas }
  const [verPresupuesto, setVerPresupuesto] = useState(false);
  const [verVersiones, setVerVersiones] = useState(false);
  const puedeCobrar = ['MEDICO', 'ADMIN', 'SUPER_ADMIN'].includes(user?.tipo);
  const [agendar, setAgendar] = useState(false);
  const [addendas, setAddendas] = useState([]);
  const [nuevaNota, setNuevaNota] = useState('');
  const odoGuardadoRef  = useRef('');
  const planGuardadoRef = useRef('');

  // Plan
  const [plan, setPlan]               = useState(initPlan());
  const [planGuardado, setPlanGuardado] = useState(false);

  // Estudios complementarios + estado de cuenta
  const [estudios, setEstudios]       = useState([]);
  const [facturas, setFacturas]       = useState([]);
  const [showFormEstudio, setShowFormEstudio] = useState(false);
  const [formEstudio, setFormEstudio] = useState({ tipo: 'LABORATORIO', descripcion: '' });

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pacienteId) loadAll(pacienteId);
  }, [pacienteId]);

  async function loadAll(pid) {
    setLoading(true);
    try {
      const [rPac, rOdo, rHist, rPlan, rRes, rSes, rCond, rEst, rFact, rServ] = await Promise.all([
        api.get(`/pacientes/${pid}`),
        api.get(`/odontologia/odontograma/${pid}`),
        api.get(`/odontologia/historia/${pid}`),
        api.get(`/odontologia/plan/${pid}`),
        api.get(`/odontologia/resumen/${pid}`),
        api.get('/odontologia/sesiones', { params: { paciente_id: pid, limit: 30 } }),
        api.get('/catalogos-condiciones-medicas'),
        api.get('/estudios', { params: { paciente_id: pid } }),
        api.get('/facturacion', { params: { paciente_id: pid } }),
        api.get('/servicios').catch(() => ({ data: { data: [] } })), // el catálogo es opcional
      ]);
      setServicios(rServ.data.data || []);
      setPaciente(rPac.data.data || rPac.data);
      setCatalogoCondiciones(rCond.data.data || []);
      setEstudios(rEst.data.data || []);
      setFacturas(rFact.data.data || []);
      if (rOdo.data.data?.dientes) {
        const d = rOdo.data.data.dientes;
        const odo = typeof d === 'string' ? JSON.parse(d) : d;
        setOdontograma(odo);
        odoGuardadoRef.current = estable(odo);
      } else {
        odoGuardadoRef.current = estable({});
      }
      setSinHistoria(!rHist.data.data);
      if (rHist.data.data) {
        const h = rHist.data.data;
        const hSinNulos = Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v === null ? '' : v]));
        const antecedentes = typeof h.antecedentes === 'string' ? JSON.parse(h.antecedentes || '[]') : (h.antecedentes || []);
        const medicamentos = typeof h.medicamentos === 'string' ? JSON.parse(h.medicamentos || '[]') : (h.medicamentos || []);
        setHistoria({
          ...initHistoria(), ...hSinNulos,
          fecha_ultima_consulta: h.fecha_ultima_consulta ? String(h.fecha_ultima_consulta).slice(0, 10) : '',
          antecedentes, medicamentos,
        });
      }
      if (rPlan.data.data) {
        const p = rPlan.data.data;
        const fases = typeof p.fases === 'string' ? JSON.parse(p.fases || 'null') : p.fases;
        if (Array.isArray(fases) && fases.length > 0) planGuardadoRef.current = estable(fases);
        setPlan({
          fases: (Array.isArray(fases) && fases.length > 0) ? fases : PLAN_FASES_DEFAULT(),
          vigencia_dias: p.vigencia_dias || 90,
          formas_pago: p.formas_pago || 'Efectivo, Tarjeta, Transferencia',
          nota_clinica: p.nota_clinica || initPlan().nota_clinica,
        });
      }
      if (rRes.data.data) setResumen(rRes.data.data);
      if (rSes.data.data) setSesiones(rSes.data.data);
    } catch (e) {
      showMsg('error', 'Error al cargar datos del paciente');
    } finally {
      setLoading(false);
    }
  }

  function showMsg(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  // ── Guardar odontograma ──────────────────────────────────────────────────────
  async function guardarOdontograma() {
    if (!pacienteId) return;
    setSaving(true);
    try {
      await api.post(`/odontologia/odontograma/${pacienteId}`, { dientes: odontograma });
      odoGuardadoRef.current = estable(odontograma);
      setOdoGuardado(true);
      showMsg('ok', 'Odontograma guardado');
      setTimeout(() => setOdoGuardado(false), 3000);
    } catch { showMsg('error', 'Error al guardar odontograma'); }
    finally { setSaving(false); }
  }

  // ── Guardar / crear sesión ───────────────────────────────────────────────────
  async function guardarSesion() {
    if (!pacienteId) return;
    setSaving(true);
    try {
      const payload = { ...sesionForm, paciente_id: pacienteId, cita_id: citaId || null };
      if (sesionActual) {
        await api.put(`/odontologia/sesiones/${sesionActual.id}`, payload);
        showMsg('ok', 'Sesión actualizada');
      } else {
        const r = await api.post('/odontologia/sesiones', payload);
        setSesionActual(r.data.data);
        showMsg('ok', 'Sesión creada');
      }
      const r = await api.get('/odontologia/sesiones', { params: { paciente_id: pacienteId, limit: 30 } });
      setSesiones(r.data.data);
    } catch { showMsg('error', 'Error al guardar sesión'); }
    finally { setSaving(false); }
  }

  // Firmar en dos pasos: 1) se guarda lo escrito y se proponen cambios; 2) el dentista confirma
  async function abrirRevisionFirma() {
    if (!sesionActual) return;
    setSaving(true);
    try {
      // Se guarda primero lo escrito para no perderlo al quedar la sesión firmada
      await api.put(`/odontologia/sesiones/${sesionActual.id}`, { ...sesionForm, paciente_id: pacienteId });

      const propuestas = proponerCambios({ procedimientos: sesionForm.procedimientos || [], fases: plan.fases, odontograma });
      if (propuestas.odoProps.length && estable(odontograma) !== odoGuardadoRef.current) {
        showMsg('error', 'Guarda el odontograma antes de firmar: tiene cambios sin guardar.');
        return;
      }
      if (propuestas.planMatches.length && estable(plan.fases) !== planGuardadoRef.current) {
        showMsg('error', 'Guarda el plan de tratamiento antes de firmar: tiene cambios sin guardar.');
        return;
      }
      setRevisionFirma(propuestas);
    } catch (e) {
      showMsg('error', e.response?.data?.msg || 'No se pudo preparar la firma');
    } finally { setSaving(false); }
  }

  async function confirmarFirma(aplicar) {
    if (!sesionActual || !revisionFirma) return;
    setSaving(true);
    try {
      const planSel = aplicar
        ? revisionFirma.planMatches.filter(m => m.marcado).map(m => ({ fase_id: m.faseId, item_id: m.itemId }))
        : [];
      const odoSel = aplicar
        ? revisionFirma.odoProps.filter(m => m.marcado).map(({ pieza, tipo, condicion, superficies }) => ({ pieza, tipo, condicion, superficies }))
        : [];
      const r = await api.post(`/odontologia/sesiones/${sesionActual.id}/firmar`, { plan_items: planSel, odontograma: odoSel });
      setSesionActual(prev => ({ ...prev, estado: 'FIRMADA' }));
      setRevisionFirma(null);
      const ap = r.data?.aplicado || {};
      showMsg('ok', `Sesión firmada${ap.plan_items ? ` · ${ap.plan_items} ítem(s) del plan completado(s)` : ''}${ap.odontograma ? ` · ${ap.odontograma} cambio(s) en el odontograma` : ''}`);
      const rp = await api.get(`/odontologia/plan/${pacienteId}`).catch(() => null);
      const fasesFrescas = rp?.data?.data?.fases
        ? (typeof rp.data.data.fases === 'string' ? JSON.parse(rp.data.data.fases) : rp.data.data.fases)
        : plan.fases;
      await loadAll(pacienteId); // refleja plan, odontograma, resumen y lista de sesiones
      // Ofrece cobrar lo realizado (quien atiende decide; nunca se factura solo)
      if (puedeCobrar && (sesionForm.procedimientos || []).length > 0) {
        abrirCobro({ id: sesionActual.id, procedimientos: sesionForm.procedimientos }, fasesFrescas);
      }
    } catch (e) { showMsg('error', e.response?.data?.msg || 'Error al firmar'); }
    finally { setSaving(false); }
  }

  // ── Presupuesto imprimible: solo del plan ya guardado ───────────────────────
  function abrirPresupuesto() {
    if (estable(plan.fases) !== planGuardadoRef.current) {
      showMsg('error', 'Guarda el plan antes de imprimir el presupuesto.');
      return;
    }
    setVerPresupuesto(true);
  }

  // ── Cobro de la sesión (recibo con los procedimientos realizados) ────────────
  function abrirCobro(sesion, fases = plan.fases) {
    const lineas = lineasCobro({ sesion, fases, servicios });
    setCobro({ sesion, lineas });
  }

  async function cerrarCobro(facturaId) {
    const sesion = cobro?.sesion;
    setCobro(null);
    if (facturaId && sesion) {
      setSesionActual(prev => (prev && prev.id === sesion.id ? { ...prev, factura_id: facturaId } : prev));
      const r = await api.get('/odontologia/sesiones', { params: { paciente_id: pacienteId, limit: 30 } });
      setSesiones(r.data.data);
      showMsg('ok', 'Cobro registrado');
    }
  }

  // ── Notas posteriores a la firma (addendum): solo se agregan ─────────────────
  useEffect(() => {
    if (!sesionActual?.id || sesionActual.estado !== 'FIRMADA') { setAddendas([]); return; }
    let vivo = true;
    api.get(`/odontologia/sesiones/${sesionActual.id}/addendas`)
      .then(r => { if (vivo) setAddendas(r.data.data || []); })
      .catch(() => { if (vivo) setAddendas([]); });
    return () => { vivo = false; };
  }, [sesionActual?.id, sesionActual?.estado]);

  async function agregarAddendum() {
    const texto = nuevaNota.trim();
    if (texto.length < 3 || !sesionActual) return;
    setSaving(true);
    try {
      await api.post(`/odontologia/sesiones/${sesionActual.id}/addendas`, { texto });
      const r = await api.get(`/odontologia/sesiones/${sesionActual.id}/addendas`);
      setAddendas(r.data.data || []);
      setNuevaNota('');
      showMsg('ok', 'Nota agregada a la sesión');
    } catch (e) { showMsg('error', e.response?.data?.msg || 'No se pudo agregar la nota'); }
    finally { setSaving(false); }
  }

  function nuevaSesion() {
    setSesionActual(null);
    setSesionForm(initSesion());
  }

  function cargarSesion(s) {
    setSesionActual(s);
    const ec = typeof s.exploracion_clinica === 'string'
      ? JSON.parse(s.exploracion_clinica || '{}')
      : (s.exploracion_clinica || {});
    setSesionForm({
      motivo_consulta:    s.motivo_consulta || '',
      exploracion_clinica: {
        ...initExploracionClinica(),
        ...ec,
        higiene_detalle: { ...initExploracionClinica().higiene_detalle, ...(ec.higiene_detalle || {}) },
      },
      hallazgos:          typeof s.hallazgos === 'string'
        ? JSON.parse(s.hallazgos || '[]')
        : (s.hallazgos || []),
      procedimientos:     typeof s.procedimientos === 'string'
        ? JSON.parse(s.procedimientos || '[]')
        : (s.procedimientos || []),
      diagnostico_cie:    s.diagnostico_cie || '',
      diagnostico_desc:   s.diagnostico_desc || '',
      indicaciones:       s.indicaciones || '',
      proxima_cita:       s.proxima_cita || '',
      observaciones:      s.observaciones || '',
    });
  }

  // ── Historia odontológica ────────────────────────────────────────────────────
  async function guardarHistoria() {
    if (!pacienteId) return;
    setSaving(true);
    try {
      await api.post(`/odontologia/historia/${pacienteId}`, historia);
      setHistoriaGuardada(true);
      setSinHistoria(false);
      showMsg('ok', 'Historia guardada');
      setTimeout(() => setHistoriaGuardada(false), 3000);
    } catch { showMsg('error', 'Error al guardar historia'); }
    finally { setSaving(false); }
  }

  // ── Anamnesis: antecedentes dinámicos (HC-02) ────────────────────────────────
  function getAntecedente(condicionId) {
    return historia.antecedentes?.find(a => a.condicion_id === condicionId) || null;
  }

  function setAntecedente(cond, patch) {
    setHistoria(h => {
      const existentes = h.antecedentes || [];
      const idx = existentes.findIndex(a => a.condicion_id === cond.id);
      const base = idx >= 0 ? existentes[idx] : { condicion_id: cond.id, nombre: cond.nombre, respuesta: 'NO', especifique: '' };
      const actualizado = { ...base, ...patch };
      const nuevos = idx >= 0
        ? existentes.map((a, i) => i === idx ? actualizado : a)
        : [...existentes, actualizado];
      return { ...h, antecedentes: nuevos };
    });
  }

  const [nuevoMed, setNuevoMed] = useState({ nombre: '', dosis: '', motivo: '' });

  function agregarMedicamento() {
    if (!nuevoMed.nombre) return;
    setHistoria(h => ({ ...h, medicamentos: [...(h.medicamentos || []), { ...nuevoMed, id: Date.now() }] }));
    setNuevoMed({ nombre: '', dosis: '', motivo: '' });
  }

  function eliminarMedicamento(id) {
    setHistoria(h => ({ ...h, medicamentos: (h.medicamentos || []).filter(m => m.id !== id) }));
  }

  // ── Plan de tratamiento por fases ────────────────────────────────────────────
  async function guardarPlan() {
    if (!pacienteId) return;
    setSaving(true);
    try {
      await api.post(`/odontologia/plan/${pacienteId}`, plan);
      planGuardadoRef.current = estable(plan.fases);
      setPlanGuardado(true);
      showMsg('ok', 'Plan guardado');
      setTimeout(() => setPlanGuardado(false), 3000);
    } catch { showMsg('error', 'Error al guardar plan'); }
    finally { setSaving(false); }
  }

  const [nuevoItemFase, setNuevoItemFase] = useState({});
  const draftItemFase = (faseId) => nuevoItemFase[faseId] || { pieza: '', procedimiento: '', material: '', costo_estimado: '' };

  function setDraftItemFase(faseId, patch) {
    setNuevoItemFase(d => ({ ...d, [faseId]: { ...draftItemFase(faseId), ...patch } }));
  }

  function agregarItemFase(faseId) {
    const draft = draftItemFase(faseId);
    if (!draft.procedimiento) return;
    setPlan(p => ({
      ...p,
      fases: p.fases.map(f => f.id === faseId
        ? { ...f, items: [...(f.items || []), { ...draft, id: Date.now(), completado: false }] }
        : f),
    }));
    setNuevoItemFase(d => ({ ...d, [faseId]: { pieza: '', procedimiento: '', material: '', costo_estimado: '' } }));
  }

  function toggleItemFase(faseId, itemId) {
    setPlan(p => ({
      ...p,
      fases: p.fases.map(f => f.id === faseId
        ? { ...f, items: f.items.map(it => it.id === itemId ? { ...it, completado: !it.completado } : it) }
        : f),
    }));
  }

  function eliminarItemFase(faseId, itemId) {
    setPlan(p => ({
      ...p,
      fases: p.fases.map(f => f.id === faseId ? { ...f, items: f.items.filter(it => it.id !== itemId) } : f),
    }));
  }

  function actualizarFaseCampo(faseId, campo, valor) {
    setPlan(p => ({ ...p, fases: p.fases.map(f => f.id === faseId ? { ...f, [campo]: valor } : f) }));
  }

  function agregarFase() {
    const n = plan.fases.length + 1;
    setPlan(p => ({
      ...p,
      fases: [...p.fases, { id: `fase_${Date.now()}`, nombre: `FASE ${n}: NUEVA FASE`, objetivo: '', items: [] }],
    }));
  }

  function eliminarFase(faseId) {
    setPlan(p => ({ ...p, fases: p.fases.filter(f => f.id !== faseId) }));
  }

  const subtotalFase = (fase) => (fase.items || []).reduce((s, i) => s + (parseFloat(i.costo_estimado) || 0), 0);
  const costoTotal = plan.fases.reduce((s, f) => s + subtotalFase(f), 0);

  // ── Estudios complementarios (módulo /api/estudios, sin duplicar) ───────────
  async function solicitarEstudio() {
    if (!formEstudio.descripcion || !pacienteId) return;
    setSaving(true);
    try {
      await api.post('/estudios', {
        paciente_id: pacienteId,
        tipo: formEstudio.tipo,
        descripcion: formEstudio.descripcion,
      });
      const r = await api.get('/estudios', { params: { paciente_id: pacienteId } });
      setEstudios(r.data.data || []);
      setShowFormEstudio(false);
      setFormEstudio({ tipo: 'LABORATORIO', descripcion: '' });
      showMsg('ok', 'Solicitud de estudio creada');
    } catch { showMsg('error', 'Error al solicitar estudio'); }
    finally { setSaving(false); }
  }

  async function verPdfEstudios() {
    try {
      const r = await api.get(`/estudios/pdf?paciente_id=${pacienteId}`, { responseType: 'blob' });
      window.open(URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' })), '_blank');
    } catch { showMsg('error', 'Error al generar PDF'); }
  }

  async function verPdfFactura(facturaId) {
    try {
      const r = await api.get(`/facturacion/${facturaId}/pdf`, { responseType: 'blob' });
      window.open(URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' })), '_blank');
    } catch { showMsg('error', 'Error al generar PDF'); }
  }

  // ── Hallazgos clínicos detallados (independiente de procedimientos) ─────────
  const [nuevoHallazgo, setNuevoHallazgo] = useState({ pieza: '', descripcion: '' });

  function agregarHallazgo() {
    if (!nuevoHallazgo.pieza || !nuevoHallazgo.descripcion) return;
    setSesionForm(f => ({ ...f, hallazgos: [...(f.hallazgos || []), { ...nuevoHallazgo, id: Date.now() }] }));
    setNuevoHallazgo({ pieza: '', descripcion: '' });
  }

  function eliminarHallazgo(id) {
    setSesionForm(f => ({ ...f, hallazgos: (f.hallazgos || []).filter(h => h.id !== id) }));
  }

  function prellenarHallazgosDesdeOdontograma() {
    const existentes = new Set((sesionForm.hallazgos || []).map(h => h.pieza));
    const nuevos = [];
    for (const pieza of TODAS_LAS_PIEZAS) {
      const key = String(pieza);
      if (existentes.has(key)) continue;
      const estado = odontograma[key];
      if (!estado) continue;
      if (estado.ausente) {
        nuevos.push({ id: Date.now() + Math.random(), pieza: key, descripcion: 'Ausente' });
        continue;
      }
      const problemas = ['v', 'p', 'm', 'd', 'o']
        .filter(s => estado[s] && estado[s] !== 'sano')
        .map(s => `${CONDITIONS[estado[s]]?.label || estado[s]} (${SURFACE_LABEL[s]})`);
      if (problemas.length) {
        nuevos.push({ id: Date.now() + Math.random(), pieza: key, descripcion: problemas.join(', ') });
      }
    }
    if (nuevos.length === 0) { showMsg('ok', 'No se detectaron piezas con hallazgos pendientes en el odontograma'); return; }
    setSesionForm(f => ({ ...f, hallazgos: [...(f.hallazgos || []), ...nuevos] }));
    showMsg('ok', `${nuevos.length} hallazgo(s) prellenado(s) desde el odontograma`);
  }

  // ── Agregar procedimiento a la sesión ────────────────────────────────────────
  const [nuevoProc, setNuevoProc] = useState({ diente: '', superficie: '', procedimiento: '', material: '', observacion: '' });

  function agregarProcSesion() {
    if (!nuevoProc.procedimiento) return;
    setSesionForm(f => ({ ...f, procedimientos: [...f.procedimientos, { ...nuevoProc, id: Date.now() }] }));
    setNuevoProc({ diente: '', superficie: '', procedimiento: '', material: '', observacion: '' });
  }

  function eliminarProcSesion(id) {
    setSesionForm(f => ({ ...f, procedimientos: f.procedimientos.filter(p => p.id !== id) }));
  }

  const readOnly = sesionActual?.estado === 'FIRMADA';

  // ── Alertas clínicas del paciente (se muestran en todas las pestañas) ────────
  // Salen de la historia ya registrada; nunca se completan solas.
  const alertas = (() => {
    const lista = [];
    const agregar = (label, nivel = 'alto') => {
      if (!lista.some(a => a.label.toLowerCase() === label.toLowerCase())) lista.push({ label, nivel });
    };
    if (historia.alergia_anestesia) agregar('Alergia a anestesia local');
    if (historia.alergia_latex)     agregar('Alergia al látex');
    if (historia.anticoagulantes)   agregar('Toma anticoagulantes');
    if (historia.diabetes)          agregar('Diabetes', 'medio');
    if (historia.hipertension)      agregar('Hipertensión', 'medio');
    // Condiciones del catálogo marcadas como "alerta" y respondidas SÍ (sin repetir las de arriba)
    const yaCubierto = (nombre) => /diabet|hipertens|anticoag|latex|látex|anest/i.test(nombre);
    for (const a of (historia.antecedentes || [])) {
      const cond = catalogoCondiciones.find(c => c.id === a.condicion_id);
      if (cond?.es_alerta && a.respuesta === 'SI' && !yaCubierto(cond.nombre)) {
        agregar(a.especifique ? `${cond.nombre}: ${a.especifique}` : cond.nombre);
      }
    }
    if ((historia.otras_condiciones || '').trim()) agregar(`Otras: ${historia.otras_condiciones.trim()}`, 'medio');
    const meds = (historia.medicamentos || []).length;
    if (meds > 0) agregar(`Medicación actual: ${meds}`, 'info');
    return lista;
  })();

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!pacienteId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🦷</div>
          <h3 style={{ color: COLOR_D, marginBottom: 8 }}>Consulta Odontológica</h3>
          <p style={{ color: '#64748b', marginBottom: 24 }}>
            Para iniciar una consulta, selecciona un paciente desde la sección de <strong>Pacientes</strong> y haz clic en <strong>"Nueva Consulta"</strong>.
          </p>
          <a href="/pacientes" style={{ padding: '10px 24px', borderRadius: 8, background: COLOR, color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
            Ir a Pacientes
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Mensaje toast ── */}
      {msg && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999,
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: msg.type === 'ok' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'ok' ? '#166534' : '#991b1b',
          boxShadow: '0 4px 12px #0003',
        }}>
          <i className={`bi ${msg.type === 'ok' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`} />{msg.text}
        </div>
      )}

      {agendar && (
        <ModalAgendarProximaCita
          paciente={paciente} pacienteId={pacienteId}
          motivoSugerido={(sugerirProximaSesion(plan.fases)?.texto) || 'Control odontológico'}
          onClose={() => setAgendar(false)}
          onConfirm={(fechaHora) => {
            setAgendar(false);
            if (!readOnly) setSesionForm(f => ({ ...f, proxima_cita: `Agendada: ${dayjs(fechaHora).format('DD/MM/YYYY HH:mm')}` }));
            showMsg('ok', `Cita agendada para el ${dayjs(fechaHora).format('DD/MM/YYYY HH:mm')}`);
          }}
        />
      )}
      {verPresupuesto && (
        <PresupuestoPrint
          paciente={paciente} plan={plan}
          dentista={user ? (user.nombre_display || `${user.nombres || ''} ${user.apellidos || ''}`.trim()) : ''}
          clinicaId={user?.clinica_id} clinicaNombreInicial={user?.clinica_nombre || ''}
          onClose={() => setVerPresupuesto(false)}
        />
      )}
      {verVersiones && (
        <VersionesPlanModal
          pacienteId={pacienteId} onCerrar={() => setVerVersiones(false)}
          onUsar={(fases) => { setPlan(p => ({ ...p, fases })); setVerVersiones(false); showMsg('ok', 'Versión cargada en el editor. Pulsa "Guardar plan" para conservarla.'); }}
        />
      )}
      {cobro && (
        <ModalCobroSesion
          paciente={paciente} sesion={cobro.sesion} citaId={sesionActual?.cita_id || citaId}
          lineasIniciales={cobro.lineas} onCerrar={cerrarCobro}
          onFacturaFormal={() => { setCobro(null); navigate(`/facturacion?nueva=1&paciente_id=${pacienteId}${(sesionActual?.cita_id || citaId) ? `&cita_id=${sesionActual?.cita_id || citaId}` : ''}`); }}
        />
      )}
      {revisionFirma && (
        <RevisionFirmaModal
          datos={revisionFirma} setDatos={setRevisionFirma} saving={saving}
          onCancel={() => setRevisionFirma(null)} onConfirm={confirmarFirma}
        />
      )}

      {/* ── Header ── */}
      <div style={{ ...CARD, padding: '16px 20px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg, ${COLOR}, ${COLOR_D})`, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 17, letterSpacing: '.02em',
          }}>
            {paciente ? `${(paciente.nombre || '')[0] || ''}${(paciente.apellido || '')[0] || ''}`.toUpperCase() : <i className="bi bi-person" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: COLOR_D }}>
              Consulta odontológica
            </div>
            {paciente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: INK }}>{paciente.nombre} {paciente.apellido}</span>
                {paciente.fecha_nacimiento && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, background: '#f1f5f9', borderRadius: 999, padding: '2px 10px' }}>
                    {dayjs().diff(dayjs(paciente.fecha_nacimiento), 'year')} años
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resumen rápido */}
        {resumen && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Sesiones', val: resumen.total_sesiones, color: COLOR, icon: 'bi-journal-text' },
              { label: 'Firmadas', val: resumen.sesiones_firmadas, color: '#16a34a', icon: 'bi-patch-check' },
              { label: 'Pendientes plan', val: resumen.plan_pendientes, color: '#ef4444', icon: 'bi-hourglass-split' },
            ].map(st => (
              <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 12, background: '#f8fafc', border: `1px solid ${LINE}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${st.color}18`, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                  <i className={`bi ${st.icon}`} aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: INK, lineHeight: 1 }}>{st.val}</div>
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{st.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Alertas clínicas ── */}
      {!loading && pacienteId && (alertas.length > 0 || sinHistoria) && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16,
          padding: '10px 14px', borderRadius: 12,
          background: sinHistoria && alertas.length === 0 ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${sinHistoria && alertas.length === 0 ? '#fde68a' : '#fecaca'}`,
        }}>
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true"
             style={{ color: sinHistoria && alertas.length === 0 ? '#d97706' : '#dc2626', fontSize: 16 }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#7f1d1d' }}>
            {alertas.length > 0 ? 'Alertas del paciente' : 'Historia médica pendiente'}
          </span>
          {alertas.map(a => (
            <span key={a.label} style={{
              fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
              background: a.nivel === 'alto' ? '#dc2626' : a.nivel === 'medio' ? '#fff' : '#f1f5f9',
              color: a.nivel === 'alto' ? '#fff' : a.nivel === 'medio' ? '#b91c1c' : '#475569',
              border: a.nivel === 'medio' ? '1px solid #fca5a5' : '1px solid transparent',
            }}>{a.label}</span>
          ))}
          {sinHistoria && (
            <button onClick={() => setTab('historia')} style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, background: '#fff', color: COLOR_D, border: `1px solid ${BORDER}`,
            }}>
              {alertas.length > 0 ? 'Completar historia' : 'Registrar antecedentes antes de atender'}
            </button>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Cargando datos del paciente...</div>
      )}

      {!loading && (
        <>
          {/* ── Tabs ── */}
          <div role="tablist" style={{ ...CARD, display: 'flex', gap: 4, padding: 5, marginBottom: 18, flexWrap: 'wrap', borderRadius: 12 }}>
            {TABS.map(t => {
              const activa = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: activa ? 700 : 500, borderRadius: 9,
                    background: activa ? BG_LIGHT : 'transparent',
                    color: activa ? COLOR_D : MUTED,
                    boxShadow: activa ? `inset 0 0 0 1px ${BORDER}` : 'none',
                    transition: 'all .15s',
                  }}
                >
                  <i className={`bi ${t.icon}`} aria-hidden="true" style={{ fontSize: 14 }} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════
              TAB: ODONTOGRAMA
          ══════════════════════════════════════════ */}
          {tab === 'odontograma' && (
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, color: COLOR_D, fontSize: 16 }}>Odontograma del paciente</h3>
                  {/* Toggle 2D / 3D */}
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    {[['2d','2D Clásico'],['3d','3D Interactivo']].map(([mode, label]) => (
                      <button key={mode}
                        onClick={() => setOdoView(mode)}
                        style={{
                          padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12,
                          background: odoView === mode ? COLOR : '#fff',
                          color: odoView === mode ? '#fff' : '#64748b',
                          fontWeight: odoView === mode ? 700 : 400,
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={guardarOdontograma} disabled={saving}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: odoGuardado ? '#dcfce7' : COLOR,
                    color: odoGuardado ? '#166534' : '#fff',
                    fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  }}>
                  {saving ? 'Guardando...' : odoGuardado ? 'Guardado' : 'Guardar Odontograma'}
                </button>
              </div>

              {odoView === '2d' && (
                <Odontograma value={odontograma} onChange={setOdontograma}
                  edad={paciente?.fecha_nacimiento ? dayjs().diff(dayjs(paciente.fecha_nacimiento), 'year') : null} />
              )}
              {odoView === '3d' && (
                <Suspense fallback={
                  <div style={{ textAlign:'center', padding: 60, color:'#94a3b8' }}>
                    Cargando odontograma 3D...
                  </div>
                }>
                  <Odontograma3D value={odontograma} onChange={setOdontograma} />
                </Suspense>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: SESIÓN / CONSULTA
          ══════════════════════════════════════════ */}
          {tab === 'sesion' && (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

              {/* Lista de sesiones previas */}
              <div style={{ ...CARD, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 14, color: INK }}>Sesiones</strong>
                  <button onClick={nuevaSesion} style={{ padding: '5px 12px', borderRadius: 8, background: COLOR, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <i className="bi bi-plus-lg me-1" />Nueva
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
                  {sesiones.map(s => (
                    <div key={s.id}
                      onClick={() => cargarSesion(s)}
                      style={{
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        border: sesionActual?.id === s.id ? `1.5px solid ${COLOR}` : `1px solid ${LINE}`,
                        background: sesionActual?.id === s.id ? BG_LIGHT : '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: COLOR_D }}>
                          Sesión #{s.numero_sesion}
                          {s.factura_id && <i className="bi bi-receipt ms-2" title={`Cobrada · recibo #${s.factura_id}`} style={{ color: '#16a34a', fontSize: 12 }} />}
                        </span>
                        <span style={{
                          fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 700,
                          background: s.estado === 'FIRMADA' ? '#dcfce7' : '#fef3c7',
                          color:      s.estado === 'FIRMADA' ? '#166534' : '#92400e',
                        }}>{s.estado}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(s.creado_en).format('DD/MM/YYYY HH:mm')}</div>
                      {s.motivo_consulta && (
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.motivo_consulta}
                        </div>
                      )}
                    </div>
                  ))}
                  {sesiones.length === 0 && (
                    <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>
                      Sin sesiones previas
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario de sesión */}
              <div style={{ ...CARD, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: INK }}>
                    {sesionActual ? `Sesión #${sesionActual.numero_sesion}` : 'Nueva sesión'}
                    {readOnly && <span style={{ marginLeft: 10, fontSize: 12, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>FIRMADA</span>}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {readOnly && puedeCobrar && !sesionActual?.factura_id && (
                      <button onClick={() => abrirCobro({ id: sesionActual.id, procedimientos: sesionForm.procedimientos })}
                        style={{ padding: '7px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        <i className="bi bi-receipt me-1" /> Cobrar sesión
                      </button>
                    )}
                    {readOnly && sesionActual?.factura_id && (
                      <span style={{ alignSelf: 'center', fontSize: 12, fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '4px 10px', borderRadius: 999 }}>
                        <i className="bi bi-receipt me-1" />Cobrada · recibo #{sesionActual.factura_id}
                      </span>
                    )}
                    {sesionActual && !readOnly && (
                      <button onClick={abrirRevisionFirma} disabled={saving}
                        style={{ padding: '7px 16px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        <i className="bi bi-pen me-1" /> Firmar sesión
                      </button>
                    )}
                    {!readOnly && (
                      <button onClick={guardarSesion} disabled={saving}
                        style={{ padding: '7px 16px', borderRadius: 8, background: COLOR, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        {saving ? 'Guardando...' : sesionActual ? 'Actualizar' : 'Crear sesión'}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Motivo */}
                  <div>
                    <label style={lbl}>Motivo de consulta</label>
                    <textarea rows={2}
                      value={sesionForm.motivo_consulta}
                      onChange={e => setSesionForm(f => ({ ...f, motivo_consulta: e.target.value }))}
                      readOnly={readOnly}
                      placeholder="Describir el motivo de la consulta..."
                      style={textareaStyle(readOnly)}
                    />
                  </div>

                  {/* Examen clínico estomatológico (HC-03) */}
                  <div>
                    <label style={lbl}>Examen clínico estomatológico (HC-03)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {EXAMEN_CLINICO_GRUPOS.map(g => (
                        <div key={g.key}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{g.label}</div>
                          <select
                            value={sesionForm.exploracion_clinica?.[g.key] || ''}
                            onChange={e => setSesionForm(f => ({ ...f, exploracion_clinica: { ...f.exploracion_clinica, [g.key]: e.target.value } }))}
                            disabled={readOnly}
                            style={inputStyle}>
                            <option value="">— Seleccionar —</option>
                            {g.opciones.map(op => <option key={op} value={op}>{op}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detalle de la higiene oral */}
                  <div>
                    <label style={lbl}>Detalle de la higiene oral</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 10, background: BG_LIGHT, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                      {HIGIENE_DETALLE_CAMPOS.map(c => (
                        <div key={c.key}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{c.label}</div>
                          <input type="text"
                            value={sesionForm.exploracion_clinica?.higiene_detalle?.[c.key] || ''}
                            onChange={e => setSesionForm(f => ({
                              ...f,
                              exploracion_clinica: {
                                ...f.exploracion_clinica,
                                higiene_detalle: { ...f.exploracion_clinica.higiene_detalle, [c.key]: e.target.value },
                              },
                            }))}
                            readOnly={readOnly}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hallazgos clínicos detallados */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label style={{ ...lbl, marginBottom: 0 }}>Hallazgos clínicos detallados</label>
                      {!readOnly && (
                        <button onClick={prellenarHallazgosDesdeOdontograma}
                          style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: COLOR_D, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                          <i className="bi bi-magic me-1" /> Prellenar desde odontograma
                        </button>
                      )}
                    </div>
                    {sesionForm.hallazgos?.map((h, idx) => (
                      <div key={h.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '6px 10px', background: BG_LIGHT, borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: COLOR, minWidth: 30 }}>{h.pieza || '—'}</span>
                        <span style={{ color: '#475569', flex: 1 }}>{h.descripcion}</span>
                        {!readOnly && (
                          <button onClick={() => eliminarHallazgo(h.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>✕</button>
                        )}
                      </div>
                    ))}
                    {(!sesionForm.hallazgos || sesionForm.hallazgos.length === 0) && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Sin hallazgos registrados</div>
                    )}
                    {!readOnly && (
                      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 36px', gap: 6, marginTop: 6 }}>
                        <select value={nuevoHallazgo.pieza} onChange={e => setNuevoHallazgo(h => ({ ...h, pieza: e.target.value }))} style={inputStyle}>
                          <option value="">Pieza</option>
                          {TODAS_LAS_PIEZAS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input value={nuevoHallazgo.descripcion} onChange={e => setNuevoHallazgo(h => ({ ...h, descripcion: e.target.value }))}
                          placeholder="Descripción del hallazgo (caries, prótesis, etc.)" style={inputStyle} />
                        <button onClick={agregarHallazgo}
                          style={{ background: COLOR, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                      </div>
                    )}
                  </div>

                  {/* Procedimientos de la sesión */}
                  <div>
                    <label style={lbl}>Procedimientos realizados</label>
                    {sesionForm.procedimientos?.map((p, idx) => (
                      <div key={p.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '6px 10px', background: BG_LIGHT, borderRadius: 6, border: `1px solid ${BORDER}`, fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: COLOR, minWidth: 30 }}>{p.diente || '—'}</span>
                        <span style={{ color: '#475569', flex: 1 }}>{p.procedimiento}</span>
                        {p.material && <span style={{ color: '#94a3b8' }}>{p.material}</span>}
                        {!readOnly && (
                          <button onClick={() => eliminarProcSesion(p.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>✕</button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <div style={{ display: 'grid', gridTemplateColumns: '70px 100px 1fr 150px 36px', gap: 6, marginTop: 6 }}>
                        <input value={nuevoProc.diente} onChange={e => setNuevoProc(p => ({ ...p, diente: e.target.value }))}
                          placeholder="Diente" style={inputStyle} />
                        <input value={nuevoProc.superficie} onChange={e => setNuevoProc(p => ({ ...p, superficie: e.target.value }))}
                          placeholder="Superficie" style={inputStyle} />
                        <select value={nuevoProc.procedimiento} onChange={e => setNuevoProc(p => ({ ...p, procedimiento: e.target.value }))}
                          style={inputStyle}>
                          <option value="">— Procedimiento —</option>
                          {PROCEDIMIENTOS.map(g => (
                            <optgroup key={g.grupo} label={g.grupo}>
                              {g.items.map(i => <option key={i} value={i}>{i}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <select value={nuevoProc.material} onChange={e => setNuevoProc(p => ({ ...p, material: e.target.value }))}
                          style={inputStyle}>
                          <option value="">— Material —</option>
                          {MATERIALES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <button onClick={agregarProcSesion}
                          style={{ background: COLOR, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                      </div>
                    )}
                  </div>

                  {/* Diagnóstico */}
                  <div>
                    <label style={lbl}>Diagnóstico (CIE-10)</label>
                    <BuscadorCIE
                      value={sesionForm.diagnostico_cie}
                      desc={sesionForm.diagnostico_desc}
                      onChange={(c, d) => setSesionForm(f => ({ ...f, diagnostico_cie: c, diagnostico_desc: d }))}
                      onClear={() => setSesionForm(f => ({ ...f, diagnostico_cie: '', diagnostico_desc: '' }))}
                      readOnly={readOnly}
                    />
                  </div>

                  {/* Indicaciones */}
                  <div>
                    <label style={lbl}>Indicaciones al paciente</label>
                    <textarea rows={2}
                      value={sesionForm.indicaciones}
                      onChange={e => setSesionForm(f => ({ ...f, indicaciones: e.target.value }))}
                      readOnly={readOnly}
                      style={textareaStyle(readOnly)}
                    />
                  </div>

                  {/* Próxima cita */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Próxima cita / Seguimiento</label>
                      <input type="text"
                        value={sesionForm.proxima_cita}
                        onChange={e => setSesionForm(f => ({ ...f, proxima_cita: e.target.value }))}
                        readOnly={readOnly}
                        placeholder="En 7 días, control..."
                        style={inputStyle}
                      />
                      {(() => {
                        const sug = sugerirProximaSesion(plan.fases);
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            {sug && !readOnly && (
                              <button type="button" onClick={() => setSesionForm(f => ({ ...f, proxima_cita: `Continuar plan — ${sug.texto}` }))}
                                title={sug.texto}
                                style={{ padding: '3px 10px', borderRadius: 999, border: `1px dashed ${BORDER}`, background: BG_LIGHT, color: COLOR_D, cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>
                                <i className="bi bi-lightbulb me-1" />Sugerido: {sug.texto.length > 46 ? `${sug.texto.slice(0, 46)}…` : sug.texto}
                              </button>
                            )}
                            {puedeCobrar && (
                              <button type="button" onClick={() => setAgendar(true)}
                                style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${LINE}`, background: '#fff', color: '#2563eb', cursor: 'pointer', fontSize: 11.5, fontWeight: 700 }}>
                                <i className="bi bi-calendar-plus me-1" />Agendar cita
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label style={lbl}>Observaciones generales</label>
                      <input type="text"
                        value={sesionForm.observaciones}
                        onChange={e => setSesionForm(f => ({ ...f, observaciones: e.target.value }))}
                        readOnly={readOnly}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {readOnly && (
                    <div style={{ marginTop: 6, padding: 14, borderRadius: 12, background: '#f8fafc', border: `1px solid ${LINE}` }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>
                        <i className="bi bi-journal-plus me-2" style={{ color: COLOR_D }} />Notas posteriores a la firma
                      </div>
                      <div style={{ fontSize: 11.5, color: MUTED, margin: '2px 0 10px' }}>
                        La sesión firmada no se modifica. Estas notas quedan con fecha y autor, y no pueden editarse ni borrarse.
                      </div>
                      {addendas.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Sin notas posteriores.</div>}
                      {addendas.map(a => (
                        <div key={a.id} style={{ padding: '8px 12px', marginBottom: 6, borderRadius: 8, background: '#fff', border: `1px solid ${LINE}`, fontSize: 13, color: INK }}>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{a.texto}</div>
                          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                            {dayjs(a.creado_en).format('DD/MM/YYYY HH:mm')}{a.usuario_nombre ? ` · ${a.usuario_nombre}` : ''}
                          </div>
                        </div>
                      ))}
                      {puedeCobrar && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                          <textarea rows={2} value={nuevaNota} onChange={e => setNuevaNota(e.target.value)}
                            maxLength={2000} placeholder="Agregar una nota (corrección, aclaración o seguimiento)…"
                            style={{ ...textareaStyle(false), flex: 1 }} />
                          <button onClick={agregarAddendum} disabled={saving || nuevaNota.trim().length < 3}
                            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: COLOR, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: nuevaNota.trim().length < 3 ? 0.5 : 1 }}>
                            Agregar nota
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: PLAN DE TRATAMIENTO
          ══════════════════════════════════════════ */}
          {tab === 'plan' && (
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: COLOR_D }}>Plan de Tratamiento Integral</h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Ordenado por prioridad clínica para garantizar el éxito y la duración del tratamiento.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button onClick={() => setVerVersiones(true)}
                    style={{ padding: '7px 14px', borderRadius: 8, background: '#fff', color: MUTED, border: `1px solid ${LINE}`, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    <i className="bi bi-clock-history me-1" />Versiones
                  </button>
                  <button onClick={abrirPresupuesto}
                    style={{ padding: '7px 14px', borderRadius: 8, background: '#fff', color: COLOR_D, border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    <i className="bi bi-printer me-1" />Presupuesto
                  </button>
                  <button onClick={guardarPlan} disabled={saving}
                    style={{ padding: '7px 18px', borderRadius: 8, background: planGuardado ? '#dcfce7' : COLOR, color: planGuardado ? '#166534' : '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {saving ? 'Guardando...' : planGuardado ? 'Guardado' : 'Guardar plan'}
                  </button>
                </div>
              </div>

              {/* Fases */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                {plan.fases.map(fase => {
                  const draft = draftItemFase(fase.id);
                  return (
                    <div key={fase.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ background: COLOR, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <input value={fase.nombre}
                          onChange={e => actualizarFaseCampo(fase.id, 'nombre', e.target.value)}
                          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontWeight: 700, fontSize: 14, padding: '2px 4px' }} />
                        <button onClick={() => eliminarFase(fase.id)} title="Eliminar fase"
                          style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, padding: '2px 8px', flexShrink: 0 }}>✕</button>
                      </div>
                      <div style={{ padding: '10px 14px', background: BG_LIGHT }}>
                        <input value={fase.objetivo}
                          onChange={e => actualizarFaseCampo(fase.id, 'objetivo', e.target.value)}
                          placeholder="Objetivo de esta fase..."
                          style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontStyle: 'italic', color: '#7c4a03', boxSizing: 'border-box' }} />
                      </div>

                      <div style={{ padding: '10px 14px' }}>
                        {(fase.items || []).length === 0 && (
                          <div style={{ textAlign: 'center', padding: 14, color: '#94a3b8', fontSize: 12 }}>Sin procedimientos en esta fase</div>
                        )}
                        {(fase.items || []).map(item => (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                            padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                            background: item.completado ? '#f0fdf4' : '#fff',
                            opacity: item.completado ? 0.75 : 1,
                          }}>
                            <input type="checkbox" checked={item.completado || false} onChange={() => toggleItemFase(fase.id, item.id)}
                              style={{ width: 16, height: 16, cursor: 'pointer' }} />
                            <div style={{ width: 36, textAlign: 'center', fontWeight: 700, color: COLOR, fontSize: 13 }}>{item.pieza || '—'}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', textDecoration: item.completado ? 'line-through' : 'none' }}>
                                {item.procedimiento}
                              </div>
                              {item.material && <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.material}</div>}
                            </div>
                            {item.costo_estimado !== '' && item.costo_estimado != null && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 80, textAlign: 'right' }}>
                                L {parseFloat(item.costo_estimado).toFixed(2)}
                              </span>
                            )}
                            <button onClick={() => eliminarItemFase(fase.id, item.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 15, padding: 0 }}>✕</button>
                          </div>
                        ))}

                        {/* Agregar ítem a esta fase */}
                        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 130px 100px 36px', gap: 6, marginTop: 8 }}>
                          <input value={draft.pieza} onChange={e => setDraftItemFase(fase.id, { pieza: e.target.value })}
                            placeholder="Pieza" style={inputStyle} />
                          <select value={draft.procedimiento} style={inputStyle} title="Al elegir un procedimiento se sugiere el precio del catálogo de servicios"
                            onChange={e => {
                              const proc = e.target.value;
                              const sug = precioSugerido(proc, servicios);
                              setDraftItemFase(fase.id, { procedimiento: proc, ...(sug && !draft.costo_estimado ? { costo_estimado: String(sug.precio) } : {}) });
                            }}>
                            <option value="">— Procedimiento clínico —</option>
                            {PROCEDIMIENTOS.map(g => (
                              <optgroup key={g.grupo} label={g.grupo}>
                                {g.items.map(i => <option key={i} value={i}>{i}</option>)}
                              </optgroup>
                            ))}
                          </select>
                          <select value={draft.material} onChange={e => setDraftItemFase(fase.id, { material: e.target.value })} style={inputStyle}>
                            <option value="">Material</option>
                            {MATERIALES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input type="number" value={draft.costo_estimado} onChange={e => setDraftItemFase(fase.id, { costo_estimado: e.target.value })}
                            placeholder="Inversión L" style={inputStyle} />
                          <button onClick={() => agregarItemFase(fase.id)}
                            style={{ background: COLOR, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                        </div>
                      </div>

                      <div style={{ padding: '8px 14px', background: '#fafafa', borderTop: '1px solid #f1f5f9', textAlign: 'right', fontSize: 13, fontWeight: 700, color: COLOR_D }}>
                        Subtotal {fase.nombre.split(':')[0] || 'Fase'}: L {subtotalFase(fase).toFixed(2)}
                      </div>
                    </div>
                  );
                })}

                <button onClick={agregarFase}
                  style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: 8, border: `1px dashed ${BORDER}`, background: '#fff', color: COLOR_D, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  + Agregar fase
                </button>
              </div>

              {/* Términos del presupuesto + inversión total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, marginTop: 20, alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#334155', marginBottom: 8 }}>Términos del presupuesto</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={lbl}>Vigencia (días)</label>
                      <input type="number" value={plan.vigencia_dias}
                        onChange={e => setPlan(p => ({ ...p, vigencia_dias: e.target.value }))}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={lbl}>Formas de pago</label>
                      <input type="text" value={plan.formas_pago}
                        onChange={e => setPlan(p => ({ ...p, formas_pago: e.target.value }))}
                        style={inputStyle} />
                    </div>
                  </div>
                  <label style={lbl}>Nota clínica</label>
                  <textarea rows={2}
                    value={plan.nota_clinica}
                    onChange={e => setPlan(p => ({ ...p, nota_clinica: e.target.value }))}
                    style={textareaStyle(false)}
                  />
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: BG_LIGHT, border: `1px solid ${BORDER}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7c4a03', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Inversión Total</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: COLOR_D }}>L {costoTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: RECETA (módulo de prescripciones existente)
          ══════════════════════════════════════════ */}
          {tab === 'receta' && (
            <div style={{ ...CARD, padding: 20 }}>
              <PrescripcionTab
                historiaId={null} pacienteId={pacienteId} citaId={sesionActual?.cita_id || citaId} firmada={false}
                diagnosticoCie={sesionForm.diagnostico_cie} diagnosticoDesc={sesionForm.diagnostico_desc}
              />
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: HISTORIA ODONTOLÓGICA
          ══════════════════════════════════════════ */}
          {tab === 'historia' && (
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: COLOR_D }}>Historia odontológica</h3>
                <button onClick={guardarHistoria} disabled={saving}
                  style={{ padding: '7px 18px', borderRadius: 8, background: historiaGuardada ? '#dcfce7' : COLOR, color: historiaGuardada ? '#166534' : '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {saving ? 'Guardando...' : historiaGuardada ? 'Guardado' : 'Guardar historia'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Motivo inicial */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Motivo de consulta</label>
                  <textarea rows={2} value={historia.motivo_consulta_inicial}
                    onChange={e => setHistoria(h => ({ ...h, motivo_consulta_inicial: e.target.value }))}
                    style={textareaStyle(false)} />
                </div>

                <div>
                  <label style={lbl}>Fecha de última consulta odontológica</label>
                  <input type="date" value={historia.fecha_ultima_consulta}
                    onChange={e => setHistoria(h => ({ ...h, fecha_ultima_consulta: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={lbl}>¿Ha presentado complicaciones?</label>
                  <input type="text" value={historia.complicaciones_previas}
                    onChange={e => setHistoria(h => ({ ...h, complicaciones_previas: e.target.value }))}
                    placeholder="Describir si aplica..."
                    style={inputStyle} />
                </div>

                {/* Anamnesis y antecedentes médicos (HC-02) */}
                <div style={{ gridColumn: '1 / -1', padding: 14, background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
                  <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 10, fontSize: 13 }}>
                    ⚕ Anamnesis y antecedentes médicos (HC-02)
                  </div>
                  {catalogoCondiciones.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      No hay condiciones configuradas. Ve a <strong>Catálogos → Anamnesis</strong> para definirlas.
                    </div>
                  )}
                  <div style={{ overflowX: 'auto', border: '1px solid #fecaca', borderRadius: 8, background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#fef2f2' }}>
                          <th style={condTh}>Condición / Antecedente</th>
                          <th style={{ ...condTh, width: 46, textAlign: 'center' }}>SI</th>
                          <th style={{ ...condTh, width: 46, textAlign: 'center' }}>NO</th>
                          <th style={condTh}>Especifique</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalogoCondiciones.map(cond => {
                          const ant = getAntecedente(cond.id);
                          const respuesta = ant?.respuesta || 'NO';
                          const esSi = respuesta === 'SI';
                          return (
                            <tr key={cond.id} style={{ background: cond.es_alerta && esSi ? '#fee2e2' : '#fff' }}>
                              <td style={{ ...condTd, fontWeight: cond.es_alerta ? 700 : 400, color: cond.es_alerta ? '#dc2626' : '#334155' }}>
                                {!!cond.es_alerta && '⚠ '}{cond.nombre}
                              </td>
                              <td style={{ ...condTd, textAlign: 'center' }}>
                                <input type="checkbox" checked={esSi}
                                  onChange={() => setAntecedente(cond, { respuesta: esSi ? 'NO' : 'SI', ...(esSi ? { especifique: '' } : {}) })}
                                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                              </td>
                              <td style={{ ...condTd, textAlign: 'center' }}>
                                <input type="checkbox" checked={!esSi}
                                  onChange={() => setAntecedente(cond, { respuesta: esSi ? 'NO' : 'SI', ...(esSi ? { especifique: '' } : {}) })}
                                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                              </td>
                              <td style={condTd}>
                                {cond.requiere_especifique && esSi ? (
                                  <input type="text" placeholder="Especifique..."
                                    value={ant?.especifique || ''}
                                    onChange={e => setAntecedente(cond, { especifique: e.target.value })}
                                    style={{ ...inputStyle, padding: '4px 8px' }} />
                                ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Medicamentos tomados */}
                  <div style={{ marginTop: 16 }}>
                    <label style={lbl}>Medicamentos tomados</label>
                    {(historia.medicamentos || []).map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '6px 10px', background: '#fff', borderRadius: 6, border: '1px solid #fecaca', fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: '#334155', flex: 1 }}>{m.nombre}</span>
                        <span style={{ color: '#64748b', minWidth: 90 }}>{m.dosis}</span>
                        <span style={{ color: '#64748b', flex: 1 }}>{m.motivo}</span>
                        <button onClick={() => eliminarMedicamento(m.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 0 }}>✕</button>
                      </div>
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr 36px', gap: 6, marginTop: 6 }}>
                      <input value={nuevoMed.nombre} onChange={e => setNuevoMed(m => ({ ...m, nombre: e.target.value }))}
                        placeholder="Medicamento" style={inputStyle} />
                      <input value={nuevoMed.dosis} onChange={e => setNuevoMed(m => ({ ...m, dosis: e.target.value }))}
                        placeholder="Dosis" style={inputStyle} />
                      <input value={nuevoMed.motivo} onChange={e => setNuevoMed(m => ({ ...m, motivo: e.target.value }))}
                        placeholder="Motivo" style={inputStyle} />
                      <button onClick={agregarMedicamento}
                        style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                    </div>
                  </div>
                </div>

                {/* Hábitos de higiene */}
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#334155', marginBottom: 10, fontSize: 13 }}>🪥 Hábitos de higiene</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={{ ...lbl, display: 'block' }}>Frecuencia de cepillado</label>
                      <select value={historia.frecuencia_cepillado}
                        onChange={e => setHistoria(h => ({ ...h, frecuencia_cepillado: e.target.value }))}
                        style={inputStyle}>
                        <option value="">— Seleccionar —</option>
                        {['1 vez al día', '2 veces al día', '3 veces al día', 'Irregular', 'No se cepilla'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    {[['usa_hilo_dental', 'Usa hilo dental'], ['usa_enjuague', 'Usa enjuague bucal']].map(([k, label]) => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={historia[k] || false}
                          onChange={e => setHistoria(h => ({ ...h, [k]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                    <div>
                      <label style={lbl}>Hábitos nocivos (bruxismo, onicofagia, etc.)</label>
                      <input type="text" value={historia.habitos_nocivos}
                        onChange={e => setHistoria(h => ({ ...h, habitos_nocivos: e.target.value }))}
                        style={inputStyle} />
                    </div>
                  </div>
                </div>

                {/* Antecedentes sistémicos */}
                <div style={{ padding: 14, background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
                  <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 10, fontSize: 13 }}>⚕ Antecedentes sistémicos relevantes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {[
                      ['diabetes', 'Diabetes mellitus'],
                      ['hipertension', 'Hipertensión arterial'],
                      ['anticoagulantes', 'Toma anticoagulantes'],
                      ['alergia_anestesia', 'Alergia a anestesia local'],
                      ['alergia_latex', 'Alergia al látex'],
                    ].map(([k, label]) => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={historia[k] || false}
                          onChange={e => setHistoria(h => ({ ...h, [k]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                    <div>
                      <label style={lbl}>Otras condiciones</label>
                      <textarea rows={2} value={historia.otras_condiciones}
                        onChange={e => setHistoria(h => ({ ...h, otras_condiciones: e.target.value }))}
                        style={textareaStyle(false)} />
                    </div>
                  </div>
                </div>

                {/* Antecedentes dentales */}
                <div style={{ gridColumn: '1 / -1', padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, color: '#334155', marginBottom: 10, fontSize: 13 }}>🦷 Antecedentes odontológicos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      ['ortodoncia_previa', 'Ortodoncia previa'],
                      ['implantes_previos', 'Implantes previos'],
                    ].map(([k, label]) => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={historia[k] || false}
                          onChange={e => setHistoria(h => ({ ...h, [k]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                    <div>
                      <label style={lbl}>Prótesis actual</label>
                      <input type="text" value={historia.protesis_actual}
                        onChange={e => setHistoria(h => ({ ...h, protesis_actual: e.target.value }))}
                        placeholder="Parcial, total, ninguna..."
                        style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={lbl}>Extracciones previas (dientes)</label>
                      <input type="text" value={historia.extracciones_previas}
                        onChange={e => setHistoria(h => ({ ...h, extracciones_previas: e.target.value }))}
                        placeholder="Ej: 18, 28, 38, 48..."
                        style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={lbl}>Otros tratamientos previos</label>
                      <textarea rows={2} value={historia.tratamientos_previos}
                        onChange={e => setHistoria(h => ({ ...h, tratamientos_previos: e.target.value }))}
                        style={textareaStyle(false)} />
                    </div>
                  </div>
                </div>

                {/* Historia familiar y notas */}
                <div>
                  <label style={lbl}>Historia dental familiar</label>
                  <textarea rows={3} value={historia.historia_familiar}
                    onChange={e => setHistoria(h => ({ ...h, historia_familiar: e.target.value }))}
                    style={textareaStyle(false)} />
                </div>
                <div>
                  <label style={lbl}>Notas adicionales</label>
                  <textarea rows={3} value={historia.notas}
                    onChange={e => setHistoria(h => ({ ...h, notas: e.target.value }))}
                    style={textareaStyle(false)} />
                </div>

                {/* Declaración y firma del paciente */}
                <div style={{ gridColumn: '1 / -1', padding: 14, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
                    <input type="checkbox" checked={historia.declaracion_veraz || false}
                      onChange={e => setHistoria(h => ({ ...h, declaracion_veraz: e.target.checked }))}
                      style={{ marginTop: 2 }} />
                    Declaro que la información proporcionada es verdadera y completa. No he omitido ningún dato sobre mi estado de salud.
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Firma del paciente / tutor (nombre)</label>
                      <input type="text" value={historia.firma_paciente_nombre}
                        onChange={e => setHistoria(h => ({ ...h, firma_paciente_nombre: e.target.value }))}
                        placeholder="Nombre completo"
                        style={inputStyle} />
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'end', paddingBottom: 8 }}>
                      {historia.firma_fecha && `Firmado: ${dayjs(historia.firma_fecha).format('DD/MM/YYYY HH:mm')}`}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: ESTUDIOS COMPLEMENTARIOS Y ESTADO DE CUENTA
              (integración con módulos existentes /estudios y /facturacion)
          ══════════════════════════════════════════ */}
          {tab === 'cuenta' && (
            <div style={{ ...CARD, padding: 20, display: 'flex', flexDirection: 'column', gap: 28 }}>

              {/* Estudios complementarios */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: COLOR_D }}>Estudios o exámenes complementarios</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {estudios.length > 0 && (
                      <button onClick={verPdfEstudios}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: COLOR_D, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        🖨 Ver PDF
                      </button>
                    )}
                    <button onClick={() => setShowFormEstudio(v => !v)}
                      style={{ padding: '6px 14px', borderRadius: 8, background: COLOR, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      + Solicitar estudio
                    </button>
                  </div>
                </div>

                {showFormEstudio && (
                  <div style={{ padding: 14, background: BG_LIGHT, borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, marginBottom: 8 }}>
                      <select value={formEstudio.tipo} onChange={e => setFormEstudio(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                        {['LABORATORIO', 'IMAGENOLOGIA', 'OTRO'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input value={formEstudio.descripcion} onChange={e => setFormEstudio(f => ({ ...f, descripcion: e.target.value }))}
                        placeholder="Ej: Radiografía panorámica, biometría hemática..." style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={solicitarEstudio} disabled={saving}
                        style={{ padding: '6px 16px', borderRadius: 8, background: COLOR, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        {saving ? 'Guardando...' : 'Crear solicitud'}
                      </button>
                      <button onClick={() => setShowFormEstudio(false)}
                        style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {estudios.length === 0 && !showFormEstudio && (
                  <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Sin estudios solicitados</div>
                )}
                {estudios.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                      background: s.estado === 'COMPLETADO' ? '#dcfce7' : s.estado === 'EN_PROCESO' ? '#e0f2fe' : s.estado === 'CANCELADO' ? '#f1f5f9' : '#fef3c7',
                      color:      s.estado === 'COMPLETADO' ? '#166534' : s.estado === 'EN_PROCESO' ? '#0369a1' : s.estado === 'CANCELADO' ? '#64748b' : '#92400e',
                    }}>{s.estado}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COLOR_D, minWidth: 90 }}>{s.tipo}</span>
                    <span style={{ fontSize: 13, color: '#334155', flex: 1 }}>{s.descripcion}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{dayjs(s.creado_en).format('DD/MM/YYYY')}</span>
                  </div>
                ))}
              </div>

              {/* Estado de cuenta */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: COLOR_D }}>Estado de cuenta del paciente</h3>
                  <button onClick={() => navigate(`/facturacion?paciente_id=${pacienteId}`)}
                    style={{ padding: '6px 14px', borderRadius: 8, background: COLOR, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    + Nueva factura / recibo
                  </button>
                </div>

                {facturas.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Sin movimientos registrados</div>
                )}
                {facturas.length > 0 && (
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Fecha', 'No.', 'Descripción', 'Debe', 'Haber', 'Saldo', 'Estado', ''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Debe' || h === 'Haber' || h === 'Saldo' ? 'right' : 'left', fontSize: 11, color: '#64748b', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {facturas.map(f => {
                          const pagado = parseFloat(f.total_pagado || 0);
                          const total = parseFloat(f.total || 0);
                          const saldo = total - pagado;
                          return (
                            <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={condTd}>{dayjs(f.creado_en).format('DD/MM/YYYY')}</td>
                              <td style={{ ...condTd, fontWeight: 700, color: COLOR_D }}>{f.numero_completo || f.numero}</td>
                              <td style={condTd}>{f.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Recibo'}</td>
                              <td style={{ ...condTd, textAlign: 'right' }}>L {total.toFixed(2)}</td>
                              <td style={{ ...condTd, textAlign: 'right' }}>L {pagado.toFixed(2)}</td>
                              <td style={{ ...condTd, textAlign: 'right', fontWeight: 700, color: saldo > 0 ? '#dc2626' : '#16a34a' }}>L {saldo.toFixed(2)}</td>
                              <td style={condTd}>
                                <span style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                                  background: f.estado === 'PAGADA' ? '#dcfce7' : f.estado === 'ANULADA' ? '#fee2e2' : '#fef3c7',
                                  color:      f.estado === 'PAGADA' ? '#166534' : f.estado === 'ANULADA' ? '#991b1b' : '#92400e',
                                }}>{f.estado}</span>
                              </td>
                              <td style={condTd}>
                                <button onClick={() => verPdfFactura(f.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLOR_D, fontSize: 13 }}>🖨</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

        </>
      )}
    </div>
  );
}

// ─── Versiones del plan de tratamiento ────────────────────────────────────────
function VersionesPlanModal({ pacienteId, onCerrar, onUsar }) {
  const [versiones, setVersiones] = useState(null);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    api.get(`/odontologia/plan/${pacienteId}/versiones`)
      .then(r => setVersiones(r.data.data || []))
      .catch(() => setVersiones([]));
  }, [pacienteId]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Versiones del plan" onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: INK }}>
            <i className="bi bi-clock-history me-2" style={{ color: COLOR_D }} />Versiones del plan
          </h3>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: 20, color: MUTED, cursor: 'pointer' }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <p style={{ fontSize: 13, color: MUTED, margin: '0 0 14px' }}>
          Cada vez que cambia el plan se conserva una versión. Puedes revisarlas o cargar una como base para editar.
        </p>

        {versiones === null && <div style={{ color: MUTED, padding: 20, textAlign: 'center' }}>Cargando…</div>}
        {versiones && versiones.length === 0 && (
          <div style={{ color: MUTED, padding: 20, textAlign: 'center', fontSize: 13 }}>
            Aún no hay versiones: se crean al guardar el plan.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(versiones || []).map(v => (
            <div key={v.id} style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
                <strong style={{ color: COLOR_D }}>Versión {v.version}</strong>
                {v.origen === 'INICIAL' && <span style={{ fontSize: 11, background: '#f1f5f9', color: MUTED, borderRadius: 999, padding: '1px 8px', fontWeight: 700 }}>anterior al historial</span>}
                <span style={{ fontSize: 12, color: MUTED }}>
                  {dayjs(v.creado_en).format('DD/MM/YYYY HH:mm')}{v.usuario_nombre ? ` · ${v.usuario_nombre}` : ''}
                </span>
                <span style={{ fontSize: 12, color: INK, marginLeft: 'auto' }}>
                  {v.completados}/{v.total_items} realizados · <strong>{dinero(v.costo_total)}</strong>
                </span>
                <button onClick={() => setAbierta(abierta === v.id ? null : v.id)}
                  style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: MUTED, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {abierta === v.id ? 'Ocultar' : 'Ver detalle'}
                </button>
                <button onClick={() => onUsar(v.fases)}
                  style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: BG_LIGHT, color: COLOR_D, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  Usar como base
                </button>
              </div>
              {abierta === v.id && (
                <div style={{ padding: '4px 14px 12px', background: '#f8fafc', borderTop: `1px solid ${LINE}`, fontSize: 12.5 }}>
                  {v.fases.map(f => (
                    <div key={f.id} style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700, color: INK }}>{f.nombre}</div>
                      {(f.items || []).map(i => (
                        <div key={i.id} style={{ display: 'flex', gap: 8, color: '#475569' }}>
                          <span style={{ minWidth: 34, color: COLOR, fontWeight: 700 }}>{i.pieza || '—'}</span>
                          <span style={{ flex: 1, textDecoration: i.completado ? 'line-through' : 'none' }}>{i.procedimiento}</span>
                          <span>{dinero(i.costo_estimado)}</span>
                        </div>
                      ))}
                      {(f.items || []).length === 0 && <div style={{ color: MUTED }}>Sin procedimientos</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Revisión previa a la firma ───────────────────────────────────────────────
function RevisionFirmaModal({ datos, setDatos, saving, onCancel, onConfirm }) {
  const alternar = (lista, key) =>
    setDatos(d => ({ ...d, [lista]: d[lista].map(x => x.key === key ? { ...x, marcado: !x.marcado } : x) }));
  const hayPropuestas = datos.planMatches.length + datos.odoProps.length > 0;
  const marcados = datos.planMatches.filter(m => m.marcado).length + datos.odoProps.filter(m => m.marcado).length;

  const fila = (children, marcado, onToggle, key) => (
    <label key={key} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
      border: `1px solid ${marcado ? BORDER : LINE}`, background: marcado ? BG_LIGHT : '#fff',
    }}>
      <input type="checkbox" checked={marcado} onChange={onToggle} style={{ marginTop: 3 }} />
      <span style={{ fontSize: 13, color: INK, lineHeight: 1.45 }}>{children}</span>
    </label>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Revisar antes de firmar" onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: 'min(680px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: INK }}>
          <i className="bi bi-pen me-2" style={{ color: COLOR_D }} />Revisar antes de firmar
        </h3>
        <p style={{ fontSize: 13, color: MUTED, margin: '6px 0 16px' }}>
          Al firmar, la sesión ya no podrá editarse.
          {hayPropuestas && ' Estos cambios se proponen a partir de los procedimientos que registraste; deja marcados solo los que correspondan.'}
        </p>

        {datos.planMatches.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...lbl, textTransform: 'uppercase', letterSpacing: '.04em' }}>Plan de tratamiento · marcar como completados</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {datos.planMatches.map(m => fila(
                <>
                  <strong>{m.pieza ? `Pieza ${m.pieza} · ` : ''}{m.procedimiento}</strong>
                  <span style={{ color: MUTED }}>{m.faseNombre ? ` — ${m.faseNombre.split(':')[0]}` : ''}{m.costo ? ` · L ${Number(m.costo).toFixed(2)}` : ''}</span>
                </>, m.marcado, () => alternar('planMatches', m.key), m.key))}
            </div>
          </div>
        )}

        {datos.odoProps.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...lbl, textTransform: 'uppercase', letterSpacing: '.04em' }}>Odontograma · actualizar estado</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {datos.odoProps.map(m => fila(
                <>
                  <strong>Pieza {m.pieza}</strong>: {m.antes} <i className="bi bi-arrow-right" style={{ color: COLOR_D }} /> <strong>{m.despues}</strong>
                  <span style={{ display: 'block', fontSize: 11.5, color: MUTED }}>por «{m.procedimiento}»</span>
                </>, m.marcado, () => alternar('odoProps', m.key), m.key))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button onClick={onCancel} disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: MUTED, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Volver a la sesión
          </button>
          {hayPropuestas && (
            <button onClick={() => onConfirm(false)} disabled={saving}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: COLOR_D, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Firmar sin aplicar cambios
            </button>
          )}
          <button onClick={() => onConfirm(true)} disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Firmando...' : hayPropuestas ? `Firmar y aplicar (${marcados})` : 'Firmar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────
const lbl = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: '#475569', marginBottom: 5, letterSpacing: '.01em',
};

const inputStyle = {
  width: '100%', padding: '8px 11px', borderRadius: 8,
  border: '1px solid #cbd5e1', fontSize: 13, color: INK,
  background: '#fff', boxSizing: 'border-box',
};

const condTh = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.03em',
  borderBottom: '2px solid #fecaca',
};

const condTd = {
  padding: '6px 10px', borderBottom: '1px solid #f1f5f9',
};

function textareaStyle(readOnly) {
  return {
    width: '100%', padding: '8px 11px', borderRadius: 8,
    border: `1px solid ${readOnly ? LINE : '#cbd5e1'}`,
    fontSize: 13, resize: 'vertical', color: INK,
    background: readOnly ? '#f8fafc' : '#fff',
    boxSizing: 'border-box',
  };
}
