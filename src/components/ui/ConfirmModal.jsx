import React from "react";
import { AlertTriangle } from "lucide-react";

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  isDanger = false 
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${isDanger ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-slate-900">{title}</h3>
              <p className="mt-1 text-[13px] font-medium text-slate-500">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 bg-slate-50 px-5 py-4">
          <button 
            onClick={onClose} 
            className="rounded-lg px-4 py-2 text-[12px] font-bold text-slate-600 transition hover:bg-slate-200"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { 
              onConfirm(); 
              onClose(); 
            }} 
            className={`rounded-lg px-4 py-2 text-[12px] font-bold text-white transition ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
