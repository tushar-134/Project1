import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Copy, Eye, EyeOff, Plus, Search, Trash2, UploadCloud, X, Settings2 } from "lucide-react";
import toast from "react-hot-toast";
import { useApp } from "../../context/AppContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useClients } from "../../hooks/useClients";
import { mapUser } from "../../hooks/useUsers";
import { userService } from "../../services/userService";
import { groupService } from "../../services/groupService";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import CustomFieldModal from "../ui/CustomFieldModal.jsx";
import TaskDrawer from "../ui/TaskDrawer.jsx";
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ISSUING_AUTHORITY_OPTIONS = [
  { id: "India", label: "India" },
  { id: "Dubai", label: "Dubai" },
];

const LICENCE_TYPE_OPTIONS = ["Commercial", "Professional", "Industrial", "Tourism"];

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

function parseFinancialYearStartMonth(value) {
  const normalized = normalizeFinancialYearEnd(value);
  const startMonthLabel = normalized.split("-")[0]?.trim()?.slice(0, 3);
  const monthIndex = MONTH_NAMES.findIndex((month) => month.toLowerCase() === startMonthLabel?.toLowerCase());
  return monthIndex >= 0 ? monthIndex : 0;
}

function getVatFilingFrequencyOptions(financialYearEnd) {
  return MONTH_NAMES.map((_, startMonth) => {
    const quarters = Array.from({ length: 4 }, (_, quarterIndex) => {
      const rangeStart = (startMonth + quarterIndex * 3) % 12;
      const rangeEnd = (rangeStart + 2) % 12;
      return `${MONTH_NAMES[rangeStart]}-${MONTH_NAMES[rangeEnd]}`;
    });
    const value = quarters.join(" || ");
    return {
      value,
      label: value,
    };
  });
}

function normalizeVatFilingFrequency(value, financialYearEnd) {
  const options = getVatFilingFrequencyOptions(financialYearEnd);
  if (!value) return options[0]?.value || "Jan-Mar || Apr-Jun || Jul-Sep || Oct-Dec";

  const normalizedValue = String(value).trim().toLowerCase().replace(/\s+/g, "");
  const matchingOption = options.find((option) => option.value.toLowerCase().replace(/\s+/g, "") === normalizedValue);
  if (matchingOption) return matchingOption.value;

  const matchingLegacyRange = options.find((option) => {
    const firstRange = option.value.split("||")[0]?.trim() || "";
    return firstRange.toLowerCase().replace(/\s+/g, "") === normalizedValue;
  });
  if (matchingLegacyRange) return matchingLegacyRange.value;

  return options[0]?.value || "Jan-Mar || Apr-Jun || Jul-Sep || Oct-Dec";
}

