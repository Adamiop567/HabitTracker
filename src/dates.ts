/** Date helpers — all dates are local-time "YYYY-MM-DD" strings (ISO weekday semantics). */
import { getLang, monthName, weekdayName, weekdayShortName } from './i18n'

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** ISO weekday: Monday=1 .. Sunday=7 */
export function isoWeekday(s: string): number {
  const wd = parseISO(s).getDay() // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd
}

/** Monday of the week containing `s`. */
export function mondayOf(s: string): string {
  return addDays(s, -(isoWeekday(s) - 1))
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

/** Deterministic Monday-based week index since the Unix epoch (independent of timezone/DST).
 *
 * Computed arithmetically from the date parts (no timestamps), so it is stable on
 * every device. Week 0 is the week containing 1970-01-05 (the first Monday ≥ epoch).
 */
export function weekIndexOf(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  // days since 1970-01-01 (day 0 = 1970-01-01, a Thursday)
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000)
  // first Monday on or after 1970-01-01 is 1970-01-05 → day 4
  return Math.floor((days - 4) / 7)
}

/** Which week (1..n) of the every-n-week cycle contains the given date. */
export function weekOffsetFor(s: string, n: number): number {
  return ((weekIndexOf(s) % n) + n) % n + 1
}

/** Whether an occurrence of a schedule exists on the given date.
 *
 * - weekly: on one of `weekdays`, in the `weekOffset`-th week of every N-week cycle.
 * - interval: every Nth day counting from the anchor date (anchor day included).
 */
interface ScheduleLike {
  kind: 'weekly' | 'interval'
  every: number
  weekOffset?: number
  weekdays?: number[]
  weekday?: number
  anchor?: string | null
  time?: string
  endTime?: string | null
  weekTimes?: Record<string, Record<string, string | null>>
  weekEndTimes?: Record<string, Record<string, string | null>>
  weekAnchor?: string | null
}

/** Whether an occurrence of a schedule exists on the given date.
 *
 * - weekly: on one of `weekdays`, in the `weekOffset`-th week of every N-week cycle.
 *   With `weekTimes` (pokročilý rozvrh) the matrix decides: a time in cell
 *   (weekday, week-of-cycle) means training, a missing cell means off.
 * - interval: every Nth day counting from the anchor date (anchor day included).
 */
export function occursOn(s: ScheduleLike, date: string): boolean {
  if (s.kind === 'interval') {
    const anchor = s.anchor ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return false
    const diff = Math.round((parseISO(date).getTime() - parseISO(anchor).getTime()) / 86400000)
    return diff >= 0 && diff % s.every === 0
  }
  const weekdays = s.weekdays?.length ? s.weekdays : s.weekday != null ? [s.weekday] : []
  const w = isoWeekday(date) - 1
  const wt = s.weekTimes
  if (wt && Object.keys(wt).length) {
    const cell = wt[String(w)]?.[String(weekColumn(date, s.every, s.weekAnchor))]
    return cell !== undefined && cell !== null
  }
  if (!weekdays.includes(w)) return false
  const offset = s.weekOffset ?? 1
  return weekOffsetFor(date, s.every) === offset
}

/** Číslo sloupce (1..n) pokročilého rozvrhu pro dané datum.
 *  S ukotvením (weekAnchor) je 1. týden = týden ukotvení (obvykle vytvoření cvičení);
 *  bez ukotvení se použije epochová fáze cyklu (zpětná kompatibilita). */
export function weekColumn(date: string, n: number, anchor?: string | null): number {
  if (anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    const diff = weekIndexOf(date) - weekIndexOf(anchor)
    return ((diff % n) + n) % n + 1
  }
  return weekOffsetFor(date, n)
}

/** Efektivní plánovaný čas cvičení pro daný den (respektuje pokročilý rozvrh).
 *  Vrací null, pokud den nepatří do rozvrhu (jen u `weekTimes`). */
export function timeOn(s: ScheduleLike, date: string): string | null {
  if (s.kind !== 'weekly') return s.time ?? null
  const w = isoWeekday(date) - 1
  const wt = s.weekTimes
  if (wt && Object.keys(wt).length) {
    const cell = wt[String(w)]?.[String(weekColumn(date, s.every, s.weekAnchor))]
    if (cell !== undefined) return cell // null = tento den ve tomto týdnu volno
  }
  return s.time ?? null
}

/** Efektivní plánovaný konec cvičení pro daný den.
 *  U pokročilého rozvrhu: vlastní konec buňky (weekEndTimes) má přednost,
 *  jinak globální `endTime`; neexistuje-li žádný, vrací null (trénink bez konce). */
export function endOn(s: ScheduleLike, date: string): string | null {
  if (s.kind === 'weekly') {
    const wt = s.weekTimes
    if (wt && Object.keys(wt).length) {
      const w = isoWeekday(date) - 1
      const ends = s.weekEndTimes
      if (ends && Object.keys(ends).length) {
        const cell = ends[String(w)]?.[String(weekColumn(date, s.every, s.weekAnchor))]
        if (cell !== undefined) return cell // explicitní konec (nebo null) pro tento den/týden
      }
    }
  }
  return s.endTime ?? null
}

/** "Po", "Mon", "Mo", … – short weekday of the given date. */
export function weekdayNameShort(s: string): string {
  return weekdayShortName(isoWeekday(s))
}

/** "pondělí", "Monday", "Montag", … – full weekday of the given date. */
export function weekdayFull(s: string): string {
  return weekdayName(isoWeekday(s))
}

/** "leden", "January", "Januar", … for month number 1..12. */
export function monthNameOf(m1: number): string {
  return monthName(m1)
}

/** Locale date like "1. 9.", "Sep 1" or "1.9." (no year). */
export function formatDay(s: string): string {
  const d = parseISO(s)
  if (getLang() === 'en') {
    return `${monthNameOf(d.getMonth() + 1).slice(0, 3)} ${d.getDate()}`
  }
  return getLang() === 'de'
    ? `${d.getDate()}.${d.getMonth() + 1}.`
    : `${d.getDate()}. ${d.getMonth() + 1}.`
}

/** Chart tick label: short weekday + date, e.g. "Po 1. 9.", "Mon Sep 1", "Mo 1.9.". */
export function humanDate(s: string): string {
  return `${weekdayNameShort(s)} ${formatDay(s)}`
}