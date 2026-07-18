# 一级页面卡片堆叠导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除四个一级页面的底部导航，把记录、日历、统计、设置作为常驻卡片放入单页 3D 堆栈，并确保堆叠态只能召回卡片、不能触发页面内部操作。

**Architecture:** 根路由只渲染 `PrimaryPageStack`，组件内部以 `activeIndex` 和 `isStacked` 管理四张常驻页面；纯函数模块计算卡片位置、外观和交互权限。二级页面继续使用 Vue Router，旧一级地址重定向到根路由。

**Tech Stack:** Vue 3、TypeScript、Vue Router、Pinia、Vant、CSS 3D Transforms、Node test。

## Global Constraints

- 一级卡片顺序固定为记录、日历、统计、设置。
- 页面加载默认显示记录页，不持久化一级页面索引。
- 堆叠态页面内容必须同时应用 `pointer-events: none`、`inert` 和 `aria-hidden="true"`。
- 堆叠态只有透明卡片召回按钮可交互；FAB 不改变当前激活页。
- Stage 使用 `perspective: 80px`；四卡 Y 偏移为 `10px`、`25%`、`50%`、`75%`，Z 深度为 `-12px`、`-11px`、`-10px`、`-9px`。
- 前台到堆叠使用 400ms 回弹曲线；堆叠到前台使用 300ms ease-out；transition 不包含 `z-index`。
- 不新增依赖，不修改 IndexedDB schema，不改变二级业务流程。
- 完成后运行 `node --test tests/*.test.mjs` 与 `npm run build`，并手动验证移动端交互。

---

### Task 1: 卡片堆栈纯状态与视觉计算

**Files:**
- Create: `src/utils/cardStack.ts`
- Create: `tests/cardStackState.test.mjs`

**Interfaces:**
- Produces: `CardStackState`、`CardVisualState`、`createCardStackState()`、`getCardVisualState(index, count, state)`、`toggleStack(state)`、`activateCard(state, index, count)`。
- Consumes: 无业务 Store 或 DOM 依赖。

- [ ] **Step 1: Write the failing state tests**

Create `tests/cardStackState.test.mjs`:

```js
import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

async function loadModule() {
  const outdir = path.join(tmpdir(), 'fitness-record-card-stack-tests')
  const outfile = path.join(outdir, `cardStack-${Date.now()}.mjs`)
  await mkdir(outdir, { recursive: true })
  const source = await readFile(path.resolve('src/utils/cardStack.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  })
  await writeFile(outfile, output.outputText)
  const mod = await import(`file://${outfile}`)
  await rm(outfile, { force: true })
  return mod
}

test('four stacked cards use the specified offsets and block page content', async () => {
  const { createCardStackState, getCardVisualState } = await loadModule()
  const state = { ...createCardStackState(), isStacked: true }
  const cards = Array.from({ length: 4 }, (_, index) => getCardVisualState(index, 4, state))

  assert.deepEqual(cards.map(card => card.style.transform), [
    'translate3d(0, 10px, -12px) rotateX(-1deg)',
    'translate3d(0, 25.00%, -11px) rotateX(-1deg)',
    'translate3d(0, 50.00%, -10px) rotateX(-1deg)',
    'translate3d(0, 75.00%, -9px) rotateX(-1deg)',
  ])
  assert.deepEqual(cards.map(card => card.contentInteractive), [false, false, false, false])
  assert.deepEqual(cards.map(card => card.recallInteractive), [true, true, true, true])
  assert.ok(cards.every(card => card.style.borderRadius === '20px'))
  assert.ok(cards.every(card => !card.style.transition.includes('z-index')))
})

