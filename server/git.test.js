import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStatus, webUrl } from './git.js'

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
