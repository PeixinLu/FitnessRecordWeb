import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('equipment swipe reserves compact height for two rows of SVG cards', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /\.equipment-swipe\s*\{\s*height: 168px;/)
  assert.match(source, /grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('home uses a compact timeline and equipment grid for iPhone SE height', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /\.date-section\s*\{[^}]*padding:\s*8px 16px/m)
  assert.match(source, /@media \(max-height: 667px\)/)
})

test('home collapses the equipment area into a frosted row while records scroll', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /const isEquipmentCollapsed = ref\(false\)/)
  assert.match(source, /@scroll="onRecordsScroll"/)
  assert.match(source, /\.equipment-section\.collapsed/)
  assert.match(source, /backdrop-filter: blur\(20px\)/)
  assert.match(source, /\.date-item\.today\s*\{[^}]*background: rgba\(0, 122, 255, 0\.1\)/m)
})

test('today workout entries use equipment icons and support group swipe deletion', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /function getGroupEquipmentIcon/)
  assert.match(source, /<van-swipe-cell/)
  assert.match(source, /async function deleteWorkoutGroup/)
  assert.match(source, /group\.records\.map\(record => recordStore\.deleteRecord\(record\.id\)\)/)
})