test('foreground mode only exposes the active page', async () => {
  const { getCardVisualState } = await loadModule()
  const state = { activeIndex: 2, isStacked: false }
  const cards = Array.from({ length: 4 }, (_, index) => getCardVisualState(index, 4, state))

  assert.equal(cards[2].style.transform, 'translate3d(0, 0, 0)')
  assert.equal(cards[2].style.borderRadius, '0')
  assert.equal(cards[2].contentInteractive, true)
  assert.equal(cards[2].recallInteractive, false)
  assert.match(cards[0].style.transform, /-100%/)
  assert.match(cards[1].style.transform, /-100%/)
  assert.match(cards[3].style.transform, /100%/)
  assert.deepEqual(cards.map(card => card.contentInteractive), [false, false, true, false])
})

test('FAB preserves the active page and card recall clamps the selected index', async () => {
  const { activateCard, toggleStack } = await loadModule()
  const foreground = { activeIndex: 2, isStacked: false }
  const stacked = toggleStack(foreground)

  assert.deepEqual(stacked, { activeIndex: 2, isStacked: true })
  assert.deepEqual(toggleStack(stacked), foreground)
  assert.deepEqual(activateCard(stacked, 99, 4), { activeIndex: 3, isStacked: false })
})
```

- [ ] **Step 2: Run the state tests and verify RED**

Run: `node --test tests/cardStackState.test.mjs`

Expected: FAIL with `ENOENT` for `src/utils/cardStack.ts`.

- [ ] **Step 3: Implement the minimal pure state module**

Create `src/utils/cardStack.ts`:

```ts
export interface CardStackState {
  activeIndex: number
  isStacked: boolean
}

export interface CardVisualState {
  style: {
    transform: string
    borderRadius: string
    boxShadow: string
    zIndex: number
    transition: string
  }
  isForeground: boolean
  contentInteractive: boolean
  recallInteractive: boolean
}

const STACKED_TRANSITION =
  'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.08), border-radius 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.08), box-shadow 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.08)'
const FOREGROUND_TRANSITION =
  'transform 0.3s cubic-bezier(0, 0, 0.2, 1), border-radius 0.3s cubic-bezier(0, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0, 0, 0.2, 1)'
const STACKED_SHADOW = '0 30px 80px rgba(0, 0, 0, 0.35)'

export function createCardStackState(): CardStackState {
  return { activeIndex: 0, isStacked: false }
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return -1
  return Math.min(Math.max(Math.trunc(index), 0), count - 1)
}

export function toggleStack(state: CardStackState): CardStackState {
  return { ...state, isStacked: !state.isStacked }
}

export function activateCard(state: CardStackState, index: number, count: number): CardStackState {
  if (!state.isStacked) return state
  return { activeIndex: clampIndex(index, count), isStacked: false }
}

export function getCardVisualState(
  index: number,
  count: number,
  state: CardStackState,
): CardVisualState {
  if (count <= 0 || index < 0 || index >= count) {
    throw new RangeError('Card index must reference a non-empty stack')
  }

  const activeIndex = clampIndex(state.activeIndex, count)
  const z = -(9 + (count - 1 - index))

  if (state.isStacked) {
    const y = index === 0 ? '10px' : `${(index * 100 / count).toFixed(2)}%`
    return {
      style: {
        transform: `translate3d(0, ${y}, ${z}px) rotateX(-1deg)`,
        borderRadius: '20px',
        boxShadow: STACKED_SHADOW,
        zIndex: index + 1,
        transition: STACKED_TRANSITION,
      },
      isForeground: false,
      contentInteractive: false,
      recallInteractive: true,
    }
  }

  if (index === activeIndex) {
    return {
      style: {
        transform: 'translate3d(0, 0, 0)',
        borderRadius: '0',
        boxShadow: 'none',
        zIndex: 99,
        transition: FOREGROUND_TRANSITION,
      },
      isForeground: true,
      contentInteractive: true,
      recallInteractive: false,
    }
  }

  const y = index < activeIndex ? '-100%' : '100%'
  return {
    style: {
      transform: `translate3d(0, ${y}, ${z}px) rotateX(-1deg)`,
      borderRadius: '20px',
      boxShadow: STACKED_SHADOW,
      zIndex: index + 1,
      transition: FOREGROUND_TRANSITION,
    },
    isForeground: false,
    contentInteractive: false,
    recallInteractive: false,
  }
}
```

- [ ] **Step 4: Run the state tests and verify GREEN**

Run: `node --test tests/cardStackState.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the state module**

