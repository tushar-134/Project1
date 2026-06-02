import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  allowClear = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const display = selectedOption ? selectedOption.label : "";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className="input flex cursor-pointer items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={display ? "text-slate-900" : "text-slate-400"}>
          {display || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {allowClear && value && (
            <button
              type="button"
              className="text-slate-400 transition hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <ul className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`cursor-pointer rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-blue-50 hover:text-[#1e3a8a] ${
                  opt.value === value ? "bg-blue-50/70 text-[#1e3a8a]" : "text-slate-700"
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
