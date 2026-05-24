import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Copy, Eye, EyeOff, Plus, Search, Trash2, UploadCloud, X, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useClients } from "../../hooks/useClients";
import { mapUser } from "../../hooks/useUsers";
import { userService } from "../../services/userService";
import { groupService } from "../../services/groupService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import CustomFieldModal from "../ui/CustomFieldModal.jsx";
import { DIAL_CODE_OPTIONS } from "../../utils/dialCodeOptions.js";
import { getPhoneNumberSpec, normalizeDialCode, normalizePhoneNumber } from "../../utils/phoneUtils.js";

const tabs = ["Basic Details", "Trade Licences", "Contact Persons", "VAT / CT", "Client Group", "Portal Logins", "Custom Fields", "Attachments"];
const blankPortal = { name: "", url: "", username: "", password: "", notes: "" };
const DROPDOWN_PAGE_SIZE = 5;
const countryCodes = ["AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW"];

function getApiErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  return "";
}

function listItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function optionId(option) {
  return option?.id || option?._id || "";
}

function mergeOptions(primary, extra) {
  const seen = new Set();
  return [...primary, ...extra].filter((item) => {
    const id = optionId(item);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function mapGroup(group) {
  return {
    ...group,
    id: group._id,
    clients: group.clients || [],
    clientNames: group.clients?.map((client) => client.legalName) || [],
  };
}

const FINANCIAL_YEAR_OPTIONS = [
  "Jan - Dec",
  "Feb - Jan",
  "Mar - Feb",
  "Apr - Mar",
  "May - Apr",
  "Jun - May",
  "Jul - Jun",
  "Aug - Jul",
  "Sep - Aug",
  "Oct - Sep",
  "Nov - Oct",
  "Dec - Nov",
];

function normalizeFinancialYearEnd(value) {
  if (!value) return "Jan - Dec";
  if (FINANCIAL_YEAR_OPTIONS.includes(value)) return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "31 december" || normalized === "december") return "Jan - Dec";
  if (normalized === "31 march" || normalized === "march") return "Apr - Mar";
  if (normalized === "30 june" || normalized === "june") return "Jul - Jun";
  if (normalized === "30 september" || normalized === "september") return "Oct - Sep";

  return "Jan - Dec";
}

export default function AddClient() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { createClient, getClient, updateClient, uploadAttachment, uploadDocument, deleteAttachment } = useClients();
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
    clientType: "", fileNo: "", legalName: "", tradeName: "", fye: "Jan - Dec", jurisdiction: "Mainland", assigned: "",
    country: "United Arab Emirates", emirate: "Dubai", street: "", poBox: "", postalCode: "", differentAddress: false, correspondence: "",
    vatTrn: "", vatStatus: "Registered", vatDate: "", vatFreq: "Quarterly", ctTin: "", ctStatus: "Not Registered", ctDate: "", group: "", newGroup: "",
  });
  const [licences, setLicences] = useState([{ number: "", issue: "", expiry: "", authority: "Dubai Economy", type: "Commercial", email: "", documentUrl: "", documentName: "", documentFile: null }]);

  const [contacts, setContacts] = useState([{
    name: "",
    designation: "",
    email: "",
    code: "",
    mobile: "",
    whatsapp: "",
    alternate: "",
    primary: true,
    eid: "",
    eidIssue: "",
    eidExpiry: "",
    passport: "",
    passportIssue: "",
    passportExpiry: "",
    issuingCountry: "United Arab Emirates",
    eidDocumentUrl: "",
    eidDocumentName: "",
    eidDocumentFile: null,
    passportDocumentUrl: "",
    passportDocumentName: "",
    passportDocumentFile: null,
  }]);
  const [portals, setPortals] = useState([blankPortal]);
  const [visiblePortalPasswords, setVisiblePortalPasswords] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [customFieldModal, setCustomFieldModal] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [selectedFieldKeys, setSelectedFieldKeys] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userOptions, setUserOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);
  const [isGroupSearchLoading, setIsGroupSearchLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const loadUserOptions = useCallback(async (search = "") => {
    setIsUserSearchLoading(true);
    try {
      const users = listItems(await userService.list({ page: 1, limit: DROPDOWN_PAGE_SIZE, search })).map(mapUser);
      setUserOptions((current) => mergeOptions(users, current.filter((user) => optionId(user) === form.assigned)));
    } finally {
      setIsUserSearchLoading(false);
    }
  }, [form.assigned]);

  const loadGroupOptions = useCallback(async (search = "") => {
    setIsGroupSearchLoading(true);
    try {
      const groups = listItems(await groupService.list({ page: 1, limit: DROPDOWN_PAGE_SIZE, search })).map(mapGroup);
      setGroupOptions((current) => mergeOptions(groups, current.filter((group) => optionId(group) === form.group)));
      dispatch({ type: "SET_RESOURCE", resource: "groups", payload: groups });
    } finally {
      setIsGroupSearchLoading(false);
    }
  }, [dispatch, form.group]);

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
    import("../../services/customFieldService").then(({ customFieldService }) => {
      customFieldService.list().then((fields) => dispatch({ type: "SET_RESOURCE", resource: "customFields", payload: fields })).catch(() => { });
    });
  }, [dispatch]);

  useEffect(() => {
    const query = userSearch.trim();
    const delay = !query ? 0 : query.length >= 3 ? 400 : 2000;
    const timer = window.setTimeout(() => {
      loadUserOptions(query).catch(() => { });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [loadUserOptions, userSearch]);

  useEffect(() => {
    const query = groupSearch.trim();
    const delay = !query ? 0 : query.length >= 3 ? 400 : 2000;
    const timer = window.setTimeout(() => {
      loadGroupOptions(query).catch(() => { });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [groupSearch, loadGroupOptions]);
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
        fye: normalizeFinancialYearEnd(client.financialYearEnd || client.ctDetails?.financialYearEnd || ""),
        jurisdiction: jurisdictionLabels[client.jurisdiction] || "Mainland",
        assigned: client.assignedUser?._id || client.assignedUser || "",
        country: client.registeredAddress?.country || "United Arab Emirates",
        emirate: client.registeredAddress?.emirate || "",
        street: client.registeredAddress?.street || "",
        poBox: client.registeredAddress?.poBox || "",
        postalCode: client.registeredAddress?.postalCode || "",
        differentAddress: Boolean(client.correspondenceAddress?.street || client.correspondenceAddress?.country || client.correspondenceAddress?.emirate),
        correspondence: client.correspondenceAddress?.street || "",
        vatTrn: client.vatDetails?.trn || "",
        vatStatus: client.vatDetails?.status === "registered" ? "Registered" : client.vatDetails?.status === "applying" ? "Applying / In Progress" : client.vatDetails?.status === "exempt" ? "Exempt" : "Not Registered",
        vatDate: client.vatDetails?.registrationDate?.slice?.(0, 10) || "",
        vatFreq: client.vatDetails?.filingFrequency ? `${client.vatDetails.filingFrequency[0].toUpperCase()}${client.vatDetails.filingFrequency.slice(1)}` : "Quarterly",
        ctTin: client.ctDetails?.tin || "",
        ctStatus: client.ctDetails?.status === "registered" ? "Registered" : client.ctDetails?.status === "applying" ? "Pending" : "Not Registered",
        ctDate: client.ctDetails?.registrationDate?.slice?.(0, 10) || "",
        group: client.group?._id || client.group || "",
        newGroup: "",
      });
      if (client.assignedUser?._id) {
        setUserOptions((current) => mergeOptions(current, [mapUser(client.assignedUser)]));
      }
      if (client.group?._id) {
        const selectedGroup = mapGroup(client.group);
        setGroupOptions((current) => mergeOptions(current, [selectedGroup]));
        dispatch({ type: "SET_RESOURCE", resource: "groups", payload: mergeOptions(state.groups || [], [selectedGroup]) });
      }
      const clientFields = client.customFields || {};
      setCustomFieldValues(clientFields);
      
      // Identify which dynamic fields have values and should be "selected"
      const dynamicKeys = Object.keys(clientFields);
      setSelectedFieldKeys(dynamicKeys);

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
        eidIssue: person.emiratesId?.issueDate?.slice?.(0, 10) || "",
        eidExpiry: person.emiratesId?.expiryDate?.slice?.(0, 10) || "",
        passport: person.passport?.number || "",
        passportIssue: person.passport?.issueDate?.slice?.(0, 10) || "",
        passportExpiry: person.passport?.expiryDate?.slice?.(0, 10) || "",
        issuingCountry: person.passport?.issuingCountry || primaryContact.passport?.issuingCountry || "United Arab Emirates",
        eidDocumentUrl: person.emiratesId?.documentUrl || "",
        eidDocumentName: person.emiratesId?.documentUrl ? person.emiratesId.documentUrl.split("/").pop() : "",
        eidDocumentFile: null,
        passportDocumentUrl: person.passport?.documentUrl || "",
        passportDocumentName: person.passport?.documentUrl ? person.passport.documentUrl.split("/").pop() : "",
        passportDocumentFile: null,
      })) : [{
        name: "",
        designation: "",
        email: "",
        code: "",
        mobile: "",
        whatsapp: "",
        alternate: "",
        primary: true,
        eid: "",
        eidIssue: "",
        eidExpiry: "",
        passport: "",
        passportIssue: "",
        passportExpiry: "",
        issuingCountry: "United Arab Emirates",
        eidDocumentUrl: "",
        eidDocumentName: "",
        eidDocumentFile: null,
        passportDocumentUrl: "",
        passportDocumentName: "",
        passportDocumentFile: null,
      }]);
      setPortals((client.portalLogins || []).length ? client.portalLogins.map((portal) => ({
        name: portal.portalName || "",
        url: portal.portalUrl || "",
        username: portal.username || "",
        password: portal.password || "",
        notes: portal.notes || "",
      })) : [blankPortal]);
      setVisiblePortalPasswords({});
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

  async function uploadFiles(files, description = "") {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const attachmentNote = String(description || "").trim();
    if (!isEditMode) {
      setAttachments((current) => [
        ...current,
        ...selected.map((file) => ({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          name: file.name,
          size: formatFileSize(file.size),
          type: file.type || file.name.split(".").pop()?.toUpperCase() || "File",
          description: attachmentNote,
          uploadedOn: "Pending save",
          uploadedBy: "You",
          file,
          saved: false,
        })),
      ]);
      setAttachmentDescription("");
      toast.success("File added. Save the client to upload it.");
      return;
    }
    setIsUploading(true);
    try {
      let uploaded = [];
      for (const file of selected) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("description", attachmentNote);
        uploaded = await uploadAttachment(id, formData);
      }
      setAttachments(mapSavedAttachments(uploaded));
      setAttachmentDescription("");
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
    if (!form.clientType) {
      toast.error("Please select the client type.");
      return false;
    }
    if (!form.legalName) {
      toast.error("Please enter the client legal name.");
      return false;
    }
    const includeVatCt = !continueToNext || tab >= 3;
    const shouldValidateVat = includeVatCt;
    if (shouldValidateVat) {
      const vatTrn = String(form.vatTrn || "").trim();
      const vatStatus = String(form.vatStatus || "").trim();
      if (vatStatus === "Registered" && !vatTrn) {
        toast.error("VAT TRN is required when VAT status is Registered.");
        return false;
      }
      if (vatTrn && !/^1\d{14}$/.test(vatTrn)) {
        toast.error("VAT TRN must be a 15-digit number starting with 1.");
        return false;
      }
    }
    const shouldValidateContacts = !continueToNext || tab >= 2;
    if (shouldValidateContacts) {
      const emiratesIdPattern = /^\d{3}-\d{4}-\d{7}-\d$/;
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const missingContactNameIndex = contacts.findIndex((contact) => !String(contact.name || "").trim());
      if (missingContactNameIndex >= 0) {
        toast.error(`Contact person ${missingContactNameIndex + 1}: full name is required.`);
        return false;
      }
      const missingContactEmailIndex = contacts.findIndex((contact) => !String(contact.email || "").trim());
      if (missingContactEmailIndex >= 0) {
        toast.error(`Contact person ${missingContactEmailIndex + 1}: email is required.`);
        return false;
      }
      const invalidContactEmailIndex = contacts.findIndex((contact) => {
        const value = String(contact.email || "").trim();
        if (!value) return false;
        return !emailPattern.test(value);
      });
      if (invalidContactEmailIndex >= 0) {
        toast.error(`Contact person ${invalidContactEmailIndex + 1}: invalid email address.`);
        return false;
      }
      const missingMobileIndex = contacts.findIndex((contact) => !normalizePhoneNumber(contact.mobile));
      if (missingMobileIndex >= 0) {
        toast.error(`Contact person ${missingMobileIndex + 1}: mobile number is required.`);
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
    }
    setIsSaving(true);
    try {
      const includeTradeLicences = !continueToNext || tab >= 1;
      const includeContactPersons = !continueToNext || tab >= 2;
      // The screen state is intentionally tab-oriented and user-friendly; this transform is
      // where we fold it back into the nested API contract expected by the Mongo model.
      const payload = {
        clientType: form.clientType === "Natural Person" ? "natural" : "legal",
        fileNo: form.fileNo || undefined,
        legalName: form.legalName,
        tradeName: form.tradeName,
        financialYearEnd: form.fye,
        jurisdiction: form.jurisdiction === "Free Zone" ? "freezone" : form.jurisdiction === "Designated Zone" ? "designated_zone" : form.jurisdiction.toLowerCase(),
        assignedUser: form.assigned || undefined,
        registeredAddress: { country: form.country, emirate: form.emirate, street: form.street, poBox: form.poBox, postalCode: form.postalCode },
        correspondenceAddress: form.differentAddress ? { street: form.correspondence } : undefined,
        group: form.group || undefined,
        portalLogins: portals
          .filter((p) => [p.name, p.url, p.username, p.password, p.notes].some((value) => String(value || "").trim()))
          .map((p) => ({ portalName: p.name, portalUrl: p.url, username: p.username, password: p.password, notes: p.notes })),
        customFields: { qrmpPreference: form.qrmp, auditFirmName: form.auditFirm, bankName: form.bank, iban: form.iban },
      };
      if (includeVatCt) {
        payload.vatDetails = { trn: form.vatTrn, status: form.vatStatus === "Registered" ? "registered" : form.vatStatus === "Applying / In Progress" ? "applying" : form.vatStatus === "Exempt" ? "exempt" : "not_registered", registrationDate: form.vatDate, filingFrequency: form.vatFreq.toLowerCase() };
        payload.ctDetails = { tin: form.ctTin, status: form.ctStatus === "Registered" ? "registered" : form.ctStatus === "Pending" ? "applying" : "not_registered", registrationDate: form.ctDate, financialYearEnd: form.fye };
      }
      if (includeTradeLicences) {
        payload.tradeLicences = licences
          .filter((l) => String(l.number || "").trim())
          .map((l) => ({
            licenceNumber: l.number,
            issueDate: l.issue,
            expiryDate: l.expiry,
            issuingAuthority: l.authority,
            licenceType: l.type?.toLowerCase() || "commercial",
            officialEmail: l.email,
            documentUrl: l.documentUrl || undefined,
          }));
      }
      if (includeContactPersons) {
        payload.contactPersons = contacts.map((c) => ({
          fullName: c.name,
          designation: c.designation,
          email: c.email,
          mobile: { countryCode: normalizeDialCode(c.code), number: normalizePhoneNumber(c.mobile) },
          whatsapp: c.whatsapp,
          alternateEmail: c.alternate,
          isPrimary: c.primary,
          emiratesId: {
            number: c.eid,
            issueDate: c.eidIssue,
            expiryDate: c.eidExpiry,
            documentUrl: c.eidDocumentUrl || undefined,
          },
          passport: {
            number: c.passport,
            issuingCountry: c.issuingCountry,
            issueDate: c.passportIssue,
            expiryDate: c.passportExpiry,
            documentUrl: c.passportDocumentUrl || undefined,
          },
        }));
      }
      payload.customFields = Object.fromEntries(Object.entries(customFieldValues).filter(([k]) => selectedFieldKeys.includes(k)));
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
  const togglePortalPassword = (index) => {
    setVisiblePortalPasswords((current) => ({ ...current, [index]: !current[index] }));
  };
  const copyPortalPassword = async (password) => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied.");
    } catch {
      toast.error("Unable to copy password.");
    }
  };
  const isFirstTab = tab === 0;
  const isLastTab = tab === tabs.length - 1;

  return (
    <div className="space-y-5">
      <div>
        <div className="page-kicker">Client Master</div>
        <h2 className="screen-title">{isEditMode ? "Edit Client" : "Add Client"}</h2>
      </div>
      <Card>
        <div className="flex overflow-x-auto rounded-t-xl border-b border-[#e2e8f0] bg-slate-50 p-2">{tabs.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`mr-1 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-extrabold ${tab === i ? "bg-[#1e3a8a] text-white" : "text-slate-600 hover:bg-white"}`}>{t}</button>)}</div>
        <div className="p-4">
          {tab === 0 && (
            <Basic
              form={form}
              update={update}
              countries={countries}
              users={userOptions}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              isUserSearchLoading={isUserSearchLoading}
            />
          )}
          {tab === 1 && <Repeat title="Trade Licence" items={licences} setItems={setLicences} blank={{ number: "", issue: "", expiry: "", authority: "", type: "", email: "", documentUrl: "", documentName: "", documentFile: null }} render={(lic, i, patch) => <div className="grid gap-3 md:grid-cols-3"><Field label="Licence Number*" field={`licence-number-${i}`}><input className="input" value={lic.number} onChange={(e) => patch(i, { number: e.target.value })} /></Field><Field label="Issue Date" field={`licence-issue-${i}`}><input className="input" type="date" value={lic.issue} onChange={(e) => patch(i, { issue: e.target.value })} /></Field><Field label="Expiry Date" field={`licence-expiry-${i}`}><input className="input" type="date" value={lic.expiry} onChange={(e) => patch(i, { expiry: e.target.value })} /></Field><Field label="Issuing Authority" field={`licence-authority-${i}`}><input className="input" value={lic.authority} onChange={(e) => patch(i, { authority: e.target.value })} /></Field><Field label="Licence Type" field={`licence-type-${i}`}><input className="input" value={lic.type} onChange={(e) => patch(i, { type: e.target.value })} /></Field><Field label="Official Email" field={`licence-email-${i}`}><input className="input" value={lic.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field><div className="md:col-span-3"><DocumentUploadZone id={`trade-licence-upload-${i}`} title="Upload trade licence" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={lic.documentName} documentUrl={lic.documentUrl} isUploading={isUploading} onFiles={(files) => handleTradeLicenceFile(i, files)} /></div></div>} />}
          {tab === 2 && (
            <Repeat
              title="Contact Person"
              items={contacts}
              setItems={setContacts}
              blank={{ name: "", designation: "", email: "", code: "", mobile: "", whatsapp: "", alternate: "", primary: false, eid: "", eidIssue: "", eidExpiry: "", passport: "", passportIssue: "", passportExpiry: "", issuingCountry: "United Arab Emirates", eidDocumentUrl: "", eidDocumentName: "", eidDocumentFile: null, passportDocumentUrl: "", passportDocumentName: "", passportDocumentFile: null }}
              render={(c, i, patch) => (
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Full Name*" field={`contact-name-${i}`}><input className="input" value={c.name} onChange={(e) => patch(i, { name: e.target.value })} /></Field>
                  <Field label="Designation" field={`contact-designation-${i}`}><input className="input" value={c.designation} onChange={(e) => patch(i, { designation: e.target.value })} /></Field>
                  <Field label="Email*" field={`contact-email-${i}`}><input className="input" type="email" inputMode="email" value={c.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field>
                  <Field label="Mobile*">
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
                      onChange={(e) => patch(i, { mobile: normalizePhoneNumber(e.target.value) })}
                      placeholder={getPhoneNumberSpec(c.code).placeholder}
                      inputMode="numeric"
                    />
                  </div>
                </Field>
                  <Field label="WhatsApp Number" field={`contact-whatsapp-${i}`}><input className="input" value={c.whatsapp} onChange={(e) => patch(i, { whatsapp: e.target.value })} /></Field>
                  <Field label="Alternate Email" field={`contact-alternate-${i}`}><input className="input" value={c.alternate} onChange={(e) => patch(i, { alternate: e.target.value })} /></Field>
                  <label className="flex items-center gap-2 font-bold" htmlFor={`contact-primary-${i}`}><input id={`contact-primary-${i}`} name={`contactPrimary${i}`} type="checkbox" checked={c.primary} onChange={(e) => {
                    const checked = e.target.checked;
                    setContacts((current) => current.map((entry, idx) => idx === i ? { ...entry, primary: checked } : checked ? { ...entry, primary: false } : entry));
                  }} /> Primary Contact</label>
                  <Field label="Emirates ID Number" field={`contact-eid-${i}`}><input className="input" placeholder="784-XXXX-XXXXXXX-X" value={c.eid} onChange={(e) => patch(i, { eid: formatEmiratesIdInput(e.target.value) })} /></Field>
                  <Field label="Emirates ID Issue Date" field={`contact-eid-issue-${i}`}><input className="input" type="date" value={c.eidIssue} onChange={(e) => patch(i, { eidIssue: e.target.value })} /></Field>
                  <Field label="Emirates ID Expiry" field={`contact-eid-expiry-${i}`}><input className="input" type="date" value={c.eidExpiry} onChange={(e) => patch(i, { eidExpiry: e.target.value })} /></Field>
                  <Field label="Passport Number" field={`contact-passport-${i}`}><input className="input" value={c.passport} onChange={(e) => patch(i, { passport: e.target.value })} /></Field>
                  <Field label="Passport Issue Date" field={`contact-passport-issue-${i}`}><input className="input" type="date" value={c.passportIssue} onChange={(e) => patch(i, { passportIssue: e.target.value })} /></Field>
                  <Field label="Passport Expiry" field={`contact-passport-expiry-${i}`}><input className="input" type="date" value={c.passportExpiry} onChange={(e) => patch(i, { passportExpiry: e.target.value })} /></Field>
                  <Field label="Passport Issuing Country" field={`contact-passport-country-${i}`}><><input className="input" list="passport-issuing-countries" value={c.issuingCountry} onChange={(e) => patch(i, { issuingCountry: e.target.value })} /><datalist id="passport-issuing-countries">{countries.map((country) => <option key={country} value={country} />)}</datalist></></Field>
                  <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
                    <DocumentUploadZone id={`contact-eid-upload-${i}`} title="Upload Emirates ID" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={c.eidDocumentName} documentUrl={c.eidDocumentUrl} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "emiratesId")} />
                    <DocumentUploadZone id={`contact-passport-upload-${i}`} title="Upload passport" subtitle="PDF, JPG, PNG, DOCX, XLSX" fileName={c.passportDocumentName} documentUrl={c.passportDocumentUrl} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "passport")} />
                  </div>
                </div>
              )}
            />
          )}
          {tab === 3 && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="VAT Registration Status" field="client-vat-status">
                <select className="input" value={form.vatStatus} onChange={(e) => update("vatStatus", e.target.value)}>
                  <option>Registered</option>
                  <option>Applying / In Progress</option>
                  <option>Not Registered</option>
                  <option>Exempt</option>
                </select>
              </Field>
              <Field label="VAT TRN" field="client-vat-trn">
                <input className="input" inputMode="numeric" maxLength={15} placeholder="15 digits starting with 1" value={form.vatTrn} onChange={(e) => update("vatTrn", String(e.target.value || "").replace(/\D+/g, "").slice(0, 15))} />
              </Field>
              <Field label="VAT Registration Date" field="client-vat-date">
                <input className="input" type="date" value={form.vatDate} onChange={(e) => update("vatDate", e.target.value)} />
              </Field>
              <Field label="VAT Filing Frequency" field="client-vat-frequency">
                <select className="input" value={form.vatFreq} onChange={(e) => update("vatFreq", e.target.value)}>
                  <option>Monthly</option>
                  <option>Quarterly</option>
                  <option>Annual</option>
                </select>
              </Field>
              <Field label="CT Registration Number (TIN)" field="client-ct-tin">
                <input className="input" value={form.ctTin} onChange={(e) => update("ctTin", e.target.value)} />
              </Field>
              <Field label="CT Registration Status" field="client-ct-status">
                <select className="input" value={form.ctStatus} onChange={(e) => update("ctStatus", e.target.value)}>
                  <option>Registered</option>
                  <option>Not Registered</option>
                  <option>Pending</option>
                </select>
              </Field>
              <Field label="CT Registration Date" field="client-ct-date">
                <input className="input" type="date" value={form.ctDate} onChange={(e) => update("ctDate", e.target.value)} />
              </Field>
              <Field label="Financial Year End" field="client-ct-fye">
                <select className="input" value={form.fye} onChange={(e) => update("fye", e.target.value)}>
                  {FINANCIAL_YEAR_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {tab === 4 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Select existing group" field="client-group">
                <SearchableSelect
                  id="client-group"
                  value={form.group}
                  options={groupOptions}
                  searchValue={groupSearch}
                  onSearchChange={setGroupSearch}
                  onChange={(value) => update("group", value)}
                  getLabel={(group) => group.name}
                  placeholder="No group"
                  searchPlaceholder="Search groups..."
                  loading={isGroupSearchLoading}
                  emptyLabel="No matching groups"
                />
              </Field>
              <Field label="Create new group">
                <div className="flex gap-2">
                  <input id="client-new-group" name="clientNewGroup" className="input" value={form.newGroup} onChange={(e) => update("newGroup", e.target.value)} />
                  <Button onClick={async () => {
                    if (form.newGroup) {
                      const g = await groupService.create({ name: form.newGroup });
                      dispatch({
                        type: "SET_RESOURCE",
                        resource: "groups",
                        payload: [...state.groups, mapGroup(g)]
                      });
                      setGroupOptions((current) => mergeOptions([mapGroup(g)], current));
                      update("group", g._id);
                    }
                  }}>Create</Button>
                </div>
              </Field>
              <div className="rounded-xl bg-purple-50 p-4 font-bold text-[#7c3aed] md:col-span-2">
                Current group: {groupOptions.find((g) => optionId(g) === form.group)?.name || "Ungrouped"} {form.group && <button onClick={() => update("group", "")} className="ml-3 text-[#dc2626]">Ungroup</button>}
              </div>
            </div>
          )}
          {tab === 5 && (
            <Repeat
              title="Portal"
              items={portals}
              setItems={setPortals}
              blank={blankPortal}
              render={(p, i, patch) => (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Portal Name" field={`portal-name-${i}`}><input className="input" value={p.name} autoComplete="off" onChange={(e) => patch(i, { name: e.target.value })} /></Field>
                  <Field label="URL" field={`portal-url-${i}`}><input className="input" value={p.url} autoComplete="off" onChange={(e) => patch(i, { url: e.target.value })} /></Field>
                  <Field label="Username/TRN" field={`portal-username-${i}`}>
                    <input
                      className="input"
                      name={`clientPortalLogin${i}`}
                      value={p.username}
                      autoComplete="off"
                      onChange={(e) => patch(i, { username: e.target.value })}
                    />
                  </Field>
                  <Field label="Password" field={`portal-password-${i}`}>
                    <div className="flex gap-2">
                      <input
                        id={`portal-password-${i}`}
                        name={`clientPortalSecret${i}`}
                        className="input"
                        type={visiblePortalPasswords[i] ? "text" : "password"}
                        value={p.password}
                        autoComplete="new-password"
                        onChange={(e) => patch(i, { password: e.target.value })}
                      />
                      <button
                        type="button"
                        className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 transition hover:bg-slate-50"
                        title={visiblePortalPasswords[i] ? "Hide password" : "Show password"}
                        aria-label={visiblePortalPasswords[i] ? "Hide password" : "Show password"}
                        onClick={() => togglePortalPassword(i)}
                      >
                        {visiblePortalPasswords[i] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-[#e2e8f0] bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                        title="Copy password"
                        aria-label="Copy password"
                        disabled={!p.password}
                        onClick={() => copyPortalPassword(p.password)}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </Field>
                  <Field label="Notes" field={`portal-notes-${i}`}><textarea className="input textarea" value={p.notes} autoComplete="off" onChange={(e) => patch(i, { notes: e.target.value })} /></Field>
                </div>
              )}
            />
          )}
          {tab === 6 && (
            <div className="space-y-6">
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Custom Fields</h3>
                    <p className="text-[11px] font-bold text-slate-400">Configure custom data points for this client</p>
                  </div>
                  <Button variant="ghost" className="h-9 gap-2 border-slate-200 text-blue-600 hover:bg-blue-50" onClick={() => setCustomFieldModal(true)}>
                    <Plus size={14} /> Create New Field
                  </Button>
                </div>

                <div className="relative mb-6">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Settings2 size={16} />
                  </div>
                  <input
                    type="search"
                    className="input"
                    style={{ paddingLeft: "3.25rem" }}
                    placeholder="Search available fields to add..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
                      {(state.customFields || [])
                        .filter(f => !selectedFieldKeys.includes(f.key))
                        .filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase()) || f.key.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(f => (
                          <button
                            key={f._id}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"
                            onClick={() => {
                              setSelectedFieldKeys([...selectedFieldKeys, f.key]);
                              setSearchQuery("");
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                                <Settings2 size={16} />
                              </div>
                              <div>
                                <div className="text-[13px] font-extrabold text-slate-900">{f.label}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.type}</div>
                              </div>
                            </div>
                            <Plus size={16} className="text-slate-300" />
                          </button>
                        ))}
                      {(state.customFields || [])
                        .filter(f => !selectedFieldKeys.includes(f.key))
                        .filter(f => f.label.toLowerCase().includes(searchQuery.toLowerCase()) || f.key.toLowerCase().includes(searchQuery.toLowerCase()))
                        .length === 0 && (
                          <div className="py-4 text-center text-[12px] font-bold text-slate-400">
                            No matching fields found
                          </div>
                        )}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {(state.customFields || [])
                    .filter(f => selectedFieldKeys.includes(f.key))
                    .map((f) => (
                      <div key={f._id} className="rounded-xl border border-slate-200 p-4 transition-all hover:border-blue-200 hover:bg-slate-50/50 relative group">
                        <button
                          className="absolute right-3 top-3 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setSelectedFieldKeys(selectedFieldKeys.filter(k => k !== f.key))}
                        >
                          <X size={14} />
                        </button>
                        <div className="mb-3 flex items-center justify-between pr-6">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                              <Settings2 size={16} />
                            </div>
                            <div>
                              <div className="text-[13px] font-extrabold text-slate-900">{f.label}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.type}</div>
                            </div>
                          </div>
                          {f.required && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-100 uppercase">Required</span>}
                        </div>

                        {f.type === "select" ? (
                          <select
                            className="input"
                            value={customFieldValues[f.key] || ""}
                            onChange={(e) => setCustomFieldValues({ ...customFieldValues, [f.key]: e.target.value })}
                          >
                            <option value="">Select option</option>
                            {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : f.type === "number" ? (
                          <input
                            type="number"
                            className="input"
                            value={customFieldValues[f.key] || ""}
                            onChange={(e) => setCustomFieldValues({ ...customFieldValues, [f.key]: e.target.value })}
                          />
                        ) : f.type === "date" ? (
                          <input
                            type="date"
                            className="input"
                            value={customFieldValues[f.key] || ""}
                            onChange={(e) => setCustomFieldValues({ ...customFieldValues, [f.key]: e.target.value })}
                          />
                        ) : (
                          <input
                            type="text"
                            className="input"
                            value={customFieldValues[f.key] || ""}
                            onChange={(e) => setCustomFieldValues({ ...customFieldValues, [f.key]: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                </div>

                {(state.customFields || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-8 text-slate-400">
                    <Settings2 size={32} strokeWidth={1.5} className="mb-2 opacity-20" />
                    <div className="text-xs font-bold">No additional custom fields found in settings</div>
                  </div>
                ) : selectedFieldKeys.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-8 text-slate-400">
                    <Settings2 size={32} strokeWidth={1.5} className="mb-2 opacity-20" />
                    <div className="text-xs font-bold">Search and select fields to add to this client</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === 7 && <div className="space-y-3"><AttachmentUploadZone description={attachmentDescription} onDescriptionChange={setAttachmentDescription} onFiles={uploadFiles} isUploading={isUploading} /><div className="overflow-x-auto"><table className="table min-w-max"><thead><tr><th>Name</th><th>Size</th><th>Type</th><th>Description</th><th>Uploaded On</th><th>Uploaded By</th><th>Actions</th></tr></thead><tbody>{attachments.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500">No attachments uploaded yet.</td></tr>}{attachments.map((a) => <tr key={a.id || a.name}><td>{a.name}</td><td>{a.size}</td><td>{a.type}</td><td>{a.description || "-"}</td><td>{a.uploadedOn}</td><td>{a.uploadedBy}</td><td><Button size="sm" variant="ghost" disabled={!a.url} onClick={() => a.url && window.open(a.url, "_blank", "noopener,noreferrer")}>Download</Button> <Button size="sm" variant="danger" onClick={() => removeAttachment(a)}>Delete</Button></td></tr>)}</tbody></table></div></div>}
        </div>
        <div className="flex flex-col gap-3 border-t border-[#e2e8f0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={goPrevious} disabled={isFirstTab || isSaving}>Previous</Button>
          <div className="flex justify-end gap-2">
            {!isLastTab && <Button onClick={saveAndContinue} disabled={isSaving}>{isSaving ? "Saving..." : "Save and Continue"}</Button>}
            {isLastTab && <Button onClick={() => saveClient()} disabled={isSaving}>{isSaving ? "Saving..." : "Add Client"}</Button>}
          </div>
        </div>
      </Card>
      <CustomFieldModal
        isOpen={customFieldModal}
        onClose={() => setCustomFieldModal(false)}
        onSave={(newField) => {
          dispatch({ type: "SET_RESOURCE", resource: "customFields", payload: [...(state.customFields || []), newField] });
          setSelectedFieldKeys([...selectedFieldKeys, newField.key]);
        }}
      />
    </div>
  );
}

function AttachmentUploadZone({ description, onDescriptionChange, onFiles, isUploading }) {
  const inputId = "client-attachment-upload";
  const handleDrop = (event) => {
    event.preventDefault();
    onFiles(event.dataTransfer.files, description);
  };
  return (
    <div
      className={`upload-zone transition hover:bg-slate-100 ${isUploading ? "pointer-events-none opacity-70" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <UploadCloud className="mb-2 text-[#1e3a8a]" size={28} />
      <div className="text-[15px] font-extrabold text-slate-800">{isUploading ? "Uploading..." : "Upload attachments"}</div>
      <div className="mt-1 text-[12px] font-semibold text-slate-500">Write the description first, then choose the file to upload.</div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field label="Attachment Description" field="client-attachment-description">
          <input
            className="input"
            value={description}
            placeholder="What is this attachment for?"
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </Field>
        <label htmlFor={inputId} className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-4 text-[14px] font-bold text-white transition hover:bg-[#1d4ed8]">
          <UploadCloud size={16} />
          {isUploading ? "Uploading..." : "Upload file"}
        </label>
      </div>
      <input
        id={inputId}
        name="clientAttachmentUpload"
        className="hidden"
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={(event) => {
          onFiles(event.target.files, description);
          event.target.value = "";
        }}
      />
    </div>
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

function SearchableSelect({ id, value, options, searchValue, onSearchChange, onChange, getLabel, placeholder, searchPlaceholder, loading, emptyLabel }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = options.find((option) => optionId(option) === value);
  const selectedLabel = selected ? getLabel(selected) : placeholder;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        name={id}
        type="button"
        className="input flex items-center justify-between text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selected ? "truncate text-slate-900" : "truncate text-slate-400"}>{selectedLabel}</span>
        <ChevronDown size={16} className={`ml-2 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-slate-900/5">
          <div className="relative mb-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input h-9"
              style={{ paddingLeft: "2.25rem" }}
              value={searchValue}
              autoComplete="off"
              placeholder={searchPlaceholder}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-auto">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 font-medium"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {placeholder}
              {!value && <Check size={15} className="text-[#1e3a8a]" />}
            </button>
            {options.map((option) => {
              const idValue = optionId(option);
              const active = idValue === value;
              return (
                <button
                  key={idValue}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] hover:bg-slate-50 font-medium ${active ? "text-[#1e3a8a]" : "text-slate-700"}`}
                  onClick={() => {
                    onChange(idValue);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{getLabel(option)}</span>
                  {active && <Check size={15} className="ml-2 shrink-0" />}
                </button>
              );
            })}
            {loading && <div className="px-3 py-3 text-center text-[12px] text-slate-400 font-medium">Searching...</div>}
            {!loading && options.length === 0 && <div className="px-3 py-3 text-center text-[12px] text-slate-400 font-medium">{emptyLabel}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Basic({ form, update, countries, users, userSearch, setUserSearch, isUserSearchLoading }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Select Type*" field="client-type">
          <select className="input" required value={form.clientType} onChange={(e) => update("clientType", e.target.value)}>
            <option value="">Select type</option>
            <option value="Legal Person">Legal Person</option>
            <option value="Natural Person">Natural Person</option>
          </select>
        </Field>
        <Field label="File No." field="client-file-no"><input className="input" value={form.fileNo} onChange={(e) => update("fileNo", e.target.value)} /></Field>
        <Field label="Legal Name*" field="client-legal-name"><input className="input" value={form.legalName} onChange={(e) => update("legalName", e.target.value)} /></Field>
        <Field label="Trade Name" field="client-trade-name"><input className="input" value={form.tradeName} onChange={(e) => update("tradeName", e.target.value)} /></Field>
        <Field label="Financial Year End*" field="client-fye">
          <select className="input" value={form.fye} onChange={(e) => update("fye", e.target.value)}>
            {FINANCIAL_YEAR_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </Field>
        <Field label="Jurisdiction" field="client-jurisdiction">
          <select className="input" value={form.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)}>
            <option>Mainland</option>
            <option>Free Zone</option>
            <option>Designated Zone</option>
            <option>Offshore</option>
          </select>
        </Field>
        <Field label="Assigned User" field="client-assigned-user">
          <SearchableSelect
            id="client-assigned-user"
            value={form.assigned}
            options={users}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            onChange={(value) => update("assigned", value)}
            getLabel={(user) => user.name}
            placeholder="Select User"
            searchPlaceholder="Search users..."
            loading={isUserSearchLoading}
            emptyLabel="No matching users"
          />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="Country" field="client-country">
          <select className="input" value={form.country} onChange={(e) => update("country", e.target.value)}>
            {countries.map((country) => <option key={country}>{country}</option>)}
          </select>
        </Field>
        <Field label="Emirate/State" field="client-emirate"><input className="input" value={form.emirate} onChange={(e) => update("emirate", e.target.value)} /></Field>
        <Field label="Street" field="client-street"><input className="input" value={form.street} onChange={(e) => update("street", e.target.value)} /></Field>
        <Field label="PO Box" field="client-po-box"><input className="input" value={form.poBox} onChange={(e) => update("poBox", e.target.value)} /></Field>
        <Field label="Postal Code" field="client-postal-code"><input className="input" value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2 font-bold" htmlFor="client-different-address">
        <input id="client-different-address" name="clientDifferentAddress" type="checkbox" checked={form.differentAddress} onChange={(e) => update("differentAddress", e.target.checked)} />
        Actual/Correspondence Address is different
      </label>
      {form.differentAddress && <textarea id="client-correspondence-address" name="clientCorrespondenceAddress" className="input textarea" value={form.correspondence} onChange={(e) => update("correspondence", e.target.value)} />}
    </div>
  );
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
  // return (
  //   <div className="block">
  //     <label htmlFor={field} className="field-label">
  //       {label}
  //     </label>
  //     {control}
  //   </div>
  // );
}
