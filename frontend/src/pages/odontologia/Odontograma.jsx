import { useState, useCallback } from "react";
import { CONDITIONS, UPPER_TEETH, LOWER_TEETH, SURFACE_LABEL, toothType } from "./constantes_odontologia";

// ─── Dimensiones del SVG ──────────────────────────────────────────────────────
const TW = 38;   // tooth width (px)
const TH = 46;   // tooth height (px)
const GX = 2;    // gap between teeth
const MG = 10;   // midline gap
const AG = 30;   // arch gap (between upper/lower arches)
const NL = 13;   // height reserved for tooth number label

// Inner occlusal region boundaries (trapezoid cutout inside the tooth box)
const IX = 10, IY = 13, IW = 18, IH = 20;  // x, y, width, height of center surface

const PAD_L = 6;  // left padding
const TOP_Y = 18; // y-position of upper arch

// Compute x position for tooth index 0–15 (8 per half-arch)
function toothX(i) {
  const mid = i >= 8 ? MG : 0;
  return PAD_L + i * (TW + GX) + mid;
}

const SVG_W = PAD_L * 2 + 16 * TW + 15 * GX + MG;
const SVG_H = TOP_Y + TH + NL + AG + TH + NL + 8;

// ─── Surface polygon points for a TW×TH tooth box ───────────────────────────
const S = {
  top:    `0,0 ${TW},0 ${IX+IW},${IY} ${IX},${IY}`,
  bottom: `0,${TH} ${TW},${TH} ${IX+IW},${IY+IH} ${IX},${IY+IH}`,
  left:   `0,0 ${IX},${IY} ${IX},${IY+IH} 0,${TH}`,
  right:  `${TW},0 ${IX+IW},${IY} ${IX+IW},${IY+IH} ${TW},${TH}`,
};

function initTooth() {
  return { v: 'sano', p: 'sano', m: 'sano', d: 'sano', o: 'sano', ausente: false, nota: '' };
}

