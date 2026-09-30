// Generates assets/favicon.ico, assets/favicon-32x32.png and
// assets/apple-touch-icon.png from assets/favicon-source.png.
//
// Dependency-free by design: the source PNG is decoded here, resized, and
// re-encoded with node:zlib. There is no image library and no npm install.
//
// The source is a white R with a soft black shadow on a fully transparent
// background. It is emitted as-is, keeping that transparency, so the mark sits
// on whatever the browser tab or bookmark bar happens to be. The black shadow
// is what keeps the white R legible against a light background.
//
// Set TILE to a [r, g, b] triple to composite the artwork onto an opaque
// rounded tile instead, or leave it null for the transparent mark.
//
// Run: node tools/make-favicon.mjs
// The outputs are committed, so a plain clone renders correctly. Re-run this
// only when the source artwork changes.

import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'assets', 'favicon-source.png')

// null keeps the source's transparent background for the browser tab icon,
// which reads well on a dark tab bar. [0x0f, 0x17, 0x2a] is slate-900, the
// page's own background colour.
const TILE = null

// The home screen icon is a different problem and does not get the same
// choice. iOS composites apple-touch-icon onto an opaque WHITE rounded square
// of its own, so a white R on transparency is very close to invisible there.
// This one is always given a background.
const TOUCH_TILE = [0x0f, 0x17, 0x2a]

const TILE_RADIUS = 0.2 // fraction of the icon edge, only used when tiled
const ART_MARGIN = 0.04 // breathing room inside the tile

const ICO_SIZES = [16, 32, 48]
const TOUCH_SIZE = 180
const MASTER_SIZE = 256

/* -------------------------------------------------------------- PNG decode */

// Only what this file needs: 8-bit RGBA, non-interlaced. Anything else is a
// hard error rather than a silently wrong icon.
function decodePng(buf) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIG[i]) throw new Error('not a PNG')
  }

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []

  let i = 8
  while (i < buf.length - 8) {
    const len = buf.readUInt32BE(i)
    const type = buf.toString('ascii', i + 4, i + 8)
    const data = buf.subarray(i + 8, i + 8 + len)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    // Unknown chunks, such as the caBX content-credential block the source
    // carries, are skipped on purpose.

    i += 12 + len
  }

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `source must be 8-bit RGBA, non-interlaced (got depth ${bitDepth}, colour type ${colorType}, interlace ${interlace})`
    )
  }

  const bpp = 4
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(stride * height)

  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]
    const line = raw.subarray(pos, pos + stride)
    pos += stride

    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      const v = line[x]

      let r
      switch (filter) {
        case 0: r = v; break
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: r = v + paeth(a, b, c); break
        default: throw new Error(`bad filter ${filter} on row ${y}`)
      }
      cur[x] = r & 0xff
    }
  }

  return { width, height, data: out }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

/* ------------------------------------------------------ crop and compose */

// The source has a wide transparent margin. Find the real artwork bounds and
// work from those, so the mark is centred in the icon rather than wherever the
// export happened to place it.
function artworkBounds({ width, height, data }) {
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) throw new Error('source image is fully transparent')
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 }
}

// Square crop around the artwork, then straight-scale it into a square tile.
function composeTile(src, size, tile) {
  const b = artworkBounds(src)
  const side = Math.max(b.x1 - b.x0, b.y1 - b.y0)
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2

  const out = Buffer.alloc(size * size * 4)

  // The crop window has to be LARGER than the artwork, not smaller, so the
  // artwork ends up inset inside the tile. win = side / (1 - 2*margin) makes
  // the art occupy (1 - 2*margin) of the tile, leaving ART_MARGIN of breathing
  // room on every side. Using side directly crops the art off at the edges.
  const win = side / (1 - ART_MARGIN * 2)
  const half = win / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sample the middle of each destination pixel, in source coordinates.
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const sx = Math.floor(cx - half + u * win)
      const sy = Math.floor(cy - half + v * win)

      let sr = 0
      let sg = 0
      let sb = 0
      let sa = 0
      if (sx >= 0 && sx < src.width && sy >= 0 && sy < src.height) {
        const o = (sy * src.width + sx) * 4
        sr = src.data[o]
        sg = src.data[o + 1]
        sb = src.data[o + 2]
        sa = src.data[o + 3] / 255
      }

      // Tile underneath, artwork composited over it with straight alpha.
      // With no tile the artwork's own alpha carries through untouched.
      let r = sr
      let g = sg
      let b = sb
      let a = sa
      if (tile) {
        const inTile = sdRoundedRect(u, v, 0, 0, 1, 1, TILE_RADIUS) < 0 ? 1 : 0
        r = sa * sr + (1 - sa) * tile[0]
        g = sa * sg + (1 - sa) * tile[1]
        b = sa * sb + (1 - sa) * tile[2]
        a = inTile
      }

      const o = (y * size + x) * 4
      out[o] = Math.round(r)
      out[o + 1] = Math.round(g)
      out[o + 2] = Math.round(b)
      out[o + 3] = Math.round(a * 255)
    }
  }
  return out
}

