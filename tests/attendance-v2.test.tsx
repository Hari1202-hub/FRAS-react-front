import { describe, expect, it } from "vitest";
import {
  formatV2DateTime,
  formatV2Duration,
  formatV2Project,
  toV2ExportRow,
  type AttendanceV2Row,
} from "../src/Component_report/utils/attendanceV2";

const row: AttendanceV2Row = {
  emp_guid: "guid",
  employee_id: "E100",
  employee_name: "Ali",
  date: "2026-10-21",
  checkin_project: { ref: "p1", code: "PRJ1", name: "Eden Hills" },
  first_checkin_at: "2026-10-21 18:00:00",
  checkout_project: { ref: "p2", code: null, name: null },
  last_checkout_at: "2026-10-22 06:05:00",
  duration_minutes: 725,
  status: "Present",
  shift: "Night",
};

describe("attendance report V2 formatting", () => {
  it("shows the actual calendar date of a next-day checkout", () => {
    expect(formatV2DateTime(row.last_checkout_at)).toBe("22/10/2026 06:05");
  });

  it("formats durations as hours and minutes and leaves invalid ones blank", () => {
    expect(formatV2Duration(725)).toBe("12:05");
    expect(formatV2Duration(5)).toBe("0:05");
    expect(formatV2Duration(null)).toBe("—");
  });

  it("falls back to the stored reference for unknown projects", () => {
    expect(formatV2Project(row.checkin_project)).toBe("PRJ1 — Eden Hills");
    expect(formatV2Project(row.checkout_project)).toBe("p2");
    expect(formatV2Project(null)).toBe("—");
  });

  it("exports the client's report fields in order", () => {
    const exported = toV2ExportRow(row);
    expect(Object.keys(exported)).toEqual([
      "Employee ID", "Name", "Date", "Check In Project", "First Check In",
      "Check Out Project", "Last Check Out", "Status", "Shift", "Total Duration",
    ]);
    expect(exported["Total Duration"]).toBe("12:05");

    const absent = toV2ExportRow({ ...row, checkin_project: null, first_checkin_at: null, checkout_project: null, last_checkout_at: null, duration_minutes: null, status: "Absent", shift: null });
    expect([absent["First Check In"], absent.Shift, absent["Total Duration"]]).toEqual(["", "", ""]);
  });
});
