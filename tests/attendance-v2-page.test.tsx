import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { useState } from "react";
import AttendanceReportV2 from "../src/Component_report/pages/AttendanceReportV2";
import AttendanceMarkerToggles, { type AttendanceMarker } from "../src/Component_master/components/AttendanceMarkerToggles";

vi.mock("../src/app.js", () => ({ BASEURL: "https://example.test/api/", TOKEN: () => "test-token" }));
vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => false } }));

const row = {
  emp_guid: "a", employee_id: "E10", employee_name: "Ali", date: "2026-10-21",
  checkin_project: { ref: "p1", code: "PRJ1", name: "Eden Hills" }, first_checkin_at: "2026-10-21 18:00:00",
  checkout_project: { ref: "p2", code: "PRJ2", name: "Jouri Hills" }, last_checkout_at: "2026-10-22 06:00:00",
  duration_minutes: 720, status: "Present", shift: "Night",
};
const summary = { Present: 1, Absent: 3, "Check In Missing": 0, "Check Out Missing": 0, "Sick Leave": 2, "Official Duty": 0 };

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.post).mockResolvedValue({ data: { data: [] } });
  vi.mocked(axios.get).mockImplementation(async (url: string) => {
    if (url.endsWith("v2/settings/shift")) {
      return { data: { data: { day_start: "04:00", night_start: "16:01", next_day_cutoff: "07:30", current_attendance_date: "2026-10-21" } } };
    }
    return { data: { data: [row], meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 }, summary, shift_settings: { day_start: "04:00", night_start: "16:01", next_day_cutoff: "07:30" } } };
  });
});

const reportCalls = () => vi.mocked(axios.get).mock.calls.filter(([url]) => String(url).endsWith("v2/reports/attendance-v2"));

describe("attendance report V2 page", () => {
  it("defaults to the open attendance date and shows the report fields", async () => {
    render(<AttendanceReportV2 />);

    await screen.findByText("Ali");
    const cells = within(screen.getByRole("table")).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual([
      "E10", "Ali", "21/10/2026", "PRJ1 — Eden Hills", "21/10/2026 18:00",
      "PRJ2 — Jouri Hills", "22/10/2026 06:00", "12:00", "Present", "Night",
    ]);
    expect(reportCalls()[0][1]?.params).toMatchObject({ from: "2026-10-21", to: "2026-10-21", page: 1 });
    expect(screen.getByText(/Each date runs until 07:30 the next morning/)).toBeTruthy();
  });

  it("filters by status from the summary cards", async () => {
    render(<AttendanceReportV2 />);
    const sickLeave = await screen.findByRole("button", { name: /Sick Leave\s*2/ });

    await userEvent.click(sickLeave);

    await waitFor(() => expect(reportCalls().at(-1)?.[1]?.params).toMatchObject({ status: "Sick Leave" }));
    expect(sickLeave.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("role attendance marker toggles", () => {
  it("allows at most one of Medical Officer and Official Duty", async () => {
    const onChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = useState<AttendanceMarker>("");
      return <AttendanceMarkerToggles idPrefix="t" value={value} onChange={(v) => { onChange(v); setValue(v); }} />;
    };
    render(<Harness />);
    const medical = screen.getByRole("switch", { name: /Medical Officer/ });
    const duty = screen.getByRole("switch", { name: /Official Duty/ });

    await userEvent.click(medical);
    expect(medical.getAttribute("aria-checked")).toBe("true");
    await userEvent.click(duty);
    expect([medical.getAttribute("aria-checked"), duty.getAttribute("aria-checked")]).toEqual(["false", "true"]);
    await userEvent.click(duty);
    expect(onChange.mock.calls.map(([v]) => v)).toEqual(["sick_leave", "official_duty", ""]);
  });
});
