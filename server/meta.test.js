import test from 'node:test'
import assert from 'node:assert/strict'
import { fieldsFor, removeField, saveField, setValue, withMeta } from './meta.js'

const P = '/code/app'

test('fields are added, filled, renamed, retyped and removed', () => {
  let cfg = { roots: [P] }
  cfg = saveField(cfg, { key: ' Ottabase ', desc: 'Runs off Ottabase', type: 'boolean' })
  cfg = saveField(cfg, { key: 'Stack', type: 'string' })
  assert.deepEqual(cfg.fields, [{ key: 'Ottabase', desc: 'Runs off Ottabase', type: 'boolean' }, { key: 'Stack', desc: '', type: 'string' }])

  cfg = setValue(cfg, { path: P, key: 'Ottabase', value: true })
  cfg = setValue(cfg, { path: P, key: 'Stack', value: '  Next.js ' })
  assert.deepEqual(withMeta(cfg, { path: P }).meta, { Ottabase: true, Stack: 'Next.js' })
  assert.deepEqual(withMeta(cfg, { path: '/other' }).meta, {})

  cfg = saveField(cfg, { was: 'Stack', key: 'Framework', type: 'text' }) // rename + compatible type: value follows
  assert.deepEqual(cfg.meta[P], { Ottabase: true, Framework: 'Next.js' })
  cfg = saveField(cfg, { was: 'Framework', key: 'Framework', type: 'date' }) // incompatible: value dropped
  assert.deepEqual(cfg.meta[P], { Ottabase: true })

  cfg = setValue(cfg, { path: P, key: 'Ottabase', value: false }) // clearing the last value drops the repo
  assert.deepEqual(cfg.meta, {})
  cfg = removeField(setValue(cfg, { path: P, key: 'Framework', value: '2026-12-31' }), 'Framework')
  assert.deepEqual([cfg.fields.length, cfg.meta, cfg.roots], [1, {}, [P]])
})

test('local fields belong to one repo, globals to all', () => {
  const Q = '/code/other'
  let cfg = saveField({}, { key: 'Live', type: 'boolean' })
  cfg = saveField(cfg, { key: 'Store', type: 'string', repo: P })
  cfg = saveField(cfg, { key: 'Store', type: 'date', repo: Q }) // same name, other repo: fine
  assert.deepEqual(fieldsFor(cfg.fields, P).map((f) => f.key + (f.repo ? ' local' : '')), ['Live', 'Store local'])
  assert.throws(() => saveField(cfg, { key: 'Live', type: 'string', repo: P }), /already a field/) // a local can't shadow a global
  assert.throws(() => saveField(cfg, { key: 'Store', type: 'string' }), /already a field/) // nor a global take a local's name

  cfg = setValue(cfg, { path: P, key: 'Store', value: 'In review' })
  cfg = setValue(cfg, { path: Q, key: 'Store', value: '2026-12-01' })
  assert.throws(() => setValue(cfg, { path: '/code/third', key: 'Store', value: 'x' }), /no field/)
  cfg = saveField(cfg, { was: 'Store', key: 'Store status', type: 'string', repo: P }) // rename touches only P
  assert.deepEqual(cfg.meta, { [P]: { 'Store status': 'In review' }, [Q]: { Store: '2026-12-01' } })
  cfg = removeField(cfg, 'Store', Q)
  assert.deepEqual([cfg.fields.map((f) => f.key), cfg.meta], [['Live', 'Store status'], { [P]: { 'Store status': 'In review' } }])
})

test('a default fills repos without a value, and clearing beats it', () => {
  let cfg = saveField({}, { key: 'Stack', type: 'string', default: ' Node ' })
  cfg = saveField(cfg, { key: 'Live', type: 'boolean', default: true })
  cfg = saveField(cfg, { key: 'Notes', type: 'text', default: '' }) // empty default is no default
  assert.deepEqual(cfg.fields.map((f) => f.default), ['Node', true, undefined])
  assert.deepEqual(withMeta(cfg, { path: P }).meta, { Stack: 'Node', Live: true })

  cfg = setValue(cfg, { path: P, key: 'Stack', value: 'Go' })
  cfg = setValue(cfg, { path: P, key: 'Live', value: false }) // switched off on purpose: stays off
  assert.deepEqual(cfg.meta[P], { Stack: 'Go', Live: null })
  assert.deepEqual(withMeta(cfg, { path: P }).meta, { Stack: 'Go' })

  cfg = saveField(cfg, { was: 'Live', key: 'Live', type: 'boolean' }) // default dropped: the null goes with it
  assert.deepEqual(cfg.meta[P], { Stack: 'Go' })
  assert.throws(() => saveField(cfg, { key: 'Due', type: 'date', default: 'soon' }), /default for Due takes a date/)
})

test('bad input is refused with a readable message', () => {
  const cfg = saveField({}, { key: 'Launch', type: 'date' })
  assert.throws(() => saveField(cfg, { key: 'Launch', type: 'date' }), /already a field/)
  assert.throws(() => saveField(cfg, { key: 'constructor', type: 'string' }), /reserved/)
  assert.throws(() => saveField(cfg, { key: 'x', type: 'number' }), /Pick a type/)
  assert.throws(() => saveField(cfg, { key: '', type: 'string' }), /name/)
  assert.throws(() => setValue(cfg, { path: P, key: 'Launch', value: 'soon' }), /a date/)
  assert.throws(() => setValue(cfg, { path: P, key: 'Nope', value: 'x' }), /no field/)
})
