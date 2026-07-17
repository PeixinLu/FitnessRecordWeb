import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('equipment indicator receives explicit swipe page updates', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /@change="onEquipmentPageChange"/)
  assert.match(source, /function onEquipmentPageChange\(page: number\) \{\s*equipmentPage\.value = page/)
})
