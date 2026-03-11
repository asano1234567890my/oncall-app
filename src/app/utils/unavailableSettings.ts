import type {
  FixedUnavailableWeekdayEntry,
  TargetShift,
  UnavailableDateEntry,
} from "../types/dashboard";
const targetShiftOrder: Record<TargetShift, number> = {
  all: 0,
  day: 1,
  night: 2,
};

const readDayOfWeek = (
  entry: FixedUnavailableWeekdayEntry | { day_of_week?: number | null; weekday?: number | null }
) => {
  const raw = entry?.day_of_week ?? entry?.weekday;
  const dayOfWeek = Number(raw);
  return Number.isFinite(dayOfWeek) ? dayOfWeek : null;
};


export const matchesTargetShift = (targetShift: TargetShift, shiftType: "day" | "night") =>
  targetShift === "all" || targetShift === shiftType;

export const normalizeUnavailableDateEntries = (entries: UnavailableDateEntry[]) => {
  const next = new Map<string, TargetShift>();
  entries.forEach((entry) => {
    if (!entry?.date) return;
    next.set(String(entry.date), entry.target_shift ?? "all");
  });

  return Array.from(next.entries())
    .sort(([leftDate, leftShift], [rightDate, rightShift]) => {
      if (leftDate === rightDate) return targetShiftOrder[leftShift] - targetShiftOrder[rightShift];
      return leftDate.localeCompare(rightDate);
    })
    .map(([date, target_shift]) => ({ date, target_shift }));
};

const parseUnavailableDateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
};

export const isUnavailableDateInMonth = (value: string, year: number, month: number) => {
  const parts = parseUnavailableDateParts(value);
  if (!parts) return false;
  return parts.year === year && parts.month === month;
};

export const filterUnavailableDateEntriesByMonth = (
  entries: UnavailableDateEntry[],
  year: number,
  month: number
) =>
  normalizeUnavailableDateEntries(
    entries.filter((entry) => entry?.date && isUnavailableDateInMonth(String(entry.date), year, month))
  );

export const normalizeFixedUnavailableWeekdayEntries = (entries: FixedUnavailableWeekdayEntry[]) => {
  const next = new Map<number, TargetShift>();
  entries.forEach((entry) => {
    const dayOfWeek = readDayOfWeek(entry);
    if (dayOfWeek === null) return;
    next.set(dayOfWeek, entry.target_shift ?? "all");
  });

  return Array.from(next.entries())
    .sort(([leftDay, leftShift], [rightDay, rightShift]) => {
      if (leftDay === rightDay) return targetShiftOrder[leftShift] - targetShiftOrder[rightShift];
      return leftDay - rightDay;
    })
    .map(([day_of_week, target_shift]) => ({ day_of_week, target_shift }));
};

export const getUnavailableDateTargetShift = (entries: UnavailableDateEntry[], date: string) => {
  const matched = entries.find((entry) => entry.date === date);
  return matched?.target_shift ?? null;
};

export const setUnavailableDateTargetShift = (
  entries: UnavailableDateEntry[],
  date: string,
  targetShift: TargetShift | null
) => {
  const filtered = entries.filter((entry) => entry.date !== date);
  if (!targetShift) return normalizeUnavailableDateEntries(filtered);
  return normalizeUnavailableDateEntries([...filtered, { date, target_shift: targetShift }]);
};

export const getFixedWeekdayTargetShift = (
  entries: FixedUnavailableWeekdayEntry[],
  dayOfWeek: number
) => {
  const matched = entries.find((entry) => readDayOfWeek(entry) === dayOfWeek);
  return matched?.target_shift ?? null;
};

export const setFixedWeekdayTargetShift = (
  entries: FixedUnavailableWeekdayEntry[],
  dayOfWeek: number,
  targetShift: TargetShift | null
) => {
  const filtered = entries.filter((entry) => readDayOfWeek(entry) !== dayOfWeek);
  if (!targetShift) return normalizeFixedUnavailableWeekdayEntries(filtered);
  return normalizeFixedUnavailableWeekdayEntries([
    ...filtered,
    { day_of_week: dayOfWeek, target_shift: targetShift },
  ]);
};

