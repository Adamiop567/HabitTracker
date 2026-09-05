/** Views: week table, day detail, charts, exercise manager, data panel. */
import { h, clear } from './ui'
import { store } from './store'
import {
  dayStats, exerciseHistory, logFor, manualLogsForDay, planForDay,
  volumeByWeek, weekLabel, weekTotals, activeExercises, type DayStats,
} from './aggregate'
import { addDays, formatDay, humanDate, mondayOf, timeOn, weekColumn, weekdayFull, weekOffsetFor } from './dates'
import { LANGS, LANG_LABELS, getLang, setLang, t, weekdaysFull, weekdaysShort } from './i18n'
import { apiAdminDeleteUser, apiAdminUserData, apiAdminUsers, getSession, type AdminUserInfo } from './api'
import { downloadJson, FILE_NAME, parseJsonFile } from './storage'
import { THEMES, getTheme, setTheme, themeLabel, type ThemeId } from './theme'
import { buildCheckHistoryChart, buildDailyChart, buildHistoryChart, buildStackedChart, buildWeekDoughnut, destroyCharts } from './charts'
import { PALETTE, type AppData, type Exercise, type ExerciseGroup, type LogEntry } from './types'

export type AppView =
  | { name: 'week' }
  | { name: 'day'; date: string }
  | { name: 'charts' }
  | { name: 'exercises' }
  | { name: 'data' }
  | { name: 'admin' }

let currentView: AppView = { name: 'week' }
let rerender: () => void = () => {}
let chartsSelectedId: string | null = null

export function initViews(render: () => void): void {
  rerender = render
}

export function navigate(v: AppView): void {
  currentView = v
  rerender()
}

/* ============================== WEEK VIEW ============================== */

function shiftWeek(delta: number): void {
  if (delta === 0) store.currentWeekMonday = mondayOf(store.today)
  else store.currentWeekMonday = addDays(store.currentWeekMonday, delta * 7)
  rerender()
}

function renderWeek(root: HTMLElement): void {
  const d = store.data
  const monday = store.currentWeekMonday
  const totals = weekTotals(d, monday, store.today)

  const label = h('div', { class: 'week-label' }, `${formatDay(monday)} – ${formatDay(addDays(monday, 6))}`)
  const toolbar = h('div', { class: 'toolbar' },
    h('button', { class: 'btn', onclick: () => shiftWeek(-1) }, t('prev')),
    h('button', { class: 'btn ghost', onclick: () => shiftWeek(0) }, t('today')),
    label,
    h('button', { class: 'btn', onclick: () => shiftWeek(1) }, t('next')),
  )

  const progressPct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0
  const captionBits = [t('weekDone', { done: totals.done, total: totals.total })]
  if (totals.missed) captionBits.push(t('missN', { n: totals.missed }))
  if (totals.upcoming) captionBits.push(t('upcomingN', { n: totals.upcoming }))
  const progress = h('div', {},
    h('div', { class: 'progress-track' },
      h('div', { class: 'progress-fill', style: `width:${progressPct}%` })),
    h('div', { class: 'progress-caption' }, captionBits.join(' · ')),
  )

  const rows: HTMLElement[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i)
    const st = dayStats(d, date, store.today)
    const plan = planForDay(d, date)
      .slice()
      .sort((a, b) => exTimeOn(a, date).localeCompare(exTimeOn(b, date)))
    const isToday = date === store.today
    const isPast = date < store.today

    let badge: HTMLElement
    if (st.total === 0) {
      badge = h('span', { class: 'count-badge zero' }, '—')
    } else if (isPast && st.missed > 0 && st.done < st.total) {
      badge = h('span', { class: 'count-badge miss' }, t('missingN', { done: st.done, total: st.total, n: st.missed }))
    } else if (date > store.today && st.done === 0) {
      badge = h('span', { class: 'count-badge plan' }, t('planN', { n: st.total }))
    } else if (st.done === st.total) {
      badge = h('span', { class: 'count-badge ok' }, `${st.done}/${st.total} ✓`)
    } else {
      badge = h('span', { class: 'count-badge partial' }, `${st.done}/${st.total}`)
    }

    // manually added activities also belong to this day (marked with ＋)
    const extras = manualLogsForDay(d, date)
      .map((l) => d.exercises.find((e) => e.id === l.exerciseId))
      .filter((e): e is Exercise => !!e)
      .sort((a, b) => a.time.localeCompare(b.time))
    const planCell = plan.length || extras.length
      ? [
          ...plan.map((ex) =>
            h('div', {},
              h('span', { class: 'ex-dot', style: `background:${ex.color}` }),
              `${ex.name} `,
              h('span', { class: 'chev' }, timeRangeOn(ex, date)),
            )),
          ...extras.map((ex) =>
            h('div', { class: 'ex-extra' },
              h('span', { class: 'ex-dot', style: `background:${ex.color}` }),
              h('span', { class: 'ex-plus' }, '＋'),
              `${ex.name} `,
              h('span', { class: 'chev' }, timeRange(ex)),
            )),
        ]
      : [h('span', { class: 'chev' }, t('noWorkout'))]

    rows.push(h('tr', { class: `day-row${isToday ? ' today' : ''}`, onclick: () => navigate({ name: 'day', date }) },
      h('td', {}, h('div', { class: 'day-name' }, weekdayFull(date), h('span', { class: 'num' }, formatDay(date)))),
      h('td', {}, ...planCell),
      h('td', {}, badge, h('span', { class: 'chev' }, ' ›')),
    ))
  }

  root.append(
    h('div', { class: 'card' }, toolbar, progress),
    h('div', { class: 'card' },
      h('table', { class: 'week' },
        h('thead', {}, h('tr', {}, h('th', {}, t('colDay')), h('th', {}, t('colPlan')), h('th', {}, t('colStatus')))),
        h('tbody', {}, rows),
      ),
      h('div', { class: 'hint', style: 'margin-top:8px' }, t('weekHint')),
    ),
  )
}

