// The one place that talks to git. execFile (no shell) behaves the same on Windows, macOS and Linux,
// and every command here is read-only: --no-optional-locks stops `status` from touching the index.
import { execFile } from 'node:child_process'

export const git = (cwd, ...args) => new Promise((resolve, reject) =>
  execFile('git', ['--no-optional-locks', '-c', 'core.quotepath=false', ...args],
    { cwd, maxBuffer: 64 << 20, timeout: 20_000, windowsHide: true },
    (err, out, errOut) => (err ? reject(new Error(errOut.trim() || err.message)) : resolve(out))))

// Snapshot of one repo. Never throws: a broken repo comes back as { error }.
export async function status(dir) {
  try {
    const [st, log, remotes] = await Promise.all([
      git(dir, 'status', '--porcelain=v2', '--branch', '--show-stash'),
      git(dir, 'log', '-5', '--format=%h%x1f%ct%x1f%s').catch(() => ''), // fails on a repo with no commits yet
      git(dir, 'remote', '-v'),
    ])
    const s = parseStatus(st)
    return { ...s, changed: s.files.length, files: s.files.slice(0, 200), commits: parseLog(log), ...parseRemotes(remotes) }
  } catch (e) {
    return { error: e.message }
  }
}

// `git status --porcelain=v2 --branch --show-stash`: "# key value" headers, then one line per changed path.
export function parseStatus(text) {
  const s = { branch: '', upstream: '', ahead: 0, behind: 0, stash: 0, conflicts: 0, files: [] }
  for (const line of text.split('\n')) {
    const kind = line[0]
    if (line.startsWith('# ')) {
      const [, key, a, b] = line.split(' ')
      if (key === 'branch.head') s.branch = a
      else if (key === 'branch.upstream') s.upstream = a
      else if (key === 'branch.ab') { s.ahead = +a; s.behind = -b } // "+2" "-1"
      else if (key === 'stash') s.stash = +a
    } else if (kind === '?') {
      s.files.push({ code: '??', path: line.slice(2) })
    } else if (kind === '1' || kind === '2' || kind === 'u') {
      if (kind === 'u') s.conflicts++
      // path starts after 8 fields (ordinary), 9 (rename: + score) or 10 (unmerged); a rename appends "\torigPath"
      const path = line.split(' ').slice({ 1: 8, 2: 9, u: 10 }[kind]).join(' ').split('\t')[0]
      s.files.push({ code: line.slice(2, 4).replaceAll('.', ' '), path })
    }
  }
  return s
}

export const parseLog = (text) => text.split('\n').filter(Boolean).map((line) => {
  const [hash, time, subject] = line.split('\x1f')
  return { hash, time: +time, subject }
})

// Prefer origin, else the first remote. Only a credential-free web URL leaves the server.
export function parseRemotes(text) {
  const lines = text.split('\n').filter(Boolean)
  const line = lines.find((l) => l.startsWith('origin\t')) ?? lines[0]
  return { hasRemote: lines.length > 0, web: line ? webUrl(line.split('\t')[1].replace(/ \((fetch|push)\)$/, '')) : null }
}

// git@github.com:me/app.git, https://user:token@github.com/me/app.git -> https://github.com/me/app. Local paths -> null.
export function webUrl(remote) {
  const m = remote.match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:@]+\.[^/:@]+)(?::\d+)?[:/](.+?)(?:\.git)?\/?$/i)
  return m ? `https://${m[1]}/${m[2]}` : null
}
