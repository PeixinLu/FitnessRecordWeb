# 第一期默认器械图标与预设 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为七种第一期器械提供本地 SVG 图标，并把确认的器械与动作以不覆盖用户数据的方式补充进默认预设。

**Architecture:** 预设数据以 id 为键定义为常量，Dexie 初始化按 id 执行补充写入，同时给已存在的同 id 器械补充图标 slug。首页从图标 slug 的静态资源映射中渲染 SVG；未映射的既有器械维持通用占位符。

**Tech Stack:** Vue 3、TypeScript、Dexie 4、Vite SVG asset imports、Node test runner。

## Global Constraints

- 不新增第三方依赖。
- 仅新增或补充预设，绝不删除、重命名或覆盖用户已有器械、动作与记录。
- 新增动作默认使用 `weight-reps` 数据模板。
- SVG 为单色、圆角线性图标，采用本地资源且不依赖外部素材。

---

### Task 1: 为第一期器械创建 SVG 图标和映射

**Files:**
- Create: `src/assets/icons/equipment-butterfly-machine.svg`
- Create: `src/assets/icons/equipment-bodyweight.svg`
- Create: `src/assets/icons/equipment-barbell.svg`
- Create: `src/assets/icons/equipment-hip-adductor.svg`
- Create: `src/assets/icons/equipment-lat-pulldown.svg`
- Create: `src/assets/icons/equipment-cable-machine.svg`
- Create: `src/assets/icons/equipment-rowing-machine.svg`
- Create: `src/utils/equipmentIcon.ts`
- Test: `tests/equipmentIcon.test.mjs`

**Interfaces:**
- Produces `EQUIPMENT_ICON_SLUGS` 和 `hasEquipmentIcon(icon?: string): boolean`。

- [ ] **Step 1: 写入图标 slug 的失败测试**

```js
test('recognizes all first-phase equipment icon slugs', async () => {
  const { hasEquipmentIcon } = await loadModule()
  assert.equal(hasEquipmentIcon('butterfly-machine'), true)
  assert.equal(hasEquipmentIcon('rowing-machine'), true)
  assert.equal(hasEquipmentIcon('unknown'), false)
})
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `node --test tests/equipmentIcon.test.mjs`

Expected: FAIL，提示找不到 `src/utils/equipmentIcon.ts`。

- [ ] **Step 3: 创建 SVG 与映射模块**

所有 SVG 使用 `viewBox="0 0 64 64"`、`fill="none"`、`stroke="currentColor"`、圆角端点和连接点。映射模块导入七个文件并导出图标 slug 与 URL 的 `Record<string, string>`。

- [ ] **Step 4: 运行图标测试并确认通过**

Run: `node --test tests/equipmentIcon.test.mjs`

Expected: PASS，图标 slug 均可识别。

### Task 2: 将第一期预设改为幂等补充初始化

**Files:**
- Modify: `src/db/database.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes `Equipment.icon?: string` 与 `Exercise.dataTemplate`。
- Produces以固定 id 补充的七种器械和十四个确认动作。

- [ ] **Step 1: 定义预设常量**

```ts
const DEFAULT_EQUIPMENTS: Equipment[] = [
  { id: 'butterfly-machine', name: '蝴蝶机', icon: 'butterfly-machine' },
  { id: 'rowing-machine', name: '划船机', icon: 'rowing-machine' },
]
```

定义对应的动作常量，例如 `{ id: 'wide-lat-pulldown', name: '宽距高位下拉', equipmentId: 'lat-pulldown-machine', muscleGroup: '背', dataTemplate: 'weight-reps' }`。

- [ ] **Step 2: 替换“表为空才写入”的初始化逻辑**

```ts
for (const equipment of DEFAULT_EQUIPMENTS) {
  const existing = await db.equipments.get(equipment.id)
  if (!existing) await db.equipments.add(equipment)
  else if (equipment.icon && !existing.icon) await db.equipments.update(equipment.id, { icon: equipment.icon })
}
```

对默认动作执行同样的按 id `get` / `add` 补充逻辑。现有相同 id 的动作不修改。

- [ ] **Step 3: 执行生产构建**

Run: `npm run build`

Expected: TypeScript 检查和 Vite 构建均通过。

### Task 3: 首页展示 SVG 图标并保留回退

**Files:**
- Modify: `src/views/Home.vue`

**Interfaces:**
- Consumes `getEquipmentIcon(icon?: string): string | undefined`。
- Produces器械卡 `<img>` 或通用训练符号回退。

- [ ] **Step 1: 根据 icon slug 渲染图标**

```vue
<img v-if="getEquipmentIcon(equipment.icon)" :src="getEquipmentIcon(equipment.icon)" :alt="`${equipment.name}图标`" />
<span v-else>🏋️</span>
```

- [ ] **Step 2: 添加图标尺寸和颜色样式**

SVG 容器固定为 44px，使用现有卡片主色 `#007aff`；图片保持 `object-fit: contain`，不改变卡片高度。

- [ ] **Step 3: 执行全量验证**

Run: `node --test tests/*.test.mjs && npm run build`

Expected: 全部 Node 测试通过，生产构建 exit code 0。
