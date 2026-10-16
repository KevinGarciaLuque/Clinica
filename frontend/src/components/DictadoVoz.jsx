// 🎤 Dictado por voz en cualquier campo de texto grande (textarea) del sistema.
// Al entrar a un campo aparece un botón de micrófono en su esquina: el médico
// habla y el texto se escribe donde está el cursor. No hay que modificar cada
// formulario: el texto se inserta como si se hubiera tecleado, así que React lo
// guarda igual que siempre.
//
// Usa el reconocimiento de voz del navegador (Chrome, Edge, Safari). En los que
// no lo tienen (p. ej. Firefox) el botón simplemente no aparece.
// Para excluir un campo: <textarea data-sin-dictado />. Para incluir un <input>: data-dictado.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const Reconocimiento = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Comandos de puntuación que se pueden decir mientras se dicta (los largos primero)
const COMANDOS = [
  [/\b(punto y aparte|nuevo párrafo)\b/gi, ".\n"],
  [/\b(nueva línea|nuevo renglón|siguiente línea)\b/gi, "\n"],
  [/\bpunto y coma\b/gi, ";"],
  [/\bdos puntos\b/gi, ":"],
  [/\bpunto final\b/gi, "."],
  [/\bpunto\b/gi, "."],
  [/\bcoma\b/gi, ","],
  [/\babrir paréntesis\b/gi, "("],
  [/\bcerrar paréntesis\b/gi, ")"],
  [/\bguion\b/gi, "-"],
];

function aplicarComandos(texto) {
  let t = ` ${texto} `;
  for (const [re, rep] of COMANDOS) t = t.replace(re, rep);
  return t
    .replace(/\s+([.,;:)])/g, "$1")        // sin espacio antes de la puntuación
    .replace(/\(\s+/g, "(")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^ /, "").replace(/ $/, "");
}

const mayuscula = (s) => s.replace(/^(\s*)(\p{L})/u, (_, esp, l) => esp + l.toUpperCase());

/** Inserta texto en el campo, en la posición del cursor, avisando a React. */
function insertarEn(el, textoBruto) {
  let texto = aplicarComandos(textoBruto);
  if (!texto) return;
  const valor = el.value || "";
  const ini = el.selectionStart ?? valor.length;
  const fin = el.selectionEnd ?? ini;
  const antes = valor.slice(0, ini);

  // Espacio de separación y mayúscula al inicio de oración
  if (antes && !/[\s(]$/.test(antes) && !/^[.,;:)\n]/.test(texto)) texto = " " + texto;
  if (!antes.trim() || /[.!?]\s*$/.test(antes) || /\n\s*$/.test(antes)) texto = mayuscula(texto);
  texto = texto.replace(/([.!?]\s+|\n)(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());

  let nuevo = antes + texto + valor.slice(fin);
  if (el.maxLength > 0 && nuevo.length > el.maxLength) nuevo = nuevo.slice(0, el.maxLength);

  // Setter nativo + evento "input": React actualiza su estado como si se tecleara
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, nuevo);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const pos = Math.min((antes + texto).length, nuevo.length);
  try { el.setSelectionRange(pos, pos); } catch { /* algunos inputs no lo permiten */ }
}

const esCampoDictable = (el) =>
  el && !el.disabled && !el.readOnly && !el.hasAttribute("data-sin-dictado") &&
  (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.hasAttribute("data-dictado")));

const idioma = () => {
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("es") ? navigator.language : "es-HN";
};

const CSS = `
  .dv-btn { position: fixed; z-index: 1900; width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 15px; color: #fff;
    background: #2563eb; box-shadow: 0 2px 8px rgba(37,99,235,.45); transition: transform .15s, background .15s; }
  .dv-btn:hover { transform: scale(1.08); }
  .dv-btn.on { background: #dc2626; box-shadow: 0 0 0 0 rgba(220,38,38,.55); animation: dvPulso 1.4s infinite; }
  @keyframes dvPulso { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,.55); } 70% { box-shadow: 0 0 0 10px rgba(220,38,38,0); } 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); } }
  .dv-burbuja { position: fixed; z-index: 1901; max-width: min(360px, calc(100vw - 24px)); background: #0f172a; color: #fff;
    font-size: 12.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,.25); pointer-events: none; }
  .dv-burbuja small { display: block; color: #94a3b8; font-size: 11px; margin-top: 2px; }
`;