/* ============================== DAY VIEW ============================== */

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minToTime(m: number): string {
  const h = Math.floor(m / 60)
  const mm = Math.round(m % 60)
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Plánovaný začátek pro konkrétní den (pokročilý rozvrh: den/týden). */
function exTimeOn(ex: Exercise, date: string): string {
  return timeOn(ex, date) ?? ex.time
}

/** Planned end in minutes; exercises without endTime get a 1-minute duration. */
function exEndMin(ex: Exercise, date: string): number {
  const start = timeToMin(exTimeOn(ex, date))
  return ex.endTime ? Math.max(timeToMin(ex.endTime), start + 1) : start + 1
}

/** "08:00" or "08:00–09:00" (start only when no end time is set). */
function timeRange(ex: Exercise): string {
  return ex.endTime ? `${ex.time}–${ex.endTime}` : ex.time
}

/** "08:00" nebo „08:00–09:00“ pro konkrétní den (pokročilý rozvrh). */
function timeRangeOn(ex: Exercise, date: string): string {
  const t = exTimeOn(ex, date)
  return ex.endTime ? `${t}–${ex.endTime}` : t
}

function gapLabel(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Timeline "frame": the day's activities laid out on a time axis (order + gaps). */
function renderTimeline(root: HTMLElement, exs: Exercise[], date: string): void {
  const items = exs
    .map((ex) => ({ ex, start: timeToMin(exTimeOn(ex, date)), end: exEndMin(ex, date) }))
    .sort((a, b) => a.start - b.start || a.ex.name.localeCompare(b.ex.name))
  if (items.length === 0) return

  // visible window: padded around the first/last activity (min 1 hour wide)
  let ws = Math.max(0, items[0].start - 30)
  let we = Math.min(24 * 60, items[items.length - 1].end + 30)
  if (we - ws < 60) {
    const mid = (ws + we) / 2
    ws = Math.max(0, mid - 30)
    we = Math.min(24 * 60, mid + 30)
  }
  const span = we - ws
  const pct = (m: number): number => ((m - ws) / span) * 100

  const bar = h('div', { class: 'timeline-bar' })
  items.forEach((it, i) => {
    if (i > 0) {
      const prev = items[i - 1]
      const gap = it.start - prev.end
      if (gap > 0) {
        const gLeft = pct(prev.end)
        const gW = pct(it.start) - gLeft
        const label = gapLabel(gap)
        bar.append(h('div', {
          class: 'timeline-gap',
          style: `left:${gLeft}%;width:${gW}%`,
          title: label,
        }, gW >= 2.5 ? label : null))
      }
    }
    const left = pct(it.start)
    const width = Math.max(pct(it.end) - left, 1.3)
    const label = timeRangeOn(it.ex, date)
    bar.append(h('div', {
      class: 'timeline-block',
      style: `left:${left}%;width:${width}%;background:${it.ex.color}2e;border-color:${it.ex.color}`,
      title: `${it.ex.name} · ${label}`,
    },
      h('div', { class: 'tb-name' }, it.ex.name),
      h('div', { class: 'tb-time' }, label),
    ))
  })

  root.append(h('div', { class: 'card timeline-card' },
    h('div', { class: 'timeline-head' },
      h('span', { class: 'timeline-title' }, t('timelineTitle')),
      h('span', { class: 'timeline-sub' }, t('timelineHint')),
    ),
    bar,
    h('div', { class: 'timeline-ends' },
      h('span', {}, minToTime(ws)),
      h('span', {}, minToTime(we)),
    ),
  ))
}

function valueOr(s: string): number | null {
  const t = (s ?? '').trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

async function removeLog(date: string, exerciseId: string): Promise<void> {
  await store.mutate((d) => ({ ...d, logs: d.logs.filter((l) => !(l.date === date && l.exerciseId === exerciseId)) }))
}

function logCard(date: string, ex: Exercise, extra = false): HTMLElement {
  const log = logFor(store.data, date, ex.id)
  const done = !!log?.done

  const valueInput = h('input', {
    type: 'number', step: 'any', min: '0', placeholder: '—',
    value: log?.value != null ? String(log.value) : '',
    disabled: !done,
    'data-fk': `v:${date}:${ex.id}`,
    oninput: (e: Event) => {
      const v = valueOr((e.target as HTMLInputElement).value)
      void store.setLog(date, ex.id, { done: true, value: v })
    },
  })

  const check = h('input', {
    type: 'checkbox', checked: done, title: t('done'),
    onchange: (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked
      const patch: Partial<LogEntry> = { done: checked }
      if (!checked) patch.value = null
      void store.setLog(date, ex.id, patch)
    },
  })

  const info = h('div', { class: 'info' },
    h('div', {},
      h('span', { class: 'ex-dot', style: `background:${ex.color}` }),
      h('span', { class: 'ex-name' }, ex.name),
      h('span', { class: 'time-chip' }, timeRangeOn(ex, date)),
    ),
    ex.unit
      ? h('div', { class: 'value-row' },
          h('label', {}, t('performanceColon')),
          valueInput,
          h('span', { class: 'unit' }, ex.unit),
        )
      : h('div', { class: 'hint', style: 'margin-top:6px' }, t('unmeasuredHint')),
    h('input', {
      type: 'text', class: 'log-note', placeholder: t('notePlaceholder'),
      value: log?.note ?? '',
      'data-fk': `n:${date}:${ex.id}`,
      onchange: (e: Event) => void store.setLog(date, ex.id, { note: (e.target as HTMLInputElement).value }),
    }),
  )

  const actions = h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:8px' },
    check,
    extra
      ? h('button', { class: 'btn small ghost', title: t('removeFromDay'), onclick: () => void removeLog(date, ex.id) }, '🗑')
      : null,
  )

  return h('div', { class: 'log-card', style: done ? 'border-color:rgba(74,222,128,.45)' : undefined }, info, actions)
}

function renderDay(root: HTMLElement, date: string): void {
  const d = store.data
  const plan = planForDay(d, date)
  const isToday = date === store.today
  const isPast = date < store.today

  root.append(
    h('div', {},
      h('a', { class: 'back-link', onclick: () => navigate({ name: 'week' }) }, t('backToWeek')),
      h('div', { class: 'day-header' },
        h('h2', {}, `${weekdayFull(date)} ${formatDay(date)}`),
        isToday ? h('span', { class: 'count-badge plan' }, t('todayTag')) : null,
        isPast && !isToday ? h('span', { class: 'count-badge zero' }, t('pastTag')) : null,
      ),
    ),
  )

  // extra (manually added) logged exercises for this day
  const planIds = new Set(plan.map((p) => p.id))
  const extraExs = d.logs
    .filter((l) => l.date === date && !planIds.has(l.exerciseId))
    .map((l) => d.exercises.find((e) => e.id === l.exerciseId))
    .filter((e): e is Exercise => !!e && !e.archived)

  // timeline: order of the day's activities and the gaps between them
  renderTimeline(root, [...plan, ...extraExs], date)

  if (plan.length === 0 && extraExs.length === 0) {
    root.append(h('div', { class: 'notice' }, t('dayEmptyNotice')))
  }

  for (const ex of plan) {
    root.append(logCard(date, ex))
  }
  for (const ex of extraExs) {
    root.append(logCard(date, ex, true))
  }

  const remaining = activeExercises(d).filter((e) => !planIds.has(e.id) && !extraExs.some((x) => x.id === e.id))
  if (remaining.length > 0) {
    const details = h('details', { class: 'card' },
      h('summary', { style: 'cursor:pointer;color:var(--muted);font-size:0.86rem' },
        t('addOtherN', { n: remaining.length })))
    for (const ex of remaining) {
      details.append(h('div', { class: 'ex-item' },
        h('span', { class: 'ex-dot', style: `background:${ex.color}` }),
        h('div', { class: 'grow' }, h('div', { class: 'ex-name' }, ex.name)),
        h('button', { class: 'btn small', onclick: () => void store.setLog(date, ex.id, { done: false }) }, t('add')),
      ))
    }
    root.append(details)
  }
}

/* ============================== CHARTS VIEW ============================== */

/** Currently picked chart folder id; null = all exercises. */
let chartsGroupId: string | null = null

function chartScope(): { ids: ReadonlySet<string> | null; grp: ExerciseGroup | null; shown: Exercise[] } {
  const active = activeExercises(store.data)
  const grp = chartsGroupId ? (store.data.groups.find((g) => g.id === chartsGroupId) ?? null) : null
  if (!grp) return { ids: null, grp, shown: active }
  const ids = new Set(grp.exerciseIds)
  return { ids, grp, shown: active.filter((e) => ids.has(e.id)) }
}

function renderCharts(root: HTMLElement): void {
  const d = store.data
  const { ids, grp, shown } = chartScope()
  const measured = shown.filter((e) => e.unit)
  const checkOnly = shown.filter((e) => !e.unit)

  // ---- folder chips ----
  const chips: HTMLElement[] = []
  const allActive = chartsGroupId === null
  chips.push(h('button', {
    class: `chip${allActive ? ' active' : ''}`,
    onclick: () => { chartsGroupId = null; rerender() },
  }, t('allChip')))
  for (const g of d.groups) {
    const active = chartsGroupId === g.id
    chips.push(h('button', {
      class: `chip${active ? ' active' : ''}`,
      onclick: () => { chartsGroupId = active ? null : g.id; rerender() },
    },
      h('span', { class: 'ex-dot', style: `background:${g.color}` }),
      g.name,
    ))
  }
  root.append(h('div', { class: 'card' },
    h('div', { class: 'chip-row' },
      h('span', { class: 'chip-label' }, t('groupShow')),
      ...chips,
      h('span', { class: 'grow' }),
      h('button', { class: 'btn small', onclick: () => openGroupEditor(null) }, t('newGroup')),
      h('button', { class: 'btn small ghost', onclick: openGroupsManager }, t('manageGroups')),
    ),
  ))

  // ---- daily completion % ----
  root.append(h('div', { class: 'card' },
    h('h2', {}, t('chartsDoneTitle')),
    shown.length
      ? h('div', { class: 'chart-wrap' }, h('canvas', { id: 'c-daily' }))
      : h('div', { class: 'notice' }, grp ? t('folderEmptyChart') : t('noExercises')),
  ))
  if (shown.length === 0) return

  // ---- weekly stacked charts (volume for measured, completed sessions for checkbox) ----
  const weeks = volumeByWeek(d, 12, store.today, ids)
  const volLabels = weeks.map((w) => weekLabel(w.weekStart))
  const volSeries = measured.map((e) => ({
    label: e.name, color: e.color, data: weeks.map((w) => w.units[e.id] ?? 0),
  }))
  root.append(h('div', { class: 'card' },
    h('h2', {}, t('volumeTitle')),
    volSeries.length
      ? h('div', { class: 'chart-wrap' }, h('canvas', { id: 'c-volume' }))
      : h('div', { class: 'notice' }, t('noMeasuredVolume')),
  ))

  const sessSeries = checkOnly.map((e) => ({
    label: e.name, color: e.color, data: weeks.map((w) => w.sessions[e.id] ?? 0),
  }))
  if (sessSeries.length) {
    root.append(h('div', { class: 'card' },
      h('h2', {}, t('sessionsTitle')),
      h('div', { class: 'chart-wrap' }, h('canvas', { id: 'c-sessions' })),
    ))
  }

  // ---- this week doughnut ----
  const tot = weekTotals(d, mondayOf(store.today), store.today, ids)
  root.append(h('div', { class: 'card' },
    h('h2', {}, t('thisWeek')),
    tot.total
      ? h('div', { class: 'chart-wrap', style: 'height:240px' }, h('canvas', { id: 'c-week' }))
      : h('div', { class: 'notice' }, t('thisWeekEmpty')),
  ))

  // ---- per-exercise history (measured → performance line, checkbox → done/missed bars) ----
  if (!chartsSelectedId || !shown.some((e) => e.id === chartsSelectedId)) chartsSelectedId = shown[0].id
  const histEx = shown.find((e) => e.id === chartsSelectedId) ?? shown[0]
  chartsSelectedId = histEx.id
  const pts = exerciseHistory(d, histEx, addDays(store.today, -150), store.today).slice(-14)
  const historyCard = h('div', { class: 'card' },
    h('h2', {}, t('historyTitle')),
    h('select', {
      style: 'margin-bottom:10px',
      onchange: (e: Event) => { chartsSelectedId = (e.target as HTMLSelectElement).value; rerender() },
    },
      measured.length ? h('optgroup', { label: t('optMeasured') },
        measured.map((e) => h('option', { value: e.id, selected: e.id === chartsSelectedId }, e.name))) : null,
      checkOnly.length ? h('optgroup', { label: t('optCheck') },
        checkOnly.map((e) => h('option', { value: e.id, selected: e.id === chartsSelectedId }, e.name))) : null,
    ),
  )
  if (pts.length) {
    historyCard.append(h('div', { class: 'chart-wrap' }, h('canvas', { id: 'c-history' })))
    if (!histEx.unit) {
      historyCard.append(h('div', { class: 'chart-legend' },
        h('span', { class: 'lg-dot', style: 'background:var(--green)' }), t('done'),
        h('span', { class: 'lg-dot', style: 'background:var(--red)' }), t('missed'),
      ))
    }
  } else {
    historyCard.append(h('div', { class: 'notice' }, t('histNoData')))
  }
  root.append(historyCard)

  // ---- draw charts (after DOM insertion) ----
  const labels: string[] = []
  const pct: number[] = []
  for (let i = 27; i >= 0; i--) {
    const date = addDays(store.today, -i)
    const st = dayStats(d, date, store.today, ids)
    labels.push(humanDate(date))
    pct.push(st.total ? Math.round((st.done / st.total) * 100) : 0)
  }
  buildDailyChart(root.querySelector('#c-daily') as HTMLCanvasElement, labels, pct, 100)

  if (volSeries.length) {
    buildStackedChart(root.querySelector('#c-volume') as HTMLCanvasElement, volLabels, volSeries)
  }
  if (sessSeries.length) {
    buildStackedChart(root.querySelector('#c-sessions') as HTMLCanvasElement, volLabels, sessSeries)
  }
  if (tot.total) {
    buildWeekDoughnut(root.querySelector('#c-week') as HTMLCanvasElement, tot.done, tot.missed, tot.upcoming)
  }
  if (pts.length) {
    const chartEl = root.querySelector('#c-history') as HTMLCanvasElement
    if (histEx.unit) {
      buildHistoryChart(
        chartEl,
        pts.map((p) => formatDay(p.date)),
        pts.map((p) => (p.done && p.value != null ? p.value : null)),
        pts.map((p) => !p.done && p.date <= store.today),
      )
    } else {
      buildCheckHistoryChart(
        chartEl,
        pts.map((p) => formatDay(p.date)),
        pts.map((p) => (!p.done && p.date <= store.today ? 'missed' : 'done')),
      )
    }
  }
}

export { destroyCharts }

/* ============================== CHART FOLDERS (modals) ============================== */

function colorPickerRow(initial: string): { wrap: HTMLElement; getColor: () => string } {
  const colorIn = h('input', { type: 'color', title: t('customColor') })
  const swatches = PALETTE.map((c) => h('button', {
    class: 'swatch', style: `background:${c}`, 'data-color': c, title: c,
    onclick: () => pick(c),
  }))
  let choice = initial
  function pick(c: string): void {
    choice = c
    ;(colorIn as HTMLInputElement).value = c
    for (const s of swatches) {
      ;(s as HTMLElement).classList.toggle('selected', (s as HTMLElement).dataset.color === c.toLowerCase())
    }
  }
  pick(choice)
  return { wrap: h('div', { class: 'color-row' }, ...swatches, colorIn), getColor: () => choice }
}

/** Folder manager: list existing folders with edit/delete + create new ones. */
function openGroupsManager(): void {
  const d = store.data
  const countMembers = (g: ExerciseGroup): number => activeExercises(d).filter((e) => g.exerciseIds.includes(e.id)).length
  const rows = d.groups.map((g) => h('div', { class: 'ex-item' },
    h('span', { class: 'ex-dot', style: `background:${g.color}` }),
    h('div', { class: 'grow' },
      h('div', { class: 'ex-name' }, g.name),
      h('div', { class: 'ex-meta' }, t('membersCount', { n: countMembers(g) })),
    ),
    h('button', { class: 'btn small', onclick: () => openGroupEditor(g) }, t('edit')),
    h('button', {
      class: 'btn small danger',
      onclick: () => {
        if (!confirm(t('confirmDeleteGroup', { name: g.name }))) return
        void store.deleteGroup(g.id).then(() => {
          if (chartsGroupId === g.id) chartsGroupId = null
          openGroupsManager()
        })
      },
    }, t('delete')),
  ))
  modal(t('groupsTitle'), [
    rows.length ? h('div', {}, ...rows) : h('div', { class: 'notice' }, t('emptyGroups')),
    h('div', { class: 'hint' }, t('groupsHint')),
  ], [
    h('button', { class: 'btn', onclick: () => openGroupEditor(null) }, t('newGroup')),
    h('button', { class: 'btn ghost', onclick: closeModal }, t('cancel')),
  ])
}

/** Folder editor: name, color and a checklist of exercises. */
function openGroupEditor(g: ExerciseGroup | null): void {
  const d = store.data
  const name = h('input', { type: 'text', value: g?.name ?? '', placeholder: t('groupNamePh'), maxlength: '40' })
  const pick = colorPickerRow(g?.color ?? PALETTE[d.groups.length % PALETTE.length])
  const members = new Set<string>(g?.exerciseIds ?? [])
  const list = h('div', { class: 'group-check-list' })
  const avail = activeExercises(d)
  if (avail.length === 0) {
    list.append(h('div', { class: 'notice' }, t('noExercises')))
  } else {
    for (const ex of avail) {
      const cb = h('input', {
        type: 'checkbox', checked: members.has(ex.id),
        onchange: (e: Event) => {
          if ((e.target as HTMLInputElement).checked) members.add(ex.id)
          else members.delete(ex.id)
        },
      })
      list.append(h('label', { class: 'chk-row' },
        cb,
        h('span', { class: 'ex-dot', style: `background:${ex.color}` }),
        h('span', { class: 'ex-name' }, ex.name),
      ))
    }
  }

  function save(): void {
    const nameV = (name as HTMLInputElement).value.trim()
    if (!nameV) { (name as HTMLInputElement).focus(); return }
    const payload = { name: nameV, color: pick.getColor(), exerciseIds: [...members] }
    void (g ? store.updateGroup(g.id, payload) : store.addGroup(payload)).then(openGroupsManager)
  }

  modal(g ? t('editGroupTitle') : t('newGroupTitle'), [
    h('div', { class: 'form-grid' },
      h('div', {}, h('label', {}, t('groupNameLabel')), name),
      h('div', {}, h('label', {}, t('colorLabel')), pick.wrap),
      h('div', { class: 'full' }, h('label', {}, t('membersLabel')), list),
    ),
  ], [
    h('button', { class: 'btn ghost', onclick: () => (g ? openGroupsManager() : closeModal()) }, t('cancel')),
    h('button', { class: 'btn primary', onclick: save }, t('save')),
  ])
}

/* ============================== EXERCISES VIEW ============================== */

function scheduleText(ex: Exercise): string {
  if (ex.weekTimes && Object.keys(ex.weekTimes).length) return t('advSummary')
  if (ex.kind === 'interval') {
    return ex.every === 1 ? t('everyDaily') : t('everyNDays', { n: ex.every })
  }
  const wds = (ex.weekdays?.length ? ex.weekdays : [0]).slice().sort((a, b) => a - b)
  const full = weekdaysFull()
  const short = weekdaysShort()
  const list = wds.map((i) => (wds.length === 1 ? full[i] : short[i]) ?? '').join(', ')
  if (ex.every === 1) {
    return wds.length === 1 ? t('everyWeekday', { wd: list }) : t('everyWeekMulti', { list })
  }
  return t('everyNWeeksOff', { n: ex.every, o: ex.weekOffset ?? 1, list })
}

function exerciseRow(ex: Exercise, archived: boolean): HTMLElement {
  return h('div', { class: `ex-item${archived ? ' ex-archived' : ''}` },
    h('span', { class: 'ex-dot', style: `background:${ex.color}` }),
    h('div', { class: 'grow' },
      h('div', { class: 'ex-name' }, ex.name),
      h('div', { class: 'ex-meta' },
        scheduleText(ex), ' · ', timeRange(ex),
        ex.unit ? t('measuredUnit', { u: ex.unit }) : t('onlyCheck')),
    ),
    h('button', { class: 'btn small', onclick: () => openExerciseModal(ex) }, t('edit')),
    archived
      ? h('button', { class: 'btn small', onclick: () => void store.restoreExercise(ex.id) }, t('restore'))
      : h('button', { class: 'btn small ghost', onclick: () => void store.archiveExercise(ex.id) }, t('archive')),
    h('button', {
      class: 'btn small danger',
      onclick: () => { if (confirm(t('confirmDelete', { name: ex.name }))) void store.deleteExercise(ex.id) },
    }, t('delete')),
  )
}

function renderExercises(root: HTMLElement): void {
  const d = store.data
  const active = d.exercises.filter((e) => !e.archived)
  const archived = d.exercises.filter((e) => e.archived)

  root.append(h('div', { class: 'card' },
    h('h2', {}, t('exercisesTitle')),
    h('div', { class: 'hint', style: 'margin-bottom:10px' }, t('exercisesHint')),
    active.length === 0 ? h('div', { class: 'notice' }, t('noExercises')) : null,
    active.map((ex) => exerciseRow(ex, false)),
    h('button', { class: 'btn primary', style: 'margin-top:8px', onclick: () => openExerciseModal(null) }, t('newExercise')),
  ))

  if (archived.length) {
    root.append(h('div', { class: 'card' }, h('h2', {}, t('archiveTitle')), archived.map((ex) => exerciseRow(ex, true))))
  }
}

/* ============================== MODAL ============================== */

export function closeModal(): void {
  document.querySelector('.modal-backdrop')?.remove()
}

export function modal(title: string, body: HTMLElement[], actions: HTMLElement[]): void {
  closeModal()
  const box = h('div', { class: 'modal' }, h('h2', {}, title), ...body, h('div', { class: 'modal-actions' }, actions))
  const backdrop = h('div', {
    class: 'modal-backdrop',
    onclick: (e: Event) => { if (e.target === backdrop) closeModal() },
  }, box)
  document.body.append(backdrop)
}

function openExerciseModal(existing: Exercise | null): void {
  const ex = existing
  const name = h('input', { type: 'text', value: ex?.name ?? '', placeholder: t('exNamePlaceholder'), maxlength: '60' })
  const kindSel = h('select', { onchange: () => { updateKind(); updateWeekCycle() } },
    h('option', { value: 'weekly' }, t('weeklyKind')),
    h('option', { value: 'interval' }, t('monthlyKind')),
  )
  const everyNum = h('input', { type: 'number', min: '1', max: '365', value: String(ex?.every ?? 1), oninput: () => updateWeekCycle() })
  const timeIn = h('input', { type: 'time', value: ex?.time ?? '08:00' })
  const endIn = h('input', { type: 'time', value: ex?.endTime ?? '' })
  const timeField = h('div', {}, h('label', {}, t('timeLabel')), timeIn)
  const endField = h('div', {},
    h('label', {}, t('endTimeLabel')), endIn,
    h('div', { class: 'hint' }, t('endTimeHint')),
  )
  const unitIn = h('input', { type: 'text', value: ex?.unit ?? '', placeholder: 'km, min, opakování…', maxlength: '12' })

  /* ---- color picker ---- */
  const colorIn = h('input', {
    type: 'color', title: t('customColor'),
    oninput: (e: Event) => pickColor((e.target as HTMLInputElement).value),
  })
  const swatches = PALETTE.map((c) => h('button', {
    class: 'swatch', style: `background:${c}`, 'data-color': c, title: c,
    onclick: () => pickColor(c),
  }))
  let colorChoice = ex?.color ?? PALETTE[store.data.exercises.length % PALETTE.length]

  function pickColor(c: string): void {
    colorChoice = c
    ;(colorIn as HTMLInputElement).value = c
    for (const s of swatches) {
      s.classList.toggle('selected', (s as HTMLElement).dataset.color === c.toLowerCase())
    }
  }
  pickColor(colorChoice)

  ;(kindSel as HTMLSelectElement).value = ex?.kind ?? 'weekly'

  /* ---- multi-day selector (weekly schedules) ---- */
  const selectedDays = new Set<number>(
    ex?.kind === 'weekly' && ex.weekdays?.length ? ex.weekdays : [0],
  )
  const daysRow = h('div', { class: 'day-chips' })
  weekdaysFull().forEach((n, i) => {
    const chip = h('button', {
      type: 'button',
      class: 'day-chip' + (selectedDays.has(i) ? ' active' : ''),
      onclick: () => {
        if (selectedDays.has(i)) selectedDays.delete(i)
        else selectedDays.add(i)
        chip.classList.toggle('active', selectedDays.has(i))
      },
    }, n)
    daysRow.append(chip)
  })

  const weekdayField = h('div', {},
    h('label', {}, t('weekdayLabel')),
    daysRow,
    h('div', { class: 'hint' }, t('daysHint')),
  )
  const everyHint = h('div', { class: 'hint' }, '')
  const everyField = h('div', {}, h('label', {}, t('everyLabel')), everyNum, everyHint)

  /* ---- week-cycle selector: only for weekly schedules with N ≥ 2 ---- */
  const weekChips = h('div', { class: 'day-chips' })
  const weekCycleField = h('div', {},
    h('label', {}, t('weekCycleLabel')),
    weekChips,
    h('div', { class: 'hint' }, t('weekCycleHint')),
  )

  /* ---- pokročilý rozvrh: časy podle dnů × týdnů cyklu (absolutní výběr) ---- */
  const advToggle = h('input', {
    type: 'checkbox',
    checked: !!(ex?.weekTimes && Object.keys(ex.weekTimes).length),
  })
  const advNow = h('div', { class: 'hint' }, '')
  const schedGrid = h('div', { class: 'sched-grid', style: 'display:none' })
  const advTools = h('div', { class: 'adv-tools' })
  const advWrap = h('div', { class: 'full adv-wrap' },
    h('label', { class: 'adv-label' }, advToggle, ' ', t('advLabel')),
    h('div', { class: 'hint' }, t('advHint')),
    advTools,
    advNow,
    schedGrid,
  )
  /** cols[d][c] = čas buňky (den d, sloupec c) nebo '' = volno. */
  const cols: string[][] = []

  function firstFilled(): string | null {
    for (let d = 0; d < 7; d++) {
      for (const c of Object.keys(cols[d] ?? {})) {
        const v = cols[d][Number(c)]
        if (v) return v
      }
    }
    return null
  }
  function fillAll(): void {
    const t0 = firstFilled() ?? ((timeIn as HTMLInputElement).value || '08:00')
    const n = everyVal()
    for (let d = 0; d < 7; d++) {
      if (!cols[d]) cols[d] = []
      for (let c = 1; c <= n; c++) cols[d][c] = t0
    }
    renderGrid()
  }
  function clearAll(): void {
    const n = everyVal()
    for (let d = 0; d < 7; d++) if (cols[d]) for (let c = 1; c <= n; c++) cols[d][c] = ''
    renderGrid()
  }
  advTools.append(
    h('button', { type: 'button', class: 'btn small', onclick: fillAll }, t('advFillAll')),
    h('button', { type: 'button', class: 'btn small ghost', onclick: clearAll }, t('advClearAll')),
  )

  function everyVal(): number {
    return Math.min(365, Math.max(1, Math.floor(Number((everyNum as HTMLInputElement).value) || 1)))
  }

  function fillCols(): void {
    const n = everyVal()
    for (let d = 0; d < 7; d++) {
      if (!cols[d]) cols[d] = []
      cols[d].length = n + 1
      for (let c = 1; c <= n; c++) if (cols[d][c] === undefined) cols[d][c] = ''
    }
    const wt = ex?.weekTimes
    if (wt) {
      for (const [dd, by] of Object.entries(wt)) {
        const d = Number(dd)
        if (d < 0 || d > 6) continue
        for (const [cc, v] of Object.entries(by)) {
          const c = Number(cc)
          if (c < 1 || c > n) continue
          cols[d][c] = v === null ? '' : v
        }
      }
    }
  }
  fillCols()

  function renderGrid(): void {
    const kind = (kindSel as HTMLSelectElement).value
    const isWeekly = kind === 'weekly'
    const n = everyVal()
    const on = (advToggle as HTMLInputElement).checked && isWeekly
    ;(advWrap as HTMLElement).style.display = isWeekly ? '' : 'none'
    ;(schedGrid as HTMLElement).style.display = on ? '' : 'none'
    // Pokročilý rozvrh je absolutní – skryjeme staré ovladače, ať se nekříží.
    ;(weekdayField as HTMLElement).style.display = isWeekly && !on ? '' : 'none'
    ;(weekCycleField as HTMLElement).style.display = isWeekly && !on && n >= 2 ? '' : 'none'
    ;(timeField as HTMLElement).style.display = on ? 'none' : ''
    if (!on) return
    fillCols()
    // Sloupec „1. týden“ = týden vytvoření cvičení (ukotvení), ne epochová fáze.
    const cur = weekColumn(store.today, n, ex?.weekAnchor ?? store.today)
    advNow.textContent = t('advWeekNow', { n: cur })
    ;(schedGrid as HTMLElement).style.gridTemplateColumns = `auto repeat(${n}, minmax(88px, 1fr))`
    schedGrid.innerHTML = ''
    schedGrid.append(h('div', { class: 'sched-head' }, ''))
    const wk = t('weekShort')
    for (let c = 1; c <= n; c++) {
      schedGrid.append(h('div', { class: 'sched-head' + (c === cur ? ' sched-now' : '') }, `${wk} ${c}`))
    }
    weekdaysFull().forEach((wd, d) => {
      schedGrid.append(h('div', { class: 'sched-day' }, wd))
      for (let c = 1; c <= n; c++) {
        schedGrid.append(h('input', {
          type: 'time',
          class: 'sched-cell' + (c === cur ? ' sched-now' : ''),
          value: cols[d][c] ?? '',
          oninput: (e: Event) => { cols[d][c] = (e.target as HTMLInputElement).value },
        }))
      }
    })
  }

  advToggle.addEventListener('change', () => {
    if ((advToggle as HTMLInputElement).checked && !(ex?.weekTimes && Object.keys(ex.weekTimes).length)) {
      const t0 = (timeIn as HTMLInputElement).value || '08:00'
      const n = everyVal()
      for (let d = 0; d < 7; d++) {
        if (!cols[d]) cols[d] = []
        for (let c = 1; c <= n; c++) if (!cols[d][c]) cols[d][c] = t0
      }
    }
    renderGrid()
  })

  let weekOffsetChoice = ex ? Math.min(ex.every, Math.max(1, ex.weekOffset ?? 1)) : 1
  let choiceN = ex ? ex.every : -1

  function updateWeekCycle(): void {
    const kind = (kindSel as HTMLSelectElement).value
    const every = Math.min(365, Math.max(1, Math.floor(Number((everyNum as HTMLInputElement).value) || 1)))
    const visible = kind === 'weekly' && every >= 2
    ;(weekCycleField as HTMLElement).style.display = visible ? '' : 'none'
    if (!visible) { weekOffsetChoice = 1; choiceN = -1; return }
    // default to the week phase of today, so a brand-new exercise occurs today
    if (choiceN !== every || weekOffsetChoice > every) {
      choiceN = every
      weekOffsetChoice = weekOffsetFor(store.today, every)
    }
    weekChips.innerHTML = ''
    for (let i = 1; i <= every; i++) {
      const chip = h('button', {
        type: 'button',
        class: 'day-chip' + (weekOffsetChoice === i ? ' active' : ''),
        onclick: () => { weekOffsetChoice = i; updateWeekCycle() },
      }, String(i))
      weekChips.append(chip)
    }
    renderGrid()
  }

  function updateKind(): void {
    const kind = (kindSel as HTMLSelectElement).value
    const isWeekly = kind === 'weekly'
    ;(weekdayField as HTMLElement).style.display = isWeekly ? '' : 'none'
    everyHint.textContent = isWeekly ? t('everyWeeklyHint') : t('everyMonthlyHint')
    renderGrid()
  }
  updateKind()
  updateWeekCycle()
  renderGrid()

  const body = [
    h('div', { class: 'form-grid' },
      h('div', { class: 'full' }, h('label', {}, t('nameLabel')), name),
      h('div', { class: 'full' },
        h('label', {}, t('colorLabel')),
        h('div', { class: 'color-row' }, ...swatches, colorIn),
      ),
      h('div', {}, h('label', {}, t('kindLabel')), kindSel),
      everyField,
      weekdayField,
      weekCycleField,
      advWrap,
      timeField,
      endField,
      h('div', { class: 'full' },
        h('label', {}, t('unitLabel')), unitIn,
        h('div', { class: 'hint' }, t('unitHint')),
      ),
    ),
  ]

  function save(): void {
    const nameV = (name as HTMLInputElement).value.trim()
    if (!nameV) { (name as HTMLInputElement).focus(); return }
    const kind = (kindSel as HTMLSelectElement).value as Exercise['kind']
    const every = Math.min(365, Math.max(1, Math.floor(Number((everyNum as HTMLInputElement).value) || 1)))
    let weekdays: number[] = []
    if (kind === 'weekly') {
      weekdays = [...selectedDays].sort((a, b) => a - b)
      if (weekdays.length === 0) weekdays = [0]
    }
    const unitV = (unitIn as HTMLInputElement).value.trim()
    // Pokročilý rozvrh: vyplněné buňky mřížky → weekTimes, jinak klasický rozvrh.
    let weekTimes: Exercise['weekTimes']
    let weekAnchor: Exercise['weekAnchor']
    if (kind === 'weekly' && (advToggle as HTMLInputElement).checked) {
      const wt: NonNullable<Exercise['weekTimes']> = {}
      for (let d = 0; d < 7; d++) {
        const cells: Record<string, string | null> = {}
        for (let c = 1; c <= every; c++) {
          const v = (cols[d]?.[c] ?? '').trim()
          if (v) cells[String(c)] = v
        }
        if (Object.keys(cells).length) wt[String(d)] = cells
      }
      if (Object.keys(wt).length) {
        weekTimes = wt
        weekAnchor = ex?.weekAnchor ?? store.today
      }
    }
    const payload = {
      name: nameV,
      color: colorChoice,
      kind,
      every,
      weekOffset: kind === 'weekly' ? weekOffsetChoice : 1,
      weekdays,
      anchor: kind === 'interval' ? (ex?.anchor ?? store.today) : null,
      time: (timeIn as HTMLInputElement).value || '08:00',
      endTime: (endIn as HTMLInputElement).value || null,
      unit: unitV ? unitV : null,
      weekTimes,
      weekAnchor,
    }
    void (ex ? store.updateExercise(ex.id, payload) : store.addExercise(payload)).then(closeModal)
  }

  modal(ex ? t('editExerciseTitle') : t('newExerciseTitle'), body, [
    h('button', { class: 'btn ghost', onclick: closeModal }, t('cancel')),
    h('button', { class: 'btn primary', onclick: save }, ex ? t('save') : t('add')),
  ])
}

/* ============================== DATA VIEW ============================== */

function afterFile(r: { ok: boolean; error?: string }): void {
  if (!r.ok && r.error) alert(r.error)
  rerender()
}

async function onImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const data = await parseJsonFile(file)
    await store.replaceAll(data)
    alert(t('importOk'))
  } catch (err) {
    alert(t('errImport') + (err instanceof Error ? err.message : String(err)))
  }
  input.value = ''
}

