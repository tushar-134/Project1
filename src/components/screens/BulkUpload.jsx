import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";
import { useClients } from "../../hooks/useClients";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";

export default function BulkUpload() {
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const { bulkUpload } = useClients();
  async function parseFile(file) {
    // The backend expects parsed rows, so the browser handles Excel/CSV decoding and preview first.
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer);
    setRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
  }
  return <div className="space-y-5"><div><div className="page-kicker">Client Import</div><h2 className="screen-title">Bulk Upload</h2></div><div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"><Card className="p-4"><div className="mb-3 text-[14px] font-extrabold">Step-by-step instructions</div>{["Download the sample Excel template.", "Fill mandatory client, licence, contact, VAT and CT columns.", "Keep one row per licence/contact combination.", "Upload .xlsx or .csv and review validation results."].map((s, i) => <div key={s} className="mb-3 flex gap-3"><div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1e3a8a] text-[12px] font-black text-white">{i + 1}</div><div className="pt-1 font-semibold text-slate-600">{s}</div></div>)}<Button variant="accent"><Download size={16} />Download sample Excel template</Button></Card><Card className="p-4"><div className="upload-zone min-h-72"><FileSpreadsheet size={42} className="mb-3 text-[#059669]" /><div className="text-[15px] font-extrabold text-slate-800">Drag and drop .xlsx or .csv file</div><div className="mt-1 text-[12px] font-semibold text-slate-500">Client master data import</div><label className="mt-4 inline-flex"><input className="hidden" type="file" accept=".xlsx,.csv" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} /><span className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-bold text-slate-700"><UploadCloud size={16} />Browse File</span></label></div></Card></div>{rows.length > 0 && <Card className="p-4"><div className="mb-3 font-extrabold">Preview ({rows.length} rows)</div><div className="overflow-auto"><table className="table"><tbody>{rows.slice(0, 5).map((row, i) => <tr key={i}>{Object.values(row).slice(0, 6).map((cell, j) => <td key={j}>{String(cell)}</td>)}</tr>)}</tbody></table></div><Button className="mt-3" onClick={async () => setResult(await bulkUpload(rows))}>Submit Upload</Button>{result && <div className="mt-3 rounded-xl bg-slate-50 p-3 font-bold text-slate-600">{result.added} added, {result.skipped} skipped, {result.errors?.length || 0} errors</div>}</Card>}</div>;
}
