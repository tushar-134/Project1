import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    // Login is kept minimal here because AuthContext owns token persistence and session bootstrap.
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (error) {
      const message = error.response?.data?.message
        || (error.request ? "Unable to reach the server. Please check that the API is running." : null)
        || error.message
        || "Sign in failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f1f5f9] p-6">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eab308] text-lg font-black text-white">FB</div>
          <h1 className="text-[20px] font-extrabold text-slate-900">Filing Buddy</h1>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">Filing Buddy Accounting LLC</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="login-email"><span className="field-label">Email</span><input id="login-email" name="email" className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label htmlFor="login-password"><span className="field-label">Password</span><input id="login-password" name="password" className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <Button className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</Button>
          {/* ya space dena hai */}
          <button type="button" disabled className="w-full text-center text-[12px] font-bold text-slate-400 cursor-not-allowed">Forgot password? (coming soon)</button>
        </form>
      </Card>
    </div >
  );
}


