# Hero 3D · Medic-KG

Hero con el emblema Medic-KG en 2.5D, explosión de cristales y control con el mouse.

- **Vista previa:** `/inicio-3d` (la landing completa con este hero). `/` e `/inicio` no cambian.
- **Activarlo en la home:** en `src/App.jsx` cambia `<LandingPage />` por `<LandingPage hero3d />` en la ruta `/`.

## Estructura

| Archivo | Qué hace |
|---|---|
| `MedicKGHero.jsx` / `.css` | Sección DOM: textos, botones, medición del slot del emblema, puntero, entrada de texto con GSAP, fallback sin WebGL. |
| `EmblemScene.jsx` | Canvas R3F (chunk aparte, carga diferida): cámara, luces, entorno, bucle de interacción con inercia y línea de tiempo GSAP de la explosión. |
| `Emblem.jsx` | Moneda 2.5D: logo PNG original en la cara (`toneMapped=false`, colores intactos), canto metálico, bisel y brillo especular. |
| `CrystalShards.jsx` | Fragmentos de cristal con `InstancedMesh` (2 draw calls) y parallax según profundidad. |
| `Sparks.jsx` | Partículas y destellos animados íntegramente en el shader (1 draw call). |
| `EnergyWave.jsx` | Halo, rayos, destello y ondas de energía detrás del emblema. |
| `capabilities.js` | Detecta WebGL, `prefers-reduced-motion`, puntero fino y el presupuesto de partículas del dispositivo. |

## Comportamiento

- **Escritorio:** el emblema gira hacia el cursor (±30° en horizontal, ±10° en vertical) mediante un muelle amortiguado; cuando el cursor se detiene, el emblema se asienta y se queda quieto.
- **Táctil:** explosión inicial y un vaivén ambiental suave, sin depender del puntero.
- **`prefers-reduced-motion`:** composición final estática, sin explosión ni animación de texto.
- **Sin WebGL o si el contexto falla:** logo con inclinación CSS 2.5D y cristales CSS.
- El render se pausa cuando el hero sale de la pantalla y `PerformanceMonitor` baja la resolución si caen los FPS.

## Props principales

```jsx
<MedicKGHero
  eyebrow="Sistema de gestión clínica"
  titleLead="Medic-KG:"
  titleAccent="digitaliza tu clínica"
  subtitle="…"
  actions={[{ label, icon, href | onClick, variant: "primary" | "ghost", external }]}
  features={[{ icon, label, desc }]}
  logoSrc="/hero/medickg-emblem.webp"          // textura 3D (1024 px)
  fallbackSrc="/hero/medickg-emblem-512.webp"  // imagen estática / sin WebGL
/>
```
