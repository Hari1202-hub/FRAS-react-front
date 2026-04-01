import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportResultModalProps {
  open: boolean;
  onClose: () => void;
  inserted: any[];
  updated: any[];
  skipped: any[];
}

export function ImportResultModal({
  open,
  onClose,
  inserted,
  updated,
  skipped,
}: ImportResultModalProps) {
  const hasData =
    inserted.length > 0 || updated.length > 0 || skipped.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Fixed: max-h-[90vh], flex-col, and p-0/gap-0 to control layout manually */}
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header with manual padding */}
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold">
            Import Process Summary
          </DialogTitle>
          <div className="flex gap-3 pt-2">
            <Badge
              variant="outline"
              className="border-green-600 text-green-700 bg-green-50"
            >
              {inserted.length} Inserted
            </Badge>
            <Badge
              variant="outline"
              className="border-blue-600 text-blue-700 bg-blue-50"
            >
              {updated.length} Updated
            </Badge>
            <Badge
              variant="outline"
              className="border-destructive text-destructive bg-red-50"
            >
              {skipped.length} Skipped
            </Badge>
          </div>
        </DialogHeader>

        {/* Fixed: flex-1 + min-h-0 ensures this div takes available space but allows scrolling */}
        <div className="flex-1 min-h-0 w-full">
          <ScrollArea className="h-full w-full">
            {/* Content padding is applied here inside the scroll area */}
            <div className="p-6 pt-0 space-y-8">
              {/* Inserted Records Table */}
              {inserted.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-green-700 mb-3">
                    New Records Created
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-32">Employee ID</TableHead>
                          <TableHead>Full Name</TableHead>
                          <TableHead className="text-right italic text-slate-500">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inserted.map((record, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {record.employeeId}
                            </TableCell>
                            <TableCell>{record.name}</TableCell>
                            <TableCell className="text-right text-green-600 text-xs">
                              Success
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {/* Updated Records Table */}
              {updated.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-blue-700 mb-3">
                    Existing Records Updated
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-32">Employee ID</TableHead>
                          <TableHead>Full Name</TableHead>
                          <TableHead className="text-right italic text-slate-500">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {updated.map((record, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {record.employeeId}
                            </TableCell>
                            <TableCell>{record.name}</TableCell>
                            <TableCell className="text-right text-blue-600 text-xs">
                              Modified
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {/* Skipped Records Table */}
              {skipped.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-red-700 mb-3">
                    Skipped (Issues Found)
                  </h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="bg-red-50/50">
                        <TableRow>
                          <TableHead className="w-32">Employee ID</TableHead>
                          <TableHead>Details</TableHead>
                          <TableHead className="text-right">
                            Reason for Failure
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skipped.map((record, i) => (
                          <TableRow key={i} className="hover:bg-red-50/30">
                            <TableCell className="font-medium text-red-900">
                              {record.employeeId || "N/A"}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              {record.name || "Unknown"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600">
                              {record.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              )}

              {!hasData && (
                <div className="py-10 text-center text-slate-500">
                  No data was processed during this import.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>

      {/* Footer with manual padding */}
      <div className="p-4 border-t flex justify-end bg-white">
        <Button onClick={onClose} size="lg">
          Done
        </Button>
      </div>
    </Dialog>
  );
}
