import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { useUsers } from "../../hooks/useUsers";
import { groupService } from "../../services/groupService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import { DIAL_CODE_OPTIONS } from "../../utils/dialCodeOptions.js";
import { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } from "../../utils/phoneUtils.js";

const tabs = ["Basic Details", "Trade Licences", "Contact Persons", "VAT / CT", "Client Group", "Portal Logins", "Custom Fields", "Attachments"];
const countryCodes = ["AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS","SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW"];

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
  useEffect(() => {
    fetchUsers().catch(() => {});
    groupService.list().then((groups) => dispatch({ type: "SET_RESOURCE", resource: "groups", payload: groups.map((g) => ({ ...g, id: g._id, clients: g.clients?.map((c) => c.legalName) || [] })) })).catch(() => {});
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
    const missingContactCodeIndex = contacts.findIndex((contact) => {
      const phoneDigits = normalizePhoneNumber(contact.mobile);
      if (!phoneDigits) return false;
      return !String(contact.code || "").trim();
    });
    if (missingContactCodeIndex >= 0) {
      toast.error(`Contact person ${missingContactCodeIndex + 1}: please select a country code.`);
      return;
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
          {tab === 0 && <Basic form={form} update={update} countries={countries} />}
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
                  <Field label="Emirates ID Number" field={`contact-eid-${i}`}><input className="input" value={c.eid} onChange={(e) => patch(i, { eid: e.target.value })} /></Field>
                  <Field label="Passport Number" field={`contact-passport-${i}`}><input className="input" value={c.passport} onChange={(e) => patch(i, { passport: e.target.value })} /></Field>
                  <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
                    <DocumentUploadZone id={`contact-eid-upload-${i}`} title="Upload Emirates ID" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={c.eidDocumentName} documentUrl={c.eidDocumentUrl} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "emiratesId")} />
                    <DocumentUploadZone id={`contact-passport-upload-${i}`} title="Upload passport" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={c.passportDocumentName} documentUrl={c.passportDocumentUrl} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "passport")} />
                  </div>
                </div>
              )}
            />
          )}
          {tab === 3 && <div className="grid gap-3 md:grid-cols-2"><Field label="VAT Registration Status" field="client-vat-status"><select className="input" value={form.vatStatus} onChange={(e) => update("vatStatus", e.target.value)}><option>Registered</option><option>Not Registered</option><option>Pending</option></select></Field><Field label="VAT TRN" field="client-vat-trn"><input className="input" value={form.vatTrn} onChange={(e) => update("vatTrn", e.target.value)} /></Field><Field label="VAT Registration Date" field="client-vat-date"><input className="input" type="date" value={form.vatDate} onChange={(e) => update("vatDate", e.target.value)} /></Field><Field label="VAT Filing Frequency" field="client-vat-frequency"><select className="input" value={form.vatFreq} onChange={(e) => update("vatFreq", e.target.value)}><option>Monthly</option><option>Quarterly</option></select></Field><Field label="CT Registration Number (TIN)" field="client-ct-tin"><input className="input" value={form.ctTin} onChange={(e) => update("ctTin", e.target.value)} /></Field><Field label="CT Registration Status" field="client-ct-status"><select className="input" value={form.ctStatus} onChange={(e) => update("ctStatus", e.target.value)}><option>Registered</option><option>Not Registered</option><option>Pending</option></select></Field><Field label="CT Registration Date" field="client-ct-date"><input className="input" type="date" value={form.ctDate} onChange={(e) => update("ctDate", e.target.value)} /></Field><label><span className="field-label">Financial Year End</span><FyeCalendarPicker id="client-ct-fye" value={form.fye} onChange={(v) => update("fye", v)} /></label></div>}
          {tab === 4 && <div className="grid gap-4 md:grid-cols-2"><Field label="Select existing group" field="client-group"><select className="input" value={form.group} onChange={(e) => update("group", e.target.value)}><option value="">No group</option>{state.groups.map((g) => <option key={g.id} value={g._id}>{g.name}</option>)}</select></Field><Field label="Create new group"><div className="flex gap-2"><input id="client-new-group" name="clientNewGroup" className="input" value={form.newGroup} onChange={(e) => update("newGroup", e.target.value)} /><Button onClick={async () => { if (form.newGroup) { const g = await groupService.create({ name: form.newGroup }); dispatch({ type: "SET_RESOURCE", resource: "groups", payload: [...state.groups, { ...g, id: g._id }] }); update("group", g._id); } }}>Create</Button></div></Field><div className="rounded-xl bg-purple-50 p-4 font-bold text-[#7c3aed] md:col-span-2">Current group: {state.groups.find((g) => g._id === form.group)?.name || "Ungrouped"} {form.group && <button onClick={() => update("group", "")} className="ml-3 text-[#dc2626]">Ungroup</button>}</div></div>}
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

