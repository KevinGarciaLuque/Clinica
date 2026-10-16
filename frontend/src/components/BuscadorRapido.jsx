// 🔎 Búsqueda rápida: Ctrl+K (o ⌘K en Mac) desde cualquier pantalla, o el botón
// de la lupa en la barra superior. Encuentra un paciente por nombre, DNI o teléfono
// y lleva a su perfil o historia; también salta a las pantallas más usadas.
// Recuerda los últimos pacientes abiertos (solo en este navegador).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import useClinicaActiva from "../utils/useClinicaActiva";

const CLAVE_RECIENTES = "buscador_recientes";
const esMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const PANTALLAS = [
  { to: "/dashboard",            label: "Dashboard",            icon: "bi-speedometer2" },
  { to: "/pacientes",            label: "Pacientes",            icon: "bi-people-fill" },
  { to: "/pacientes?nuevo=true", label: "Registrar paciente",   icon: "bi-person-plus-fill" },
  { to: "/citas",                label: "Citas · Programar",    icon: "bi-calendar-plus" },
  { to: "/citas?view=agenda",    label: "Agenda",               icon: "bi-calendar3" },
  { to: "/citas?tab=sala",       label: "Sala de espera",       icon: "bi-hospital" },
  { to: "/historia",             label: "Historia clínica",     icon: "bi-journal-medical" },
  { to: "/cumpleaneros",         label: "Cumpleañeros",         icon: "bi-cake2-fill" },
  { to: "/perfil",               label: "Mi perfil",            icon: "bi-person-circle" },
  { to: "/admin/usuarios",       label: "Usuarios",             icon: "bi-person-badge-fill", roles: ["ADMIN"] },
  { to: "/admin/config",         label: "Configuración",        icon: "bi-gear-fill",         roles: ["ADMIN"] },
];

// Sin tildes ni mayúsculas, para comparar "historia" con "Historia clínica"
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function leerRecientes(uid) {
  try { return JSON.parse(localStorage.getItem(`${CLAVE_RECIENTES}_${uid}`) || "[]").slice(0, 5); } catch { return []; }
}
function guardarReciente(uid, p) {
  try {
    const lista = [{ id: p.id, nombres: p.nombres, apellidos: p.apellidos, dni: p.dni, edad: p.edad }, ...leerRecientes(uid).filter((r) => r.id !== p.id)].slice(0, 5);
    localStorage.setItem(`${CLAVE_RECIENTES}_${uid}`, JSON.stringify(lista));
  } catch { /* sin almacenamiento */ }
}

const CSS = `
  .br-btn { height: 34px; border-radius: 10px; border: 1px solid rgba(147,197,253,.25); background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.75); display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; font-size: 13px; cursor: pointer; white-space: nowrap; }
  .br-btn:hover { background: rgba(255,255,255,.12); color: #fff; }
  .br-btn kbd { background: rgba(255,255,255,.12); color: rgba(255,255,255,.8); border-radius: 5px; padding: 1px 6px; font-size: 11px; font-family: inherit; }
  @media (max-width: 767.98px) { .br-btn { padding: 0 9px; } .br-btn .br-txt, .br-btn kbd { display: none; } }
  .br-fondo { position: fixed; inset: 0; z-index: 2000; background: rgba(15,23,42,.55); display: flex; justify-content: center; align-items: flex-start; padding: 10vh 12px 12px; }
  .br-caja { width: 100%; max-width: 580px; background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.35); overflow: hidden; display: flex; flex-direction: column; max-height: 75vh; }
  .br-entrada { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #e5e7eb; }
  .br-entrada input { flex: 1; min-width: 0; border: none; outline: none; font-size: 16px; color: #0f172a; background: transparent; }
  .br-lista { overflow-y: auto; padding: 6px; }
  .br-grupo { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; padding: 8px 10px 4px; }
  .br-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px; cursor: pointer; color: #1e293b; min-width: 0; }
  .br-item.sel { background: #eef2ff; }
  .br-av { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg,#3b82f6,#6366f1); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .br-sub { font-size: 12px; color: #64748b; }
  .br-acc { margin-left: auto; display: flex; gap: 4px; flex-shrink: 0; }
  .br-acc button { border: 1px solid #c7d2fe; background: #fff; color: #4338ca; border-radius: 7px; font-size: 12px; padding: 3px 8px; white-space: nowrap; }
  .br-acc button:hover { background: #e0e7ff; }
  .br-pie { border-top: 1px solid #e5e7eb; padding: 7px 14px; font-size: 11.5px; color: #94a3b8; display: flex; gap: 14px; flex-wrap: wrap; }
  .br-pie kbd { background: #f1f5f9; color: #475569; border-radius: 4px; padding: 0 5px; font-family: inherit; border: 1px solid #e2e8f0; }
  @media (max-width: 575.98px) { .br-fondo { padding-top: 12px; } .br-caja { max-height: calc(100dvh - 24px); } .br-pie { display: none; } .br-acc .br-hist-txt { display: none; } }
`;

