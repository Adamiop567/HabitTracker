/** Themes (appearance). Persisted in localStorage, applied via data-theme on <html>. */
import { t } from './i18n'

export type ThemeId = 'dark' | 'light' | 'loki' | 'dionysus' | 'garmadon'

export interface ThemeDef {
  id: ThemeId
  icon: string
  /** Proper name kept across languages (Loki themes). */
  name?: string
}

export const THEMES: ThemeDef[] = [
  { id: 'dark', icon: '🌙' },
  { id: 'light', icon: '☀️' },
  { id: 'loki', icon: '👑', name: 'SIr Jonathan' },
  { id: 'dionysus', icon: '🍇', name: 'Dionysus' },
  { id: 'garmadon', icon: '🐍', name: 'Lord Garmadon' },
]

/** Localized option label, e.g. "🌙 Tmavý" / "🌙 Dark" / "🌙 Dunkel". */
export function themeLabel(id: ThemeId): string {
  const th = THEMES.find((x) => x.id === id)
  if (!th) return id
  if (th.name) return `${th.icon} ${th.name}`
  return `${th.icon} ${t(id === 'dark' ? 'themeDark' : 'themeLight')}`
}

const KEY = 'fit-tracker-theme'

/** Matches the --bg of each theme, used for the browser chrome color. */
const META_COLORS: Record<ThemeId, string> = {
  dark: '#0b1220',
  light: '#f3f5fa',
  loki: '#0c0c09',
  dionysus: '#140d10',
  garmadon: '#0d0c11',
}

export function getTheme(): ThemeId {
  const v = localStorage.getItem(KEY) as ThemeId | null
  return v && THEMES.some((t) => t.id === v) ? v : 'dark'
}

export function setTheme(id: ThemeId): void {
  localStorage.setItem(KEY, id)
  document.documentElement.dataset.theme = id
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', META_COLORS[id])
}

/** Call once at startup so the persisted theme is applied before first render. */
export function initTheme(): void {
  setTheme(getTheme())
}