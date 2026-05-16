import { Mail, Phone, Search, UserRoundPlus } from "lucide-react";
import { cloneElement, isValidElement, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Table from "../ui/Table.jsx";

const dummyContacts = [
  { id: "C001", name: "Ayesha Khan", client: "Petra Construction Co.", role: "Finance Manager", mobile: "0501234567", email: "ayesha@petra.example", type: "Client Contact", city: "Dubai" },
  { id: "C002", name: "Rahul Mehta", client: "Nova Tech DMCC", role: "Director", mobile: "0559876543", email: "rahul@novatech.example", type: "Owner", city: "Dubai" },
  { id: "C003", name: "Maryam Al Nuaimi", client: "Gulf Star Logistics", role: "Accounts Lead", mobile: "0524567890", email: "maryam@gulfstar.example", type: "Client Contact", city: "Sharjah" },
  { id: "C004", name: "Omar Siddiqui", client: "Zenith Digital FZ LLC", role: "Tax Coordinator", mobile: "0581122334", email: "omar@zenith.example", type: "Tax Contact", city: "Abu Dhabi" },
  { id: "C005", name: "Neha Thomas", client: "Al Baraka Trading LLC", role: "Operations Head", mobile: "0567788990", email: "neha@albaraka.example", type: "Authorized Person", city: "Dubai" },
  { id: "C006", name: "Hamad Al Farsi", client: "Internal", role: "FTA Liaison", mobile: "0543344556", email: "hamad@filingbuddy.example", type: "Internal", city: "Dubai" },
];

const blankContact = { name: "", client: "", role: "", mobile: "", email: "", type: "Client Contact", city: "" };

export default function Contacts() {
  const [query, setQuery] = useState("");
  const [contactList, setContactList] = useState(dummyContacts);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankContact);
  const contacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contactList;
    return contactList.filter((contact) =>
      [contact.name, contact.client, contact.role, contact.mobile, contact.email, contact.type, contact.city].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [contactList, query]);
  const clientContacts = contacts.filter((contact) => contact.client !== "Internal").length;
  const internalContacts = contacts.filter((contact) => contact.client === "Internal").length;

  function closeModal() {
    setModalOpen(false);
    setForm(blankContact);
  }

  function saveContact() {
    if (!form.name.trim() || !form.mobile.trim()) {
      toast.error("Name and mobile are required.");
      return;
    }
    const contact = {
      ...form,
      id: `C${String(contactList.length + 1).padStart(3, "0")}`,
      name: form.name.trim(),
      client: form.client.trim() || "Individual",
      role: form.role.trim() || "Contact",
      mobile: form.mobile.trim(),
      email: form.email.trim(),
      city: form.city.trim() || "-",
    };
    setContactList((current) => [contact, ...current]);
    toast.success("Contact added.");
    closeModal();
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
        <Summary label="Client Contacts" value={clientContacts} />
        <Summary label="Internal Contacts" value={internalContacts} />
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input id="contact-search" name="contactSearch" className="input pl-9" placeholder="Search contacts by name, client, phone, email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Client / Company</th>
              <th>Role</th>
              <th>Type</th>
              <th>Mobile</th>
              <th>Email</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1e3a8a] text-[11px] font-black text-white">
                      {contact.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                    <div className="font-extrabold">{contact.name}</div>
                  </div>
                </td>
                <td>{contact.client}</td>
                <td>{contact.role}</td>
                <td><Badge color={contact.type === "Internal" ? "bg-blue-50 text-[#1e3a8a]" : "bg-emerald-50 text-[#059669]"}>{contact.type}</Badge></td>
                <td><span className="inline-flex items-center gap-1"><Phone size={13} />{contact.mobile}</span></td>
                <td><span className="inline-flex items-center gap-1"><Mail size={13} />{contact.email}</span></td>
                <td>{contact.city}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="w-full max-w-lg p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">Add Contact</div>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name*" field="contact-name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Mobile*" field="contact-mobile"><input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
              <Field label="Client / Company" field="contact-client"><input className="input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
              <Field label="Role" field="contact-role"><input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
              <Field label="Email" field="contact-email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Location" field="contact-city"><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Type" field="contact-type">
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Client Contact</option>
                  <option>Owner</option>
                  <option>Tax Contact</option>
                  <option>Authorized Person</option>
                  <option>Internal</option>
                </select>
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button onClick={saveContact}>Save Contact</Button>
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
