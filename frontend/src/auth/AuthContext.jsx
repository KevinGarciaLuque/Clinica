import { createContext, useContext, useState } from "react";
import api from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const isAuth = !!localStorage.getItem("token");

  const login = async (email, password) => {
    const res = await api.post("/api/auth/login", { email, password });
    const { token, usuario } = res.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(usuario));
    setUser(usuario);

    return usuario;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
