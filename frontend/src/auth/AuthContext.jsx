import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  // Módulos activos de la clínica (se cargan tras login o al montar con token)
  const [modulos, setModulos] = useState(() => {
    const raw = localStorage.getItem("modulos");
    return raw ? JSON.parse(raw) : [];
  });

  const isAuth = !!user;

  /** Carga (o recarga) los módulos del usuario autenticado */
  const cargarModulos = async () => {
    try {
      const res = await api.get("/clinicas/modulos");
      const lista = res.data.data || [];
      localStorage.setItem("modulos", JSON.stringify(lista));
      setModulos(lista);
      return lista;
    } catch {
      return [];
    }
  };

  // Si hay token al montar (refresh de página), recargar módulos
  useEffect(() => {
    if (user && !modulos.length) {
      cargarModulos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, usuario } = res.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(usuario));
    setUser(usuario);

    // Cargar módulos inmediatamente tras login
    await cargarModulos();

    return usuario;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("modulos");
    setUser(null);
    setModulos([]);
  };

  return (
    <AuthContext.Provider value={{ user, isAuth, modulos, login, logout, cargarModulos }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