export default function DictadoVoz() {
  const [campo, setCampo] = useState(null);      // textarea con foco (o el que se está dictando)
  const [rect, setRect] = useState(null);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [aviso, setAviso] = useState("");
  const recRef = useRef(null);
  const activoRef = useRef(false);               // el usuario quiere seguir dictando
  const campoRef = useRef(null);

  const medir = useCallback(() => {
    const el = campoRef.current;
    if (!el || !document.body.contains(el)) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < window.innerHeight && r.width > 60;
    setRect(visible ? { top: r.top, right: r.right, bottom: r.bottom, left: r.left } : null);
  }, []);

  const detener = useCallback(() => {
    activoRef.current = false;
    setEscuchando(false);
    setParcial("");
    try { recRef.current?.stop(); } catch { /* ya estaba detenido */ }
  }, []);

  // Seguir el campo con foco
  useEffect(() => {
    if (!Reconocimiento) return;
    const alEntrar = (e) => {
      if (!esCampoDictable(e.target)) return;
      if (campoRef.current && campoRef.current !== e.target && activoRef.current) detener();
      campoRef.current = e.target;
      setCampo(e.target);
      setAviso("");
      medir();
    };
    const alSalir = (e) => {
      if (e.target !== campoRef.current) return;
      // Se espera un momento: tocar el botón del micrófono no debe esconderlo
      setTimeout(() => {
        if (document.activeElement === campoRef.current) return;
        if (activoRef.current) detener();
        campoRef.current = null;
        setCampo(null);
        setRect(null);
      }, 150);
    };
    document.addEventListener("focusin", alEntrar);
    document.addEventListener("focusout", alSalir);
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      document.removeEventListener("focusin", alEntrar);
      document.removeEventListener("focusout", alSalir);
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [medir, detener]);

  // Mientras se dicta el campo puede crecer: se re-mide
  useEffect(() => {
    if (!escuchando) return;
    const iv = setInterval(medir, 400);
    const esc = (e) => { if (e.key === "Escape") detener(); };
    window.addEventListener("keydown", esc);
    return () => { clearInterval(iv); window.removeEventListener("keydown", esc); };
  }, [escuchando, medir, detener]);

  useEffect(() => () => { activoRef.current = false; try { recRef.current?.abort(); } catch { /* nada */ } }, []);

  const iniciar = () => {
    if (!campoRef.current) return;
    const rec = new Reconocimiento();
    rec.lang = idioma();
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let interino = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          if (campoRef.current) insertarEn(campoRef.current, r[0].transcript.trim());
        } else {
          interino += r[0].transcript;
        }
      }
      setParcial(interino.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setAviso("Permite el uso del micrófono en el navegador (candado junto a la dirección) para dictar.");
        detener();
      } else if (ev.error === "audio-capture") {
        setAviso("No se encontró un micrófono conectado.");
        detener();
      } else if (ev.error === "network") {
        setAviso("Sin conexión: el dictado necesita internet.");
        detener();
      }
      // "no-speech" y "aborted": se reinicia solo en onend si sigue activo
    };
    // El navegador corta tras un silencio: si el médico no lo detuvo, se reanuda
    rec.onend = () => {
      if (activoRef.current && campoRef.current) {
        try { rec.start(); return; } catch { /* no se pudo reanudar */ }
      }
      setEscuchando(false);
      setParcial("");
    };
    recRef.current = rec;
    activoRef.current = true;
    setAviso("");
    try {
      rec.start();
      setEscuchando(true);
    } catch {
      activoRef.current = false;
      setAviso("No se pudo iniciar el dictado. Intenta de nuevo.");
    }
  };

  if (!Reconocimiento || !campo || !rect) return null;

  const top = Math.max(6, rect.top + 6);
  const left = Math.min(window.innerWidth - 36, rect.right - 36);
  const burbujaArriba = rect.top > 70;
  const burbujaEstilo = burbujaArriba
    ? { top: Math.max(6, rect.top - 52), left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) }
    : { top: rect.bottom + 8, left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) };

  return createPortal(
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className={`dv-btn ${escuchando ? "on" : ""}`}
        style={{ top, left }}
        title={escuchando ? "Detener dictado (Esc)" : "Dictar por voz"}
        aria-label={escuchando ? "Detener dictado" : "Dictar por voz"}
        aria-pressed={escuchando}
        onMouseDown={(e) => e.preventDefault()}   // no quitar el foco del campo
        onClick={() => (escuchando ? detener() : iniciar())}
      >
        <i className={`bi ${escuchando ? "bi-stop-fill" : "bi-mic-fill"}`} />
      </button>
      {(escuchando || aviso) && (
        <div className="dv-burbuja" style={burbujaEstilo} role="status" aria-live="polite">
          {aviso || (parcial ? `“${parcial}…”` : "🎤 Escuchando… habla con normalidad")}
          {!aviso && <small>Di “punto”, “coma” o “nueva línea”. Toca ■ o Esc para terminar.</small>}
        </div>
      )}
    </>,
    document.body
  );
}
