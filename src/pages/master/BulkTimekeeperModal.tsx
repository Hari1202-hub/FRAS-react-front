import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  X,
} from "lucide-react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { BASEURL } from "../../app";
import { TOKEN } from "../../app";

interface ProjectRow {
  project_guid: string;
  project_id: string;
  project_name: string;
  timekeeper_guid: string | null;
  timekeeper_name: string | null;
}

interface StaffOption {
  guid: string;
  name: string;
  emp_id: string;
}

interface AssignRow {
  project_guid: string;
  project_id: string;
  project_name: string;
  existing_timekeeper: string | null;
  selected_staff_guids: string[]; // multiple timekeepers supported
}

interface ImportResult {
  assigned: number;
  skipped: number;
  errors: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CHUNK_SIZE = 150; // rows processed per tick before yielding to browser

/** Yield control back to the browser so React can flush state updates. */
const yieldTick = () => new Promise<void>((r) => setTimeout(r, 0));

export default function BulkTimekeeperModal({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [assignments, setAssignments] = useState<AssignRow[]>([]);

  const [loadingInit, setLoadingInit] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  // Processing state with progress feedback
  const [processingStage, setProcessingStage] = useState<
    "idle" | "reading" | "matching"
  >("idle");
  const [processingProgress, setProcessingProgress] = useState(0); // 0-100

  // ── O(1) lookup maps ──────────────────────────────────────────────────────
  const projectById = useMemo(() => {
    const m = new Map<string, ProjectRow>();
    projectRows.forEach((p) => m.set(p.project_id, p));
    return m;
  }, [projectRows]);

  const staffByName = useMemo(() => {
    const m = new Map<string, StaffOption>();
    staffList.forEach((s) => m.set(s.name.toLowerCase(), s));
    return m;
  }, [staffList]);

  const staffByEmpId = useMemo(() => {
    const m = new Map<string, StaffOption>();
    staffList.forEach((s) => {
      if (s.emp_id) m.set(s.emp_id.toLowerCase(), s);
    });
    return m;
  }, [staffList]);

  const staffByGuid = useMemo(() => {
    const m = new Map<string, StaffOption>();
    staffList.forEach((s) => m.set(s.guid, s));
    return m;
  }, [staffList]);

  // ── Derived row splits ────────────────────────────────────────────────────
  const validRows = useMemo(
    () =>
      assignments
        .map((a, i) => ({ ...a, _idx: i }))
        .filter((a) => a.project_guid && a.selected_staff_guids.length > 0),
    [assignments]
  );

  const skippedRows = useMemo(
    () =>
      assignments
        .map((a, i) => ({ ...a, _idx: i }))
        .filter((a) => !a.project_guid || a.selected_staff_guids.length === 0),
    [assignments]
  );

  useEffect(() => {
    if (open) loadInit();
  }, [open]);

  const loadInit = async () => {
    setLoadingInit(true);
    try {
      const [projRes, staffRes] = await Promise.all([
        axios.get(`${BASEURL}v2/projects/timekeeper-template`, {
          headers: { Authorization: `Bearer ${TOKEN()}` },
        }),
        axios.get(`${BASEURL}v2/staff/all`, {
          headers: { Authorization: `Bearer ${TOKEN()}` },
        }),
      ]);
      setProjectRows(projRes.data.data ?? []);
      setStaffList(staffRes.data.data ?? []);
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoadingInit(false);
    }
  };

  // ── Download template ─────────────────────────────────────────────────────
  const handleDownload = () => {
    setDownloading(true);
    try {
      const assignRows: any[][] = [
        ["Project ID", "Project Name", "Timekeeper (Name or Staff ID, comma-separated)"],
        ...projectRows.map((p) => [
          p.project_id,
          p.project_name,
          p.timekeeper_name ?? "",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(assignRows);
      ws["!cols"] = [{ wch: 15 }, { wch: 40 }, { wch: 45 }];

      const staffRows: any[][] = [
        ["Timekeeper Name", "Staff ID"],
        ...staffList.map((s) => [s.name, s.emp_id]),
      ];
      const staffWs = XLSX.utils.aoa_to_sheet(staffRows);
      staffWs["!cols"] = [{ wch: 35 }, { wch: 15 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Assignments");
      XLSX.utils.book_append_sheet(wb, staffWs, "Valid Timekeepers");

      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      saveAs(
        new Blob([buf], { type: "application/octet-stream" }),
        "timekeeper_assignment_template.xlsx"
      );
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // ── Upload & parse — chunked to avoid freezing the main thread ─────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingStage("reading");
    setProcessingProgress(0);
    setShowSkipped(false);

    const reader = new FileReader();

    reader.onload = (ev) => {
      // Yield once so "Reading file…" renders before the synchronous XLSX parse
      setTimeout(async () => {
        try {
          const wb = XLSX.read(ev.target!.result as ArrayBuffer, {
            type: "array",
            dense: true, // faster parse for large sheets
          });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const dataRows = raw
            .slice(1)
            .filter((r) => r[0] != null && String(r[0]).trim() !== "");

          setProcessingStage("matching");
          setProcessingProgress(5);
          await yieldTick();

          const mapped: AssignRow[] = [];

          for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
            const chunk = dataRows.slice(i, i + CHUNK_SIZE);

            for (const row of chunk) {
              const projectId   = String(row[0] ?? "").trim();
              const projectName = String(row[1] ?? "").trim();
              const tkRaw       = String(row[2] ?? "").trim();

              const proj = projectById.get(projectId);

              // Support comma-separated names or staff IDs
              const tokens = tkRaw
                .split(",")
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean);

              const guids = Array.from(
                new Set( // deduplicate
                  tokens
                    .map(
                      (tk) =>
                        (staffByName.get(tk) ?? staffByEmpId.get(tk))?.guid
                    )
                    .filter((g): g is string => Boolean(g))
                )
              );

              mapped.push({
                project_guid:        proj?.project_guid ?? "",
                project_id:          projectId,
                project_name:        projectName || proj?.project_name || "",
                existing_timekeeper: proj?.timekeeper_name ?? null,
                selected_staff_guids: guids,
              });
            }

            const pct = Math.min(
              5 + Math.round(((i + CHUNK_SIZE) / dataRows.length) * 95),
              100
            );
            setProcessingProgress(pct);

            if (i + CHUNK_SIZE < dataRows.length) {
              await yieldTick(); // breathe between chunks
            }
          }

          setAssignments(mapped);
          setResult(null);
          setStep(2);
        } catch {
          toast({
            title: "Failed to read file",
            description: "Make sure you upload a valid .xlsx or .xls file.",
            variant: "destructive",
          });
        } finally {
          setProcessingStage("idle");
          setProcessingProgress(0);
        }
      }, 0);
    };

    reader.onerror = () => {
      toast({ title: "Could not read file", variant: "destructive" });
      setProcessingStage("idle");
    };

    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // ── Row editing helpers ───────────────────────────────────────────────────
  const addStaff = (idx: number, guid: string) => {
    if (!guid) return;
    setAssignments((prev) => {
      const copy = [...prev];
      if (!copy[idx].selected_staff_guids.includes(guid)) {
        copy[idx] = {
          ...copy[idx],
          selected_staff_guids: [...copy[idx].selected_staff_guids, guid],
        };
      }
      return copy;
    });
  };

  const removeStaff = (idx: number, guid: string) => {
    setAssignments((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        selected_staff_guids: copy[idx].selected_staff_guids.filter(
          (g) => g !== guid
        ),
      };
      return copy;
    });
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!validRows.length) {
      toast({ title: "No valid assignments to import", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const res = await axios.post(
        `${BASEURL}v2/projects/bulk-assign-timekeeper`,
        {
          assignments: validRows.map((a) => ({
            project_guid: a.project_guid,
            staff_guids:  a.selected_staff_guids,
          })),
        },
        { headers: { Authorization: `Bearer ${TOKEN()}` } }
      );
      setResult(res.data.data);
      toast({ title: "Import successful", description: res.data.message });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setAssignments([]);
    setResult(null);
    setProcessingStage("idle");
    setProcessingProgress(0);
    setShowSkipped(false);
    onOpenChange(false);
  };

  const isProcessing = processingStage !== "idle";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle>Bulk Assign Timekeeper to Projects</DialogTitle>
        </DialogHeader>

        {/* ── Loading initial data ── */}
        {loadingInit ? (
          <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>Loading projects and staff…</span>
          </div>

        /* ── Processing uploaded file ── */
        ) : isProcessing ? (
          <div className="py-12 flex flex-col items-center gap-4 text-gray-600">
            <Loader2 className="w-9 h-9 animate-spin text-proscape" />
            <div className="text-center">
              <p className="font-medium">
                {processingStage === "reading"
                  ? "Reading file…"
                  : "Matching staff records…"}
              </p>
              {processingStage === "matching" && (
                <p className="text-xs text-gray-400 mt-1">
                  {staffList.length.toLocaleString()} staff · progress {processingProgress}%
                </p>
              )}
            </div>
            {/* Progress bar */}
            {processingStage === "matching" && (
              <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-proscape rounded-full transition-all duration-200"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
            )}
          </div>

        /* ── Step 1: Download + Upload ── */
        ) : step === 1 ? (
          <div className="flex flex-col gap-5 overflow-y-auto">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p className="font-semibold mb-1">How it works</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Download the template — projects are pre-filled with their current timekeeper.</li>
                <li>Open the <strong>Valid Timekeepers</strong> sheet to find staff names and Staff IDs.</li>
                <li>
                  In the <strong>Timekeeper</strong> column, type a name or Staff ID. To assign
                  multiple, separate them with a comma:{" "}
                  <code className="bg-blue-100 px-1 rounded">
                    John Smith, EMP042
                  </code>
                </li>
                <li>Save, upload below, then review before confirming.</li>
              </ol>
            </div>

            <Button
              variant="outline"
              className="w-fit border-proscape text-proscape hover:bg-proscape/5"
              onClick={handleDownload}
              disabled={downloading || !projectRows.length}
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading
                ? "Generating…"
                : `Download Template (${projectRows.length} projects)`}
            </Button>

            <div className="border-t pt-4">
              <label className="flex flex-col items-center gap-3 border-2 border-dashed border-proscape rounded-lg p-10 cursor-pointer hover:bg-proscape/5 transition">
                <Upload className="w-8 h-8 text-proscape" />
                <span className="font-medium text-proscape">
                  Click to upload filled template
                </span>
                <span className="text-xs text-gray-400">Accepts .xlsx or .xls</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

        /* ── Step 2: Review ── */
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden min-h-0 relative">

            {/* Full-modal import overlay */}
            {importing && (
              <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-proscape" />
                <div className="text-center">
                  <p className="font-semibold text-gray-700">Importing assignments…</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Saving {validRows.reduce((n, r) => n + r.selected_staff_guids.length, 0)} timekeeper assignment(s) across {validRows.length} project(s)
                  </p>
                </div>
              </div>
            )}

            {/* Summary pills + back */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {validRows.length} project(s) ready · {validRows.reduce((n, r) => n + r.selected_staff_guids.length, 0)} assignment(s)
                </span>
                {skippedRows.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSkipped((v) => !v)}
                    className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-600 px-3 py-1 rounded-full font-medium hover:bg-orange-100 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {skippedRows.length} skipped
                    <span className="text-xs underline ml-0.5">
                      {showSkipped ? "hide" : "show"}
                    </span>
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStep(1); setResult(null); }}
                disabled={importing}
              >
                ← Back
              </Button>
            </div>

            {/* Valid rows table */}
            <div className="overflow-auto border rounded-lg flex-1 max-h-[300px]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap w-28">Project ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Project Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap w-36">Current</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">New Timekeeper(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                        No matched rows. Fix skipped rows below or re-upload the template.
                      </td>
                    </tr>
                  )}
                  {validRows.map((row) => (
                    <tr key={row._idx} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row.project_id}</td>
                      <td className="px-3 py-2 text-gray-700">{row.project_name}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">{row.existing_timekeeper || "—"}</td>
                      <td className="px-3 py-2">
                        {/* Tags for currently selected staff */}
                        <div className="flex flex-wrap gap-1 items-center">
                          {row.selected_staff_guids.map((guid) => {
                            const s = staffByGuid.get(guid);
                            return (
                              <span
                                key={guid}
                                className="inline-flex items-center gap-1 bg-proscape/10 text-proscape text-xs px-2 py-0.5 rounded-full"
                              >
                                {s?.name ?? guid}
                                <button
                                  type="button"
                                  onClick={() => removeStaff(row._idx, guid)}
                                  disabled={importing}
                                  className="hover:text-red-500 transition disabled:opacity-40"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                          {/* Add another timekeeper */}
                          <select
                            className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-proscape disabled:opacity-40"
                            value=""
                            disabled={importing}
                            onChange={(e) => addStaff(row._idx, e.target.value)}
                          >
                            <option value="">+ Add</option>
                            {staffList
                              .filter((s) => !row.selected_staff_guids.includes(s.guid))
                              .map((s) => (
                                <option key={s.guid} value={s.guid}>
                                  {s.name}{s.emp_id ? ` (${s.emp_id})` : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Skipped rows panel (collapsible) */}
            {showSkipped && skippedRows.length > 0 && (
              <div className="border border-orange-200 rounded-lg overflow-auto max-h-[160px]">
                <div className="bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 sticky top-0">
                  Skipped rows — assign a timekeeper to include them
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {skippedRows.map((row) => (
                      <tr key={row._idx} className="border-t">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap w-28">
                          {row.project_id}
                          {!row.project_guid && (
                            <span className="ml-1 text-xs text-red-500">(unknown)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.project_name}</td>
                        <td className="px-3 py-2">
                          <select
                            className="w-full border border-orange-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-proscape disabled:opacity-50"
                            value=""
                            disabled={!row.project_guid || importing}
                            onChange={(e) => addStaff(row._idx, e.target.value)}
                          >
                            <option value="">— Assign to move to ready —</option>
                            {staffList.map((s) => (
                              <option key={s.guid} value={s.guid}>
                                {s.name}{s.emp_id ? ` (${s.emp_id})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Result banner */}
            {result && (
              <div
                className={`p-3 rounded-lg border text-sm ${
                  result.errors.length
                    ? "bg-yellow-50 border-yellow-300"
                    : "bg-green-50 border-green-200"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  {result.assigned} assigned, {result.skipped} skipped.
                </div>
                {result.errors.map((err, i) => (
                  <p key={i} className="mt-1 flex items-center gap-1 text-red-600">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {err}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={handleClose} disabled={importing}>
                Close
              </Button>
              <Button
                className="bg-proscape hover:bg-proscape-dark text-white min-w-[180px]"
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
              >
                Import {validRows.reduce((n, r) => n + r.selected_staff_guids.length, 0)} Assignment(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
