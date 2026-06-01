import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clientService } from "../../services/clientService";
import { mapClient } from "../../utils/adapterUtils";

/**
 * Searchable client combobox.
 *
 * Props:
 *   clients        – array of { _id|id, name|legalName }
 *   value          – currently selected value (ID or name, depending on useNameAsValue)
 *   onChange       – called with the selected ID (useNameAsValue=false) or name (useNameAsValue=true)
 *   useNameAsValue – if true, onChange receives the client name string; otherwise the client _id
 *   placeholder    – input placeholder text
 *   inputId        – id attribute for the <input> (for label association)
 */
export default function ClientComboBox({
  clients = [],
  value = "",
  onChange,
  useNameAsValue = false,
  placeholder = "Search client…",
  inputId = "clientComboBox",
}) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [localClients, setLocalClients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Synchronize localClients with the clients prop on mount/change
  useEffect(() => {
    setLocalClients(clients);
  }, [clients]);

  // Resolve display name for the currently selected value
  const selected = useNameAsValue
    ? localClients.find((c) => (c.name || c.legalName) === value)
    : localClients.find((c) => (c._id || c.id) === value);

  // If a value is selected but not in the clients array, fetch it by ID so it displays correctly
  useEffect(() => {
    if (!value || useNameAsValue) return;
    const exists = clients.some((c) => (c._id || c.id) === value);
    if (!exists) {
      clientService.get(value)
        .then((data) => {
          if (data) {
            const mapped = mapClient(data);
            setLocalClients((prev) => {
              const alreadyHas = prev.some((c) => (c._id || c.id) === mapped._id);
              return alreadyHas ? prev : [...prev, mapped];
            });
          }
        })
        .catch(() => {});
    }
  }, [value, clients, useNameAsValue]);

  // Debounced search when input changes and the dropdown is open
  useEffect(() => {
    if (!open) return;

    const delayDebounce = setTimeout(() => {
      setLoading(true);
      clientService.list({ search: inputValue.trim() || undefined, limit: 10 })
        .then((data) => {
          const raw = Array.isArray(data) ? data : (data.clients || data.items || []);
          const mapped = raw.map(mapClient);
          setLocalClients(mapped);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [inputValue, open]);

  // Filter clients by the current typed query
  const filtered = localClients.filter((c) => {
    const name = c.name || c.legalName || "";
    return !inputValue.trim() || name.toLowerCase().includes(inputValue.toLowerCase());
  });

  // When closed and a client is selected, show its name; while open keep typed query
  const displayValue = open ? inputValue : (selected ? (selected.name || selected.legalName) : inputValue);


  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        // Revert to selected name or empty on blur without selection
        setInputValue(selected ? (selected.name || selected.legalName) : "");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [selected]);

  function handleFocus() {
    setInputValue(""); // clear so user can type a fresh search
    setOpen(true);
  }

  function handleChange(e) {
    setInputValue(e.target.value);
    setOpen(true);
  }

  function handleSelect(client) {
    const outValue = useNameAsValue
      ? (client.name || client.legalName)
      : (client._id || client.id);
    onChange(outValue);
    setInputValue(client.name || client.legalName);
    setOpen(false);
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange("");
    setInputValue("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <input
          id={inputId}
          name={inputId}
          className="input pr-14"
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={displayValue}
          onFocus={handleFocus}
          onChange={handleChange}
        />
        <span className="pointer-events-none absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              className="pointer-events-auto text-slate-400 transition hover:text-slate-600"
              onMouseDown={handleClear}
              aria-label="Clear client"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={13}
            className={`pointer-events-none text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </div>
      {open && (
        <ul className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white shadow-lg custom-scrollbar">
          {loading ? (
            <li className="flex items-center gap-2 px-4 py-3 text-[12px] text-slate-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[#1e3a8a]" />
              Searching...
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-3 text-[12px] text-slate-400">No clients found</li>
          ) : (
            filtered.map((c) => {
              const name = c.name || c.legalName;
              const id = c._id || c.id;
              const isSelected = useNameAsValue ? name === value : id === value;
              return (
                <li
                  key={id}
                  onMouseDown={() => handleSelect(c)}
                  className={`cursor-pointer px-4 py-2.5 text-[13px] transition-colors hover:bg-blue-50 hover:text-[#1e3a8a] ${
                    isSelected
                      ? "bg-blue-50/70 font-extrabold text-[#1e3a8a]"
                      : "font-semibold text-slate-700"
                  }`}
                >
                  {name}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
