import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AllEmployees from "./employees/AllEmployees";
import UnassignedEmployees from "./employees/UnassignedEmployees";
import AssignedEmployees from "./employees/AssignedEmployees";
import { TanseeqImportModal } from "@/components/employees/TanseeqImportModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { BASEURL, TOKEN } from "../../app";
import { CloudDownload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { ImportResultModal } from "@/components/employees/ImportResultModal";
import { LoadingOverlay, RequestStatus } from "@/components/common/LoadingOverlay";

const Employees = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [isTanseeqModalOpen, setIsTanseeqModalOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("idle");

  const authHeaders = { Authorization: `Bearer ${TOKEN()}` };

  const handleExportEnrolled = () => {
    window.location.href = `${BASEURL}export_enrolled_csv?token=${TOKEN()}`;
  };

  const handleExportNotEnrolled = () => {
    window.location.href = `${BASEURL}export_not_enrolled_csv?token=${TOKEN()}`;
  };

  const handleTanseeqImport = (newEmployees) => {
    setStatus("loading");

    const employees = newEmployees.map((emp) => ({
      id:             emp.employeeId,
      name:           emp.name,
      entity:         emp.entity,
      classification: emp.classification,
      category:       emp.category,
      email:          emp.email   || null,
      mobile:         emp.contactNumber || null,
      status:         emp.status,
      reference_id:   emp.employeeId,
    }));

    axios
      .post(`${BASEURL}v2/staff`, { employees }, { headers: { ...authHeaders, "Content-Type": "application/json" } })
      .then((response) => {
        const d = response.data.data;
        toast.success(
          `${d.inserted} imported, ${d.updated} updated, ${d.skipped ?? 0} skipped.`
        );
        setStatus("success");
        setImportResult({
          inserted: d.inserted_records ?? [],
          updated:  d.updated_records  ?? [],
          skipped:  d.skipped_records  ?? [],
        });
      })
      .catch((error) => {
        console.error("Import error:", error);
        toast.error("Failed to import employees. Please try again.");
        setStatus("error");
      })
      .finally(() => {
        setTimeout(() => setStatus("idle"), 3000);
        setIsResultOpen(true);
      });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Employees Management</h1>
            <div className="flex items-center gap-2">
              <Button className="flex items-center gap-2 p-3" onClick={() => setIsTanseeqModalOpen(true)}>
                <CloudDownload className="h-4 w-4" />
                Import from Excel
              </Button>
              <Button className="p-3" onClick={handleExportNotEnrolled}>
                Export Not Enrolled
              </Button>
              <Button className="p-3" onClick={handleExportEnrolled}>
                Export Enrolled
              </Button>
            </div>
          </div>

          <Card className="p-4">
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All Employees</TabsTrigger>
                <TabsTrigger value="unassigned">Unassigned Employees</TabsTrigger>
                <TabsTrigger value="assigned">Assigned Employees</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <AllEmployees />
              </TabsContent>
              <TabsContent value="unassigned" className="mt-4">
                <UnassignedEmployees />
              </TabsContent>
              <TabsContent value="assigned" className="mt-4">
                <AssignedEmployees />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {isTanseeqModalOpen && (
          <TanseeqImportModal
            open={isTanseeqModalOpen}
            onOpenChange={() => setIsTanseeqModalOpen(false)}
            onImportComplete={handleTanseeqImport}
          />
        )}

        {importResult && (
          <ImportResultModal
            open={isResultOpen}
            onClose={() => setIsResultOpen(false)}
            inserted={importResult.inserted}
            updated={importResult.updated}
            skipped={importResult.skipped}
          />
        )}
      </div>

      <LoadingOverlay status={status} title="Processing Employees Import" />
    </>
  );
};

export default Employees;
