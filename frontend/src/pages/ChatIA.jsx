/**
 * FASE 6 — Asistente IA con Function Calling
 * Fix crítico: sesion_id generado y persistido en sessionStorage
 */
import { useState, useRef, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import api from "../api/api";

// ─── Gestión del ID de sesión ─────────────────────────────────────
function getOrCreateSesionId() {
  const KEY = "ia_sesion_id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    sessionStorage.setItem(KEY, id);
  }
  return id;
}
function newSesionId() {
  const KEY = "ia_sesion_id";
  const id = "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  sessionStorage.setItem(KEY, id);
  return id;
}

// ─── Renderizador Markdown básico ─────────────────────────────────
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*")  && p.endsWith("*"))  return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}
function MdText({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out = [];
  let buf = [];
  const flush = (k) => {
    if (buf.length) {
      out.push(<ul key={`ul${k}`} className="mb-1 ps-3" style={{fontSize:"inherit"}}>{buf.map((t,i)=><li key={i}>{renderInline(t)}</li>)}</ul>);
      buf = [];
    }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^[-•*]\s/.test(t)) { buf.push(t.replace(/^[-•*]\s/,"")); return; }
    if (/^\d+\.\s/.test(t))  { buf.push(t.replace(/^\d+\.\s/,"")); return; }
    flush(i);
    if (!t) { out.push(<br key={`br${i}`}/>); return; }
    if (t.startsWith("### ")) { out.push(<div key={i} className="fw-semibold mt-1">{renderInline(t.slice(4))}</div>); return; }
    if (t.startsWith("## "))  { out.push(<div key={i} className="fw-bold mt-1">{renderInline(t.slice(3))}</div>); return; }
    out.push(<span key={i}>{renderInline(t)}{" "}</span>);
  });
  flush("end");
  return <>{out}</>;
}

const SUGERENCIAS = [
  "¿Qué médicos están disponibles hoy?",
  "Agendar cita con cardiología",
  "¿Qué servicios ofrece la clínica?",
  "Buscar disponibilidad para mañana",
];

function Burbuja({ msg }) {
  const esIA = msg.rol === "IA";
  return (
    <div className={`d-flex mb-2 ${esIA ? "" : "flex-row-reverse"}`}>
      {esIA && (
        <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold me-2 flex-shrink-0"
          style={{ width: 34, height: 34, fontSize: "0.8rem" }}>
          <i className="bi bi-robot" />
        </div>
      )}
      <div
        className={`px-3 py-2 rounded-3 ${esIA ? "bg-white border shadow-sm" : "bg-primary text-white"}`}
        style={{ maxWidth: "78%", fontSize: "0.9rem", lineHeight: 1.6 }}>
        {esIA ? <MdText text={msg.texto} /> : msg.texto}
        <div className={`mt-1 text-end ${esIA ? "text-muted" : "text-white-50"}`}
          style={{ fontSize: "0.68rem" }}>
          {dayjs(msg.ts).format("HH:mm")}
        </div>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="d-flex align-items-center mb-2">
      <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold me-2 flex-shrink-0"
        style={{ width: 34, height: 34, fontSize: "1rem" }}>
        <i className="bi bi-robot" />
      </div>
      <div className="bg-white border shadow-sm px-3 py-2 rounded-3 text-muted d-flex align-items-center gap-2"
        style={{ fontSize: "0.82rem" }}>
        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
        <span>Pensando…</span>
      </div>
    </div>
  );
}

