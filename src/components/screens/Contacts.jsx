import { Mail, Phone, Search, UserRoundPlus } from "lucide-react";
import { useMemo, useState } from "react";
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

export default function Contacts() {
  const [query, setQuery] = useState("");
  const contacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return dummyContacts;
    return dummyContacts.filter((contact) =>
      [contact.name, contact.client, contact.role, contact.mobile, contact.email, contact.type, contact.city].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [query]);
  const clientContacts = contacts.filter((contact) => contact.client !== "Internal").length;
  const internalContacts = contacts.filter((contact) => contact.client === "Internal").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="page-kicker">Contacts</div>
          <h2 className="screen-title">Contact Directory</h2>
        </div>
        <Button>
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
