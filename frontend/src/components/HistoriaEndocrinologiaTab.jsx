import { useState, useEffect, useCallback } from "react";
import api from "../api/api";
import { useAuth } from "../auth/AuthContext";
import TabHistoria from "../pages/endocrinologia/TabHistoria";
import { emptyHistoria, deepMerge } from "../pages/endocrinologia/shared";

// Tab "Historia Clínica" del perfil del paciente — reutiliza el mismo
// formulario (TabHistoria) que usa la página completa de Control de Seguimiento.
export default function HistoriaEndocrinologiaTab({ paciente, pacienteId }) {
  const { user } = useAuth();
  const [formHistoria, setFormHistoria] = useState(emptyHistoria);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/endocrinologia/historia/${pacienteId}`);
      if (r.data.data) {
        setFormHistoria(deepMerge(emptyHistoria, r.data.data));
      } else {
        const medicoSugerido = user ? `${user.nombres || ""} ${user.apellidos || ""}`.trim() : "";
        setFormHistoria({ ...emptyHistoria, medico: medicoSugerido });
      }
    } catch {
      setMsg({ tipo: "err", texto: "Error al cargar la historia clínica" });
    } finally {
      setLoading(false);
    }
  }, [pacienteId, user]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarHistoria = async () => {
    setGuardando(true);
    try {
      await api.post(`/endocrinologia/historia/${pacienteId}`, formHistoria);
      setMsg({ tipo: "ok", texto: "Historia clínica guardada" });
    } catch (e) {
      setMsg({ tipo: "err", texto: e.response?.data?.msg || "Error al guardar historia" });
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#ea580c", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 14 }}>Cargando historia clínica...</span>
    </div>
  );

  return (
    <div>
      {msg && (
        <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600, background: msg.tipo === "ok" ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)", color: msg.tipo === "ok" ? "#059669" : "#dc2626" }}>
          {msg.texto}
        </div>
      )}
      <TabHistoria paciente={paciente} formHistoria={formHistoria} setFormHistoria={setFormHistoria} guardando={guardando} guardarHistoria={guardarHistoria} />
    </div>
  );
}