function renderData(root: HTMLElement): void {
  const d = store.data
  const fsOk = store.fsSupported()

  const importInput = h('input', {
    type: 'file', accept: 'application/json,.json', style: 'display:none',
    onchange: (e: Event) => void onImport(e),
  })

  root.append(h('div', { class: 'card' },
    h('h2', {}, t('dataFileTitle')),
    h('div', { class: 'notice' },
      t('autoSave') + ' ' +
      (fsOk ? t('fsExtra', { file: FILE_NAME }) + ' ' : '') +
      t('syncNote')),
    h('div', { class: 'data-row' },
      store.fileHandle
        ? h('span', { class: 'mono' }, t('selectedFile', { file: store.fileLabel() }))
        : h('span', { class: 'mono' }, t('noFile')),
      h('span', { class: 'grow' }),
      fsOk ? h('button', { class: 'btn', onclick: () => void store.openAndLoadFile().then(afterFile) }, t('openFile')) : null,
      fsOk
        ? h('button', {
            class: 'btn primary',
            onclick: () => void (store.fileHandle ? store.saveToFile().then(afterFile) : store.createAndSaveFile().then(afterFile)),
          }, store.fileHandle ? t('saveToFile') : t('createDataFile'))
        : null,
    ),
  ))

  root.append(h('div', { class: 'card' },
    h('h2', {}, t('exportImport')),
    h('div', { class: 'data-row' },
      h('button', { class: 'btn', onclick: () => downloadJson(store.data) }, t('exportJson')),
      h('button', { class: 'btn', onclick: () => importInput.click() }, t('importJson')),
      importInput,
    ),
    h('div', { class: 'hint', style: 'margin-top:8px' }, t('importReplaces')),
  ))

  root.append(h('div', { class: 'card' },
    h('h2', {}, t('stats')),
    h('div', { class: 'mono' },
      t('statsLine', {
        ex: d.exercises.length,
        done: d.logs.filter((l) => l.done).length,
        all: d.logs.length,
      })),
  ))
}

