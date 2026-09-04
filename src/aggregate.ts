/** Read-only aggregations over the data used by the UI and charts. */
import { addDays, formatDay, isoWeekday, occursOn } from './dates'
import type { AppData, Exercise, LogEntry } from './types'

export function activeExercises(data: AppData): Exercise[] {
  return data.exercises.filter((e) => !e.archived)
}

export function logFor(data: AppData, date: string, exerciseId: string): LogEntry | undefined {
  return data.logs.find((l) => l.date === date && l.exerciseId === exerciseId)
}

/** Occurrences (planned) for one day. `ids` optionally restricts the exercises (chart folders). */
export function planForDay(
  data: AppData, date: string, ids?: ReadonlySet<string> | null,
): Exercise[] {
  return activeExercises(data).filter((e) => (!ids || ids.has(e.id)) && occursOn(e, date))
}

/** Logs that were added manually on a day where the exercise is NOT scheduled that day.
 *  These are real occurrences of that day (shown in the week table, counted in stats),
 *  but they are not part of the recurring plan. `ids` optionally restricts the exercises. */
export function manualLogsForDay(data: AppData, date: string, ids?: ReadonlySet<string> | null): LogEntry[] {
  const planned = new Set(planForDay(data, date, ids).map((e) => e.id))
  return data.logs.filter((l) =>
    l.date === date &&
    !planned.has(l.exerciseId) &&
    data.exercises.some((e) => e.id === l.exerciseId && !e.archived && (!ids || ids.has(e.id))),
  )
}

export interface DayStats {
  total: number
  done: number
  missed: number
  future: number
}

export function dayStats(data: AppData, date: string, today: string, ids?: ReadonlySet<string> | null): DayStats {
  // every occurrence of the day: planned workouts + manually added logs
  const plan = planForDay(data, date, ids)
  const extras = manualLogsForDay(data, date, ids)
  const done = plan.filter((ex) => logFor(data, date, ex.id)?.done).length +
    extras.filter((l) => l.done).length
  let missed = 0
  let future = 0
  for (const ex of plan) {
    if (logFor(data, date, ex.id)?.done) continue
    if (date <= today) missed++
    else future++
  }
  for (const l of extras) {
    if (l.done) continue
    if (date <= today) missed++
    else future++
  }
  return { total: plan.length + extras.length, done, missed, future }
}

export interface WeekTotals {
  total: number
  done: number
  missed: number
  upcoming: number
}

export function weekTotals(
  data: AppData, monday: string, today: string, ids?: ReadonlySet<string> | null,
): WeekTotals {
  let total = 0, done = 0, missed = 0, upcoming = 0
  for (let i = 0; i < 7; i++) {
    const st = dayStats(data, addDays(monday, i), today, ids)
    total += st.total
    done += st.done
    missed += st.missed
    upcoming += st.future
  }
  return { total, done, missed, upcoming }
}

/** History entries for one exercise over a date range [from..to] — chart source. */
export interface ExercisePoint {
  date: string
  done: boolean
  planned: boolean
  value: number | null
}

export function exerciseHistory(data: AppData, ex: Exercise, from: string, to: string): ExercisePoint[] {
  const points: ExercisePoint[] = []
  for (let d = from; d <= to; ) {
    const log = logFor(data, d, ex.id)
    const planned = occursOn(ex, d)
    // planned occurrences (even when missed) + manually logged days
    if (planned || log) {
      points.push({ date: d, planned, done: !!log?.done, value: log?.done ? log.value : null })
    }
    d = addDays(d, 1)
  }
  return points
}

/** Weekly aggregation across last N weeks. `units` sums measured values per exercise,
 *  `sessions` counts completed workouts per exercise (the volume metric of checkbox-only
 *  exercises). `ids` optionally restricts the exercises (chart folders). */
export interface WeekVolume {
  weekStart: string
  units: { [exerciseId: string]: number }
  sessions: { [exerciseId: string]: number }
  doneCount: number
  plannedCount: number
}

export function volumeByWeek(
  data: AppData, weeks: number, today: string, ids?: ReadonlySet<string> | null,
): WeekVolume[] {
  const monday = addDays(today, -(isoWeekday(today) - 1) - (weeks - 1) * 7)
  const out: WeekVolume[] = []
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(monday, w * 7)
    const vol: WeekVolume = { weekStart: ws, units: {}, sessions: {}, doneCount: 0, plannedCount: 0 }
    for (let i = 0; i < 7; i++) {
      const day = addDays(ws, i)
      for (const ex of planForDay(data, day, ids)) {
        vol.plannedCount++
        const log = logFor(data, day, ex.id)
        if (log?.done) {
          vol.doneCount++
          vol.sessions[ex.id] = (vol.sessions[ex.id] ?? 0) + 1
          if (ex.unit && log.value != null) {
            vol.units[ex.id] = (vol.units[ex.id] ?? 0) + log.value
          }
        }
      }
      // manually added, completed sessions count as real workouts that week
      for (const l of manualLogsForDay(data, day, ids)) {
        if (!l.done) continue
        const ex = data.exercises.find((e) => e.id === l.exerciseId)
        if (!ex) continue
        vol.doneCount++
        vol.sessions[ex.id] = (vol.sessions[ex.id] ?? 0) + 1
        if (ex.unit && l.value != null) {
          vol.units[ex.id] = (vol.units[ex.id] ?? 0) + l.value
        }
      }
    }
    out.push(vol)
  }
  return out
}

/** Start-of-week label like "1. 9." / "Sep 1" / "1.9." */
export function weekLabel(monday: string): string {
  return formatDay(monday)
}
