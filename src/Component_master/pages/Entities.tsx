import { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { BASEURL, TOKEN } from "../../app";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Pencil, PowerOff, Search, Upload, FileDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const V2 = BASEURL + "v2/";

interface Entity {
  guid: string;
  entity_code: string | null;
  entityname: string;
  isactive: boolean;
}

interface ImportRow {
  entity_code?: string;
  entityname: string;
  status: "Inserted" | "Updated" | "Skipped";
  remark: string;
}

const EMPTY_FORM = { entity_code: "", entityname: "" };

const Entities = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, current_page: 1 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Add / Edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<Entity | null>(null);

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const headers = { Authorization: `Bearer ${TOKEN()}` };

  const load = (p = page) => {
    setLoading(true);
    const params: any = { page: p, per_page: 25 };
    if (search) params.search = search;
    axios
      .get(`${V2}entities`, { headers, params })
      .then((r) => {
        setEntities(r.data.data);
        setMeta(r.data.meta);
      })
      .catch(() => toast.error("Failed to load entities."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { load(page); }, [page, search]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (e: Entity) => {
    setEditing(e);
    setForm({ entity_code: e.entity_code ?? "", entityname: e.entityname });
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!form.entityname.trim()) {
      toast.error("Entity name is required.");
      return;
    }
    setSaving(true);
    const payload = {
      entityname: form.entityname.trim(),
      entity_code: form.entity_code.trim() || null,
    };

    const req = editing
      ? axios.put(`${V2}entities/${editing.guid}`, payload, { headers })
      : axios.post(`${V2}entities`, payload, { headers });

    req
      .then(() => {
        toast.success(editing ? "Entity updated." : "Entity created.");
        setFormOpen(false);
        load(page);
      })
      .catch((err) => {
        const msg = err.response?.data?.message ?? "Failed to save entity.";
        toast.error(msg);
      })
      .finally(() => setSaving(false));
  };

  const handleDeactivate = () => {
    if (!deactivateTarget) return;
    axios
      .delete(`${V2}entities/${deactivateTarget.guid}`, { headers })
      .then(() => {
        toast.success("Entity deactivated.");
        setDeactivateTarget(null);
        load(page);
      })
      .catch(() => toast.error("Failed to deactivate entity."));
  };

  const handleReactivate = (e: Entity) => {
    axios
      .put(`${V2}entities/${e.guid}`, { isactive: true }, { headers })
      .then(() => {
        toast.success("Entity reactivated.");
        load(page);
      })
      .catch(() => toast.error("Failed to reactivate entity."));
  };

  // ── Import ───────────────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    axios
      .get(`${V2}templates/entities`, {
        headers,
        responseType: "blob",
      })
      .then((r) => {
        const url = URL.createObjectURL(new Blob([r.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = "entities_import_template.xlsx";
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(() => toast.error("Failed to download template."));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

      if (!rows.length) {
        toast.error("File is empty.");
        return;
      }

      const entities = rows.map((r: any) => ({
        entity_code: String(r["Entity Code"] ?? "").trim() || undefined,
        entityname: String(r["Entity Name"] ?? "").trim(),
      })).filter((r) => r.entityname);

      if (!entities.length) {
        toast.error("No valid rows found. Ensure the file has an 'Entity Name' column.");
        return;
      }

      setImporting(true);
      axios
        .post(`${V2}entities/import`, { entities }, { headers })
        .then((r) => {
          const d = r.data.data;
          const rows: ImportRow[] = [
            ...(d.inserted_records ?? []).map((rec: any) => ({
              entity_code: rec.entity_code,
              entityname: rec.entityname,
              status: "Inserted" as const,
              remark: "",
            })),
            ...(d.updated_records ?? []).map((rec: any) => ({
              entity_code: rec.entity_code,
              entityname: rec.entityname,
              status: "Updated" as const,
              remark: "",
            })),
            ...(d.skipped_records ?? []).map((rec: any) => ({
              entity_code: rec.entity_code,
              entityname: rec.entityname,
              status: "Skipped" as const,
              remark: rec.reason ?? "",
            })),
          ];
          setImportRows(rows);
          setImportResultOpen(true);
          toast.success(
            `Import done — ${d.inserted} inserted, ${d.updated} updated, ${d.skipped} skipped.`
          );
          load(1);
        })
        .catch(() => toast.error("Import failed. Please try again."))
        .finally(() => setImporting(false));
    };
    reader.readAsBinaryString(file);
  };

  const downloadImportResults = () => {
    if (!importRows) return;
    const ws = XLSX.utils.json_to_sheet(
      importRows.map((r) => ({
        "Entity Code": r.entity_code ?? "",
        "Entity Name": r.entityname,
        "Status": r.status,
        "Remark": r.remark,
      }))
    );
    ws["!cols"] = [{ wch: 14 }, { wch: 32 }, { wch: 12 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Results");
    XLSX.writeFile(wb, "entities_import_results.xlsx");
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const start = (meta.current_page - 1) * 25 + 1;
  const end = Math.min(meta.current_page * 25, meta.total);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Entities</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileDown className="h-4 w-4 mr-1" />
            Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="h-4 w-4 mr-1" />
            {importing ? "Importing…" : "Import Excel"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add Entity
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b bg-gray-50 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Search by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => load(page)} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Code</TableHead>
              <TableHead>Entity Name</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="text-right w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-gray-500">
                  Loading…
                </TableCell>
              </TableRow>
            ) : entities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-gray-500">
                  No entities found.
                </TableCell>
              </TableRow>
            ) : (
              entities.map((e) => (
                <TableRow key={e.guid}>
                  <TableCell className="font-mono text-sm">
                    {e.entity_code ?? <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>{e.entityname}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        e.isactive
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }
                    >
                      {e.isactive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => openEdit(e)}
                            className="p-1 text-blue-500 hover:text-blue-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {e.isactive ? (
                            <button
                              onClick={() => setDeactivateTarget(e)}
                              className="p-1 text-red-500 hover:text-red-700 ml-1"
                            >
                              <PowerOff className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(e)}
                              className="p-1 text-green-500 hover:text-green-700 ml-1"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          )}
                        </TooltipTrigger>
                        <TooltipContent>{e.isactive ? "Deactivate" : "Reactivate"}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="px-4 py-3 flex items-center justify-between border-t bg-gray-50">
          <span className="text-sm text-gray-700">
            {meta.total > 0 ? `Showing ${start}–${end} of ${meta.total}` : "0 entities"}
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 border rounded text-sm disabled:opacity-40"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Previous
            </button>
            <button
              className="px-3 py-1 border rounded text-sm disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.last_page}
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Entity" : "Add Entity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="entity_code">Entity Code</Label>
              <Input
                id="entity_code"
                placeholder="e.g. ENT001"
                value={form.entity_code}
                onChange={(e) => setForm((f) => ({ ...f, entity_code: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Optional. Must be unique if provided.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="entityname">
                Entity Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="entityname"
                placeholder="e.g. Tanseeq Investment"
                value={form.entityname}
                onChange={(e) => setForm((f) => ({ ...f, entityname: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm */}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Entity?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deactivateTarget?.entityname}</strong> will be set to inactive. Employees
              linked to this entity are not affected. You can reactivate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeactivate}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Results Dialog */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Entity Name</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRows?.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{r.entity_code ?? "—"}</TableCell>
                    <TableCell>{r.entityname}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          r.status === "Inserted"
                            ? "bg-green-100 text-green-800"
                            : r.status === "Updated"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{r.remark}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="justify-between">
            <Button variant="outline" size="sm" onClick={downloadImportResults}>
              <FileDown className="h-4 w-4 mr-1" />
              Download Results
            </Button>
            <Button onClick={() => setImportResultOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Entities;
