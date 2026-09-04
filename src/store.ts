/** Central app state + mutations. Components subscribe via store.onChange. */
import {
  bindFile, canUseFsApi, createBoundFile, FILE_NAME, getData, loadData, loadLegacyData, readHandle, saveData, writeHandle,
  type FsFileHandle,
} from './storage'
import {
  apiGetData, apiLogin, apiPutData, apiRegister, clearSession, getSession, saveSession,
} from './api'
import { emptyData, uid, type AppData, type Exercise, type ExerciseGroup, type LogEntry } from './types'

type Listener = () => void

class Store {
  data: AppData
  today: string
  currentWeekMonday: string
  /** Přihlášený uživatel (null = přihlašovací obrazovka). */
  user: string | null = null
  /** Stav synchronizace se serverem: null = zatím nic, true/false = poslední pokus. */
  syncOk: boolean | null = null
  fileHandle: FsFileHandle | null = null
  fileName: string | null = null
  fileStatus: 'none' | 'bound' = 'none'
  private listeners = new Set<Listener>()
  private syncTimer: number | undefined
  private pendingSync: AppData | null = null

  constructor() {
    this.data = { version: 1, exercises: [], logs: [], groups: [] }
    this.today = ''
    this.currentWeekMonday = ''
  }

  async init(): Promise<void> {
    this.data = await loadData()
  }

  /* ------------------------- přihlášení / účty ------------------------- */

  async login(username: string, password: string): Promise<void> {
    const data = await apiLogin(username, password)
    await this.activateUser(username, password, data)
  }

  async register(username: string, password: string): Promise<void> {
    const data = await apiRegister(username, password)
    await this.activateUser(username, password, data)
  }

  /** Je přihlášený vestavěný admin účet? */
  isAdmin(): boolean {
    return (this.user ?? '').toLowerCase() === 'admin'
  }

  /** Při startu obnoví uloženou session a stáhne data ze serveru. */
  async resumeSession(): Promise<void> {
    const session = getSession()
    if (!session) return
    this.user = session.username
    try {
      const data = await apiGetData(session)
      this.syncOk = true
      await this.commit(data)
    } catch {
      // Server nedostupný – necháme lokální cache, aplikace funguje offline.
      this.syncOk = false
    }
  }

  private async activateUser(username: string, password: string, serverData: AppData): Promise<void> {
    this.user = username
    saveSession({ username, password })
    this.syncOk = true
    // Prázdný nový účet dostane data, která už v tomto zařízení byla (migrace).
    if (serverData.exercises.length === 0 && serverData.logs.length === 0 && serverData.groups.length === 0) {
      const legacy = await loadLegacyData()
      if (legacy && (legacy.exercises.length || legacy.logs.length || legacy.groups.length)) {
        serverData = legacy
        try {
          await apiPutData({ username, password }, serverData)
        } catch {
          this.syncOk = false
        }
      }
    }
    await this.commit(serverData)
  }