// ─── Single tooth SVG rendering ───────────────────────────────────────────────
function ToothShape({ num, data, isSelected, isUpper, activeCond, readOnly, onSurface, onSelect }) {
  const [hov, setHov] = useState(null);
  const t = data || initTooth();

  // For upper teeth: top surface = vestibular (V), bottom = palatino (P)
  // For lower teeth: top surface = lingual (P), bottom = vestibular (V)
  // Left/Right = M/D depending on arch side (but we keep simplified: left='m', right='d')
  const surfaceKey = {
    top:    isUpper ? 'v' : 'p',
    bottom: isUpper ? 'p' : 'v',
    left:   'm',
    right:  'd',
    center: 'o',
  };

  const fill = (sk) => {
    const key = t[sk] || 'sano';
    const c   = CONDITIONS[key] || CONDITIONS.sano;
    return c.fill;
  };
  const stroke = (sk) => {
    const key = t[sk] || 'sano';
    const c   = CONDITIONS[key] || CONDITIONS.sano;
    return c.stroke;
  };

  const selBorder = isSelected ? '#FF9800' : '#475569';
  const selWidth  = isSelected ? 2 : 0.8;

  const handleSurf = (e, pos) => {
    e.stopPropagation();
    if (readOnly || t.ausente) return;
    onSurface(num, surfaceKey[pos]);
  };

  const cursor = readOnly ? 'default' : 'pointer';

  if (t.ausente) {
    return (
      <g onClick={() => onSelect(num)} style={{ cursor }}>
        <rect x={0} y={0} width={TW} height={TH} rx={4}
          fill="#f1f5f9" stroke={selBorder} strokeWidth={selWidth} />
        {/* X mark */}
        <line x1={6} y1={6} x2={TW-6} y2={TH-6} stroke="#94a3b8" strokeWidth={1.8} />
        <line x1={TW-6} y1={6} x2={6} y2={TH-6} stroke="#94a3b8" strokeWidth={1.8} />
      </g>
    );
  }

  return (
    <g onClick={() => onSelect(num)}>
      {/* Top surface (V or P depending on arch) */}
      <polygon
        points={S.top}
        fill={fill(surfaceKey.top)}
        stroke={stroke(surfaceKey.top)}
        strokeWidth={0.5}
        opacity={hov === 'top' ? 0.75 : 1}
        onClick={e => handleSurf(e, 'top')}
        onMouseEnter={() => setHov('top')}
        onMouseLeave={() => setHov(null)}
        style={{ cursor }}
      />
      {/* Bottom surface */}
      <polygon
        points={S.bottom}
        fill={fill(surfaceKey.bottom)}
        stroke={stroke(surfaceKey.bottom)}
        strokeWidth={0.5}
        opacity={hov === 'bottom' ? 0.75 : 1}
        onClick={e => handleSurf(e, 'bottom')}
        onMouseEnter={() => setHov('bottom')}
        onMouseLeave={() => setHov(null)}
        style={{ cursor }}
      />
      {/* Left surface (M) */}
      <polygon
        points={S.left}
        fill={fill(surfaceKey.left)}
        stroke={stroke(surfaceKey.left)}
        strokeWidth={0.5}
        opacity={hov === 'left' ? 0.75 : 1}
        onClick={e => handleSurf(e, 'left')}
        onMouseEnter={() => setHov('left')}
        onMouseLeave={() => setHov(null)}
        style={{ cursor }}
      />
      {/* Right surface (D) */}
      <polygon
        points={S.right}
        fill={fill(surfaceKey.right)}
        stroke={stroke(surfaceKey.right)}
        strokeWidth={0.5}
        opacity={hov === 'right' ? 0.75 : 1}
        onClick={e => handleSurf(e, 'right')}
        onMouseEnter={() => setHov('right')}
        onMouseLeave={() => setHov(null)}
        style={{ cursor }}
      />
      {/* Center (Occlusal / Incisal) */}
      <rect
        x={IX} y={IY} width={IW} height={IH}
        fill={fill('o')}
        stroke={stroke('o')}
        strokeWidth={0.5}
        opacity={hov === 'center' ? 0.75 : 1}
        onClick={e => handleSurf(e, 'center')}
        onMouseEnter={() => setHov('center')}
        onMouseLeave={() => setHov(null)}
        style={{ cursor }}
      />
      {/* Outer tooth border */}
      <rect x={0} y={0} width={TW} height={TH} rx={3}
        fill="none"
        stroke={selBorder}
        strokeWidth={selWidth}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}

// ─── Odontograma principal ────────────────────────────────────────────────────
export default function Odontograma({ value = {}, onChange, readOnly = false }) {
  const [selected, setSelected]   = useState(null);
  const [activeCond, setActiveCond] = useState('caries');

  const getTooth = useCallback((num) => value[num] || initTooth(), [value]);

  const handleSurface = useCallback((toothNum, surfKey) => {
    if (readOnly) return;
    const t = getTooth(toothNum);
    // Toggle: si ya tiene la condición activa, vuelve a 'sano'
    const newCond = t[surfKey] === activeCond ? 'sano' : activeCond;
    onChange({ ...value, [toothNum]: { ...t, [surfKey]: newCond } });
  }, [value, activeCond, readOnly, onChange, getTooth]);

  const handleSelect = useCallback((num) => {
    setSelected(prev => prev === num ? null : num);
  }, []);

  const toggleAusente = (num) => {
    if (readOnly) return;
    const t = getTooth(num);
    onChange({ ...value, [num]: { ...t, ausente: !t.ausente } });
  };

  const setNota = (num, nota) => {
    const t = getTooth(num);
    onChange({ ...value, [num]: { ...t, nota } });
  };

  const applyCondToAll = (num, cond) => {
    if (readOnly) return;
    const t = getTooth(num);
    onChange({ ...value, [num]: { ...t, v: cond, p: cond, m: cond, d: cond, o: cond } });
  };

  const clearTooth = (num) => {
    if (readOnly) return;
    onChange({ ...value, [num]: initTooth() });
  };

  const selectedData = selected ? getTooth(selected) : null;
  const isUpper = (num) => UPPER_TEETH.includes(num);

  return (
    <div>
      {/* ── Selector de condición ── */}
      {!readOnly && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center', marginRight: 4, fontWeight: 600 }}>
            Herramienta:
          </span>
          {Object.entries(CONDITIONS).map(([key, c]) => (
            <button
              key={key}
              onClick={() => setActiveCond(key)}
              title={c.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20, fontSize: 12,
                border: `2px solid ${c.stroke}`,
                background: activeCond === key ? c.fill : '#f8fafc',
                color: activeCond === key ? '#1e293b' : '#475569',
                fontWeight: activeCond === key ? 700 : 400,
                cursor: 'pointer',
                boxShadow: activeCond === key ? `0 0 0 2px ${c.stroke}55` : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                background: c.fill, border: `1.5px solid ${c.stroke}`,
                display: 'inline-block',
              }} />
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* ── SVG Odontograma ── */}
      <div style={{ overflowX: 'auto', background: '#f8fafc', borderRadius: 10, padding: '10px 4px', border: '1px solid #e2e8f0' }}>
        <svg
          width={SVG_W}
          height={SVG_H}
          style={{ display: 'block', margin: '0 auto', userSelect: 'none' }}
        >
          {/* Etiquetas Superior / Inferior */}
          <text x={PAD_L} y={TOP_Y - 4} fontSize={9} fill="#94a3b8" fontStyle="italic">Superior</text>
          <text x={PAD_L} y={TOP_Y + TH + NL + AG - 4} fontSize={9} fill="#94a3b8" fontStyle="italic">Inferior</text>

          {/* Línea de línea media */}
          <line
            x1={toothX(8) - MG / 2}  y1={TOP_Y - 2}
            x2={toothX(8) - MG / 2}  y2={TOP_Y + TH + NL + AG + TH + NL}
            stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4,3"
          />

          {/* Línea separadora arcos */}
          <line
            x1={PAD_L} y1={TOP_Y + TH + NL + AG / 2}
            x2={SVG_W - PAD_L} y2={TOP_Y + TH + NL + AG / 2}
            stroke="#e2e8f0" strokeWidth={1}
          />

          {/* Dientes superiores */}
          {UPPER_TEETH.map((num, i) => {
            const x = toothX(i);
            return (
              <g key={num} transform={`translate(${x},${TOP_Y})`}>
                <ToothShape
                  num={num}
                  data={value[num]}
                  isSelected={selected === num}
                  isUpper={true}
                  activeCond={activeCond}
                  readOnly={readOnly}
                  onSurface={handleSurface}
                  onSelect={handleSelect}
                />
                {/* Número de diente */}
                <text
                  x={TW / 2} y={TH + 10}
                  textAnchor="middle" fontSize={9}
                  fill={selected === num ? '#FF9800' : '#64748b'}
                  fontWeight={selected === num ? 700 : 400}
                  style={{ pointerEvents: 'none' }}
                >
                  {num}
                </text>
              </g>
            );
          })}

          {/* Dientes inferiores */}
          {LOWER_TEETH.map((num, i) => {
            const x = toothX(i);
            const y = TOP_Y + TH + NL + AG;
            return (
              <g key={num} transform={`translate(${x},${y})`}>
                <ToothShape
                  num={num}
                  data={value[num]}
                  isSelected={selected === num}
                  isUpper={false}
                  activeCond={activeCond}
                  readOnly={readOnly}
                  onSurface={handleSurface}
                  onSelect={handleSelect}
                />
                {/* Número de diente */}
                <text
                  x={TW / 2} y={TH + 10}
                  textAnchor="middle" fontSize={9}
                  fill={selected === num ? '#FF9800' : '#64748b'}
                  fontWeight={selected === num ? 700 : 400}
                  style={{ pointerEvents: 'none' }}
                >
                  {num}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Panel del diente seleccionado ── */}
      {selected && selectedData && (
        <div style={{
          marginTop: 14, padding: 16, background: '#fff7ed',
          borderRadius: 10, border: '1.5px solid #fed7aa',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🦷</span>
              <div>
                <strong style={{ color: '#FF9800', fontSize: 15 }}>Diente #{selected}</strong>
                <span style={{ color: '#94a3b8', fontSize: 11, marginLeft: 8 }}>
                  {isUpper(selected) ? 'Superior' : 'Inferior'} · {toothType(selected).charAt(0).toUpperCase() + toothType(selected).slice(1)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!readOnly && (
                <>
                  <button onClick={() => clearTooth(selected)} style={btnStyle('#f1f5f9','#64748b')}>
                    Limpiar
                  </button>
                  <button onClick={() => applyCondToAll(selected, activeCond)} style={btnStyle('#fff7ed','#FF9800')}>
                    Aplicar a todo el diente
                  </button>
                </>
              )}
              <button onClick={() => setSelected(null)} style={btnStyle('#fee2e2','#ef4444')}>✕</button>
            </div>
          </div>

          {/* Checkbox ausente */}
          {!readOnly && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#ef4444', marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedData.ausente || false}
                onChange={() => toggleAusente(selected)}
                style={{ width: 15, height: 15 }}
              />
              Marcar como diente ausente
            </label>
          )}

          {!selectedData.ausente && (
            <>
              {/* Grid de superficies */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
                {Object.entries(SURFACE_LABEL).map(([sk, label]) => {
                  const cond = selectedData[sk] || 'sano';
                  const c    = CONDITIONS[cond] || CONDITIONS.sano;
                  return (
                    <div key={sk} style={{
                      textAlign: 'center', padding: '8px 4px',
                      borderRadius: 8, background: '#fff',
                      border: `1.5px solid ${c.stroke}`,
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 4, margin: '0 auto 4px',
                        background: c.fill, border: `1.5px solid ${c.stroke}`,
                      }} />
                      <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.2 }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#1e293b', fontWeight: 700, marginTop: 2 }}>{c.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Nota del diente */}
              <textarea
                placeholder="Notas del diente (observaciones, materiales usados, etc.)"
                value={selectedData.nota || ''}
                onChange={e => setNota(selected, e.target.value)}
                readOnly={readOnly}
                rows={2}
                style={{
                  width: '100%', fontSize: 12, padding: '6px 8px',
                  borderRadius: 6, border: '1px solid #fed7aa',
                  resize: 'vertical', background: '#fffbf5',
                  boxSizing: 'border-box',
                }}
              />
            </>
          )}

          {selectedData.ausente && (
            <div style={{
              textAlign: 'center', padding: '16px 0', color: '#94a3b8', fontSize: 13
            }}>
              Este diente está marcado como ausente
            </div>
          )}
        </div>
      )}

      {/* ── Leyenda compacta ── */}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(CONDITIONS).map(([key, c]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#475569' }}>
            <span style={{
              width: 12, height: 12, borderRadius: 2, flexShrink: 0,
              background: c.fill, border: `1.5px solid ${c.stroke}`, display: 'inline-block'
            }} />
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    padding: '3px 10px', borderRadius: 6, fontSize: 12,
    background: bg, color, border: `1px solid ${color}44`,
    cursor: 'pointer', fontWeight: 600,
  };
}
