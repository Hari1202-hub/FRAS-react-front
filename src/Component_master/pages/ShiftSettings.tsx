import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { BASEURL, TOKEN } from "../../app";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Clock, Loader2, Lock } from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";

interface ShiftTimings {
  day_start: string;
  night_start: string;
  next_day_cutoff: string;
}

const FIELDS: { key: keyof ShiftTimings; label: string; help: string }[] = [
  { key: "day_start", label: "Day shift starts", help: "Check-ins from this time start that day's attendance as Day shift." },
  { key: "night_start", label: "Night shift starts", help: "Check-ins from this time are Night shift." },
  { key: "next_day_cutoff", label: "Next-day cutoff", help: "Punches the next morning before this time still count for the previous date (Night or 24 Hours)." },
];

export default function ShiftSettings() {
  const isSuperAdmin = useIsSuperAdmin();
  const [values, setValues] = useState<ShiftTimings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${BASEURL}v2/settings/shift`, { headers: { Authorization: `Bearer ${TOKEN()}` } })
      .then((r) => setValues(r.data.data))
      .catch(() => setError("Could not load shift timings."));
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await axios.put(`${BASEURL}v2/settings/shift`, values, {
        headers: { Authorization: `Bearer ${TOKEN()}` },
      });
      setValues(res.data.data);
      toast({ title: "Shift timings saved", description: "Attendance Report V2 now uses the new timings." });
    } catch (cause: unknown) {
      const data = axios.isAxiosError(cause) ? cause.response?.data : null;
      const details = data?.errors ? Object.values(data.errors).flat().join(" ") : "";
      setError(details || data?.message || "Could not save shift timings.");
    } finally {
      setSaving(false);
    }
  };

  const readOnly = isSuperAdmin !== true;

  return (
    <div className="p-6 space-y-6 bg-muted/10 min-h-screen">
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Clock className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Timings</h1>
          <p className="text-sm text-muted-foreground">Used to work out the attendance date, shift and status in Attendance Report V2.</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Shift windows</CardTitle>
          <CardDescription>
            {isSuperAdmin === false && (
              <span className="flex items-center gap-1.5 text-amber-700">
                <Lock className="h-3.5 w-3.5" /> Only the super admin can change these timings.
              </span>
            )}
            {isSuperAdmin && "Changes apply to every date in the report, including past dates."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!values ? (
            error ? <p role="alert" className="text-sm text-destructive">{error}</p> : (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            )
          ) : (
            <form onSubmit={save} className="space-y-5">
              <fieldset disabled={readOnly || saving} className="space-y-5">
                {FIELDS.map(({ key, label, help }) => (
                  <div key={key} className="grid gap-1.5 sm:grid-cols-[200px_1fr] sm:items-start">
                    <Label htmlFor={`shift-${key}`} className="pt-2">{label}</Label>
                    <div>
                      <Input
                        id={`shift-${key}`}
                        type="time"
                        required
                        value={values[key]}
                        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                        className="w-40"
                        aria-describedby={`shift-${key}-help`}
                      />
                      <p id={`shift-${key}-help`} className="mt-1 text-xs text-muted-foreground">{help}</p>
                    </div>
                  </div>
                ))}
              </fieldset>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {!readOnly && (
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving} className="bg-proscape text-white">
                    {saving ? "Saving…" : "Save Timings"}
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
