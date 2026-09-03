import { useState, useRef, useEffect } from "react";

/**
 * Botón "compartir link" con popover: Copiar link + WhatsApp.
 *
 * props:
 *  - url       string  URL completa a compartir
 *  - texto     string  etiqueta del botón (ej: "Link de registro")
 *  - mensaje   string  texto que acompaña al link en WhatsApp
 *  - icon      string  clase bootstrap-icons (default bi-box-arrow-up-right)
 *  - variant   "dark" | "light"  estilo del botón (default "dark", para headers oscuros)
 */
export default function CompartirLink({ url, texto = "Compartir link", mensaje = "", icon = "bi-box-arrow-up-right", variant = "dark" }) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Fallback
      const t = document.createElement("textarea");
      t.value = url; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* nada */ }
      document.body.removeChild(t);
    }
  };

  const whatsapp = () => {
    const txt = encodeURIComponent(`${mensaje ? mensaje + "\n\n" : ""}${url}`);
    window.open(`https://wa.me/?text=${txt}`, "_blank", "noopener");
    setOpen(false);
  };

  const btnStyle = variant === "dark"
    ? { background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.22)", color: "#e2e8f0" }
    : { background: "#fff", border: "1px solid #d1d5db", color: "#374151" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...btnStyle,
          borderRadius: 8, padding: "6px 14px", fontWeight: 500, fontSize: "0.8rem",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <i className={`bi ${icon}`} /> {texto}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,.18)", overflow: "hidden", minWidth: 240,
        }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Compartir</div>
            <div style={{ fontSize: "0.72rem", color: "#9ca3af", wordBreak: "break-all", lineHeight: 1.4 }}>{url}</div>
          </div>
          <button onClick={copiar}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: copiado ? "#ecfdf5" : "none", border: "none", padding: "11px 14px", fontSize: "0.85rem",
              color: copiado ? "#059669" : "#374151", cursor: "pointer" }}>
            <i className={`bi ${copiado ? "bi-check-lg" : "bi-clipboard"}`} style={{ fontSize: "1rem" }} />
            {copiado ? "¡Link copiado!" : "Copiar link"}
          </button>
          <button onClick={whatsapp}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              background: "none", border: "none", borderTop: "1px solid #f1f5f9", padding: "11px 14px",
              fontSize: "0.85rem", color: "#374151", cursor: "pointer" }}>
            <i className="bi bi-whatsapp" style={{ fontSize: "1rem", color: "#25D366" }} />
            Compartir por WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
