// src/app/utils/dateUtils.ts

export type TargetMonth = { year: number; month: number };

/**
 * カレンダーの初期対象年月を決める。
 * ルール:
 * - 毎月11日以降: 翌月
 * - 10日以前: 当月
 *
 * month は 1〜12 を返す。
 */
export function getDefaultTargetMonth(baseDate: Date = new Date()): TargetMonth {
  const year = baseDate.getFullYear();
  const month1to12 = baseDate.getMonth() + 1; // JS Date は 0-11
  const day = baseDate.getDate();

  // 11日以降なら翌月へ
  if (day >= 11) {
    if (month1to12 === 12) {
      return { year: year + 1, month: 1 };
    }
    return { year, month: month1to12 + 1 };
  }

  // 10日以前なら当月
  return { year, month: month1to12 };
}
