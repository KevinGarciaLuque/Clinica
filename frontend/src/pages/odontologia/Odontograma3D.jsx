import { useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Html, Environment } from "@react-three/drei";
import * as THREE from "three";
import { CONDITIONS, UPPER_TEETH, LOWER_TEETH, SURFACE_LABEL } from "./constantes_odontologia";

const TOOTH_DIM = {
  molar:    { w: 0.60, h: 0.74, d: 0.56, r: 0.09 },
  premolar: { w: 0.47, h: 0.72, d: 0.46, r: 0.08 },
  canine:   { w: 0.34, h: 0.82, d: 0.32, r: 0.07 },
  incisor:  { w: 0.42, h: 0.68, d: 0.25, r: 0.07 },
};

function toothType(num) {
  const n = num % 10;
  if (n <= 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n <= 5) return 'premolar';
  return 'molar';
}

const PRIORITY = ['extraccion','fractura','caries','endodoncia','corona','puente',
                  'implante','obturacion','sellante','mal_posicion','sano'];

function getDominant(td) {
  if (!td) return 'sano';
  if (td.ausente) return 'ausente';
  const surfs = ['v','p','m','d','o'].map(s => td[s] || 'sano');
  for (const p of PRIORITY) { if (surfs.includes(p)) return p; }
  return 'sano';
}

function toothFill(td) {
  if (!td) return '#f7f2ea';
  if (td.ausente) return '#9ca3af';
  return CONDITIONS[getDominant(td)]?.fill || '#f7f2ea';
}

function buildRoots(num, type, w, d, rootH) {
  if (type !== 'molar') return [{ pos:[0,0,0], args:[w*0.28, w*0.12, rootH, 8] }];
  const quad = Math.floor(num / 10);
  if (quad === 1 || quad === 2) {
    return [
      { pos:[-w*0.21,0, d*0.14], args:[w*0.13,w*0.06,rootH*0.92,7] },
      { pos:[ w*0.21,0, d*0.14], args:[w*0.13,w*0.06,rootH*0.92,7] },
      { pos:[0,      0,-d*0.17], args:[w*0.15,w*0.08,rootH,      7] },
    ];
  }
  return [
    { pos:[-w*0.19,0,0], args:[w*0.15,w*0.08,rootH,       7] },
    { pos:[ w*0.19,0,0], args:[w*0.13,w*0.07,rootH*0.88,  7] },
  ];
}

function buildCusps(type, w, d, crownY, crownH) {
  const top = crownY + crownH * 0.44;
  if (type === 'molar') {
    const cr = Math.min(w,d)*0.21;
    return [
      { pos:[-w*0.22,top,-d*0.20], r:cr,        cone:false },
      { pos:[ w*0.22,top,-d*0.20], r:cr,        cone:false },
      { pos:[-w*0.22,top, d*0.20], r:cr*0.88,   cone:false },
      { pos:[ w*0.22,top, d*0.20], r:cr*0.88,   cone:false },
    ];
  }
  if (type === 'premolar') {
    const cr = Math.min(w,d)*0.19;
    return [
      { pos:[0,top,-d*0.20], r:cr,      cone:false },
      { pos:[0,top, d*0.20], r:cr*0.85, cone:false },
    ];
  }
  if (type === 'canine') {
    const cr = Math.min(w,d)*0.20;
    return [{ pos:[0,top+cr*0.4,0], r:cr, h:cr*2.4, cone:true }];
  }
  return [];
}

function buildArch(teeth, A, B, Y) {
  const n = teeth.length - 1;
  return teeth.map((num, i) => {
    const t    = 1 - (2*i/n);
    const x    = A*t;
    const z    = B*t*t;
    const rotY = Math.atan2(x, Math.max(z, 0.01));
    return { num, x, y:Y, z, rotY };
  });
}

const UPPER_POS = buildArch(UPPER_TEETH, 3.5, 2.8,  1.2);
const LOWER_POS = buildArch(LOWER_TEETH, 3.3, 2.6, -1.2);
const ALL_POS   = [...UPPER_POS, ...LOWER_POS];

