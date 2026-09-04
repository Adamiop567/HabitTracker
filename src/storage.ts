/** Persistence layer.
 *
 * - Primary store: IndexedDB via idb-keyval (works on every platform, survives restarts).
 * - The whole state can be exported to / imported from a `fit-tracker-data.json` file.
 * - On Chromium desktop browsers (Chrome/Edge on macOS & Windows) the File System
 *   Access API lets us bind a real file on disk and save with one click.
 */
import { get, set } from 'idb-keyval'
import { t } from './i18n'
import { DATA_VERSION, emptyData, PALETTE, uid, type AppData, type Exercise, type ExerciseGroup, type LogEntry, type ScheduleKind } from './types'

const LEGACY_KEY = 'fit-tracker-data-v1'
const FILE_NAME = 'fit-tracker-data.json'

let cache: AppData | null = null

/** Klíč offline cache – po přihlášení má každý uživatel vlastní. */
function keyFor(user: string | null): string {
  return user ? `fit-tracker-data-v1-${user}` : LEGACY_KEY
}

export function getData(): AppData {
  return cache ?? emptyData()
}

export async function loadData(user: string | null = null): Promise<AppData> {
  try {
    const stored = await get<AppData>(keyFor(user))
    if (stored && Array.isArray(stored.exercises) && Array.isArray(stored.logs)) {
      cache = normalize(stored)
      return cache
    }
  } catch (err) {
    console.warn('IndexedDB unavailable, using in-memory store', err)
  }
  cache = emptyData()
  return cache
}

export async function saveData(next: AppData, user: string | null = null): Promise<void> {
  cache = next
  try {
    await set(keyFor(user), next)
  } catch (err) {
    console.warn('Persist failed (in-memory only this session)', err)
  }
}

/** Stará offline data z doby před loginy – použijí se jako výchozí obsah nového účtu. */
export async function loadLegacyData(): Promise<AppData | null> {
  try {
    const stored = await get<AppData>(LEGACY_KEY)
    if (stored && Array.isArray(stored.exercises) && Array.isArray(stored.logs)) {
      return normalize(stored)
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Defensive cleanup for imported/hand-edited files, incl. schema v1 → v2 migration.
 *
 * v1 used `weekday` (single day) + `kind: 'monthly'` for "every N days", which was
 * actually day-of-month. v2 uses `weekdays[]` (multi-day weekly) and `kind: 'interval'`
 * with an `anchor` date — the honest "every N days". Legacy data is migrated accordingly.
 */
function normalize(raw: { exercises?: unknown[]; logs?: unknown[]; groups?: unknown[] }): AppData {
  const toNum = (v: unknown, fb: number): number => {
    const n = Math.floor(Number(v))
    return Number.isFinite(n) ? n : fb
  }
  const mod7 = (v: unknown): number => ((toNum(v, 0) % 7) + 7) % 7
  const asDate = (v: unknown): string | null =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(0, 10) : null

  const exercises: Exercise[] = (raw.exercises ?? []).map((e, idx) => {
    const r = e as unknown as Record<string, unknown>
    const kind: ScheduleKind = r.kind === 'weekly' ? 'weekly' : 'interval' // legacy 'monthly' → interval
    const every = Math.max(1, toNum(r.every, 1))
    const weekdays =
      kind === 'weekly' && Array.isArray(r.weekdays) && (r.weekdays as unknown[]).length
        ? [...new Set((r.weekdays as unknown[]).map(mod7))].sort((a, b) => a - b)
        : [mod7(r.weekday)]
    const anchor =
      kind === 'interval'
        ? (asDate(r.anchor) ??
            asDate(typeof r.createdAt === 'string' ? r.createdAt.slice(0, 10) : null) ??
            '2000-01-01')
        : null
    // v5: week-cycle offset (odd/even weeks). Default 1 = first week of the cycle
    // (matches the pre-v5 behavior where every-N-week schedules ran from the epoch).
    const weekOffset =
      kind === 'weekly' ? Math.min(every, Math.max(1, toNum(r.weekOffset, 1))) : 1
    return {
      id: typeof r.id === 'string' && r.id ? r.id : uid(),
      name: String(r.name ?? '').slice(0, 80),
      color:
        typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color)
          ? r.color
          : PALETTE[idx % PALETTE.length],
      kind,
      every,
      weekOffset,
      weekdays,
      anchor,
      time: typeof r.time === 'string' && /^\d{2}:\d{2}$/.test(r.time) ? r.time : '08:00',
      endTime:
        typeof r.endTime === 'string' && /^\d{2}:\d{2}$/.test(r.endTime) ? r.endTime : null,
      // v6: pokročilý rozvrh (den → týden cyklu → čas). Předává se beze změny, jen se očistí.
      weekTimes: normWeekTimes(r.weekTimes),
      unit: typeof r.unit === 'string' && r.unit.trim() ? r.unit : null,
      archived: !!r.archived,
      createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : new Date().toISOString(),
    }
  })
  const ids = new Set(exercises.map((x) => x.id))
  // v3: user-created chart folders. Dangling exerciseIds are dropped defensively.
  const groups: ExerciseGroup[] = (raw.groups ?? [])
    .filter((g) => g && typeof (g as Record<string, unknown>).name === 'string')
    .map((g, idx) => {
      const r = g as unknown as Record<string, unknown>
      const gids = Array.isArray(r.exerciseIds) ? (r.exerciseIds as unknown[]) : []
      const seen = new Set<string>()
      const exerciseIds: string[] = []
      for (const id of gids) {
        const s = String(id ?? '')
        if (ids.has(s) && !seen.has(s)) { seen.add(s); exerciseIds.push(s) }
      }
      return {
        id: typeof r.id === 'string' && r.id ? r.id : uid(),
        name: String(r.name ?? '').trim().slice(0, 40) || `Group ${idx + 1}`,
        color:
          typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color)
            ? r.color
            : PALETTE[idx % PALETTE.length],
        exerciseIds,
      }
    })
  const logs: LogEntry[] = (raw.logs ?? [])
    .filter((l) => {
      const r = l as unknown as Record<string, unknown>
      return ids.has(String(r.exerciseId ?? '')) && asDate(r.date) !== null
    })
    .map((l) => {
      const r = l as unknown as Record<string, unknown>
      return {
        id: typeof r.id === 'string' && r.id ? r.id : uid(),
        date: String(r.date),
        exerciseId: String(r.exerciseId),
        done: !!r.done,
        value: typeof r.value === 'number' && Number.isFinite(r.value) ? r.value : null,
        note: typeof r.note === 'string' ? r.note : '',
        updatedAt: typeof r.updatedAt === 'string' && r.updatedAt ? r.updatedAt : new Date().toISOString(),
      }
    })
  return { version: DATA_VERSION, exercises, logs, groups }
}

/** Čisté předání pokročilého rozvrhu: den 0..6 → týden cyklu 1..N → "HH:MM" | null. */
function normWeekTimes(raw: unknown): Record<string, Record<string, string | null>> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, Record<string, string | null>> = {}
  for (const [d, cols] of Object.entries(raw as Record<string, unknown>)) {
    const day = Number(d)
    if (!Number.isInteger(day) || day < 0 || day > 6) continue
    if (!cols || typeof cols !== 'object' || Array.isArray(cols)) continue
    const cell: Record<string, string | null> = {}
    for (const [c, v] of Object.entries(cols as Record<string, unknown>)) {
      const col = Number(c)
      if (!Number.isInteger(col) || col < 1 || col > 365) continue
      if (v === null || v === undefined) { cell[String(col)] = null; continue }
      if (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)) cell[String(col)] = v
    }
    if (Object.keys(cell).length) out[String(day)] = cell
  }
  return Object.keys(out).length ? out : undefined
}

