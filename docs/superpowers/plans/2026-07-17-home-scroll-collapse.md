# 首页滚动收缩与训练摘要 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页器械区随训练列表滚动收缩为磨砂单行，并合并同数据训练组的显示。

**Architecture:** `Home.vue` 用训练列表的 `scrollTop` 管理 `isEquipmentCollapsed`，并以 CSS 切换器械区的 2×3/单行布局。`workoutGroups.ts` 新增纯函数，将记录按训练数据分桶后生成紧凑摘要。

**Tech Stack:** Vue 3、TypeScript、CSS、Node test、Vite。

## Global Constraints

- 时间线固定并保持 7 天，今天使用 Dock 同款浅蓝激活背景。
- 训练列表滚动超过 8px 收缩，只有回到 0 才展开。
- 收缩态只展示当前页前三个器械，保留点击能力。
- 相同数据输出 `N组*数据`；不同数据以 ` / ` 分隔。
- 运行全量测试和 `npm run build`。

---

### Task 1: 训练组摘要

**Files:**
- Modify: `src/utils/workoutGroups.ts`
- Modify: `tests/workoutGroups.test.mjs`

**Interfaces:**
- Produces: `summarizeWorkoutSets(records: WorkoutRecord[]): string`。

- [ ] **Step 1: Write the failing test**

```js
assert.equal(
  summarizeWorkoutSets([
    { id: '1', reps: 12, weight: 12 },
    { id: '2', reps: 12, weight: 12 },
    { id: '3', reps: 10, weight: 10 },
  ]),
  '2组*12次*12kg / 1组*10次*10kg'
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/workoutGroups.test.mjs`

Expected: FAIL because `summarizeWorkoutSets` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `summarizeWorkoutSets` by producing `次`、`kg`、`秒`、`km` tokens from each record, using those tokens as a map key, and joining map counts as `N组*${tokens.join('*')}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/workoutGroups.test.mjs`

Expected: PASS.

### Task 2: 首页滚动收缩与视觉降权

**Files:**
- Modify: `src/views/Home.vue`
- Modify: `tests/homeLayout.test.mjs`

**Interfaces:**
- Consumes: `summarizeWorkoutSets`、`onRecordsScroll(event: Event)`。
- Produces: `isEquipmentCollapsed` 驱动的磨砂单行器械栏。

- [ ] **Step 1: Write the failing test**

```js
assert.match(source, /const isEquipmentCollapsed = ref\(false\)/)
assert.match(source, /@scroll="onRecordsScroll"/)
assert.match(source, /backdrop-filter: blur\(20px\)/)
assert.match(source, /\.equipment-section\.collapsed/)
assert.match(source, /\.date-item\.today\s*\{[^}]*background: rgba\(0, 122, 255, 0\.1\)/m)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/homeLayout.test.mjs`

Expected: FAIL because no scroll collapse state or frost style exists.

- [ ] **Step 3: Write minimal implementation**

Add `isEquipmentCollapsed`, set it from `event.target.scrollTop > 8`, bind it to the equipment section, and use `@scroll` on records. Move the equipment section into an overlay below the date timeline; expanded records padding reserves 2×3 space, collapsed padding reserves one row. CSS hides `.equipment-card:nth-child(n + 4)` and `.page-indicator` in collapsed state, switches grid to one row, and adds a translucent blur background. Import and render `summarizeWorkoutSets(group.records)` for record detail.

- [ ] **Step 4: Run targeted verification**

Run: `node --test tests/homeLayout.test.mjs tests/workoutGroups.test.mjs && npm run build`

Expected: PASS and build succeeds.

- [ ] **Step 5: Run full verification**

Run: `node --test tests/*.test.mjs && npm run build`

Expected: All tests pass and production build completes.
