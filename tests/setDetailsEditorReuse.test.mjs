import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('record creation and workout details share one set details editor', async () => {
  const drawer = await readFile(path.resolve('src/components/EquipmentDrawer.vue'), 'utf8')
  const detail = await readFile(path.resolve('src/views/WorkoutDetail.vue'), 'utf8')

  assert.match(drawer, /import SetDetailsEditor from '@\/components\/SetDetailsEditor\.vue'/)
  assert.match(detail, /import SetDetailsEditor from '@\/components\/SetDetailsEditor\.vue'/)
  assert.match(drawer, /<SetDetailsEditor/)
  assert.match(detail, /<SetDetailsEditor/)
})
