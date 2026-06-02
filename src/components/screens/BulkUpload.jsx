import { AlertCircle, Check, CheckCircle2, Download, Upload, FileArchive, FolderOpen, Info, UploadCloud, X, XCircle } from "lucide-react";
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
    contact_name_1: "Aisha Khan",
    contact_email_1: "aisha@example.com",
    contact_country_code_1: "+971",
    contact_mobile_1: "501234567",
    contact_name_2: "John Smith",
    contact_email_2: "john@example.com",
    contact_name_3: "",
    contact_email_3: "",
    contact_name_4: "",
    contact_email_4: "",
    contact_name_5: "",
    contact_email_5: "",
    contact_name_6: "",
    contact_email_6: "",
    contact_name_7: "",
    contact_email_7: "",
    contact_name_8: "",
    contact_email_8: "",
    contact_name_9: "",
    contact_email_9: "",
    contact_name_10: "",
    contact_email_10: "",
    assignedUserEmailId: "sara@filingbuddy.ae",
  },
];

const PREVIEW_COLUMNS = ["serial", "legalName", "tradeName", "clientType", "licenceNumber", "contact_name_1", "contact_email_1"];

export default function BulkUpload() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [folderFiles, setFolderFiles] = useState(null); // File[] from folder input
  const [zipFile, setZipFile] = useState(null); // Blob from drag-and-drop ZIP fallback
  const [results, setResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tooltipRow, setTooltipRow] = useState(null);
  const [docCounts, setDocCounts] = useState({ licenses: 0, passports: 0, emirateIds: 0 });
  const folderInputRef = useRef(null);
  const { bulkUpload, uploadDocument } = useClients();

  const previewColumns = useMemo(() => {
    if (!rows.length) return [];
    const available = Object.keys(rows[0]);
    const ordered = PREVIEW_COLUMNS.filter((c) => available.includes(c));
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

  /**
   * Normalize the relative path from either webkitRelativePath or ZIP entry.
   * Strips the top-level wrapper folder so we get paths like "licenses/file.pdf".
   */
  function stripRootFolder(relativePath) {
    const parts = relativePath.split("/").filter(Boolean);
    // The first part is always the folder name the user selected — strip it
    return parts.length > 1 ? parts.slice(1).join("/") : parts.join("/");
  }

  /**
   * Count documents in each subfolder from a list of relative paths.
   */
  function countDocuments(relativePaths) {
    let licenses = 0, passports = 0, emirateIds = 0;
    for (const p of relativePaths) {
      const lower = p.toLowerCase();
      if (lower.startsWith("licenses/") && !lower.endsWith("/")) licenses++;
      else if (lower.startsWith("passports/") && !lower.endsWith("/")) passports++;
      else if (lower.startsWith("emirate_ids/") && !lower.endsWith("/")) emirateIds++;
    }
    return { licenses, passports, emirateIds };
  }

  /**
   * Handle folder selection via the webkitdirectory input.
   * Reads all files, finds the xlsx for preview, and stores files for later zipping.
   */
  async function parseFolder(fileList) {
    try {
      const files = Array.from(fileList);
      if (!files.length) return;

      // Find the xlsx/csv — look for it at root of the selected folder
      const spreadsheetFile = files.find((f) => {
        const normalized = stripRootFolder(f.webkitRelativePath);
        // Must be at root level (no further slashes)
        if (normalized.includes("/")) return false;
        const ext = normalized.split(".").pop()?.toLowerCase();
        return ext === "xlsx" || ext === "csv";
      });

      if (!spreadsheetFile) {
        toast.error("No .xlsx or .csv file found in the selected folder.");
        return;
      }

      const buffer = await spreadsheetFile.arrayBuffer();
      const wb = XLSX.read(buffer);
      const parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

      if (!parsedRows.length) {
        toast.error("The spreadsheet is empty.");
        resetState();
        return;
      }

      // Count document files
      const paths = files.map((f) => stripRootFolder(f.webkitRelativePath));
      setDocCounts(countDocuments(paths));

      // Extract folder name from the first file's path
      const folderName = files[0].webkitRelativePath.split("/")[0] || "folder";

      setRows(parsedRows);
      setFileName(folderName);
      setFolderFiles(files);
      setZipFile(null);
      setResults(null);
      toast.success(`${parsedRows.length} rows ready for import.`);
    } catch (err) {
      console.error("Error parsing folder contents:", err);
      toast.error("Unable to read folder contents. Please try again.");
    }
  }

  /**
   * Fallback: handle a .zip file dropped onto the upload zone.
   */
  async function parseZipFile(file) {
    try {
      const zip = await JSZip.loadAsync(file);
      let spreadsheetEntry = null;
      const paths = [];

      zip.forEach((relativePath, entry) => {
        if (entry.dir) return;
        paths.push(relativePath);
        const parts = relativePath.split("/").filter(Boolean);
        const depth = parts.length;
        // Root-level or one level deep (wrapper folder)
        if (depth > 2) return;
        const name = parts[parts.length - 1];
        const ext = name.split(".").pop()?.toLowerCase();
        if ((ext === "xlsx" || ext === "csv") && !spreadsheetEntry) {
          spreadsheetEntry = entry;
        }
      });

      if (!spreadsheetEntry) {
        toast.error("No .xlsx or .csv file found in the ZIP.");
        return;
      }

      const buffer = await spreadsheetEntry.async("arraybuffer");
      const wb = XLSX.read(buffer);
      const parsedRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

      if (!parsedRows.length) {
        toast.error("The spreadsheet in the ZIP is empty.");
        resetState();
        return;
      }

      // Normalize paths (strip wrapper if present)
      const normalized = paths.map((p) => {
        const parts = p.split("/").filter(Boolean);
        return parts.length > 1 ? parts.slice(1).join("/") : p;
      });
      setDocCounts(countDocuments(normalized));

      setRows(parsedRows);
      setFileName(file.name);
      setZipFile(file);
      setFolderFiles(null);
      setResults(null);
      toast.success(`${parsedRows.length} rows ready for import.`);
    } catch (err) {
      console.error("Error parsing ZIP file:", err);
      toast.error("Unable to read this file. Please upload a valid .zip file or select a folder.");
    }
  }

  function resetState() {
    setRows([]);
    setFolderFiles(null);
    setZipFile(null);
    setFileName("");
    setResults(null);
    setDocCounts({ licenses: 0, passports: 0, emirateIds: 0 });
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  async function downloadTemplate() {
    try {
      const zip = new JSZip();

      const sheet = XLSX.utils.json_to_sheet(templateRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Clients");
      const xlsxBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      zip.file("client-bulk-upload-template.xlsx", xlsxBuffer);

      zip.folder("licenses");
      zip.folder("passports");
      zip.folder("emirate_ids");

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "client-bulk-upload-template.zip");
      toast.success("Template downloaded — extract the ZIP to get the template folder.");
    } catch {
      toast.error("Failed to generate template.");
    }
  }

  /**
   * Zip folder files client-side and submit to the v2 API.
   */
  async function submitUpload() {
    if (!folderFiles && !zipFile) {
      toast.error("Please select a folder or ZIP file before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Collect all files client-side into filesMap
      const filesMap = new Map();
      if (zipFile) {
        const zip = await JSZip.loadAsync(zipFile);
        for (const [relativePath, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const normalized = stripRootFolder(relativePath);
          const blob = await entry.async("blob");
          filesMap.set(normalized.toLowerCase(), {
            blob,
            name: relativePath.split("/").pop(),
          });
        }
      } else if (folderFiles) {
        for (const file of folderFiles) {
          const normalized = stripRootFolder(file.webkitRelativePath);
          if (normalized) {
            filesMap.set(normalized.toLowerCase(), {
              blob: file,
              name: file.name,
            });
          }
        }
      }

      // 2. Call bulkUpload to create/validate the clients
      const response = await bulkUpload(rows);
      
      const updatedResults = { ...response };
      const rowResultsList = response.results || [];
      
      // Helper function to find a file from filesMap
      const findFile = (subfolder, basename) => {
        const targetPrefix = `${subfolder.toLowerCase()}/`;
        const targetBasename = String(basename).trim().toLowerCase();
        if (!targetBasename) return null;

        for (const [path, fileObj] of filesMap.entries()) {
          if (path.startsWith(targetPrefix)) {
            const pathParts = path.split("/");
            const fileNameWithExt = pathParts[pathParts.length - 1];
            const dotIndex = fileNameWithExt.lastIndexOf(".");
            const nameWithoutExt = dotIndex !== -1 ? fileNameWithExt.substring(0, dotIndex) : fileNameWithExt;
            if (nameWithoutExt === targetBasename) {
              return fileObj;
            }
          }
        }
        return null;
      };

      // Helper function to extract file extension
      const getExt = (fname) => {
        const dotIdx = fname.lastIndexOf(".");
        return dotIdx !== -1 ? fname.substring(dotIdx + 1) : "pdf";
      };

      // 3. For each successful row, check for and upload documents sequentially
      for (const rowResult of rowResultsList) {
        if (rowResult.status !== "success") continue;
        
        const serial = Number(rowResult.serial);
        const clientId = rowResult.clientId;
        const row = rows.find((r, idx) => (r.serial || idx + 1) === serial);
        if (!row) continue;
        
        const licence = String(row.licenceNumber || row.licence || "").trim();
        
        // Match & Upload Trade Licence Document
        const licenceFileObj = findFile("licenses", serial);
        if (licenceFileObj) {
          const ext = getExt(licenceFileObj.name);
          const formData = new FormData();
          formData.append("files", licenceFileObj.blob, `trade_license.${ext}`);
          formData.append("section", "tradeLicences");
          formData.append("index", "0");
          formData.append("description", `Trade licence document for ${licence}`);
          try {
            await uploadDocument(clientId, formData);
          } catch (uploadErr) {
            console.error(`Failed to upload trade licence for client serial ${serial}:`, uploadErr);
          }
        }
        
        // Match & Upload Passport Document
        const passportFileObj = findFile("passports", serial);
        if (passportFileObj) {
          const ext = getExt(passportFileObj.name);
          const formData = new FormData();
          formData.append("files", passportFileObj.blob, `passport.${ext}`);
          formData.append("section", "passport");
          formData.append("index", "0");
          formData.append("description", `Passport document for contact 1`);
          try {
            await uploadDocument(clientId, formData);
          } catch (uploadErr) {
            console.error(`Failed to upload passport for client serial ${serial}:`, uploadErr);
          }
        }
        
        // Match & Upload Emirates ID Document
        const eidFileObj = findFile("emirate_ids", serial);
        if (eidFileObj) {
          const ext = getExt(eidFileObj.name);
          const formData = new FormData();
          formData.append("files", eidFileObj.blob, `emirates_id.${ext}`);
          formData.append("section", "emiratesId");
          formData.append("index", "0");
          formData.append("description", `Emirates ID document for contact 1`);
          try {
            await uploadDocument(clientId, formData);
          } catch (uploadErr) {
            console.error(`Failed to upload Emirates ID for client serial ${serial}:`, uploadErr);
          }
        }
      }
      
      setResults(updatedResults);
      const added = updatedResults.summary?.added || 0;
      const failed = updatedResults.summary?.failed || 0;
      if (failed === 0) {
        toast.success(`Import complete: ${added} clients and documents uploaded successfully.`);
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

  const hasFiles = folderFiles || zipFile;
  const totalDocs = docCounts.licenses + docCounts.passports + docCounts.emirateIds;

  const instructions = [
    "Download the sample template and extract the ZIP.",
    "Fill mandatory columns: legalName and licenceNumber.",
    "Place trade licence, passport & emirate ID scans in their respective folders (licenses/, passports/, emirate_ids/), all named as serial.ext (e.g. 1.pdf).",
    "Select the entire folder below and review results.",
  ];

  return (
    <div className="space-y-5">
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
            <Upload size={16} />
            Download sample template
          </Button>
        </Card>

        {/* Upload zone */}
        <Card className="p-4">
          <div
            className="upload-zone min-h-72"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const items = e.dataTransfer.items;
              if (items && items.length > 0) {
                const entries = [];
                for (let i = 0; i < items.length; i++) {
                  const entry = items[i].webkitGetAsEntry();
                  if (entry) entries.push(entry);
                }

                // ZIP file drop fallback (if it's a single .zip file)
                if (
                  entries.length === 1 &&
                  entries[0].isFile &&
                  entries[0].name.toLowerCase().endsWith(".zip")
                ) {
                  const file = e.dataTransfer.files?.[0];
                  if (file) parseZipFile(file);
                  return;
                }

                // Recursively read all entries (files and directories)
                const files = [];
                const readEntry = async (entry, path = "") => {
                  if (entry.isFile) {
                    const file = await new Promise((resolve, reject) => {
                      entry.file(resolve, reject);
                    });
                    const relativePath = path ? `${path}/${entry.name}` : entry.name;
                    Object.defineProperty(file, "webkitRelativePath", {
                      value: relativePath,
                      writable: false,
                      configurable: true,
                    });
                    files.push(file);
                  } else if (entry.isDirectory) {
                    const dirReader = entry.createReader();
                    const readEntries = () => {
                      return new Promise((resolve, reject) => {
                        dirReader.readEntries((results) => resolve(results), reject);
                      });
                    };

                    let dirEntries = [];
                    let chunk = await readEntries();
                    while (chunk.length > 0) {
                      dirEntries = dirEntries.concat(chunk);
                      chunk = await readEntries();
                    }

                    const currentPath = path ? `${path}/${entry.name}` : entry.name;
                    for (const child of dirEntries) {
                      await readEntry(child, currentPath);
                    }
                  }
                };

                try {
                  for (const entry of entries) {
                    await readEntry(entry);
                  }
                  if (files.length > 0) {
                    const hasSpreadsheet = files.some((f) => {
                      const normalized = stripRootFolder(f.webkitRelativePath);
                      if (normalized.includes("/")) return false;
                      const ext = normalized.split(".").pop()?.toLowerCase();
                      return ext === "xlsx" || ext === "csv";
                    });

                    if (hasSpreadsheet) {
                      parseFolder(files);
                    } else {
                      const zip = files.find((f) => f.name.toLowerCase().endsWith(".zip"));
                      if (zip) {
                        parseZipFile(zip);
                      } else {
                        toast.error("No .xlsx or .csv spreadsheet found in the dropped folder/files.");
                      }
                    }
                  }
                } catch (err) {
                  console.error("Error reading dropped directory entry:", err);
                  toast.error("Failed to read dropped files/folder.");
                }
              } else {
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  if (file.name.toLowerCase().endsWith(".zip")) {
                    parseZipFile(file);
                  } else {
                    toast.error("Please drop a valid .zip file or select a folder.");
                  }
                }
              }
            }}
          >
            <FolderOpen size={42} className="mb-3 text-[#059669]" />
            <div className="text-[15px] font-extrabold text-slate-800">
              Select your upload folder
            </div>
            <div className="mt-1 text-[12px] font-semibold text-slate-500">
              Folder containing xlsx + document subfolders (licenses, passports, emirate_ids)
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              You can also drag and drop a .zip file
            </div>

            {fileName && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-[13px] font-bold text-[#1e3a8a]">
                  <CheckCircle2 size={16} className="text-[#059669]" />
                  {fileName}
                </div>
                {totalDocs > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold text-slate-500">
                    {docCounts.licenses > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5">{docCounts.licenses} licence{docCounts.licenses !== 1 ? "s" : ""}</span>}
                    {docCounts.passports > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5">{docCounts.passports} passport{docCounts.passports !== 1 ? "s" : ""}</span>}
                    {docCounts.emirateIds > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5">{docCounts.emirateIds} emirate ID{docCounts.emirateIds !== 1 ? "s" : ""}</span>}
                  </div>
                )}
              </div>
            )}

            <label className="mt-4 inline-flex" htmlFor="bulk-upload-folder">
              <input
                ref={folderInputRef}
                id="bulk-upload-folder"
                name="bulkUploadFolder"
                className="hidden"
                type="file"
                /* @ts-ignore — webkitdirectory is non-standard but universally supported */
                webkitdirectory=""
                directory=""
                onChange={(e) => e.target.files?.length && parseFolder(e.target.files)}
              />
              <span className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50">
                <FolderOpen size={16} />
                Browse Folder
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
                  <Download size={16} />
                  Submit Upload
                </>
              )}
            </Button>
          )}

          {results && (
            <div className="mt-3 flex gap-2">
              <Button variant="accent" onClick={resetState}>
                Upload Another
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
