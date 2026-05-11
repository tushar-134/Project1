import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { useUsers } from "../../hooks/useUsers";
import { groupService } from "../../services/groupService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";

const tabs = ["Basic Details", "Trade Licences", "Contact Persons", "VAT / CT", "Client Group", "Portal Logins", "Custom Fields", "Attachments"];
const countryCodes = ["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS","SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW"];

export default function AddClient() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { createClient } = useClients();
  const { fetchUsers } = useUsers();
  const [tab, setTab] = useState(0);
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    let codes = countryCodes;
    try {
      codes = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("region") : countryCodes;
    } catch {
      codes = countryCodes;
    }
    const base = codes.map((code) => names.of(code)).filter(Boolean).sort();
    return ["United Arab Emirates", ...[...new Set(base)].filter((country) => country !== "United Arab Emirates")];
  }, []);
  const [form, setForm] = useState({
    clientType: "Legal Person", fileNo: "FB-C-0048", legalName: "", tradeName: "", fye: "31 December", jurisdiction: "Mainland", assigned: "Sara Mahmoud",
    country: "United Arab Emirates", emirate: "Dubai", street: "", poBox: "", postalCode: "", differentAddress: false, correspondence: "",
    vatTrn: "", vatStatus: "Registered", vatDate: "", vatFreq: "Quarterly", ctTin: "", ctStatus: "Not Registered", ctDate: "", group: "", newGroup: "",
    qrmp: "Email", auditFirm: "", bank: "", iban: "",
  });
  const [licences, setLicences] = useState([{ number: "", issue: "", expiry: "", authority: "Dubai Economy", type: "Commercial", email: "" }]);
  const [contacts, setContacts] = useState([{ name: "", designation: "", email: "", code: "+971", mobile: "", whatsapp: "", alternate: "", primary: true, eid: "", passport: "", issuingCountry: "United Arab Emirates" }]);
  const [portals, setPortals] = useState([{ name: "EmaraTax", url: "https://tax.gov.ae", username: "", password: "", notes: "" }]);
  const [attachments, setAttachments] = useState([{ name: "Trade Licence.pdf", size: "1.2 MB", type: "PDF", description: "Current licence", uploadedOn: "09 May 2026", uploadedBy: "Hamad" }]);
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    fetchUsers().catch(() => {});
    groupService.list().then((groups) => dispatch({ type: "SET_RESOURCE", resource: "groups", payload: groups.map((g) => ({ ...g, id: g._id, clients: g.clients?.map((c) => c.legalName) || [] })) })).catch(() => {});
  }, []);

  async function saveClient() {
    if (!form.legalName) return;
    // The screen state is intentionally tab-oriented and user-friendly; this transform is
    // where we fold it back into the nested API contract expected by the Mongo model.
    await createClient({
      clientType: form.clientType === "Natural Person" ? "natural" : "legal",
      legalName: form.legalName,
      tradeName: form.tradeName,
      financialYearEnd: form.fye,
      jurisdiction: form.jurisdiction === "Free Zone" ? "freezone" : form.jurisdiction === "Designated Zone" ? "designated_zone" : form.jurisdiction.toLowerCase(),
      assignedUser: state.users.find((u) => u.name === form.assigned)?._id,
      registeredAddress: { country: form.country, emirate: form.emirate, street: form.street, poBox: form.poBox, postalCode: form.postalCode },
      correspondenceAddress: form.differentAddress ? { street: form.correspondence } : undefined,
      tradeLicences: licences.map((l) => ({ licenceNumber: l.number, issueDate: l.issue, expiryDate: l.expiry, issuingAuthority: l.authority, licenceType: l.type?.toLowerCase() || "commercial", officialEmail: l.email })),
      contactPersons: contacts.map((c) => ({ fullName: c.name, designation: c.designation, email: c.email, mobile: { countryCode: c.code, number: c.mobile }, whatsapp: c.whatsapp, alternateEmail: c.alternate, isPrimary: c.primary, emiratesId: { number: c.eid }, passport: { number: c.passport, issuingCountry: c.issuingCountry } })),
      vatDetails: { trn: form.vatTrn, status: form.vatStatus === "Registered" ? "registered" : form.vatStatus === "Pending" ? "applying" : "not_registered", registrationDate: form.vatDate, filingFrequency: form.vatFreq.toLowerCase() },
      ctDetails: { tin: form.ctTin, status: form.ctStatus === "Registered" ? "registered" : form.ctStatus === "Pending" ? "applying" : "not_registered", registrationDate: form.ctDate, financialYearEnd: form.fye },
      group: form.group || undefined,
      portalLogins: portals.map((p) => ({ portalName: p.name, portalUrl: p.url, username: p.username, password: p.password, notes: p.notes })),
      customFields: { qrmpPreference: form.qrmp, auditFirmName: form.auditFirm, bankName: form.bank, iban: form.iban },
    });
    navigate("/clients/list");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="page-kicker">Client Master</div><h2 className="screen-title">Add Client</h2></div><Button onClick={saveClient}>Save Client</Button></div>
      <Card className="overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#e2e8f0] bg-slate-50 p-2">{tabs.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`mr-1 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-extrabold ${tab === i ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-white"}`}>{t}</button>)}</div>
        <div className="p-4">
          {tab === 0 && <Basic form={form} update={update} countries={countries} />}
          {tab === 1 && <Repeat title="Trade Licence" items={licences} setItems={setLicences} blank={{ number: "", issue: "", expiry: "", authority: "", type: "", email: "" }} render={(lic, i, patch) => <div className="grid gap-3 md:grid-cols-3"><Field label="Licence Number*" field={`licence-number-${i}`}><input className="input" value={lic.number} onChange={(e) => patch(i, { number: e.target.value })} /></Field><Field label="Issue Date" field={`licence-issue-${i}`}><input className="input" type="date" value={lic.issue} onChange={(e) => patch(i, { issue: e.target.value })} /></Field><Field label="Expiry Date" field={`licence-expiry-${i}`}><input className="input" type="date" value={lic.expiry} onChange={(e) => patch(i, { expiry: e.target.value })} /></Field><Field label="Issuing Authority" field={`licence-authority-${i}`}><input className="input" value={lic.authority} onChange={(e) => patch(i, { authority: e.target.value })} /></Field><Field label="Licence Type" field={`licence-type-${i}`}><input className="input" value={lic.type} onChange={(e) => patch(i, { type: e.target.value })} /></Field><Field label="Official Email" field={`licence-email-${i}`}><input className="input" value={lic.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field><div className="upload-zone md:col-span-3"><UploadCloud />PDF/JPG/PNG upload area</div></div>} />}
          {tab === 2 && <Repeat title="Contact Person" items={contacts} setItems={setContacts} blank={{ name: "", designation: "", email: "", code: "+971", mobile: "", whatsapp: "", alternate: "", primary: false, eid: "", passport: "", issuingCountry: "United Arab Emirates" }} render={(c, i, patch) => <div className="grid gap-3 md:grid-cols-3"><Field label="Full Name*" field={`contact-name-${i}`}><input className="input" value={c.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field><Field label="Designation" field={`contact-designation-${i}`}><input className="input" value={c.designation} onChange={(e) => patch(i, { designation: e.target.value })} /></Field><Field label="Email" field={`contact-email-${i}`}><input className="input" value={c.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field><Field label="Mobile"><div className="flex gap-2"><input id={`contact-code-${i}`} name={`contactCode${i}`} className="input w-20" value={c.code} onChange={(e) => patch(i, { code: e.target.value })} /><input id={`contact-mobile-${i}`} name={`contactMobile${i}`} className="input" value={c.mobile} onChange={(e) => patch(i, { mobile: e.target.value })} /></div></Field><Field label="WhatsApp" field={`contact-whatsapp-${i}`}><input className="input" value={c.whatsapp} onChange={(e) => patch(i, { whatsapp: e.target.value })} /></Field><Field label="Alternate Email" field={`contact-alternate-${i}`}><input className="input" value={c.alternate} onChange={(e) => patch(i, { alternate: e.target.value })} /></Field><label className="flex items-center gap-2 font-bold" htmlFor={`contact-primary-${i}`}><input id={`contact-primary-${i}`} name={`contactPrimary${i}`} type="checkbox" checked={c.primary} onChange={(e) => patch(i, { primary: e.target.checked })} /> Primary Contact</label><Field label="Emirates ID Number" field={`contact-eid-${i}`}><input className="input" value={c.eid} onChange={(e) => patch(i, { eid: e.target.value })} /></Field><Field label="Passport Number" field={`contact-passport-${i}`}><input className="input" value={c.passport} onChange={(e) => patch(i, { passport: e.target.value })} /></Field><div className="upload-zone md:col-span-3">Emirates ID front/back and passport upload</div></div>} />}
          {tab === 3 && <div className="grid gap-3 md:grid-cols-2"><Field label="VAT TRN" field="client-vat-trn"><input className="input" value={form.vatTrn} onChange={(e) => update("vatTrn", e.target.value)} /></Field><Field label="VAT Registration Status" field="client-vat-status"><select className="input" value={form.vatStatus} onChange={(e) => update("vatStatus", e.target.value)}><option>Registered</option><option>Not Registered</option><option>Pending</option></select></Field><Field label="VAT Registration Date" field="client-vat-date"><input className="input" type="date" value={form.vatDate} onChange={(e) => update("vatDate", e.target.value)} /></Field><Field label="VAT Filing Frequency" field="client-vat-frequency"><select className="input" value={form.vatFreq} onChange={(e) => update("vatFreq", e.target.value)}><option>Monthly</option><option>Quarterly</option></select></Field><Field label="CT Registration Number (TIN)" field="client-ct-tin"><input className="input" value={form.ctTin} onChange={(e) => update("ctTin", e.target.value)} /></Field><Field label="CT Registration Status" field="client-ct-status"><select className="input" value={form.ctStatus} onChange={(e) => update("ctStatus", e.target.value)}><option>Registered</option><option>Not Registered</option><option>Pending</option></select></Field><Field label="CT Registration Date" field="client-ct-date"><input className="input" type="date" value={form.ctDate} onChange={(e) => update("ctDate", e.target.value)} /></Field><Field label="Financial Year End" field="client-ct-fye"><input className="input" value={form.fye} onChange={(e) => update("fye", e.target.value)} /></Field></div>}
          {tab === 4 && <div className="grid gap-4 md:grid-cols-2"><Field label="Select existing group" field="client-group"><select className="input" value={form.group} onChange={(e) => update("group", e.target.value)}><option value="">No group</option>{state.groups.map((g) => <option key={g.id} value={g._id}>{g.name}</option>)}</select></Field><Field label="Create new group"><div className="flex gap-2"><input id="client-new-group" name="clientNewGroup" className="input" value={form.newGroup} onChange={(e) => update("newGroup", e.target.value)} /><Button onClick={async () => { if (form.newGroup) { const g = await groupService.create({ name: form.newGroup }); dispatch({ type: "SET_RESOURCE", resource: "groups", payload: [...state.groups, { ...g, id: g._id }] }); update("group", g._id); } }}>Create</Button></div></Field><div className="rounded-xl bg-purple-50 p-4 font-bold text-[#7c3aed] md:col-span-2">Current group: {state.groups.find((g) => g._id === form.group)?.name || "Ungrouped"} {form.group && <button onClick={() => update("group", "")} className="ml-3 text-[#dc2626]">Ungroup</button>}</div></div>}
          {tab === 5 && <Repeat title="Portal" items={portals} setItems={setPortals} blank={{ name: "", url: "", username: "", password: "", notes: "" }} render={(p, i, patch) => <div className="grid gap-3 md:grid-cols-2"><Field label="Portal Name" field={`portal-name-${i}`}><input className="input" value={p.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field><Field label="URL" field={`portal-url-${i}`}><input className="input" value={p.url} onChange={(e) => patch(i, { url: e.target.value })} /></Field><Field label="Username/TRN" field={`portal-username-${i}`}><input className="input" value={p.username} onChange={(e) => patch(i, { username: e.target.value })} /></Field><Field label="Password" field={`portal-password-${i}`}><input className="input" type="password" value={p.password} onChange={(e) => patch(i, { password: e.target.value })} /></Field><Field label="Notes" field={`portal-notes-${i}`}><textarea className="input textarea" value={p.notes} onChange={(e) => patch(i, { notes: e.target.value })} /></Field></div>} />}
          {tab === 6 && <div className="grid gap-3 md:grid-cols-2"><Field label="QRMP Preference" field="client-qrmp"><input className="input" value={form.qrmp} onChange={(e) => update("qrmp", e.target.value)} /></Field><Field label="Audit Firm Name" field="client-audit-firm"><input className="input" value={form.auditFirm} onChange={(e) => update("auditFirm", e.target.value)} /></Field><Field label="Bank Name" field="client-bank"><input className="input" value={form.bank} onChange={(e) => update("bank", e.target.value)} /></Field><Field label="IBAN" field="client-iban"><input className="input" value={form.iban} onChange={(e) => update("iban", e.target.value)} /></Field><div className="rounded-xl bg-slate-50 p-3 text-[12px] font-semibold text-slate-500 md:col-span-2">You can add custom fields from Settings</div></div>}
          {tab === 7 && <div className="space-y-3"><div className="upload-zone"><UploadCloud />Upload button + drag-and-drop zone</div><table className="table"><thead><tr><th>Name</th><th>Size</th><th>Type</th><th>Description</th><th>Uploaded On</th><th>Uploaded By</th><th>Actions</th></tr></thead><tbody>{attachments.map((a) => <tr key={a.name}><td>{a.name}</td><td>{a.size}</td><td>{a.type}</td><td>{a.description}</td><td>{a.uploadedOn}</td><td>{a.uploadedBy}</td><td><Button size="sm" variant="ghost">Download</Button> <Button size="sm" variant="danger" onClick={() => setAttachments(attachments.filter((x) => x.name !== a.name))}>Delete</Button></td></tr>)}</tbody></table></div>}
        </div>
      </Card>
    </div>
  );
}

function Basic({ form, update, countries }) {
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{["Legal Person", "Natural Person"].map((type) => <button key={type} onClick={() => update("clientType", type)} className={`rounded-xl border p-4 text-left ${form.clientType === type ? "border-[#1e3a8a] bg-blue-50" : "border-[#e2e8f0]"}`}><div className="font-extrabold">{type}</div><div className="text-[12px] text-slate-500">{type === "Legal Person" ? "Companies, branches, free zone entities" : "Individual taxable persons"}</div></button>)}</div><div className="grid gap-3 md:grid-cols-3"><Field label="File No." field="client-file-no"><input className="input" value={form.fileNo} onChange={(e) => update("fileNo", e.target.value)} /></Field><Field label="Legal Name*" field="client-legal-name"><input className="input" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} /></Field><Field label="Trade Name" field="client-trade-name"><input className="input" value={form.tradeName} onChange={(e) => update("tradeName", e.target.value)} /></Field><Field label="Financial Year End*" field="client-fye"><input className="input" value={form.fye} onChange={(e) => update("fye", e.target.value)} /></Field><Field label="Jurisdiction" field="client-jurisdiction"><select className="input" value={form.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)}><option>Mainland</option><option>Free Zone</option><option>Designated Zone</option><option>Offshore</option></select></Field><Field label="Assigned User" field="client-assigned-user"><input className="input" value={form.assigned} onChange={(e) => update("assigned", e.target.value)} /></Field></div><div className="grid gap-3 md:grid-cols-5"><Field label="Country" field="client-country"><select className="input" value={form.country} onChange={(e) => update("country", e.target.value)}>{countries.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Emirate/State" field="client-emirate"><input className="input" value={form.emirate} onChange={(e) => update("emirate", e.target.value)} /></Field><Field label="Street" field="client-street"><input className="input" value={form.street} onChange={(e) => update("street", e.target.value)} /></Field><Field label="PO Box" field="client-po-box"><input className="input" value={form.poBox} onChange={(e) => update("poBox", e.target.value)} /></Field><Field label="Postal Code" field="client-postal-code"><input className="input" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></Field></div><label className="flex items-center gap-2 font-bold" htmlFor="client-different-address"><input id="client-different-address" name="clientDifferentAddress" type="checkbox" checked={form.differentAddress} onChange={(e) => update("differentAddress", e.target.checked)} /> Actual/Correspondence Address is different</label>{form.differentAddress && <textarea id="client-correspondence-address" name="clientCorrespondenceAddress" className="input textarea" value={form.correspondence} onChange={(e) => update("correspondence", e.target.value)} />}</div>;
}
function Repeat({ title, items, setItems, blank, render }) {
  const patch = (i, values) => setItems(items.map((item, idx) => idx === i ? { ...item, ...values } : item));
  return <div className="space-y-4">{items.map((item, i) => <div key={i} className="rounded-xl border border-[#e2e8f0] p-4"><div className="mb-3 flex items-center justify-between"><div className="font-extrabold">{title} {i + 1}</div>{items.length > 1 && <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-[#dc2626]"><Trash2 size={16} /></button>}</div>{render(item, i, patch)}</div>)}<Button variant="ghost" onClick={() => setItems([...items, blank])}><Plus size={16} />Add {title === "Trade Licence" ? "Another Licence" : title}</Button></div>;
}
function Field({ label, field, children }) {
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || field,
        name: children.props.name || field,
      })
    : children;
  return <label htmlFor={field}><span className="field-label">{label}</span>{control}</label>;
}
