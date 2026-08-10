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

  // Info de licencia de la clínica
  const [licenciaInfo, setLicenciaInfo] = useState(() => {
    const raw = localStorage.getItem("licencia_info");
    return raw ? JSON.parse(raw) : null;
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

  // Si hay token al montar (refresh de página), siempre recargar módulos del servidor
  // para que cambios en BD (nuevos módulos asignados) se reflejen sin necesidad de re-login
  useEffect(() => {
    if (user) {
      cargarModulos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });

    // El usuario tiene 2FA activado: aún no hay sesión — falta el código
    // enviado a su correo (ver verificar2FA). Se devuelve el pre_token para
    // que el segundo paso del login lo complete.
    if (res.data.requiere_2fa) {
      return { requiere_2fa: true, pre_token: res.data.pre_token, email: res.data.email };
    }

    const { token, usuario, licencia_info } = res.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(usuario));
    if (licencia_info) {
      localStorage.setItem("licencia_info", JSON.stringify(licencia_info));
    }
    setUser(usuario);
    setLicenciaInfo(licencia_info || null);

    // Cargar módulos inmediatamente tras login
    await cargarModulos();

    return usuario;
  };

  /** Segundo paso del login cuando el usuario tiene 2FA activado */
  const verificar2FA = async (preToken, codigo) => {
    const res = await api.post("/auth/login/verificar-2fa", { pre_token: preToken, codigo });
    const { token, usuario, licencia_info } = res.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(usuario));
    if (licencia_info) {
      localStorage.setItem("licencia_info", JSON.stringify(licencia_info));
    }
    setUser(usuario);
    setLicenciaInfo(licencia_info || null);

    await cargarModulos();

    return usuario;
  };

  const loginConGoogle = async (idToken) => {
    const res = await api.post("/auth/google-login", { id_token: idToken });
    const { token, usuario, licencia_info } = res.data;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(usuario));
    if (licencia_info) {
      localStorage.setItem("licencia_info", JSON.stringify(licencia_info));
    }
    setUser(usuario);
    setLicenciaInfo(licencia_info || null);

    await cargarModulos();

    return usuario;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("modulos");
    localStorage.removeItem("licencia_info");
    setUser(null);
    setModulos([]);
    setLicenciaInfo(null);
  };

  /** Actualiza el usuario en estado y localStorage (tras editar perfil) */
  const updateUser = (cambios) => {
    setUser(prev => {
      const updated = { ...prev, ...cambios };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuth, modulos, licenciaInfo, login, verificar2FA, loginConGoogle, logout, cargarModulos, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
