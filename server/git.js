// The one place that talks to git. execFile (no shell) behaves the same on Windows, macOS and Linux,
// and every command here is read-only: --no-optional-locks stops `status` from touching the index.
//
// A repo's own .git/config can name commands for git to run, and a watched folder may hold a repo you didn't make
// (unzipped from somewhere, say). So no call here may run them:
//   core.fsmonitor        a hook `git status` runs every time               off on every call
//   log.showSignature     makes `git log` run gpg.program                   off on every call
//   filter.<name>.clean   runs when `git status` re-reads a changed file   blanked per repo, see filterOff()
// Submodules are left out of the parent's status (--ignore-submodules=dirty), so git never steps into one under the
// parent's settings; a submodule is a nested repo here, with its own row and its own checks.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const SAFE = ['--no-optional-locks', '-c', 'core.quotepath=false', '-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false']

export const git = (cwd, ...args) => new Promise((resolve, reject) =>
  execFile('git', [...SAFE, ...args],
    { cwd, maxBuffer: 64 << 20, timeout: 20_000, windowsHide: true },
    (err, out, errOut) => (err ? reject(new Error(errOut.trim() || err.message)) : resolve(out))))

const read = (file) => { try { return fs.readFileSync(file, 'utf8') } catch { return '' } } // a missing file reads as empty

// The text of the repo's own config files (.git may be a file pointing elsewhere, for worktrees and submodules).
// Only read to decide whether asking git about filters is needed; when unsure, it says so.
function localConfig(dir) {
  try {
    let gitDir = path.join(dir, '.git')
    if (fs.statSync(gitDir).isFile()) gitDir = path.resolve(dir, read(gitDir).replace(/^gitdir:\s*/, '').trim())
    const commondir = read(path.join(gitDir, 'commondir')).trim()
    const common = commondir ? path.resolve(gitDir, commondir) : gitDir
    return read(path.join(common, 'config')) + '\n' + read(path.join(gitDir, 'config.worktree'))
  } catch {
    return 'include' // can't tell: let git answer
  }
}

// -c options that blank every filter command the repo's own config defines, so `git status` can't run one.
// git-lfs's own commands are kept, so LFS repos set up with `git lfs install --local` still read right.
// Most repos define no filter: one look at the config text skips the extra git call.
const LFS = /^git-lfs (clean|smudge|filter-process)( |$)/
export async function filterOff(dir) {
  if (!/filter|include/i.test(localConfig(dir))) return []
  const out = await git(dir, 'config', '--local', '--includes', '--null', '--get-regexp', '^filter\\.').catch(() => '')
  return out.split('\0').filter(Boolean).flatMap((entry) => {
    const [key, value = ''] = entry.split('\n')
    const m = key.match(/^filter\.(.+)\.(clean|smudge|process)$/i)
    return m && !LFS.test(value) ? ['-c', `${key}=`, '-c', `filter.${m[1]}.required=false`] : []
  })
}

// Snapshot of one repo. Never throws: a broken repo comes back as { error }.
export async function status(dir) {
  try {
    const off = await filterOff(dir)
    const [st, log, remotes] = await Promise.all([
      git(dir, ...off, 'status', '--porcelain=v2', '--branch', '--show-stash', '--ignore-submodules=dirty'),
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