function sdRoundedRect(px, py, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const qx = Math.abs(px - cx) - ((x1 - x0) / 2 - r)
  const qy = Math.abs(py - cy) - ((y1 - y0) / 2 - r)
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  )
}

/* ------------------------------------------------------------- resampling */

// Box filter, done in premultiplied alpha.
//
// This matters now the mark is transparent. Averaging the colour channels
// independently of alpha mixes the fully transparent black background into the
// artwork's antialiased edges, which prints a dark fringe around the R. The
// artwork's own shadow makes that fringe very easy to mistake for the design.
// Premultiplying first, averaging, then unpremultiplying keeps edge pixels the
// colour the artwork actually has.
function resize(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4)
  const xr = sw / dw
  const yr = sh / dh
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * yr)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * yr))
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * xr)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * xr))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          const o = (sy * sw + sx) * 4
          const al = src[o + 3] / 255
          r += src[o] * al
          g += src[o + 1] * al
          b += src[o + 2] * al
          a += al
          n++
        }
      }
      const alpha = a / n
      const o = (y * dw + x) * 4
      if (alpha > 0) {
        out[o] = Math.round(r / n / alpha)
        out[o + 1] = Math.round(g / n / alpha)
        out[o + 2] = Math.round(b / n / alpha)
      }
      out[o + 3] = Math.round(alpha * 255)
    }
  }
  return out
}

/* ------------------------------------------------------------------ PNG */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(rgba, size) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------ ICO */

function encodeIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const dir = Buffer.alloc(16 * images.length)
  let offset = header.length + dir.length
  images.forEach((img, i) => {
    const o = i * 16
    dir[o] = img.size >= 256 ? 0 : img.size
    dir[o + 1] = img.size >= 256 ? 0 : img.size
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(img.data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += img.data.length
  })

  return Buffer.concat([header, dir, ...images.map((i) => i.data)])
}

/* ------------------------------------------------------------------ main */

const src = decodePng(readFileSync(SOURCE))

// Compose once at the highest output resolution and downscale from there, so
// the 16px icon is a proper box filter of the art rather than a nearest
// neighbour pick from the source.
const master = composeTile(src, MASTER_SIZE, TILE)
const render = (n) => encodePng(resize(master, MASTER_SIZE, MASTER_SIZE, n, n), n)

const ico = encodeIco(ICO_SIZES.map((n) => ({ size: n, data: render(n) })))

// The home screen icon is built from a separate master that is always tiled,
// because iOS puts an opaque white square behind it regardless.
const touchMaster = composeTile(src, MASTER_SIZE, TOUCH_TILE)
const touch = encodePng(
  resize(touchMaster, MASTER_SIZE, MASTER_SIZE, TOUCH_SIZE, TOUCH_SIZE),
  TOUCH_SIZE
)

writeFileSync(join(ROOT, 'assets', 'favicon.ico'), ico)
writeFileSync(join(ROOT, 'assets', 'favicon-32x32.png'), render(32))
writeFileSync(join(ROOT, 'assets', 'apple-touch-icon.png'), touch)

console.log(`source      ${src.width}x${src.height} RGBA`)
console.log(`artwork     ${JSON.stringify(artworkBounds(src))}`)
console.log(`favicon.ico          ${ico.length} bytes (${ICO_SIZES.join(', ')}px, ${TILE ? 'tiled' : 'transparent'})`)
console.log(`favicon-32x32.png    ${readFileSync(join(ROOT, 'assets', 'favicon-32x32.png')).length} bytes (${TILE ? 'tiled' : 'transparent'})`)
console.log(`apple-touch-icon.png ${touch.length} bytes (${TOUCH_SIZE}px, always tiled for iOS)`)
