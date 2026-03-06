import axios from "axios";

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

    // SUPER_ADMIN puede no tener clinica_id propio; usar env var si está definida
    const clinicaId = user?.clinica_id || import.meta.env.VITE_CLINICA_ID || null;

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

    return Promise.reject(error);
  }
);

export default api;