export default function BuscadorRapido() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const clinicaActiva = useClinicaActiva();
  // El super admin solo busca pacientes cuando está viendo una clínica puntual
  const disponible = !!user && (!user.super || !!clinicaActiva);

  // Atajo global Ctrl+K / ⌘K
  useEffect(() => {
    if (!disponible) return;
    const tecla = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [disponible]);

  if (!disponible) return null;
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="br-btn" onClick={() => setAbierto(true)} title={`Buscar paciente (${esMac ? "⌘" : "Ctrl"}+K)`} aria-label="Buscar paciente">
        <i className="bi bi-search" /><span className="br-txt">Buscar</span><kbd>{esMac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      {abierto && createPortal(<Panel user={user} navigate={navigate} cerrar={() => setAbierto(false)} />, document.body)}
    </>
  );
}

function Panel({ user, navigate, cerrar }) {
  const uid = user.uid || user.id;
  const [q, setQ] = useState("");
  const [pacientes, setPacientes] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [sel, setSel] = useState(0);
  const [recientes] = useState(() => leerRecientes(uid));
  const inputRef = useRef(null);
  const listaRef = useRef(null);
  const texto = q.trim();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Búsqueda de pacientes con una pequeña espera mientras se escribe
  useEffect(() => {
    if (texto.length < 2) return;
    let vivo = true;
    const t = setTimeout(() => {
      setBuscando(true);
      api.get("/pacientes", { params: { q: texto } })
        .then((r) => { if (vivo) { setPacientes((r.data.data || []).slice(0, 8)); setAviso(""); } })
        .catch((e) => { if (vivo) { setPacientes([]); setAviso(e.response?.data?.msg || "No se pudo buscar"); } })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 220);
    return () => { vivo = false; clearTimeout(t); };
  }, [texto]);

  const pantallas = useMemo(() => {
    const visibles = PANTALLAS.filter((p) => !p.roles || p.roles.includes(user.tipo));
    if (!texto) return visibles.slice(0, 6);
    const n = normal(texto);
    return visibles.filter((p) => normal(p.label).includes(n)).slice(0, 5);
  }, [texto, user.tipo]);

  const listaPacientes = texto.length >= 2 ? pacientes : recientes;
  const items = [
    ...listaPacientes.map((p) => ({ tipo: "paciente", p })),
    ...pantallas.map((s) => ({ tipo: "pantalla", s })),
  ];
  const seleccion = Math.min(sel, Math.max(0, items.length - 1));

  const ir = useCallback((ruta, paciente) => {
    if (paciente) guardarReciente(uid, paciente);
    cerrar();
    navigate(ruta);
  }, [uid, cerrar, navigate]);

  const abrirItem = (it, historia = false) => {
    if (!it) return;
    if (it.tipo === "paciente") ir(historia ? `/historia/${it.p.id}` : `/pacientes/${it.p.id}/perfil`, it.p);
    else ir(it.s.to);
  };

  const teclas = (e) => {
    if (e.key === "Escape") { e.preventDefault(); cerrar(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel(items.length ? (seleccion + 1) % items.length : 0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(items.length ? (seleccion - 1 + items.length) % items.length : 0); }
    else if (e.key === "Enter") { e.preventDefault(); abrirItem(items[seleccion], e.shiftKey); }
  };

  useEffect(() => {
    listaRef.current?.querySelector(".br-item.sel")?.scrollIntoView({ block: "nearest" });
  }, [seleccion]);

  const filaPaciente = (p, i) => {
    const ini = `${p.nombres?.[0] || ""}${p.apellidos?.[0] || ""}`.toUpperCase();
    return (
      <div key={`p${p.id}`} className={`br-item ${i === seleccion ? "sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => abrirItem({ tipo: "paciente", p })}>
        <div className="br-av">{ini || <i className="bi bi-person" />}</div>
        <div style={{ minWidth: 0 }}>
          <div className="text-truncate" style={{ fontWeight: 600, fontSize: 14 }}>{p.nombres} {p.apellidos}</div>
          <div className="br-sub text-truncate">{[p.dni ? `DNI ${p.dni}` : null, p.edad != null ? `${p.edad} años` : null, p.telefono].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="br-acc">
          <button type="button" title="Abrir historia clínica" onClick={(e) => { e.stopPropagation(); abrirItem({ tipo: "paciente", p }, true); }}>
            <i className="bi bi-journal-medical" /><span className="br-hist-txt"> Historia</span>
          </button>
        </div>
      </div>
    );
  };
  const filaPantalla = (s, j) => {
    const i = listaPacientes.length + j;
    return (
      <div key={s.to} className={`br-item ${i === seleccion ? "sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => abrirItem({ tipo: "pantalla", s })}>
        <i className={`bi ${s.icon}`} style={{ width: 32, textAlign: "center", color: "#6366f1", fontSize: 16 }} />
        <span style={{ fontSize: 14 }}>{s.label}</span>
        <i className="bi bi-arrow-return-left ms-auto" style={{ color: "#cbd5e1", visibility: i === seleccion ? "visible" : "hidden" }} />
      </div>
    );
  };

  return (
    <div className="br-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="br-caja" role="dialog" aria-label="Búsqueda rápida">
        <div className="br-entrada">
          <i className="bi bi-search" style={{ color: "#6366f1", fontSize: 17 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={teclas}
            placeholder="Buscar paciente por nombre, DNI o teléfono…"
            data-sin-dictado
            autoComplete="off"
          />
          {buscando && <span className="spinner-border spinner-border-sm text-primary" />}
          <button type="button" className="btn btn-sm btn-light" onClick={cerrar} aria-label="Cerrar" style={{ fontSize: 12 }}>Esc</button>
        </div>

        <div className="br-lista" ref={listaRef}>
          {listaPacientes.length > 0 && (
            <>
              <div className="br-grupo">{texto.length >= 2 ? "Pacientes" : "Abiertos recientemente"}</div>
              {listaPacientes.map(filaPaciente)}
            </>
          )}
          {texto.length >= 2 && !buscando && !pacientes.length && (
            <div style={{ padding: "14px 10px", color: "#64748b", fontSize: 13.5 }}>
              <i className="bi bi-person-x me-1" />{aviso || `Ningún paciente coincide con “${texto}”.`}
            </div>
          )}
          {pantallas.length > 0 && (
            <>
              <div className="br-grupo">Ir a</div>
              {pantallas.map(filaPantalla)}
            </>
          )}
          {texto.length === 1 && <div style={{ padding: "6px 10px", color: "#94a3b8", fontSize: 12.5 }}>Escribe al menos 2 letras para buscar pacientes.</div>}
        </div>

        <div className="br-pie">
          <span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span>
          <span><kbd>Enter</kbd> abrir perfil</span>
          <span><kbd>Shift</kbd>+<kbd>Enter</kbd> historia clínica</span>
          <span><kbd>Esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