```bash
git add src/utils/cardStack.ts tests/cardStackState.test.mjs
git commit -m "Add card stack state model"
```

### Task 2: 常驻一级页面堆栈组件与交互隔离

**Files:**
- Create: `src/components/PrimaryPageStack.vue`
- Create: `tests/cardStackShell.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports and existing `Home`、`Calendar`、`Statistics`、`Settings` components.
- Produces: 根路由可渲染的 `PrimaryPageStack` component。

- [ ] **Step 1: Write the failing component contract test**

Create `tests/cardStackShell.test.mjs`:

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

test('primary page stack mounts four fixed pages behind isolated recall buttons', async () => {
  const source = await readFile(path.resolve('src/components/PrimaryPageStack.vue'), 'utf8')

  for (const page of ['Home', 'Calendar', 'Statistics', 'Settings']) {
    assert.match(source, new RegExp(`import ${page} from '@\\/views\\/${page}\\.vue'`))
  }
  assert.match(source, /class="card-page-content"/)
  assert.match(source, /:inert="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.contentInteractive"/)
  assert.match(source, /class="card-recall"/)
  assert.match(source, /@click\.stop="activatePage\(index\)"/)
  assert.match(source, /:tabindex="cardStates\[index\]\.recallInteractive \? 0 : -1"/)
  assert.match(source, /:aria-hidden="!cardStates\[index\]\.recallInteractive"/)
  assert.match(source, /\.card-stage\s*\{[^}]*perspective:\s*80px/m)
  assert.match(source, /\.card-page-content\.blocked\s*\{[^}]*pointer-events:\s*none/m)
})
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `node --test tests/cardStackShell.test.mjs`

Expected: FAIL with `ENOENT` for `src/components/PrimaryPageStack.vue`.

- [ ] **Step 3: Implement the page stack component**

Create `src/components/PrimaryPageStack.vue`:

```vue
<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import Home from '@/views/Home.vue'
import Calendar from '@/views/Calendar.vue'
import Statistics from '@/views/Statistics.vue'
import Settings from '@/views/Settings.vue'
import {
  activateCard,
  createCardStackState,
  getCardVisualState,
  toggleStack,
  type CardStackState,
} from '@/utils/cardStack'

interface PrimaryPage {
  label: string
  component: Component
}

const pages: PrimaryPage[] = [
  { label: '记录', component: Home },
  { label: '日历', component: Calendar },
  { label: '统计', component: Statistics },
  { label: '设置', component: Settings },
]

const stackState = ref<CardStackState>(createCardStackState())
const cardStates = computed(() =>
  pages.map((_, index) => getCardVisualState(index, pages.length, stackState.value)),
)

function toggleStackMode() {
  stackState.value = toggleStack(stackState.value)
}

function activatePage(index: number) {
  if (!stackState.value.isStacked) return
  stackState.value = activateCard(stackState.value, index, pages.length)
}
</script>

<template>
  <section class="card-stage" :class="{ stacked: stackState.isStacked }">
    <article
      v-for="(page, index) in pages"
      :key="page.label"
      class="stack-card"
      :class="{ foreground: cardStates[index].isForeground }"
      :style="cardStates[index].style"
    >
      <div
        class="card-page-content"
        :class="{ blocked: !cardStates[index].contentInteractive }"
        :inert="!cardStates[index].contentInteractive"
        :aria-hidden="!cardStates[index].contentInteractive"
      >
        <component :is="page.component" />
      </div>

      <button
        type="button"
        class="card-recall"
        :class="{ enabled: cardStates[index].recallInteractive }"
        :aria-label="`打开${page.label}页面`"
        :aria-hidden="!cardStates[index].recallInteractive"
        :tabindex="cardStates[index].recallInteractive ? 0 : -1"
        @click.stop="activatePage(index)"
      />
    </article>

    <button
      type="button"
      class="stack-fab"
      :aria-label="stackState.isStacked ? '恢复当前页面' : '显示页面堆栈'"
      :aria-expanded="stackState.isStacked"
      @click="toggleStackMode"
    >
      <span class="stack-fab-icon" :class="{ up: stackState.isStacked }" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
