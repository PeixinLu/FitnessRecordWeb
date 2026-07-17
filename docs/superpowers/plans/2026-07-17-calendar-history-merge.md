# 日历与历史合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将历史训练查看整合到日历页，并从导航中移除独立历史入口。

**Architecture:** 日历页以 `selectedDate` 作为单一日期状态，派生出所选日期的记录并按动作聚类。底部导航和路由移除历史入口；历史记录在日历页只读展示，不提供删除或编辑操作。

**Tech Stack:** Vue 3、TypeScript、Vue Router、Pinia、Vant、Node test。

## Global Constraints

- 不新增 IndexedDB 字段或数据库迁移。
- 历史日期训练数据仅可查看，禁止删除、编辑与左滑操作。
- 首页今日训练的编辑能力保持不变。
- 完成后运行 `node --test tests/*.test.mjs` 与 `npm run build`。

---

### Task 1: 合并日历与历史记录展示

**Files:**
- Modify: `src/views/Calendar.vue`
- Test: `tests/calendarHistoryMerge.test.mjs`

**Interfaces:**
- Consumes: `recordStore.records`、`recordStore.formatDate(date)`、`formatRecordDetail(record)`。
- Produces: `selectedDate`、`selectedDateRecords`、`groupedSelectedDateRecords`，供日历网格和当日训练区域使用。

- [ ] **Step 1: Write the failing test**

Create `tests/calendarHistoryMerge.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/calendarHistoryMerge.test.mjs`

Expected: FAIL because the calendar page still uses popup-only date details.

- [ ] **Step 3: Write minimal implementation**

In `src/views/Calendar.vue`, replace popup state with selected date state and computed daily groups:

```ts
const selectedDate = ref(recordStore.getTodayDate())
const selectedDateRecords = computed(() =>
  recordStore.records.filter(record => record.date === selectedDate.value)
)
const groupedSelectedDateRecords = computed(() => {
  const groups = new Map<string, typeof recordStore.records>()
  selectedDateRecords.value.forEach(record => {
    groups.set(record.exerciseId, [...(groups.get(record.exerciseId) ?? []), record])
  })
  return [...groups.values()]
})

function onSelectDate(date: Date) {
  selectedDate.value = recordStore.formatDate(date)
}
```

Render the selected date as a grid class, and replace the popup with a read-only `van-cell-group title="当日训练"`. Render one cell per group using its first record's exercise name and `formatRecordDetail` for each set. Render `van-empty` with `description="当天暂无训练记录"` when no groups exist. In `prevMonth` and `nextMonth`, retain the selected day when it exists in the target month; otherwise select the first day.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/calendarHistoryMerge.test.mjs`

Expected: PASS.

- [ ] **Step 5: Verify the interaction**

Run: `npm run build`

Expected: Type checking and Vite build succeed.

### Task 2: 收敛导航与路由

**Files:**
- Modify: `src/App.vue`
- Modify: `src/router/index.ts`
- Modify: `tests/tabbarIcons.test.mjs`
- Test: `tests/calendarHistoryMerge.test.mjs`

**Interfaces:**
- Consumes: existing four route names `home`、`calendar`、`statistics`、`settings`。
- Produces: four-item bottom dock with valid active icons and no history route.

- [ ] **Step 1: Extend the failing test**

Append to `tests/calendarHistoryMerge.test.mjs`:

```js
test('history route and tab are removed after merging into calendar', async () => {
  const [appSource, routerSource] = await Promise.all([
    readFile(path.resolve('src/App.vue'), 'utf8'),
    readFile(path.resolve('src/router/index.ts'), 'utf8'),
  ])

  assert.doesNotMatch(appSource, /name: 'history'/)
  assert.doesNotMatch(routerSource, /path: '\/history'/)
  assert.match(appSource, /name: 'calendar'/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/calendarHistoryMerge.test.mjs`

Expected: FAIL because `history` is still declared in the tab list and router.

- [ ] **Step 3: Write minimal implementation**

Remove the history object from `tabItems` in `src/App.vue`, and remove the `/history` route object from `src/router/index.ts`. Keep calendar's valid icon configuration and the equal-width dock layout unchanged.

- [ ] **Step 4: Run targeted tests**

Run: `node --test tests/calendarHistoryMerge.test.mjs tests/tabbarIcons.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run: `node --test tests/*.test.mjs && npm run build`

Expected: All tests pass and the production build completes.
