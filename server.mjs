#!/usr/bin/env node
/**
 * Habit Tracker – mikro API server (bez závislostí).
 *
 * - Obsluhuje buildnutou aplikaci z dist/ (SPA fallback na index.html).
 * - Každý registrovaný uživatel má vlastní JSON soubor: data/<uzivatel>.json
 *   ve tvaru { username, password, data: { version, exercises, logs, groups } }.
 * - Bezpečnost je záměrně minimální (hesla v plaintextu, žádné hashe) –
 *   použití je na vlastní riziko, vhodné jen pro demo / rodinu a přátele.
 *
 * Spuštění:  npm run build && node server.mjs
 * (port z env PROMĚNNÉ PORT, jinak 3000; Render/Fly to nastaví samy)
 */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat, rename, readdir, unlink } from 'node:fs/promises'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DIST = join(ROOT, 'dist')
const DATA_DIR = join(ROOT, 'data')
const PORT = Number(process.env.PORT || 3000)
const MAX_BODY = 25 * 1024 * 1024 // max 25 MB JSON payload

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
}

// Jméno smí obsahovat i velká písmena a mezery (zobrazované jméno); pro ukládání
// a přihlašování se sjednocuje na malá písmena (viz normalizeUser).
const USER_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{1,29}$/

/** Kanonická podoba uživatelského jména: malá písmena, jedna mezera mezi slovy. */
const normalizeUser = (s) => String(s ?? '').toLowerCase().replace(/ +/g, ' ').trim()
const EMPTY_DATA = { version: 5, exercises: [], logs: [], groups: [] }

// Vestavěný admin účet – vidí seznam všech uživatelů a může je mazat.
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'Adam,,22'
const isAdminCreds = (user, password) =>
  String(user ?? '').toLowerCase() === ADMIN_USER && String(password ?? '') === ADMIN_PASS

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS })
  res.end(JSON.stringify(obj))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Authorization: Bearer <base64(username:password)> – žádná ochrana, jak bylo přání. */
function parseAuth(req) {
  const h = req.headers.authorization || ''
  if (!h.startsWith('Bearer ')) return null
  try {
    const [user, password] = Buffer.from(h.slice(7), 'base64').toString('utf8').split(':')
    // Server ukládá jména malými písmeny (viz register/login) – hlavičku sjednotíme,
    // jinak uživatel napsaný s velkým písmenem nedostane svá data (401).
    return { user: normalizeUser(user), password }
  } catch {
    return null
  }
}

const userFile = (user) => join(DATA_DIR, `${user}.json`)

async function fileExists(p) {
  try { await stat(p); return true } catch { return false }
}

