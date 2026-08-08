import { describe, expect, it } from "vitest";
import { closedPeriodStart, isWithinBusinessHours } from "./business-hours";
import type { BusinessHours } from "./db/schema";

// Mon to Fri, 09:00 to 18:00.
const WEEKDAYS: BusinessHours = {
  1: { open: "09:00", close: "18:00" },
  2: { open: "09:00", close: "18:00" },
  3: { open: "09:00", close: "18:00" },
  4: { open: "09:00", close: "18:00" },
  5: { open: "09:00", close: "18:00" },
};

// 2026-08-05 is a Wednesday.
const WED_1400_UTC = new Date("2026-08-05T14:00:00Z");
const WED_2000_UTC = new Date("2026-08-05T20:00:00Z");
const SUN_1400_UTC = new Date("2026-08-09T14:00:00Z");

describe("isWithinBusinessHours", () => {
  it("treats no schedule as always open", () => {
    expect(isWithinBusinessHours(null, "UTC", WED_2000_UTC)).toBe(true);
    expect(isWithinBusinessHours({}, "UTC", WED_2000_UTC)).toBe(true);
  });

  it("is open inside the window and closed outside it", () => {
    expect(isWithinBusinessHours(WEEKDAYS, "UTC", WED_1400_UTC)).toBe(true);
    expect(isWithinBusinessHours(WEEKDAYS, "UTC", WED_2000_UTC)).toBe(false);
  });

  it("is closed on a day with no hours", () => {
    expect(isWithinBusinessHours(WEEKDAYS, "UTC", SUN_1400_UTC)).toBe(false);
  });

  it("evaluates against the inbox timezone, not the server", () => {
    // 14:00 UTC is 10:00 in Santiago (open) and 23:00 in Tokyo (closed).
    expect(isWithinBusinessHours(WEEKDAYS, "America/Santiago", WED_1400_UTC)).toBe(true);
    expect(isWithinBusinessHours(WEEKDAYS, "Asia/Tokyo", WED_1400_UTC)).toBe(false);
  });

  it("closes exactly at the close time, not a minute later", () => {
    expect(
      isWithinBusinessHours(WEEKDAYS, "UTC", new Date("2026-08-05T17:59:00Z"))
    ).toBe(true);
    expect(
      isWithinBusinessHours(WEEKDAYS, "UTC", new Date("2026-08-05T18:00:00Z"))
    ).toBe(false);
  });

  it("stays open rather than crashing on an invalid timezone", () => {
    expect(isWithinBusinessHours(WEEKDAYS, "Not/AZone", WED_1400_UTC)).toBe(true);
  });
});

describe("closedPeriodStart", () => {
  it("returns null while open", () => {
    expect(closedPeriodStart(WEEKDAYS, "UTC", WED_1400_UTC)).toBeNull();
  });

  it("starts at today's close when the evening just began", () => {
    const start = closedPeriodStart(WEEKDAYS, "UTC", WED_2000_UTC);

    expect(start?.toISOString()).toBe("2026-08-05T18:00:00.000Z");
  });

  it("carries the weekend back to Friday's close", () => {
    const start = closedPeriodStart(WEEKDAYS, "UTC", SUN_1400_UTC);

    expect(start?.toISOString()).toBe("2026-08-07T18:00:00.000Z");
  });

  it("starts at yesterday's close in the early morning", () => {
    const start = closedPeriodStart(WEEKDAYS, "UTC", new Date("2026-08-06T07:00:00Z"));

    expect(start?.toISOString()).toBe("2026-08-05T18:00:00.000Z");
  });

  it("returns null when there is no schedule to reason about", () => {
    expect(closedPeriodStart(null, "UTC", WED_2000_UTC)).toBeNull();
    expect(closedPeriodStart({}, "UTC", WED_2000_UTC)).toBeNull();
  });
});
