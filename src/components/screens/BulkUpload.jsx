import { AlertCircle, Check, CheckCircle2, Download, FileArchive, Info, UploadCloud, X, XCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { useClients } from "../../hooks/useClients";
import { downloadBlob } from "../../utils/adapterUtils";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";

const templateRows = [
  {
    serial: 1,
    legalName: "Example Trading LLC",
    tradeName: "Example Trading",
    clientType: "legal",
    jurisdiction: "mainland",
    licenceNumber: "TL-1001",
    vatTrn: "100200300400500",
    contactName: "Aisha Khan",
    contactEmail: "aisha@example.com",
    contactCountryCode: "+971",
    contactMobile: "501234567",
    assignedUserEmailId: "sara@filingbuddy.ae",
  },
];

const PREVIEW_COLUMNS = ["serial", "legalName", "tradeName", "clientType", "licenceNumber", "contactName", "contactEmail"];

export default function BulkUpload() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [zipFile, setZipFile] = useState(null);
  const [results, setResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tooltipRow, setTooltipRow] = useState(null);
  const fileInputRef = useRef(null);
  const { bulkUploadV2 } = useClients();

  const previewColumns = useMemo(() => {
    if (!rows.length) return [];
    const available = Object.keys(rows[0]);
    // Show a focused set of columns; prefer the well-known ones first
    const ordered = PREVIEW_COLUMNS.filter((c) => available.includes(c));
    // Add any extras not in PREVIEW_COLUMNS, up to 10 total
    available.forEach((c) => { if (!ordered.includes(c) && ordered.length < 10) ordered.push(c); });
    return ordered;
  }, [rows]);

  const summary = useMemo(() => {
    if (!results) return null;
    return results.summary || {
      total: results.results?.length || 0,
      added: results.results?.filter((r) => r.status === "success").length || 0,
      failed: results.results?.filter((r) => r.status === "error").length || 0,
    };
  }, [results]);

  const rowResults = useMemo(() => {
    if (!results?.results) return new Map();
    const map = new Map();
    results.results.forEach((r) => map.set(Number(r.serial), r));
    return map;
  }, [results]);

  async function parseZipFile(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      // Find the xlsx/csv at root level
      let spreadsheetFile = null;
      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        // Only root-level files (no slashes in name, or just filename)
        const depth = relativePath.split("/").filter(Boolean).length;
        if (depth > 1) return;
        const ext = relativePath.split(".").pop()?.toLowerCase();
        if ((ext === "xlsx" || ext === "csv") && !spreadsheetFile) {
          spreadsheetFile = entry;
        }
      });

      if (!spreadsheetFile) {
        toast.error("No .xlsx or .csv file found in the ZIP. Please include your spreadsheet.");
        return;
      }

      const buffer = await spreadsheetFile.async("arraybuffer");
      const wb = XLSX.read(buffer);
      const parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

      if (!parsedRows.length) {
        toast.error("The spreadsheet in the ZIP is empty.");
        setRows([]);
        setFileName("");
        setZipFile(null);
        setResults(null);
        return;
      }

      setRows(parsedRows);
      setFileName(file.name);
      setZipFile(file);
      setResults(null);
      toast.success(`${parsedRows.length} rows ready for import.`);
    } catch {
      toast.error("Unable to read this file. Please upload a valid .zip file.");
    }
  }

  async function downloadTemplate() {
    try {
      const zip = new JSZip();

      // Create the xlsx
      const sheet = XLSX.utils.json_to_sheet(templateRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Clients");
      const xlsxBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      zip.file("client-bulk-upload-template.xlsx", xlsxBuffer);

      // Create empty folders — JSZip folder() creates proper directory entries without placeholder files
      zip.folder("licenses");
      zip.folder("passports");
      zip.folder("emirate_ids");

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "client-bulk-upload-template.zip");
      toast.success("Template ZIP downloaded.");
    } catch {
      toast.error("Failed to generate template ZIP.");
    }
  }

  async function submitUpload() {
    if (!zipFile) {
      toast.error("Please upload a ZIP file before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("zipFile", zipFile);
      const response = await bulkUploadV2(formData);
      setResults(response);
      const added = response.summary?.added || 0;
      const failed = response.summary?.failed || 0;
      if (failed === 0) {
        toast.success(`Import complete: ${added} clients added successfully.`);
      } else {
        toast(`Import complete: ${added} added, ${failed} failed.`, { icon: "⚠️" });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Bulk upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getRowStatus(serial) {
    return rowResults.get(Number(serial));
  }

  const instructions = [
    "Download the sample template ZIP.",
    "Fill mandatory columns: legalName, contactName, contactEmail, contactMobile.",
    "Place trade licence scans in licenses/ folder, named as licenceNumber.ext (e.g. TL-1001.pdf).",
    "Place passport & emirate ID scans in passports/ and emirate_ids/ folders, named as serial.ext (e.g. 1.pdf).",
    "Re-zip everything and upload here. Review results below.",
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="page-kicker">Client Import</div>
        <h2 className="screen-title">Bulk Upload</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Instructions */}
        <Card className="p-4">
          <div className="mb-3 text-[14px] font-extrabold">Step-by-step instructions</div>
          {instructions.map((s, i) => (
            <div key={i} className="mb-3 flex gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1e3a8a] text-[12px] font-black text-white">
                {i + 1}
              </div>
              <div className="pt-1 text-[13px] font-semibold text-slate-600">{s}</div>
            </div>
          ))}
          <Button variant="accent" onClick={downloadTemplate}>
            <Download size={16} />
            Download sample template (ZIP)
          </Button>
        </Card>

        {/* Upload zone */}
        <Card className="p-4">
          <div
            className="upload-zone min-h-72"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) parseZipFile(e.dataTransfer.files[0]);
            }}
          >
            <FileArchive size={42} className="mb-3 text-[#059669]" />
            <div className="text-[15px] font-extrabold text-slate-800">
              Drag and drop .zip file
            </div>
            <div className="mt-1 text-[12px] font-semibold text-slate-500">
              ZIP containing xlsx + document folders (licenses, passports, emirate_ids)
            </div>
            {fileName && (
              <div className="mt-3 flex items-center gap-2 text-[13px] font-bold text-[#1e3a8a]">
                <CheckCircle2 size={16} className="text-[#059669]" />
                {fileName}
              </div>
            )}
            <label className="mt-4 inline-flex" htmlFor="bulk-upload-file">
              <input
                ref={fileInputRef}
                id="bulk-upload-file"
                name="bulkUploadFile"
                className="hidden"
                type="file"
                accept=".zip"
                onChange={(e) => e.target.files?.[0] && parseZipFile(e.target.files[0])}
              />
              <span className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50">
                <UploadCloud size={16} />
                Browse ZIP File
              </span>
            </label>
          </div>
        </Card>
      </div>

      {/* Summary banner */}
      {summary && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 rounded-lg bg-[#ecfdf5] px-3 py-2 text-[13px] font-bold text-[#059669]">
            <CheckCircle2 size={16} />
            {summary.added} added
          </div>
          {summary.failed > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] font-bold text-[#dc2626]">
              <XCircle size={16} />
              {summary.failed} failed
            </div>
          )}
          <div className="text-[12px] font-semibold text-slate-500">
            Total: {summary.total} rows processed
          </div>
        </div>
      )}

      {/* Preview / results table */}
      {rows.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-extrabold">
              {results ? "Upload Results" : "Preview"} ({rows.length} rows)
            </div>
            {!results && (
              <div className="text-[12px] font-semibold text-slate-500">
                Showing first 10 rows
              </div>
            )}
          </div>

          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {results && (
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                  )}
                  {previewColumns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(results ? rows : rows.slice(0, 10)).map((row, i) => {
                  const serial = row.serial || i + 1;
                  const rowResult = getRowStatus(serial);
                  const isSuccess = rowResult?.status === "success";
                  const isError = rowResult?.status === "error";

                  return (
                    <tr
                      key={i}
                      className={[
                        "border-b border-slate-100 transition-colors",
                        isSuccess ? "bg-[#f0fdf4]" : "",
                        isError ? "bg-[#fef2f2]" : "",
                        !results ? "hover:bg-slate-50" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {results && (
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {isSuccess && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#059669]">
                                <Check size={14} className="text-white" strokeWidth={3} />
                              </div>
                            )}
                            {isError && (
                              <div className="relative flex items-center gap-1">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dc2626]">
                                  <X size={14} className="text-white" strokeWidth={3} />
                                </div>
                                <button
                                  type="button"
                                  className="group relative flex h-5 w-5 items-center justify-center rounded-full text-[#dc2626] transition-colors hover:bg-[#fecaca]"
                                  onClick={() => setTooltipRow(tooltipRow === serial ? null : serial)}
                                  onMouseEnter={() => setTooltipRow(serial)}
                                  onMouseLeave={() => setTooltipRow(null)}
                                  title={rowResult?.error || "Error"}
                                >
                                  <Info size={14} strokeWidth={2.5} />
                                  {tooltipRow === serial && (
                                    <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-red-200 bg-white p-2.5 text-left text-[12px] font-semibold text-[#991b1b] shadow-lg">
                                      <div className="flex items-start gap-1.5">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-[#dc2626]" />
                                        <span>{rowResult?.error}</span>
                                      </div>
                                      <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-red-200 bg-white" />
                                    </div>
                                  )}
                                </button>
                              </div>
                            )}
                            {!rowResult && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                      )}
                      {previewColumns.map((column) => (
                        <td
                          key={column}
                          className="max-w-[200px] truncate whitespace-nowrap px-3 py-2.5 font-medium text-slate-700"
                        >
                          {String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!results && (
            <Button className="mt-3" onClick={submitUpload} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  Submit Upload
                </>
              )}
            </Button>
          )}

          {results && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="accent"
                onClick={() => {
                  setRows([]);
                  setZipFile(null);
                  setFileName("");
                  setResults(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Upload Another
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
