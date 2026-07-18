# Card Stack Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark stack control with a light frosted Safari-tabs control and give all four primary pages consistent left-aligned titles while removing the Home date timeline.

**Architecture:** Add a presentation-only `PrimaryPageTitle.vue` component and mount it inside each primary view so the heading moves with its card. Keep stack state and interaction locking unchanged; limit `PrimaryPageStack.vue` changes to two cross-fading CSS icons and frosted button styles.

**Tech Stack:** Vue 3, TypeScript, Vue single-file components, scoped CSS, Node test runner, Vite.

## Global Constraints

- Primary titles are exactly `记录`, `日历`, `统计`, and `设置`.
- Titles use `34px` font size, `41px` line height, `700` weight, and padding `18px 20px 10px`.
- The default stack button background is `rgba(255, 255, 255, 0.82)` with `blur(20px) saturate(180%)`.
- Stacked button opacity is `0.82` and must retain a light fill over the black stage.
- Do not add image assets, icon dependencies, routes, or stack-state fields.
- Do not perform browser or geometry verification; run source tests and `npm run build` only.

---

### Task 1: Shared Primary Page Titles

**Files:**
- Create: `src/components/PrimaryPageTitle.vue`
- Modify: `src/views/Home.vue`
- Modify: `src/views/Calendar.vue`
- Modify: `src/views/Statistics.vue`
- Modify: `src/views/Settings.vue`
- Test: `tests/cardStackShell.test.mjs`

**Interfaces:**
- Produces: Vue component prop `title: string` rendered as `<h1 class="primary-page-title">`.
- Consumes: Each primary view imports `PrimaryPageTitle` and passes its exact page name.

- [ ] **Step 1: Write the failing title and timeline test**

Extend `tests/cardStackShell.test.mjs` with a test that reads the title component and four view sources, asserts the exact component usages, and rejects the removed Home timeline:

```js
test('primary views share large page titles and Home removes its date timeline', async () => {
  const [titleSource, home, calendar, statistics, settings] = await Promise.all([
    readFile(path.resolve('src/components/PrimaryPageTitle.vue'), 'utf8'),
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
    assert.match(source, /import PrimaryPageTitle from '@\/components\/PrimaryPageTitle\.vue'/)
    assert.ok(source.includes(`<PrimaryPageTitle title="${title}" />`))
  }

  assert.doesNotMatch(home, /class="date-section"/)
  assert.doesNotMatch(home, /onDateTouch(Start|Move|End)/)
  assert.doesNotMatch(home, /dateScrollX|dateStartX|isDragging/)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/cardStackShell.test.mjs`

Expected: FAIL because `src/components/PrimaryPageTitle.vue` does not exist.

- [ ] **Step 3: Implement the shared title component**

Create `src/components/PrimaryPageTitle.vue`:

```vue
<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <h1 class="primary-page-title">{{ title }}</h1>
</template>

<style scoped>
.primary-page-title {
  margin: 0;
  padding: 18px 20px 10px;
  color: #1c1c1e;
  font-size: 34px;
  font-weight: 700;
  line-height: 41px;
  letter-spacing: -0.7px;
}

@media (prefers-color-scheme: dark) {
  .primary-page-title {
    color: #f5f5f7;
  }
}
</style>
```

- [ ] **Step 4: Mount exact titles and remove the Home timeline**

Import `PrimaryPageTitle` in all four views and add these elements as the first child of each page root:

```vue
<PrimaryPageTitle title="记录" />
<PrimaryPageTitle title="日历" />
<PrimaryPageTitle title="统计" />
<PrimaryPageTitle title="设置" />
```

In `Home.vue`, delete `dateList`, `dateScrollX`, `dateStartX`, `isDragging`, `onDateTouchStart`, `onDateTouchMove`, `onDateTouchEnd`, the `.date-section` template, and its timeline-only CSS. Change `.equipment-section` from `top: 56px` to `top: 0`, including the compact-height media rule.

In `Calendar.vue`, `Statistics.vue`, and `Settings.vue`, keep the title outside horizontal page padding so its left edge remains exactly 20px from the card. Wrap the existing content after the title in `<div class="primary-page-body">`, change the page root to `padding: 0`, retain its safe-area bottom padding, and add:

```css
.primary-page-body {
  padding: 0 16px;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test tests/cardStackShell.test.mjs`

