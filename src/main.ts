import './style.css'
import { store } from './store'
import { initLang } from './i18n'
import { initTheme } from './theme'
import { initViews, renderApp, destroyCharts } from './views'
import { isoDate, mondayOf } from './dates'

const root = document.getElementById('app') as HTMLElement

/** Render with focus restoration for inputs that triggered the re-render. */
function render(): void {
  const active = document.activeElement as HTMLElement | null
  const fk = active?.getAttribute?.('data-fk') ?? null
  destroyCharts()
  renderApp(root)
  if (fk) {
    const el = root.querySelector(`[data-fk="${CSS.escape(fk)}"]`) as HTMLElement | null
    if (el) {
      el.focus()
      if (el instanceof HTMLInputElement && el.type === 'text') {
        const v = el.value
        el.setSelectionRange(v.length, v.length)
      }
    }
  }
}

function midnightCheck(): void {
  const today = isoDate(new Date())
  if (today !== store.today) {
    store.today = today
    store.currentWeekMonday = mondayOf(today)
    render()
  }
}

async function start(): Promise<void> {
  initLang()
  initTheme()
  await store.init()
  await store.resumeSession()
  store.today = isoDate(new Date())
  store.currentWeekMonday = mondayOf(store.today)
  initViews(render)
  store.onChange(render)
  render()
  window.setInterval(midnightCheck, 30_000)
}

void start()
