import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { useClients } from "../../hooks/useClients";
import { downloadBlob } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";

const templateRows = [
  {
    fileNo: "FB-CLIENT-0101",
    legalName: "Example Trading LLC",
    tradeName: "Example Trading",
    clientType: "legal",
    financialYearEnd: "Jan-Dec",
    jurisdiction: "mainland",
    assignedUser: "Sara Mahmoud",
    registeredCountry: "United Arab Emirates",
    registeredEmirate: "Dubai",
    registeredStreet: "Office 1204, Business Bay",
    registeredPoBox: "12345",
    registeredPostalCode: "",
    correspondenceSameAsRegistered: "yes",
    correspondenceCountry: "",
    correspondenceEmirate: "",
    correspondenceStreet: "",
    correspondencePoBox: "",
    correspondencePostalCode: "",
    licenceNumber: "TL-1001",
    licenceIssueDate: "2026-01-01",
    licenceExpiryDate: "2027-01-01",
    licenceAuthority: "Dubai Economy",
    licenceType: "commercial",
    licenceOfficialEmail: "licence@example.com",
    contactName: "Aisha Khan",
    contactDesignation: "Manager",
    contactEmail: "aisha@example.com",
    contactCountryCode: "+971",
    contactMobile: "501234567",
    contactWhatsapp: "501234567",
    contactAlternateEmail: "aisha.alt@example.com",
    contactPrimary: "yes",
    emiratesIdNumber: "784-1987-1234567-1",
    emiratesIdIssueDate: "2024-01-01",
    emiratesIdExpiryDate: "2034-01-01",
    passportNumber: "P1234567",
    passportIssuingCountry: "United Arab Emirates",
    passportIssueDate: "2023-01-01",
    passportExpiryDate: "2033-01-01",
    vatTrn: "100200300400500",
    vatStatus: "registered",
    vatRegistrationDate: "2025-01-01",
    vatFilingFrequency: "quarterly",
    ctTin: "CT-778899",
    ctStatus: "applying",
    ctRegistrationDate: "2025-06-01",
    ctFinancialYearEnd: "Jan-Dec",
    qrmpPreference: "Email",
    auditFirmName: "Example Audit LLC",
    bankName: "Emirates NBD",
    iban: "AE070331234567890123456",
  },
];

const requiredColumns = ["legalName", "financialYearEnd", "jurisdiction", "licenceNumber", "contactName"];

export default function BulkUpload() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { bulkUpload } = useClients();
  const previewColumns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).slice(0, 12);
  }, [rows]);

  function normalizeCell(value) {
    if (typeof value === "string") return value.trim();
    if (value == null) return "";
    return String(value).trim();
  }

  function validateParsedRows(parsedRows) {
    const normalizedRows = parsedRows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [String(key).trim(), normalizeCell(value)]),
    ));
    const firstMissingColumn = requiredColumns.find((column) => !normalizedRows.some((row) => column in row));
    if (firstMissingColumn) {
      return { error: `Missing required column "${firstMissingColumn}" in the upload file.` };
    }
    const invalidRow = normalizedRows.findIndex((row) => requiredColumns.some((column) => !String(row[column] || "").trim()));
    if (invalidRow >= 0) {
      return { error: `Row ${invalidRow + 2}: please fill all required columns.` };
    }
    return { rows: normalizedRows };
  }

  async function parseFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      if (!parsedRows.length) {
        toast.error("The selected file is empty.");
        setRows([]);
        setFileName("");
        setResult(null);
        return;
      }
      const validation = validateParsedRows(parsedRows);
      if (validation.error) {
        toast.error(validation.error);
        setRows([]);
        setFileName("");
        setResult(null);
        return;
      }
      setRows(validation.rows);
      setFileName(file.name);
      setResult(null);
      toast.success(`${validation.rows.length} rows ready for import.`);
    } catch {
      toast.error("Unable to read this file. Please upload a valid .xlsx or .csv file.");
    }
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.json_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Clients");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "client-bulk-upload-template.xlsx");
  }

  async function submitRows() {
    if (!rows.length) {
      toast.error("Please upload a file before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await bulkUpload(rows);
      setResult(response);
      toast.success(`Import complete: ${response.added} added, ${response.skipped} skipped.`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Bulk upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="space-y-5"><div><div className="page-kicker">Client Import</div><h2 className="screen-title">Bulk Upload</h2></div><div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"><Card className="p-4"><div className="mb-3 text-[14px] font-extrabold">Step-by-step instructions</div>{["Download the sample Excel template.", "Fill one row for each client/licence/contact combination.", "Keep the required columns populated on every row.", "Upload .xlsx or .csv and review validation results before retrying failed rows."].map((s, i) => <div key={s} className="mb-3 flex gap-3"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1e3a8a] text-[12px] font-black text-white">{i + 1}</div><div className="pt-1 font-semibold text-slate-600">{s}</div></div>)}<Button variant="accent" onClick={downloadTemplate}><Download size={16} />Download sample Excel template</Button></Card><Card className="p-4"><div className="upload-zone min-h-72" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) parseFile(e.dataTransfer.files[0]); }}><FileSpreadsheet size={42} className="mb-3 text-[#059669]" /><div className="text-[15px] font-extrabold text-slate-800">Drag and drop .xlsx or .csv file</div><div className="mt-1 text-[12px] font-semibold text-slate-500">Client master data import</div>{fileName && <div className="mt-3 text-[13px] font-bold text-[#1e3a8a]">{fileName}</div>}<label className="mt-4 inline-flex" htmlFor="bulk-upload-file"><input id="bulk-upload-file" name="bulkUploadFile" className="hidden" type="file" accept=".xlsx,.csv" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} /><span className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-bold text-slate-700"><UploadCloud size={16} />Browse File</span></label></div></Card></div>{rows.length > 0 && <Card className="p-4"><div className="mb-3 flex items-center justify-between gap-3"><div className="font-extrabold">Preview ({rows.length} rows)</div><div className="text-[12px] font-semibold text-slate-500">Showing first 5 rows and first 12 columns</div></div><div className="overflow-auto"><table className="table"><thead><tr>{previewColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row, i) => <tr key={i}>{previewColumns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div><Button className="mt-3" onClick={submitRows} disabled={isSubmitting}>{isSubmitting ? "Uploading..." : "Submit Upload"}</Button>{result && <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 font-bold text-slate-600"><div>{result.added} added, {result.skipped} skipped, {result.errors?.length || 0} errors</div>{result.errors?.slice(0, 5).map((error, index) => <div key={index} className="text-[12px] font-semibold text-[#dc2626]">{error.message}</div>)}</div>}</Card>}</div>;
}
