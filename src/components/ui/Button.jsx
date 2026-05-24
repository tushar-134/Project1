export default function Button({ children, type = "button", variant = "primary", size = "md", className = "", ...props }) {
  // UI primitives centralize the original prototype styling so feature work does not fork button treatments.
  const variants = {
    primary: "bg-[#1e3a8a] text-white hover:bg-[#162d6e]",
    accent: "bg-[#eab308] text-white hover:brightness-95",
    ghost: "bg-white text-slate-700 border border-[#e2e8f0] hover:bg-slate-50",
    danger: "bg-[#dc2626] text-white hover:brightness-95",
    success: "bg-[#059669] text-white hover:brightness-95",
  };
  const sizes = { sm: "min-h-8 px-3 text-[12px]", md: "min-h-9 px-4 text-[13px]", lg: "min-h-10 px-5 text-[14px]" };
  return <button type={type} className={`inline-flex items-center justify-center gap-2 rounded-lg py-1.5 font-bold leading-tight transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
}
