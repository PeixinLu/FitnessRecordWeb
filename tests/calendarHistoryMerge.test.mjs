import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('calendar keeps a selected date and renders read-only grouped daily training', async () => {
  const source = await readFile(path.resolve('src/views/Calendar.vue'), 'utf8')

  assert.match(source, /const selectedDate = ref\(recordStore\.getTodayDate\(\)\)/)
  assert.match(source, /const groupedSelectedDateRecords = computed/)
  assert.match(source, /title="当日训练"/)
  assert.match(source, /当天暂无训练记录/)
  assert.doesNotMatch(source, /van-swipe-cell/)
  assert.doesNotMatch(source, /deleteRecord/)
})

test('history route and tab are removed after merging into calendar', async () => {
  const [appSource, routerSource] = await Promise.all([
    readFile(path.resolve('src/App.vue'), 'utf8'),
    readFile(path.resolve('src/router/index.ts'), 'utf8'),
  ])

  assert.doesNotMatch(appSource, /name: 'history'/)
  assert.doesNotMatch(routerSource, /path: '\/history'/)
  assert.match(appSource, /name: 'calendar'/)
})
