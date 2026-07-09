import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ConfigSistemaProvider } from "./context/ConfigSistemaContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./index.css";
import "./App.css";

// Tras un nuevo deploy, los chunks viejos dejan de existir en el servidor.
// Si una pestaña ya abierta intenta cargar uno, recargamos una sola vez
// para traer el index.html y los hashes de assets actuales.
window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  const key = "reload-por-chunk-viejo";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigSistemaProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfigSistemaProvider>
    </BrowserRouter>
  </React.StrictMode>
);
