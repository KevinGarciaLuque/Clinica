import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthContext";
import Odontograma from "./Odontograma";
import {
  CONDITIONS, PROCEDIMIENTOS, DX_RAPIDOS, MATERIALES,
  SURFACE_LABEL
} from "./constantes_odontologia";

const Odontograma3D = lazy(() => import("./Odontograma3D"));

// ─── Paleta naranja odontología ───────────────────────────────────────────────
const COLOR = '#FF9800';
const COLOR_D = '#e65100';
const BG_LIGHT = '#fff7ed';
const BORDER = '#fed7aa';

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'odontograma', label: '🦷 Odontograma' },
  { id: 'sesion',      label: '📋 Consulta' },
  { id: 'plan',        label: '📝 Plan de Tratamiento' },
  { id: 'historia',    label: '📚 Historia' },
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
const initSesion = () => ({
  motivo_consulta: '',
  exploracion_clinica: { tejidos_blandos: '', oclusion: '', higiene_oral: '', atm: '', otros: '' },
  procedimientos: [],
  diagnostico_cie: '', diagnostico_desc: '',
  indicaciones: '', proxima_cita: '', observaciones: '',
});

const initHistoria = () => ({
  motivo_consulta_inicial: '',
  frecuencia_cepillado: '', usa_hilo_dental: false, usa_enjuague: false, habitos_nocivos: '',
  diabetes: false, hipertension: false, anticoagulantes: false,
  alergia_anestesia: false, alergia_latex: false, otras_condiciones: '',
  ortodoncia_previa: false, extracciones_previas: '', implantes_previos: false,
  protesis_actual: '', tratamientos_previos: '', historia_familiar: '', notas: '',
});