Expected: all tests in the file PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PrimaryPageTitle.vue src/views/Home.vue src/views/Calendar.vue src/views/Statistics.vue src/views/Settings.vue tests/cardStackShell.test.mjs
git commit -m "Add primary page titles"
```

### Task 2: Frosted Stack Control

**Files:**
- Modify: `src/components/PrimaryPageStack.vue`
- Test: `tests/cardStackShell.test.mjs`

**Interfaces:**
- Consumes: Existing `stackState.isStacked` boolean and unchanged `toggleStackMode()` handler.
- Produces: `.stack-tabs-icon`, `.stack-back-icon`, and `.stack-fab.stacked` visual states.

- [ ] **Step 1: Write the failing frosted-button test**

Add assertions to the primary stack source test in `tests/cardStackShell.test.mjs`:

```js
assert.match(source, /class="stack-fab"[\s\S]*stacked: stackState\.isStacked/)
assert.match(source, /class="stack-tabs-icon"/)
assert.match(source, /class="stack-back-icon"/)
assert.match(source, /background:\s*rgba\(255, 255, 255, 0\.82\)/)
assert.match(source, /backdrop-filter:\s*blur\(20px\) saturate\(180%\)/)
assert.match(source, /-webkit-backdrop-filter:\s*blur\(20px\) saturate\(180%\)/)
assert.match(source, /\.stack-fab\.stacked\s*\{[^}]*opacity:\s*0\.82/m)
assert.match(source, /\.stack-fab\.stacked \.stack-tabs-icon\s*\{[^}]*opacity:\s*0/m)
assert.match(source, /\.stack-fab\.stacked \.stack-back-icon\s*\{[^}]*opacity:\s*1/m)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/cardStackShell.test.mjs`

Expected: FAIL because the current button is dark and only renders `.stack-fab-icon`.

- [ ] **Step 3: Implement cross-fading icons and frosted styles**

Change the button state class and icon markup in `PrimaryPageStack.vue`:

```vue
<button
  ref="stackFab"
  type="button"
  class="stack-fab"
  :class="{ stacked: stackState.isStacked }"
  :aria-label="stackState.isStacked ? '恢复当前页面' : '显示页面堆栈'"
  :aria-expanded="stackState.isStacked"
  @click="toggleStackMode"
>
  <span class="stack-tabs-icon" aria-hidden="true">
    <span class="stack-tabs-icon-back" />
    <span class="stack-tabs-icon-front" />
  </span>
  <span class="stack-back-icon" aria-hidden="true" />
</button>
```

Replace the dark button and arrow styles with:

```css
.stack-fab {
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 8px 28px rgba(31, 31, 35, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.72);
  color: #3a3a3c;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  transition: opacity 0.3s ease, background-color 0.3s ease, transform 0.3s ease;
}

.stack-fab.stacked {
  opacity: 0.82;
  background: rgba(255, 255, 255, 0.74);
}

.stack-tabs-icon,
.stack-back-icon {
  position: absolute;
  transition: opacity 0.25s ease, transform 0.3s ease;
}

.stack-tabs-icon {
  width: 25px;
  height: 25px;
  opacity: 1;
}

.stack-tabs-icon-back,
.stack-tabs-icon-front {
  position: absolute;
  width: 17px;
  height: 19px;
  border: 1.8px solid currentColor;
  border-radius: 4px;
}

.stack-tabs-icon-back { top: 2px; left: 2px; opacity: 0.62; }
.stack-tabs-icon-front { right: 2px; bottom: 2px; background: rgba(255, 255, 255, 0.38); }
.stack-back-icon { width: 13px; height: 13px; border-left: 2px solid currentColor; border-bottom: 2px solid currentColor; opacity: 0; transform: translateX(4px) rotate(45deg); }
.stack-fab.stacked .stack-tabs-icon { opacity: 0; transform: scale(0.82); }
.stack-fab.stacked .stack-back-icon { opacity: 1; transform: translateX(2px) rotate(45deg); }
```

Extend the existing reduced-motion selector to include `.stack-fab`, `.stack-tabs-icon`, and `.stack-back-icon`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/cardStackShell.test.mjs`

Expected: all tests in the file PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrimaryPageStack.vue tests/cardStackShell.test.mjs
git commit -m "Refresh card stack controls"
```

### Task 3: Automated Verification

**Files:**
- Verify only; no production files should change.

**Interfaces:**
- Consumes: Completed title and stack-control tasks.
- Produces: Passing repository test and production build evidence.

- [ ] **Step 1: Run all source tests**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: `vue-tsc -b` and Vite complete successfully.

- [ ] **Step 3: Check the working tree**

Run: `git status --short --branch && git diff --check`

Expected: current branch is `codex/card-stack-navigation`, with no unstaged implementation changes and no whitespace errors. Do not start a dev server or browser session.