/* ----------------------------- JSON file I/O ----------------------------- */

export function toJson(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)
}

export async function parseJsonFile(file: File): Promise<AppData> {
  const text = await file.text()
  const raw = JSON.parse(text)
  if (!raw || !Array.isArray(raw.exercises) || !Array.isArray(raw.logs)) {
    throw new Error(t('errInvalidFile'))
  }
  return normalize(raw)
}

export function downloadJson(data: AppData): void {
  const blob = new Blob([toJson(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* --------------------- File System Access API (desktop) --------------------- */

type HandleFs = {
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FsFileHandle>
}

type WindowWithFs = Window & {
  showSaveFilePicker?: (opts?: unknown) => Promise<FsFileHandle>
  showOpenFilePicker?: (opts?: unknown) => Promise<FsFileHandle[]>
}

interface FsFileHandle {
  name: string
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>
  getFile: () => Promise<File>
}

export function canUseFsApi(): boolean {
  return typeof (window as WindowWithFs).showSaveFilePicker === 'function'
}

/** Ask user to pick a .json file; remember the handle for one-click saves. */
export async function bindFile(): Promise<FsFileHandle | null> {
  const w = window as WindowWithFs
  if (!w.showOpenFilePicker) return null
  try {
    const [handle] = await w.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    })
    return handle
  } catch {
    return null // user cancelled
  }
}

export async function createBoundFile(): Promise<FsFileHandle | null> {
  const w = window as WindowWithFs
  if (!w.showSaveFilePicker) return null
  try {
    return await w.showSaveFilePicker({
      suggestedName: FILE_NAME,
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    })
  } catch {
    return null
  }
}

export async function writeHandle(handle: FsFileHandle, data: AppData): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(toJson(data))
  await writable.close()
}

export async function readHandle(handle: FsFileHandle): Promise<AppData> {
  const file = await handle.getFile()
  return parseJsonFile(file)
}

export { FILE_NAME }
export type { FsFileHandle }
