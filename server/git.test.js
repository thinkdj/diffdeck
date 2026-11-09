import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseStatus, status, webUrl } from './git.js'

test('parseStatus reads headers and every kind of entry', () => {
  const s = parseStatus([
    '# branch.oid abc123', '# branch.head main', '# branch.upstream origin/main', '# branch.ab +2 -1', '# stash 3',
    '1 .M N... 100644 100644 100644 aaa bbb src/app.js',
    '2 R. N... 100644 100644 100644 aaa bbb R100 new name.js\told.js',
    'u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict.js',
    '? notes.txt', '',
  ].join('\n'))
  assert.deepEqual({ ...s, files: s.files.map((f) => f.code + f.path) }, {
    branch: 'main', upstream: 'origin/main', ahead: 2, behind: 1, stash: 3, conflicts: 1,
    files: [' Msrc/app.js', 'R new name.js', 'UUconflict.js', '??notes.txt'],
  })
})

test('webUrl strips credentials and rejects local paths', () => {
  for (const [remote, web] of [
    ['git@github.com:me/app.git', 'https://github.com/me/app'],
    ['https://user:token@github.com/me/app.git', 'https://github.com/me/app'],
    ['ssh://git@gitlab.com:2222/group/sub/app.git', 'https://gitlab.com/group/sub/app'],
    ['https://github.com/me/me.github.io', 'https://github.com/me/me.github.io'],
    ['/srv/git/app.git', null],
    ['C:/backups/app.git', null],
  ]) assert.equal(webUrl(remote), web)
})

// A repo's own config points core.fsmonitor and a clean filter at a script. Plain git runs it (checked first, so the
// test proves something on this machine); status() must not.
test("status never runs commands from a repo's own config", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffdeck-git-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const posix = dir.replaceAll(path.sep, '/') // git hands these paths to sh
  const run = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  const ran = () => ['fsmonitor', 'filter'].filter((name) => fs.existsSync(path.join(dir, name)))
  let year = 2000 // a new mtime each time, so status has to re-read a.txt through the filter
  const stale = () => fs.utimesSync(path.join(dir, 'a.txt'), new Date(++year, 0, 1), new Date(year, 0, 1))
  const script = (name) => {
    fs.writeFileSync(path.join(dir, name + '.sh'), `#!/bin/sh\necho ran > "${posix}/${name}"\ncat\n`, { mode: 0o755 })
    return `${posix}/${name}.sh`
  }
  run('init', '-q')
  fs.writeFileSync(path.join(dir, '.gitattributes'), 'a.txt filter=evil\n')
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hi\n')
  run('add', '.')
  run('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'filter.evil.clean=cat', 'commit', '-qm', 'init')
  run('config', 'core.fsmonitor', script('fsmonitor'))
  run('config', 'filter.evil.clean', script('filter'))

  stale()
  try { run('status', '--porcelain=v2') } catch {}
  if (ran().length < 2) return t.skip(`this machine's git ran only [${ran()}], so there is less to prove`)
  for (const name of ran()) fs.rmSync(path.join(dir, name))
  stale()
  const s = await status(dir)
  assert.equal(s.error, undefined)
  assert.deepEqual(ran(), [])
})
