
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Eye, Search, Filter, UserCog, KeyRound } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ResetPasswordDialog } from "@/components/role-mapping/ResetPasswordDialog";
import { EmployeeDetailModal } from "@/components/employees/EmployeeDetailModal";
import { MultiRoleUpdateDialog } from "@/components/role-mapping/MultiRoleUpdateDialog";
import axios from "axios";
import { BASEURL, TOKEN } from "../../../app";
import { useNavigate } from "react-router-dom";

const PER_PAGE = 25;

const AssignedEmployees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [meta, setMeta] = useState({ total: 0, last_page: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [enrolledFilter, setEnrolledFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [updateRoleDialogOpen, setUpdateRoleDialogOpen] = useState(false);
  const [removeRoleDialogOpen, setRemoveRoleDialogOpen] = useState(false);
  const [employeeToRemoveRole, setEmployeeToRemoveRole] = useState(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [employeeForPasswordReset, setEmployeeForPasswordReset] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [entities, setEntities] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const authHeaders = { Authorization: `Bearer ${TOKEN()}` };

  const loadRoles = () =>
    axios.post(`${BASEURL}roles`, {}, { headers: authHeaders })
      .then(r => setAvailableRoles(r.data.data))
      .catch(err => { console.error("Error loading roles:", err); navigate("/login"); });

  const loadEntities = () =>
    axios.post(`${BASEURL}entities`, {}, { headers: authHeaders })
      .then(r => setEntities(r.data.data));

  const loadClassifications = () =>
    axios.post(`${BASEURL}classifications`, {}, { headers: authHeaders })
      .then(r => setClassifications(r.data.data));

  const loadEmployees = (page = 1) => {
    setLoading(true);
    const params: Record<string, unknown> = { has_role: 1, per_page: PER_PAGE, page };
    if (searchTerm)                      params.search         = searchTerm;
    if (statusFilter !== "all")          params.status         = statusFilter;
    if (entityFilter !== "all")          params.entity         = entityFilter;
    if (classificationFilter !== "all")  params.classification = classificationFilter;
    if (enrolledFilter === "1")          params.enrolled       = 1;
    else if (enrolledFilter === "2")     params.enrolled       = 0;

    axios.get(`${BASEURL}v2/staff`, { headers: authHeaders, params })
      .then(res => {
        setEmployees(res.data.data);
        setMeta(res.data.meta);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, entityFilter, classificationFilter, enrolledFilter]);
  useEffect(() => { loadEmployees(currentPage); }, [currentPage, searchTerm, statusFilter, entityFilter, classificationFilter, enrolledFilter]);
  useEffect(() => { loadRoles(); loadEntities(); loadClassifications(); }, []);

  // Client-side role filter (roles are a small set, server already filtered has_role=1)
  const visibleEmployees = roleFilter === "all"
    ? employees
    : employees.filter(emp => emp.roles?.some(r => String(r.id) === roleFilter));

  const handleEmployeeView  = (emp) => { setSelectedEmployee(emp); setViewModalOpen(true); };
  const handleUpdateRoles   = (emp) => { setSelectedEmployee(emp); setUpdateRoleDialogOpen(true); };
  const handleResetPassword = (emp) => { setEmployeeForPasswordReset(emp); setResetPasswordDialogOpen(true); };
  const openRemoveRoleDialog = (emp) => { setEmployeeToRemoveRole(emp); setRemoveRoleDialogOpen(true); };

  const handleRemoveAllRoles = () => {
    if (!employeeToRemoveRole) return;
    setEmployees(prev => prev.filter(e => e.id !== employeeToRemoveRole.id));
    toast({ title: "All Roles Removed", description: `${employeeToRemoveRole.name} moved to Unassigned Employees.` });
    setRemoveRoleDialogOpen(false);
  };

  const handleRolesAssigned = () => loadEmployees(currentPage);

  const start = (currentPage - 1) * PER_PAGE + 1;
  const end   = Math.min(currentPage * PER_PAGE, meta.total);

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-proscape"
              placeholder="Search by name or employee ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "160px" }}
            />
          </div>
          <div className="flex flex-col md:flex-row gap-4 md:items-center flex-wrap">
            <div className="flex items-center">
              <Filter className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600 mr-2">Role:</span>
              <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-proscape" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: "120px" }}>
                <option value="all">All Roles</option>
                {availableRoles.map((role, i) => <option key={i} value={role.id}>{role.rolename}</option>)}
              </select>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Status:</span>
              <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-proscape" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Enrolled:</span>
              <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-proscape" value={enrolledFilter} onChange={(e) => setEnrolledFilter(e.target.value)} style={{ width: "120px" }}>
                <option value="">All</option>
                <option value="1">Enrolled</option>
                <option value="2">Not Enrolled</option>
              </select>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Entity:</span>
              <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-proscape" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ maxWidth: "120px" }}>
                <option value="all">All</option>
                {entities.map((e, i) => <option key={i} value={e.id}>{e.entityname}</option>)}
              </select>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Classification:</span>
              <select className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-proscape" value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)} style={{ maxWidth: "120px" }}>
                <option value="all">All</option>
                {classifications.map((c, i) => <option key={i} value={c.code}>{c.description}</option>)}
              </select>
            </div>
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
                <TableHead>Assigned Roles</TableHead>
                <TableHead>Assigned Project</TableHead>
                <TableHead>Login Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-gray-500">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900" />
                      <span>Loading employees...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : visibleEmployees.length > 0 ? (
                visibleEmployees.map((employee, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{employee.user?.emp_id}</TableCell>
                    <TableCell>{employee.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={employee.entities?.entityname}>
                      {employee.entities?.entityname}
                    </TableCell>
                    <TableCell>{employee.classifications?.description}</TableCell>
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
                    <TableCell>{employee.loginmethod_code ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={employee.isactive
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-red-100 text-red-800 hover:bg-red-200"}>
                        {employee.isactive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-3">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={() => handleUpdateRoles(employee)} className="text-blue-500 hover:text-blue-700 p-1">
                                <UserCog className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Update Roles</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={() => handleResetPassword(employee)} className="text-orange-500 hover:text-orange-700 p-1">
                                <KeyRound className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Reset Password</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-gray-500">
                    No assigned employees found matching the search criteria
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
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50" onClick={() => setCurrentPage(p => Math.min(p + 1, meta.last_page))} disabled={currentPage === meta.last_page}>Next</button>
          </div>
        </div>
      </Card>

      <MultiRoleUpdateDialog
        open={updateRoleDialogOpen}
        onOpenChange={setUpdateRoleDialogOpen}
        employee={selectedEmployee}
        availableRoles={availableRoles}
        onUpdateRoles={handleRolesAssigned}
        onRemoveAllRoles={() => openRemoveRoleDialog(selectedEmployee)}
      />

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        employee={employeeForPasswordReset}
        onPasswordReset={() => {}}
      />

      <AlertDialog open={removeRoleDialogOpen} onOpenChange={setRemoveRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove All Roles</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all roles from {employeeToRemoveRole?.name}? They will be moved to Unassigned Employees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAllRoles} className="bg-red-500 hover:bg-red-600">
              Remove All Roles
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EmployeeDetailModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        employee={selectedEmployee}
      />
    </div>
  );
};

export default AssignedEmployees;