/* ============================== ADMIN (účty) ============================== */

let adminUsers: AdminUserInfo[] | null = null
let adminBusy = false
let adminError: string | null = null

/** Otevřený přehled pokroku vybraného uživatele (admin, read-only). */
interface AdminDetail {
  user: AdminUserInfo
  data: AppData | null
  loading: boolean
  error: string | null
}
let adminDetail: AdminDetail | null = null

async function openAdminDetail(u: AdminUserInfo): Promise<void> {
  const session = getSession()
  if (!session) return
  adminDetail = { user: u, data: null, loading: true, error: null }
  rerender()
  try {
    const data = await apiAdminUserData(session, u.username)
    if (adminDetail?.user.username === u.username) {
      adminDetail = { user: u, data, loading: false, error: null }
    }
  } catch {
    if (adminDetail?.user.username === u.username) {
      adminDetail = { user: u, data: null, loading: false, error: t('loadUserDataError') }
    }
  }
  rerender()
}

function closeAdminDetail(): void {
  adminDetail = null
  rerender()
}

async function loadAdminUsers(): Promise<void> {
  const session = getSession()
  if (!session) return
  adminBusy = true
  adminError = null
  rerender()
  try {
    adminUsers = await apiAdminUsers(session)
  } catch {
    adminUsers = null
    adminError = t('adminLoadError')
  }
  adminBusy = false
  rerender()
}

