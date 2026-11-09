import test from 'node:test'
import assert from 'node:assert/strict'
import api from './api.js'

// Calls the handler the way node:http would, and resolves to the status code it answered with.
const call = (headers, url = '/ping') => new Promise((resolve) => {
  api({ method: 'GET', url, headers: { host: 'localhost:4747', ...headers } }, { setHeader() {}, end() { resolve(this.statusCode) } })
})

test('requests from other websites are refused, reads included', async () => {
  assert.equal(await call({ 'sec-fetch-site': 'cross-site' }), 403)
  assert.equal(await call({ 'sec-fetch-site': 'same-site' }), 403) // another localhost port
  assert.equal(await call({ 'sec-fetch-site': 'same-origin' }), 200) // our own page
  assert.equal(await call({ 'sec-fetch-site': 'none' }), 200) // an address typed in the bar
  assert.equal(await call({}), 200) // a script, like a second npx diffdeck checking /ping
})
