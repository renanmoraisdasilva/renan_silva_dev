// Minimal static file server for local preview. No dependencies.
// Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.argv[3] ?? '.')
const port = Number(process.argv[2] ?? 4321)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let rel = decodeURIComponent(url.pathname)
  if (rel.endsWith('/')) rel += 'index.html'

  const path = join(root, normalize(rel).replace(/^([/\\])+/, ''))
  if (!path.startsWith(root)) {
    res.writeHead(403).end('forbidden')
    return
  }

  try {
    const info = await stat(path)
    if (!info.isFile()) throw new Error('not a file')
    const body = await readFile(path)
    res.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
  }
}).listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`)
})
