import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import InactivityGuard from "../components/InactivityGuard";

export default function PrivateRoute({ children }) {
  const { isAuth } = useAuth();
  if (!isAuth) return <Navigate to="/login" replace />;
  return <InactivityGuard>{children}</InactivityGuard>;
}
