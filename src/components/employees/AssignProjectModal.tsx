import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASEURL, TOKEN } from "../../app";
import { toast } from "@/hooks/use-toast";
import { Search, X } from "lucide-react";

interface AssignProjectModalProps {
  openProject: boolean;
  onOpenProjectChange: (open: boolean) => void;
  selectEmployee: any;
  onProjectAssigned: () => void;
  projectId: any;
  assignedId: any;
}

export function AssignProjectModal({
  openProject,
  onOpenProjectChange,
  selectEmployee,
  onProjectAssigned,
  projectId,
  assignedId,
}: AssignProjectModalProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadProjects = () => {
    axios
      .get(`${BASEURL}v2/projects?all=1&active=1`, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      })
      .then((response) => setProjects(response.data.data));
  };

  useEffect(() => {
    if (openProject) {
      setSelectedProject(assignedId ? projectId : null);
      setSelectedLabel("");
      setSearch("");
      loadProjects();
    }
  }, [openProject]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.projectid?.toLowerCase().includes(q) ||
      p.projectname?.toLowerCase().includes(q)
    );
  });

  const handleSelect = (project: any) => {
    setSelectedProject(project.id.toString());
    setSelectedLabel(`${project.projectid} — ${project.projectname}`);
    setSearch("");
    setDropdownOpen(false);
  };

  const handleClear = () => {
    setSelectedProject(null);
    setSelectedLabel("");
    setSearch("");
  };

  const handleAssign = () => {
    if (!selectedProject || !selectEmployee?.guid) {
      toast({ title: "Please select a project.", variant: "destructive" });
      return;
    }
    axios
      .post(
        BASEURL + "assign_project",
        { project_id: selectedProject, user_id: selectEmployee.id, assigned_id: assignedId },
        { headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${TOKEN()}` } },
      )
      .then((response) => {
        if (response.data.status === 200) {
          setSelectedProject(null);
          setSelectedLabel("");
          onOpenProjectChange(false);
          onProjectAssigned();
          toast({ title: "Project Assigned", description: "Project assigned successfully." });
        } else {
          toast({ title: "Error", description: response.data.message?.error_msg ?? "Assignment failed.", variant: "destructive" });
        }
      });
  };

  return (
    <Dialog open={openProject} onOpenChange={onOpenProjectChange}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Assign Project to {selectEmployee?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm font-medium text-gray-700">Select Project</p>

          <div ref={containerRef} className="relative">
            {/* Trigger / search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <Input
                className="pl-9 pr-8"
                placeholder={selectedLabel || "Search project by ID or name…"}
                value={dropdownOpen ? search : selectedLabel}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                }}
              />
              {selectedProject && (
                <button
                  onClick={handleClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Dropdown list */}
            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No projects found.</div>
                ) : (
                  filtered.map((project) => (
                    <button
                      key={project.id}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex flex-col gap-0.5 ${
                        selectedProject === project.id.toString() ? "bg-blue-50 text-blue-700" : "text-gray-800"
                      }`}
                      onClick={() => handleSelect(project)}
                    >
                      <span className="font-medium">{project.projectid}</span>
                      <span className="text-gray-500 text-xs">{project.projectname}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedLabel && (
            <p className="text-xs text-gray-500">
              Selected: <span className="font-medium text-gray-800">{selectedLabel}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="outline" onClick={() => onOpenProjectChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedProject}>
            Assign Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
