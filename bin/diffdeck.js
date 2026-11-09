#!/usr/bin/env node
// `npx diffdeck`: serves the built page and the git API on localhost, then opens your browser.
//   --port <n>   use another port (default 4747)
//   --no-open    don't open the browser
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import api, { PORT } from '../server/api.js'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
const args = process.argv.slice(2)
const portFlag = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : undefined
let port = portFlag ?? PORT

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('diffdeck: the page is not built yet. Run `pnpm build` first.')
  process.exit(1)
}

function openBrowser(url) {
  if (args.includes('--no-open')) return
  const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [url]]
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref()
}

const server = http.createServer((req, res) => {
  // Answer only to localhost names, so a website using DNS rebinding can't reach the API.
  const host = (req.headers.host ?? '').replace(/:\d+$/, '')
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return res.writeHead(403).end()
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4)
    return api(req, res)
  }
  // Static files from dist/, anything unknown (or outside dist/) gets the page. A URL that doesn't decode is a 400:
  // throwing here would take the whole server down, and any website can send one.
  let file
  try {
    file = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
  } catch {
    return res.writeHead(400).end()
  }
  const serve = file.startsWith(DIST) && fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? file : path.join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(serve)] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' })
  fs.createReadStream(serve).on('error', () => res.destroy()).pipe(res)
})

server.on('error', async (e) => {
  if (e.code !== 'EADDRINUSE') throw e
  // Port taken: if it's diffdeck already, just open it; otherwise try the next port (unless one was asked for).
  const url = `http://localhost:${port}/`
  const running = await fetch(url + 'api/ping').then((r) => r.json()).then((j) => j.app === 'diffdeck').catch(() => false)
  if (running) {
    console.log(`diffdeck is already running at ${url}`)
    openBrowser(url)
    process.exit(0)
  }
  if (portFlag) throw new Error(`Port ${port} is in use. Pick another with --port.`)
  server.listen(++port, '127.0.0.1')
})

server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`
  console.log(`diffdeck running at ${url}  (Ctrl+C to stop)`)
  openBrowser(url)
})
