import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('workout detail delegates wheel editing to the shared set details editor', async () => {
  const source = await readFile(path.resolve('src/views/WorkoutDetail.vue'), 'utf8')

  assert.match(source, /import SetDetailsEditor from '@\/components\/SetDetailsEditor\.vue'/)
  assert.match(source, /<SetDetailsEditor :sets="records" :fields="detailFields"/)
})