// ── Animación de cámara suave ──────────────────────────────────────────────────
function CameraLerper({ lerpRef, orbitRef }) {
  useFrame(() => {
    const l = lerpRef.current;
    if (!l.active) return;
    const ctrl = orbitRef.current;
    if (!ctrl) return;
    ctrl.enabled = false;
    ctrl.object.position.lerp(l.camPos, 0.09);
    ctrl.target.lerp(l.camTarget, 0.09);
    ctrl.update();
    if (ctrl.object.position.distanceTo(l.camPos) < 0.08) {
      l.active = false;
      ctrl.enabled = true;
    }
  });
  return null;
}

// ── Superficies coloreadas sobre el diente ─────────────────────────────────────
function ToothSurfaces({ td, w, crownH, d, crownY, absent, mesialSign }) {
  if (absent) return null;
  const ep = 0.015; // epsilon offset para que no z-fight con la corona
  const ow = [w*0.80, crownH*0.70, 0.042]; // overlay vestibular/palatal
  const os = [0.042, crownH*0.70, d*0.80]; // overlay mesial/distal
  const oo = [w*0.80, 0.042, d*0.80];      // overlay oclusal

  const defs = {
    o: { args:oo, pos:[0, crownY+crownH*0.50+ep, 0] },
    v: { args:ow, pos:[0, crownY, d*0.50+ep]        },
    p: { args:ow, pos:[0, crownY,-(d*0.50+ep)]      },
    m: { args:os, pos:[mesialSign*(w*0.50+ep), crownY, 0]  },
    d: { args:os, pos:[-mesialSign*(w*0.50+ep), crownY, 0] },
  };

  return (
    <>
      {Object.entries(defs).map(([sk, sg]) => {
        const cond = td?.[sk] || 'sano';
        if (cond === 'sano') return null;
        const c = CONDITIONS[cond] || CONDITIONS.sano;
        return (
          <RoundedBox key={sk} args={sg.args} radius={0.018} smoothness={2} position={sg.pos}>
            <meshPhysicalMaterial color={c.fill} roughness={0.28} transparent opacity={0.92}
              clearcoat={0.55} clearcoatRoughness={0.22} depthWrite={false} />
          </RoundedBox>
        );
      })}
    </>
  );
}

// ── Encía ──────────────────────────────────────────────────────────────────────
function GumArch({ A, B, Y, radius=0.13 }) {
  const geo = useMemo(() => {
    const pts = [];
    for (let i=0;i<=40;i++) {
      const t=1-(2*i/40);
      pts.push(new THREE.Vector3(A*t, Y, B*t*t));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, radius, 8, false);
  }, [A, B, Y, radius]);
  return <mesh geometry={geo}><meshStandardMaterial color="#c8546a" roughness={0.60} /></mesh>;
}