.card-stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #000;
  perspective: 80px;
}

.stack-card {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f7;
  transform-origin: top;
  transform-style: preserve-3d;
}

.card-page-content {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.card-page-content.blocked {
  pointer-events: none;
  user-select: none;
}

.card-recall {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  pointer-events: none;
}

.card-recall.enabled {
  cursor: pointer;
  pointer-events: auto;
}

.card-recall.enabled:focus-visible {
  outline: 3px solid #0a84ff;
  outline-offset: -5px;
}

.stack-fab {
  position: fixed;
  right: calc(24px + env(safe-area-inset-right));
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #1a1a1a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  color: #fff;
}

.stack-fab-icon {
  position: relative;
  width: 24px;
  height: 24px;
}

.stack-fab-icon::before,
.stack-fab-icon::after {
  position: absolute;
  left: 50%;
  width: 10px;
  height: 10px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  content: '';
  transform: translateX(-50%) rotate(45deg);
  transition: transform 0.3s;
}

.stack-fab-icon::before { top: 0; }
.stack-fab-icon::after { top: 6px; }
.stack-fab-icon.up::before,
.stack-fab-icon.up::after { transform: translateX(-50%) rotate(-135deg); }

@media (prefers-reduced-motion: reduce) {
  .stack-card,
  .stack-fab-icon::before,
  .stack-fab-icon::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
```

- [ ] **Step 4: Run component and state tests**

Run: `node --test tests/cardStackState.test.mjs tests/cardStackShell.test.mjs`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the stack component**

```bash
git add src/components/PrimaryPageStack.vue tests/cardStackShell.test.mjs
git commit -m "Add primary page card stack"
```

### Task 3: 移除底栏并收敛一级路由

**Files:**
- Modify: `src/App.vue`
- Modify: `src/router/index.ts`
- Modify: `tests/cardStackShell.test.mjs`
- Modify: `tests/calendarHistoryMerge.test.mjs`
- Delete: `tests/tabbarIcons.test.mjs`

**Interfaces:**
- Consumes: `PrimaryPageStack` as the `/` route component.
- Produces: 单一一级入口 `/`；旧一级地址重定向；所有二级路由保持原名称与参数。

- [ ] **Step 1: Extend shell tests for App and Router contracts**

Append to `tests/cardStackShell.test.mjs`:

```js
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
    assert.match(routerSource, new RegExp(`path: '${secondaryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`))
  }
})
```

Replace the second test in `tests/calendarHistoryMerge.test.mjs` with:

```js
test('calendar is mounted inside the primary stack and its old route redirects home', async () => {
  const [stackSource, routerSource] = await Promise.all([
    readFile(path.resolve('src/components/PrimaryPageStack.vue'), 'utf8'),
    readFile(path.resolve('src/router/index.ts'), 'utf8'),
  ])

  assert.match(stackSource, /import Calendar from '@\/views\/Calendar\.vue'/)
  assert.match(routerSource, /path: '\/calendar'[\s\S]*redirect: '\/'/)
  assert.doesNotMatch(routerSource, /path: '\/history'/)
})
```

Delete `tests/tabbarIcons.test.mjs`, because every assertion in it specifies the removed bottom dock.

- [ ] **Step 2: Run shell-related tests and verify RED**

Run: `node --test tests/cardStackShell.test.mjs tests/calendarHistoryMerge.test.mjs`

Expected: FAIL because `App.vue` still contains the dock and the primary routes still render separate pages.

- [ ] **Step 3: Replace App shell with a dock-free router outlet**

In `src/App.vue`:

- Remove `computed`、`useRoute`、`currentRoute` and `tabItems`.
- Keep the existing Store loading block unchanged.
- Replace the template with:

```vue
<template>
  <div class="app-container">
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>
```

- Keep global styles and the two `:has(.home-page...)` scaling rules.
- Replace `.app-container` and `.main-content` sizing with:

```css
.app-container,
.main-content {
  min-height: 100vh;
  min-height: 100dvh;
}

