/** Thin client for the multi-user backend (see server.mjs).
 *
 * - Session (username + password) se pamatuje v localStorage – žádná ochrana,
 *   přesně jak bylo přání („kašli na ochranu, stačí JSON“).
 * - API base je defaultně stejná doména; pro lokální vývoj jde přesměrovat
 *   přes localStorage klíč `fit-tracker-api` (např. http://localhost:3000).
 */
import type { AppData } from './types'

export interface Session {
  username: string
  password: string
}

const SESSION_KEY = 'fit-tracker-session'

export function apiBase(): string {
  try {
    return localStorage.getItem('fit-tracker-api') ?? ''
  } catch {
    return ''
  }
}

/** base64 pro UTF-8 (btoa samo nezvládne české znaky v hesle). */
function b64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
}

function authHeader(s: Session): string {
  return 'Bearer ' + b64(`${s.username}:${s.password}`)
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (s && typeof s.username === 'string' && typeof s.password === 'string') return s
  } catch {
    /* ignore */
  }
  return null
}

export function saveSession(s: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(apiBase() + path, init)
  } catch {
    throw new Error('errNetwork')
  }
  let body: { ok?: boolean; error?: string; data?: T } = {}
  try {
    body = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `http ${res.status}`)
  }
  return body.data as T
}

export function apiRegister(username: string, password: string): Promise<AppData> {
  return request<AppData>('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function apiLogin(username: string, password: string): Promise<AppData> {
  return request<AppData>('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function apiGetData(s: Session): Promise<AppData> {
  return request<AppData>('/api/data', { headers: { Authorization: authHeader(s) } })
}

export function apiPutData(s: Session, data: AppData): Promise<void> {
  return request<void>('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader(s) },
    body: JSON.stringify(data),
  })
}

/* ---------------------------- admin ---------------------------- */

export interface AdminUserInfo {
  username: string
  exercises: number
  logs: number
  updatedAt: string | null
}

/** Seznam všech účtů (jen pro admina). */
export function apiAdminUsers(s: Session): Promise<AdminUserInfo[]> {
  return request<AdminUserInfo[]>('/api/admin/users', { headers: { Authorization: authHeader(s) } })
}

/** Tréninková data konkrétního uživatele (jen pro admina, read-only přehled). */
export function apiAdminUserData(s: Session, username: string): Promise<AppData> {
  return request<AppData>(`/api/admin/users/${encodeURIComponent(username)}/data`, {
    headers: { Authorization: authHeader(s) },
  })
}

/** Smazání účtu včetně jeho dat (jen pro admina). */
export function apiAdminDeleteUser(s: Session, username: string): Promise<void> {
  return request<void>(`/api/admin/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader(s) },
  })
}