import test from 'node:test'
import assert from 'node:assert/strict'
import { inline } from './inline.js'

test('bold, italic and links become tokens', () => {
  assert.deepEqual(inline('Billing *api* for _invoice-app_'), ['Billing ', { b: ['api'] }, ' for ', { i: ['invoice-app'] }])
  assert.deepEqual(inline('*see [docs](https://x.dev/a)*'), [{ b: ['see ', { a: 'https://x.dev/a', kids: ['docs'] }] }])
  assert.deepEqual(inline('Live at https://x.dev/app.'), ['Live at ', { a: 'https://x.dev/app', kids: ['https://x.dev/app'] }, '.'])
})

test('unsafe links and stray markers stay plain text', () => {
  assert.deepEqual(inline('[click](javascript:alert(1))'), ['[click](javascript:alert(1))'])
  assert.deepEqual(inline('[x](data:text/html,hi)'), ['[x](data:text/html,hi)'])
  assert.deepEqual(inline('snake_case_name and 2*3*4'), ['snake_case_name and 2*3*4'])
  assert.deepEqual(inline('a * b * c and _ x _'), ['a * b * c and _ x _'])
  assert.deepEqual(inline('<img src=x onerror=alert(1)>'), ['<img src=x onerror=alert(1)>']) // a string, rendered as text
})
