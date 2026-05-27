import { AlertTriangle, CalendarClock, ExternalLink, FileBadge2, IdCard } from "lucide-react";
import { useMemo } from "react";

const TYPE_META = {
  licence: {
    icon: FileBadge2,
    label: "Trade Licence",
    color: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
  },
  emirates_id: {
    icon: IdCard,
    label: "Emirates ID",
    color: "bg-sky-100 text-sky-700",
    dot: "bg-sky-400",
  },
  passport: {
    icon: CalendarClock,
    label: "Passport",
    color: "bg-purple-100 text-purple-700",
    dot: "bg-purple-400",
  },
};

function formatExpiryDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ExpiryAlertPanel({ open, onClose, onOpenClient, payload, loading, error }) {
  const grouped = useMemo(() => ({
    expired: payload.alerts.filter((item) => item.status === "expired"),
    expiringSoon: payload.alerts.filter((item) => item.status === "expiring_soon"),
  }), [payload]);

  function openClient(item) {
    if (!item.clientId) return;
    onClose?.();
    onOpenClient?.(item.clientId);
  }

  return (
    <div
      className={`absolute right-0 top-[46px] z-50 w-[calc(100vw-24px)] max-w-[380px] overflow-hidden rounded-b-xl border border-t-0 border-[#e2e8f0] bg-white shadow-2xl transition-all duration-200 ${
        open
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : "translate-x-4 opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-gradient-to-r from-[#7c2d12] to-[#ea580c] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-white/75" />
            <div>
              <p className="text-[13px] font-extrabold text-white leading-none">Expiry Alerts</p>
              <p className="mt-0.5 text-[10px] font-medium text-white/65">
                {payload.total > 0
                  ? `${payload.expiredCount} expired, ${payload.expiringSoonCount} due in 15 days`
                  : "No document expiries right now"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {loading ? (
          <div className="px-4 py-8 text-center text-[13px] font-semibold text-slate-500">Loading expiry alerts...</div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-[13px] font-semibold text-slate-500">{error}</div>
        ) : payload.total === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100">
              <CalendarClock size={20} className="text-emerald-500" />
            </div>
            <p className="text-[13px] font-bold text-slate-700">No upcoming expiries</p>
            <p className="mt-1 text-[11px] text-slate-400">Licence, Emirates ID, and passport dates are clear for now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { title: "Already Expired", items: grouped.expired },
              { title: "Expiring In 15 Days", items: grouped.expiringSoon },
            ].filter((section) => section.items.length > 0).map((section) => (
              <div key={section.title}>
                <div className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">{section.title}</div>
                <div className="space-y-2">
                  {section.items.map((item, index) => {
                    const meta = TYPE_META[item.type] || TYPE_META.licence;
                    const Icon = meta.icon;
                    return (
                      <button
                        key={`${item.clientId}-${item.type}-${item.holderName}-${item.expiryDate}-${index}`}
                        type="button"
                        onClick={() => openClient(item)}
                        className={`group w-full rounded-xl border p-3 text-left shadow-sm transition hover:bg-slate-50 ${
                          item.status === "expired" ? "border-red-100 bg-red-50/50" : "border-amber-100 bg-amber-50/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${meta.color}`}>
                                <Icon size={11} />
                                {meta.label}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                                item.status === "expired" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                              }`}>
                                {item.status === "expired" ? "Expired" : "Due Soon"}
                              </span>
                            </div>
                            <p className="text-[12px] font-bold text-slate-900">{item.clientName}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {item.holderName ? `${item.holderName} · ` : ""}{item.fileNo || "No file no"}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-700">
                              Expiry Date: {formatExpiryDate(item.expiryDate)}
                            </p>
                          </div>
                          <ExternalLink size={13} className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-orange-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
