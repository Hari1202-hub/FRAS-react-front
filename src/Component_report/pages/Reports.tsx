import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  Calendar as CalendarIcon,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2, // Added Loader2 for loading states
} from "lucide-react";
import { ReportFilters } from "@/components/reports/ReportFilters";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import axios from "axios";
import { BASEURL, TOKEN } from "../../app";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Reports = () => {
  const [data, setData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);

  // New state to handle loading during heavy exports
  const [isExporting, setIsExporting] = useState(false);

  const [entityFilter, setEntityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchName, setSearchName] = useState("");

  const handleViewDetails = async (row: any) => {
    try {
      setSelectedRow(row);

      const response = await axios.post(
        BASEURL + "web_report_day_details",
        {
          emp_id: row.emp_id,
          date: row.date,
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN()}`,
          },
        },
      );

      setDetailData(response.data.data.data);
      setDetailModalOpen(true);
    } catch (error) {
      console.error(error);
    }
  };

  const loadData = async () => {
    try {
      const response = await axios.post(
        BASEURL + "web_reports",
        {
          date: startDate || new Date().toISOString().split("T")[0],
          page,
          limit: 100,
          entity: entityFilter,
          category: categoryFilter,
          classification: classificationFilter,
          project: projectFilter,
          search_emp: searchTerm,
          search_name: searchName,
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN()}`,
          },
        },
      );
      const apiData = response.data.data;
      setData(apiData.data);
      setLastPage(apiData.last_page);
      setTotal(apiData.total);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [
    entityFilter,
    categoryFilter,
    classificationFilter,
    projectFilter,
    searchTerm,
    searchName,
    startDate,
  ]);

  useEffect(() => {
    loadData();
  }, [
    page,
    entityFilter,
    categoryFilter,
    classificationFilter,
    projectFilter,
    searchTerm,
    searchName,
    startDate,
  ]);

  const totalMinutes = data.reduce((sum, r) => {
    if (!r.worked_hours) return sum;
    const parts = r.worked_hours.split(":");
    if (parts.length >= 2) {
      return sum + parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return sum;
  }, 0);

  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  // --- NEW: Helper function to fetch all data for export ---
  const fetchAllDataForExport = async () => {
    try {
      const response = await axios.post(
        BASEURL + "web_reports",
        {
          date: startDate || new Date().toISOString().split("T")[0],
          page: 1,
          limit: total > 0 ? total : 20000, // Pass the total count to get everything at once
          entity: entityFilter,
          category: categoryFilter,
          classification: classificationFilter,
          project: projectFilter,
          search_emp: searchTerm,
          search_name: searchName,
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN()}`,
          },
        },
      );
      return response.data.data.data;
    } catch (error) {
      console.error("Failed to fetch export data", error);
      return [];
    }
  };

  // --- UPDATED: Export functions now fetch all data first ---
  const handleExportExcel = async () => {
    setIsExporting(true);
    const allData = await fetchAllDataForExport();

    if (allData.length > 0) {
      // Map the raw data to format the Excel columns and map login_emp_id
      const formattedData = allData.map((r: any) => ({
        "Emp ID": r.login_emp_id || "",
        Name: r.employee_name || "",
        Entity: r.entityname || "",
        Category: r.category || "",
        Classification: r.classification || "",
        Project: r.projectname || "",
        Date: r.date || "",
        "Check In": r.checkin || "",
        "Check Out": r.checkout || "",
        Hours: r.worked_hours || "",
        Status: r.status || "",
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([buffer]),
        `Attendance_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    }
    setIsExporting(false);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const allData = await fetchAllDataForExport();

    if (allData.length > 0) {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.text("Employee Attendance Report", 40, 40);
      autoTable(doc, {
        startY: 60,
        head: [
          [
            "Emp ID",
            "Name",
            "Entity",
            "Category",
            "Classification",
            "Project",
            "Date",
            "CheckIn",
            "CheckOut",
            "Hours",
            "Status",
          ],
        ],
        body: allData.map((r: any) => [
          r.login_emp_id || "",
          r.employee_name || "",
          r.entityname || "",
          r.category || "",
          r.classification || "",
          r.projectname || "",
          r.date || "",
          r.checkin || "",
          r.checkout || "",
          r.worked_hours || "",
          r.status || "",
        ]),
        styles: { fontSize: 8 },
      });
      doc.save(`Attendance_${new Date().toISOString().split("T")[0]}.pdf`);
    }
    setIsExporting(false);
  };

  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s.includes("present") || s.includes("check"))
      return "bg-green-100 text-green-700 border-green-200";
    if (s.includes("absent") || s.includes("leave"))
      return "bg-red-100 text-red-700 border-red-200";
    if (s.includes("holiday") || s.includes("week"))
      return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  return (
    <>
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Attendance Details - {selectedRow?.employee_name}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {detailData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  detailData.map((item: any, index: number) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.checkin || "-"}</TableCell>
                      <TableCell>{item.checkout || "-"}</TableCell>
                      <TableCell>{item.project_id || "-"}</TableCell>
                      <TableCell>{item.created_at}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <div className="p-6 space-y-8 bg-muted/10 min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Attendance Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and export detailed employee attendance records.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* UPDATED: Buttons disable and show a spinner while exporting */}
            <Button
              variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
              onClick={handleExportExcel}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export Excel
            </Button>

            <Button
              variant="outline"
              className="border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Employees
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{total}</div>
              <p className="text-xs text-muted-foreground">
                Records found based on filters
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalHours}h{" "}
                <span className="text-lg text-muted-foreground font-normal">
                  {totalMins}m
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cumulative worked time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Date Selected
              </CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{startDate || "Today"}</div>
              <p className="text-xs text-muted-foreground">Reporting period</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Search className="w-4 h-4" /> Filter Records
            </CardTitle>
          </CardHeader>
          <div className="p-4">
            <ReportFilters
              startDate={startDate}
              setStartDate={setStartDate}
              entityFilter={entityFilter}
              setEntityFilter={setEntityFilter}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              classificationFilter={classificationFilter}
              setClassificationFilter={setClassificationFilter}
              projectFilter={projectFilter}
              setProjectFilter={setProjectFilter}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              searchName={searchName}
              setSearchName={setSearchName}
            />
          </div>
        </Card>

        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[100px]">Emp ID</TableHead>
                  <TableHead className="min-w-[150px]">Employee</TableHead>
                  <TableHead className="min-w-[120px]">Project</TableHead>
                  <TableHead className="min-w-[120px]">Entity</TableHead>
                  <TableHead className="min-w-[100px]">Category</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="text-right">Check In</TableHead>
                  <TableHead className="text-right">Check Out</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-center w-[120px]">
                    Status
                  </TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No records found for the selected criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((r, i) => (
                    <TableRow
                      key={`${r.login_emp_id}-${i}`}
                      className="hover:bg-muted/5 transition-colors"
                    >
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {r.login_emp_id || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {r.employee_name || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-700">
                          {r.projectname || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {r.entityname || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {r.category || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.classification || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {r.date || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-700">
                        {r.checkin || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-700">
                        {r.checkout || "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {r.worked_hours || "00:00"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(r.status)}`}
                        >
                          {r.status || "Absent"}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(r)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t p-4 bg-muted/5">
            <div className="text-sm text-muted-foreground">
              Showing page{" "}
              <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{lastPage}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page === lastPage}
                onClick={() => setPage(page + 1)}
                className="h-8 w-8 p-0"
              >
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