export default function AddClient() {
  const { state, dispatch } = useApp();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { createClient, getClient, updateClient, uploadAttachment, uploadDocument, deleteAttachment, deleteDocument } = useClients();
  const [tab, setTab] = useState(() => Number(location.state?.activeTab) || 0);
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
    vatTrn: "", vatStatus: "Registered", vatDate: "", vatFreq: "Jan-Mar", vatRegistrationTask: "", vatRegistrationTaskId: "", ctTin: "", ctStatus: "Not Registered", ctDate: "", ctRegistrationTask: "", ctRegistrationTaskId: "", group: "", newGroup: "",
  });
  const vatFilingFrequencyOptions = useMemo(() => getVatFilingFrequencyOptions(form.fye), [form.fye]);
  const shouldShowVatRegistrationFields = form.vatStatus !== "Not Registered";
  const shouldShowCtRegistrationFields = form.ctStatus !== "Not Registered";
  const [licences, setLicences] = useState([{ number: "", issue: "", expiry: "", authority: "Dubai", type: "Commercial", email: "", documentUrl: "", documentName: "", documentFile: null, documents: [], persisted: false }]);

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
    eidDocuments: [],
    passportDocumentUrl: "",
    passportDocumentName: "",
    passportDocumentFile: null,
    passportDocuments: [],
    persisted: false,
  }]);
  const [portals, setPortals] = useState([blankPortal]);
  const [visiblePortalPasswords, setVisiblePortalPasswords] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [authoritySearches, setAuthoritySearches] = useState({});
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
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const handledCreatedRegistrationTaskRef = useRef("");
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const canManageTaskDrawer = currentUser?.role === "admin" || currentUser?.role === "manager";
  const openVatRegistrationTask = () => {
    if (!isEditMode || !id) {
      toast.error("Save the client first, then create the VAT registration task.");
      return;
    }
    navigate("/tasks/add", {
      state: {
        prefillTask: {
          categoryId: "vat",
          categoryName: "VAT",
          type: "VAT Registration",
          clientId: id,
          description: `VAT registration for ${form.legalName || "this client"}`,
        },
        returnToClient: {
          clientId: id,
          activeTab: 3,
          taxType: "vat",
        },
      },
    });
  };
  const openCtRegistrationTask = () => {
    if (!isEditMode || !id) {
      toast.error("Save the client first, then create the CT registration task.");
      return;
    }
    navigate("/tasks/add", {
      state: {
        prefillTask: {
          categoryId: "ct",
          categoryName: "CT",
          type: "CT Registration",
          clientId: id,
          description: `CT registration for ${form.legalName || "this client"}`,
        },
        returnToClient: {
          clientId: id,
          activeTab: 3,
          taxType: "ct",
        },
      },
    });
  };

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
    setForm((current) => {
      const normalizedVatFrequency = normalizeVatFilingFrequency(current.vatFreq, current.fye);
      return normalizedVatFrequency === current.vatFreq ? current : { ...current, vatFreq: normalizedVatFrequency };
    });
  }, [form.fye]);

  useEffect(() => {
    if (!isEditMode) return;
    getClient(id).then((client) => {
      const createdRegistrationTask = location.state?.createdRegistrationTask || null;
      const jurisdictionLabels = {
        mainland: "Mainland",
        freezone: "Free Zone",
        designated_zone: "Designated Zone",
        offshore: "Offshore",
      };
      const primaryContact = client.contactPersons?.find((person) => person.isPrimary) || client.contactPersons?.[0] || {};
      const nextFye = normalizeFinancialYearEnd(client.financialYearEnd || client.ctDetails?.financialYearEnd || "");
      const nextVatStatus = client.vatDetails?.status === "registered" ? "Registered" : "Not Registered";
      const nextVatRegistrationTask = createdRegistrationTask?.taxType === "vat" ? createdRegistrationTask.taskMongoId || "" : client.vatDetails?.registrationTask || "";
      const nextVatRegistrationTaskId = createdRegistrationTask?.taxType === "vat" ? createdRegistrationTask.taskId || "" : client.vatDetails?.registrationTaskId || "";
      const nextCtStatus = client.ctDetails?.status === "registered" ? "Registered" : "Not Registered";
      const nextCtRegistrationTask = createdRegistrationTask?.taxType === "ct" ? createdRegistrationTask.taskMongoId || "" : client.ctDetails?.registrationTask || "";
      const nextCtRegistrationTaskId = createdRegistrationTask?.taxType === "ct" ? createdRegistrationTask.taskId || "" : client.ctDetails?.registrationTaskId || "";
      setForm({
        clientType: client.clientType === "natural" ? "Natural Person" : "Legal Person",
        fileNo: client.fileNo || "",
        legalName: client.legalName || "",
        tradeName: client.tradeName || "",
        fye: nextFye,
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
        vatStatus: nextVatStatus,
        vatDate: client.vatDetails?.registrationDate?.slice?.(0, 10) || "",
        vatFreq: normalizeVatFilingFrequency(client.vatDetails?.filingFrequency, nextFye),
        vatRegistrationTask: nextVatRegistrationTask,
        vatRegistrationTaskId: nextVatRegistrationTaskId,
        ctTin: client.ctDetails?.tin || "",
        ctStatus: nextCtStatus,
        ctDate: client.ctDetails?.registrationDate?.slice?.(0, 10) || "",
        ctRegistrationTask: nextCtRegistrationTask,
        ctRegistrationTaskId: nextCtRegistrationTaskId,
        group: client.group?._id || client.group || "",
        newGroup: "",
      });
      const createdTaskKey = createdRegistrationTask?.taskMongoId ? `${id}:${createdRegistrationTask.taxType}:${createdRegistrationTask.taskMongoId}` : "";
      if (createdTaskKey && handledCreatedRegistrationTaskRef.current !== createdTaskKey) {
        handledCreatedRegistrationTaskRef.current = createdTaskKey;
        updateClient(id, {
          vatDetails: {
            ...(client.vatDetails || {}),
            trn: client.vatDetails?.trn || "",
            status: client.vatDetails?.status || "not_registered",
            registrationDate: client.vatDetails?.registrationDate?.slice?.(0, 10) || undefined,
            filingFrequency: client.vatDetails?.filingFrequency || normalizeVatFilingFrequency("", nextFye),
            registrationTask: nextVatRegistrationTask || undefined,
            registrationTaskId: nextVatRegistrationTaskId || undefined,
          },
          ctDetails: {
            ...(client.ctDetails || {}),
            tin: client.ctDetails?.tin || "",
            status: client.ctDetails?.status || "not_registered",
            registrationDate: client.ctDetails?.registrationDate?.slice?.(0, 10) || undefined,
            financialYearEnd: client.ctDetails?.financialYearEnd || nextFye,
            registrationTask: nextCtRegistrationTask || undefined,
            registrationTaskId: nextCtRegistrationTaskId || undefined,
          },
        }).then(() => {
          navigate(`/clients/edit/${id}`, {
            replace: true,
            state: { activeTab: Number(location.state?.activeTab) || 3 },
          });
        }).catch(() => {
          handledCreatedRegistrationTaskRef.current = "";
          toast.error("Unable to save the registration task link on the client.");
        });
      }
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
        documents: mapExistingDocuments(licence.documents, licence.documentUrl),
        persisted: true,
      })) : [{ number: "", issue: "", expiry: "", authority: "Dubai", type: "Commercial", email: "", documentUrl: "", documentName: "", documentFile: null, documents: [], persisted: false }]);
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
        eidDocuments: mapExistingDocuments(person.emiratesId?.documents, person.emiratesId?.documentUrl),
        passportDocumentUrl: person.passport?.documentUrl || "",
        passportDocumentName: person.passport?.documentUrl ? person.passport.documentUrl.split("/").pop() : "",
        passportDocumentFile: null,
        passportDocuments: mapExistingDocuments(person.passport?.documents, person.passport?.documentUrl),
        persisted: true,
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
        eidDocuments: [],
        passportDocumentUrl: "",
        passportDocumentName: "",
        passportDocumentFile: null,
        passportDocuments: [],
        persisted: false,
      }]);
      setPortals((client.portalLogins || []).length ? client.portalLogins.map((portal) => ({
        name: portal.portalName || "",
        url: portal.portalUrl || "",
        username: portal.username || "",
        password: portal.password || "",
        notes: portal.notes || "",
      })) : [blankPortal]);
      setVisiblePortalPasswords({});
      setAttachments(mapAttachmentRows(client.attachments || []));
    }).catch(() => {
      toast.error("Unable to load this client for editing.");
      navigate("/clients/list");
    });
  }, [id, isEditMode, location.state, navigate]);

  const formatFileSize = (size) => {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const mapExistingDocuments = (documents = [], fallbackUrl = "") => {
    if (Array.isArray(documents) && documents.length) {
      return documents.map((document) => ({
        id: document._id,
        name: document.name || document.url?.split("/").pop() || "Document",
        size: document.size || "",
        type: document.fileType || "",
        url: document.url || "",
        uploadedOn: document.uploadedAt?.slice?.(0, 10) || "",
        uploadedBy: document.uploadedBy?.name || "",
        description: document.description || "",
        saved: true,
      }));
    }
    if (!fallbackUrl) return [];
    return [{
      id: fallbackUrl,
      name: fallbackUrl.split("/").pop() || "Document",
      size: "",
      type: "",
      url: fallbackUrl,
      uploadedOn: "",
      uploadedBy: "",
      description: "",
      saved: true,
    }];
  };

  const fileSignature = (file) => `${String(file?.name || "").trim().toLowerCase()}::${file?.size || 0}`;
  const documentSignature = (document) => document?.signature || (document?.file ? fileSignature(document.file) : `${String(document?.name || "").trim().toLowerCase()}::${document?.size || ""}`);

  const uniqueTradeLicenceFiles = (files, documents = []) => {
    const existing = new Set((documents || []).map(documentSignature));
    const accepted = [];
    let skipped = 0;
    Array.from(files || []).forEach((file) => {
      const signature = fileSignature(file);
      if (existing.has(signature)) {
        skipped += 1;
        return;
      }
      existing.add(signature);
      accepted.push(file);
    });
    return { accepted, skipped };
  };

  const toPendingDocument = (file) => ({
    id: `${fileSignature(file)}-${file.lastModified || Date.now()}`,
    signature: fileSignature(file),
    name: file.name,
    size: formatFileSize(file.size),
    type: file.type || file.name.split(".").pop()?.toUpperCase() || "File",
    uploadedOn: "Pending save",
    uploadedBy: "You",
    file,
    url: "",
    saved: false,
  });

  const mapAttachmentRows = (items = []) => items.map((attachment) => ({
    id: attachment._id,
    name: attachment.name,
    size: attachment.size,
    type: attachment.name?.split(".").pop()?.toLowerCase() || attachment.fileType,
    description: attachment.description || "",
    uploadedOn: attachment.uploadedAt?.slice?.(0, 10) || new Date().toISOString().slice(0, 10),
    uploadedBy: attachment.uploadedBy?.name || "You",
    url: attachment.url,
    saved: true,
  }));

  const applyClientDocuments = (client) => {
    if (client.tradeLicences) {
      setLicences((current) => current.map((licence, index) => {
        const uploadedLicence = client.tradeLicences?.[index];
        if (!uploadedLicence) return licence;
        const documents = mapExistingDocuments(uploadedLicence.documents, uploadedLicence.documentUrl);
        return {
          ...licence,
          documentUrl: uploadedLicence.documentUrl || documents.at(-1)?.url || "",
          documentName: documents.at(-1)?.name || "",
          documentFile: null,
          documents,
          persisted: true,
        };
      }));
    }
    if (client.contactPersons) {
      setContacts((current) => current.map((contact, index) => {
        const uploadedContact = client.contactPersons?.[index];
        if (!uploadedContact) return contact;
        const eidDocuments = mapExistingDocuments(uploadedContact.emiratesId?.documents, uploadedContact.emiratesId?.documentUrl);
        const passportDocuments = mapExistingDocuments(uploadedContact.passport?.documents, uploadedContact.passport?.documentUrl);
        return {
          ...contact,
          eidDocumentUrl: uploadedContact.emiratesId?.documentUrl || eidDocuments.at(-1)?.url || "",
          eidDocumentName: eidDocuments.at(-1)?.name || "",
          eidDocumentFile: null,
          eidDocuments,
          passportDocumentUrl: uploadedContact.passport?.documentUrl || passportDocuments.at(-1)?.url || "",
          passportDocumentName: passportDocuments.at(-1)?.name || "",
          passportDocumentFile: null,
          passportDocuments,
          persisted: true,
        };
      }));
    }
    if (client.attachments) setAttachments(mapAttachmentRows(client.attachments));
  };

  const patchLicence = (index, values) => {
    setLicences((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  };

  const patchContact = (index, values) => {
    setContacts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  };

  async function uploadTradeLicenceFiles(clientId, licenceIndex, files) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("section", "tradeLicences");
    formData.append("documentSection", "tradeLicences");
    formData.append("index", String(licenceIndex));
    formData.append("description", `Trade Licence ${licenceIndex + 1} document`);
    const updatedClient = await uploadDocument(clientId, formData);
    applyClientDocuments(updatedClient);
  }

  async function handleTradeLicenceFile(licenceIndex, files) {
    const licence = licences[licenceIndex];
    const currentDocuments = licences[licenceIndex]?.documents || [];
    const { accepted: selected, skipped } = uniqueTradeLicenceFiles(files, currentDocuments);
    if (skipped) toast.error(skipped === 1 ? "This trade licence file is already added." : `${skipped} duplicate trade licence files were skipped.`);
    if (!selected.length) return;
    // If the licence row hasn't been saved to the DB yet (persisted: false), stage the files
    // in local state — they'll be uploaded by saveClient() once the record exists.
    // This is the same staged-upload pattern already used in Add mode.
    if (!isEditMode || !licence?.persisted) {
      setLicences((current) => current.map((item, index) => index === licenceIndex ? {
        ...item,
        documents: [...(item.documents || []), ...selected.map(toPendingDocument)],
      } : item));
      toast.success(selected.length === 1 ? "Trade licence file added. Save the client to upload it." : "Trade licence files added. Save the client to upload them.");
      return;
    }
    setIsUploading(true);
    try {
      await uploadTradeLicenceFiles(id, licenceIndex, selected);
      toast.success(selected.length === 1 ? "Trade licence document uploaded." : "Trade licence documents uploaded.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Trade licence upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadContactDocuments(clientId, contactIndex, files, section) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("section", section);
    formData.append("index", String(contactIndex));
    formData.append("description", `Contact ${contactIndex + 1} ${section} document`);
    const updatedClient = await uploadDocument(clientId, formData);
    applyClientDocuments(updatedClient);
  }

  async function handleContactDocument(contactIndex, files, section) {
    const contact = contacts[contactIndex];
    const selected = Array.from(files || []);
    if (!selected.length) return;
    // Stage files in local state for any unsaved contact row (persisted: false) in both
    // Add mode and Edit mode — saveClient() will flush them to the API after saving the record.
    const shouldStage = !isEditMode || !contact?.persisted;
    if (section === "passport") {
      setContacts((current) => current.map((item, index) => index === contactIndex ? {
        ...item,
        passportDocuments: shouldStage ? [...(item.passportDocuments || []), ...selected.map(toPendingDocument)] : item.passportDocuments,
      } : item));
    } else {
      setContacts((current) => current.map((item, index) => index === contactIndex ? {
        ...item,
        eidDocuments: shouldStage ? [...(item.eidDocuments || []), ...selected.map(toPendingDocument)] : item.eidDocuments,
      } : item));
    }
    if (shouldStage) {
      toast.success(`${section === "passport" ? "Passport" : "Emirates ID"} ${selected.length === 1 ? "file" : "files"} added. Save the client to upload ${selected.length === 1 ? "it" : "them"}.`);
      return;
    }
    setIsUploading(true);
    try {
      await uploadContactDocuments(id, contactIndex, selected, section);
      toast.success(`${section === "passport" ? "Passport" : "Emirates ID"} ${selected.length === 1 ? "document" : "documents"} uploaded.`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Contact document upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadFiles(files, description = "") {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const attachmentNote = String(description || "").trim();
    if (!attachmentNote) {
      toast.error("Attachment description is required before uploading.");
      return;
    }
    if (!isEditMode) {
      setAttachments((current) => [
        ...current,
        ...selected.map((file) => ({
          id: `${file.name}-${file.lastModified}-${file.size}`,
          name: file.name,
          size: formatFileSize(file.size),
          type: file.name?.split(".").pop()?.toLowerCase() || "file",
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
      setAttachments(mapAttachmentRows(uploaded.attachments || []));
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
      const updatedClient = await deleteAttachment(id, attachment.id);
      setAttachments(mapAttachmentRows(updatedClient.attachments || []));
      toast.success("Attachment deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete attachment.");
    }
  }

  async function removeTradeLicenceDocument(licenceIndex, document) {
    if (!document.saved) {
      setLicences((current) => current.map((item, index) => index === licenceIndex ? {
        ...item,
        documents: (item.documents || []).filter((entry) => entry !== document),
      } : item));
      return;
    }
    try {
      const updatedClient = await deleteDocument(id, "tradeLicences", licenceIndex, document.id);
      applyClientDocuments(updatedClient);
      toast.success("Trade licence document deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete trade licence document.");
    }
  }

  async function removeContactDocument(contactIndex, section, document) {
    if (!document.saved) {
      setContacts((current) => current.map((item, index) => {
        if (index !== contactIndex) return item;
        if (section === "passport") {
          return { ...item, passportDocuments: (item.passportDocuments || []).filter((entry) => entry.id !== document.id) };
        }
        return { ...item, eidDocuments: (item.eidDocuments || []).filter((entry) => entry.id !== document.id) };
      }));
      return;
    }
    try {
      const updatedClient = await deleteDocument(id, section, contactIndex, document.id);
      applyClientDocuments(updatedClient);
      toast.success(`${section === "passport" ? "Passport" : "Emirates ID"} document deleted.`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete document.");
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
    const shouldValidateTradeLicences = !continueToNext || tab >= 1;
    if (shouldValidateTradeLicences) {
      const missingLicenceNumberWithFilesIndex = licences.findIndex((licence) =>
        !String(licence.number || "").trim() &&
        (licence.documents || []).some((document) => document?.file || document?.url),
      );
      if (missingLicenceNumberWithFilesIndex >= 0) {
        toast.error(`Trade licence ${missingLicenceNumberWithFilesIndex + 1}: licence number is required before uploading documents.`);
        return false;
      }
      const hasTradeLicence = licences.some((licence) => String(licence.number || "").trim());
      if (!hasTradeLicence) {
        toast.error("Add at least one trade licence and upload its document.");
        return false;
      }
      const missingTradeLicenceDocumentIndex = licences.findIndex((licence) =>
        String(licence.number || "").trim() &&
        !(licence.documents || []).some((document) => document?.file || document?.url),
      );
      if (missingTradeLicenceDocumentIndex >= 0) {
        toast.error(`Trade licence ${missingTradeLicenceDocumentIndex + 1}: upload at least one document.`);
        return false;
      }
    }
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
      const preparedTradeLicences = includeTradeLicences
        ? licences
          .map((licence, originalIndex) => ({ licence, originalIndex }))
          .filter(({ licence }) => String(licence.number || "").trim())
        : [];
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
        payload.vatDetails = {
          trn: shouldShowVatRegistrationFields ? form.vatTrn : "",
          status: form.vatStatus === "Registered" ? "registered" : "not_registered",
          registrationDate: shouldShowVatRegistrationFields ? form.vatDate : undefined,
          filingFrequency: shouldShowVatRegistrationFields ? normalizeVatFilingFrequency(form.vatFreq, form.fye) : undefined,
          registrationTask: form.vatRegistrationTask || undefined,
          registrationTaskId: form.vatRegistrationTaskId || undefined,
        };
        payload.ctDetails = {
          tin: shouldShowCtRegistrationFields ? form.ctTin : "",
          status: form.ctStatus === "Registered" ? "registered" : "not_registered",
          registrationDate: shouldShowCtRegistrationFields ? form.ctDate : undefined,
          financialYearEnd: form.fye,
          registrationTask: form.ctRegistrationTask || undefined,
          registrationTaskId: form.ctRegistrationTaskId || undefined,
        };
      }
      if (includeTradeLicences) {
        payload.tradeLicences = preparedTradeLicences
          .map(({ licence }) => ({
            licenceNumber: licence.number,
            issueDate: licence.issue,
            expiryDate: licence.expiry,
            issuingAuthority: licence.authority,
            licenceType: licence.type?.toLowerCase() || "commercial",
            officialEmail: licence.email,
            documentUrl: licence.documentUrl || undefined,
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
      const includeAttachments = !continueToNext || tab >= 7;
      const pendingAttachments = includeAttachments
        ? attachments.filter((attachment) => !attachment.saved && attachment.file)
        : [];
      const pendingLicenceDocuments = includeTradeLicences
        ? preparedTradeLicences
          .map(({ licence }, index) => ({ index, files: (licence.documents || []).filter((document) => !document.saved && document.file).map((document) => document.file) }))
          .filter((item) => item.files.length)
        : [];
      const pendingContactDocuments = includeContactPersons
        ? contacts.flatMap((contact, index) => ([
          contact.eidDocuments?.some((document) => !document.saved && document.file) ? { index, files: contact.eidDocuments.filter((document) => !document.saved && document.file).map((document) => document.file), section: "emiratesId" } : null,
          contact.passportDocuments?.some((document) => !document.saved && document.file) ? { index, files: contact.passportDocuments.filter((document) => !document.saved && document.file).map((document) => document.file), section: "passport" } : null,
        ].filter(Boolean)))
        : [];
      if (isEditMode) {
        const updatedClient = await updateClient(id, payload);
        applyClientDocuments(updatedClient);
        if (pendingLicenceDocuments.length) {
          for (const licenceDocument of pendingLicenceDocuments) {
            await uploadTradeLicenceFiles(id, licenceDocument.index, licenceDocument.files);
          }
        }
        if (pendingContactDocuments.length) {
          for (const document of pendingContactDocuments) {
            await uploadContactDocuments(id, document.index, document.files, document.section);
          }
        }
        toast.success(continueToNext ? "Progress saved." : "Client updated successfully.");
      } else {
        const created = await createClient(payload);
        const createdClientId = created?._id || created?.id;
        if (!createdClientId) {
          throw new Error("Client was created, but no client ID was returned.");
        }
        if (pendingLicenceDocuments.length) {
          for (const licenceDocument of pendingLicenceDocuments) {
            await uploadTradeLicenceFiles(createdClientId, licenceDocument.index, licenceDocument.files);
          }
        }
        if (pendingContactDocuments.length) {
          for (const document of pendingContactDocuments) {
            await uploadContactDocuments(createdClientId, document.index, document.files, document.section);
          }
        }
        if (pendingAttachments.length) {
          const groupedByDescription = pendingAttachments.reduce((acc, attachment) => {
            const key = attachment.description || "";
            acc[key] = acc[key] || [];
            acc[key].push(attachment.file);
            return acc;
          }, {});
          let updatedClient = null;
          for (const [description, files] of Object.entries(groupedByDescription)) {
            const formData = new FormData();
            files.forEach((file) => formData.append("files", file));
            formData.append("description", description);
            updatedClient = await uploadAttachment(createdClientId, formData);
          }
          if (updatedClient?.attachments) setAttachments(mapAttachmentRows(updatedClient.attachments));
        }
        toast.success(continueToNext ? "Progress saved." : (pendingAttachments.length || pendingLicenceDocuments.length || pendingContactDocuments.length ? "Client created and documents uploaded." : "Client created successfully."));
        if (continueToNext) navigate(`/clients/edit/${createdClientId}`, { replace: true });
      }
      if (continueToNext) {
        setTab((current) => Math.min(current + 1, tabs.length - 1));
        return true;
      }
      navigate("/clients/list");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error) || error?.message || "Unable to save client.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  const goPrevious = () => setTab((current) => Math.max(current - 1, 0));
  const saveAndContinue = () => saveClient({ continueToNext: true });
  const setAuthoritySearch = (index, value) => {
    setAuthoritySearches((current) => ({ ...current, [index]: value }));
  };
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
          {tab === 1 && <Repeat title="Trade Licence" items={licences} setItems={setLicences} blank={{ number: "", issue: "", expiry: "", authority: "Dubai", type: "", email: "", documentUrl: "", documentName: "", documentFile: null, documents: [], persisted: false }} render={(lic, i, patch) => {
            const authoritySearch = authoritySearches[i] || "";
            const authorityOptions = lic.authority && !ISSUING_AUTHORITY_OPTIONS.some((option) => option.id === lic.authority)
              ? [{ id: lic.authority, label: lic.authority }, ...ISSUING_AUTHORITY_OPTIONS]
              : ISSUING_AUTHORITY_OPTIONS;
            const filteredAuthorityOptions = authorityOptions.filter((option) => option.label.toLowerCase().includes(authoritySearch.trim().toLowerCase()));

            const licenceTypeOptions = lic.type && !LICENCE_TYPE_OPTIONS.includes(lic.type)
              ? [lic.type, ...LICENCE_TYPE_OPTIONS]
              : LICENCE_TYPE_OPTIONS;

            return <div className="grid gap-3 md:grid-cols-3"><Field label="Licence Number*" field={`licence-number-${i}`}><input className="input" value={lic.number} onChange={(e) => patch(i, { number: e.target.value })} /></Field><Field label="Issue Date" field={`licence-issue-${i}`}><input className="input" type="date" value={lic.issue} onChange={(e) => patch(i, { issue: e.target.value })} /></Field><Field label="Expiry Date" field={`licence-expiry-${i}`}><input className="input" type="date" value={lic.expiry} onChange={(e) => patch(i, { expiry: e.target.value })} /></Field><Field label="Issuing Authority" field={`licence-authority-${i}`}><SearchableSelect id={`licence-authority-${i}`} value={lic.authority} options={filteredAuthorityOptions} searchValue={authoritySearch} onSearchChange={(value) => setAuthoritySearch(i, value)} onChange={(value) => patch(i, { authority: value })} getLabel={(option) => option.label} placeholder="Select Issuing Authority" searchPlaceholder="Search authority..." loading={false} emptyLabel="No matching authority" /></Field><Field label="Licence Type" field={`licence-type-${i}`}><select className="input" value={lic.type} onChange={(e) => patch(i, { type: e.target.value })}><option value="">Select Licence Type</option>{licenceTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field><Field label="Official Email" field={`licence-email-${i}`}><input className="input" value={lic.email} onChange={(e) => patch(i, { email: e.target.value })} /></Field><div className="md:col-span-3"><DocumentUploadZone id={`trade-licence-upload-${i}`} title="Upload trade licence documents" subtitle="PDF, JPG, PNG, DOCX, XLSX" documents={lic.documents || []} canDelete={currentUser?.role === "admin"} isUploading={isUploading} onFiles={(files) => handleTradeLicenceFile(i, files)} onDeleteDocument={(document) => removeTradeLicenceDocument(i, document)} /></div></div>;
          }} />}
          {tab === 2 && (
            <Repeat
              title="Contact Person"
              items={contacts}
              setItems={setContacts}
              blank={{ name: "", designation: "", email: "", code: "", mobile: "", whatsapp: "", alternate: "", primary: false, eid: "", eidIssue: "", eidExpiry: "", passport: "", passportIssue: "", passportExpiry: "", issuingCountry: "United Arab Emirates", eidDocumentUrl: "", eidDocumentName: "", eidDocumentFile: null, eidDocuments: [], passportDocumentUrl: "", passportDocumentName: "", passportDocumentFile: null, passportDocuments: [], persisted: false }}
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
                  }} /> Official Contact</label>
                  {c.primary && (
                    <>
                      <Field label="Emirates ID Number" field={`contact-eid-${i}`}><input className="input" placeholder="784-XXXX-XXXXXXX-X" value={c.eid} onChange={(e) => patch(i, { eid: formatEmiratesIdInput(e.target.value) })} /></Field>
                      <Field label="Emirates ID Issue Date" field={`contact-eid-issue-${i}`}><input className="input" type="date" value={c.eidIssue} onChange={(e) => patch(i, { eidIssue: e.target.value })} /></Field>
                      <Field label="Emirates ID Expiry" field={`contact-eid-expiry-${i}`}><input className="input" type="date" value={c.eidExpiry} onChange={(e) => patch(i, { eidExpiry: e.target.value })} /></Field>
                      <Field label="Passport Number" field={`contact-passport-${i}`}><input className="input" value={c.passport} onChange={(e) => patch(i, { passport: e.target.value })} /></Field>
                      <Field label="Passport Issue Date" field={`contact-passport-issue-${i}`}><input className="input" type="date" value={c.passportIssue} onChange={(e) => patch(i, { passportIssue: e.target.value })} /></Field>
                      <Field label="Passport Expiry" field={`contact-passport-expiry-${i}`}><input className="input" type="date" value={c.passportExpiry} onChange={(e) => patch(i, { passportExpiry: e.target.value })} /></Field>
                      <Field label="Passport Issuing Country" field={`contact-passport-country-${i}`}><><input className="input" list="passport-issuing-countries" value={c.issuingCountry} onChange={(e) => patch(i, { issuingCountry: e.target.value })} /><datalist id="passport-issuing-countries">{countries.map((country) => <option key={country} value={country} />)}</datalist></></Field>
                      <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
                        <DocumentUploadZone id={`contact-eid-upload-${i}`} title="Upload Emirates ID documents" subtitle="PDF, JPG, PNG, DOCX, XLSX" documents={c.eidDocuments || []} canDelete={currentUser?.role === "admin"} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "emiratesId")} onDeleteDocument={(document) => removeContactDocument(i, "emiratesId", document)} />
                        <DocumentUploadZone id={`contact-passport-upload-${i}`} title="Upload passport documents" subtitle="PDF, JPG, PNG, DOCX, XLSX" documents={c.passportDocuments || []} canDelete={currentUser?.role === "admin"} isUploading={isUploading} onFiles={(files) => handleContactDocument(i, files, "passport")} onDeleteDocument={(document) => removeContactDocument(i, "passport", document)} />
                      </div>
                    </>
                  )}
                </div>
              )}
            />
          )}
          {tab === 3 && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[14px] font-bold text-slate-700" htmlFor="client-vat-status">VAT Registration Status</label>
                <div className="flex flex-wrap items-center gap-3">
                  <select id="client-vat-status" className="input min-w-[240px] flex-1" value={form.vatStatus} onChange={(e) => update("vatStatus", e.target.value)}>
                    <option>Registered</option>
                    <option>Not Registered</option>
                  </select>
                  {form.vatRegistrationTaskId && (
                    <button
                      type="button"
                      className="rounded-full border border-[#bfdbfe] bg-white px-3 py-2 text-xs font-extrabold text-[#1e3a8a] transition hover:bg-blue-50"
                      onClick={() => {
                        if (!form.vatRegistrationTask) return;
                        if (canManageTaskDrawer) {
                          setDrawerTaskId(form.vatRegistrationTask);
                          return;
                        }
                        navigate(`/tasks/${form.vatRegistrationTask}`);
                      }}
                    >
                      Task ID: {form.vatRegistrationTaskId}
                    </button>
                  )}
                </div>
              </div>
              {shouldShowVatRegistrationFields ? (
                <>
                  <Field label="VAT TRN" field="client-vat-trn">
                    <input className="input" inputMode="numeric" maxLength={15} placeholder="15 digits starting with 1" value={form.vatTrn} onChange={(e) => update("vatTrn", String(e.target.value || "").replace(/\D+/g, "").slice(0, 15))} />
                  </Field>
                  <Field label="VAT Registration Date" field="client-vat-date">
                    <input className="input" type="date" value={form.vatDate} onChange={(e) => update("vatDate", e.target.value)} />
                  </Field>
                  <Field label="VAT Filing Frequency" field="client-vat-frequency">
                    <select className="input" value={form.vatFreq} onChange={(e) => update("vatFreq", e.target.value)}>
                      {vatFilingFrequencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : !form.vatRegistrationTaskId ? (
                <div className="md:col-span-2 rounded-2xl border border-dashed border-[#cbd5e1] bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">VAT registration task required</div>
                  <p className="mt-1 text-sm text-slate-600">
                    This client is marked as not registered for VAT. Create a VAT registration task first, then come back here and update the status to registered when the registration is complete.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" className="text-sm font-bold text-[#1e3a8a] underline underline-offset-4 cursor-pointer hover:text-[#1d4ed8] transition-colors" onClick={openVatRegistrationTask}>
                      Open VAT registration task
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[14px] font-bold text-slate-700" htmlFor="client-ct-status">CT Registration Status</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <select id="client-ct-status" className="input min-w-[240px] flex-1" value={form.ctStatus} onChange={(e) => update("ctStatus", e.target.value)}>
                      <option>Registered</option>
                      <option>Not Registered</option>
                    </select>
                    {form.ctRegistrationTaskId && (
                      <button
                        type="button"
                        className="rounded-full border border-[#bfdbfe] bg-white px-3 py-2 text-xs font-extrabold text-[#1e3a8a] transition hover:bg-blue-50"
                        onClick={() => {
                          if (!form.ctRegistrationTask) return;
                          if (canManageTaskDrawer) {
                            setDrawerTaskId(form.ctRegistrationTask);
                            return;
                          }
                          navigate(`/tasks/${form.ctRegistrationTask}`);
                        }}
                      >
                        Task ID: {form.ctRegistrationTaskId}
                      </button>
                    )}
                  </div>
                </div>
                {shouldShowCtRegistrationFields ? (
                  <>
                    <Field label="Financial Year" field="client-ct-fye">
                      <select className="input" value={form.fye} onChange={(e) => update("fye", e.target.value)}>
                        {FINANCIAL_YEAR_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="CT Registration Number (TIN)" field="client-ct-tin">
                      <input className="input" value={form.ctTin} onChange={(e) => update("ctTin", e.target.value)} />
                    </Field>
                    <Field label="CT Registration Date" field="client-ct-date">
                      <input className="input" type="date" value={form.ctDate} onChange={(e) => update("ctDate", e.target.value)} />
                    </Field>
                  </>
                ) : !form.ctRegistrationTaskId ? (
                  <div className="md:col-span-2 rounded-2xl border border-dashed border-[#cbd5e1] bg-slate-50 p-4">
                    <div className="text-sm font-bold text-slate-900">CT registration task required</div>
                    <p className="mt-1 text-sm text-slate-600">
                      This client is marked as not registered for CT. Create a CT registration task first, then come back here and continue with the CT details after registration.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" className="text-sm font-bold text-[#1e3a8a] underline underline-offset-4 cursor-pointer hover:text-[#1d4ed8] transition-colors" onClick={openCtRegistrationTask}>
                        Open CT registration task
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
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
                        ) : f.type === "currency" ? (() => {
                          const CURRENCIES = [
                            { code: "AED", symbol: "د.إ", label: "AED - د.إ (UAE Dirham)" },
                            { code: "USD", symbol: "$",   label: "USD - $ (US Dollar)" },
                            { code: "EUR", symbol: "€",   label: "EUR - € (Euro)" },
                            { code: "GBP", symbol: "£",   label: "GBP - £ (British Pound)" },
                            { code: "INR", symbol: "₹",   label: "INR - ₹ (Indian Rupee)" },
                            { code: "SAR", symbol: "﷼",   label: "SAR - ﷼ (Saudi Riyal)" },
                            { code: "QAR", symbol: "﷼",   label: "QAR - ﷼ (Qatari Riyal)" },
                            { code: "KWD", symbol: "د.ك", label: "KWD - د.ك (Kuwaiti Dinar)" },
                            { code: "BHD", symbol: ".د.ب",label: "BHD - .د.ب (Bahraini Dinar)" },
                            { code: "OMR", symbol: "﷼",   label: "OMR - ﷼ (Omani Rial)" },
                            { code: "JPY", symbol: "¥",   label: "JPY - ¥ (Japanese Yen)" },
                            { code: "CNY", symbol: "¥",   label: "CNY - ¥ (Chinese Yuan)" },
                            { code: "CHF", symbol: "Fr",  label: "CHF - Fr (Swiss Franc)" },
                            { code: "CAD", symbol: "C$",  label: "CAD - C$ (Canadian Dollar)" },
                            { code: "AUD", symbol: "A$",  label: "AUD - A$ (Australian Dollar)" },
                            { code: "SGD", symbol: "S$",  label: "SGD - S$ (Singapore Dollar)" },
                            { code: "HKD", symbol: "HK$", label: "HKD - HK$ (Hong Kong Dollar)" },
                            { code: "PKR", symbol: "₨",   label: "PKR - ₨ (Pakistani Rupee)" },
                            { code: "BDT", symbol: "৳",   label: "BDT - ৳ (Bangladeshi Taka)" },
                            { code: "ZAR", symbol: "R",   label: "ZAR - R (South African Rand)" },
                          ];
                          const raw = customFieldValues[f.key] || "";
                          const colonIdx = raw.indexOf(":");
                          const selectedCode = colonIdx !== -1 ? raw.slice(0, colonIdx) : (raw ? "USD" : "AED");
                          const amountVal = colonIdx !== -1 ? raw.slice(colonIdx + 1) : "";
                          const handleCurrencyChange = (code, amount) => {
                            setCustomFieldValues({ ...customFieldValues, [f.key]: `${code}:${amount}` });
                          };
                          return (
                            <div className="flex w-full overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500 bg-white transition-shadow">
                              <select
                                className="flex-none border-0 bg-slate-50 py-2 pl-3 pr-7 text-xs font-bold text-slate-700 outline-none focus:ring-0 cursor-pointer appearance-auto"
                                value={selectedCode}
                                onChange={(e) => handleCurrencyChange(e.target.value, amountVal)}
                              >
                                {CURRENCIES.map(c => (
                                  <option key={c.code} value={c.code}>{c.code}</option>
                                ))}
                              </select>
                              <div className="w-px bg-slate-200 flex-none" />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="block w-full min-w-0 border-0 py-2 px-3 text-sm font-medium text-slate-900 outline-none focus:ring-0 bg-transparent placeholder:text-slate-400"
                                value={amountVal}
                                placeholder="0.00"
                                onChange={(e) => handleCurrencyChange(selectedCode, e.target.value)}
                              />
                            </div>
                          );
                        })() : (
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
          {tab === 7 && <div className="space-y-3"><AttachmentUploadZone description={attachmentDescription} onDescriptionChange={setAttachmentDescription} onFiles={uploadFiles} isUploading={isUploading} /><div className="overflow-x-auto"><table className="table min-w-max"><thead><tr><th>Name</th><th>Size</th><th>Type</th><th>Description</th><th>Uploaded On</th><th>Uploaded By</th><th>Actions</th></tr></thead><tbody>{attachments.length === 0 && <tr><td colSpan={7} className="text-center text-slate-500">No attachments uploaded yet.</td></tr>}{attachments.map((a) => <tr key={a.id || a.name}><td>{a.name}</td><td>{a.size}</td><td>{a.type}</td><td>{a.description || "-"}</td><td>{a.uploadedOn}</td><td>{a.uploadedBy}</td><td><Button size="sm" variant="ghost" disabled={!a.url && !a.file} onClick={() => openDocumentFile(a)}>Open</Button> {(currentUser?.role === "admin" || !a.saved) && <Button size="sm" variant="danger" onClick={() => removeAttachment(a)}>Delete</Button>}</td></tr>)}</tbody></table></div></div>}
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
      {drawerTaskId && (
        <TaskDrawer taskId={drawerTaskId} canManage={canManageTaskDrawer} onClose={() => setDrawerTaskId(null)} />
      )}
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
      <div className="mt-1 text-[12px] font-semibold text-slate-500">Write the description first, then choose one or more files to upload.</div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field label="Attachment Description*" field="client-attachment-description">
          <input
            className="input"
            value={description}
            placeholder="What is this attachment for?"
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </Field>
        <label 
          htmlFor={description.trim() ? inputId : undefined}
          onClick={(e) => {
            if (!description.trim()) {
              e.preventDefault();
              toast.error("Please enter an attachment description first.");
            }
          }}
          className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-bold text-white transition ${!description.trim() || isUploading ? "bg-slate-300 pointer-events-none" : "bg-[#1e3a8a] hover:bg-[#1d4ed8]"}`}
        >
          <UploadCloud size={16} />
          {isUploading ? "Uploading..." : "Upload files"}
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

function DocumentUploadZone({ id, title, subtitle, documents, isUploading, onFiles, onDeleteDocument, canDelete }) {
  const handleDrop = (event) => {
    event.preventDefault();
    onFiles(event.dataTransfer.files);
  };
  return (
    <div className="space-y-3">
      <label
        className={`upload-zone cursor-pointer transition hover:bg-slate-100 ${isUploading ? "pointer-events-none opacity-70" : ""}`}
        htmlFor={id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <UploadCloud className="mb-2 text-[#64748b]" size={28} />
        <div className="text-[15px] font-extrabold text-slate-800">{isUploading ? "Uploading..." : title}</div>
        <div className="mt-1 text-[12px] font-semibold text-slate-500">{subtitle}</div>
        <div className="mt-2 text-[12px] font-semibold text-slate-500">You can upload multiple files here.</div>
        <input
          id={id}
          name={id}
          className="hidden"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          multiple
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <DocumentList documents={documents} canDelete={canDelete} onDeleteDocument={onDeleteDocument} />
    </div>
  );
}

function openDocumentFile(document) {
  if (document?.url) {
    window.open(document.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!document?.file) return;
  const objectUrl = URL.createObjectURL(document.file);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function DocumentList({ documents, canDelete, onDeleteDocument }) {
  if (!documents?.length) {
    return <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-[12px] font-semibold text-slate-500">No files uploaded yet.</div>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {documents.map((document) => (
        <div key={document.id || document.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-slate-800">{document.name}</div>
            <div className="text-[11px] font-semibold text-slate-500">{[document.size, document.uploadedOn, document.uploadedBy].filter(Boolean).join(" • ") || (document.saved ? "Uploaded" : "Pending save")}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={!document.url && !document.file} onClick={() => openDocumentFile(document)}>Open</Button>
            {((canDelete && !String(document.id || "").includes("/")) || !document.saved) && <Button size="sm" variant="danger" onClick={() => onDeleteDocument(document)}>Delete</Button>}
          </div>
        </div>
      ))}
    </div>
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
      <div className="relative">
        <input
          id={id}
          name={id}
          type="text"
          readOnly
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`input cursor-pointer pr-10 ${selected ? "text-slate-900" : "text-slate-400"}`}
          value={selected ? selectedLabel : ""}
          placeholder={placeholder}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((current) => !current);
            }
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <ChevronDown size={16} className={`pointer-events-none absolute right-3 top-1/2 ml-2 shrink-0 -translate-y-1/2 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </div>
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
        <Field label="Financial Year*" field="client-fye">
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
