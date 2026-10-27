export const V2_STATUSES = [
  "Present",
  "Absent",
  "Check In Missing",
  "Check Out Missing",
  "Sick Leave",
  "Official Duty",
] as const;

export const V2_SHIFTS = ["Day", "Night", "24 Hours"] as const;

export type V2Status = (typeof V2_STATUSES)[number];

export interface V2Project {
  ref: string;
  code: string | null;
  name: string | null;
}

export interface AttendanceV2Row {
  emp_guid: string;
  employee_id: string | null;
  employee_name: string;
  date: string;
  checkin_project: V2Project | null;
  first_checkin_at: string | null;
  checkout_project: V2Project | null;
  last_checkout_at: string | null;
  duration_minutes: number | null;
  status: V2Status;
  shift: string | null;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" without timezone-dependent parsing. */
export function formatV2Date(date: string | null): string {
  if (!date) return "—";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

/** "YYYY-MM-DD HH:MM:SS" → "DD/MM/YYYY HH:MM". */
export function formatV2DateTime(value: string | null): string {
  if (!value) return "—";
  return `${formatV2Date(value)} ${value.slice(11, 16)}`;
}

/** Minutes → "H:MM"; blank when there is no valid duration. */
export function formatV2Duration(minutes: number | null): string {
  if (minutes == null) return "—";
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatV2Project(project: V2Project | null): string {
  if (!project) return "—";
  if (!project.code && !project.name) return project.ref;
  return [project.code, project.name].filter(Boolean).join(" — ");
}

export const V2_STATUS_STYLES: Record<V2Status, string> = {
  Present: "bg-green-100 text-green-800 border-green-200",
  Absent: "bg-red-100 text-red-800 border-red-200",
  "Check In Missing": "bg-amber-100 text-amber-800 border-amber-200",
  "Check Out Missing": "bg-orange-100 text-orange-800 border-orange-200",
  "Sick Leave": "bg-purple-100 text-purple-800 border-purple-200",
  "Official Duty": "bg-blue-100 text-blue-800 border-blue-200",
};

/** Row shape for the Excel export, columns in the client's report field order. */
export function toV2ExportRow(row: AttendanceV2Row) {
  return {
    "Employee ID": row.employee_id ?? "",
    Name: row.employee_name,
    Date: formatV2Date(row.date),
    "Check In Project": row.checkin_project ? formatV2Project(row.checkin_project) : "",
    "First Check In": row.first_checkin_at ? formatV2DateTime(row.first_checkin_at) : "",
    "Check Out Project": row.checkout_project ? formatV2Project(row.checkout_project) : "",
    "Last Check Out": row.last_checkout_at ? formatV2DateTime(row.last_checkout_at) : "",
    Status: row.status,
    Shift: row.shift ?? "",
    "Total Duration": row.duration_minutes == null ? "" : formatV2Duration(row.duration_minutes),
  };
}
