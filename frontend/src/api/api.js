import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Adjunta token + clinica id a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const clinicaId = import.meta.env.VITE_CLINICA_ID || "1";

  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["x-clinica-id"] = clinicaId;

  return config;
});

export default api;
