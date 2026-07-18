import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('today workout groups open the detail editor in a popup', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /<van-popup[\s\S]*v-model:show="showWorkoutDetail"/)
  assert.match(source, /<WorkoutDetail/)
  assert.doesNotMatch(source, /router\.push\(\{ name: 'workout-detail'/)
})