async function deleteUser(username: string): Promise<void> {
  const session = getSession()
  if (!session) return
  adminBusy = true
  adminError = null
  rerender()
  try {
    await apiAdminDeleteUser(session, username)
    adminUsers = (adminUsers ?? []).filter((u) => u.username !== username)
  } catch {
    adminError = t('adminLoadError')
  }
  adminBusy = false
  rerender()
}

function adminRow(u: AdminUserInfo): HTMLElement {
  const updated = u.updatedAt ? new Date(u.updatedAt).toLocaleString() : '—'
  return h('div', { class: 'ex-item' },
    h('span', { class: 'ex-dot', style: 'background:var(--accent)' }),
    h('div', { class: 'grow' },
      h('div', { class: 'ex-name' }, u.username),
      h('div', { class: 'ex-meta' },
        t('userStats', { ex: u.exercises, logs: u.logs }), ' · ',
        t('updatedCol'), ' ', updated,
      ),
    ),
    h('button', { class: 'btn small', onclick: () => void openAdminDetail(u) }, `👁 ${t('viewUser')}`),
    h('button', {
      class: 'btn small danger',
      onclick: () => {
        if (confirm(t('confirmDeleteUser', { name: u.username }))) void deleteUser(u.username)
      },
    }, t('deleteUser')),
  )
}

