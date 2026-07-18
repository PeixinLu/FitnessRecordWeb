import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('document opts into Safari edge-to-edge layout with a light fallback theme', async () => {
  const source = await readFile(path.resolve('index.html'), 'utf8')

  assert.match(source, /name="viewport"[^>]*viewport-fit=cover/)
  assert.match(source, /<meta name="theme-color" content="#f5f5f7"\s*\/?>/)
})

test('root surfaces share a dynamic environment background', async () => {
  const [globalSource, appSource] = await Promise.all([
    readFile(path.resolve('src/style.css'), 'utf8'),
    readFile(path.resolve('src/App.vue'), 'utf8'),
  ])

  assert.match(globalSource, /--app-environment-color:\s*#f5f5f7/)
  assert.match(globalSource, /:root\.stack-environment\s*\{[^}]*--app-environment-color:\s*#000/m)
  assert.match(globalSource, /--app-environment-transition-duration:\s*280ms/)
  assert.match(globalSource, /html,[\s\S]*body,[\s\S]*#app\s*\{[^}]*background-color:\s*var\(--app-environment-color\)/m)
  assert.match(
    globalSource,
    /html,[\s\S]*body,[\s\S]*#app\s*\{[^}]*transition:\s*background-color\s+var\(--app-environment-transition-duration\)/m,
  )
  assert.match(globalSource, /prefers-reduced-motion:\s*reduce[\s\S]*--app-environment-transition-duration:\s*0\.01ms/m)
  assert.match(globalSource, /html\.stack-environment[\s\S]*overscroll-behavior-y:\s*none/m)
  assert.doesNotMatch(appSource, /body\s*\{[^}]*background-color:\s*#f5f5f7/m)
  assert.doesNotMatch(appSource, /#app\s*\{[^}]*background-color:\s*#f5f5f7/m)
})

test('stack state fades the page environment and Safari chrome together', async () => {
  const [stackSource, titleSource] = await Promise.all([
    readFile(path.resolve('src/components/PrimaryPageStack.vue'), 'utf8'),
    readFile(path.resolve('src/components/PrimaryPageTitle.vue'), 'utf8'),
  ])

  assert.match(
    stackSource,
    /const usesStackEnvironment = computed\(\s*\(\) => stackState\.value\.isStacked/,
  )
  assert.match(stackSource, /document\.documentElement\.classList\.toggle\(["']stack-environment["'], active\)/)
  assert.match(stackSource, /querySelector<HTMLMetaElement>\(\s*'meta\[name="theme-color"\]'/)
  assert.match(stackSource, /const ENVIRONMENT_TRANSITION_MS = 280/)
  assert.match(stackSource, /window\.requestAnimationFrame/)
  assert.match(stackSource, /window\.cancelAnimationFrame/)
  assert.match(stackSource, /prefers-reduced-motion:\s*reduce/)
  assert.match(stackSource, /watch\(\s*usesStackEnvironment,[\s\S]*syncBrowserEnvironment\(active\)[\s\S]*immediate: true/m)
  assert.match(stackSource, /resetBrowserEnvironment\(\)/)
  assert.match(
    stackSource,
    /\.card-stage\s*\{[^}]*background(?:-color)?:\s*var\(--app-environment-color\)[^}]*transition:[^}]*background-color\s+var\(--app-environment-transition-duration\)/m,
  )
  assert.match(titleSource, /padding-top:\s*calc\(18px \+ env\(safe-area-inset-top\)\)/)
})

test('mobile viewport stays pinned while page content owns vertical scrolling', async () => {
  const [globalSource, appSource, stackSource, homeSource] = await Promise.all([
    readFile(path.resolve('src/style.css'), 'utf8'),
    readFile(path.resolve('src/App.vue'), 'utf8'),
    readFile(path.resolve('src/components/PrimaryPageStack.vue'), 'utf8'),
    readFile(path.resolve('src/views/Home.vue'), 'utf8'),
  ])

  assert.match(
    globalSource,
    /html,[\s\S]*body,[\s\S]*#app\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*hidden/m,
  )
  assert.doesNotMatch(appSource, /#app\s*\{[^}]*min-height:\s*100vh/m)
  assert.match(
    appSource,
    /\.app-container,[\s\S]*\.main-content\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*overflow:\s*hidden/m,
  )
  assert.match(stackSource, /\.card-stage\s*\{[^}]*height:\s*100%[^}]*overscroll-behavior:\s*none/m)
  assert.doesNotMatch(stackSource, /\.card-stage\s*\{[^}]*(?:100vh|100dvh)/m)
  assert.match(
    stackSource,
    /\.card-page-content\s*\{[^}]*overflow:\s*auto[^}]*overscroll-behavior-y:\s*contain/m,
  )
  assert.match(stackSource, /\.card-page-content\.blocked\s*\{[^}]*overflow:\s*hidden/m)
  assert.match(
    homeSource,
    /\.records-section\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto[^}]*overscroll-behavior-y:\s*contain/m,
  )
})
