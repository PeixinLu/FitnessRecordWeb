import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('workout detail uses the record drawer second-page shell', async () => {
  const source = await readFile(path.resolve('src/views/WorkoutDetail.vue'), 'utf8')

  assert.match(source, /class="drawer-container"/)
  assert.match(source, /class="drawer-header"/)
  assert.match(source, /class="drawer-footer"/)
  assert.doesNotMatch(source, /<van-nav-bar/)
})