// ── Diente 3D ──────────────────────────────────────────────────────────────────
function Tooth({ num, pos, td, selected, hovered, onHover, onClick, isUpper }) {
  const type   = toothType(num);
  const { w, h, d, r } = TOOTH_DIM[type];
  const fill   = toothFill(td);
  const absent = td?.ausente;
  const cond   = getDominant(td);

  const crownH   = h*0.58;
  const rootH    = h*0.50;
  const crownY   = rootH*0.5 + crownH*0.5;
  const crownTop = crownY + crownH*0.5;
  const scaleY   = isUpper ? -1 : 1;
  // x>0 = cuadrante derecho del paciente → mesial apunta hacia centro (−X en modelo)
  const mesialSign = pos.x >= 0 ? -1 : 1;

  const crownColor = useMemo(() => {
    const c = new THREE.Color(fill);
    if (selected) c.lerp(new THREE.Color('#FF9800'), 0.38);
    else if (hovered) c.lerp(new THREE.Color('#ffffff'), 0.18);
    return c;
  }, [fill, selected, hovered]);

  const rootColor = useMemo(() => new THREE.Color(fill).multiplyScalar(0.72), [fill]);
  const roots     = useMemo(() => buildRoots(num, type, w, d, rootH), [num, type, w, d, rootH]);
  const cusps     = useMemo(() => buildCusps(type, w, d, crownY, crownH), [type, w, d, crownY, crownH]);
  const labelY    = isUpper ? -(crownTop+0.32) : (crownTop+0.32);

  return (
    <group position={[pos.x,pos.y,pos.z]} rotation={[0,pos.rotY,0]}
      onClick={e=>{e.stopPropagation();onClick(num);}}
      onPointerEnter={e=>{e.stopPropagation();onHover(num);}}
      onPointerLeave={e=>{e.stopPropagation();onHover(null);}}>

      {/* Número FDI siempre visible */}
      <Html distanceFactor={14} position={[0,labelY,0]} center>
        <div style={{
          color: selected?'#FF9800':hovered?'#e2e8f0':'#64748b',
          fontSize:9, fontWeight:700, pointerEvents:'none',
          textShadow:'0 1px 4px #000c', lineHeight:1, transition:'color 0.15s',
        }}>{num}</div>
      </Html>

      <group scale={[1,scaleY,1]}>
        {/* Raíces */}
        {roots.map((rt,i) => (
          <mesh key={i} position={rt.pos} castShadow>
            <cylinderGeometry args={rt.args} />
            <meshStandardMaterial color={rootColor} roughness={0.70} opacity={0.55} transparent />
          </mesh>
        ))}

        {/* Corona */}
        <RoundedBox args={[w,crownH,d]} radius={r} smoothness={5}
          position={[0,crownY,0]} castShadow receiveShadow>
          <meshPhysicalMaterial color={crownColor} roughness={0.16} metalness={0}
            clearcoat={0.88} clearcoatRoughness={0.10} envMapIntensity={1.1}
            opacity={absent?0.18:1} transparent={absent} />
        </RoundedBox>

        {/* Cúspides */}
        {!absent && cusps.map((c,i) =>
          c.cone ? (
            <mesh key={i} position={c.pos} castShadow>
              <coneGeometry args={[c.r, c.h, 8]} />
              <meshPhysicalMaterial color={crownColor} roughness={0.16}
                clearcoat={0.88} clearcoatRoughness={0.10} envMapIntensity={1.1}/>
            </mesh>
          ) : (
            <mesh key={i} position={c.pos} castShadow>
              <sphereGeometry args={[c.r, 10, 8]} />
              <meshPhysicalMaterial color={crownColor} roughness={0.16}
                clearcoat={0.88} clearcoatRoughness={0.10} envMapIntensity={1.1}/>
            </mesh>
          )
        )}

        {/* Superficies coloreadas */}
        <ToothSurfaces td={td} w={w} crownH={crownH} d={d} crownY={crownY}
          absent={absent} mesialSign={mesialSign} />

        {/* Anillo de selección */}
        {selected && (
          <mesh position={[0,crownY,0]} rotation={[Math.PI/2,0,0]}>
            <torusGeometry args={[Math.max(w,d)*0.78, 0.038, 8, 40]} />
            <meshBasicMaterial color="#FF9800" />
          </mesh>
        )}
      </group>

      {/* Tooltip hover */}
      {hovered && (
        <Html distanceFactor={10}
          position={[0, isUpper?-(crownTop+0.6):(crownTop+0.6), 0]}>
          <div style={{
            background:'rgba(10,15,28,0.93)', color:'#f1f5f9',
            padding:'5px 10px', borderRadius:7, fontSize:11,
            whiteSpace:'nowrap', pointerEvents:'none',
            borderLeft:`3px solid ${CONDITIONS[cond]?.stroke||'#94a3b8'}`,
            boxShadow:'0 2px 14px #0008',
          }}>
            <span style={{fontWeight:700,color:'#fed7aa'}}>#{num}</span>
            {' · '}
            <span>{absent?'Ausente':(CONDITIONS[cond]?.label||'Sano')}</span>
          </div>
        </Html>
      )}

      {absent && (
        <Html distanceFactor={10} position={[0,0,0]}>
          <div style={{color:'#f87171',fontWeight:900,fontSize:20,
            pointerEvents:'none',textShadow:'0 0 8px #ef4444'}}>✕</div>
        </Html>
      )}
    </group>
  );
}

