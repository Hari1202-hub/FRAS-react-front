import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BASEURL, TOKEN } from "../../app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  CalendarRange,
  ScanFace,
  Loader2,
  Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FRRow {
  entityname: string;
  project_code: string;
  projectname: string;
  timekeeper_id: string;
  timekeeper_name: string;
  employee_id: string;
  employee_name: string;
  emp_guid: string;
  classification: string;
  report_date: string;
  first_checkin: string | null;
  last_checkout: string | null;
  duration_hours: number | string | null;
  status: string;
}

interface Meta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format DATE string "YYYY-MM-DD" → "DD/MM/YYYY"
 */
const fmtDate = (d: string): string => {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  return `${day}/${m}/${y}`;
};

/**
 * checkin is a TIME string "HH:MM:SS". Combine with the report_date for display.
 */
const fmtCheckin = (reportDate: string, time: string | null): string => {
  if (!time) return "—";
  const [y, m, d] = String(reportDate).split("-");
  return `${d}/${m}/${y} ${time.substring(0, 5)}`;
};

/**
 * checkout is a TIME string "HH:MM:SS". If checkout < checkin it crossed midnight
 * so the display date is report_date + 1.
 */
const fmtCheckout = (reportDate: string, checkin: string | null, checkout: string | null): string => {
  if (!checkout) return "—";
  const base = new Date(reportDate);
  if (checkin && checkout < checkin) base.setDate(base.getDate() + 1);
  const [y, m, d] = base.toISOString().split("T")[0].split("-");
  return `${d}/${m}/${y} ${checkout.substring(0, 5)}`;
};

const fmtDuration = (h: number | null): string => {
  if (h === null || h === undefined) return "—";
  return `${Number(h).toFixed(2)} hrs`;
};


const getStatusBadge = (present: boolean) =>
  present
    ? "bg-green-100 text-green-700 border-green-200"
    : "bg-red-100 text-red-700 border-red-200";

// ─── Component ────────────────────────────────────────────────────────────────

