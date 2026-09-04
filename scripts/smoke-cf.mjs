#!/usr/bin/env node
/**
 * Lokální smoke test Cloudflare Pages funkce (functions/api/[[path]].js)
 * s napodobeninou Workers KV v paměti. Spuštění: node scripts/smoke-cf.mjs
 */
import { onRequest } from '../functions/api/[[path]].js'

/** Miniaturní napodobenina Workers KV (get/put/delete/list). */
class KvStub {
  #m = new Map()
  async get(k) { return this.#m.has(k) ? this.#m.get(k) : null }
  async put(k, v) { this.#m.set(k, String(v)) }
  async delete(k) { this.#m.delete(k) }
  async list({ prefix = '', limit = 1000 } = {}) {
    const keys = [...this.#m.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name }))
    return { keys, list_complete: true }
  }
  keys() { return [...this.#m.keys()] }
}

const env = { HABITS_KV: new KvStub() }

async function call(method, path, { auth, body } = {}) {
  const headers = {}
  if (auth) headers.Authorization = 'Bearer ' + Buffer.from(auth, 'utf8').toString('base64')
  let b
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    b = JSON.stringify(body)
  }
  const req = new Request('http://localhost:8787' + path, { method, headers, body: b })
  const res = await onRequest({ request: req, env })
  let data = null
  try { data = await res.json() } catch { /* prázdné tělo */ }
  return { status: res.status, data }
}

const SAMPLE = {
  version: 5,
  exercises: [
    { id: 'e1', name: 'Běh', kind: 'weekly', every: 1, weekOffset: 1, weekdays: [0, 2, 4], anchor: null, time: '08:00', endTime: null, unit: 'km', archived: false, createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'e2', name: 'Dřepy', kind: 'weekly', every: 1, weekOffset: 1, weekdays: [0], anchor: null, time: '18:00', endTime: null, unit: null, archived: false, createdAt: '2026-08-01T00:00:00.000Z' },
  ],
  logs: [],
  groups: [],
}

let fails = 0
function check(label, cond, extra = '') {
  if (cond) console.log(`  ✅ ${label}`)
  else { fails++; console.error(`  ❌ ${label} ${extra}`) }
}

const A = 'admin:Adam,,22'

console.log('— registrace')
let r = await call('POST', '/api/register', { body: { username: 'jana', password: 'heslo1' } })
check('jana vytvořena (200)', r.status === 200 && r.data.ok)
r = await call('POST', '/api/register', { body: { username: 'Jana', password: 'xx' } })
check('duplicitní (case-insensitive) → 409 userTaken', r.status === 409 && r.data.error === 'userTaken')
r = await call('POST', '/api/register', { body: { username: 'a', password: 'x' } })
check('krátké jméno → 400 invalidUser', r.status === 400 && r.data.error === 'invalidUser')
r = await call('POST', '/api/register', { body: { username: 'admin', password: 'x' } })
check('jméno admin → 409 adminReserved', r.status === 409 && r.data.error === 'adminReserved')
r = await call('POST', '/api/register', { body: { username: 'petr', password: '' } })
check('prázdné heslo → 400 invalidPass', r.status === 400 && r.data.error === 'invalidPass')

console.log('— přihlášení')
r = await call('POST', '/api/login', { body: { username: 'jana', password: 'spatne' } })
check('špatné heslo → 401 wrongCreds', r.status === 401 && r.data.error === 'wrongCreds')
r = await call('POST', '/api/login', { body: { username: 'jana', password: 'heslo1' } })
check('správné heslo → 200 s daty', r.status === 200 && Array.isArray(r.data.data.exercises))

console.log('— data')
r = await call('PUT', '/api/data', { auth: 'jana:heslo1', body: SAMPLE })
check('uložení dat → 200', r.status === 200 && r.data.ok)
r = await call('GET', '/api/data', { auth: 'jana:heslo1' })
check('načtení dat → přesně uložená', r.status === 200 && r.data.data.exercises.length === 2 && r.data.data.exercises[0].name === 'Běh')
r = await call('PUT', '/api/data', { auth: 'jana:heslo1', body: { foo: 1 } })
check('špatný tvar dat → 400 badData', r.status === 400 && r.data.error === 'badData')
r = await call('GET', '/api/data', { auth: 'admin:Adam,,22' })
check('admin GET /api/data → prázdná data', r.status === 200 && r.data.data.exercises.length === 0)

console.log('— jméno s velkým písmenem / mezerami v hlavičce')
r = await call('POST', '/api/register', { body: { username: 'Petr', password: 'heslo2' } })
check('registrace Petr → 200 (server uloží petr)', r.status === 200)
r = await call('GET', '/api/data', { auth: 'Petr:heslo2' })
check('GET s hlavičkou Petr → 200 (ne 401)', r.status === 200 && Array.isArray(r.data.data.exercises))
r = await call('PUT', '/api/data', { auth: 'PETR  :heslo2', body: SAMPLE })
check('PUT s hlavičkou PETR + mezery → 200', r.status === 200 && r.data.ok)
r = await call('DELETE', '/api/admin/users/petr', { auth: A })
check('úklid petr → 200', r.status === 200)

console.log('— jména s mezerami / velkými písmeny + displayName')
r = await call('POST', '/api/register', { body: { username: 'Sir Jonathan', password: 'heslo3' } })
check('registrace "Sir Jonathan" → 200 s displayName', r.status === 200 && r.data.displayName === 'Sir Jonathan')
r = await call('POST', '/api/register', { body: { username: 'sir jonathan', password: 'x' } })
check('duplicita přes case/mezery → 409 userTaken', r.status === 409 && r.data.error === 'userTaken')
r = await call('POST', '/api/login', { body: { username: 'SIR  JONATHAN', password: 'heslo3' } })
check('login „SIR  JONATHAN“ → displayName zachován', r.status === 200 && r.data.displayName === 'Sir Jonathan')
r = await call('PUT', '/api/data', { auth: 'Sir Jonathan:heslo3', body: SAMPLE })
check('PUT s hlavičkou „Sir Jonathan“ → 200', r.status === 200 && r.data.ok)
r = await call('GET', '/api/data', { auth: 'sir jonathan:heslo3' })
check('GET po jiné normalizaci → 200 + displayName', r.status === 200 && r.data.displayName === 'Sir Jonathan' && r.data.data.exercises.length === 2)
r = await call('GET', '/api/admin/users', { auth: A })
check('admin vidí displayName „Sir Jonathan“', r.status === 200 && r.data.data.some((u) => u.username === 'sir jonathan' && u.displayName === 'Sir Jonathan'))
r = await call('DELETE', '/api/admin/users/Sir%20Jonathan', { auth: A })
check('smazání „Sir Jonathan“ (URL mezera) → 200', r.status === 200 && r.data.ok)

console.log('— admin: seznam účtů')
r = await call('GET', '/api/admin/users')
check('bez auth → 401', r.status === 401)
r = await call('GET', '/api/admin/users', { auth: A })
check('admin vidí jana (2 cvičení, 0 logů)', r.status === 200 && r.data.data.some((u) => u.username === 'jana' && u.exercises === 2 && u.logs === 0))

console.log('— admin: data uživatele')
r = await call('GET', '/api/admin/users/jana/data', { auth: A })
check('jana data → 200 se cvičeními', r.status === 200 && r.data.data.exercises.length === 2)
r = await call('GET', '/api/admin/users/jana/data')
check('bez auth → 401', r.status === 401)
r = await call('GET', '/api/admin/users/admin/data', { auth: A })
check('admin sám sebe → 400', r.status === 400)
r = await call('GET', '/api/admin/users/ghost/data', { auth: A })
check('neexistující → 404 noUser', r.status === 404 && r.data.error === 'noUser')
r = await call('GET', '/api/admin/users/..%2Fsecret/data', { auth: A })
check('traversal → 400', r.status === 400)

console.log('— admin: mazání')
r = await call('DELETE', '/api/admin/users/jana', { auth: A })
check('smazání jana → 200', r.status === 200 && r.data.ok)
r = await call('POST', '/api/login', { body: { username: 'jana', password: 'heslo1' } })
check('smazaný uživatel se nepřihlásí → 401', r.status === 401)
r = await call('DELETE', '/api/admin/users/jana', { auth: A })
check('mazání neexistujícího → 404', r.status === 404)
r = await call('DELETE', '/api/admin/users/admin', { auth: A })
check('admin nejde smazat → 400', r.status === 400)

console.log('— ostatní')
r = await call('OPTIONS', '/api/register')
check('OPTIONS → 204', r.status === 204)
r = await call('GET', '/api/neexistuje')
check('neznámá cesta → 404 notFound', r.status === 404 && r.data.error === 'notFound')
check('ve KV nezůstal žádný klíč admina', !env.HABITS_KV.keys().some((k) => k.startsWith('u:admin')), `(klíče: ${env.HABITS_KV.keys().join(', ')})`)

console.log(fails ? `\n✗ ${fails} testů selhalo` : '\n✓ všechny testy prošly')
process.exit(fails ? 1 : 0)
