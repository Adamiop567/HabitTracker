/** Shared types for the Habit Tracker app. */

export type ScheduleKind = 'weekly' | 'interval'

/** A recurring planned workout (e.g. "bicíáky every Monday 8:00"). */
export interface Exercise {
  id: string
  name: string
  color: string
  /** weekly = every Nth week on chosen weekdays; interval = every Nth day from an anchor date */
  kind: ScheduleKind
  /** weekly: every N weeks (1 = every week). interval: every N days (1 = daily) */
  every: number
  /** weekly: which week of the N-week cycle (1..every, 1 = first week). interval: always 1 */
  weekOffset: number
  /** weekly: weekdays 0=Mon .. 6=Sun (multiple allowed, e.g. Mon+Wed+Fri). interval: [] */
  weekdays: number[]
  /** interval: reference date (YYYY-MM-DD) from which "every N days" is counted. weekly: null */
  anchor: string | null
  time: string // "HH:MM" – planned start
  /** optional planned end "HH:MM". null => duration assumed as 1 minute for the timeline */
  endTime: string | null
  /** unit for measured value, e.g. "km", "min". null => checkbox-only exercise */
  unit: string | null
  archived: boolean
  createdAt: string
}

/** One logged workout instance on a specific day. */
export interface LogEntry {
  id: string
  date: string // YYYY-MM-DD
  exerciseId: string
  done: boolean
  /** measured value (unit from exercise); null for checkbox-only */
  value: number | null
  note: string
  updatedAt: string
}

/** A user-made folder grouping exercises so charts stay readable. */
export interface ExerciseGroup {
  id: string
  name: string
  color: string
  exerciseIds: string[]
}

export interface AppData {
  version: number
  exercises: Exercise[]
  logs: LogEntry[]
  groups: ExerciseGroup[]
}

export const DATA_VERSION = 5

/** 16 colors picked for good contrast on dark UI, assigned round-robin. */
export const PALETTE = [
  '#f97316', '#38bdf8', '#a78bfa', '#4ade80', '#f472b6', '#facc15',
  '#2dd4bf', '#fb7185', '#818cf8', '#a3e635', '#fb923c', '#34d399',
  '#f87171', '#22d3ee', '#c084fc', '#fbbf24',
]

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6)
}

export function emptyData(): AppData {
  return { version: DATA_VERSION, exercises: [], logs: [], groups: [] }
}
