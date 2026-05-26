import { Mail, MapPin, MapPinned, Phone, Search, UserRoundPlus } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { contactService } from "../../services/contactService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";
import { DIAL_CODE_OPTIONS } from "../../utils/dialCodeOptions.js";
import { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } from "../../utils/phoneUtils.js";

const blankContact = {
  authorityName: "",
  contactPersonName: "",
  countryCode: "",
  mobile: "",
  email: "",
  address: "",
  location: "",
};

function getApiErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  return "";
}

function toContactRows(contacts) {
  return (contacts || []).map((contact) => ({
    id: contact._id,
    authorityName: contact.authorityName || contact.client?.legalName || "Unknown Authority",
    contactPersonName: contact.contactPersonName || contact.fullName || "Unnamed Contact",
    mobile: [contact.mobile?.countryCode, contact.mobile?.number].filter(Boolean).join(" ").trim(),
    email: contact.email || "",
    address: contact.address || "-",
    location: contact.location || contact.city || contact.client?.registeredAddress?.emirate || "-",
  }));
}

export default function Contacts() {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankContact);
  const [saving, setSaving] = useState(false);
  const [contactsData, setContactsData] = useState([]);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      setContactsData(await contactService.list());
    } catch {
      toast.error("Unable to load contact directory.");
    }
  }

  const contactList = useMemo(() => toContactRows(contactsData), [contactsData]);
  const contacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contactList;
    return contactList.filter((contact) =>
      [contact.authorityName, contact.contactPersonName, contact.mobile, contact.email, contact.address, contact.location].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [contactList, query]);

  const authorityCount = useMemo(
    () => new Set(contacts.map((contact) => contact.authorityName).filter(Boolean)).size,
    [contacts]
  );
  const locationCount = useMemo(
    () => new Set(contacts.map((contact) => contact.location).filter((value) => value && value !== "-")).size,
    [contacts]
  );

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setForm(blankContact);
  }

  async function saveContact() {
    if (saving) return;
    if (!form.authorityName.trim() || !form.contactPersonName.trim() || !form.mobile.trim() || !form.countryCode.trim()) {
      toast.error("Authority name, contact person name, country code and mobile are required.");
      return;
    }
    const digits = normalizePhoneNumber(form.mobile);
    const { min, max } = getPhoneNumberSpec(form.countryCode);
    if (digits.length < min || digits.length > max) {
      toast.error(`Mobile number must be between ${min} and ${max} digits.`);
      return;
    }
    setSaving(true);
    try {
      await contactService.create({
        authorityName: form.authorityName.trim(),
        contactPersonName: form.contactPersonName.trim(),
        email: form.email.trim(),
        mobile: {
          countryCode: normalizeDialCode(form.countryCode),
          number: digits,
        },
        address: form.address.trim(),
        location: form.location.trim(),
      });
      await loadContacts();
      toast.success("Authority contact saved.");
      closeModal();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Contacts</div>
          <h2 className="screen-title">Contact Directory</h2>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <UserRoundPlus size={16} />
          Add Contact
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Total Contacts" value={contacts.length} />
        <Summary label="Authorities" value={authorityCount} />
        <Summary label="Locations" value={locationCount} />
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-5 top-2.5 text-slate-400" size={16} />
          <input
            id="contact-search"
            name="contactSearch"
            type="search"
            className="input pl-12"
            placeholder="Search by authority, contact person, location, email, or mobile..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Name / Authority Name</th>
              <th>Contact Person Name</th>
              <th>Mobile Number</th>
              <th>Email</th>
              <th>Address</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1e3a8a] text-[11px] font-black text-white">
                      {contact.authorityName.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                    <div className="font-extrabold">{contact.authorityName}</div>
                  </div>
                </td>
                <td>{contact.contactPersonName}</td>
                <td><span className="inline-flex items-center gap-1"><Phone size={13} />{contact.mobile || "-"}</span></td>
                <td><span className="inline-flex items-center gap-1"><Mail size={13} />{contact.email || "-"}</span></td>
                <td><span className="inline-flex items-start gap-1"><MapPinned size={13} className="mt-0.5 shrink-0" />{contact.address}</span></td>
                <td><span className="inline-flex items-center gap-1"><MapPin size={13} />{contact.location}</span></td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan="6" className="py-8 text-center text-[13px] font-semibold text-slate-500">No stored authority contacts found yet.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-2xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">Add Authority Contact</div>
              <button onClick={closeModal} disabled={saving} className="text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Close</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name / Authority Name*" field="contact-authority-name"><input className="input" value={form.authorityName} onChange={(e) => setForm({ ...form, authorityName: e.target.value })} /></Field>
              <Field label="Contact Person Name*" field="contact-person-name"><input className="input" value={form.contactPersonName} onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })} /></Field>
              <Field label="Mobile Number*" field="contact-mobile">
                <div className="flex gap-2">
                  <select
                    className="input w-44"
                    value={form.countryCode}
                    onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                  >
                    <option value="">Code</option>
                    {DIAL_CODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: normalizePhoneNumber(e.target.value) })}
                    placeholder={getPhoneNumberSpec(form.countryCode).placeholder}
                    inputMode="numeric"
                  />
                </div>
              </Field>
              <Field label="Email" field="contact-email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Location" field="contact-location"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
              <div className="md:col-span-2">
                <Field label="Address" field="contact-address"><textarea className="input min-h-[96px] py-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button onClick={saveContact} disabled={saving}>{saving ? "Saving..." : "Save Contact"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-extrabold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-[24px] font-black text-slate-900">{value}</div>
    </Card>
  );
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
