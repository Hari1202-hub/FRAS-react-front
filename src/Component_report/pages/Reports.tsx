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

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Download, FileText, Users, Clock, CalendarRange,
  ChevronLeft, ChevronRight, Eye, Loader2, MapPin,
  LogIn, LogOut, ArrowLeftRight,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0];

// Derive public storage URL from BASEURL (strips /api/, appends /storage/)
const storageUrl = BASEURL.replace(/\/api\/?$/, "/storage/");
const imgUrl = (path: string | null) => (path ? `${storageUrl}${path}` : null);

const mapsLink = (lat: string | null, lng: string | null) =>
  lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

const statusBadge = (s: string) => {
  const v = (s || "").toLowerCase();
  if (v === "present")        return "bg-green-100 text-green-700 border-green-200";
  if (v === "absent")         return "bg-red-100 text-red-700 border-red-200";
  if (v.includes("only"))     return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportRow {
  emp_guid: string;
  employee_name: string;
  emp_id: string;
  entityname: string;
  category: string;
  classification: string;
  project_code: string;
  projectname: string;
  date: string;
  checkin: string | null;
  checkout: string | null;
  checkin_lat: string | null;
  checkin_lang: string | null;
  checkout_lat: string | null;
  checkout_lang: string | null;
  worked_hours: string | null;
  attendance_status: string;
  attendance_type: string;
}

interface DetailRecord {
  id: number;
  checkin: string | null;
  checkout: string | null;
  checkin_lat: string | null;
  checkin_lang: string | null;
  checkout_lat: string | null;
  checkout_lang: string | null;
  checkin_image: string | null;
  checkout_image: string | null;
  attendance_type: string;
  project_code: string | null;
  projectname: string | null;
  event_type: string;
  worked_hours: string | null;
  created_at: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Reports = () => {
  // ── Filters ───────────────────────────────────────────────────────────────
  const [date, setDate]                           = useState(today());
  const [entityFilter, setEntityFilter]           = useState("all");
  const [projectFilter, setProjectFilter]         = useState("all");
  const [categoryFilter, setCategoryFilter]       = useState("all");
  const [classFilter, setClassFilter]             = useState("all");
  const [searchEmp, setSearchEmp]                 = useState("");
  const [searchName, setSearchName]               = useState("");

  // ── Dropdown search terms ─────────────────────────────────────────────────
  const [entitySearch, setEntitySearch]       = useState("");
  const [projectSearch, setProjectSearch]     = useState("");
  const [categorySearch, setCategorySearch]   = useState("");
  const [classSearch, setClassSearch]         = useState("");

  // ── Options ───────────────────────────────────────────────────────────────
  const [entities, setEntities]               = useState<any[]>([]);
  const [projects, setProjects]               = useState<any[]>([]);
  const [categories, setCategories]           = useState<any[]>([]);
  const [classifications, setClassifications] = useState<any[]>([]);

  // ── Table state ───────────────────────────────────────────────────────────
  const [data, setData]       = useState<ReportRow[]>([]);
  const [meta, setMeta]       = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Detail modal state ────────────────────────────────────────────────────
  const [viewOpen, setViewOpen]       = useState(false);
  const [viewRow, setViewRow]         = useState<ReportRow | null>(null);
  const [viewData, setViewData]       = useState<DetailRecord[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [lightbox, setLightbox]       = useState<string | null>(null);

  // ── Load filter options on mount ──────────────────────────────────────────
  useEffect(() => {
    const h = { "Content-Type": "multipart/form-data", Authorization: `Bearer ${TOKEN()}` };
    const hj = { Authorization: `Bearer ${TOKEN()}` };
    axios.post(BASEURL + "entities",         {}, { headers: h }).then(r => setEntities(r.data?.data || []));
    axios.post(BASEURL + "categories",       {}, { headers: h }).then(r => setCategories(r.data?.data || []));
    axios.post(BASEURL + "classifications",  {}, { headers: h }).then(r => setClassifications(r.data?.data || []));
    axios.get(`${BASEURL}v2/projects`,            { headers: hj }).then(r => setProjects(r.data?.data || []));
  }, []);

  // ── Reset page on filter change ───────────────────────────────────────────
  useEffect(() => { setPage(1); },
    [date, entityFilter, projectFilter, categoryFilter, classFilter, searchEmp, searchName]);

  // ── Fetch report ──────────────────────────────────────────────────────────
  const buildParams = useCallback((pg: number, perPage = 25) => {
    const p: Record<string, any> = { from: date, to: date, page: pg, per_page: perPage };
    if (entityFilter   !== "all") p.entity         = entityFilter;
    if (projectFilter  !== "all") p.project        = projectFilter;
    if (categoryFilter !== "all") p.category       = categoryFilter;
    if (classFilter    !== "all") p.classification = classFilter;
    if (searchEmp)  p.search_emp  = searchEmp;
    if (searchName) p.search_name = searchName;
    return p;
  }, [date, entityFilter, projectFilter, categoryFilter, classFilter, searchEmp, searchName]);

  useEffect(() => {
    setLoading(true);
    axios.get(`${BASEURL}v2/reports`, {
      params: buildParams(page),
      headers: { Authorization: `Bearer ${TOKEN()}` },
    }).then(r => {
      setData(r.data?.data || []);
      setMeta(r.data?.meta || { current_page: 1, last_page: 1, per_page: 25, total: 0 });
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [page, buildParams]);

  // ── View details ──────────────────────────────────────────────────────────
  const handleView = async (row: ReportRow) => {
    setViewRow(row);
    setViewData([]);
    setViewOpen(true);
    setViewLoading(true);
    try {
      const r = await axios.get(`${BASEURL}v2/reports/day-details`, {
        params: { emp_id: row.emp_guid, date: row.date },
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      setViewData(r.data?.data?.records || []);
    } catch (e) { console.error(e); }
    finally { setViewLoading(false); }
  };

  // ── Summaries ─────────────────────────────────────────────────────────────
  const totalMinutes = data.reduce((s, r) => {
    if (!r.worked_hours) return s;
    const [h, m] = r.worked_hours.split(":");
    return s + parseInt(h || "0") * 60 + parseInt(m || "0");
  }, 0);
  const presentCount = data.filter(r => r.attendance_status === "Present").length;
  const absentCount  = data.filter(r => r.attendance_status === "Absent").length;

  // ── Export helpers ────────────────────────────────────────────────────────
  const fetchAll = async () => {
    const r = await axios.get(`${BASEURL}v2/reports`, {
      params: buildParams(1, 5000),
      headers: { Authorization: `Bearer ${TOKEN()}` },
    });
    return r.data?.data || [];
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const all = await fetchAll();
      if (!all.length) return;

      // Title rows
      const titleRows = [
        ["ATTENDANCE REPORT"],
        [`Date: ${date}`],
        [`Generated: ${new Date().toLocaleString()}`],
        [], // blank separator
        // Column headers
        [
          "Emp ID", "Employee Name", "Entity", "Category", "Classification",
          "Project Code", "Project Name", "Date", "Check In", "Check Out",
          "Worked Hours", "Attendance Type", "Status",
        ],
      ];

      // Data rows
      const dataRows = all.map((r: ReportRow) => [
        r.emp_id        || "",
        r.employee_name || "",
        r.entityname    || "",
        r.category      || "",
        r.classification|| "",
        r.project_code  || "",
        r.projectname   || "",
        r.date          || "",
        r.checkin       || "",
        r.checkout      || "",
        r.worked_hours  || "",
        r.attendance_type || "",
        r.attendance_status || "",
      ]);

      const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...dataRows]);

      // Column widths
      ws["!cols"] = [
        { wch: 12 }, // Emp ID
        { wch: 28 }, // Employee Name
        { wch: 20 }, // Entity
        { wch: 16 }, // Category
        { wch: 20 }, // Classification
        { wch: 14 }, // Project Code
        { wch: 28 }, // Project Name
        { wch: 12 }, // Date
        { wch: 12 }, // Check In
        { wch: 12 }, // Check Out
        { wch: 14 }, // Worked Hours
        { wch: 18 }, // Attendance Type
        { wch: 14 }, // Status
      ];

      // Merge title cell across all columns
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
      saveAs(
        new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]),
        `Attendance_Report_${date}.xlsx`
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const all = await fetchAll();
      if (!all.length) return;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // Header band
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageW, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ATTENDANCE REPORT", 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${date}`, 14, 17);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 14, 17, { align: "right" });

      // Summary strip
      const present = all.filter((r: ReportRow) => r.attendance_status === "Present").length;
      const absent  = all.filter((r: ReportRow) => r.attendance_status === "Absent").length;
      doc.setFillColor(241, 245, 249);
      doc.rect(0, 22, pageW, 10, "F");
      doc.setTextColor(55, 65, 81);
      doc.setFontSize(8);
      doc.text(`Total: ${all.length}   |   Present: ${present}   |   Absent: ${absent}   |   Others: ${all.length - present - absent}`, 14, 29);

      // Main table
      autoTable(doc, {
        startY: 34,
        head: [[
          "Emp ID", "Employee Name", "Entity", "Category", "Classification",
          "Project", "Date", "Check In", "Check Out", "Worked Hrs", "Type", "Status",
        ]],
        body: all.map((r: ReportRow) => [
          r.emp_id          || "—",
          r.employee_name   || "—",
          r.entityname      || "—",
          r.category        || "—",
          r.classification  || "—",
          r.projectname     ? `${r.projectname}${r.project_code ? ` (${r.project_code})` : ""}` : "—",
          r.date            || "—",
          r.checkin         || "—",
          r.checkout        || "—",
          r.worked_hours    || "—",
          r.attendance_type || "Regular",
          r.attendance_status || "—",
        ]),
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7,
          cellPadding: 3,
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 2.5,
          textColor: [31, 41, 55],
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0:  { cellWidth: 18 },  // Emp ID
          1:  { cellWidth: 36 },  // Employee Name
          2:  { cellWidth: 22 },  // Entity
          3:  { cellWidth: 18 },  // Category
          4:  { cellWidth: 22 },  // Classification
          5:  { cellWidth: 30 },  // Project
          6:  { cellWidth: 20 },  // Date
          7:  { cellWidth: 18 },  // Check In
          8:  { cellWidth: 18 },  // Check Out
          9:  { cellWidth: 18 },  // Worked Hrs
          10: { cellWidth: 16 },  // Type
          11: { cellWidth: 18 },  // Status
        },
        didDrawCell: (data) => {
          // Colour-code the Status column (index 11)
          if (data.section === "body" && data.column.index === 11) {
            const val = String(data.cell.raw || "").toLowerCase();
            if (val === "present") {
              doc.setFillColor(220, 252, 231);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
              doc.setTextColor(21, 128, 61);
              doc.setFontSize(7);
              doc.text(String(data.cell.raw), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
            } else if (val === "absent") {
              doc.setFillColor(254, 226, 226);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
              doc.setTextColor(185, 28, 28);
              doc.setFontSize(7);
              doc.text(String(data.cell.raw), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
            }
          }
        },
        // Page numbers in footer
        didDrawPage: (data) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            pageW - 14,
            doc.internal.pageSize.getHeight() - 6,
            { align: "right" }
          );
        },
        margin: { top: 34, left: 14, right: 14 },
      });

      doc.save(`Attendance_Report_${date}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Attendance" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl" />
        </div>
      )}

      {/* ── Detail modal ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              {viewRow?.employee_name} — {viewRow?.date}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({viewRow?.emp_id})
              </span>
            </DialogTitle>
          </DialogHeader>

          {viewLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading events…
            </div>
          ) : viewData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No records found for this date.</p>
          ) : (
            <div className="space-y-4">
              {viewData.map((rec, i) => {
                const isCheckin  = rec.checkin  !== null;
                const isCheckout = rec.checkout !== null;
                const ciImg = imgUrl(rec.checkin_image);
                const coImg = imgUrl(rec.checkout_image);
                // DB columns are named inversely: checkin_lang holds latitude, checkin_lat holds longitude
                const ciMap = mapsLink(rec.checkin_lang, rec.checkin_lat);
                const coMap = mapsLink(rec.checkout_lang, rec.checkout_lat);

                return (
                  <div key={rec.id} className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
                    {/* Row header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                        {isCheckin && isCheckout ? (
                          <span className="flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <ArrowLeftRight className="h-3 w-3" /> Check-In & Out
                          </span>
                        ) : isCheckin ? (
                          <span className="flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            <LogIn className="h-3 w-3" /> Check-In
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            <LogOut className="h-3 w-3" /> Check-Out
                          </span>
                        )}
                        {rec.attendance_type && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">
                            {rec.attendance_type}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{rec.created_at}</span>
                    </div>

                    {/* Project */}
                    {rec.projectname && (
                      <p className="text-sm font-medium text-gray-700">
                        Project: <span className="text-gray-900">{rec.projectname}</span>
                        {rec.project_code && <span className="text-xs text-muted-foreground ml-1">({rec.project_code})</span>}
                      </p>
                    )}

                    {/* Times + duration */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {isCheckin && (
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <p className="text-xs text-green-600 font-medium mb-0.5">Check-In Time</p>
                          <p className="text-lg font-bold text-green-800">{rec.checkin}</p>
                          {ciMap ? (
                            <a href={ciMap} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                              <MapPin className="h-3 w-3" />
                              {rec.checkin_lang}, {rec.checkin_lat}
                            </a>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> No location
                            </p>
                          )}
                        </div>
                      )}

                      {isCheckout && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs text-red-600 font-medium mb-0.5">Check-Out Time</p>
                          <p className="text-lg font-bold text-red-800">{rec.checkout}</p>
                          {coMap ? (
                            <a href={coMap} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                              <MapPin className="h-3 w-3" />
                              {rec.checkout_lang}, {rec.checkout_lat}
                            </a>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> No location
                            </p>
                          )}
                        </div>
                      )}

                      {rec.worked_hours && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-2">
                          <p className="text-xs text-blue-600 font-medium mb-0.5">Duration</p>
                          <p className="text-lg font-bold text-blue-800">{rec.worked_hours}</p>
                        </div>
                      )}
                    </div>

                    {/* Images */}
                    {(ciImg || coImg) && (
                      <div className="flex gap-3 flex-wrap pt-1">
                        {ciImg && (
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-xs text-muted-foreground font-medium">Check-In Photo</p>
                            <img
                              src={ciImg} alt="Check-In"
                              className="h-24 w-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity shadow"
                              onClick={() => setLightbox(ciImg)}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                        )}
                        {coImg && (
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-xs text-muted-foreground font-medium">Check-Out Photo</p>
                            <img
                              src={coImg} alt="Check-Out"
                              className="h-24 w-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity shadow"
                              onClick={() => setLightbox(coImg)}
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Main page ── */}
      <div className="p-6 space-y-6 bg-muted/10 min-h-screen">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Daily and date-range employee attendance with check-in / check-out details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
              onClick={handleExportExcel} disabled={isExporting || loading}>
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export Excel
            </Button>
            <Button variant="outline"
              className="border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={handleExportPDF} disabled={isExporting || loading}>
              {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary cards */}
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
              <CardTitle className="text-sm font-medium">Present</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
              <p className="text-xs text-muted-foreground">This page</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Absent</CardTitle>
              <Users className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{absentCount}</div>
              <p className="text-xs text-muted-foreground">This page</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.floor(totalMinutes / 60)}h{" "}
                <span className="text-lg text-muted-foreground font-normal">{totalMinutes % 60}m</span>
              </div>
              <p className="text-xs text-muted-foreground">This page</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarRange className="w-4 h-4" /> Filters
            </CardTitle>
          </CardHeader>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Single date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <Input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)} />
              </div>

              {/* Entity — searchable */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Entity</label>
                <Select value={entityFilter} onValueChange={v => { setEntityFilter(v); setEntitySearch(""); }}>
                  <SelectTrigger><SelectValue placeholder="All Entities" /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pt-2 pb-1 sticky top-0 bg-white z-10">
                      <Input
                        placeholder="Search entity…"
                        className="h-7 text-xs"
                        value={entitySearch}
                        onChange={e => setEntitySearch(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="all">All Entities</SelectItem>
                    {entities
                      .filter((e: any) => e.entityname.toLowerCase().includes(entitySearch.toLowerCase()))
                      .map((e: any) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.entityname}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project — searchable */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
                <Select value={projectFilter} onValueChange={v => { setProjectFilter(v); setProjectSearch(""); }}>
                  <SelectTrigger><SelectValue placeholder="All Projects" /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pt-2 pb-1 sticky top-0 bg-white z-10">
                      <Input
                        placeholder="Search project…"
                        className="h-7 text-xs"
                        value={projectSearch}
                        onChange={e => setProjectSearch(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects
                      .filter((p: any) =>
                        p.projectname.toLowerCase().includes(projectSearch.toLowerCase()) ||
                        (p.projectid || "").toLowerCase().includes(projectSearch.toLowerCase())
                      )
                      .map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.projectname} ({p.projectid})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category — searchable */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setCategorySearch(""); }}>
                  <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pt-2 pb-1 sticky top-0 bg-white z-10">
                      <Input
                        placeholder="Search category…"
                        className="h-7 text-xs"
                        value={categorySearch}
                        onChange={e => setCategorySearch(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories
                      .filter((c: any) => c.description.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((c: any, i: number) => (
                        <SelectItem key={i} value={c.code}>{c.description}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Classification — searchable */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Classification</label>
                <Select value={classFilter} onValueChange={v => { setClassFilter(v); setClassSearch(""); }}>
                  <SelectTrigger><SelectValue placeholder="All Classifications" /></SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pt-2 pb-1 sticky top-0 bg-white z-10">
                      <Input
                        placeholder="Search classification…"
                        className="h-7 text-xs"
                        value={classSearch}
                        onChange={e => setClassSearch(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="all">All Classifications</SelectItem>
                    {classifications
                      .filter((c: any) => c.description.toLowerCase().includes(classSearch.toLowerCase()))
                      .map((c: any, i: number) => (
                        <SelectItem key={i} value={c.code}>{c.description}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee ID</label>
                <Input placeholder="Search by emp ID" value={searchEmp}
                  onChange={e => setSearchEmp(e.target.value)} />
              </div>

              {/* Employee Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Employee Name</label>
                <Input placeholder="Search by name" value={searchName}
                  onChange={e => setSearchName(e.target.value)} />
              </div>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="border shadow-sm overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          )}

          {!loading && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-blue-700">
                  <TableRow>
                    <TableHead className="text-white font-semibold">Emp ID</TableHead>
                    <TableHead className="text-white font-semibold">Employee</TableHead>
                    <TableHead className="text-white font-semibold">Entity</TableHead>
                    <TableHead className="text-white font-semibold">Classification</TableHead>
                    <TableHead className="text-white font-semibold">Date</TableHead>
                    <TableHead className="text-white font-semibold">Check In</TableHead>
                    <TableHead className="text-white font-semibold">Check Out</TableHead>
                    <TableHead className="text-white font-semibold text-right">Duration</TableHead>
                    <TableHead className="text-white font-semibold text-center">Status</TableHead>
                    <TableHead className="text-white font-semibold text-center">Details</TableHead>
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
                    data.map((r, i) => (
                      <TableRow key={`${r.emp_guid}-${r.date}-${i}`}
                        className="hover:bg-muted/5 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.emp_id || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900 text-sm">{r.employee_name}</div>
                          {r.category && <div className="text-xs text-muted-foreground">{r.category}</div>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.entityname || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.classification || "—"}</TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">{r.date || "—"}</TableCell>
                        <TableCell className="text-sm text-green-700 font-medium whitespace-nowrap">
                          {r.checkin ? (
                            <span className="flex items-center gap-1">
                              <LogIn className="h-3 w-3" />{r.checkin}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-red-700 font-medium whitespace-nowrap">
                          {r.checkout ? (
                            <span className="flex items-center gap-1">
                              <LogOut className="h-3 w-3" />{r.checkout}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {r.worked_hours || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(r.attendance_status)}`}>
                            {r.attendance_status || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleView(r)}
                            disabled={!r.date || !r.emp_guid}>
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t p-4 bg-muted/5">
            <div className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{meta.current_page}</span> of{" "}
              <span className="font-medium text-foreground">{meta.last_page}</span>
              {" "}·{" "}
              <span className="font-medium text-foreground">{meta.total}</span> total records
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, meta.last_page) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, meta.last_page - 4));
                const pg = start + i;
                return (
                  <Button key={pg} size="sm"
                    variant={pg === page ? "default" : "outline"}
                    className="h-8 w-8 p-0 text-xs"
                    disabled={loading} onClick={() => setPage(pg)}>
                    {pg}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                disabled={page >= meta.last_page || loading} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Reports;