/* ------------ admin: read-only přehled pokroku uživatele ------------ */

function fmtNum(v: number): string {
  return String(Math.round(v * 100) / 100)
}

/** Status badge pro jeden den (stejná logika jako týdenní tabulka). */
function statusBadge(st: DayStats, date: string): HTMLElement {
  if (st.total === 0) return h('span', { class: 'count-badge zero' }, '—')
  if (date < store.today && st.missed > 0 && st.done < st.total) {
    return h('span', { class: 'count-badge miss' }, t('missingN', { done: st.done, total: st.total, n: st.missed }))
  }
  if (date > store.today && st.done === 0) {
    return h('span', { class: 'count-badge plan' }, t('planN', { n: st.total }))
  }
  if (st.done === st.total) return h('span', { class: 'count-badge ok' }, `${st.done}/${st.total} ✓`)
  return h('span', { class: 'count-badge partial' }, `${st.done}/${st.total}`)
}

/** Splněné položky daného dne (odškrtnuté plány i ručně přidané). */
function dayDoneItems(data: AppData, date: string): { name: string; color: string; value: string | null }[] {
  const out: { name: string; color: string; value: string | null }[] = []
  for (const l of data.logs) {
    if (l.date !== date || !l.done) continue
    const ex = data.exercises.find((e) => e.id === l.exerciseId)
    if (!ex || ex.archived) continue
    out.push({
      name: ex.name,
      color: ex.color,
      value: ex.unit && l.value != null ? `${fmtNum(l.value)} ${ex.unit}` : null,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Posledních 14 dní: co se ten den stihlo / zmeškalo. */
function renderRecentDays(data: AppData): HTMLElement[] {
  const out: HTMLElement[] = []
  for (let i = 13; i >= 0; i--) {
    const date = addDays(store.today, -i)
    const st = dayStats(data, date, store.today)
    const items = dayDoneItems(data, date)
    const body: HTMLElement[] = []
    if (items.length) {
      for (const it of items) {
        body.push(h('div', { class: 'ad-item' },
          h('span', { class: 'ex-dot', style: `background:${it.color}` }),
          h('span', { class: 'ad-name' }, it.name),
          it.value ? h('span', { class: 'ad-val' }, it.value) : null,
        ))
      }
    } else if (st.missed > 0) {
      body.push(h('div', { class: 'ad-none miss' }, `✗ ${t('missN', { n: st.missed })}`))
    } else {
      body.push(h('div', { class: 'ad-none' }, t('noWorkout')))
    }
    out.push(h('div', { class: 'act-day' },
      h('div', { class: 'ad-date' },
        h('div', { class: 'ad-wd' }, weekdayFull(date)),
        h('div', { class: 'ad-num' }, formatDay(date), date === store.today ? ` · ${t('todayTag')}` : ''),
      ),
      h('div', { class: 'ad-body' }, ...body),
      h('div', { class: 'ad-badge' }, statusBadge(st, date)),
    ))
  }
  return out
}

/** Posledních 12 týdnů jako pruhy splněno/plán. */
function renderWeekRows(data: AppData): HTMLElement[] {
  const rows: HTMLElement[] = []
  const thisMon = mondayOf(store.today)
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(thisMon, -7 * i)
    const wt = weekTotals(data, ws, store.today)
    const pct = wt.total ? Math.round((wt.done / wt.total) * 100) : 0
    const showMiss = wt.missed > 0 && wt.done < wt.total
    rows.push(h('div', { class: 'week-row' },
      h('span', { class: 'wl' }, formatDay(ws)),
      h('div', { class: 'mini-track' },
        wt.total ? h('div', { class: 'mini-fill', style: `width:${pct}%` }) : null),
      h('span', { class: `wt${showMiss ? ' miss' : ''}` }, wt.total ? `${wt.done}/${wt.total}` : '—'),
    ))
  }
  return rows
}

/** Aktivita jednotlivých cvičení za posledních 30 dní. */
function exerciseStats(data: AppData): HTMLElement[] {
  const from = addDays(store.today, -29)
  const stats = activeExercises(data).map((ex) => {
    let done = 0
    let missed = 0
    let vol = 0
    for (const p of exerciseHistory(data, ex, from, store.today)) {
      if (p.done) {
        done++
        if (p.value != null) vol += p.value
      } else if (p.planned) {
        missed++
      }
    }
    return { ex, done, missed, vol }
  })
    .filter((s) => s.done + s.missed > 0)
    .sort((a, b) => b.done - a.done || a.ex.name.localeCompare(b.ex.name))

  if (stats.length === 0) return [h('div', { class: 'notice' }, t('noRecent'))]
  return stats.map((s) => {
    const total = s.done + s.missed
    const pct = total ? Math.round((s.done / total) * 100) : 0
    return h('div', { class: 'ex-item' },
      h('span', { class: 'ex-dot', style: `background:${s.ex.color}` }),
      h('div', { class: 'grow' },
        h('div', { class: 'ex-name' }, s.ex.name),
        h('div', { class: 'ex-meta' },
          t('doneOf', { done: s.done, total }),
          s.vol > 0 && s.ex.unit ? ` · ${t('totalVol', { value: fmtNum(s.vol), unit: s.ex.unit })}` : '',
        ),
      ),
      h('div', { class: 'mini-track inline' },
        total ? h('div', { class: 'mini-fill', style: `width:${pct}%` }) : null),
      h('span', { class: 'wt' }, total ? `${pct} %` : '—'),
    )
  })
}

/** Detailní přehled „jak si kdo vede“ – vše pouze ke čtení. */
function renderAdminDetail(root: HTMLElement): void {
  const d = adminDetail
  if (!d) return

  root.append(h('a', { class: 'back-link ad-back', onclick: closeAdminDetail }, t('backToAccounts')))
  root.append(h('div', { class: 'day-header' },
    h('h2', {}, `👤 ${d.user.username}`),
    d.data
      ? h('span', { class: 'count-badge ok' }, t('userStats', { ex: d.data.exercises.length, logs: d.data.logs.length }))
      : null,
  ))

  if (d.loading) { root.append(h('div', { class: 'notice' }, t('loading'))); return }
  if (d.error) { root.append(h('div', { class: 'notice' }, d.error)); return }
  const data = d.data
  if (!data) return
  if (data.exercises.length === 0 && data.logs.length === 0 && data.groups.length === 0) {
    root.append(h('div', { class: 'notice' }, t('userEmpty')))
    return
  }

  // tento týden
  const wt = weekTotals(data, mondayOf(store.today), store.today)
  const pct = wt.total ? Math.round((wt.done / wt.total) * 100) : 0
  const caps = [t('weekDone', { done: wt.done, total: wt.total })]
  if (wt.missed) caps.push(t('missN', { n: wt.missed }))
  if (wt.upcoming) caps.push(t('upcomingN', { n: wt.upcoming }))
  root.append(h('div', { class: 'card' },
    h('h2', {}, t('thisWeek')),
    h('div', { class: 'progress-track' }, wt.total ? h('div', { class: 'progress-fill', style: `width:${pct}%` }) : null),
    h('div', { class: 'progress-caption' }, caps.join(' · ')),
  ))

  // posledních 12 týdnů
  root.append(h('div', { class: 'card' },
    h('h2', {}, t('weeksN', { n: 12 })),
    ...renderWeekRows(data),
  ))

  // posledních 14 dní
  root.append(h('div', { class: 'card' },
    h('h2', {}, t('daysN', { n: 14 })),
    ...renderRecentDays(data),
  ))

  // aktivita cvičení za posledních 30 dní
  root.append(h('div', { class: 'card' },
    h('h2', {}, t('activityTitle')),
    h('div', { class: 'hint', style: 'margin:-4px 0 8px' }, t('daysN', { n: 30 })),
    ...exerciseStats(data),
  ))
}

function renderAdmin(root: HTMLElement): void {
  if (adminDetail) {
    renderAdminDetail(root)
    return
  }
  if (adminUsers === null && !adminBusy && !adminError) void loadAdminUsers()
  root.append(h('div', { class: 'card' },
    h('div', { class: 'admin-head' },
      h('div', {},
        h('h2', { style: 'margin:0' }, t('adminTitle')),
        h('div', { class: 'hint', style: 'margin:4px 0 0' }, t('adminHint')),
      ),
      h('button', { class: 'btn', onclick: () => void loadAdminUsers() }, `🔄 ${t('refresh')}`),
    ),
    adminBusy ? h('div', { class: 'notice' }, t('loading')) : null,
    adminError ? h('div', { class: 'notice' }, adminError) : null,
    adminUsers === null ? null : adminUsers.length === 0
      ? h('div', { class: 'notice' }, t('noUsers'))
      : h('div', {}, adminUsers.map(adminRow)),
  ))
}

/* ============================== APP SHELL ============================== */

function tabBtn(ico: string, label: string, name: AppView['name']): HTMLElement {
  const isActive = currentView.name === name
  return h('button', { class: `tab-btn${isActive ? ' active' : ''}`, onclick: () => navigate({ name } as AppView) },
    h('span', { class: 'ico' }, ico),
    label,
  )
}

function langThemeControls(): HTMLElement[] {
  const langSel = h('select', {
    class: 'btn',
    style: 'padding:6px 9px;font-size:0.8rem;max-width:150px',
    title: t('langTitle'),
    onchange: (e: Event) => {
      setLang((e.target as HTMLSelectElement).value as Parameters<typeof setLang>[0])
      rerender()
    },
  }, LANGS.map((l) => h('option', { value: l, selected: l === getLang() }, LANG_LABELS[l])))

  const themeSel = h('select', {
    class: 'btn',
    style: 'padding:6px 9px;font-size:0.8rem;max-width:190px',
    title: t('themeTitle'),
    onchange: (e: Event) => { setTheme((e.target as HTMLSelectElement).value as ThemeId); rerender() },
  }, THEMES.map((th) => h('option', { value: th.id, selected: th.id === getTheme() }, themeLabel(th.id))))

  return [langSel, themeSel]
}

function syncIndicator(): HTMLElement {
  const ok = store.syncOk
  const cls = ok === null ? 'idle' : ok ? 'ok' : 'fail'
  const title = ok === null ? '' : ok ? t('syncedOk') : t('syncedOffline')
  return h('span', { class: `sync-dot ${cls}`, title }, ok === null ? '·' : ok ? '●' : '⚠')
}

function apiErrorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : 'errNetwork'
  switch (code) {
    case 'wrongCreds': return t('wrongCreds')
    case 'userTaken': return t('userTaken')
    case 'invalidUser': return t('invalidUser')
    case 'adminReserved': return t('adminReserved')
    default: return t('errNetwork')
  }
}

function renderLogin(root: HTMLElement): void {
  const username = h('input', {
    type: 'text', class: 'login-input', placeholder: t('username'),
    autocomplete: 'username', maxlength: '30',
  })
  const password = h('input', {
    type: 'password', class: 'login-input', placeholder: t('password'),
    autocomplete: 'current-password',
  })
  const error = h('div', { class: 'login-error' })

  let busy = false
  const setBusy = (b: boolean): void => {
    busy = b
    ;(username as HTMLInputElement).disabled = b
    ;(password as HTMLInputElement).disabled = b
    ;(btnLogin as HTMLButtonElement).disabled = b
    ;(btnRegister as HTMLButtonElement).disabled = b
  }
  const submit = async (mode: 'login' | 'register'): Promise<void> => {
    if (busy) return
    const u = (username as HTMLInputElement).value.trim()
    const p = (password as HTMLInputElement).value
    if (!u || !p) { error.textContent = t('errFill'); return }
    setBusy(true)
    error.textContent = ''
    try {
      if (mode === 'login') await store.login(u, p)
      else await store.register(u, p)
      rerender()
    } catch (e) {
      error.textContent = apiErrorMessage(e)
      setBusy(false)
    }
  }
  const btnLogin = h('button', { class: 'btn primary', onclick: () => void submit('login') }, t('loginBtn'))
  const btnRegister = h('button', { class: 'btn ghost', onclick: () => void submit('register') }, t('registerBtn'))
  password.addEventListener('keydown', (e) => { if (e.key === 'Enter') void submit('login') })

  root.append(
    h('div', { class: 'app-header' },
      h('h1', {}, '🏋️ Habit Tracker'),
      h('div', { class: 'header-actions' }, ...langThemeControls()),
    ),
    h('div', { class: 'login-wrap' },
      h('div', { class: 'card login-card' },
        h('h2', { class: 'login-title' }, t('loginTitle')),
        h('p', { class: 'login-sub' }, t('loginSub')),
        username,
        password,
        error,
        h('div', { class: 'login-btns' }, btnLogin, btnRegister),
        h('p', { class: 'login-hint' }, t('loginHint')),
      ),
    ),
  )
}

export function renderApp(root: HTMLElement): void {
  clear(root)

  if (!store.user) {
    renderLogin(root)
    return
  }

  if (currentView.name === 'admin' && !store.isAdmin()) currentView = { name: 'week' }

  root.append(h('div', { class: 'app-header' },
    h('h1', {}, '🏋️ Habit Tracker'),
    h('div', { class: 'header-actions' },
      h('div', { class: 'header-user' },
        h('span', { class: 'user-chip', title: t('loggedInAs') }, `👤 ${store.displayName ?? store.user}`),
        syncIndicator(),
        h('button', { class: 'btn small ghost', onclick: () => void store.logout() }, t('logout')),
      ),
      ...langThemeControls(),
      store.isAdmin()
        ? null
        : h('button', { class: 'btn small ghost', onclick: () => navigate({ name: 'data' }) }, `💾 ${t('data')}`),
    ),
  ))

  // Admin vidí jen správu účtů
  if (store.isAdmin()) {
    currentView = { name: 'admin' }
    renderAdmin(root)
    root.append(h('div', { class: 'tabbar' },
      h('div', { class: 'inner' }, tabBtn('🛡️', t('adminTitle'), 'admin')),
    ))
    return
  }

  switch (currentView.name) {
    case 'week': renderWeek(root); break
    case 'day': renderDay(root, currentView.date); break
    case 'charts': renderCharts(root); break
    case 'exercises': renderExercises(root); break
    case 'data': renderData(root); break
  }

  root.append(h('div', { class: 'tabbar' },
    h('div', { class: 'inner' },
      tabBtn('📅', t('week'), 'week'),
      tabBtn('📈', t('charts'), 'charts'),
      tabBtn('🏋️', t('exercises'), 'exercises'),
      tabBtn('💾', t('data'), 'data'),
    ),
  ))

  if (currentView.name === 'week') {
    root.append(h('button', { class: 'fab', title: t('newExerciseTitle'), onclick: () => openExerciseModal(null) }, '+'))
  }
}
