# 首页紧凑布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 iPhone SE 高度下压缩首页时间线、器械区和 Dock，同时保留全部操作能力。

**Architecture:** 仅修改 `Home.vue` 和 `App.vue` 的样式，不改动日期、器械分页或训练数据逻辑。以通用紧凑尺寸为基础，并用 `max-height: 667px` 媒体查询进一步收紧小高度屏幕的垂直间距。

**Tech Stack:** Vue 3、TypeScript、CSS、Node test、Vite。

## Global Constraints

- 顶部始终展示 7 天。
- 器械区保留 2×3 九宫格与分页。
- 不改变器械点击、分页、今日训练编辑和数据逻辑。
- Dock 高度约 54px，器械轮播高度约 168px，紧凑时间线约 56px。
- 完成后运行 `node --test tests/*.test.mjs` 与 `npm run build`。

---

### Task 1: 首页紧凑视觉层级

**Files:**
- Modify: `src/views/Home.vue`
- Modify: `tests/homeLayout.test.mjs`

**Interfaces:**
- Consumes: 现有 7 天 `dateList`、`equipmentPages`、`onEquipmentPageChange`。
- Produces: 56px 时间线、168px 器械轮播和 667px 高度下的紧凑间距。

- [ ] **Step 1: Write the failing test**

Append to `tests/homeLayout.test.mjs`:

```js
test('home uses a compact timeline and equipment grid for iPhone SE height', async () => {
  const source = await readFile(path.resolve('src/views/Home.vue'), 'utf8')

  assert.match(source, /\.date-section\s*\{[^}]*padding:\s*8px 16px/m)
  assert.match(source, /\.equipment-swipe\s*\{[^}]*height:\s*168px/m)
  assert.match(source, /@media \(max-height: 667px\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/homeLayout.test.mjs`

Expected: FAIL because the existing timeline padding and equipment height are larger and there is no SE media query.

- [ ] **Step 3: Write minimal implementation**

In `src/views/Home.vue`, use compact CSS values:

```css
.date-section { padding: 8px 16px; }
.date-container { gap: 4px; }
.date-item { padding: 2px 0; min-width: 40px; background: transparent; }
.date-item.today { padding: 4px 10px; border-radius: 999px; }
.equipment-section { padding: 6px 16px 8px; }
.equipment-swipe { height: 168px; }
.equipment-grid { gap: 8px; }
.equipment-card { gap: 4px; padding: 8px; border-radius: 14px; }
.equipment-icon, .equipment-icon img { width: 34px; height: 34px; }
```

Add `@media (max-height: 667px)` to reduce records padding and hide excess nonessential vertical spacing while leaving the two equipment rows and pagination intact.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/homeLayout.test.mjs`

Expected: PASS.

### Task 2: 压缩 Dock 并保留等宽胶囊对齐

**Files:**
- Modify: `src/App.vue`
- Modify: `tests/tabbarIcons.test.mjs`

**Interfaces:**
- Consumes: 四项 `tabItems` 及等宽 `flex: 1` 规则。
- Produces: 54px 高度 Dock 和与其对应的页面底部预留空间。

- [ ] **Step 1: Write the failing test**

Append to `tests/tabbarIcons.test.mjs`:

```js
test('dock uses the compact iPhone SE dimensions', async () => {
  const source = await readFile(path.resolve('src/App.vue'), 'utf8')

  assert.match(source, /\.floating-tabbar\s*\{[^}]*height:\s*54px/m)
  assert.match(source, /\.app-container\s*\{[^}]*padding-bottom:\s*68px/m)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/tabbarIcons.test.mjs`

Expected: FAIL because the Dock is 64px high with 80px bottom padding.

- [ ] **Step 3: Write minimal implementation**

In `src/App.vue`, set `.floating-tabbar` height to `54px`, decrease its padding and tab icon/label scale, and set `.app-container` bottom padding to `68px`. Keep `flex: 1`, `justify-content: space-between`, and the active `border-radius: 999px` so edge pills remain aligned.

- [ ] **Step 4: Run targeted verification**

Run: `node --test tests/homeLayout.test.mjs tests/tabbarIcons.test.mjs && npm run build`

Expected: PASS and production build succeeds.

- [ ] **Step 5: Run full verification**

Run: `node --test tests/*.test.mjs && npm run build`

Expected: All tests pass and the production build completes.
