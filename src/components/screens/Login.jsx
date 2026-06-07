import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCircle2, ShieldCheck, Zap, ArrowRight, Eye, EyeOff } from "lucide-react";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Logo Brand Colors
  const brandBlue = "#191D7C";
  const brandYellow = "#f8c00a";

  async function submit(event) {
    event.preventDefault();
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

  const features = [
    {
      icon: <ShieldCheck className="h-6 w-6" style={{ color: brandBlue }} />,
      title: "UAE Corporate Tax & VAT",
      desc: "Expert assistance with UAE tax registration and compliance."
    },
    {
      icon: <Zap className="h-6 w-6" style={{ color: brandYellow }} />,
      title: "PRO & Company Setup",
      desc: "Seamless business incorporation and local sponsorship services."
    },
    {
      icon: <CheckCircle2 className="h-6 w-6" style={{ color: brandYellow }} />,
      title: "Accounting & Audit",
      desc: "Reliable financial reporting and external audit assurance."
    }
  ];

  return (
    <div className="relative flex h-screen w-full bg-[#05081a] text-white overflow-hidden">
      {/* Brand-Split Background */}
      <div className="absolute inset-0 z-0 flex">
        {/* Blue Side */}
        <div className="relative flex-1 bg-[#05081a] overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse opacity-40" style={{ backgroundColor: brandBlue }} />
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-20" style={{ backgroundColor: brandBlue }} />
        </div>
        
        {/* Yellow Side */}
        <div className="relative flex-1 bg-[#05081a] overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] animate-pulse opacity-20" style={{ backgroundColor: brandYellow }} />
          <div className="absolute bottom-[10%] left-[10%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-10" style={{ backgroundColor: brandYellow }} />
        </div>

        {/* Diagonal Overlay (Split focus) */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${brandBlue}33 0%, transparent 50%, ${brandYellow}11 100%)` }} />

        {/* Subtle Texture */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex w-full h-full overflow-hidden">
        {/* Left Side: Information & Brand (Hidden on Mobile) */}
        <div className="hidden lg:flex flex-col flex-[0.8] xl:flex-1 justify-between p-4 xl:p-8 h-full overflow-hidden">
          <div className="flex items-center gap-4 mb-2 xl:mb-4 shrink-0">
            <div className="flex h-12 items-center justify-center p-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
              <img 
                src="https://filingbuddy.global/admin/assets/images/uploads/logo/logo2.svg"
                alt="Filing Buddy" 
                className="h-8 w-auto"
                onError={(e) => {
                  e.target.src = "https://filingbuddy.global/admin/assets/images/uploads/logo/logo2.svg";
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter uppercase leading-none" style={{ color: 'white' }}>Filing Buddy</span>
              <span className="text-[9px] font-bold tracking-[0.2em] uppercase mt-0.5" style={{ color: brandYellow }}>UAE Compliance Experts</span>
            </div>
          </div>

          <div className="max-w-xl flex-1 flex flex-col justify-center overflow-hidden py-2">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest mb-2 w-fit backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: brandBlue }}></span>
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: brandBlue }}></span>
              </span>
              <span className="text-slate-300">Trusted by 2000+ Businesses</span>
            </div>
            
            <h2 className="text-2xl xl:text-4xl font-black leading-[1.05] tracking-tight mb-2">
              Empowering Your <br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, white, ${brandYellow})` }}>Growth in the UAE</span>
            </h2>
            
            <p className="text-xs xl:text-base text-slate-300/70 leading-relaxed max-w-lg font-medium mb-4">
              Simplifying Corporate Tax, VAT, and PRO services so you can focus on building your empire.
            </p>

            <div className="grid grid-cols-1 gap-2 xl:gap-3 overflow-y-auto pr-4 custom-scrollbar">
              {features.map((feature, i) => (
                <div key={i} className="group flex items-center gap-3 p-3 rounded-[20px] bg-white/[0.02] hover:bg-white/[0.06] transition-all duration-500 border border-white/5 hover:border-white/10 shrink-0">
                  <div className="flex-shrink-0 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-500 shadow-2xl">
                    {React.cloneElement(feature.icon, { className: "h-4 w-4" })}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-0.5 transition-colors group-hover:text-white">{feature.title}</h3>
                    <p className="text-[10px] text-slate-400 font-medium leading-snug">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold text-slate-500 pt-4 mt-auto shrink-0 border-t border-white/5">
            <span className="text-slate-400">&copy; 2026 Filing Buddy Accounting LLC</span>
            <div className="h-1 w-1 rounded-full bg-slate-800" />
            <a href="#" className="hover:text-white transition-colors uppercase tracking-wider">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors uppercase tracking-wider">Terms of Service</a>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-2 h-full overflow-y-auto custom-scrollbar bg-black/40 backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none">
          <div className="w-full max-w-[400px] bg-[#111827]/60 backdrop-blur-2xl p-6 lg:p-8 rounded-[32px] border border-white/10 shadow-[0_0_80px_-15px_rgba(0,0,0,0.6)] my-auto shrink-0 relative overflow-hidden group">
            {/* Form Glow Effects */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] group-hover:opacity-100 opacity-50 transition-opacity duration-700" style={{ backgroundColor: brandBlue + '33' }} />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-[80px] group-hover:opacity-100 opacity-50 transition-opacity duration-700" style={{ backgroundColor: brandYellow + '11' }} />

            <div className="flex flex-col items-center mb-4 relative">
              <div className="h-14 w-28 flex items-center justify-center rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 mb-3 shadow-2xl transition-transform hover:scale-105 duration-500">
                <img 
                  src="https://filingbuddy.global/admin/assets/images/uploads/logo/logo2.svg" 
                  alt="Filing Buddy" 
                  className="h-8 w-auto"
                  onError={(e) => {
                    e.target.src = "https://filingbuddy.global/admin/assets/images/uploads/logo/logo2.svg";
                  }}
                />
              </div>
              <h1 className="text-xl font-black text-white tracking-tight uppercase text-center">Welcome Back</h1>
              <p className="text-slate-400 font-bold text-[9px] mt-1.5 uppercase tracking-[0.25em]">Portal Authorization Required</p>
            </div>

            <form onSubmit={submit} className="space-y-3 relative">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 ml-2 uppercase tracking-[0.2em]">Registered Email</label>
                <div className="relative group/input">
                  <input 
                    id="login-email" 
                    name="email" 
                    className="h-11 w-full px-5 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:bg-white/[0.08] transition-all outline-none text-xs font-medium" 
                    style={{ '--tw-ring-color': brandBlue + '33' }}
                    type="email" 
                    autoComplete="email" 
                    placeholder="name@company.com"
                    required 
                    value={form.email} 
                    onChange={(e) => setForm({ ...form, email: e.target.value })} 
                  />
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-transparent to-transparent group-focus-within/input:via-blue-500 transition-all duration-500 rounded-full" />
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between ml-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Access Token</label>
                  <button type="button" className="text-[9px] font-bold hover:text-white transition-colors uppercase tracking-widest" style={{ color: brandYellow }}>Recover?</button>
                </div>
                <div className="relative group/input">
                  <input 
                    id="login-password" 
                    name="password" 
                    className="h-11 w-full px-5 pr-12 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:bg-white/[0.08] transition-all outline-none text-xs font-medium" 
                    type={showPassword ? "text" : "password"} 
                    autoComplete="current-password" 
                    placeholder="••••••••"
                    required 
                    value={form.password} 
                    onChange={(e) => setForm({ ...form, password: e.target.value })} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-transparent to-transparent group-focus-within/input:via-yellow-500 transition-all duration-500 rounded-full" />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  type="submit"
                  className="w-full h-11 text-[10px] font-black rounded-xl shadow-2xl active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-white border-none overflow-hidden relative group/btn" 
                  style={{ background: `linear-gradient(135deg, ${brandBlue} 0%, #1e25a5 100%)` }}
                  disabled={loading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                  {loading ? "Verifying Credentials..." : (
                    <span className="flex items-center justify-center gap-2 relative z-10">
                      Secure Login <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3 relative">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div className="flex items-center gap-6">
                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Need Help? <a href="https://filingbuddy.global/en-ae/contact-us" target="_blank" rel="noreferrer" className="transition-colors hover:text-white" style={{ color: brandYellow }}>Contact Support</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


