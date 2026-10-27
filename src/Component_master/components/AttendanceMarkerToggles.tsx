import { Switch } from "@/components/ui/switch";

export type AttendanceMarker = "" | "sick_leave" | "official_duty";

export const ATTENDANCE_MARKERS: { value: Exclude<AttendanceMarker, "">; label: string; status: string; badge: string }[] = [
  { value: "sick_leave", label: "Medical Officer", status: "Sick Leave", badge: "bg-purple-100 text-purple-800" },
  { value: "official_duty", label: "Official Duty", status: "Official Duty", badge: "bg-blue-100 text-blue-800" },
];

interface Props {
  value: AttendanceMarker;
  onChange: (value: AttendanceMarker) => void;
  idPrefix: string;
}

/**
 * A role can mark the employees its users scan as Sick Leave or Official Duty —
 * at most one of the two, so turning one on turns the other off.
 */
export default function AttendanceMarkerToggles({ value, onChange, idPrefix }: Props) {
  return (
    <fieldset className="rounded-md border border-gray-200 p-3">
      <legend className="px-1 text-sm font-medium text-gray-700">Attendance marking</legend>
      <div className="space-y-3">
        {ATTENDANCE_MARKERS.map((marker) => {
          const id = `${idPrefix}-${marker.value}`;
          return (
            <div key={marker.value} className="flex items-start justify-between gap-4">
              <label htmlFor={id} className="cursor-pointer">
                <span className="block text-sm font-medium text-gray-800">{marker.label}</span>
                <span className="block text-xs text-gray-500">
                  Employees scanned by users with this role are marked <strong>{marker.status}</strong>.
                </span>
              </label>
              <Switch
                id={id}
                checked={value === marker.value}
                onCheckedChange={(checked) => onChange(checked ? marker.value : "")}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
