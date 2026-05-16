import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

import { Input } from "@/components/ui/input";
import { Upload, Loader2, Filter, FileSpreadsheet, X, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils"; // Assuming shadcn utility
import { BASEURL, TOKEN } from "../../app";

interface ImportProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (projects: any[]) => void;
}

export default function ImportProjectsModal({
  isOpen,
  onClose,
  onImport,
}: ImportProjectsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<any[] | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setProjects(null);
    setSelectedProjects(new Set());
    setSearchTerm("");
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen]);

  const { toast } = useToast();

  const downloadTemplate = async () => {
    try {
      const res = await axios.get(`${BASEURL}v2/templates/projects`, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "projects_import_template.xlsx";
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
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

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

      const mappedProjects = jsonData.map((row, index) => {
        const projectId = row["Project ID"];
        const name = row["Project Name"];
        const referenceId = row["Reference ID"];

        if (!projectId || !name || !referenceId) {
          errors.push(`Row ${index + 2} is missing required fields.`);
        }

        return {
          id: String(index + 1),
          entity: row["Entity"],
          projectId: row["Project ID"],
          name: row["Project Name"],
          location: row["Location"],
          startDate: row["Start Date"],
          endDate: row["End Date"],
          status: row["Status"] || "Active",
          reference_id: row["Reference ID"],
          coordinates: row["Coordinates"],
        };
      });

      if (errors.length > 0) {
        toast({
          title: "Validation Error",
          description: `${errors.length} row(s) have missing required fields (Project ID, Project Name, Reference ID).`,
          variant: "destructive",
        });

        setIsLoading(false);
        return;
      }

      setProjects(mappedProjects);
      setSelectedProjects(new Set(mappedProjects.map((p) => p.id)));
      setIsLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  const filteredProjects =
    projects?.filter(
      (p) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.projectId
          ?.toString()
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
    ) || [];

  const toggleProject = (id: string) => {
    const updated = new Set(selectedProjects);
    updated.has(id) ? updated.delete(id) : updated.add(id);
    setSelectedProjects(updated);
  };

  const toggleSelectAll = () => {
    if (!projects) return;
    const updated = new Set(selectedProjects);
    if (
      filteredProjects.length > 0 &&
      filteredProjects.every((p) => selectedProjects.has(p.id))
    ) {
      filteredProjects.forEach((p) => updated.delete(p.id));
    } else {
      filteredProjects.forEach((p) => updated.add(p.id));
    }
    setSelectedProjects(updated);
  };

  const handleImport = () => {
    if (!projects) return;
    const selected = projects.filter((p) => selectedProjects.has(p.id));
    onImport(selected);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-proscape" />
            Import Projects
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to bulk import project data into your
            workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {!projects ? (
            /* Enhanced Upload Area */
            <div className="space-y-3">
              <div
                onClick={() => !isLoading && fileInputRef.current?.click()}
                className={cn(
                  "group relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer",
                  isLoading
                    ? "bg-gray-50 border-gray-200"
                    : "hover:border-proscape hover:bg-proscape/5 border-gray-300",
                )}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <div className="bg-proscape/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  {isLoading ? (
                    <Loader2 className="h-8 w-8 text-proscape animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 text-proscape" />
                  )}
                </div>

                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">
                    {isLoading
                      ? "Processing your file..."
                      : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Excel (.xlsx, .xls) or CSV files
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                  className="text-proscape border-proscape hover:bg-proscape/10"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download Sample Template
                </Button>
              </div>
            </div>
          ) : (
            /* Preview State */
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by Name or ID..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm font-medium">
                  <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                    <Checkbox
                      id="select-all"
                      checked={
                        filteredProjects.length > 0 &&
                        filteredProjects.every((p) =>
                          selectedProjects.has(p.id),
                        )
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                    <label
                      htmlFor="select-all"
                      className="cursor-pointer select-none"
                    >
                      Select All
                    </label>
                  </div>
                  <span className="text-gray-500">
                    {selectedProjects.size} of {projects.length} selected
                  </span>
                </div>
              </div>

              {/* Scrollable Table Container */}
              <div className="border rounded-xl border-separate border-spacing-0 overflow-hidden bg-white">
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="w-[50px] px-4 py-3 border-b"></th>
                        <th className="px-4 py-3 border-b font-semibold text-gray-600">
                          Project ID
                        </th>
                        <th className="px-4 py-3 border-b font-semibold text-gray-600">
                          Name
                        </th>
                        <th className="px-4 py-3 border-b font-semibold text-gray-600">
                          Entity
                        </th>
                        <th className="px-4 py-3 border-b font-semibold text-gray-600">
                          Location
                        </th>
                        <th className="px-4 py-3 border-b font-semibold text-gray-600">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredProjects.map((project) => (
                        <tr
                          key={project.id}
                          className={cn(
                            "hover:bg-gray-50/80 transition-colors",
                            selectedProjects.has(project.id)
                              ? "bg-proscape/5"
                              : "",
                          )}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedProjects.has(project.id)}
                              onCheckedChange={() => toggleProject(project.id)}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {project.projectId}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {project.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {project.entity}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {project.location}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                project.status === "Active"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-amber-100 text-amber-700",
                              )}
                            >
                              {project.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredProjects.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center">
                      <Filter className="h-10 w-10 text-gray-300 mb-2" />
                      <p className="text-gray-500">
                        No projects match your search filters
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => (projects ? resetState() : onClose())}
          >
            {projects ? "Start Over" : "Cancel"}
          </Button>
          <div className="flex gap-3">
            {projects && (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedProjects.size === 0}
                  className="bg-proscape hover:bg-proscape-dark min-w-[140px]"
                >
                  Import {selectedProjects.size}{" "}
                  {selectedProjects.size === 1 ? "Project" : "Projects"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