async function writeJsonAtomic(p, obj) {
  await mkdir(DATA_DIR, { recursive: true })
  const tmp = `${p}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(obj, null, 2))
  await rename(tmp, p)
}

async function loadUser(user) {
  const p = userFile(user)
  if (!(await fileExists(p))) return null
  try {
    return JSON.parse(await readFile(p, 'utf8'))
  } catch {
    return null
  }
}

async function handleApi(req, res, url) {
  const method = req.method
  const path = url.pathname

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }

  // Vytvoření účtu
  if (method === 'POST' && path === '/api/register') {
    let body = {}
    try { body = JSON.parse((await readBody(req)) || '{}') } catch { body = {} }
    const raw = String(body.username ?? '').trim()
    const user = normalizeUser(raw)
    const password = String(body.password ?? '')
    if (!USER_RE.test(user) || !USER_RE.test(raw)) return json(res, 400, { ok: false, error: 'invalidUser' })
    if (user === ADMIN_USER) return json(res, 409, { ok: false, error: 'adminReserved' })
    if (password.length < 1) return json(res, 400, { ok: false, error: 'invalidPass' })
    const p = userFile(user)
    if (await fileExists(p)) return json(res, 409, { ok: false, error: 'userTaken' })
    await writeJsonAtomic(p, { username: user, displayName: raw.replace(/ +/g, ' '), password, data: EMPTY_DATA })
    console.log(`[auth] nový účet: ${user} (${raw})`)
    return json(res, 200, { ok: true, data: EMPTY_DATA, displayName: raw.replace(/ +/g, ' ') })
  }

  // Přihlášení – vrátí data uživatele (admin nemá vlastní datový soubor)
  if (method === 'POST' && path === '/api/login') {
    let body = {}
    try { body = JSON.parse((await readBody(req)) || '{}') } catch { body = {} }
    const user = normalizeUser(body.username)
    const password = String(body.password ?? '')
    if (isAdminCreds(user, password)) {
      console.log(`[auth] přihlášen admin`)
      return json(res, 200, { ok: true, data: EMPTY_DATA, displayName: 'Admin' })
    }
    const rec = await loadUser(user)
    if (!rec || rec.password !== password) return json(res, 401, { ok: false, error: 'wrongCreds' })
    return json(res, 200, { ok: true, data: rec.data, displayName: rec.displayName ?? rec.username })
  }

  // Načtení / uložení dat – vyžaduje Bearer token
  if (path === '/api/data') {
    const a = parseAuth(req)
    if (a && isAdminCreds(a.user, a.password)) {
      // Admin nemá tréninková data – vrátí prázdná, PUT ignoruje.
      if (method === 'GET') return json(res, 200, { ok: true, data: EMPTY_DATA, displayName: 'Admin' })
      if (method === 'PUT') {
        await readBody(req)
        return json(res, 200, { ok: true })
      }
    }
    const rec = a ? await loadUser(a.user) : null
    if (!rec || !a || rec.password !== a.password) {
      return json(res, 401, { ok: false, error: 'wrongCreds' })
    }
    if (method === 'GET') {
      return json(res, 200, { ok: true, data: rec.data, displayName: rec.displayName ?? rec.username })
    }
    if (method === 'PUT') {
      let body = {}
      try { body = JSON.parse((await readBody(req)) || '{}') } catch { body = {} }
      if (!body || typeof body !== 'object' || !Array.isArray(body.exercises) || !Array.isArray(body.logs)) {
        return json(res, 400, { ok: false, error: 'badData' })
      }
      rec.data = body
      await writeJsonAtomic(userFile(a.user), rec)
      return json(res, 200, { ok: true })
    }
  }

  // Admin: seznam všech účtů
  if (method === 'GET' && path === '/api/admin/users') {
    const a = parseAuth(req)
    if (!a || !isAdminCreds(a.user, a.password)) return json(res, 401, { ok: false, error: 'wrongCreds' })
    const users = []
    try {
      const files = (await readdir(DATA_DIR)).filter((n) => n.endsWith('.json') && n !== `${ADMIN_USER}.json`)
      for (const n of files) {
        const p = join(DATA_DIR, n)
        try {
          const rec = JSON.parse(await readFile(p, 'utf8'))
          const st = await stat(p)
          const username = String(rec.username ?? n.slice(0, -5))
          users.push({
            username,
            displayName: String(rec.displayName ?? username),
            exercises: Array.isArray(rec.data?.exercises) ? rec.data.exercises.length : 0,
            logs: Array.isArray(rec.data?.logs) ? rec.data.logs.length : 0,
            updatedAt: st.mtime.toISOString(),
          })
        } catch { /* nečitelný/poškozený soubor přeskočíme */ }
      }
    } catch { /* data/ zatím neexistuje → prázdný seznam */ }
    users.sort((x, y) => x.username.localeCompare(y.username))
    return json(res, 200, { ok: true, data: users })
  }

  // Admin: změna zobrazovaného jména uživatele
  if (method === 'PATCH' && path.startsWith('/api/admin/users/')) {
    const a = parseAuth(req)
    if (!a || !isAdminCreds(a.user, a.password)) return json(res, 401, { ok: false, error: 'wrongCreds' })
    const name = normalizeUser(decodeURIComponent(path.slice('/api/admin/users/'.length)))
    if (!USER_RE.test(name) || name === ADMIN_USER) return json(res, 400, { ok: false, error: 'badName' })
    let body = {}
    try { body = JSON.parse((await readBody(req)) || '{}') } catch { body = {} }
    const displayName = String(body.displayName ?? '').trim().replace(/ +/g, ' ')
    if (!displayName || displayName.length > 40) return json(res, 400, { ok: false, error: 'badName' })
    const rec = await loadUser(name)
    if (!rec) return json(res, 404, { ok: false, error: 'noUser' })
    rec.displayName = displayName
    await writeJsonAtomic(userFile(name), rec)
    console.log(`[auth] admin změnil jméno: ${name} → ${displayName}`)
    return json(res, 200, { ok: true, displayName })
  }

  // Admin: data konkrétního uživatele (jen ke čtení – „jak si vede“)
  if (method === 'GET' && path.startsWith('/api/admin/users/') && path.endsWith('/data')) {
    const a = parseAuth(req)
    if (!a || !isAdminCreds(a.user, a.password)) return json(res, 401, { ok: false, error: 'wrongCreds' })
    const name = normalizeUser(decodeURIComponent(path.slice('/api/admin/users/'.length, -'/data'.length)))
    if (!USER_RE.test(name) || name === ADMIN_USER) return json(res, 400, { ok: false, error: 'badName' })
    const rec = await loadUser(name)
    if (!rec) return json(res, 404, { ok: false, error: 'noUser' })
    console.log(`[auth] admin prohlíží data: ${name}`)
    return json(res, 200, { ok: true, data: rec.data })
  }

  // Admin: smazání účtu
  if (method === 'DELETE' && path.startsWith('/api/admin/users/')) {
    const a = parseAuth(req)
    if (!a || !isAdminCreds(a.user, a.password)) return json(res, 401, { ok: false, error: 'wrongCreds' })
    const name = normalizeUser(decodeURIComponent(path.slice('/api/admin/users/'.length)))
    if (!USER_RE.test(name)) return json(res, 400, { ok: false, error: 'badName' })
    if (name === ADMIN_USER) return json(res, 400, { ok: false, error: 'badName' })
    const p = userFile(name)
    if (!(await fileExists(p))) return json(res, 404, { ok: false, error: 'noUser' })
    await unlink(p)
    console.log(`[auth] admin smazal účet: ${name}`)
    return json(res, 200, { ok: true })
  }

  return json(res, 404, { ok: false, error: 'notFound' })
}

async function serveStatic(res, url) {
  const raw = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
  const filePath = normalize(join(DIST, raw))
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403)
    res.end()
    return
  }
  try {
    const data = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' })
    res.end(data)
  } catch {
    // SPA fallback – všechny cesty vedou do index.html
    try {
      const data = await readFile(join(DIST, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(data)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('dist/ nebylo nalezeno. Spusť nejdřív: npm run build')
    }
  }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error(err)
      json(res, 500, { ok: false, error: 'serverError' })
    })
    return
  }
  serveStatic(res, url).catch(() => {
    res.writeHead(500)
    res.end()
  })
}).listen(PORT, () => {
  console.log(`🏋️ Habit Tracker server běží → http://localhost:${PORT}`)
  console.log(`📁 Data uživatelů: ${DATA_DIR} (jeden JSON soubor na uživatele)`)
})