const FacialRecognitionReport = () => {
  // ── Filter state ─────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate]     = useState(today);
  const [toDate, setToDate]         = useState(today);
  const [entityFilter, setEntityFilter]           = useState("all");
  const [projectFilter, setProjectFilter]         = useState("all");
  const [timekeeperFilter, setTimekeeperFilter]   = useState("");
  const [employeeIdFilter, setEmployeeIdFilter]   = useState("");
  const [classFilter, setClassFilter]             = useState("all");
  const [statusFilter, setStatusFilter]           = useState("all");

  // ── Option lists ─────────────────────────────────────────────────────────
  const [entities, setEntities]               = useState<any[]>([]);
  const [classifications, setClassifications] = useState<any[]>([]);
  const [attendanceTypes, setAttendanceTypes] = useState<any[]>([]);

  // ── Data state ───────────────────────────────────────────────────────────
  const [data, setData]       = useState<FRRow[]>([]);
  const [meta, setMeta]       = useState<Meta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 });
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Load filter option lists ──────────────────────────────────────────────
  useEffect(() => {
    const headers = { "Content-Type": "multipart/form-data", Authorization: `Bearer ${TOKEN()}` };

    axios.post(BASEURL + "entities",         {}, { headers }).then((r) => setEntities(r.data?.data || []));
    axios.post(BASEURL + "classifications",  {}, { headers }).then((r) => setClassifications(r.data?.data || []));
    axios.post(BASEURL + "attendancetypes",  {}, { headers }).then((r) => setAttendanceTypes(r.data?.data || []));
  }, []);

  // ── Projects: searched & paginated on the server (loaded on scroll) ────────
  const fetchProjects = useCallback(async ({ search, page }: { search: string; page: number }) => {
    const res = await axios.get(`${BASEURL}v2/projects`, {
      params: { search, page, per_page: 25, active: 1 },
      headers: { Authorization: `Bearer ${TOKEN()}` },
    });
    const items = res.data?.data || [];
    const m = res.data?.meta;
    return {
      options: items.map((p: any) => ({
        value: String(p.id),
        label: `${p.projectid} — ${p.projectname}`,
      })),
      hasMore: m ? m.current_page < m.last_page : false,
    };
  }, []);

  // ── Reset to page 1 when filters change ──────────────────────────────────
  useEffect(() => { setPage(1); }, [fromDate, toDate, entityFilter, projectFilter, timekeeperFilter, employeeIdFilter, classFilter, statusFilter]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (pg = page, perPage = 50, allRecords = false) => {
    try {
      const params: Record<string, any> = {
        from: fromDate,
        to:   toDate,
        page: pg,
        per_page: allRecords ? 5000 : perPage,
      };
      if (entityFilter     !== "all") params.entity         = entityFilter;
      if (projectFilter    !== "all") params.project        = projectFilter;
      if (timekeeperFilter)           params.timekeeper     = timekeeperFilter;
      if (employeeIdFilter)           params.employee_id    = employeeIdFilter;
      if (classFilter      !== "all") params.classification = classFilter;
      if (statusFilter     !== "all") params.status         = statusFilter;

      const res = await axios.get(`${BASEURL}v2/reports/facial-recognition`, {
        params,
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      return res.data;
    } catch (err) {
      console.error("Facial recognition report error:", err);
      return null;
    }
  }, [fromDate, toDate, entityFilter, projectFilter, timekeeperFilter, employeeIdFilter, classFilter, statusFilter, page]);

  useEffect(() => {
    setLoading(true);
    fetchData(page).then((res) => {
      if (res) {
        setData(res.data || []);
        setMeta(res.meta || { current_page: 1, last_page: 1, per_page: 50, total: 0 });
      }
      setLoading(false);
    });
  }, [page, fromDate, toDate, entityFilter, projectFilter, timekeeperFilter, employeeIdFilter, classFilter, statusFilter]);

  // ── Summary totals (current page) ────────────────────────────────────────
  const totalDuration = data.reduce((s, r) => s + (Number(r.duration_hours) || 0), 0);
  // Cross-midnight: checkout TIME string < checkin TIME string (both "HH:MM:SS")
  const nightShifts = data.filter(
    (r) => r.first_checkin && r.last_checkout && r.last_checkout < r.first_checkin
  ).length;

  // ── Column map for exports ────────────────────────────────────────────────
  const toExportRow = (r: FRRow) => ({
    Entity:          r.entityname,
    Project:         r.project_code,
    Timekeeper:      r.timekeeper_id,
    "Employee ID":   r.employee_id,
    "Employee Name": r.employee_name,
    Classification:  r.classification,
    Date:            fmtDate(r.report_date),
    "First Check In":  fmtCheckin(r.report_date, r.first_checkin),
    "Last Check Out":  fmtCheckout(r.report_date, r.first_checkin, r.last_checkout),
    "Duration (hrs)":  r.duration_hours != null ? Number(r.duration_hours).toFixed(2) : "",
    Status:          r.first_checkin ? "Present" : "Absent",
  });

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    setIsExporting(true);
    const res = await fetchData(1, 50, true);
    if (res?.data?.length) {
      const ws = XLSX.utils.json_to_sheet(res.data.map(toExportRow));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Facial Recognition");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf]), `FacialRecognition_${fromDate}_to_${toDate}.xlsx`);
    }
    setIsExporting(false);
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setIsExporting(true);
    const res = await fetchData(1, 50, true);
    if (res?.data?.length) {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Facial Recognition Report", 14, 16);
      doc.setFontSize(9);
      doc.text(`Period: ${fromDate} to ${toDate}`, 14, 24);

      autoTable(doc, {
        startY: 30,
        head: [["Entity", "Project", "Timekeeper", "Emp ID", "Classification", "Date", "First In", "Last Out", "Hrs", "Status"]],
        body: res.data.map((r: FRRow) => [
          r.entityname,
          r.project_code,
          r.timekeeper_id,
          r.employee_id,
          r.classification,
          fmtDate(r.report_date),
          fmtCheckin(r.report_date, r.first_checkin),
          fmtCheckout(r.report_date, r.first_checkin, r.last_checkout),
          r.duration_hours != null ? Number(r.duration_hours).toFixed(2) : "—",
          r.first_checkin ? "Present" : "Absent",
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`FacialRecognition_${fromDate}_to_${toDate}.pdf`);
    }
    setIsExporting(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 bg-muted/10 min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <ScanFace className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facial Recognition Report</h1>
            <p className="text-sm text-muted-foreground">First check-in · Last check-out · Duration per employee per project per day</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
            onClick={handleExportExcel}
            disabled={isExporting || loading}
          >
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export Excel
          </Button>
          <Button
            variant="outline"
            className="border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-50"
            onClick={handleExportPDF}
            disabled={isExporting || loading}
          >
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meta.total}</div>
            <p className="text-xs text-muted-foreground">Matching filters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDuration.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Hours (current page)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Date Range</CardTitle>
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">{fmtDate(fromDate)}</div>
            <p className="text-xs text-muted-foreground">to {fmtDate(toDate)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Night Shifts</CardTitle>
            <ScanFace className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{nightShifts}</div>
            <p className="text-xs text-muted-foreground">Cross-midnight (this page)</p>
          </CardContent>
        </Card>
      </div>


      {/* ── Filters ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/5">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </CardTitle>
        </CardHeader>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* From Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            {/* Entity */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Entity</label>
              <SearchableSelect
                value={entityFilter}
                onChange={setEntityFilter}
                placeholder="All Entities"
                searchPlaceholder="Search entity…"
                options={[
                  { value: "all", label: "All Entities" },
                  ...entities.map((e: any) => ({ value: String(e.id), label: e.entityname })),
                ]}
              />
            </div>

            {/* Project */}
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

            {/* Timekeeper */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Timekeeper (ID)</label>
              <Input
                placeholder="Search timekeeper emp ID"
                value={timekeeperFilter}
                onChange={(e) => setTimekeeperFilter(e.target.value)}
              />
            </div>

            {/* Employee ID */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Employee ID</label>
              <Input
                placeholder="Search employee ID"
                value={employeeIdFilter}
                onChange={(e) => setEmployeeIdFilter(e.target.value)}
              />
            </div>

            {/* Classification */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Classification</label>
              <SearchableSelect
                value={classFilter}
                onChange={setClassFilter}
                placeholder="All Classifications"
                searchPlaceholder="Search classification…"
                options={[
                  { value: "all", label: "All Classifications" },
                  ...classifications.map((c: any) => ({ value: c.code, label: c.description })),
                ]}
              />
            </div>

            {/* Attendance Type (filters on attendance_type, distinct from the Present/Absent Status column) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Attendance Type</label>
              <SearchableSelect
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Attendance Types"
                searchPlaceholder="Search attendance type…"
                options={[
                  { value: "all", label: "All Attendance Types" },
                  ...attendanceTypes.map((t: any) => ({
                    value: t.attendance_type,
                    label: t.attendance_type,
                  })),
                ]}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card className="border shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading report…</span>
          </div>
        )}

        {!loading && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-blue-700">
                <TableRow>
                  <TableHead className="text-white font-semibold">Entity</TableHead>
                  <TableHead className="text-white font-semibold">Project</TableHead>
                  <TableHead className="text-white font-semibold">Timekeeper</TableHead>
                  <TableHead className="text-white font-semibold">Employee ID</TableHead>
                  <TableHead className="text-white font-semibold">Classification</TableHead>
                  <TableHead className="text-white font-semibold">First Check In</TableHead>
                  <TableHead className="text-white font-semibold">Last Check Out</TableHead>
                  <TableHead className="text-white font-semibold text-right">Duration</TableHead>
                  <TableHead className="text-white font-semibold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      No records found for the selected criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((r, i) => (
                    <TableRow key={`${r.emp_guid}-${r.report_date}-${r.project_code}-${i}`} className="transition-colors hover:bg-muted/5">
                      <TableCell className="text-sm font-medium">{r.entityname || "—"}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.project_code}</div>
                        <div className="text-xs text-muted-foreground">{r.projectname}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-mono text-xs">{r.timekeeper_id || "—"}</div>
                        {r.timekeeper_name && (
                          <div className="text-xs text-muted-foreground">{r.timekeeper_name}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.employee_id || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.classification || "—"}</TableCell>
                      <TableCell className="text-sm text-green-700 font-medium whitespace-nowrap">
                        {fmtCheckin(r.report_date, r.first_checkin)}
                      </TableCell>
                      <TableCell className="text-sm text-red-700 font-medium whitespace-nowrap">
                        {fmtCheckout(r.report_date, r.first_checkin, r.last_checkout)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        {fmtDuration(r.duration_hours)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(!!r.first_checkin)}`}>
                          {r.first_checkin ? "Present" : "Absent"}
                        </span>
                      </TableCell>
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
            <span className="font-medium text-foreground">{meta.total}</span> total records
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page number pills */}
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

            <Button
              variant="outline" size="sm"
              disabled={page >= meta.last_page || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FacialRecognitionReport;