const initPlan = () => ({ items: [], notas: '' });

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ConsultaOdontologia() {
  const { user } = useAuth();
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

  // Plan
  const [plan, setPlan]               = useState(initPlan());
  const [planGuardado, setPlanGuardado] = useState(false);
  const [nuevoProcItem, setNuevoProcItem] = useState({ diente: '', superficie: '', procedimiento: '', material: '', prioridad: 'media', costo_estimado: '' });

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pacienteId) loadAll(pacienteId);
  }, [pacienteId]);

  async function loadAll(pid) {
    setLoading(true);
    try {
      const [rPac, rOdo, rHist, rPlan, rRes, rSes] = await Promise.all([
        api.get(`/pacientes/${pid}`),
        api.get(`/odontologia/odontograma/${pid}`),
        api.get(`/odontologia/historia/${pid}`),
        api.get(`/odontologia/plan/${pid}`),
        api.get(`/odontologia/resumen/${pid}`),
        api.get('/odontologia/sesiones', { params: { paciente_id: pid, limit: 30 } }),
      ]);
      setPaciente(rPac.data.data || rPac.data);
      if (rOdo.data.data?.dientes) {
        const d = rOdo.data.data.dientes;
        setOdontograma(typeof d === 'string' ? JSON.parse(d) : d);
      }
      if (rHist.data.data) setHistoria({ ...initHistoria(), ...rHist.data.data });
      if (rPlan.data.data) {
        const p = rPlan.data.data;
        const items = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []);
        setPlan({ items, notas: p.notas || '' });
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

  async function firmarSesion() {
    if (!sesionActual) return;
    setSaving(true);
    try {
      await api.post(`/odontologia/sesiones/${sesionActual.id}/firmar`);
      setSesionActual(prev => ({ ...prev, estado: 'FIRMADA' }));
      showMsg('ok', 'Sesión firmada correctamente');
      const r = await api.get('/odontologia/sesiones', { params: { paciente_id: pacienteId, limit: 30 } });
      setSesiones(r.data.data);
    } catch (e) { showMsg('error', e.response?.data?.msg || 'Error al firmar'); }
    finally { setSaving(false); }
  }

  function nuevaSesion() {
    setSesionActual(null);
    setSesionForm(initSesion());
  }

  function cargarSesion(s) {
    setSesionActual(s);
    setSesionForm({
      motivo_consulta:    s.motivo_consulta || '',
      exploracion_clinica: typeof s.exploracion_clinica === 'string'
        ? JSON.parse(s.exploracion_clinica || '{}')
        : (s.exploracion_clinica || { tejidos_blandos: '', oclusion: '', higiene_oral: '', atm: '', otros: '' }),
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
      showMsg('ok', 'Historia guardada');
      setTimeout(() => setHistoriaGuardada(false), 3000);
    } catch { showMsg('error', 'Error al guardar historia'); }
    finally { setSaving(false); }
  }

  // ── Plan de tratamiento ──────────────────────────────────────────────────────
  async function guardarPlan() {
    if (!pacienteId) return;
    setSaving(true);
    try {
      await api.post(`/odontologia/plan/${pacienteId}`, plan);
      setPlanGuardado(true);
      showMsg('ok', 'Plan guardado');
      setTimeout(() => setPlanGuardado(false), 3000);
    } catch { showMsg('error', 'Error al guardar plan'); }
    finally { setSaving(false); }
  }

  function agregarItemPlan() {
    if (!nuevoProcItem.procedimiento) return;
    const item = { ...nuevoProcItem, id: Date.now(), completado: false };
    setPlan(p => ({ ...p, items: [...p.items, item] }));
    setNuevoProcItem({ diente: '', superficie: '', procedimiento: '', material: '', prioridad: 'media', costo_estimado: '' });
  }

  function toggleItemPlan(id) {
    setPlan(p => ({
      ...p,
      items: p.items.map(it => it.id === id ? { ...it, completado: !it.completado } : it),
    }));
  }

  function eliminarItemPlan(id) {
    setPlan(p => ({ ...p, items: p.items.filter(it => it.id !== id) }));
  }

  const costoTotal = plan.items.reduce((s, i) => s + (parseFloat(i.costo_estimado) || 0), 0);

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
          {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: COLOR_D, display: 'flex', alignItems: 'center', gap: 10 }}>
            🦷 Consulta Odontológica
          </h2>
          {paciente && (
            <div style={{ marginTop: 4, color: '#475569', fontSize: 14 }}>
              <strong>{paciente.nombre} {paciente.apellido}</strong>
              {paciente.fecha_nacimiento && (
                <span style={{ marginLeft: 10, color: '#94a3b8' }}>
                  {dayjs().diff(dayjs(paciente.fecha_nacimiento), 'year')} años
                </span>
              )}
            </div>
          )}
        </div>

        {/* Resumen rápido */}
        {resumen && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Sesiones', val: resumen.total_sesiones, color: COLOR },
              { label: 'Firmadas', val: resumen.sesiones_firmadas, color: '#16a34a' },
              { label: 'Pendientes plan', val: resumen.plan_pendientes, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '8px 14px', borderRadius: 10, background: `${s.color}11`, border: `1px solid ${s.color}33` }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Cargando datos del paciente...</div>
      )}

      {!loading && (
        <>
          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: `2px solid ${BORDER}`, marginBottom: 20, gap: 2, flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
                  fontWeight: tab === t.id ? 700 : 400,
                  borderBottom: tab === t.id ? `3px solid ${COLOR}` : '3px solid transparent',
                  background: tab === t.id ? BG_LIGHT : 'transparent',
                  color: tab === t.id ? COLOR_D : '#475569',
                  borderRadius: '8px 8px 0 0',
                  marginBottom: -2,
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════
              TAB: ODONTOGRAMA
          ══════════════════════════════════════════ */}
          {tab === 'odontograma' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, color: COLOR_D, fontSize: 16 }}>Odontograma del paciente</h3>
                  {/* Toggle 2D / 3D */}
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    {[['2d','🗺 2D Clásico'],['3d','🧊 3D Interactivo']].map(([mode, label]) => (
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
                  {saving ? 'Guardando...' : odoGuardado ? '✓ Guardado' : 'Guardar Odontograma'}
                </button>
              </div>

              {odoView === '2d' && (
                <Odontograma value={odontograma} onChange={setOdontograma} />
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
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: '#334155' }}>Sesiones</strong>
                  <button onClick={nuevaSesion} style={{ padding: '4px 12px', borderRadius: 6, background: COLOR, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    + Nueva
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
                  {sesiones.map(s => (
                    <div key={s.id}
                      onClick={() => cargarSesion(s)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: sesionActual?.id === s.id ? `2px solid ${COLOR}` : '1px solid #e2e8f0',
                        background: sesionActual?.id === s.id ? BG_LIGHT : '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: COLOR_D }}>Sesión #{s.numero_sesion}</span>
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
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: COLOR_D }}>
                    {sesionActual ? `Sesión #${sesionActual.numero_sesion}` : 'Nueva sesión'}
                    {readOnly && <span style={{ marginLeft: 10, fontSize: 12, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>FIRMADA</span>}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {sesionActual && !readOnly && (
                      <button onClick={firmarSesion} disabled={saving}
                        style={{ padding: '7px 16px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        ✎ Firmar sesión
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

                  {/* Exploración clínica */}
                  <div>
                    <label style={lbl}>Exploración clínica</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        ['tejidos_blandos', 'Tejidos blandos'],
                        ['oclusion', 'Oclusión'],
                        ['higiene_oral', 'Higiene oral'],
                        ['atm', 'ATM'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
                          <textarea rows={2}
                            value={sesionForm.exploracion_clinica?.[key] || ''}
                            onChange={e => setSesionForm(f => ({ ...f, exploracion_clinica: { ...f.exploracion_clinica, [key]: e.target.value } }))}
                            readOnly={readOnly}
                            style={{ ...textareaStyle(readOnly), minHeight: 0 }}
                          />
                        </div>
                      ))}
                    </div>
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

                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: PLAN DE TRATAMIENTO
          ══════════════════════════════════════════ */}
          {tab === 'plan' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: COLOR_D }}>Plan de tratamiento</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#475569' }}>
                    Costo estimado total: <strong style={{ color: COLOR_D }}>${costoTotal.toFixed(2)}</strong>
                  </span>
                  <button onClick={guardarPlan} disabled={saving}
                    style={{ padding: '7px 18px', borderRadius: 8, background: planGuardado ? '#dcfce7' : COLOR, color: planGuardado ? '#166534' : '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    {saving ? 'Guardando...' : planGuardado ? '✓ Guardado' : 'Guardar plan'}
                  </button>
                </div>
              </div>

              {/* Agregar ítem al plan */}
              <div style={{ padding: 14, background: BG_LIGHT, borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLOR_D, marginBottom: 8 }}>Agregar procedimiento al plan</div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 120px 90px 90px 36px', gap: 6 }}>
                  <input value={nuevoProcItem.diente} onChange={e => setNuevoProcItem(p => ({ ...p, diente: e.target.value }))}
                    placeholder="Diente" style={inputStyle} />
                  <input value={nuevoProcItem.superficie} onChange={e => setNuevoProcItem(p => ({ ...p, superficie: e.target.value }))}
                    placeholder="Superficie" style={inputStyle} />
                  <select value={nuevoProcItem.procedimiento} onChange={e => setNuevoProcItem(p => ({ ...p, procedimiento: e.target.value }))} style={inputStyle}>
                    <option value="">— Procedimiento —</option>
                    {PROCEDIMIENTOS.map(g => (
                      <optgroup key={g.grupo} label={g.grupo}>
                        {g.items.map(i => <option key={i} value={i}>{i}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <select value={nuevoProcItem.material} onChange={e => setNuevoProcItem(p => ({ ...p, material: e.target.value }))} style={inputStyle}>
                    <option value="">Material</option>
                    {MATERIALES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={nuevoProcItem.prioridad} onChange={e => setNuevoProcItem(p => ({ ...p, prioridad: e.target.value }))} style={inputStyle}>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Media</option>
                    <option value="baja">🟢 Baja</option>
                  </select>
                  <input type="number" value={nuevoProcItem.costo_estimado} onChange={e => setNuevoProcItem(p => ({ ...p, costo_estimado: e.target.value }))}
                    placeholder="Costo $" style={inputStyle} />
                  <button onClick={agregarItemPlan}
                    style={{ background: COLOR, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                </div>
              </div>

              {/* Lista del plan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.items.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 13 }}>Sin procedimientos en el plan</div>
                )}
                {plan.items.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                    background: item.completado ? '#f0fdf4' : '#fff',
                    opacity: item.completado ? 0.75 : 1,
                  }}>
                    <input type="checkbox" checked={item.completado || false} onChange={() => toggleItemPlan(item.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <div style={{ width: 40, textAlign: 'center', fontWeight: 700, color: COLOR, fontSize: 13 }}>{item.diente || '—'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', textDecoration: item.completado ? 'line-through' : 'none' }}>
                        {item.procedimiento}
                      </div>
                      {item.material && <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.material}</div>}
                    </div>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 700,
                      background: item.prioridad === 'alta' ? '#fee2e2' : item.prioridad === 'baja' ? '#dcfce7' : '#fef3c7',
                      color:      item.prioridad === 'alta' ? '#dc2626' : item.prioridad === 'baja' ? '#16a34a' : '#92400e',
                    }}>{item.prioridad}</span>
                    {item.costo_estimado && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 70, textAlign: 'right' }}>
                        ${parseFloat(item.costo_estimado).toFixed(2)}
                      </span>
                    )}
                    <button onClick={() => eliminarItemPlan(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 15, padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>

              {/* Notas del plan */}
              <div style={{ marginTop: 16 }}>
                <label style={lbl}>Notas del plan</label>
                <textarea rows={2}
                  value={plan.notas}
                  onChange={e => setPlan(p => ({ ...p, notas: e.target.value }))}
                  style={textareaStyle(false)}
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB: HISTORIA ODONTOLÓGICA
          ══════════════════════════════════════════ */}
          {tab === 'historia' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: COLOR_D }}>Historia odontológica</h3>
                <button onClick={guardarHistoria} disabled={saving}
                  style={{ padding: '7px 18px', borderRadius: 8, background: historiaGuardada ? '#dcfce7' : COLOR, color: historiaGuardada ? '#166534' : '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {saving ? 'Guardando...' : historiaGuardada ? '✓ Guardado' : 'Guardar historia'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Motivo inicial */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>Motivo de primera consulta</label>
                  <textarea rows={2} value={historia.motivo_consulta_inicial}
                    onChange={e => setHistoria(h => ({ ...h, motivo_consulta_inicial: e.target.value }))}
                    style={textareaStyle(false)} />
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

              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────
const lbl = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#64748b', marginBottom: 4,
};

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid #e2e8f0', fontSize: 13,
  background: '#fff', boxSizing: 'border-box',
};

function textareaStyle(readOnly) {
  return {
    width: '100%', padding: '7px 10px', borderRadius: 6,
    border: `1px solid ${readOnly ? '#e2e8f0' : '#fed7aa'}`,
    fontSize: 13, resize: 'vertical',
    background: readOnly ? '#f8fafc' : '#fffbf5',
    boxSizing: 'border-box',
  };
}
