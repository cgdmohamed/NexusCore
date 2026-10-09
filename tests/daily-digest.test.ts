import { describe, it, expect } from "vitest";
import { buildDigest, isDigestTime, localHour } from "../server/daily-digest";

describe("morning digest", () => {
  it("says nothing on an empty day", () => {
    expect(buildDigest({ dueToday: 0, overdue: 0 }, "ar")).toBeNull();
    expect(buildDigest({ dueToday: 0, overdue: 0 }, "en")).toBeNull();
  });

  it("formats Arabic counts with the correct noun forms", () => {
    expect(buildDigest({ dueToday: 1, overdue: 0 }, "ar")!.message).toBe("مهمة واحدة مستحقة اليوم");
    expect(buildDigest({ dueToday: 2, overdue: 0 }, "ar")!.message).toBe("مهمتان مستحقتان اليوم");
    expect(buildDigest({ dueToday: 3, overdue: 1 }, "ar")!.message).toBe("٣ مهام مستحقة اليوم ومهمة واحدة متأخرة");
    expect(buildDigest({ dueToday: 0, overdue: 12 }, "ar")!.message).toBe("١٢ مهمة متأخرة");
  });

  it("formats English counts", () => {
    expect(buildDigest({ dueToday: 3, overdue: 1 }, "en")!.message).toBe("3 tasks due today and 1 overdue");
    expect(buildDigest({ dueToday: 1, overdue: 0 }, "en")!.message).toBe("1 task due today");
  });

  it("sends only in the morning window of the company's time zone", () => {
    const tz = "Africa/Cairo";
    // Cairo is UTC+3 in summer (DST) and UTC+2 in winter
    expect(localHour(new Date("2026-07-01T05:00:00Z"), tz)).toBe(8);
    expect(isDigestTime(new Date("2026-07-01T04:59:00Z"), tz, 8)).toBe(false);
    expect(isDigestTime(new Date("2026-07-01T05:00:00Z"), tz, 8)).toBe(true);
    expect(isDigestTime(new Date("2026-07-01T08:59:00Z"), tz, 8)).toBe(true);
    expect(isDigestTime(new Date("2026-07-01T09:00:00Z"), tz, 8)).toBe(false);
    expect(localHour(new Date("2026-01-15T06:00:00Z"), tz)).toBe(8);
  });
});
