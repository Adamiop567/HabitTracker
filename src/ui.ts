/** Tiny DOM helpers for the vanilla-TS UI. */

function appendChild(el: HTMLElement, c: unknown): void {
  if (c === null || c === undefined || c === false) return
  if (Array.isArray(c)) {
    for (const x of c) appendChild(el, x)
    return
  }
  el.append(c instanceof Node ? c : document.createTextNode(String(c)))
}

export function h(
  tag: string,
  attrs: Record<string, unknown> = {},
  ...children: unknown[]
): HTMLElement {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v as string
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    } else if (k === 'value') (el as unknown as { value: string }).value = v as string
    else if (k === 'checked') (el as unknown as { checked: boolean }).checked = !!v
    else if (k === 'disabled') (el as unknown as { disabled: boolean }).disabled = !!v
    else el.setAttribute(k, String(v))
  }
  for (const c of children) appendChild(el, c)
  return el
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild)
}
