import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toSentenceCase } from "../../utils/textCase";

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  allowClear = false,
  sentenceCaseLabels = false,
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (open && listRef.current && focusedIndex >= 0) {
      const li = listRef.current.children[focusedIndex];
      if (li) li.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, open]);

  const selectedOption = options.find((o) => o.value === value);
  const display = selectedOption
    ? sentenceCaseLabels
      ? toSentenceCase(selectedOption.label)
      : selectedOption.label
    : "";

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        const idx = options.findIndex((o) => o.value === value);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        onChange(options[focusedIndex].value);
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className="input flex cursor-pointer items-center justify-between outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
        onClick={() => {
          if (!open) {
            const idx = options.findIndex((o) => o.value === value);
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
          setOpen((o) => !o);
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
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
                setFocusedIndex(-1);
              }}
              tabIndex={-1}
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
          <ul ref={listRef} className="max-h-60 overflow-y-auto p-1 custom-scrollbar" role="listbox">
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isFocused = idx === focusedIndex;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                    isFocused ? "bg-blue-100/80 text-[#1e3a8a]" : isSelected ? "bg-blue-50/70 text-[#1e3a8a]" : "text-slate-700 hover:bg-blue-50 hover:text-[#1e3a8a]"
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                >
                  {sentenceCaseLabels ? toSentenceCase(opt.label) : opt.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
