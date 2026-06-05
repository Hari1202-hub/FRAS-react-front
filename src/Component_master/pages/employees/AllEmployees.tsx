
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Eye, Search, Filter } from "lucide-react";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import FaceEnrollmentModal from "../../components/FaceEnrollmentModal";
import { EmployeeDetailModal } from "@/components/employees/EmployeeDetailModal";
import axios from "axios";
import { BASEURL, TOKEN } from "../../../app";

const PER_PAGE = 25;

const AllEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, current_page: 1 });
  const [entities, setEntities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [enrolledFilter, setEnrolledFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [selectedFaceEmployee, setSelectedFaceEmployee] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const authHeaders = { Authorization: `Bearer ${TOKEN()}` };

  const loadEmployees = (page = 1) => {
    setLoading(true);
    const params: Record<string, unknown> = { per_page: PER_PAGE, page };
    if (searchTerm)                        params.search         = searchTerm;
    if (statusFilter !== "all")            params.status         = statusFilter;
    if (categoryFilter !== "all")          params.category       = categoryFilter;
    if (entityFilter !== "all")            params.entity         = entityFilter;
    if (classificationFilter !== "all")    params.classification = classificationFilter;
    if (enrolledFilter === "1")            params.enrolled       = 1;
    else if (enrolledFilter === "2")       params.enrolled       = 0;

    axios.get(`${BASEURL}v2/staff`, { headers: authHeaders, params })
      .then(res => {
        setEmployees(res.data.data);
        setMeta(res.data.meta);
      })
      .finally(() => setLoading(false));
  };

  const loadEntities = () =>
    axios.post(`${BASEURL}entities`, {}, { headers: authHeaders })
      .then(r => setEntities(r.data.data));

  const loadCategories = () =>
    axios.post(`${BASEURL}categories`, {}, { headers: authHeaders })
      .then(r => setCategories(r.data.data));

  const loadClassifications = () =>
    axios.post(`${BASEURL}classifications`, {}, { headers: authHeaders })
      .then(r => setClassifications(r.data.data));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter, entityFilter, classificationFilter, enrolledFilter]);

  useEffect(() => {
    loadEmployees(currentPage);
  }, [currentPage, searchTerm, statusFilter, categoryFilter, entityFilter, classificationFilter, enrolledFilter]);

  useEffect(() => {
    loadEntities();
    loadCategories();
    loadClassifications();
  }, []);

  const handleEmployeeView = (employee) => {
    setSelectedEmployee(employee);
    setViewModalOpen(true);
  };

  const start = (currentPage - 1) * PER_PAGE + 1;
  const end   = Math.min(currentPage * PER_PAGE, meta.total);

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden">
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 space-y-3">
          {/* Row 1: search + status + enrolled */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-proscape bg-white"
                placeholder="Search by name or employee ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
            </div>

            {/* Status */}
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">Status</label>
              <select
                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-proscape bg-white min-w-[100px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>

            {/* Enrolled */}
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">Enrolled</label>
              <select
                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-proscape bg-white min-w-[110px]"
                value={enrolledFilter}
                onChange={(e) => setEnrolledFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="1">Enrolled</option>
                <option value="2">Not Enrolled</option>
              </select>
            </div>

            {/* Entity — searchable */}
            <SearchableSelect
              label="Entity"
              value={entityFilter}
              onChange={setEntityFilter}
              options={entities.map((e) => ({ value: String(e.id), label: e.entityname }))}
            />

            {/* Category — searchable */}
            <SearchableSelect
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categories.map((c) => ({ value: c.code, label: c.description }))}
            />

            {/* Classification — searchable */}
            <SearchableSelect
              label="Classification"
              value={classificationFilter}
              onChange={setClassificationFilter}
              options={classifications.map((c) => ({ value: c.code, label: c.description }))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Assigned Roles</TableHead>
                <TableHead>Assigned Project</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-6 text-gray-500">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900" />
                      <span>Loading employees...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees.length > 0 ? (
                employees.map((employee, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{employee.user?.emp_id}</TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={employee.entities?.entityname}>
                      {employee.entities?.entityname}
                    </TableCell>
                    <TableCell>{employee.classifications?.description}</TableCell>
                    <TableCell>{employee.categories?.description}</TableCell>
                    <TableCell>
                      {employee.roles && employee.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {employee.roles.map((role, j) => (
                            <Badge key={j} className="bg-green-100 text-green-800 hover:bg-green-200">
                              {role.rolename}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No Roles</span>
                      )}
                    </TableCell>
                    <TableCell>{employee.project?.projectname ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={employee.is_enrolled
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"}>
                        {employee.is_enrolled ? "Enrolled" : "Not Enrolled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={employee.isactive
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-red-100 text-red-800 hover:bg-red-200"}>
                        {employee.isactive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => handleEmployeeView(employee)} className="text-blue-500 hover:text-blue-700 p-1">
                              <Eye className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p>View Employee Details</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-6 text-gray-500">
                    No employees found matching the search criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-700">
            {meta.total > 0 ? (
              <>Showing <span className="font-medium">{start}–{end}</span> of <span className="font-medium">{meta.total}</span> employees</>
            ) : (
              <>0 employees</>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >Previous</button>
            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setCurrentPage(p => Math.min(p + 1, meta.last_page))}
              disabled={currentPage === meta.last_page}
            >Next</button>
          </div>
        </div>
      </Card>

      {selectedFaceEmployee && (
        <FaceEnrollmentModal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          employeeName={selectedFaceEmployee.name}
          employeeId={selectedFaceEmployee.id}
          isUpdate={selectedFaceEmployee.hasFaceEnrolled}
        />
      )}

      <EmployeeDetailModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        employee={selectedEmployee}
      />
    </div>
  );
};

export default AllEmployees;
