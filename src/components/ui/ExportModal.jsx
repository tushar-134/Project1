import React, { useState } from "react";
import { ChevronLeft, Download, X, Columns, SlidersHorizontal } from "lucide-react";

/**
 * A reusable modal for exporting data with options for Visible Columns, All Fields, and Selected Fields.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback to close the modal
 * @param {string} props.title - Title of the modal (e.g. "Export Clients")
 * @param {string} props.entityName - Name of the entity being exported (e.g. "clients", "tasks") for subtitles
 * @param {Array<{key: string, label: string}>} props.baseFields - The core fields available for selection
 * @param {Array<{key: string, label: string, type: string}>} [props.customFields] - Optional custom fields available for selection
 * @param {Function} props.onExportVisible - Callback when "Export Visible Columns" is clicked
 * @param {Function} props.onExportAll - Callback when "Export All Fields" is clicked
 * @param {Function} props.onExportSelected - Callback when "Export Selected Fields" is clicked, receives array of selected keys
 */
export default function ExportModal({
  isOpen,
  onClose,
  title,
  entityName = "records",
  baseFields = [],
  customFields = [],
  onExportVisible,
  onExportAll,
  onExportSelected,
}) {
  const [exportMode, setExportMode] = useState("pick"); // "pick" or "select"
  const [selectedExportFields, setSelectedExportFields] = useState(() => new Set(baseFields.map(f => f.key)));

  if (!isOpen) return null;

  const toggleExportField = (key) => {
    setSelectedExportFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClose = () => {
    onClose();
    // Delay resetting mode to prevent visual jump during exit animation if any
    setTimeout(() => setExportMode("pick"), 200);
  };

  const handleExportSelected = () => {
    onExportSelected(Array.from(selectedExportFields));
  };

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <div className="flex items-center gap-2">
            {exportMode === "select" && (
              <button
                onClick={() => setExportMode("pick")}
                className="mr-1 grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#1e3a8a] text-white">
              <Download size={14} />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">
                {exportMode === "select" ? "Choose Fields to Export" : title}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {exportMode === "select"
                  ? "Check the fields you want in the Excel file"
                  : "Choose what to include in the Excel file"}
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Option picker view ── */}
        {exportMode === "pick" && (
          <>
            <div className="space-y-3 p-5">
              {/* Export Visible */}
              {onExportVisible && (
                <button
                  type="button"
                  onClick={onExportVisible}
                  className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#1e3a8a] hover:bg-blue-50/50 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-[#1e3a8a] group-hover:text-white">
                      <Columns size={16} />
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-slate-900">Export Visible Columns</div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Downloads only the columns currently shown in the table
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Export All */}
              {onExportAll && (
                <button
                  type="button"
                  onClick={onExportAll}
                  className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-white">
                      <Download size={16} />
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-slate-900">Export All Fields</div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Full export — all available data for these {entityName}
                      </div>
                    </div>
                  </div>
                  {customFields.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                      {["Core data", "Custom fields"].map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )}

              {/* Export Selected */}
              {onExportSelected && (
                <button
                  type="button"
                  onClick={() => setExportMode("select")}
                  className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-500 hover:bg-violet-50/50 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-violet-50 text-violet-600 transition group-hover:bg-violet-500 group-hover:text-white">
                      <SlidersHorizontal size={16} />
                    </div>
                    <div>
                      <div className="text-[13px] font-extrabold text-slate-900">Export Selected Fields</div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        Pick exactly which fields to include
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </div>
            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <p className="text-[11px] font-medium text-slate-400">
                Export respects your current search and filter settings.
              </p>
            </div>
          </>
        )}

        {/* ── Field picker / checklist view ── */}
        {exportMode === "select" && (
          <>
            <div className="max-h-[360px] space-y-4 overflow-y-auto px-4 py-3">
              {/* Base fields */}
              <div>
                <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Core Fields
                </div>
                <div className="space-y-1">
                  {baseFields.map((f) => (
                    <label
                      key={f.key}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-[#1e3a8a]"
                        checked={selectedExportFields.has(f.key)}
                        onChange={() => toggleExportField(f.key)}
                      />
                      <span className="text-[12px] font-semibold text-slate-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom fields */}
              {customFields && customFields.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    Custom Fields
                  </div>
                  <div className="space-y-1">
                    {customFields.map((f) => (
                      <label
                        key={f.key}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-[#1e3a8a]"
                          checked={selectedExportFields.has(f.key)}
                          onChange={() => toggleExportField(f.key)}
                        />
                        <span className="flex-1 text-[12px] font-semibold text-slate-700">{f.label}</span>
                        {f.type && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold capitalize text-slate-400">
                            {f.type}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <span className="text-[11px] font-medium text-slate-400">
                {selectedExportFields.size} field{selectedExportFields.size !== 1 ? "s" : ""} selected
              </span>
              <button
                type="button"
                disabled={selectedExportFields.size === 0}
                onClick={handleExportSelected}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a8a] px-4 py-2 text-[12px] font-extrabold text-white shadow-sm transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={13} />
                Download
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