  async logout(): Promise<void> {
    this.user = null
    this.syncOk = null
    clearSession()
    this.pendingSync = null
    if (this.syncTimer !== undefined) {
      clearTimeout(this.syncTimer)
      this.syncTimer = undefined
    }
    this.data = emptyData()
    for (const fn of this.listeners) fn()
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private async commit(next: AppData): Promise<void> {
    this.data = next
    await saveData(next, this.user)
    this.scheduleSync(next)
    for (const fn of this.listeners) fn()
  }

  /** Odeslání na server s krátkým zpožděním (debounce) – poslední verze vyhrává. */
  private scheduleSync(next: AppData): void {
    if (!this.user) return
    this.pendingSync = next
    if (this.syncTimer !== undefined) return
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = undefined
      const data = this.pendingSync
      this.pendingSync = null
      const session = this.user ? getSession() : null
      if (!session || !data) return
      apiPutData(session, data)
        .then(() => {
          this.syncOk = true
          for (const fn of this.listeners) fn()
        })
        .catch(() => {
          this.syncOk = false
          for (const fn of this.listeners) fn()
        })
    }, 600)
  }

  mutate(fn: (d: AppData) => AppData): Promise<void> {
    return this.commit(fn(structuredClone(this.data)))
  }

  /** Replace whole state (used by JSON import). */
  async replaceAll(next: AppData): Promise<void> {
    await this.commit(next)
  }

  /* -------------------------- exercises -------------------------- */

  addExercise(input: Omit<Exercise, 'id' | 'archived' | 'createdAt'>): Promise<void> {
    const ex: Exercise = { ...input, id: uid(), archived: false, createdAt: new Date().toISOString() }
    return this.mutate((d) => ({ ...d, exercises: [...d.exercises, ex] }))
  }

  updateExercise(id: string, patch: Partial<Exercise>): Promise<void> {
    return this.mutate((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
  }

  /** Exercises are soft-removed (archived) so past logs stay consistent. */
  archiveExercise(id: string): Promise<void> {
    return this.updateExercise(id, { archived: true })
  }

  restoreExercise(id: string): Promise<void> {
    return this.updateExercise(id, { archived: false })
  }

  /** Hard delete: removes the exercise AND its log entries. */
  deleteExercise(id: string): Promise<void> {
    return this.mutate((d) => ({
      ...d,
      exercises: d.exercises.filter((e) => e.id !== id),
      logs: d.logs.filter((l) => l.exerciseId !== id),
    }))
  }

  /* ---------------------------- groups ---------------------------- */

  addGroup(input: Omit<ExerciseGroup, 'id'>): Promise<void> {
    const g: ExerciseGroup = { ...input, id: uid() }
    return this.mutate((d) => ({ ...d, groups: [...d.groups, g] }))
  }

  updateGroup(id: string, patch: Partial<ExerciseGroup>): Promise<void> {
    return this.mutate((d) => ({
      ...d,
      groups: d.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }))
  }

  /** Removing a folder never touches the exercises themselves. */
  deleteGroup(id: string): Promise<void> {
    return this.mutate((d) => ({ ...d, groups: d.groups.filter((g) => g.id !== id) }))
  }

  /* ---------------------------- logs ----------------------------- */

  setLog(date: string, exerciseId: string, patch: Partial<LogEntry>): Promise<void> {
    return this.mutate((d) => {
      const idx = d.logs.findIndex((l) => l.date === date && l.exerciseId === exerciseId)
      if (idx >= 0) {
        d.logs[idx] = { ...d.logs[idx], ...patch, updatedAt: new Date().toISOString() }
      } else {
        d.logs.push({
          id: uid(),
          date,
          exerciseId,
          done: patch.done ?? false,
          value: patch.value ?? null,
          note: patch.note ?? '',
          updatedAt: new Date().toISOString(),
        })
      }
      return d
    })
  }

  toggleLog(date: string, exerciseId: string): Promise<void> {
    const current = this.data.logs.find((l) => l.date === date && l.exerciseId === exerciseId)
    return this.setLog(date, exerciseId, { done: !current?.done })
  }

  /* ------------------------ file binding ------------------------- */

  fsSupported(): boolean {
    return canUseFsApi()
  }

  async openAndLoadFile(): Promise<{ ok: boolean; error?: string }> {
    const handle = await bindFile()
    if (!handle) return { ok: false }
    try {
      const data = await readHandle(handle)
      this.fileHandle = handle
      this.fileName = handle.name
      this.fileStatus = 'bound'
      await this.commit(data)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async createAndSaveFile(): Promise<{ ok: boolean; error?: string }> {
    const handle = await createBoundFile()
    if (!handle) return { ok: false }
    try {
      await writeHandle(handle, getData())
      this.fileHandle = handle
      this.fileName = handle.name
      this.fileStatus = 'bound'
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async saveToFile(): Promise<{ ok: boolean; error?: string }> {
    if (!this.fileHandle) return { ok: false, error: 'Není vybraný soubor.' }
    try {
      await writeHandle(this.fileHandle, getData())
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  fileLabel(): string {
    return this.fileName ?? FILE_NAME
  }
}

export const store = new Store()