.main-content {
  transform-origin: top center;
  transition: transform 0.28s ease, border-radius 0.28s ease;
}
```

- Remove all `.floating-tabbar`、`.tab-item`、`.tab-label` and dock dark-mode rules.

- [ ] **Step 4: Replace separate primary routes with the stack root and redirects**

In `src/router/index.ts`, make the first four routes:

```ts
{
  path: '/',
  name: 'home',
  component: () => import('@/components/PrimaryPageStack.vue'),
},
{ path: '/calendar', redirect: '/' },
{ path: '/statistics', redirect: '/' },
{ path: '/settings', redirect: '/' },
```

Keep every secondary route object unchanged.

- [ ] **Step 5: Run the shell-related tests and verify GREEN**

Run: `node --test tests/cardStackShell.test.mjs tests/calendarHistoryMerge.test.mjs`

Expected: all shell and calendar tests pass.

- [ ] **Step 6: Commit the App and Router integration**

```bash
git add src/App.vue src/router/index.ts tests/cardStackShell.test.mjs tests/calendarHistoryMerge.test.mjs tests/tabbarIcons.test.mjs
git commit -m "Replace bottom navigation with card stack"
```

### Task 4: FAB 安全区、页面滚动余量与完整验证

**Files:**
- Modify: `src/views/Home.vue`
- Modify: `src/views/Calendar.vue`
- Modify: `src/views/Statistics.vue`
- Modify: `src/views/Settings.vue`
- Modify: `tests/cardStackShell.test.mjs`

**Interfaces:**
- Consumes: fixed 56px FAB with 24px viewport inset.
- Produces: each primary page has at least `88px + safe-area-inset-bottom` bottom scroll clearance.

- [ ] **Step 1: Add the failing safe-area test**

Append to `tests/cardStackShell.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the safe-area test and verify RED**

Run: `node --test tests/cardStackShell.test.mjs`

Expected: FAIL because the existing pages use fixed 60px、76px or 100px bottom padding.

- [ ] **Step 3: Give all primary pages safe bottom clearance**

Apply this declaration to the primary scrolling container in each file:

```css
padding-bottom: calc(88px + env(safe-area-inset-bottom));
```

- `Home.vue`: replace both `.records-section` bottom padding declarations, including the `max-height: 667px` override.
- `Calendar.vue`: replace `.calendar-page` fixed bottom padding.
- `Statistics.vue`: replace `.statistics-page` fixed bottom padding.
- `Settings.vue`: replace `.settings-page` fixed bottom padding.

- [ ] **Step 4: Run all automated tests**

Run: `node --test tests/*.test.mjs`

Expected: every test passes, 0 failures.

- [ ] **Step 5: Run production type-check and build**

Run: `npm run build`

Expected: `vue-tsc -b` and Vite both exit successfully.

- [ ] **Step 6: Run manual mobile browser verification**

Run: `npm run dev -- --host 127.0.0.1`

Verify at an iPhone SE-sized viewport:

1. `/` starts on the record page without a bottom dock.
2. FAB produces the four required Y/Z positions.
3. Clicking the exposed portion of each card brings exactly that page to the foreground.
4. Clicking over an underlying page button while stacked never executes that button.
5. Switching away and back preserves calendar selection, scroll positions and local page state.
6. Settings links still open equipment management and number-wheel debug routes.
7. An open Vant drawer or popup blocks access to the FAB.
8. Reduced-motion emulation removes perceptible 3D movement.

- [ ] **Step 7: Commit final spacing and verification changes**

```bash
git add src/views/Home.vue src/views/Calendar.vue src/views/Statistics.vue src/views/Settings.vue tests/cardStackShell.test.mjs
git commit -m "Polish card stack mobile layout"
```
