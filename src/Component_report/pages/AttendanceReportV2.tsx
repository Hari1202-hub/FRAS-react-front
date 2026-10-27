import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { BASEURL, TOKEN } from "../../app";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AsyncSearchableSelect } from "@/components/ui/async-searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, ChevronLeft, ChevronRight, Loader2, Filter, ClipboardList } from "lucide-react";
import {
  V2_SHIFTS,
  V2_STATUSES,
  V2_STATUS_STYLES,
  formatV2Date,
  formatV2DateTime,
  formatV2Duration,
  formatV2Project,
  toV2ExportRow,
  type AttendanceV2Row,
  type V2Status,
} from "../utils/attendanceV2";

interface Meta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface EntityOption {
  id: string | number;
  entityname: string;
}

interface ProjectOption {
  guid: string;
  projectid: string;
  projectname: string;
}

interface ShiftTimings {
  day_start: string;
  night_start: string;
  next_day_cutoff: string;
}

const PER_PAGE = 50;
const EXPORT_PAGE_SIZE = 2000;
const emptySummary = Object.fromEntries(V2_STATUSES.map((s) => [s, 0])) as Record<V2Status, number>;

const AttendanceReportV2 = () => {
  // ── Filters ──────────────────────────────────────────────────────────────
  const [fromDate, setFromDate]           = useState("");
  const [toDate, setToDate]               = useState("");
  const [entityFilter, setEntityFilter]   = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [shiftFilter, setShiftFilter]     = useState("all");
  const [searchInput, setSearchInput]     = useState("");
  const [search, setSearch]               = useState("");

  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [shiftTimings, setShiftTimings] = useState<ShiftTimings | null>(null);

  // ── Data state ───────────────────────────────────────────────────────────
  const [data, setData]       = useState<AttendanceV2Row[]>([]);
  const [meta, setMeta]       = useState<Meta>({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
  const [summary, setSummary] = useState<Record<V2Status, number>>(emptySummary);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Default to the attendance date still being captured (yesterday until the next-day cutoff).
  useEffect(() => {
    axios
      .get(`${BASEURL}v2/settings/shift`, { headers: { Authorization: `Bearer ${TOKEN()}` } })
      .then((r) => r.data?.data)
      .catch(() => null)
      .then((settings) => {
        const date = settings?.current_attendance_date ?? new Date().toISOString().slice(0, 10);
        setFromDate(date);
        setToDate(date);
      });

    const headers = { "Content-Type": "multipart/form-data", Authorization: `Bearer ${TOKEN()}` };
    axios.post(BASEURL + "entities", {}, { headers }).then((r) => setEntities(r.data?.data || []));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchProjects = useCallback(async ({ search, page }: { search: string; page: number }) => {
    const res = await axios.get(`${BASEURL}v2/projects`, {
      params: { search, page, per_page: 25 },
      headers: { Authorization: `Bearer ${TOKEN()}` },
    });
    const items = res.data?.data || [];
    const m = res.data?.meta;
    return {
      options: (items as ProjectOption[]).map((p) => ({ value: String(p.guid), label: `${p.projectid} — ${p.projectname}` })),
      hasMore: m ? m.current_page < m.last_page : false,
    };
  }, []);

  useEffect(() => { setPage(1); }, [fromDate, toDate, entityFilter, projectFilter, statusFilter, shiftFilter, search]);

  const fetchPage = useCallback(async (pg: number, perPage: number) => {
    const params: Record<string, string | number> = { from: fromDate, to: toDate, page: pg, per_page: perPage };
    if (entityFilter  !== "all") params.entity  = entityFilter;
    if (projectFilter !== "all") params.project = projectFilter;
    if (statusFilter  !== "all") params.status  = statusFilter;
    if (shiftFilter   !== "all") params.shift   = shiftFilter;
    if (search)                  params.search  = search;

    const res = await axios.get(`${BASEURL}v2/reports/attendance-v2`, {
      params,
      headers: { Authorization: `Bearer ${TOKEN()}` },
    });
    return res.data;
  }, [fromDate, toDate, entityFilter, projectFilter, statusFilter, shiftFilter, search]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    let active = true;
    setLoading(true);
    setError("");
    fetchPage(page, PER_PAGE)
      .then((res) => {
        if (!active) return;
        setData(res.data || []);
        setMeta(res.meta);
        setSummary(res.summary || emptySummary);
        setShiftTimings(res.shift_settings || null);
      })
      .catch((err) => {
        if (!active) return;
        const errors = err?.response?.data?.errors;
        setError(errors ? Object.values(errors).flat().join(" ") : "Could not load the report. Please try again.");
        setData([]);
        setMeta({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
        setSummary(emptySummary);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [fetchPage, page, fromDate, toDate]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const rows: AttendanceV2Row[] = [];
      for (let pg = 1, last = 1; pg <= last; pg++) {
        const res = await fetchPage(pg, EXPORT_PAGE_SIZE);
        rows.push(...(res.data || []));
        last = res.meta?.last_page ?? 1;
      }
      const ws = XLSX.utils.json_to_sheet(rows.map(toV2ExportRow));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance V2");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf]), `AttendanceReportV2_${fromDate}_to_${toDate}.xlsx`);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const summaryTotal = V2_STATUSES.reduce((sum, s) => sum + (summary[s] || 0), 0);

  return (
    <div className="p-6 space-y-6 bg-muted/10 min-h-screen">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <ClipboardList className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Report V2</h1>
            <p className="text-sm text-muted-foreground">
              {shiftTimings
                ? `Day shift from ${shiftTimings.day_start} · Night shift from ${shiftTimings.night_start} · Each date runs until ${shiftTimings.next_day_cutoff} the next morning`
                : "First check-in · Last check-out · Shift and status per employee per day"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
          onClick={handleExportExcel}
          disabled={isExporting || loading || meta.total === 0}
        >
          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export Excel
        </Button>
      </div>

      {/* ── Status summary (click to filter) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-lg border bg-white p-3 text-left transition hover:shadow-sm ${statusFilter === "all" ? "ring-2 ring-blue-600" : ""}`}
        >
          <div className="text-xs font-medium text-gray-500">All</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{summaryTotal.toLocaleString()}</div>
        </button>
        {V2_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            aria-pressed={statusFilter === status}
            className={`rounded-lg border bg-white p-3 text-left transition hover:shadow-sm ${statusFilter === status ? "ring-2 ring-blue-600" : ""}`}
          >
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${V2_STATUS_STYLES[status]}`}>{status}</span>
            <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{(summary[status] || 0).toLocaleString()}</div>
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/5">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </CardTitle>
        </CardHeader>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="v2-from" className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
            <Input id="v2-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="v2-to" className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
            <Input id="v2-to" type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Entity</label>
            <SearchableSelect
              value={entityFilter}
              onChange={setEntityFilter}
              placeholder="All Entities"
              searchPlaceholder="Search entity…"
              options={[
                { value: "all", label: "All Entities" },
                ...entities.map((e) => ({ value: String(e.id), label: e.entityname })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <AsyncSearchableSelect
              value={projectFilter}
              onChange={setProjectFilter}
              fetchPage={fetchProjects}
              staticOptions={[{ value: "all", label: "All Projects" }]}
              placeholder="All Projects"
              searchPlaceholder="Search project name or code…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <SearchableSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Statuses"
              searchPlaceholder="Search status…"
              options={[{ value: "all", label: "All Statuses" }, ...V2_STATUSES.map((s) => ({ value: s, label: s }))]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Shift</label>
            <SearchableSelect
              value={shiftFilter}
              onChange={setShiftFilter}
              placeholder="All Shifts"
              searchPlaceholder="Search shift…"
              options={[{ value: "all", label: "All Shifts" }, ...V2_SHIFTS.map((s) => ({ value: s, label: s }))]}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="v2-search" className="block text-xs font-medium text-gray-700 mb-1">Employee</label>
            <Input
              id="v2-search"
              placeholder="Search employee ID or name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Table ── */}
      <Card className="border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading report…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-blue-700">
                <TableRow>
                  <TableHead className="text-white font-semibold">Employee ID</TableHead>
                  <TableHead className="text-white font-semibold">Name</TableHead>
                  <TableHead className="text-white font-semibold">Date</TableHead>
                  <TableHead className="text-white font-semibold">Check In Project</TableHead>
                  <TableHead className="text-white font-semibold">First Check In</TableHead>
                  <TableHead className="text-white font-semibold">Check Out Project</TableHead>
                  <TableHead className="text-white font-semibold">Last Check Out</TableHead>
                  <TableHead className="text-white font-semibold text-right">Duration</TableHead>
                  <TableHead className="text-white font-semibold text-center">Status</TableHead>
                  <TableHead className="text-white font-semibold text-center">Shift</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      No records found for the selected criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((r) => (
                    <TableRow key={`${r.emp_guid}-${r.date}`} className="transition-colors hover:bg-muted/5">
                      <TableCell className="font-mono text-xs">{r.employee_id || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{r.employee_name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatV2Date(r.date)}</TableCell>
                      <TableCell className="text-sm">{formatV2Project(r.checkin_project)}</TableCell>
                      <TableCell className="text-sm text-green-700 font-medium whitespace-nowrap">{formatV2DateTime(r.first_checkin_at)}</TableCell>
                      <TableCell className="text-sm">{formatV2Project(r.checkout_project)}</TableCell>
                      <TableCell className="text-sm text-red-700 font-medium whitespace-nowrap">{formatV2DateTime(r.last_checkout_at)}</TableCell>
                      <TableCell className="text-right font-bold text-sm tabular-nums">{formatV2Duration(r.duration_minutes)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${V2_STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm whitespace-nowrap">{r.shift ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between border-t p-4 bg-muted/5">
          <div className="text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{meta.current_page}</span> of{" "}
            <span className="font-medium text-foreground">{meta.last_page}</span>
            {" "}&nbsp;·&nbsp;{" "}
            <span className="font-medium text-foreground">{meta.total.toLocaleString()}</span> total records
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="h-8 w-8 p-0" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, meta.last_page) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, meta.last_page - 4));
              const pg = start + i;
              return (
                <Button
                  key={pg}
                  variant={pg === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pg)}
                  className="h-8 w-8 p-0 text-xs"
                  disabled={loading}
                >
                  {pg}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= meta.last_page || loading} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 p-0" aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AttendanceReportV2;
