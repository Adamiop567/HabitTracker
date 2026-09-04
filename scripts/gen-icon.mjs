// Generates simple PWA icons (dark rounded square + dumbbell) as PNG.
// Pure Node (zlib) so no canvas dependency is needed.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('public', { recursive: true })

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixelFn) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      row.set([r, g, b, a], 1 + x * 4)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const S = 512
// rounded-rect dark background, orange dumbbell (two rounded plates + bar)
function draw(x, y) {
  const r = 96
  const inCorner = (cx, cy) => (x - cx) ** 2 + (y - cy) ** 2 > r * r
  const margin = 0
  if (
    x < margin || y < margin || x >= S - margin || y >= S - margin ||
    (x < r && y < r && inCorner(r, r)) ||
    (x >= S - r && y < r && inCorner(S - r, r)) ||
    (x < r && y >= S - r && inCorner(r, S - r)) ||
    (x >= S - r && y >= S - r && inCorner(S - r, S - r))
  ) return [0, 0, 0, 0]

  const cx = x - S / 2, cy = y - S / 2
  const barH = 34
  const plateW = 62
  const plateH = 190
  const gap = 26 // gap between plate and bar center
  // vertical plates at ±(gap + plateW/2 ... )
  const plateInner = gap
  const plateOuter = gap + plateW
  const inRect = (px0, py0, px1, py1) => x >= px0 && x < px1 && y >= py0 && y < py1
  const pr = 18 // plate corner radius
  const plate = (px0, px1) => {
    if (cy < -(plateH / 2 - pr) || cy > plateH / 2 - pr) {
      // near plate corners
      const cornerX = px0 + pr <= x && x < px0 + pr ? px0 + pr : x >= px1 - pr ? px1 - pr : null
      if (cornerX === null) return false
      const cornerY = cy < 0 ? -(plateH / 2 - pr) : plateH / 2 - pr
      return (x - cornerX) ** 2 + (cy - cornerY) ** 2 <= pr * pr
    }
    return x >= px0 && x < px1
  }
  const left = plate(S / 2 - plateOuter, S / 2 - plateInner)
  const right = plate(S / 2 + plateInner, S / 2 + plateOuter)
  const bar = Math.abs(cy) <= barH / 2 && Math.abs(cx) <= plateOuter + 26
  if (left || right || bar) {
    // simple two-tone shading
    const shade = bar ? [250, 204, 21] : [251, 146, 60]
    return [shade[0], shade[1], shade[2], 255]
  }
  return [15, 23, 42, 255] // slate-900 background
}

const full = png(S, draw)
writeFileSync('public/icon-512.png', full)
writeFileSync('public/icon-192.png', png(192, (x, y) => draw(Math.floor((x * S) / 192), Math.floor((y * S) / 192))))
console.log('icons written:', full.length, 'bytes (512px)')
