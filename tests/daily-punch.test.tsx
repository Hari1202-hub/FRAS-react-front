import { describe, expect, it } from "vitest";
import { formatDailyPunch } from "../src/Component_report/utils/dailyPunch";

describe("daily report punch dates", () => {
  it("keeps employee 25751's morning checkout on its actual stored date", () => {
    expect(formatDailyPunch("2026-10-07", "04:50:00")).toBe("07/10/2026 04:50");
  });
  it("keeps an actual next-day checkout on the next day's stored date", () => {
    expect(formatDailyPunch("2026-10-08", "04:50:00")).toBe("08/10/2026 04:50");
  });
  it("preserves normal punches without timezone-dependent date parsing", () => {
    expect(formatDailyPunch("2026-10-31", "17:12:40")).toBe("31/10/2026 17:12");
    expect(formatDailyPunch("2026-12-31", "00:01:02")).toBe("31/12/2026 00:01");
  });
  it("leaves missing punches empty", () => {
    expect(formatDailyPunch("2026-10-07", null)).toBe("—");
  });
});
