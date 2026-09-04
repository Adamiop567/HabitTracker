/** Chart.js setup + builders. Charts are rebuilt on each render (small data, cheap). */
import {
  Chart, LineController, LineElement, PointElement, BarController, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler, DoughnutController, ArcElement,
} from 'chart.js'
import type { ChartConfiguration, ChartOptions } from 'chart.js'
import { t } from './i18n'

Chart.register(
  LineController, LineElement, PointElement, BarController, BarElement,
  CategoryScale, LinearScale, DoughnutController, ArcElement, Tooltip, Legend, Filler,
)

/* Colors follow the active theme (CSS variables set in style.css). */

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Append an alpha hex to a #rrggbb color; leave non-hex colors untouched. */
function withAlpha(c: string, alphaHex: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c + alphaHex : c
}

const grid = () => cssVar('--border', '#223252')
const ticks = () => cssVar('--muted', '#8fa3c0')
const panel = () => cssVar('--panel', '#101a2e')
const textColor = () => cssVar('--text', '#e2e8f0')
const bodyColor = () => cssVar('--muted', '#cbd5e1')
const accent = () => cssVar('--accent', '#38bdf8')
const green = () => cssVar('--green', '#4ade80')
const red = () => cssVar('--red', '#f87171')
const amber = () => cssVar('--amber', '#facc15')

function tooltipOpts() {
  return {
    backgroundColor: panel(),
    borderColor: grid(),
    borderWidth: 1,
    titleColor: textColor(),
    bodyColor: bodyColor(),
  }
}

function lineBarOptions(): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: { legend: { display: false, labels: { color: textColor() } }, tooltip: tooltipOpts() },
    scales: {
      x: { ticks: { color: ticks(), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: grid() } },
      y: { beginAtZero: true, ticks: { color: ticks() }, grid: { color: grid() } },
    },
  }
}

const charts: Chart[] = []

export function destroyCharts(): void {
  for (const c of charts) c.destroy()
  charts.length = 0
}

function finish(el: HTMLElement, cfg: ChartConfiguration): void {
  charts.push(new Chart(el as HTMLCanvasElement, cfg))
}

/** Completion % per day over the last N days, with optional goal line. */
export function buildDailyChart(el: HTMLElement, labels: string[], pct: number[], goal: number | null): void {
  const options = lineBarOptions()
  options.plugins!.legend = { display: goal != null, labels: { color: textColor() } }
  const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
    {
      label: t('donePct'),
      data: pct,
      borderColor: accent(),
      backgroundColor: withAlpha(accent(), '2e'),
      fill: true,
      tension: 0.32,
      pointRadius: 2.5,
      borderWidth: 2,
    },
  ]
  if (goal != null) {
    datasets.push({
      label: t('goal'),
      data: labels.map(() => goal),
      borderColor: withAlpha(amber(), 'bf'),
      borderDash: [6, 5],
      pointRadius: 0,
      borderWidth: 1.5,
    })
  }
  finish(el, { type: 'line', data: { labels, datasets }, options })
}

/** History of one exercise: performance line + missed markers. */
export function buildHistoryChart(el: HTMLElement, labels: string[], values: (number | null)[], missedFlags: boolean[]): void {
  const options = lineBarOptions()
  options.plugins!.legend = { display: true, labels: { color: textColor() } }
  finish(el, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('performance'),
          data: values,
          borderColor: cssVar('--chart-history', '#a78bfa'),
          backgroundColor: withAlpha(cssVar('--chart-history', '#a78bfa'), '26'),
          fill: true,
          tension: 0.3,
          spanGaps: true,
          pointRadius: 3,
          borderWidth: 2,
        },
        {
          label: t('missed'),
          data: missedFlags.map((m) => (m ? 0 : null)),
          borderColor: withAlpha(red(), 'e6'),
          pointBackgroundColor: withAlpha(red(), 'e6'),
          showLine: false,
          pointStyle: 'crossRot',
          pointRadius: 5,
        },
      ],
    },
    options,
  })
}

/** Checkbox-only exercise history: one bar per planned occurrence, green = done, red = missed. */
export function buildCheckHistoryChart(el: HTMLElement, labels: string[], states: ('done' | 'missed')[]): void {
  const colors = states.map((s) => (s === 'done' ? green() : red()))
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipOpts(),
        callbacks: {
          label: (ctx) => (states[ctx.dataIndex] === 'done' ? t('done') : t('missed')),
        },
      },
    },
    scales: {
      x: { ticks: { color: ticks(), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      y: { beginAtZero: true, suggestedMax: 1, ticks: { display: false }, grid: { display: false } },
    },
  }
  finish(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: t('performance'),
        data: states.map(() => 1),
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: 26,
      }],
    },
    options,
  })
}

/** Stacked bars per week (volume values or completed-session counts), one dataset per exercise. */
export function buildStackedChart(el: HTMLElement, labels: string[], series: { label: string; color: string; data: number[] }[]): void {
  const options = lineBarOptions() as unknown as ChartOptions<'bar'>
  options.plugins!.legend = { display: true, labels: { color: textColor() } }
  options.scales = {
    x: { stacked: true, ticks: { color: ticks() }, grid: { color: grid() } },
    y: { stacked: true, beginAtZero: true, ticks: { color: ticks() }, grid: { color: grid() } },
  }
  finish(el, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        backgroundColor: withAlpha(s.color, 'cc'),
        borderRadius: 5,
        borderSkipped: false,
      })),
    },
    options,
  })
}

/** Doughnut: done vs missed vs upcoming for a week. */
export function buildWeekDoughnut(el: HTMLElement, done: number, missed: number, upcoming: number): void {
  finish(el, {
    type: 'doughnut',
    data: {
      labels: [t('done'), t('missed'), t('ahead')],
      datasets: [{
        data: [done, missed, upcoming],
        backgroundColor: [green(), red(), cssVar('--chart-upcoming', '#334155')],
        borderColor: panel(),
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: bodyColor(), boxWidth: 12 } },
        tooltip: tooltipOpts(),
      },
    } as ChartOptions<'doughnut'>,
  })
}