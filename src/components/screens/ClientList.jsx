import { Download, FileText, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useClients } from "../../hooks/useClients";
import { downloadBlob } from "../../utils/adapterUtils";
import { canCreateClients, canManageClients } from "../../utils/permissions.js";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

// ── Small document popup ──────────────────────────────────────────────────────
function DocPopup({ docs, clientName, onClose, anchorRef }) {
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const popupW = 280;
      const left = Math.min(r.left, window.innerWidth - popupW - 12);
      setPos({ top: r.bottom + 6, left: Math.max(8, left) });
    }
  }, []);

  useEffect(() => {
    function onMouseDown(e) {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed", top: pos.top, left: pos.left,
        zIndex: 99999, width: 280,
        background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: 12,
        boxShadow: "0 8px 28px rgba(30,58,138,.14), 0 2px 8px rgba(0,0,0,.08)",
        animation: "doc-pop .13s ease",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px", borderBottom: "1px solid #f1f5f9",
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
          Documents — <span style={{ color: "#64748b", fontWeight: 600 }}>{clientName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Document list */}
      <div style={{ padding: "8px 6px" }}>
        {docs.length === 0 ? (
          <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "14px 0" }}>
            No documents uploaded yet.
          </div>
        ) : (
          docs.map((doc, i) => (
            <a
              key={i}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 10px", borderRadius: 8, textDecoration: "none",
                transition: "background .12s", cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, background: "#eff6ff",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <FileText size={14} color="#1e3a8a" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {doc.label}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {doc.filename}
                </div>
              </div>
            </a>
          ))
        )}
      </div>
      <style>{`@keyframes doc-pop { from { opacity:0; transform:translateY(-4px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
    </div>
  );
}

// ── Docs cell button ──────────────────────────────────────────────────────────
function DocsCell({ client }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const count = client.documents?.length || 0;

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        title={count ? `${count} document${count > 1 ? "s" : ""}` : "No documents"}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 20,
          border: "1.5px solid",
          borderColor: count ? "#c7d7f8" : "#e2e8f0",
          background: count ? "#eff6ff" : "#f8fafc",
          color: count ? "#1e3a8a" : "#94a3b8",
          fontSize: 11, fontWeight: 700, cursor: "pointer",
          transition: "all .12s ease",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => { if (count) { e.currentTarget.style.background = "#dbeafe"; e.currentTarget.style.borderColor = "#93b3f5"; } }}
        onMouseLeave={(e) => { if (count) { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#c7d7f8"; } }}
      >
        <FileText size={12} />
        {count > 0 ? `${count} Doc${count > 1 ? "s" : ""}` : "—"}
      </button>
      {open && (
        <DocPopup
          docs={client.documents || []}
          clientName={client.name}
          anchorRef={btnRef}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ClientList() {
  const { state } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { fetchClients, deleteClient, exportClients } = useClients();
  const [query, setQuery] = useState("");
  const canManage = canManageClients(currentUser?.role);
  const canCreate = canCreateClients(currentUser?.role);
  // Docs column is visible to admin and manager only
  const canSeeDocs = currentUser?.role === "admin" || currentUser?.role === "manager";

  useEffect(() => {
    const timer = setTimeout(() => fetchClients({ search: query, page: 1, limit: 20 }).catch(() => {}), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const rows = state.clients;
  const exportCsv = async () => downloadBlob(await exportClients(), "clients.csv");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Client Directory</div>
          <h2 className="screen-title">Client List</h2>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {canCreate && (
              <Button variant="ghost" onClick={() => navigate("/clients/bulk-upload")}>
                <Upload size={16} />
                Import
              </Button>
            )}
            <Button variant="ghost" onClick={exportCsv}>
              <Download size={16} />
              Export
            </Button>
          </div>
        )}
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            id="client-search"
            name="clientSearch"
            className="input pl-9"
            placeholder="Search by name, TRN, trade licence, group"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Name + Jurisdiction</th>
              <th>Type</th>
              <th>Group</th>
              <th>Trade Licence No.</th>
              <th>VAT TRN</th>
              <th>Primary Contact</th>
              <th>Mobile</th>
              <th>Email</th>
              {canSeeDocs && <th>Documents</th>}
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((client) => (
              <tr key={client.id}>
                <td>
                  <div className="font-extrabold">{client.name}</div>
                  <div className="text-[12px] font-semibold text-slate-500">{client.jurisdiction}</div>
                </td>
                <td>
                  <Badge color={client.type === "Legal Person" ? "bg-blue-50 text-[#1e3a8a]" : "bg-emerald-50 text-[#059669]"}>
                    {client.type}
                  </Badge>
                </td>
                <td>{client.group ? <span className="rounded-full bg-purple-50 px-2 py-1 text-[11px] font-extrabold text-[#7c3aed]">{client.group}</span> : "-"}</td>
                <td>{client.licence}</td>
                <td>{client.vatTrn || "-"}</td>
                <td>{client.contact}</td>
                <td>{client.mobile}</td>
                <td>{client.email}</td>
                {canSeeDocs && (
                  <td>
                    <DocsCell client={client} />
                  </td>
                )}
                {canManage && (
                  <td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/clients/edit/${client.id}`)}>
                        <Pencil size={14} />
                      </Button>
                      {currentUser?.role === "admin" && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            if (confirm("Delete client?")) {
                              await deleteClient(client._id);
                              fetchClients();
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
