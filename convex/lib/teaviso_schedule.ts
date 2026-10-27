import { ConvexError } from "convex/values";
export type Hours = { day: number; start: number; end: number }[];
export const DEFAULT_HOURS: Hours = [1, 2, 3, 4, 5].map((day) => ({
  day,
  start: 540,
  end: 1080,
}));
const DAY = 86_400_000;
export function validTimezone(value: string) {
  try {
    if (value.length > 80) throw Error();
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    throw new ConvexError("Elegí una zona horaria válida.");
  }
}
export function validateHours(hours: Hours) {
  if (hours.length > 28) throw new ConvexError("Revisá los horarios.");
  const sorted = hours
    .map((h) => ({ ...h }))
    .sort((a, b) => a.day - b.day || a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    const h = sorted[i],
      p = sorted[i - 1];
    if (
      ![h.day, h.start, h.end].every(Number.isSafeInteger) ||
      h.day < 0 ||
      h.day > 6 ||
      h.start < 0 ||
      h.end > 1440 ||
      h.start >= h.end ||
      (p?.day === h.day && p.end > h.start)
    )
      throw new ConvexError(
        "Los horarios deben ser válidos y no superponerse.",
      );
  }
  return sorted;
}
const formatters = new Map<string, Intl.DateTimeFormat>();
export function localClock(timezone: string) {
  const formatter =
    formatters.get(timezone) ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  formatters.set(timezone, formatter);
  return (epoch: number) => {
    const fields = Object.fromEntries(
      formatter.formatToParts(epoch).map((p) => [p.type, p.value]),
    );
    const date = `${fields.year}-${fields.month}-${fields.day}`;
    return {
      date,
      day: new Date(`${date}T12:00:00Z`).getUTCDay(),
      minute: Number(fields.hour) * 60 + Number(fields.minute),
    };
  };
}
export function occupies(
  row: { status: string; expiresAt?: number },
  now: number,
) {
  return (
    row.status === "confirmed" ||
    row.status === "completed" ||
    row.status === "no_show" ||
    (row.status === "pending" && (row.expiresAt ?? 0) > now)
  );
}
export function intersects(
  start: number,
  end: number,
  other: { startsAt: number; endsAt: number },
) {
  return start < other.endsAt && end > other.startsAt;
}
export function permitsSlot(
  config: {
    timezone: string;
    schedule: Hours;
    leadMinutes: number;
    horizonDays: number;
  },
  start: number,
  duration: number,
  now: number,
) {
  if (
    !Number.isSafeInteger(start) ||
    start % 60_000 !== 0 ||
    !Number.isInteger(duration) ||
    duration < 5 ||
    duration > 480 ||
    start < now + config.leadMinutes * 60_000 ||
    start > now + config.horizonDays * DAY
  )
    return false;
  const clock = localClock(config.timezone),
    a = clock(start),
    b = clock(start + duration * 60_000 - 1);
  return (
    a.date === b.date &&
    config.schedule.some(
      (h) =>
        h.day === a.day &&
        a.minute >= h.start &&
        (a.minute - h.start) % 15 === 0 &&
        b.minute < h.end,
    )
  );
}
export function dayBounds(date: string) {
  const start = Date.parse(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, 10) !== date
  )
    throw new ConvexError("Elegí una fecha válida.");
  return { start: start - 14 * 3_600_000, end: start + 38 * 3_600_000 };
}
