import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, UploadCloud, X, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { useUsers } from "../../hooks/useUsers";
import { groupService } from "../../services/groupService";
import { customFieldService } from "../../services/customFieldService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import { DIAL_CODE_OPTIONS } from "../../utils/dialCodeOptions.js";
import { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } from "../../utils/phoneUtils.js";

const tabs = ["Basic Details", "Trade Licences", "Contact Persons", "VAT / CT", "Client Group", "Portal Logins", "Custom Fields", "Attachments"];
const countryCodes = ["AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW"];

function getApiErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  return "";
}

export default function AddClient() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { createClient, getClient, updateClient, uploadAttachment, uploadDocument, deleteAttachment } = useClients();
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
  const [licences, setLicences] = useState([{ number: "", issue: "", expiry: "", authority: "Dubai Economy", type: "Commercial", email: "", documentUrl: "", documentName: "", documentFile: null }]);
  const [contacts, setContacts] = useState([{ name: "", designation: "", email: "", code: "", mobile: "", whatsapp: "", alternate: "", primary: true, eid: "", passport: "", issuingCountry: "United Arab Emirates", eidDocumentUrl: "", eidDocumentName: "", eidDocumentFile: null, passportDocumentUrl: "", passportDocumentName: "", passportDocumentFile: null }]);
  const [portals, setPortals] = useState([{ name: "EmaraTax", url: "https://tax.gov.ae", username: "", password: "", notes: "" }]);
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const formatEmiratesIdInput = (rawValue) => {
    const digits = String(rawValue || "").replace(/\D+/g, "").slice(0, 15);
    const parts = [];
    if (digits.length) parts.push(digits.slice(0, 3));
    if (digits.length > 3) parts.push(digits.slice(3, 7));
    if (digits.length > 7) parts.push(digits.slice(7, 14));
    if (digits.length > 14) parts.push(digits.slice(14, 15));
    return parts.join("-");
  };

  useEffect(() => {
    fetchUsers().catch(() => { });
    groupService.list().then((groups) => dispatch({
      type: "SET_RESOURCE",
      resource: "groups",
      payload: groups.map((g) => ({ ...g, id: g._id, clients: g.clients || [], clientNames: g.clients?.map((c) => c.legalName) || [] })),
    })).catch(() => { });
  }, []);
  useEffect(() => {
    if (!isEditMode) return;
    getClient(id).then((client) => {
      const jurisdictionLabels = {
        mainland: "Mainland",
        freezone: "Free Zone",
        designated_zone: "Designated Zone",
        offshore: "Offshore",
      };
      const primaryContact = client.contactPersons?.find((person) => person.isPrimary) || client.contactPersons?.[0] || {};
      setForm({
        clientType: client.clientType === "natural" ? "Natural Person" : "Legal Person",
        fileNo: client.fileNo || "",
        legalName: client.legalName || "",
        tradeName: client.tradeName || "",
        fye: client.financialYearEnd || client.ctDetails?.financialYearEnd || "",
        jurisdiction: jurisdictionLabels[client.jurisdiction] || "Mainland",
        assigned: client.assignedUser?.name || "",
        country: client.registeredAddress?.country || "United Arab Emirates",
        emirate: client.registeredAddress?.emirate || "",
        street: client.registeredAddress?.street || "",
        poBox: client.registeredAddress?.poBox || "",
        postalCode: client.registeredAddress?.postalCode || "",
        differentAddress: Boolean(client.correspondenceAddress?.street || client.correspondenceAddress?.country || client.correspondenceAddress?.emirate),
        correspondence: client.correspondenceAddress?.street || "",
        vatTrn: client.vatDetails?.trn || "",
        vatStatus: client.vatDetails?.status === "registered" ? "Registered" : client.vatDetails?.status === "applying" ? "Pending" : "Not Registered",
        vatDate: client.vatDetails?.registrationDate?.slice?.(0, 10) || "",
        vatFreq: client.vatDetails?.filingFrequency ? `${client.vatDetails.filingFrequency[0].toUpperCase()}${client.vatDetails.filingFrequency.slice(1)}` : "Quarterly",
        ctTin: client.ctDetails?.tin || "",
        ctStatus: client.ctDetails?.status === "registered" ? "Registered" : client.ctDetails?.status === "applying" ? "Pending" : "Not Registered",
        ctDate: client.ctDetails?.registrationDate?.slice?.(0, 10) || "",
        group: client.group?._id || client.group || "",
        newGroup: "",
        qrmp: client.customFields?.qrmpPreference || "Email",
        auditFirm: client.customFields?.auditFirmName || "",
        bank: client.customFields?.bankName || "",
        iban: client.customFields?.iban || "",
      });
      setLicences((client.tradeLicences || []).length ? client.tradeLicences.map((licence) => ({
        number: licence.licenceNumber || "",
        issue: licence.issueDate?.slice?.(0, 10) || "",
        expiry: licence.expiryDate?.slice?.(0, 10) || "",
        authority: licence.issuingAuthority || "",
        type: licence.licenceType ? `${licence.licenceType[0].toUpperCase()}${licence.licenceType.slice(1)}` : "",
        email: licence.officialEmail || "",
        documentUrl: licence.documentUrl || "",
        documentName: licence.documentUrl ? licence.documentUrl.split("/").pop() : "",
        documentFile: null,
      })) : [{ number: "", issue: "", expiry: "", authority: "Dubai Economy", type: "Commercial", email: "", documentUrl: "", documentName: "", documentFile: null }]);
      setContacts((client.contactPersons || []).length ? client.contactPersons.map((person) => ({
        name: person.fullName || "",
        designation: person.designation || "",
        email: person.email || "",
        code: person.mobile?.countryCode || "",
        mobile: person.mobile?.number || "",
        whatsapp: person.whatsapp || "",
        alternate: person.alternateEmail || "",
        primary: Boolean(person.isPrimary),
        eid: person.emiratesId?.number || "",
        passport: person.passport?.number || "",
        issuingCountry: person.passport?.issuingCountry || primaryContact.passport?.issuingCountry || "United Arab Emirates",
        eidDocumentUrl: person.emiratesId?.documentUrl || "",
        eidDocumentName: person.emiratesId?.documentUrl ? person.emiratesId.documentUrl.split("/").pop() : "",
        eidDocumentFile: null,
        passportDocumentUrl: person.passport?.documentUrl || "",
        passportDocumentName: person.passport?.documentUrl ? person.passport.documentUrl.split("/").pop() : "",
        passportDocumentFile: null,
      })) : [{ name: "", designation: "", email: "", code: "", mobile: "", whatsapp: "", alternate: "", primary: true, eid: "", passport: "", issuingCountry: "United Arab Emirates", eidDocumentUrl: "", eidDocumentName: "", eidDocumentFile: null, passportDocumentUrl: "", passportDocumentName: "", passportDocumentFile: null }]);
      setPortals((client.portalLogins || []).length ? client.portalLogins.map((portal) => ({
        name: portal.portalName || "",
        url: portal.portalUrl || "",
        username: portal.username || "",
        password: "",
        notes: portal.notes || "",
      })) : [{ name: "EmaraTax", url: "https://tax.gov.ae", username: "", password: "", notes: "" }]);
      setAttachments((client.attachments || []).map((attachment) => ({
        id: attachment._id,
        name: attachment.name,
        size: attachment.size,
        type: attachment.fileType,
        description: attachment.description,
        uploadedOn: attachment.uploadedAt?.slice?.(0, 10) || "",
        uploadedBy: attachment.uploadedBy?.name || "",
        url: attachment.url,
        saved: true,
      })));
    }).catch(() => {
      toast.error("Unable to load this client for editing.");
      navigate("/clients/list");
    });
  }, [id, isEditMode]);

  const formatFileSize = (size) => {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const mapSavedAttachments = (items) => items.map((attachment) => ({
    id: attachment._id,
    name: attachment.name,
    size: attachment.size,
    type: attachment.fileType,
    description: attachment.description || "",
    uploadedOn: attachment.uploadedAt?.slice?.(0, 10) || new Date().toISOString().slice(0, 10),
    uploadedBy: attachment.uploadedBy?.name || "You",
    url: attachment.url,
    saved: true,
  }));

  const patchLicence = (index, values) => {
    setLicences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  };

  const patchContact = (index, values) => {
    setContacts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  };

  async function uploadTradeLicenceFile(clientId, licenceIndex, file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("section", "tradeLicences");
    formData.append("index", String(licenceIndex));
    formData.append("description", `Trade Licence ${licenceIndex + 1} document`);
    const updatedClient = await uploadDocument(clientId, formData);
    const uploadedLicence = updatedClient.tradeLicences?.[licenceIndex];
    patchLicence(licenceIndex, {
      documentUrl: uploadedLicence?.documentUrl || "",
      documentName: file.name,
      documentFile: null,
    });
    if (updatedClient.attachments) setAttachments(mapSavedAttachments(updatedClient.attachments));
  }

  async function handleTradeLicenceFile(licenceIndex, files) {
    const file = files?.[0];
    if (!file) return;
    patchLicence(licenceIndex, { documentName: file.name, documentFile: isEditMode ? null : file });
    if (!isEditMode) {
      toast.success("Trade licence file added. Save the client to upload it.");
      return;
    }
    setIsUploading(true);
    try {
      await uploadTradeLicenceFile(id, licenceIndex, file);
      toast.success("Trade licence document uploaded.");
    } catch (error) {
      patchLicence(licenceIndex, { documentFile: null });
      toast.error(error.response?.data?.message || "Trade licence upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadContactDocument(clientId, contactIndex, file, section) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("section", section);
    formData.append("index", String(contactIndex));
    formData.append("description", `Contact ${contactIndex + 1} ${section} document`);
    const updatedClient = await uploadDocument(clientId, formData);
    const uploadedContact = updatedClient.contactPersons?.[contactIndex];
    if (section === "passport") {
      patchContact(contactIndex, {
        passportDocumentUrl: uploadedContact?.passport?.documentUrl || "",
        passportDocumentName: file.name,
        passportDocumentFile: null,
      });
    } else {
      patchContact(contactIndex, {
        eidDocumentUrl: uploadedContact?.emiratesId?.documentUrl || "",
        eidDocumentName: file.name,
        eidDocumentFile: null,
      });
    }
    if (updatedClient.attachments) setAttachments(mapSavedAttachments(updatedClient.attachments));
  }

  async function handleContactDocument(contactIndex, files, section) {
    const file = files?.[0];
    if (!file) return;
    if (section === "passport") {
      patchContact(contactIndex, { passportDocumentName: file.name, passportDocumentFile: isEditMode ? null : file });
    } else {
      patchContact(contactIndex, { eidDocumentName: file.name, eidDocumentFile: isEditMode ? null : file });
    }
    if (!isEditMode) {
      toast.success(`${section === "passport" ? "Passport" : "Emirates ID"} file added. Save the client to upload it.`);
      return;
    }
    setIsUploading(true);
    try {
      await uploadContactDocument(id, contactIndex, file, section);
      toast.success(`${section === "passport" ? "Passport" : "Emirates ID"} document uploaded.`);
    } catch (error) {
      if (section === "passport") {
        patchContact(contactIndex, { passportDocumentFile: null });
      } else {
        patchContact(contactIndex, { eidDocumentFile: null });
      }
      toast.error(error.response?.data?.message || "Contact document upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadFiles(files) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    if (!isEditMode) {
      setAttachments((current) => [
        ...current,
        ...selected.map((file) => ({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          name: file.name,
          size: formatFileSize(file.size),
          type: file.type || file.name.split(".").pop()?.toUpperCase() || "File",
          description: "",
          uploadedOn: "Pending save",
          uploadedBy: "You",
          file,
          saved: false,
        })),
      ]);
      toast.success("File added. Save the client to upload it.");
      return;
    }
    setIsUploading(true);
    try {
      let uploaded = [];
      for (const file of selected) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("description", "");
        uploaded = await uploadAttachment(id, formData);
      }
      setAttachments(mapSavedAttachments(uploaded));
      toast.success(selected.length === 1 ? "Attachment uploaded." : "Attachments uploaded.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Attachment upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function removeAttachment(attachment) {
    if (!attachment.saved) {
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      return;
    }
    try {
      const remaining = await deleteAttachment(id, attachment.id);
      setAttachments(mapSavedAttachments(remaining));
      toast.success("Attachment deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete attachment.");
    }
  }

  async function saveClient({ continueToNext = false } = {}) {
    if (isSaving) return false;
    if (!form.legalName) {
      toast.error("Please enter the client legal name.");
      return false;
    }
    const shouldValidateContacts = !continueToNext || tab >= 2;
    if (shouldValidateContacts) {
      const emiratesIdPattern = /^\d{3}-\d{4}-\d{7}-\d$/;
      const missingContactNameIndex = contacts.findIndex((contact) => !String(contact.name || "").trim());
      if (missingContactNameIndex >= 0) {
        toast.error(`Contact person ${missingContactNameIndex + 1}: full name is required.`);
        return false;
      }
      const invalidEidIndex = contacts.findIndex((contact) => {
        const value = String(contact.eid || "").trim();
        if (!value) return false;
        return !emiratesIdPattern.test(value);
      });
      if (invalidEidIndex >= 0) {
        toast.error(`Contact person ${invalidEidIndex + 1}: Emirates ID must match 784-XXXX-XXXXXXX-X.`);
        return false;
      }
      const missingContactCodeIndex = contacts.findIndex((contact) => {
        const phoneDigits = normalizePhoneNumber(contact.mobile);
        if (!phoneDigits) return false;
        return !String(contact.code || "").trim();
      });
      if (missingContactCodeIndex >= 0) {
        toast.error(`Contact person ${missingContactCodeIndex + 1}: please select a country code.`);
        return false;
      }
      const invalidContactIndex = contacts.findIndex((contact) => {
        const phoneDigits = normalizePhoneNumber(contact.mobile);
        if (!phoneDigits) return false;
        const { min } = getPhoneNumberSpec(contact.code);
        return phoneDigits.length !== min;
      });
      if (invalidContactIndex >= 0) {
        const { min } = getPhoneNumberSpec(contacts[invalidContactIndex]?.code);
        toast.error(`Contact person ${invalidContactIndex + 1}: mobile number must be exactly ${min} digits.`);
        return false;
      }
    }
    setIsSaving(true);
    try {
      // The screen state is intentionally tab-oriented and user-friendly; this transform is
      // where we fold it back into the nested API contract expected by the Mongo model.
      const payload = {
        clientType: form.clientType === "Natural Person" ? "natural" : "legal",
        fileNo: form.fileNo || undefined,
        legalName: form.legalName,
        tradeName: form.tradeName,
        financialYearEnd: form.fye,
        jurisdiction: form.jurisdiction === "Free Zone" ? "freezone" : form.jurisdiction === "Designated Zone" ? "designated_zone" : form.jurisdiction.toLowerCase(),
        assignedUser: state.users.find((u) => u.name === form.assigned)?._id,
        registeredAddress: { country: form.country, emirate: form.emirate, street: form.street, poBox: form.poBox, postalCode: form.postalCode },
        correspondenceAddress: form.differentAddress ? { street: form.correspondence } : undefined,
        tradeLicences: licences.map((l) => ({ licenceNumber: l.number, issueDate: l.issue, expiryDate: l.expiry, issuingAuthority: l.authority, licenceType: l.type?.toLowerCase() || "commercial", officialEmail: l.email })),
        contactPersons: contacts.map((c) => ({
          fullName: c.name,
          designation: c.designation,
          email: c.email,
          mobile: { countryCode: normalizeDialCode(c.code), number: normalizePhoneNumber(c.mobile) },
          whatsapp: c.whatsapp,
          alternateEmail: c.alternate,
          isPrimary: c.primary,
          emiratesId: { number: c.eid },
          passport: { number: c.passport, issuingCountry: c.issuingCountry },
        })),
        vatDetails: { trn: form.vatTrn, status: form.vatStatus === "Registered" ? "registered" : form.vatStatus === "Pending" ? "applying" : "not_registered", registrationDate: form.vatDate, filingFrequency: form.vatFreq.toLowerCase() },
        ctDetails: { tin: form.ctTin, status: form.ctStatus === "Registered" ? "registered" : form.ctStatus === "Pending" ? "applying" : "not_registered", registrationDate: form.ctDate, financialYearEnd: form.fye },
        group: form.group || undefined,
        portalLogins: portals.map((p) => ({ portalName: p.name, portalUrl: p.url, username: p.username, password: p.password, notes: p.notes })),
        customFields: { qrmpPreference: form.qrmp, auditFirmName: form.auditFirm, bankName: form.bank, iban: form.iban },
      };
      const pendingAttachments = attachments.filter((attachment) => !attachment.saved && attachment.file);
      const pendingLicenceDocuments = licences
        .map((licence, index) => ({ index, file: licence.documentFile }))
        .filter((item) => item.file);
      const pendingContactDocuments = contacts.flatMap((contact, index) => ([
        contact.eidDocumentFile ? { index, file: contact.eidDocumentFile, section: "emiratesId" } : null,
        contact.passportDocumentFile ? { index, file: contact.passportDocumentFile, section: "passport" } : null,
      ].filter(Boolean)));
      if (isEditMode) {
        await updateClient(id, payload);
        if (pendingLicenceDocuments.length) {
          for (const licenceDocument of pendingLicenceDocuments) {
            await uploadTradeLicenceFile(id, licenceDocument.index, licenceDocument.file);
          }
        }
        if (pendingContactDocuments.length) {
          for (const document of pendingContactDocuments) {
            await uploadContactDocument(id, document.index, document.file, document.section);
          }
        }
        toast.success(continueToNext ? "Progress saved." : "Client updated successfully.");
      } else {
        const created = await createClient(payload);
        if (pendingLicenceDocuments.length) {
          for (const licenceDocument of pendingLicenceDocuments) {
            await uploadTradeLicenceFile(created._id, licenceDocument.index, licenceDocument.file);
          }
        }
        if (pendingContactDocuments.length) {
          for (const document of pendingContactDocuments) {
            await uploadContactDocument(created._id, document.index, document.file, document.section);
          }
        }
        if (pendingAttachments.length) {
          let uploadedAttachments = [];
          for (const attachment of pendingAttachments) {
            const formData = new FormData();
            formData.append("file", attachment.file);
            formData.append("description", attachment.description || "");
            uploadedAttachments = await uploadAttachment(created._id, formData);
          }
          if (uploadedAttachments.length) setAttachments(mapSavedAttachments(uploadedAttachments));
        }
        toast.success(continueToNext ? "Progress saved." : (pendingAttachments.length || pendingLicenceDocuments.length || pendingContactDocuments.length ? "Client created and documents uploaded." : "Client created successfully."));
        if (continueToNext) navigate(`/clients/edit/${created._id}`, { replace: true });
      }
      if (continueToNext) {
        setTab((current) => Math.min(current + 1, tabs.length - 1));
        return true;
      }
      navigate("/clients/list");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Unable to save client.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  const goPrevious = () => setTab((current) => Math.max(current - 1, 0));
  const saveAndContinue = () => saveClient({ continueToNext: true });
  const isFirstTab = tab === 0;
  const isLastTab = tab === tabs.length - 1;

  return (
    <div className="space-y-5">
      <div>
        <div className="page-kicker">Client Master</div>
        <h2 className="screen-title">{isEditMode ? "Edit Client" : "Add Client"}</h2>
      </div>
      <Card className="overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#e2e8f0] bg-slate-50 p-2">{tabs.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`mr-1 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-extrabold ${tab === i ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-white"}`}>{t}</button>)}</div>
        <div className="p-4">
          {tab === 0 && <Basic form={form} update={update} countries={countries} users={state.users} />}
          {tab === 1 && <Repeat title="Trade Licence" items={licences} setItems={setLicences} blank={{ number: "", issue: "", expiry: "", authority: "", type: "", email: "", documentUrl: "", documentName: "", documentFile: null }} render={(lic, i, patch) => <div className="grid gap-3 md:grid-cols-3"><Field label="Licence Number*" field={`licence-number-${i}`}><input className="input" value={lic.number} onChange={(e) => patch(i, { number: e.target.value })} /></Field><Field label="Issue Date" field={`licence-issue-${i}`}><input className="input" type="date" value={lic.issue} onChange={(e) => patch(i, { issue: e.target.value })} /></Field><Field label="Expiry Date" field={`licence-expiry-${i}`}><input className="input" type="date" value={lic.expiry} onChange={(e) => patch(i, { expiry: e.target.value })} /></Field><Field label="Issuing Authority" field={`licence-authority-${i}`}><input className="input" value={lic.authority} onChange={(e) => patch(i, { authority: e.target.value })} /></Field><Field label="Licence Type" field={`licence-type-${i}`}><input className="input" value={lic.type} onChange={(e) => patch(i, { type: e.target.value })} /></Field><Field label="Official Email" field={`licence-email-${i}`}><input className="input" value={lic.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field><div className="md:col-span-3"><DocumentUploadZone id={`trade-licence-upload-${i}`} title="Upload trade licence" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={lic.documentName} documentUrl={lic.documentUrl} isUploading={isUploading} onFiles={(files) => handleTradeLicenceFile(i, files)} /></div></div>} />}
          {tab === 2 && (
            <Repeat
              title="Contact Person"
              items={contacts}
              setItems={setContacts}
              blank={{ name: "", designation: "", email: "", code: "", mobile: "", whatsapp: "", alternate: "", primary: false, eid: "", passport: "", issuingCountry: "United Arab Emirates", eidDocumentUrl: "", eidDocumentName: "", eidDocumentFile: null, passportDocumentUrl: "", passportDocumentName: "", passportDocumentFile: null }}
              render={(c, i, patch) => (
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Full Name*" field={`contact-name-${i}`}><input className="input" value={c.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
                  <Field label="Designation" field={`contact-designation-${i}`}><input className="input" value={c.designation} onChange={(e) => patch(i, { designation: e.target.value })} /></Field>
                  <Field label="Email" field={`contact-email-${i}`}><input className="input" value={c.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field>
                  <Field label="Mobile">
                    <div className="flex gap-2">
                      <select id={`contact-code-${i}`} name={`contactCode${i}`} className="input w-44" value={c.code} onChange={(e) => patch(i, { code: e.target.value })}>
                        <option value="">Code</option>
                        {DIAL_CODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input
                        id={`contact-mobile-${i}`}
                        name={`contactMobile${i}`}
                        className="input"
                        value={c.mobile}
                        onChange={(e) => {
                          const { max } = getPhoneNumberSpec(c.code);
                          patch(i, { mobile: normalizePhoneNumber(e.target.value).slice(0, max) });
                        }}
                        placeholder={getPhoneNumberSpec(c.code).placeholder}
                        inputMode="numeric"
                        maxLength={getPhoneNumberSpec(c.code).max}
                      />
                    </div>
                  </Field>
                  <Field label="WhatsApp" field={`contact-whatsapp-${i}`}><input className="input" value={c.whatsapp} onChange={(e) => patch(i, { whatsapp: e.target.value })} /></Field>
                  <Field label="Alternate Email" field={`contact-alternate-${i}`}><input className="input" value={c.alternate} onChange={(e) => patch(i, { alternate: e.target.value })} /></Field>
                  <label className="flex items-center gap-2 font-bold" htmlFor={`contact-primary-${i}`}><input id={`contact-primary-${i}`} name={`contactPrimary${i}`} type="checkbox" checked={c.primary} onChange={(e) => patch(i, { primary: e.target.checked })} /> Primary Contact</label>
                  <Field label="Emirates ID Number" field={`contact-eid-${i}`}><input className="input" placeholder="784-XXXX-XXXXXXX-X" value={c.eid} onChange={(e) => patch(i, { eid: formatEmiratesIdInput(e.target.value) })} /></Field>
                  <Field label="Passport Number" field={`contact-passport-${i}`}><input className="input" value={c.passport} onChange={(e) => patch(i, { passport: e.target.value })} /></Field>
                  <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
                    <DocumentUploadZone id={`contact-eid-upload-${i}`} title="Upload Emirates ID" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={c.eidDocumentName} documentUrl={c.eidDocumentUrl} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "emiratesId")} />
                    <DocumentUploadZone id={`contact-passport-upload-${i}`} title="Upload passport" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={c.passportDocumentName} documentUrl={c.passportDocumentUrl} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "passport")} />
                  </div>
                </div>
              )}
            />
          )}
          {tab === 3 && <div className="grid gap-3 md:grid-cols-2"><Field label="VAT Registration Status" field="client-vat-status"><select className="input" value={form.vatStatus} onChange={(e) => update("vatStatus", e.target.value)}><option>Registered</option><option>Not Registered</option><option>Pending</option></select></Field><Field label="VAT TRN" field="client-vat-trn"><input className="input" value={form.vatTrn} onChange={(e) => update("vatTrn", e.target.value)} /></Field><Field label="VAT Registration Date" field="client-vat-date"><input className="input" type="date" value={form.vatDate} onChange={(e) => update("vatDate", e.target.value)} /></Field><Field label="VAT Filing Frequency" field="client-vat-frequency"><select className="input" value={form.vatFreq} onChange={(e) => update("vatFreq", e.target.value)}><option>Monthly</option><option>Quarterly</option></select></Field><Field label="CT Registration Number (TIN)" field="client-ct-tin"><input className="input" value={form.ctTin} onChange={(e) => update("ctTin", e.target.value)} /></Field><Field label="CT Registration Status" field="client-ct-status"><select className="input" value={form.ctStatus} onChange={(e) => update("ctStatus", e.target.value)}><option>Registered</option><option>Not Registered</option><option>Pending</option></select></Field><Field label="CT Registration Date" field="client-ct-date"><input className="input" type="date" value={form.ctDate} onChange={(e) => update("ctDate", e.target.value)} /></Field><Field label="Financial Year End" field="client-ct-fye"><input className="input" value={form.fye} onChange={(e) => update("fye", e.target.value)} /></Field></div>}
          {tab === 4 && <div className="grid gap-4 md:grid-cols-2"><Field label="Select existing group" field="client-group"><select className="input" value={form.group} onChange={(e) => update("group", e.target.value)}><option value="">No group</option>{state.groups.map((g) => <option key={g.id} value={g._id}>{g.name}</option>)}</select></Field><Field label="Create new group"><div className="flex gap-2"><input id="client-new-group" name="clientNewGroup" className="input" value={form.newGroup} onChange={(e) => update("newGroup", e.target.value)} /><Button onClick={async () => { if (form.newGroup) { const g = await groupService.create({ name: form.newGroup }); dispatch({ type: "SET_RESOURCE", resource: "groups", payload: [...state.groups, { ...g, id: g._id, clients: g.clients || [], clientNames: g.clients?.map((c) => c.legalName) || [] }] }); update("group", g._id); } }}>Create</Button></div></Field><div className="rounded-xl bg-purple-50 p-4 font-bold text-[#7c3aed] md:col-span-2">Current group: {state.groups.find((g) => g._id === form.group)?.name || "Ungrouped"} {form.group && <button onClick={() => update("group", "")} className="ml-3 text-[#dc2626]">Ungroup</button>}</div></div>}
          {tab === 5 && <Repeat title="Portal" items={portals} setItems={setPortals} blank={{ name: "", url: "", username: "", password: "", notes: "" }} render={(p, i, patch) => <div className="grid gap-3 md:grid-cols-2"><Field label="Portal Name" field={`portal-name-${i}`}><input className="input" value={p.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field><Field label="URL" field={`portal-url-${i}`}><input className="input" value={p.url} onChange={(e) => patch(i, { url: e.target.value })} /></Field><Field label="Username/TRN" field={`portal-username-${i}`}><input className="input" value={p.username} onChange={(e) => patch(i, { username: e.target.value })} /></Field><Field label="Password" field={`portal-password-${i}`}><input className="input" type="password" value={p.password} onChange={(e) => patch(i, { password: e.target.value })} /></Field><Field label="Notes" field={`portal-notes-${i}`}><textarea className="input textarea" value={p.notes} onChange={(e) => patch(i, { notes: e.target.value })} /></Field></div>} />}
          {tab === 6 && <div className="grid gap-3 md:grid-cols-2"><Field label="QRMP Preference" field="client-qrmp"><input className="input" value={form.qrmp} onChange={(e) => update("qrmp", e.target.value)} /></Field><Field label="Audit Firm Name" field="client-audit-firm"><input className="input" value={form.auditFirm} onChange={(e) => update("auditFirm", e.target.value)} /></Field><Field label="Bank Name" field="client-bank"><input className="input" value={form.bank} onChange={(e) => update("bank", e.target.value)} /></Field><Field label="IBAN" field="client-iban"><input className="input" value={form.iban} onChange={(e) => update("iban", e.target.value)} /></Field><div className="rounded-xl bg-slate-50 p-3 text-[12px] font-semibold text-slate-500 md:col-span-2">You can add custom fields from Settings</div></div>}
          {tab === 7 && <div className="space-y-3"><AttachmentUploadZone onFiles={uploadFiles} isUploading={isUploading} /><div className="overflow-x-auto"><table className="table min-w-max"><thead><tr><th>Name</th><th>Size</th><th>Type</th><th>Description</th><th>Uploaded On</th><th>Uploaded By</th><th>Actions</th></tr></thead><tbody>{attachments.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500">No attachments uploaded yet.</td></tr>}{attachments.map((a) => <tr key={a.id || a.name}><td>{a.name}</td><td>{a.size}</td><td>{a.type}</td><td>{a.description || "-"}</td><td>{a.uploadedOn}</td><td>{a.uploadedBy}</td><td><Button size="sm" variant="ghost" disabled={!a.url} onClick={() => a.url && window.open(a.url, "_blank", "noopener,noreferrer")}>Download</Button> <Button size="sm" variant="danger" onClick={() => removeAttachment(a)}>Delete</Button></td></tr>)}</tbody></table></div></div>}
        </div>
        <div className="flex flex-col gap-3 border-t border-[#e2e8f0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={goPrevious} disabled={isFirstTab || isSaving}>Previous</Button>
          <div className="flex justify-end gap-2">
            {!isLastTab && <Button onClick={saveAndContinue} disabled={isSaving}>{isSaving ? "Saving..." : "Save and Continue"}</Button>}
            {isLastTab && <Button onClick={() => saveClient()} disabled={isSaving}>{isSaving ? "Saving..." : "Add Client"}</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function AttachmentUploadZone({ onFiles, isUploading }) {
  const inputId = "client-attachment-upload";
  const handleDrop = (event) => {
    event.preventDefault();
    onFiles(event.dataTransfer.files);
  };
  return (
    <label
      className={`upload-zone cursor-pointer transition hover:bg-slate-100 ${isUploading ? "pointer-events-none opacity-70" : ""}`}
      htmlFor={inputId}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <UploadCloud className="mb-2 text-[#1e3a8a]" size={28} />
      <div className="text-[15px] font-extrabold text-slate-800">{isUploading ? "Uploading..." : "Upload attachments"}</div>
      <div className="mt-1 text-[12px] font-semibold text-slate-500">Browse or drag and drop PDF, JPG, PNG, DOCX, or XLSX files</div>
      <input
        id={inputId}
        name="clientAttachmentUpload"
        className="hidden"
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function DocumentUploadZone({ id, title, subtitle, fileName, documentUrl, isUploading, onFiles }) {
  const handleDrop = (event) => {
    event.preventDefault();
    onFiles(event.dataTransfer.files);
  };
  return (
    <label
      className={`upload-zone cursor-pointer transition hover:bg-slate-100 ${isUploading ? "pointer-events-none opacity-70" : ""}`}
      htmlFor={id}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <UploadCloud className="mb-2 text-[#64748b]" size={28} />
      <div className="text-[15px] font-extrabold text-slate-800">{isUploading ? "Uploading..." : title}</div>
      <div className="mt-1 text-[12px] font-semibold text-slate-500">{subtitle}</div>
      {fileName && <div className="mt-3 text-[13px] font-bold text-[#1e3a8a]">{fileName}</div>}
      {documentUrl && <button type="button" className="mt-3 text-[12px] font-bold text-slate-600 underline" onClick={(event) => { event.preventDefault(); window.open(documentUrl, "_blank", "noopener,noreferrer"); }}>Open current file</button>}
      <input
        id={id}
        name={id}
        className="hidden"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </label>
  );
}

function Basic({ form, update, countries, users }) {
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{["Legal Person", "Natural Person"].map((type) => <button key={type} onClick={() => update("clientType", type)} className={`rounded-xl border p-4 text-left ${form.clientType === type ? "border-[#1e3a8a] bg-blue-50" : "border-[#e2e8f0]"}`}><div className="font-extrabold">{type}</div><div className="text-[12px] text-slate-500">{type === "Legal Person" ? "Companies, branches, free zone entities" : "Individual taxable persons"}</div></button>)}</div><div className="grid gap-3 md:grid-cols-3"><Field label="File No." field="client-file-no"><input className="input" value={form.fileNo} onChange={(e) => update("fileNo", e.target.value)} /></Field><Field label="Legal Name*" field="client-legal-name"><input className="input" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} /></Field><Field label="Trade Name" field="client-trade-name"><input className="input" value={form.tradeName} onChange={(e) => update("tradeName", e.target.value)} /></Field><Field label="Financial Year End*" field="client-fye"><input className="input" value={form.fye} onChange={(e) => update("fye", e.target.value)} /></Field><Field label="Jurisdiction" field="client-jurisdiction"><select className="input" value={form.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)}><option>Mainland</option><option>Free Zone</option><option>Designated Zone</option><option>Offshore</option></select></Field><Field label="Assigned User" field="client-assigned-user"><select className="input" value={form.assigned} onChange={(e) => update("assigned", e.target.value)}><option value="">Select User</option>{users.map((u) => <option key={u.id || u._id} value={u.name}>{u.name}</option>)}</select></Field></div><div className="grid gap-3 md:grid-cols-5"><Field label="Country" field="client-country"><select className="input" value={form.country} onChange={(e) => update("country", e.target.value)}>{countries.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Emirate/State" field="client-emirate"><input className="input" value={form.emirate} onChange={(e) => update("emirate", e.target.value)} /></Field><Field label="Street" field="client-street"><input className="input" value={form.street} onChange={(e) => update("street", e.target.value)} /></Field><Field label="PO Box" field="client-po-box"><input className="input" value={form.poBox} onChange={(e) => update("poBox", e.target.value)} /></Field><Field label="Postal Code" field="client-postal-code"><input className="input" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></Field></div><label className="flex items-center gap-2 font-bold" htmlFor="client-different-address"><input id="client-different-address" name="clientDifferentAddress" type="checkbox" checked={form.differentAddress} onChange={(e) => update("differentAddress", e.target.checked)} /> Actual/Correspondence Address is different</label>{form.differentAddress && <textarea id="client-correspondence-address" name="clientCorrespondenceAddress" className="input textarea" value={form.correspondence} onChange={(e) => update("correspondence", e.target.value)} />}</div>;
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
