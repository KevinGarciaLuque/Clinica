import { useState } from "react";

const norm = (t) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Citas del día separadas por etapa (por llegar / en espera / en atención / atendidos)
 * con filtros con contador y buscador por paciente. Muestra un grupo a la vez para que
 * la lista siga siendo corta aunque la clínica atienda 15 o 20 pacientes al día.
 *
 * grupos:      [{ id, titulo, icono, badge: { bg, fg }, ayuda, citas }]
 * nombreDe:    (cita) => texto por el que busca el buscador
 * renderTabla: (citas, grupo) => nodo con la tabla de ese grupo
 */
export default function GruposLlegadas({ grupos, nombreDe, renderTabla }) {
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState(null);

  const q = norm(busqueda);
  const conVisibles = grupos.map((g) => ({
    ...g,
    visibles: q ? g.citas.filter((c) => norm(nombreDe(c)).includes(q)) : g.citas,
  }));

  // Sin elección del usuario: el primer grupo que tenga citas (por llegar → en espera → …)
  const porDefecto = conVisibles.find((g) => g.citas.length > 0)?.id ?? conVisibles[0]?.id;
  const activoId = elegido && conVisibles.some((g) => g.id === elegido) ? elegido : porDefecto;
  const activo = conVisibles.find((g) => g.id === activoId);
  const total = grupos.reduce((n, g) => n + g.citas.length, 0);

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        {conVisibles.map((g) => {
          const seleccionado = g.id === activoId;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setElegido(g.id)}
              aria-pressed={seleccionado}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                fontSize: "0.82rem", fontWeight: 700,
                border: `1.5px solid ${seleccionado ? g.badge.fg : "#e5e7eb"}`,
                background: seleccionado ? g.badge.bg : "#fff",
                color: seleccionado ? g.badge.fg : "#6b7280",
                transition: "all .15s",
              }}
            >
              <i className={`bi ${g.icono}`} aria-hidden="true" />
              {g.titulo}
              <span style={{
                background: seleccionado ? g.badge.fg : "#f1f5f9",
                color: seleccionado ? "#fff" : "#475569",
                borderRadius: 999, padding: "1px 9px", fontSize: "0.72rem", fontWeight: 800,
              }}>
                {g.visibles.length}
              </span>
            </button>
          );
        })}

        {total > 0 && (
          <div style={{ marginLeft: "auto", position: "relative", minWidth: 200 }}>
            <i className="bi bi-search" aria-hidden="true" style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              color: "#9ca3af", fontSize: 13, pointerEvents: "none",
            }} />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar paciente…"
              aria-label="Buscar paciente"
              style={{
                width: "100%", padding: "7px 12px 7px 32px", borderRadius: 999,
                border: "1.5px solid #e5e7eb", fontSize: "0.82rem", outline: "none",
              }}
            />
          </div>
        )}
      </div>

      {activo?.ayuda && <div style={{ fontSize: "0.77rem", color: "#9ca3af", marginBottom: 10 }}>{activo.ayuda}</div>}

      {activo && activo.visibles.length > 0 ? (
        renderTabla(activo.visibles, activo)
      ) : (
        <div style={{ textAlign: "center", padding: "36px 0", color: "#9ca3af" }}>
          <i className={`bi ${q ? "bi-search" : "bi-person-check"}`} style={{ fontSize: "2.4rem", opacity: 0.3 }}></i>
          <p style={{ marginTop: 10, fontSize: "0.88rem" }}>
            {q ? "Ningún paciente coincide con la búsqueda en este grupo." : "No hay citas en este grupo."}
          </p>
        </div>
      )}
    </div>
  );
}
