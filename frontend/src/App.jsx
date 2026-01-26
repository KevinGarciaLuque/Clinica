import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./auth/PrivateRoute";
import NavbarApp from "./components/NavbarApp";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Pacientes from "./pages/Pacientes";
import Citas from "./pages/Citas";
import ChatIA from "./pages/ChatIA";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <>
              <NavbarApp />
              <Dashboard />
            </>
          </PrivateRoute>
        }
      />

      <Route
        path="/pacientes"
        element={
          <PrivateRoute>
            <>
              <NavbarApp />
              <Pacientes />
            </>
          </PrivateRoute>
        }
      />

      <Route
        path="/citas"
        element={
          <PrivateRoute>
            <>
              <NavbarApp />
              <Citas />
            </>
          </PrivateRoute>
        }
      />

      <Route
        path="/chat-ia"
        element={
          <PrivateRoute>
            <>
              <NavbarApp />
              <ChatIA />
            </>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
