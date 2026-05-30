import { Building2, Clock, ExternalLink, FileText, Mail, MapPin, Phone, User, UserCheck, X, Globe, SlidersHorizontal, ShieldCheck, BadgeCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { clientService } from "../../services/clientService.js";
import { resolveMediaUrl } from "../../utils/mediaUrl.js";
import { canManageClients } from "../../utils/permissions.js";
import Button from "./Button.jsx";
import Card from "./Card.jsx";

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function openDocumentFile(document) {
  if (!document?.url) return;
  window.open(resolveMediaUrl(document.url), "_blank", "noopener,noreferrer");
}

function mapAttachmentItem(file, subcategory = "") {
  return {
    id: file?._id || `${subcategory}-${file?.url || file?.name || "attachment"}`,
    name: file?.name || file?.url?.split("/").pop() || "Attachment",
    size: file?.size || "",
    description: file?.description || "",
    uploadedBy: file?.uploadedBy?.name || "",
    url: file?.url || "",
    subcategory,
  };
}

function collectAttachmentGroups(client) {
  if (!client) return [];

  const groups = [];
  const appendGroup = (title, items) => {
    if (items.length) groups.push({ title, items });
  };

  appendGroup("General Attachments", (client.attachments || []).map((file) => mapAttachmentItem(file)));
  appendGroup(
    "Trade Licence",
    (client.tradeLicences || []).flatMap((licence, index) =>
      (licence.documents || []).map((file) => mapAttachmentItem(file, licence.licenceNumber || `Trade Licence ${index + 1}`))),
  );
  appendGroup(
    "Emirates ID",
    (client.contactPersons || []).flatMap((person, index) => {
      const label = person.fullName || `Contact ${index + 1}`;
      return [
        ...((person.emiratesId?.documents || []).map((file) => mapAttachmentItem(file, label))),
        ...((person.emiratesId?.frontDocuments || []).map((file) => mapAttachmentItem(file, `${label} Front`))),
        ...((person.emiratesId?.backDocuments || []).map((file) => mapAttachmentItem(file, `${label} Back`))),
      ];
    }),
  );
  appendGroup(
    "Passport",
    (client.contactPersons || []).flatMap((person, index) =>
      (person.passport?.documents || []).map((file) => mapAttachmentItem(file, person.fullName || `Contact ${index + 1}`))),
  );

  return groups;
}

function DetailRow({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-slate-800">{value || "-"}</div>
    </div>
  );
}

export default function ClientDrawer({ clientId, onClose }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canManage = canManageClients(currentUser?.role);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClient = useCallback(async (active = true) => {
    setLoading(true);
    setError("");
    try {
      const data = await clientService.get(clientId);
      if (active) setClient(data);
    } catch (err) {
      if (active) setError(err.response?.data?.message || "Failed to load client details");
    } finally {
      if (active) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clientId, onClose]);

  useEffect(() => {
    if (!clientId) return undefined;
    let active = true;
    loadClient(active);
    return () => {
      active = false;
    };
  }, [clientId, loadClient]);

  if (!clientId) return null;

  const contactPersons = client?.contactPersons || [];
  const tradeLicences = client?.tradeLicences || [];
  const portals = client?.portalLogins || [];
  const customFields = client?.customFields || {};
  const attachmentGroups = collectAttachmentGroups(client);

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[680px] flex-col border-l border-[#dbe4f0] bg-[#f8fbff] shadow-[-24px_0_60px_rgba(15,23,42,0.16)]" aria-label="Client details">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-4">
          <div>
            <div className="page-kicker">Client Detail</div>
            <div className="mt-1 text-[18px] font-black text-slate-900">{client?.legalName || "Loading client"}</div>
            {client?.fileNo && <div className="mt-1 text-[12px] font-semibold text-slate-500">File No: {client.fileNo}</div>}
          </div>
          <div className="flex items-center gap-2">
            {client && canManage && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/edit/${client._id}`)}>
                <ExternalLink size={15} />
                Edit page
              </Button>
            )}
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe4f0] bg-slate-50 text-slate-500 transition hover:bg-slate-100" title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="task-detail-loader" />
            </div>
          ) : error ? (
            <Card className="p-8 text-center">
              <p className="text-[15px] font-bold text-slate-800">{error}</p>
            </Card>
          ) : !client ? null : (
            <div className="space-y-5">
              <Card className="p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="task-detail-icon-box">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Client</div>
                    <div className="text-[16px] font-extrabold text-slate-900">{client.legalName}</div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailRow label="Type" value={client.clientType === "natural" ? "Natural Person" : "Legal Person"} />
                  <DetailRow label="Jurisdiction" value={client.jurisdiction} />
                  <DetailRow label="Trade Name" value={client.tradeName} />
                  <DetailRow label="Financial Year End" value={client.financialYearEnd} />
                  <DetailRow label="Assigned User" value={client.assignedUser?.name} />
                  <DetailRow label="Group" value={client.group?.name} />
                  <DetailRow label="Created Date" value={formatDate(client.createdAt)} />
                  <DetailRow label="Created By" value={client.createdBy?.name} />
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                  <User size={16} /> Contact Details
                </div>
                {contactPersons.length === 0 ? (
                  <div className="text-[13px] font-semibold text-slate-500">No contact persons added.</div>
                ) : (
                  <div className="space-y-6">
                    {contactPersons.map((contact, idx) => (
                      <div key={idx} className={idx > 0 ? "pt-4 border-t border-slate-100" : ""}>
                        <div className="mb-3 flex items-center gap-2">
                          <div className="text-[14px] font-bold text-slate-800">{contact.fullName || `Contact ${idx + 1}`}</div>
                          {contact.isPrimary && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-600">Primary</span>
                          )}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <DetailRow label="Official Contact" value={contact.fullName} />
                          <DetailRow label="Designation" value={contact.designation} />
                          <DetailRow label="Email" value={contact.email} />
                          <DetailRow label="Phone No" value={[contact.mobile?.countryCode, contact.mobile?.number].filter(Boolean).join(" ")} />
                          <DetailRow label="WhatsApp" value={contact.whatsapp} />
                          <DetailRow label="Alternate Email" value={contact.alternateEmail} />
                          <DetailRow label="Emirates ID" value={contact.emiratesId?.number} />
                          <DetailRow label="EID Expiry" value={formatDate(contact.emiratesId?.expiryDate)} />
                          <DetailRow label="Passport No" value={contact.passport?.number} />
                          <DetailRow label="Passport Expiry" value={formatDate(contact.passport?.expiryDate)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                  <MapPin size={16} /> Address
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailRow label="Country" value={client.registeredAddress?.country} />
                  <DetailRow label="Emirate/State" value={client.registeredAddress?.emirate} />
                  <DetailRow label="Street" value={client.registeredAddress?.street} />
                  <DetailRow label="PO Box" value={client.registeredAddress?.poBox} />
                  <DetailRow label="Postal Code" value={client.registeredAddress?.postalCode} />
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                  <BadgeCheck size={16} /> Trade Licences
                </div>
                {tradeLicences.length === 0 ? (
                  <div className="text-[13px] font-semibold text-slate-500">No trade licences added.</div>
                ) : (
                  <div className="space-y-6">
                    {tradeLicences.map((licence, idx) => (
                      <div key={idx} className={idx > 0 ? "pt-4 border-t border-slate-100" : ""}>
                        <div className="mb-3 text-[14px] font-bold text-slate-800">Licence {idx + 1}</div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <DetailRow label="Licence Number" value={licence.licenceNumber} />
                          <DetailRow label="Issuing Authority" value={licence.issuingAuthority} />
                          <DetailRow label="Licence Type" value={licence.licenceType} />
                          <DetailRow label="Issue Date" value={formatDate(licence.issueDate)} />
                          <DetailRow label="Expiry Date" value={formatDate(licence.expiryDate)} />
                          <DetailRow label="Official Email" value={licence.officialEmail} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                  <ShieldCheck size={16} /> VAT Details
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailRow label="TRN" value={client.vatDetails?.trn} />
                  <DetailRow label="Status" value={client.vatDetails?.status} />
                  <DetailRow label="Registration Date" value={formatDate(client.vatDetails?.registrationDate)} />
                  <DetailRow label="Filing Frequency" value={client.vatDetails?.filingFrequency} />
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                  <ShieldCheck size={16} /> Corporate Tax Details
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailRow label="TIN" value={client.ctDetails?.tin} />
                  <DetailRow label="Status" value={client.ctDetails?.status} />
                  <DetailRow label="Registration Date" value={formatDate(client.ctDetails?.registrationDate)} />
                </div>
              </Card>

              {portals.length > 0 && (
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                    <Globe size={16} /> Portal Logins
                  </div>
                  <div className="space-y-6">
                    {portals.map((portal, idx) => (
                      <div key={idx} className={idx > 0 ? "pt-4 border-t border-slate-100" : ""}>
                        <div className="mb-3 text-[14px] font-bold text-slate-800">{portal.portalName || `Portal ${idx + 1}`}</div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <DetailRow label="Portal URL" value={portal.portalUrl} />
                          <DetailRow label="Username" value={portal.username} />
                          <DetailRow label="Notes" value={portal.notes} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {Object.keys(customFields).length > 0 && (
                <Card className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                    <SlidersHorizontal size={16} /> Custom Fields
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(customFields).map(([key, value]) => (
                      <DetailRow key={key} label={key} value={value} />
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2 text-[16px] font-extrabold text-slate-900">
                  <Mail size={16} /> Attachments
                </div>
                {!attachmentGroups.length ? (
                  <div className="text-[13px] font-semibold text-slate-500">No attachments uploaded yet.</div>
                ) : (
                  <div className="space-y-4">
                    {attachmentGroups.map((group) => (
                      <div key={group.title} className="space-y-2">
                        <div className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{group.title}</div>
                        {group.items.map((attachment) => (
                          <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-bold text-slate-800">{attachment.name}</div>
                              <div className="text-[11px] font-semibold text-slate-500">
                                {[attachment.subcategory, attachment.size, attachment.description, attachment.uploadedBy].filter(Boolean).join(" • ")}
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" disabled={!attachment.url} onClick={() => openDocumentFile(attachment)}>Open</Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
