import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('primary page stack mounts four fixed pages behind isolated recall buttons', async () => {
  const source = await readFile(path.resolve('src/components/PrimaryPageStack.vue'), 'utf8')

  for (const page of ['Home', 'Calendar', 'Statistics', 'Settings']) {
    assert.match(source, new RegExp(`import ${page} from '@\/views\/${page}\.vue'`))
  }
  assert.match(source, /class="card-page-content"/)
  assert.match(source, /:inert="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /class="card-recall"/)
  assert.match(source, /@click\.stop="activatePage\(index\)"/)
  assert.match(source, /:tabindex="cardStates\[index\]\.recallInteractive \? 0 : -1"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.recallInteractive"/)
  assert.match(source, /\.card-stage\s*\{[^}]*perspective:\s*none/m)
  assert.match(source, /\.card-page-content\.blocked\s*\{[^}]*pointer-events:\s*none/m)
})

test('app removes the bottom dock and router mounts one primary stack route', async () => {
  const [appSource, routerSource] = await Promise.all([
    readFile(path.resolve('src/App.vue'), 'utf8'),
    readFile(path.resolve('src/router/index.ts'), 'utf8'),
  ])

  assert.doesNotMatch(appSource, /floating-tabbar|tabItems|tab-item/)
  assert.doesNotMatch(appSource, /padding-bottom:\s*68px/)
  assert.match(appSource, /<router-view\s*\/>/)
  assert.match(routerSource, /path:\s*'\/'[\s\S]*name:\s*'home'[\s\S]*PrimaryPageStack\.vue/)
  for (const legacyPath of ['calendar', 'statistics', 'settings']) {
    assert.match(routerSource, new RegExp(`path: '/${legacyPath}'[\\s\\S]*redirect: '/'`))
  }
  for (const secondaryPath of [
    '/equipment-management',
    '/equipment-management/:equipmentId',
    '/workout/:date/:exerciseId',
    '/debug/number-wheel',
  ]) {
    assert.ok(routerSource.includes(`path: '${secondaryPath}'`))
  }
})

test('primary pages reserve safe scrolling space beneath the stack FAB', async () => {
  const sources = await Promise.all(
    ['Home', 'Calendar', 'Statistics', 'Settings'].map(name =>
      readFile(path.resolve(`src/views/${name}.vue`), 'utf8'),
    ),
  )

  for (const source of sources) {
    assert.match(source, /padding-bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom\)\)/)
  }
})
