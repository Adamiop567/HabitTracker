/**
 * Habit Tracker – API pro Cloudflare Pages Functions (náhrada server.mjs na Cloudflare).
 *
 * Běží serverless na Cloudflare Pages: nikdy nespí a data uživatelů žijí ve
 * Workers KV (trvalé úložiště, free plán: 100k čtení + 1k zápisů denně, 1 GB).
 * Stejné API a stejné chybové kódy jako server.mjs, takže klient (src/api.ts)
 * se nemění – stačí, aby aplikace i funkce běžely na stejné doméně *.pages.dev.
 *
 * Binding: KV namespace musí být v projektu Pages připojen jako `HABITS_KV`.
 *
 * Klíče ve KV: `u:<uzivatel>` → JSON { username, password, updatedAt, data }
 */

const USER_RE = /^[a-z0-9][a-z0-9._-]{1,29}$/ // 2–30 znaků, jen bezpečné znaky
const EMPTY_DATA = { version: 5, exercises: [], logs: [], groups: [] }
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'Adam,,22'
const USER_PREFIX = 'u:'

const isAdminCreds = (user, password) =>
  String(user ?? '').toLowerCase() === ADMIN_USER && String(password ?? '') === ADMIN_PASS

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}

/** base64 → UTF-8 (atob samo nezvládne české znaky v hesle). */
function b64decode(s) {
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Authorization: Bearer <base64(username:password)> – stejná „ochrana“ jako server.mjs. */
function parseAuth(request) {
  const h = request.headers.get('Authorization') || ''
  if (!h.startsWith('Bearer ')) return null
  try {
    const [user, password] = b64decode(h.slice(7)).split(':')
    return { user, password }
  } catch {
    return null
  }
}

async function readJson(request) {
  try {
    return JSON.parse((await request.text()) || '{}')
  } catch {
    return null
  }
}

async function loadUser(kv, user) {
  const raw = await kv.get(USER_PREFIX + user)
  if (raw == null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null // poškozený záznam → neexistuje
  }
}

async function handleApi(request, env, url) {
  const method = request.method
  const path = url.pathname
  const kv = env.HABITS_KV

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  // ---------- registrace ----------
  if (method === 'POST' && path === '/api/register') {
    const body = (await readJson(request)) || {}
    const user = String(body.username ?? '').toLowerCase().trim()
    const password = String(body.password ?? '')
    if (!USER_RE.test(user)) return json(400, { ok: false, error: 'invalidUser' })
    if (user === ADMIN_USER) return json(409, { ok: false, error: 'adminReserved' })
    if (password.length < 1) return json(400, { ok: false, error: 'invalidPass' })
    const key = USER_PREFIX + user
    if ((await kv.get(key)) != null) return json(409, { ok: false, error: 'userTaken' })
    await kv.put(key, JSON.stringify({
      username: user,
      password,
      updatedAt: new Date().toISOString(),
      data: EMPTY_DATA,
    }))
    return json(200, { ok: true, data: EMPTY_DATA })
  }

  // ---------- přihlášení ----------
  if (method === 'POST' && path === '/api/login') {
    const body = (await readJson(request)) || {}
    const user = String(body.username ?? '').toLowerCase().trim()
    const password = String(body.password ?? '')
    if (isAdminCreds(user, password)) {
      return json(200, { ok: true, data: EMPTY_DATA })
    }
    const rec = await loadUser(kv, user)
    if (!rec || rec.password !== password) return json(401, { ok: false, error: 'wrongCreds' })
    return json(200, { ok: true, data: rec.data })
  }

  // ---------- načtení / uložení dat ----------
  if (path === '/api/data') {
    const a = parseAuth(request)
    if (a && isAdminCreds(a.user, a.password)) {
      // Admin nemá tréninková data.
      if (method === 'GET') return json(200, { ok: true, data: EMPTY_DATA })
      if (method === 'PUT') {
        await readJson(request)
        return json(200, { ok: true })
      }
    }
    const rec = a ? await loadUser(kv, a.user) : null
    if (!rec || !a || rec.password !== a.password) {
      return json(401, { ok: false, error: 'wrongCreds' })
    }
    if (method === 'GET') return json(200, { ok: true, data: rec.data })
    if (method === 'PUT') {
      const body = await readJson(request)
      if (!body || typeof body !== 'object' || !Array.isArray(body.exercises) || !Array.isArray(body.logs)) {
        return json(400, { ok: false, error: 'badData' })
      }
      rec.data = body
      rec.updatedAt = new Date().toISOString()
      await kv.put(USER_PREFIX + a.user, JSON.stringify(rec))
      return json(200, { ok: true })
    }
  }

  // ---------- admin: seznam všech účtů ----------
  if (method === 'GET' && path === '/api/admin/users') {
    const a = parseAuth(request)
    if (!a || !isAdminCreds(a.user, a.password)) return json(401, { ok: false, error: 'wrongCreds' })
    const users = []
    const list = await kv.list({ prefix: USER_PREFIX, limit: 1000 })
    for (const { name } of list.keys) {
      const raw = await kv.get(name)
      if (raw == null) continue
      try {
        const rec = JSON.parse(raw)
        const data = rec.data && typeof rec.data === 'object' ? rec.data : {}
        users.push({
          username: String(rec.username ?? name.slice(USER_PREFIX.length)),
          exercises: Array.isArray(data.exercises) ? data.exercises.length : 0,
          logs: Array.isArray(data.logs) ? data.logs.length : 0,
          updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : null,
        })
      } catch {
        /* poškozený záznam přeskočíme */
      }
    }
    users.sort((x, y) => x.username.localeCompare(y.username))
    return json(200, { ok: true, data: users })
  }

  // ---------- admin: data konkrétního uživatele (read-only) ----------
  if (method === 'GET' && path.startsWith('/api/admin/users/') && path.endsWith('/data')) {
    const a = parseAuth(request)
    if (!a || !isAdminCreds(a.user, a.password)) return json(401, { ok: false, error: 'wrongCreds' })
    const name = decodeURIComponent(path.slice('/api/admin/users/'.length, -'/data'.length))
    if (!USER_RE.test(name) || name === ADMIN_USER) return json(400, { ok: false, error: 'badName' })
    const rec = await loadUser(kv, name)
    if (!rec) return json(404, { ok: false, error: 'noUser' })
    return json(200, { ok: true, data: rec.data })
  }

  // ---------- admin: smazání účtu ----------
  if (method === 'DELETE' && path.startsWith('/api/admin/users/')) {
    const a = parseAuth(request)
    if (!a || !isAdminCreds(a.user, a.password)) return json(401, { ok: false, error: 'wrongCreds' })
    const name = decodeURIComponent(path.slice('/api/admin/users/'.length))
    if (!USER_RE.test(name) || name === ADMIN_USER) return json(400, { ok: false, error: 'badName' })
    const key = USER_PREFIX + name
    if ((await kv.get(key)) == null) return json(404, { ok: false, error: 'noUser' })
    await kv.delete(key)
    return json(200, { ok: true })
  }

  return json(404, { ok: false, error: 'notFound' })
}

export async function onRequest(context) {
  const { request, env } = context
  try {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) {
      return json(404, { ok: false, error: 'notFound' })
    }
    if (!env || !env.HABITS_KV) {
      return json(500, { ok: false, error: 'missing KV binding HABITS_KV' })
    }
    return await handleApi(request, env, url)
  } catch (err) {
    console.error(err)
    return json(500, { ok: false, error: 'serverError' })
  }
}
