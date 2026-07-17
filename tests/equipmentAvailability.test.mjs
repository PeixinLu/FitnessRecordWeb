import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('case library disables actions already in the user equipment', async () => {
  const source = await readFile(path.resolve('src/views/EquipmentManagement.vue'), 'utf8')

  assert.match(source, /function isActionAdded\(equipmentCase: EquipmentCase, actionId: string\)/)
  assert.match(source, /:disabled="isActionAdded\(selectedCase, action\.id\)"/)
  assert.match(source, /:is-link="!isCaseComplete\(equipmentCase\)"/)
  assert.match(source, /if \(isCaseComplete\(equipmentCase\)\) return/)
})

test('home only opens equipment drawers with at least one action', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /if \(!hasExercises\(equipmentId\)\) return/)
  assert.match(source, /:class="\{ disabled: !hasExercises\(equipment\.id\) \}"/)
})
