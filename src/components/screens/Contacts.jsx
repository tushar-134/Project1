import { Download, Mail, MapPin, MapPinned, Phone, Search, UploadCloud, UserRoundPlus, X } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { contactService } from "../../services/contactService";
import { downloadBlob } from "../../utils/adapterUtils";
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

const bulkTemplateRows = [
  {
    authorityName: "Federal Tax Authority",
    contactPersonName: "Aisha Khan",
    countryCode: "+971",
    mobile: "501234567",
    email: "aisha@example.com",
    address: "Dubai, United Arab Emirates",
    location: "Dubai",
  },
];

const bulkColumns = ["authorityName", "contactPersonName", "countryCode", "mobile", "email", "address", "location"];
const bulkColumnLabels = {
  authorityName: "Authority Name",
  contactPersonName: "Contact Person",
  countryCode: "Country Code",
  mobile: "Mobile",
  email: "Email",
  address: "Address",
  location: "Location",
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

function getRowValue(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeBulkRow(row, index) {
  return {
    serial: index + 1,
    authorityName: getRowValue(row, ["authorityName", "Authority Name", "Name / Authority Name", "name"]),
    contactPersonName: getRowValue(row, ["contactPersonName", "Contact Person Name", "Contact Person", "fullName"]),
    countryCode: normalizeDialCode(getRowValue(row, ["countryCode", "Country Code", "Mobile Country Code", "mobileCountryCode"])),
    mobile: normalizePhoneNumber(getRowValue(row, ["mobile", "Mobile", "Mobile Number", "Phone", "Phone Number"])),
    email: getRowValue(row, ["email", "Email"]),
    address: getRowValue(row, ["address", "Address"]),
    location: getRowValue(row, ["location", "Location", "City", "city"]),
  };
}

function validateBulkContact(row) {
  const errors = [];
  if (!row.authorityName) errors.push("Authority name is required");
  if (!row.contactPersonName) errors.push("Contact person name is required");
  if (!row.countryCode) errors.push("Country code is required");
  if (!row.mobile) errors.push("Mobile is required");
  if (row.mobile && row.countryCode) {
    const { min, max } = getPhoneNumberSpec(row.countryCode);
    if (row.mobile.length < min || row.mobile.length > max) errors.push(`Mobile must be ${min}-${max} digits`);
  }
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Email is invalid");
  return errors;
}

export default function Contacts() {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankContact);
  const [saving, setSaving] = useState(false);
  const [contactsData, setContactsData] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);

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

  function closeBulkModal() {
    if (bulkImporting) return;
    setBulkOpen(false);
    setBulkFileName("");
    setBulkRows([]);
  }

  function downloadBulkTemplate() {
    const worksheet = XLSX.utils.json_to_sheet(bulkTemplateRows, { header: bulkColumns });
    XLSX.utils.sheet_add_aoa(worksheet, [bulkColumns.map((key) => bulkColumnLabels[key])], { origin: "A1" });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "contact-directory-template.xlsx");
  }

  async function handleBulkFile(file) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const parsedRows = rawRows.map(normalizeBulkRow).filter((row) =>
        bulkColumns.some((column) => String(row[column] || "").trim())
      );
      if (!parsedRows.length) {
        toast.error("No contact rows found in the selected file.");
        return;
      }
      setBulkFileName(file.name);
      setBulkRows(parsedRows.map((row) => ({ ...row, errors: validateBulkContact(row), status: "ready" })));
    } catch {
      toast.error("Unable to read the contact bulk upload file.");
    }
  }

  async function importBulkContacts() {
    if (bulkImporting) return;
    const validRows = bulkRows.filter((row) => row.errors.length === 0 && row.status !== "success");
    if (!validRows.length) {
      toast.error("No valid rows to import.");
      return;
    }
    setBulkImporting(true);
    let added = 0;
    let failed = 0;
    const nextRows = [...bulkRows];
    for (const row of validRows) {
      const rowIndex = nextRows.findIndex((item) => item.serial === row.serial);
      try {
        await contactService.create({
          authorityName: row.authorityName,
          contactPersonName: row.contactPersonName,
          email: row.email,
          mobile: {
            countryCode: row.countryCode,
            number: row.mobile,
          },
          address: row.address,
          location: row.location,
        });
        added += 1;
        nextRows[rowIndex] = { ...nextRows[rowIndex], status: "success", message: "Imported" };
      } catch (error) {
        failed += 1;
        nextRows[rowIndex] = { ...nextRows[rowIndex], status: "error", message: getApiErrorMessage(error) || "Import failed" };
      }
      setBulkRows([...nextRows]);
    }
    await loadContacts();
    toast[failed ? "error" : "success"](`${added} contact${added === 1 ? "" : "s"} imported${failed ? `, ${failed} failed` : ""}.`);
    setBulkImporting(false);
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
      <div className="flex justify-end">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setBulkOpen(true)}>
            <UploadCloud size={16} />
            Bulk Upload
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <UserRoundPlus size={16} />
            Add Contact
          </Button>
        </div>
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

      {bulkOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/35 p-4">
          <Card className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4">
              <div>
                <div className="text-[16px] font-extrabold">Bulk Upload Contacts</div>
                <div className="text-[12px] font-semibold text-slate-500">Upload an XLSX or CSV file with authority contact details.</div>
              </div>
              <button
                type="button"
                onClick={closeBulkModal}
                disabled={bulkImporting}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close bulk upload"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block">
                  <span className="field-label">Contact file</span>
                  <input
                    className="input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(event) => handleBulkFile(event.target.files?.[0])}
                    disabled={bulkImporting}
                  />
                </label>
                <Button variant="ghost" onClick={downloadBulkTemplate} disabled={bulkImporting}>
                  <Download size={16} />
                  Template
                </Button>
              </div>

              <div className="rounded-xl border border-[#e2e8f0] bg-slate-50 p-3 text-[12px] font-semibold text-slate-600">
                Required columns: Authority Name, Contact Person, Country Code, Mobile. Optional: Email, Address, Location.
              </div>

              {bulkFileName && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-bold text-slate-600">
                  <span>{bulkFileName}</span>
                  <span>{bulkRows.filter((row) => row.errors.length === 0).length} valid / {bulkRows.length} rows</span>
                </div>
              )}

              {bulkRows.length > 0 && (
                <div className="overflow-auto rounded-xl border border-[#e2e8f0]">
                  <Table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Authority</th>
                        <th>Contact Person</th>
                        <th>Mobile</th>
                        <th>Email</th>
                        <th>Location</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr key={row.serial}>
                          <td>{row.serial}</td>
                          <td>{row.authorityName || "-"}</td>
                          <td>{row.contactPersonName || "-"}</td>
                          <td>{[row.countryCode, row.mobile].filter(Boolean).join(" ") || "-"}</td>
                          <td>{row.email || "-"}</td>
                          <td>{row.location || "-"}</td>
                          <td>
                            {row.status === "success" ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-700">Imported</span>
                            ) : row.status === "error" ? (
                              <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-extrabold text-red-700">{row.message}</span>
                            ) : row.errors.length ? (
                              <span className="text-[11px] font-bold text-red-600">{row.errors.join(", ")}</span>
                            ) : (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-blue-700">Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-4 py-4">
              <Button variant="ghost" onClick={closeBulkModal} disabled={bulkImporting}>Cancel</Button>
              <Button onClick={importBulkContacts} disabled={bulkImporting || bulkRows.every((row) => row.errors.length > 0 || row.status === "success")}>
                {bulkImporting ? "Importing..." : "Import Valid Rows"}
              </Button>
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
