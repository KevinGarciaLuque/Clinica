import { createContext, useContext, useState, useEffect, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULTS = {
  nombre_sistema:  "KG-Medic",
  subtitulo:       "Sistema de gestión clínica",
  logo_url:        "",
  icono_bootstrap: "bi-hospital",
  fondo_login_url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1920&q=80",
  copyright_texto: "KG-Medic · Todos los derechos reservados",
  color_primario:  "#3b82f6",
  color_nombre1:   "#ffffff",
  color_nombre2:   "#2D6BE8",
};

const ConfigSistemaContext = createContext(DEFAULTS);

export function ConfigSistemaProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/config-sistema`);
      const json = await res.json();
      if (json.ok && json.data) {
        setConfig({ ...DEFAULTS, ...json.data });
      }
    } catch {
      // fallback silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const recargar = () => cargar();

  // Resuelve la URL completa del logo
  const logoUrl = config.logo_url
    ? (config.logo_url.startsWith("http") ? config.logo_url : `${API_URL}${config.logo_url}`)
    : null;

  // Resuelve la URL completa del fondo
  const fondoUrl = config.fondo_login_url
    ? (config.fondo_login_url.startsWith("http") ? config.fondo_login_url : `${API_URL}${config.fondo_login_url}`)
    : DEFAULTS.fondo_login_url;

  return (
    <ConfigSistemaContext.Provider value={{ ...config, logoUrl, fondoUrl, loading, recargar }}>
      {children}
    </ConfigSistemaContext.Provider>
  );
}

export function useConfigSistema() {
  return useContext(ConfigSistemaContext);
}
