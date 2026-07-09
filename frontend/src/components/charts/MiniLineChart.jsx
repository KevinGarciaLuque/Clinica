import { useState } from "react";
import dayjs from "dayjs";

/* ── Mini gráfico SVG de línea, con tooltip al pasar el mouse y clic para
   abrir el registro correspondiente — usado por los módulos de evolución
   clínica (Control de Seguimiento, Educación en Diabetes, etc.) ──────────── */
export default function MiniLineChart({ puntos, color, minimo = 0, maximo, unidad = "", onPointClick }) {
  const [hover, setHover] = useState(null);
  if (!puntos || puntos.length === 0) return null;
  const W = 320, H = 110, PAD = { t: 14, r: 10, b: 22, l: 30 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const rango = maximo - minimo || 1;

  const xs = puntos.map((_, i) => PAD.l + (puntos.length === 1 ? iW / 2 : (i / (puntos.length - 1)) * iW));
  const ys = puntos.map(p => PAD.t + iH - ((p.v - minimo) / rango) * iH);

  const path = puntos.length === 1 ? "" : `M ${xs.map((x, i) => `${x},${ys[i]}`).join(" L ")}`;
  const area = puntos.length > 1
    ? `M ${xs[0]},${PAD.t + iH} L ${xs.map((x, i) => `${x},${ys[i]}`).join(" L ")} L ${xs[xs.length - 1]},${PAD.t + iH} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`grad-mlc-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {puntos.map((p, i) => (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
          {dayjs(p.fecha).format("DD/MM")}
        </text>
      ))}
      {area && <path d={area} fill={`url(#grad-mlc-${color})`} />}
      {path && <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {puntos.map((p, i) => (
        <g key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(h => (h === i ? null : h))}
          onClick={() => onPointClick?.(p)}
          style={{ cursor: onPointClick ? "pointer" : "default" }}
        >
          {/* área de detección más grande que el punto visible, para hover/clic cómodo */}
          <circle cx={xs[i]} cy={ys[i]} r="12" fill="transparent" />
          <circle cx={xs[i]} cy={ys[i]} r={hover === i ? 7 : 5} fill="#fff" stroke={color} strokeWidth="2.5" style={{ transition: "r .12s" }} />
          {hover !== i && (
            <text x={xs[i]} y={ys[i] - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{p.v}</text>
          )}
        </g>
      ))}
      {hover !== null && (() => {
        const p = puntos[hover];
        const texto = `${p.v}${unidad} · ${dayjs(p.fecha).format("DD/MM/YYYY")}`;
        const boxW = Math.max(70, texto.length * 5.6);
        const boxX = Math.min(Math.max(xs[hover] - boxW / 2, 2), W - boxW - 2);
        const boxY = Math.max(ys[hover] - 34, 0);
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={boxX} y={boxY} width={boxW} height={20} rx={5} fill="#1e293b" opacity="0.92" />
            <text x={boxX + boxW / 2} y={boxY + 14} textAnchor="middle" fontSize="10" fontWeight="600" fill="#fff">{texto}</text>
          </g>
        );
      })()}
    </svg>
  );
}
