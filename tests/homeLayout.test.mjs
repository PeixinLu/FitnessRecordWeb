import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('equipment swipe reserves compact height for two rows of SVG cards', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /\.equipment-swipe\s*\{\s*height: 168px;/)
  assert.match(source, /grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('home removes the date timeline and keeps compact iPhone SE spacing', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.doesNotMatch(source, /\.date-section\s*\{/)
  assert.match(source, /@media \(max-height: 667px\)/)
})

test('home collapses the equipment area into a frosted row while records scroll', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /const isEquipmentCollapsed = ref\(false\)/)
  assert.match(source, /@scroll="onRecordsScroll"/)
  assert.match(source, /\.equipment-section\.collapsed/)
  assert.match(source, /backdrop-filter: blur\(20px\)/)
})

test('today workout entries use equipment icons and support group swipe deletion', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /function getGroupEquipmentIcon/)
  assert.match(source, /<van-swipe-cell/)
  assert.match(source, /async function deleteWorkoutGroup/)
  assert.match(source, /group\.records\.map\(\(record\) => recordStore\.deleteRecord\(record\.id\)\)/)
})