const FYE_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const FYE_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FYE_DAYS_IN_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];
const FYE_DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function parseFye(value) {
  if (!value) return { day: null, month: null, year: null };
  const parts = value.trim().split(" ");
  const day = parseInt(parts[0], 10);
  const month = FYE_MONTHS.find((m) => m.toLowerCase() === parts[1]?.toLowerCase()) || null;
  const year = parts[2] ? parseInt(parts[2], 10) : null;
  return { day: isNaN(day) ? null : day, month, year: isNaN(year) ? null : year };
}

function getDaysInMonth(monthIdx, year) {
  if (monthIdx === 1) return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
  return FYE_DAYS_IN_MONTH[monthIdx];
}

function getFirstDayOfWeek(monthIdx, year) {
  return new Date(year, monthIdx, 1).getDay();
}

function FyeCalendarPicker({ value, onChange, id }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("cal");
  const wrapRef = useRef(null);
  const anchorRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const { day: selDay, month: selMonth, year: selYear } = parseFye(value);
  const now = new Date();
  const [navMonth, setNavMonth] = useState(selMonth ? FYE_MONTHS.indexOf(selMonth) : now.getMonth());
  const [navYear, setNavYear] = useState(selYear || now.getFullYear());

  function computePos() {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
  }

  function openPicker() {
    computePos();
    if (selMonth) setNavMonth(FYE_MONTHS.indexOf(selMonth));
    if (selYear) setNavYear(selYear);
    setView("cal");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setView("cal"); }
    }
    function onScroll() { computePos(); }
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", computePos);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", computePos);
    };
  }, [open]);

  function prevMonth() {
    if (navMonth === 0) { setNavMonth(11); setNavYear((y) => y - 1); }
    else setNavMonth((m) => m - 1);
  }
  function nextMonth() {
    if (navMonth === 11) { setNavMonth(0); setNavYear((y) => y + 1); }
    else setNavMonth((m) => m + 1);
  }
  function selectDay(day) {
    onChange(`${day} ${FYE_MONTHS[navMonth]} ${navYear}`);
    setOpen(false); setView("cal");
  }

  const daysInMonth = getDaysInMonth(navMonth, navYear);
  const firstDow = getFirstDayOfWeek(navMonth, navYear);
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = i - firstDow + 1;
    return d >= 1 && d <= daysInMonth ? d : null;
  });

  const isSelected = (d) => d && selDay === d && selMonth === FYE_MONTHS[navMonth] && selYear === navYear;
  const isToday = (d) => d && d === now.getDate() && navMonth === now.getMonth() && navYear === now.getFullYear();
  const yearStart = navYear - (navYear % 12);
  const yearGrid = Array.from({ length: 12 }, (_, i) => yearStart + i);

  const S = {
    popup: {
      position: "fixed", top: pos.top, left: pos.left,
      zIndex: 99999, background: "#fff",
      border: "1px solid #e2e8f0", borderRadius: 12,
      boxShadow: "0 8px 28px rgba(30,58,138,.14), 0 2px 8px rgba(0,0,0,.08)",
      width: 264, padding: "12px",
      animation: "fye-pop .14s ease",
    },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    navBtn: {
      width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      color: "#64748b", fontSize: 16, fontWeight: 700, transition: "all .12s ease",
    },
    headLabel: {
      fontSize: 13, fontWeight: 800, color: "#0f172a", cursor: "pointer",
      padding: "2px 7px", borderRadius: 6, transition: "background .12s",
    },
    dow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 },
    dowCell: { textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "3px 0" },
    dayGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 },
  };

  const navHover = (e) => { e.currentTarget.style.background = "#f1f5f9"; };
  const navLeave = (e) => { e.currentTarget.style.background = "transparent"; };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div ref={anchorRef} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          id={id} name={id} className="input" readOnly value={value}
          placeholder="Select date"
          onClick={() => open ? setOpen(false) : openPicker()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open ? setOpen(false) : openPicker(); } }}
          style={{ cursor: "pointer" }}
        />
        <button type="button" aria-label="Open calendar"
          onClick={() => open ? setOpen(false) : openPicker()}
          style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 8,
            background: open ? "#1e3a8a" : "#f1f5f9",
            border: "1px solid #e2e8f0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: open ? "#fff" : "#64748b", transition: "all .18s ease",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
      </div>

      {open && (
        <div style={S.popup}>

          {/* Calendar view */}
          {view === "cal" && (<>
            <div style={S.header}>
              <button type="button" style={S.navBtn} onMouseEnter={navHover} onMouseLeave={navLeave} onClick={prevMonth}>‹</button>
              <div>
                <span style={S.headLabel} onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} onClick={() => setView("months")}>{FYE_MONTHS_SHORT[navMonth]}</span>
                {" "}
                <span style={S.headLabel} onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }} onClick={() => setView("years")}>{navYear}</span>
              </div>
              <button type="button" style={S.navBtn} onMouseEnter={navHover} onMouseLeave={navLeave} onClick={nextMonth}>›</button>
            </div>
            <div style={S.dow}>
              {FYE_DOW.map((d) => <div key={d} style={S.dowCell}>{d}</div>)}
            </div>
            <div style={S.dayGrid}>
              {cells.map((d, i) => {
                const sel = isSelected(d);
                const tod = isToday(d);
                return (
                  <button key={i} type="button" disabled={!d}
                    onClick={() => d && selectDay(d)}
                    style={{
                      height: 32, borderRadius: 7,
                      border: sel ? "none" : tod ? "1.5px solid #1e3a8a" : "none",
                      background: sel ? "#1e3a8a" : "transparent",
                      color: !d ? "transparent" : sel ? "#fff" : tod ? "#1e3a8a" : "#334155",
                      fontSize: 12, fontWeight: sel ? 800 : tod ? 700 : 500,
                      cursor: d ? "pointer" : "default", transition: "all .12s ease",
                    }}
                    onMouseEnter={(e) => { if (d && !sel) { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1e3a8a"; } }}
                    onMouseLeave={(e) => { if (d && !sel) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = tod ? "#1e3a8a" : "#334155"; } }}
                  >{d || ""}</button>
                );
              })}
            </div>
          </>)}

          {/* Month picker */}
          {view === "months" && (<>
            <div style={S.header}>
              <button type="button" style={S.navBtn} onMouseEnter={navHover} onMouseLeave={navLeave} onClick={() => setNavYear((y) => y - 1)}>‹</button>
              <span style={{ ...S.headLabel, cursor: "default" }}>{navYear}</span>
              <button type="button" style={S.navBtn} onMouseEnter={navHover} onMouseLeave={navLeave} onClick={() => setNavYear((y) => y + 1)}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
              {FYE_MONTHS_SHORT.map((m, i) => {
                const isSel = FYE_MONTHS.indexOf(selMonth) === i && selYear === navYear;
                const isCur = i === navMonth;
                return (
                  <button key={m} type="button" onClick={() => { setNavMonth(i); setView("cal"); }}
                    style={{ padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: isSel ? 800 : 600, background: isSel ? "#1e3a8a" : isCur ? "#eff6ff" : "transparent", color: isSel ? "#fff" : isCur ? "#1e3a8a" : "#334155", transition: "all .12s ease" }}
                    onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1e3a8a"; } }}
                    onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = isCur ? "#eff6ff" : "transparent"; e.currentTarget.style.color = isCur ? "#1e3a8a" : "#334155"; } }}
                  >{m}</button>
                );
              })}
            </div>
          </>)}

          {/* Year picker */}
          {view === "years" && (<>
            <div style={S.header}>
              <button type="button" style={S.navBtn} onMouseEnter={navHover} onMouseLeave={navLeave} onClick={() => setNavYear((y) => y - 12)}>‹</button>
              <span style={{ ...S.headLabel, cursor: "default" }}>{yearGrid[0]}–{yearGrid[11]}</span>
              <button type="button" style={S.navBtn} onMouseEnter={navHover} onMouseLeave={navLeave} onClick={() => setNavYear((y) => y + 12)}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
              {yearGrid.map((y) => {
                const isSel = selYear === y;
                const isCur = navYear === y;
                return (
                  <button key={y} type="button" onClick={() => { setNavYear(y); setView("cal"); }}
                    style={{ padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: isSel ? 800 : 600, background: isSel ? "#1e3a8a" : isCur ? "#eff6ff" : "transparent", color: isSel ? "#fff" : isCur ? "#1e3a8a" : "#334155", transition: "all .12s ease" }}
                    onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1e3a8a"; } }}
                    onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = isCur ? "#eff6ff" : "transparent"; e.currentTarget.style.color = isCur ? "#1e3a8a" : "#334155"; } }}
                  >{y}</button>
                );
              })}
            </div>
          </>)}

        </div>
      )}
      <style>{`@keyframes fye-pop { from { opacity:0; transform:translateY(-4px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
    </div>
  );
}



function Basic({ form, update, countries }) {
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{["Legal Person", "Natural Person"].map((type) => <button key={type} onClick={() => update("clientType", type)} className={`rounded-xl border p-4 text-left ${form.clientType === type ? "border-[#1e3a8a] bg-blue-50" : "border-[#e2e8f0]"}`}><div className="font-extrabold">{type}</div><div className="text-[12px] text-slate-500">{type === "Legal Person" ? "Companies, branches, free zone entities" : "Individual taxable persons"}</div></button>)}</div><div className="grid gap-3 md:grid-cols-3"><Field label="File No." field="client-file-no"><input className="input" value={form.fileNo} onChange={(e) => update("fileNo", e.target.value)} /></Field><Field label="Legal Name*" field="client-legal-name"><input className="input" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} /></Field><Field label="Trade Name" field="client-trade-name"><input className="input" value={form.tradeName} onChange={(e) => update("tradeName", e.target.value)} /></Field><label><span className="field-label">Financial Year End*</span><FyeCalendarPicker id="client-fye" value={form.fye} onChange={(v) => update("fye", v)} /></label><Field label="Jurisdiction" field="client-jurisdiction"><select className="input" value={form.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)}><option>Mainland</option><option>Free Zone</option><option>Designated Zone</option><option>Offshore</option></select></Field><Field label="Assigned User" field="client-assigned-user"><input className="input" value={form.assigned} onChange={(e) => update("assigned", e.target.value)} /></Field></div><div className="grid gap-3 md:grid-cols-5"><Field label="Country" field="client-country"><select className="input" value={form.country} onChange={(e) => update("country", e.target.value)}>{countries.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Emirate/State" field="client-emirate"><input className="input" value={form.emirate} onChange={(e) => update("emirate", e.target.value)} /></Field><Field label="Street" field="client-street"><input className="input" value={form.street} onChange={(e) => update("street", e.target.value)} /></Field><Field label="PO Box" field="client-po-box"><input className="input" value={form.poBox} onChange={(e) => update("poBox", e.target.value)} /></Field><Field label="Postal Code" field="client-postal-code"><input className="input" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></Field></div><label className="flex items-center gap-2 font-bold" htmlFor="client-different-address"><input id="client-different-address" name="clientDifferentAddress" type="checkbox" checked={form.differentAddress} onChange={(e) => update("differentAddress", e.target.checked)} /> Actual/Correspondence Address is different</label>{form.differentAddress && <textarea id="client-correspondence-address" name="clientCorrespondenceAddress" className="input textarea" value={form.correspondence} onChange={(e) => update("correspondence", e.target.value)} />}</div>;
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
