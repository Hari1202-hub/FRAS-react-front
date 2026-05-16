import { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, CloudDownload, Search, Filter, FileDown } from "lucide-react";
import { BASEURL, TOKEN } from "../../app";
import { mockTanseeqEmployees } from "./tanseeq-mock-data";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import * as XLSX from "xlsx";

interface TanseeqImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (employees: typeof mockTanseeqEmployees) => void;
}

export function TanseeqImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: TanseeqImportModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedEmployees, setFetchedEmployees] = useState(null);
  const [uploadedEmployees, setUploadedEmployees] = useState<
    typeof mockTanseeqEmployees | null
  >(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Filter states
  const [employeeId, setEmployeeId] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [entityOptions, setEntityOptions] = useState<string[]>([]);
  const [classificationOptions, setClassificationOptions] = useState<string[]>(
    [],
  );
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  const handleFetch = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setFetchedEmployees(mockTanseeqEmployees);
      setSelectedEmployees(new Set(mockTanseeqEmployees.map((emp) => emp.id)));
      setIsLoading(false);
    }, 2000);
  };

  // Apply filters to the fetched employees
  const applyFilters = () => {
    if (!fetchedEmployees) return [];

    return fetchedEmployees.filter((employee) => {
      const employeeIdMatch = employeeId
        ? employee.employeeId.toLowerCase().includes(employeeId.toLowerCase())
        : true;

      const nameMatch = nameFilter
        ? employee.name.toLowerCase().includes(nameFilter.toLowerCase())
        : true;

      const entityMatch =
        entityFilter !== "all" ? employee.entity === entityFilter : true;

      const classificationMatch =
        classificationFilter !== "all"
          ? employee.classification === classificationFilter
          : true;

      const categoryMatch =
        categoryFilter !== "all" ? employee.category === categoryFilter : true;

      const statusMatch =
        statusFilter !== "all" ? employee.status === statusFilter : true;

      return (
        employeeIdMatch &&
        nameMatch &&
        entityMatch &&
        classificationMatch &&
        categoryMatch &&
        statusMatch
      );
    });
  };

  // Get filtered employees
  const filteredEmployees = fetchedEmployees ? applyFilters() : [];

  const handleClearFilters = () => {
    setEmployeeId("");
    setNameFilter("");
    setEntityFilter("all");
    setClassificationFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const handleImport = () => {
    if (fetchedEmployees) {
      const selectedRecords = fetchedEmployees.filter((emp) =>
        selectedEmployees.has(emp.id),
      );
      onImportComplete(selectedRecords);
      // toast({
      //   title: "Import Successful",
      //   description: `Successfully imported ${selectedRecords.length} employees from Tanseeq.`,
      // });
      onOpenChange(false);
    }
  };

  const toggleSelectAll = () => {
    if (filteredEmployees.length > 0) {
      if (selectedEmployees.size === filteredEmployees.length) {
        // Deselect all filtered employees
        const newSelected = new Set(selectedEmployees);
        filteredEmployees.forEach((emp) => {
          newSelected.delete(emp.id);
        });
        setSelectedEmployees(newSelected);
      } else {
        // Select all filtered employees
        const newSelected = new Set(selectedEmployees);
        filteredEmployees.forEach((emp) => {
          newSelected.add(emp.id);
        });
        setSelectedEmployees(newSelected);
      }
    }
  };

  const toggleEmployee = (id: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployees(newSelected);
  };

  // Check if all currently filtered employees are selected
  const areAllFilteredSelected = () => {
    if (filteredEmployees.length === 0) return false;
    return filteredEmployees.every((emp) => selectedEmployees.has(emp.id));
  };

  const getUniqueOptions = <T, K extends keyof T>(
    data: T[] | null,
    key: K,
  ): string[] => {
    if (!data) return [];
    return Array.from(new Set(data.map((item) => String(item[key]))));
  };

  const downloadTemplate = async () => {
    try {
      const res = await axios.get(`${BASEURL}v2/templates/employees`, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "employees_import_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: "Failed to download template", variant: "destructive" });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);

    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, {
        defval: "",
      });

      if (!jsonData.length) {
        toast({
          title: "Invalid File",
          description: "The uploaded file is empty.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const errors: string[] = [];

      const employeeIdSet = new Set<string>();
      const duplicateRows: number[] = [];

      const normalizeRow = (row: any) => {
        const normalized: any = {};
        Object.keys(row).forEach((key) => {
          normalized[key.trim()] = row[key];
        });
        return normalized;
      };

      console.log(jsonData);

      const mappedEmployees = jsonData.map((rawRow, index) => {
        const row = normalizeRow(rawRow);

        // console.log(row);

        const employeeId = row["Employee Id"]?.toString().trim() || "";
        const fullName = row["Full Name"]?.toString().trim() || "";
        const entity = row["Entity"]?.toString().trim() || "";
        const classification = row["Classification"]?.toString().trim() || "";
        const category = row["Category"]?.toString().trim() || "";
        const status = row["Status"]?.toString().trim() || "";
        const emailFromFile = row["Email"]?.toString().trim() || "";
        const contactNumber = row["Contact Number"]?.toString().trim() || "";

        if (!employeeId || !fullName || !classification || !category) {
          errors.push(`Row ${index + 2} is missing required fields.`);
        }

        // duplicate check
        if (employeeIdSet.has(employeeId)) {
          duplicateRows.push(index + 2);
        } else {
          employeeIdSet.add(employeeId);
        }

        const generatedEmail = fullName
          ? fullName.toLowerCase().replace(/\s+/g, ".") + "@tanseeq.ae"
          : "";

        return {
          id: String(index + 1),
          employeeId,
          name: fullName,
          entity,
          classification,
          category,
          status,
          email: emailFromFile || generatedEmail,
          contactNumber,
        };
      });

      if (errors.length > 0) {
        toast({
          title: "Validation Error",
          description: `${errors.length} row(s) are missing required fields (Employee Id, Full Name, Category, Classification).`,
          variant: "destructive",
        });

        setIsLoading(false);
        return;
      }

      if (duplicateRows.length > 0) {
        toast({
          title: "Duplicate Employee IDs Found",
          description: `Duplicate Employee Id found in row(s): ${duplicateRows.join(
            ", ",
          )}. Each Employee Id must be unique.`,
          variant: "destructive",
        });

        setIsLoading(false);
        return;
      }

      setFetchedEmployees(mappedEmployees);
      const entityOptions = getUniqueOptions(mappedEmployees, "entity");
      const classificationOptions = getUniqueOptions(
        mappedEmployees,
        "classification",
      );
      const categoryOptions = getUniqueOptions(mappedEmployees, "category");

      const statusOptions = getUniqueOptions(mappedEmployees, "status");
      setEntityOptions(entityOptions);
      setClassificationOptions(classificationOptions);
      setCategoryOptions(categoryOptions);
      setStatusOptions(statusOptions);
      setSelectedEmployees(new Set(mappedEmployees.map((emp) => emp.id)));
      setIsLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Employees</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Click below to upload the latest employee data from the Tanseeq
            system.
          </p>

          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-3 rounded mb-4">
            Warning: If email IDs of any record exist in this system, The
            records will be skipped during import.
          </div>

          {!fetchedEmployees && (
            <div className="flex flex-col items-center gap-3">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                id="excelUpload"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                onClick={() => document.getElementById("excelUpload")?.click()}
                className="bg-proscape hover:bg-proscape-dark"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing, Please Wait...
                  </>
                ) : (
                  <>
                    <CloudDownload className="mr-2 h-4 w-4" />
                    Upload Excel / CSV File
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="text-proscape border-proscape hover:bg-proscape/10"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download Sample Template
              </Button>
            </div>
          )}

          {fetchedEmployees && (
            <>
              <div className="overflow-x-hidden">
                {/* Filter Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center mb-4">
                    <Filter className="h-5 w-5 text-gray-500 mr-2" />
                    <h3 className="text-sm font-medium">Filter Employees</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Employee ID Filter */}
                    <div>
                      <Label htmlFor="employeeId" className="text-xs mb-1">
                        Employee ID
                      </Label>
                      <Input
                        id="employeeId"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="Enter employee ID"
                        className="h-9"
                      />
                    </div>

                    {/* Name Filter */}
                    <div>
                      <Label htmlFor="name" className="text-xs mb-1">
                        Name
                      </Label>
                      <Input
                        id="name"
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        placeholder="Search by name"
                        className="h-9"
                      />
                    </div>

                    {/* Entity Filter */}
                    <div>
                      <Label htmlFor="entity" className="text-xs mb-1">
                        Entity
                      </Label>
                      <Select
                        value={entityFilter}
                        onValueChange={setEntityFilter}
                      >
                        <SelectTrigger id="entity" className="h-9">
                          <SelectValue placeholder="Select entity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Entities</SelectItem>
                          {entityOptions.map((entity) => (
                            <SelectItem key={entity} value={entity}>
                              {entity}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Classification Filter */}
                    <div>
                      <Label htmlFor="classification" className="text-xs mb-1">
                        Classification
                      </Label>
                      <Select
                        value={classificationFilter}
                        onValueChange={setClassificationFilter}
                      >
                        <SelectTrigger id="classification" className="h-9">
                          <SelectValue placeholder="Select classification" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            All Classifications
                          </SelectItem>
                          {classificationOptions.map((classification) => (
                            <SelectItem
                              key={classification}
                              value={classification}
                            >
                              {classification}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <Label htmlFor="category" className="text-xs mb-1">
                        Category
                      </Label>
                      <Select
                        value={categoryFilter}
                        onValueChange={setCategoryFilter}
                      >
                        <SelectTrigger id="category" className="h-9">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categoryOptions.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status Filter */}
                    <div>
                      <Label htmlFor="status" className="text-xs mb-1">
                        Status
                      </Label>
                      <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                      >
                        <SelectTrigger id="status" className="h-9">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearFilters}
                    >
                      Clear Filters
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-proscape text-white hover:bg-proscape-dark"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>

                {/* Table Selection Controls */}
                <div className="flex justify-between items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="selectAll"
                      checked={areAllFilteredSelected()}
                      onCheckedChange={toggleSelectAll}
                      className="border-proscape data-[state=checked]:bg-proscape"
                    />
                    <label
                      htmlFor="selectAll"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Select All
                    </label>
                  </div>

                  <span className="text-sm text-gray-500">
                    Showing {filteredEmployees.length} of{" "}
                    {fetchedEmployees.length} employees
                  </span>
                </div>

                {/* Employee Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3">
                            Select
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Employee ID
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Name
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Entity
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Classification
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Category
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.length > 0 ? (
                          filteredEmployees.map((employee) => (
                            <tr
                              key={employee.id}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="px-4 py-3">
                                <Checkbox
                                  checked={selectedEmployees.has(employee.id)}
                                  onCheckedChange={() =>
                                    toggleEmployee(employee.id)
                                  }
                                  className="border-proscape data-[state=checked]:bg-proscape"
                                />
                              </td>
                              <td className="px-4 py-3">
                                {employee.employeeId}
                              </td>
                              <td className="px-4 py-3">{employee.name}</td>
                              <td className="px-4 py-3">{employee.entity}</td>
                              <td className="px-4 py-3">
                                {employee.classification}
                              </td>
                              <td className="px-4 py-3">{employee.category}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs ${
                                    employee.status === "Active"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {employee.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-6 text-center text-gray-500"
                            >
                              No employees found matching the filter criteria
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={selectedEmployees.size === 0}
                    className="bg-proscape hover:bg-proscape-dark"
                  >
                    Import Selected ({selectedEmployees.size})
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
