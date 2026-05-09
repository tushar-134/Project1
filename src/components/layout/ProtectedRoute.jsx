import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, currentUser, loading } = useAuth();
  if (loading) return null;
  // Route guards live here so screens do not need to know about auth redirects or role redirects.
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles?.length && !roles.includes(currentUser?.role)) {
    toast.error("You do not have permission to access that page.");
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
