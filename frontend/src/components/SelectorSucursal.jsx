import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { cargarSucursales, getSucursalActiva, setSucursalActiva } from "../utils/sucursalActiva";

/**
 * Selector de sucursal en la barra superior. Solo aparece si la clínica tiene
 * 2 o más sucursales activas. Al cambiar, la página se recarga con los datos
 * de esa sucursal (agenda, sala de espera, caja, facturación, finanzas).
 */
export default function SelectorSucursal() {
  const { user } = useAuth();
  const [info, setInfo] = useState(null);
  const [actual, setActual] = useState(() => getSucursalActiva());

  useEffect(() => {
    if (!user || user.tipo === "SUPER_ADMIN") return undefined;
    let vivo = true;
    cargarSucursales(api).then((d) => {
      if (!vivo) return;
      const guardada = getSucursalActiva();
      if (!d.multiple) {
        // Una sola sede: no se manda nada (como siempre)
        if (guardada) { setSucursalActiva(null); setActual(null); }
        setInfo(null);
        return;
      }
      const valida = d.sucursales.some((s) => s.id === guardada);
      if (!valida && (guardada || !d.puede_todas)) {
        const nueva = d.puede_todas ? null : d.sucursales[0]?.id || null;
        setSucursalActiva(nueva);
        setActual(nueva);
      }
      setInfo(d);
    });
    return () => { vivo = false; };
  }, [user]);

  if (!info) return null;

  const cambiar = (e) => {
    const id = Number(e.target.value) || null;
    setSucursalActiva(id);
    setActual(id);
    window.location.reload();
  };

  return (
    <label
      className="selector-sucursal"
      title="Sucursal"
      style={{
        display: "flex", alignItems: "center", gap: 6, margin: 0, flexShrink: 1, minWidth: 0,
        background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)",
        borderRadius: 10, padding: "4px 8px", color: "#e0ecff", cursor: "pointer",
      }}
    >
      <i className="bi bi-shop" style={{ color: "#93c5fd", flexShrink: 0 }} />
      <select
        value={actual || ""}
        onChange={cambiar}
        aria-label="Sucursal"
        style={{
          background: "transparent", border: "none", color: "#e0ecff", fontSize: ".82rem",
          fontWeight: 600, outline: "none", cursor: "pointer", minWidth: 0, maxWidth: 200,
          textOverflow: "ellipsis",
        }}
      >
        {info.puede_todas && <option value="" style={{ color: "#111" }}>Todas las sucursales</option>}
        {info.sucursales.map((s) => (
          <option key={s.id} value={s.id} style={{ color: "#111" }}>{s.nombre}</option>
        ))}
      </select>
    </label>
  );
}
