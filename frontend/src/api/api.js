import axios from "axios";
import { getClinicaActiva } from "../utils/clinicaActiva";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Adjunta token + clinica_id a cada request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    // SUPER_ADMIN no tiene clínica propia. Si eligió una "clínica activa"
    // (ver Clínicas → Ver pacientes) se manda esa; si no, se omite el header
    // y el backend exige explícitamente seleccionar una donde haga falta.
    const clinicaActivaId = user?.tipo === "SUPER_ADMIN" ? getClinicaActiva()?.id : null;
    const clinicaId = user?.clinica_id || clinicaActivaId || import.meta.env.VITE_CLINICA_ID || null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (clinicaId) {
      config.headers["x-clinica-id"] = String(clinicaId);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    if (error.response?.status === 402 && error.response?.data?.licencia_vencida) {
      // Notificar al resto de la app que la licencia venció
      window.dispatchEvent(new CustomEvent("licenciaVencida", { detail: error.response.data }));
    }
    return Promise.reject(error);
  }
);

export default api;