export default function ChatIA() {
  // ─── sesion_id: generado una vez y persistido en sessionStorage ───
  const [sesionId, setSesionId] = useState(() => getOrCreateSesionId());

  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [chat,    setChat]    = useState([{
    rol: "IA",
    texto: "👋 Hola, soy el asistente virtual de la clínica. Puedo ayudarte a:\n\n- Consultar médicos y especialidades disponibles\n- Ver disponibilidad de horarios\n- Agendar o cancelar citas\n- Consultar servicios y precios\n\n¿En qué puedo ayudarte hoy?",
    ts: Date.now(),
  }]);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, loading]);

  const enviar = useCallback(async (texto) => {
    const msg = (texto || input).trim();
    if (!msg || loading) return;
    setInput("");
    setChat(c => [...c, { rol: "TÚ", texto: msg, ts: Date.now() }]);
    setLoading(true);
    try {
      // ← fix crítico: sesion_id siempre incluido
      const res = await api.post("/ia/chat", { mensaje: msg, sesion_id: sesionId });
      setChat(c => [...c, { rol: "IA", texto: res.data.respuesta || "Sin respuesta.", ts: Date.now() }]);
    } catch (err) {
      const detalle = err.response?.data?.msg || err.message || "Error desconocido";
      setChat(c => [...c, {
        rol: "IA",
        texto: `Lo siento, ocurrió un error: ${detalle}\n\nIntenta nuevamente.`,
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, sesionId]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  const clearChat = () => {
    // Nueva sesión: genera un nuevo sesion_id para que el backend no mezcle historiales
    setSesionId(newSesionId());
    setInput("");
    setLoading(false);
    setChat([{ rol: "IA", texto: "Conversación reiniciada. ¿En qué puedo ayudarte?", ts: Date.now() }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="d-flex flex-column" style={{ height: "calc(100vh - 70px)" }}>
      {/* Header */}
      <div className="border-bottom px-4 py-2 d-flex align-items-center justify-content-between bg-white flex-shrink-0">
        <div className="d-flex align-items-center gap-2">
          <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
            style={{ width: 40, height: 40, fontSize: "1.1rem" }}>
            <i className="bi bi-robot" />
          </div>
          <div>
            <div className="fw-semibold" style={{ lineHeight: 1.2 }}>Asistente Clínico IA</div>
            <small className="text-success d-flex align-items-center gap-1">
              <span className="rounded-circle bg-success d-inline-block" style={{ width: 7, height: 7 }} />
              En línea · GPT-4o
            </small>
          </div>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={clearChat}>
          <i className="bi bi-plus-circle me-1" />Nueva conversación
        </button>
      </div>

      {/* Mensajes */}
      <div className="flex-grow-1 overflow-auto px-3 px-md-4 py-3"
        style={{ background: "#f5f7fb" }}>
        {chat.map((m, i) => <Burbuja key={i} msg={m} />)}
        {loading && <Typing />}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias (solo si chat == 1 mensaje) */}
      {chat.length === 1 && !loading && (
        <div className="px-3 px-md-4 pb-2 bg-white border-top flex-shrink-0">
          <div className="pt-2 pb-1">
            <small className="text-muted fw-semibold">Sugerencias rápidas:</small>
          </div>
          <div className="d-flex flex-wrap gap-1">
            {SUGERENCIAS.map((s, i) => (
              <button key={i} className="btn btn-outline-primary btn-sm rounded-pill"
                style={{ fontSize: "0.8rem" }}
                onClick={() => enviar(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-top bg-white px-3 px-md-4 py-2 flex-shrink-0">
        <form className="d-flex gap-2 align-items-end" onSubmit={e => { e.preventDefault(); enviar(); }}>
          <textarea
            ref={inputRef}
            className="form-control"
            rows={1}
            style={{ resize: "none", borderRadius: "1.5rem", padding: "0.5rem 1rem" }}
            placeholder="Escribe un mensaje… (Enter para enviar)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: 42, height: 42 }} disabled={loading || !input.trim()} title="Enviar">
            {loading
              ? <span className="spinner-border spinner-border-sm" />
              : <i className="bi bi-send-fill" style={{ fontSize: "0.95rem" }} />
            }
          </button>
        </form>
        <div className="text-center mt-1">
          <small className="text-muted">El asistente puede cometer errores. Verifica la información importante.</small>
        </div>
      </div>

      <style>{`
        .typing-dot {
          display: inline-block;
          width: 7px; height: 7px;
          background: #adb5bd;
          border-radius: 50%;
          margin: 0 2px;
          animation: typing-bounce 1.2s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: .5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

