// JSON API at /api: mounted by bin/diffdeck.js (npx diffdeck) and by vite.config.js (pnpm dev).
// The only state is the list of folders you added.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { status } from './git.js'
import { pickFolder } from './pickFolder.js'

// Rarely used by other dev tools, and fixed so the page keeps its origin (the saved theme lives per origin).
export const PORT = 4747

const FILE = path.join(os.homedir(), '.diffdeck.json')

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return { roots: [] }
    throw new Error(`Can't read ${FILE}: ${e.message}`) // never overwrite a file we failed to parse
  }
}
const save = (cfg) => fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2))

const isRepo = (dir) => fs.existsSync(path.join(dir, '.git')) // dir or file (worktrees, submodules)

const reposIn = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .filter((d) => (d.isDirectory() || d.isSymbolicLink()) && isRepo(path.join(dir, d.name)))
  .map((d) => path.join(dir, d.name))
const nestedIn = (repo) => { try { return reposIn(repo) } catch { return [] } }

// The root if it is a repo, else the repos directly inside it (a folder of repos).
// Every repo found is then checked one level down for nested repos, which keep a link to their parent.
function discover(root) {
  const top = isRepo(root) ? [root] : reposIn(root)
  return top.flatMap((p) => [{ path: p, parent: null }, ...nestedIn(p).map((c) => ({ path: c, parent: p }))])
}

async function list() {
  const found = new Map()
  const roots = load().roots.map((root) => {
    try {
      const repos = discover(root)
      for (const r of repos) if (!found.has(r.path)) found.set(r.path, { ...r, name: path.basename(r.path) })
      return { path: root, count: repos.length }
    } catch {
      return { path: root, count: 0, missing: true }
    }
  })
  // ponytail: all repos at once, 3 git processes each; cap concurrency in git() if hundreds of repos get slow
  const repos = await Promise.all([...found.values()].map(async (r) => ({ ...r, ...(await status(r.path)) })))
  return { roots, repos }
}

function addRoot(input) {
  const raw = String(input ?? '').trim().replace(/^(["'])(.*)\1$/, '$2') // Explorer's "Copy as path" adds quotes
  if (!raw) throw new Error('Paste a folder path first.')
  const root = path.resolve(raw.replace(/^~(?=$|[\\/])/, os.homedir())).replace(/^[a-z]:/, (d) => d.toUpperCase()) // v:\ and V:\ are one folder
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`There is no folder at ${root}.`)
  if (!discover(root).length) throw new Error(`No git repos in ${root} or its direct subfolders.`)
  const cfg = load()
  if (!cfg.roots.includes(root)) save({ ...cfg, roots: [...cfg.roots, root] })
}

function removeRoot(root) {
  const cfg = load()
  save({ ...cfg, roots: cfg.roots.filter((r) => r !== root) })
}

async function readJson(req) {
  let s = ''
  for await (const chunk of req) s += chunk
  return JSON.parse(s || '{}')
}

// Every route answers with the fresh list, so the page never needs a second round trip.
export default async function api(req, res) {
  const send = (code, body) => {
    res.statusCode = code
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
  try {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost')
    // Writes come only from our own page: a foreign Origin is refused, and POSTs must be JSON,
    // which another website can't send without a CORS preflight that nothing here answers.
    if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: 'Not allowed.' })
    if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Send JSON.' })
    if (pathname === '/ping') return send(200, { app: 'diffdeck' }) // lets a second `npx diffdeck` find this one
    if (pathname === '/repos' && req.method === 'GET') return send(200, await list())
    if (pathname === '/roots' && req.method === 'POST') {
      addRoot((await readJson(req)).path)
      return send(200, await list())
    }
    if (pathname === '/pick' && req.method === 'POST') {
      const picked = await pickFolder()
      if (picked) addRoot(picked)
      return send(200, await list())
    }
    if (pathname === '/roots' && req.method === 'DELETE') {
      removeRoot(searchParams.get('path'))
      return send(200, await list())
    }
    send(404, { error: 'Not found' })
  } catch (e) {
    send(400, { error: e.message })
  }
}