// ── Panel diente seleccionado (arrastrable) ────────────────────────────────────
function ToothPanel({ num, td, readOnly, onSurface, onToggleAusente, onNota, onClear, onClose, panelPos, onDragStart }) {
  const absent   = td?.ausente;
  const cond     = getDominant(td);
  const isUpper  = UPPER_TEETH.includes(num);
  const rootRef  = useRef();

  const posStyle = panelPos
    ? { left: panelPos.x, top: panelPos.y, bottom: 'auto', transform: 'none' }
    : { bottom: 14, left: '50%', transform: 'translateX(-50%)' };

  const startDrag = useCallback(e => onDragStart(e, rootRef.current), [onDragStart]);

  return (
    <div ref={rootRef} style={{
      position:'absolute', ...posStyle,
      background:'rgba(10,16,30,0.97)', border:'1.5px solid #FF9800',
      borderRadius:12, padding:'14px 18px', width:490, maxWidth:'95vw',
      boxShadow:'0 8px 32px #0009', color:'#f1f5f9', zIndex:10,
      backdropFilter:'blur(8px)', userSelect:'none',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10,cursor:'grab',flex:1,userSelect:'none'}}
          onMouseDown={startDrag}>
          <span style={{fontSize:13,opacity:0.35,marginRight:-2,letterSpacing:1}}>⠿⠿</span>
          <span style={{fontSize:22}}>🦷</span>
          <strong style={{color:'#FF9800',fontSize:16}}>Diente #{num}</strong>
          <span style={{color:'#94a3b8',fontSize:11}}>{isUpper?'Superior':'Inferior'}</span>
          <span style={{
            padding:'2px 9px',borderRadius:10,fontSize:11,fontWeight:700,
            background:`${CONDITIONS[cond]?.stroke||'#555'}22`,
            color:CONDITIONS[cond]?.fill||'#fff',
            border:`1px solid ${CONDITIONS[cond]?.stroke||'#555'}`,
          }}>{absent?'Ausente':(CONDITIONS[cond]?.label||'Sano')}</span>
        </div>
        <div style={{display:'flex',gap:6}}>
          {!readOnly && (
            <button onClick={()=>onClear(num)} style={{
              padding:'3px 10px',borderRadius:6,fontSize:12,
              background:'#1e293b',color:'#94a3b8',border:'1px solid #374151',cursor:'pointer',
            }}>Limpiar</button>
          )}
          <button onClick={onClose} style={{
            padding:'3px 10px',borderRadius:6,fontSize:12,
            background:'#3b1111',color:'#f87171',border:'1px solid #7f1d1d55',cursor:'pointer',
          }}>✕</button>
        </div>
      </div>
      {!readOnly && (
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,
          color:'#fca5a5',marginBottom:11,cursor:'pointer'}}>
          <input type="checkbox" checked={absent||false} onChange={()=>onToggleAusente(num)}/>
          Marcar como diente ausente
        </label>
      )}
      {!absent && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:10}}>
            {Object.entries(SURFACE_LABEL).map(([sk,label])=>{
              const c=CONDITIONS[td?.[sk]||'sano']||CONDITIONS.sano;
              return (
                <div key={sk} onClick={()=>!readOnly&&onSurface(num,sk)} style={{
                  textAlign:'center',padding:'7px 4px',borderRadius:8,
                  background:`${c.fill}18`,border:`1.5px solid ${c.stroke}`,
                  cursor:readOnly?'default':'pointer',
                }}>
                  <div style={{width:18,height:18,borderRadius:4,margin:'0 auto 4px',
                    background:c.fill,border:`1.5px solid ${c.stroke}`}}/>
                  <div style={{fontSize:9,color:'#94a3b8',lineHeight:1.2}}>{label}</div>
                  <div style={{fontSize:10,color:'#e2e8f0',fontWeight:700,marginTop:1}}>{c.label}</div>
                </div>
              );
            })}
          </div>
          <textarea placeholder="Notas del diente..." value={td?.nota||''}
            onChange={e=>onNota(num,e.target.value)} readOnly={readOnly} rows={2}
            style={{width:'100%',background:'#0d1117',color:'#e2e8f0',
              border:'1px solid #1e3a5f',borderRadius:6,padding:'6px 8px',
              fontSize:12,resize:'none',boxSizing:'border-box'}}/>
        </>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Odontograma3D({ value={}, onChange, readOnly=false }) {
  const [selected, setSelected]     = useState(null);
  const [hovered, setHovered]       = useState(null);
  const [activeCond, setActiveCond] = useState('caries');
  const [showUpper, setShowUpper]   = useState(true);
  const [showLower, setShowLower]   = useState(true);
  const [panelPos, setPanelPos]     = useState(null); // null = posición default
  const orbitRef    = useRef();
  const lerpState   = useRef({ active:false, camPos:new THREE.Vector3(), camTarget:new THREE.Vector3() });
  const containerRef = useRef();
  const dragRef      = useRef({ active:false, offsetX:0, offsetY:0 });

  const initTooth = () => ({v:'sano',p:'sano',m:'sano',d:'sano',o:'sano',ausente:false,nota:''});
  const getTooth  = useCallback(n => value[n]||initTooth(), [value]);

  const handleSurface = useCallback((num, sk) => {
    if (readOnly) return;
    const t = getTooth(num);
    onChange({...value,[num]:{...t,[sk]:t[sk]===activeCond?'sano':activeCond}});
  }, [value, activeCond, readOnly, onChange, getTooth]);

  const handleToggleAusente = useCallback(num => {
    if (readOnly) return;
    const t = getTooth(num);
    onChange({...value,[num]:{...t,ausente:!t.ausente}});
  }, [value, readOnly, onChange, getTooth]);

  const handleNota = useCallback((num, nota) => {
    onChange({...value,[num]:{...getTooth(num),nota}});
  }, [value, onChange, getTooth]);

  const handleClear = useCallback(num => {
    if (readOnly) return;
    onChange({...value,[num]:initTooth()});
  }, [value, readOnly, onChange]);

  // ── Drag del panel ────────────────────────────────────────────────────────────
  // Recibe también el elemento DOM del panel para leer su posición actual exacta
  const handlePanelDragStart = useCallback((e, panelEl) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container || !panelEl) return;
    const cRect = container.getBoundingClientRect();
    const pRect = panelEl.getBoundingClientRect();
    // Guardar posición inicial del panel y del mouse — el movimiento se calcula como delta
    dragRef.current = {
      active: true,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      panelStartX: pRect.left - cRect.left,
      panelStartY: pRect.top  - cRect.top,
    };
  }, []);

  const handleContainerMouseMove = useCallback(e => {
    if (!dragRef.current.active) return;
    const { mouseStartX, mouseStartY, panelStartX, panelStartY } = dragRef.current;
    setPanelPos({
      x: panelStartX + (e.clientX - mouseStartX),
      y: panelStartY + (e.clientY - mouseStartY),
    });
  }, []);

  const handleContainerMouseUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  // Reset posición al cambiar diente
  const handleClick = useCallback(num => {
    setSelected(prev => {
      const next = prev === num ? null : num;
      if (next) {
        const tp = ALL_POS.find(p => p.num === next);
        if (tp) {
          const toothPos = new THREE.Vector3(tp.x, tp.y, tp.z);
          // Zoom en la misma dirección desde la que el usuario está mirando
          const currentCam = orbitRef.current?.object?.position;
          const dir = currentCam
            ? currentCam.clone().sub(toothPos).normalize()
            : new THREE.Vector3(0, 0.3, 1).normalize();
          lerpState.current = {
            active: true,
            camPos: toothPos.clone().add(dir.multiplyScalar(7.0)),
            camTarget: toothPos,
          };
        }
      } else {
        lerpState.current = {
          active: true,
          camPos: new THREE.Vector3(0, 4, 13),
          camTarget: new THREE.Vector3(0, 0, 1.5),
        };
      }
      return next;
    });
  }, []);

  // ── Estadísticas ─────────────────────────────────────────────────────────────
  const stats = useMemo(()=>{
    const all=[...UPPER_TEETH,...LOWER_TEETH];
    const counts={};
    let sano=0, ausente=0;
    all.forEach(num=>{
      const td=value[num];
      if(td?.ausente){ausente++;return;}
      const c=getDominant(td);
      if(c==='sano'){sano++;return;}
      counts[c]=(counts[c]||0)+1;
    });
    return {counts,sano,ausente,total:all.length};
  },[value]);

  const hasConditions = Object.values(stats.counts).some(v=>v>0) || stats.ausente>0;

  const VIEWS = [
    {label:'⬆ Superior', pos:[0, 13,1],  target:[0,0,1.5]},
    {label:'⬇ Inferior', pos:[0,-13,1],  target:[0,0,1.5]},
    {label:'🔄 Frente',  pos:[0,  0,13], target:[0,0,0]  },
    {label:'↗ Lateral',  pos:[12, 1,3],  target:[0,0,0]  },
  ];

  const setCamView = useCallback((pos, target) => {
    lerpState.current = {
      active: true,
      camPos: new THREE.Vector3(...pos),
      camTarget: new THREE.Vector3(...target),
    };
  }, []);

  return (
    <div>
      {/* Selector de condición */}
      {!readOnly && (
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          <span style={{fontSize:12,color:'#64748b',alignSelf:'center',fontWeight:600,marginRight:4}}>
            Herramienta:
          </span>
          {Object.entries(CONDITIONS).map(([key,c])=>(
            <button key={key} onClick={()=>setActiveCond(key)} style={{
              display:'flex',alignItems:'center',gap:5,
              padding:'4px 10px',borderRadius:20,fontSize:11,
              border:`2px solid ${c.stroke}`,
              background:activeCond===key?c.fill:'#f8fafc',
              color:activeCond===key?'#1e293b':'#475569',
              fontWeight:activeCond===key?700:400,cursor:'pointer',
              boxShadow:activeCond===key?`0 0 0 2px ${c.stroke}55`:'none',
            }}>
              <span style={{width:11,height:11,borderRadius:3,flexShrink:0,
                background:c.fill,border:`1.5px solid ${c.stroke}`}}/>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Controles de vista y toggle arcadas */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8,alignItems:'center'}}>
        {VIEWS.map(v=>(
          <button key={v.label} onClick={()=>setCamView(v.pos,v.target)} style={{
            padding:'4px 12px',borderRadius:6,fontSize:12,
            background:'#1e293b',color:'#cbd5e1',
            border:'1px solid #374151',cursor:'pointer',
          }}>{v.label}</button>
        ))}
        <div style={{width:1,height:22,background:'#334155',margin:'0 2px'}}/>
        {/* Toggle arcadas */}
        <button onClick={()=>setShowUpper(p=>!p)} style={{
          padding:'4px 12px',borderRadius:6,fontSize:12,cursor:'pointer',
          background:showUpper?'#1e3a5f':'#1e293b',
          color:showUpper?'#93c5fd':'#64748b',
          border:`1px solid ${showUpper?'#3b82f6':'#374151'}`,
          fontWeight:showUpper?600:400,
        }}>↑ Superior</button>
        <button onClick={()=>setShowLower(p=>!p)} style={{
          padding:'4px 12px',borderRadius:6,fontSize:12,cursor:'pointer',
          background:showLower?'#1e3a5f':'#1e293b',
          color:showLower?'#93c5fd':'#64748b',
          border:`1px solid ${showLower?'#3b82f6':'#374151'}`,
          fontWeight:showLower?600:400,
        }}>↓ Inferior</button>
        <span style={{fontSize:11,color:'#94a3b8',marginLeft:2}}>
          🖱 Arrastrar=girar · Scroll=zoom · Clic=seleccionar
        </span>
      </div>

      {/* Estadísticas */}
      {hasConditions && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8,alignItems:'center'}}>
          <span style={{fontSize:11,color:'#64748b',fontWeight:600}}>Resumen:</span>
          {Object.entries(stats.counts).map(([cond,count])=>count>0&&(
            <span key={cond} style={{
              padding:'2px 10px',borderRadius:10,fontSize:11,fontWeight:700,
              background:CONDITIONS[cond]?.fill||'#94a3b8',
              color:'#1e293b',
              border:`1px solid ${CONDITIONS[cond]?.stroke||'#555'}`,
            }}>
              {CONDITIONS[cond]?.label||cond}: {count}
            </span>
          ))}
          {stats.ausente>0&&(
            <span style={{
              padding:'2px 10px',borderRadius:10,fontSize:11,fontWeight:700,
              background:'#4b5563',color:'#e5e7eb',border:'1px solid #6b7280',
            }}>Ausentes: {stats.ausente}</span>
          )}
          <span style={{fontSize:11,color:'#94a3b8'}}>
            · {stats.sano}/{stats.total} sanos
          </span>
        </div>
      )}

      {/* Canvas 3D */}
      <div ref={containerRef}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseUp}
        style={{
          position:'relative',borderRadius:12,overflow:'hidden',
          background:'linear-gradient(135deg,#0c1524 0%,#172035 60%,#0a1020 100%)',
          border:'1px solid #1e3a5f',height:490,
          boxShadow:'0 4px 24px #0008',
        }}>
        <Canvas shadows camera={{position:[0,4,13],fov:40}}
          gl={{antialias:true}} style={{width:'100%',height:'100%'}}>
          <Suspense fallback={null}>
            <Environment preset="studio"/>
            <ambientLight intensity={0.55}/>
            <directionalLight position={[5,8,5]} intensity={0.9} castShadow
              shadow-mapSize={[1024,1024]}/>
            <directionalLight position={[-4,3,-3]} intensity={0.35} color="#ffe8d0"/>
            <pointLight position={[0,2,6]} intensity={0.3} color="#fff8f0"/>

            {showUpper && <GumArch A={3.55} B={2.85} Y={ 1.02} radius={0.13}/>}
            {showLower && <GumArch A={3.35} B={2.65} Y={-1.02} radius={0.13}/>}

            {showUpper && UPPER_POS.map(pos=>(
              <Tooth key={pos.num} num={pos.num} pos={pos}
                td={value[pos.num]} selected={selected===pos.num}
                hovered={hovered===pos.num} onHover={setHovered}
                onClick={handleClick} isUpper={true}/>
            ))}

            {showLower && LOWER_POS.map(pos=>(
              <Tooth key={pos.num} num={pos.num} pos={pos}
                td={value[pos.num]} selected={selected===pos.num}
                hovered={hovered===pos.num} onHover={setHovered}
                onClick={handleClick} isUpper={false}/>
            ))}

            <CameraLerper lerpRef={lerpState} orbitRef={orbitRef}/>

            <OrbitControls ref={orbitRef} enablePan
              minDistance={3} maxDistance={22}
              minPolarAngle={0} maxPolarAngle={Math.PI*0.88}
              dampingFactor={0.08} enableDamping/>
          </Suspense>
        </Canvas>

        {selected && (
          <ToothPanel num={selected} td={getTooth(selected)} readOnly={readOnly}
            onSurface={handleSurface} onToggleAusente={handleToggleAusente}
            onNota={handleNota} onClear={handleClear} onClose={()=>handleClick(selected)}
            panelPos={panelPos} onDragStart={handlePanelDragStart}/>
        )}

        {!selected && (
          <div style={{
            position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',
            color:'rgba(148,163,184,0.50)',fontSize:11,pointerEvents:'none',
          }}>Haz clic en un diente para ver su diagnóstico</div>
        )}
      </div>

      {/* Leyenda */}
      <div style={{marginTop:10,display:'flex',flexWrap:'wrap',gap:8}}>
        {Object.entries(CONDITIONS).map(([key,c])=>(
          <div key={key} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#475569'}}>
            <span style={{width:12,height:12,borderRadius:2,background:c.fill,
              border:`1.5px solid ${c.stroke}`,display:'inline-block',flexShrink:0}}/>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
