import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('primary page stack mounts four fixed pages behind isolated recall buttons', async () => {
  const source = await readFile(path.resolve('src/components/PrimaryPageStack.vue'), 'utf8')

  for (const page of ['Home', 'Calendar', 'Statistics', 'Settings']) {
    assert.match(source, new RegExp(`import ${page} from ["']@\/views\/${page}\.vue["']`))
  }
  assert.match(source, /class="card-page-content"/)
  assert.match(source, /:inert="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /class="card-recall"/)
  assert.match(source, /@click\.stop="activatePage\(index\)"/)
  assert.match(source, /@transitionend="handleCardTransitionEnd\(\$event, index\)"/)
  assert.doesNotMatch(source, /@transitioncancel=/)
  assert.match(source, /@pointerdown\.capture="handleStagePointerDown"/)
  assert.match(source, /Math\.abs\(event\.elapsedTime - FOREGROUND_TRANSITION_SECONDS\)/)
  assert.match(source, /Date\.now\(\) < recallLockedUntil/)
  assert.match(source, /guarding: cardStates\[index\]\.guardInteractive/)
  assert.match(source, /:tabindex="cardStates\[index\]\.recallInteractive \? 0 : -1"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.recallInteractive"/)
  assert.match(source, /ref="stackFab"/)
  assert.match(source, /stackFab\.value\?\.focus\(\)/)
  assert.match(source, /class="stack-fab"[\s\S]*stacked: stackState\.isStacked/)
  assert.match(source, /class="stack-tabs-icon"/)
  assert.match(source, /class="stack-back-icon"/)
  assert.match(source, /background:\s*rgba\(255, 255, 255, 0\.82\)/)
  assert.match(source, /backdrop-filter:\s*blur\(20px\) saturate\(180%\)/)
  assert.match(source, /-webkit-backdrop-filter:\s*blur\(20px\) saturate\(180%\)/)
  assert.match(source, /\.stack-fab\.stacked\s*\{[^}]*opacity:\s*0\.82/m)
  assert.match(source, /\.stack-fab\.stacked \.stack-tabs-icon\s*\{[^}]*opacity:\s*0/m)
  assert.match(source, /\.stack-fab\.stacked \.stack-back-icon\s*\{[^}]*opacity:\s*1/m)
  assert.match(source, /\.card-stage\s*\{[^}]*perspective:\s*none/m)
  assert.match(source, /\.card-page-content\.blocked\s*\{[^}]*pointer-events:\s*none/m)
  assert.match(source, /\.card-recall\.guarding\s*\{[^}]*pointer-events:\s*auto/m)
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

  assert.match(sources[0], /\.home-page\s*\{[^}]*height:\s*100%/m)
  assert.doesNotMatch(sources[0], /\.home-page\s*\{[^}]*height:\s*100vh/m)
})

test('primary views share large page titles and Home removes its date timeline', async () => {
  const [titleSource, home, calendar, statistics, settings] = await Promise.all([
    readFile(path.resolve('src/components/PrimaryPageTitle.vue'), 'utf8').catch(() => ''),
    ...['Home', 'Calendar', 'Statistics', 'Settings'].map(name =>
      readFile(path.resolve(`src/views/${name}.vue`), 'utf8'),
    ),
  ])

  assert.match(titleSource, /defineProps<\{ title: string \}>\(\)/)
  assert.match(titleSource, /<h1 class="primary-page-title">\{\{ title \}\}<\/h1>/)
  assert.match(titleSource, /font-size:\s*34px/)
  assert.match(titleSource, /line-height:\s*41px/)
  assert.match(titleSource, /font-weight:\s*700/)
  assert.match(titleSource, /padding:\s*18px 20px 10px/)

  for (const [source, title] of [
    [home, '记录'],
    [calendar, '日历'],
    [statistics, '统计'],
    [settings, '设置'],
  ]) {
    assert.match(source, /import PrimaryPageTitle from ["']@\/components\/PrimaryPageTitle\.vue["']/)
    assert.ok(source.includes(`<PrimaryPageTitle title="${title}" />`))
  }

  assert.doesNotMatch(home, /class="date-section"/)
  assert.doesNotMatch(home, /onDateTouch(Start|Move|End)/)
  assert.doesNotMatch(home, /dateScrollX|dateStartX|isDragging/)
})
