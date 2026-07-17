import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('bottom tab active icons are available in Vant', async () => {
  const appSource = await readFile(path.resolve('src/App.vue'), 'utf8')
  const vantIcons = await readFile(path.resolve('node_modules/vant/es/icon/index.css'), 'utf8')
  const activeIcons = [...appSource.matchAll(/activeIcon: '([^']+)'/g)].map(match => match[1])

  activeIcons.forEach(icon => {
    assert.match(vantIcons, new RegExp(`\\.van-icon-${icon}:before`))
  })
})

test('bottom tab active state uses a pill shape', async () => {
  const appSource = await readFile(path.resolve('src/App.vue'), 'utf8')

  assert.match(appSource, /\.tab-item\.active\s*\{[^}]*border-radius:\s*999px/m)
})

test('bottom tab items fill the dock so edge pills align with its inner edges', async () => {
  const appSource = await readFile(path.resolve('src/App.vue'), 'utf8')

  assert.match(appSource, /\.floating-tabbar\s*\{[^}]*justify-content:\s*space-between/m)
  assert.match(appSource, /\.tab-item\s*\{[^}]*flex:\s*1/m)
  assert.match(appSource, /\.tab-item\s*\{[^}]*min-width:\s*0/m)
})

test('dock uses the compact iPhone SE dimensions', async () => {
  const source = await readFile(path.resolve('src/App.vue'), 'utf8')

  assert.match(source, /\.floating-tabbar\s*\{[^}]*height:\s*54px/m)
  assert.match(source, /\.app-container\s*\{[^}]*padding-bottom:\s*68px/m)
})
