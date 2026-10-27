import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { BASEURL, TOKEN } from "../../app.js";

export interface EditableProject {
  guid: string;
  projectid: string;
  projectname: string;
  entity_id?: string | number | null;
  entity?: { id?: string | number; entityname: string } | null;
  isactive: boolean;
}

interface Props {
  project: EditableProject | null;
  entities: { id: string | number; entityname: string }[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditProjectModal({ project, entities, isOpen, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [entityId, setEntityId] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    if (isOpen && project) {
      setName(project.projectname ?? "");
      setEntityId(String(project.entity_id ?? project.entity?.id ?? ""));
      setActive(project.isactive);
      setError("");
    }
  }, [isOpen, project]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project || submitting.current) return;
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 200) {
      setError("Enter a project name of up to 200 characters.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await axios.put(
        `${BASEURL}v2/projects/${encodeURIComponent(project.guid)}`,
        { projectname: trimmedName, active, ...(entityId ? { entity_id: entityId } : {}) },
        { headers: { Authorization: `Bearer ${TOKEN()}` } },
      );
      if (response.data.success === false) {
        throw new Error(response.data.message || "Could not update the project.");
      }
      toast({ title: "Project updated", description: "Your changes have been saved." });
      onSaved();
      onClose();
    } catch (cause: unknown) {
      if (axios.isAxiosError(cause)) {
        const data = cause.response?.data;
        const details = data?.errors ? Object.values(data.errors).flat().join(" ") : "";
        setError(details || data?.message || "Could not update the project. Please try again.");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not update the project.");
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  if (!project) return null;
  const hasCurrentEntity = entities.some(entity => String(entity.id) === entityId);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !submitting.current) onClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update the project name, entity and status.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-code">Project ID</Label>
              <Input id="edit-project-code" value={project.projectid} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project Name</Label>
              <Input id="edit-project-name" value={name} onChange={event => setName(event.target.value)} required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-entity">Entity</Label>
              <select id="edit-project-entity" value={entityId} onChange={event => setEntityId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2">
                <option value="" disabled={Boolean(project.entity_id ?? project.entity?.id)}>No Entity</option>
                {entityId && !hasCurrentEntity && <option value={entityId}>{project.entity?.entityname || "Current entity"}</option>}
                {entities.map(entity => <option key={entity.id} value={String(entity.id)}>{entity.entityname}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-status">Status</Label>
              <select id="edit-project-status" value={active ? "active" : "inactive"} onChange={event => setActive(event.target.value === "active")} className="w-full rounded-md border border-input bg-background px-3 py-2">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-proscape text-white">{saving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
