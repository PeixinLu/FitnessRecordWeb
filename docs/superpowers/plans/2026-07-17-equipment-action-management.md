# 器械动作管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现器械、动作和四种训练数据模板的管理，并使训练录入与记录展示按动作模板工作。

**Architecture:** 在类型层定义模板及其字段配置，供录入组件和展示组件共用。Dexie v2 为已有动作回填默认模板；Pinia store 集中完成器械与动作的持久化和内存状态更新。设置页链接到两级 Vant 管理页面。

**Tech Stack:** Vue 3、TypeScript、Vite、Pinia、Dexie 4、Vant 4、Node test runner。

## Global Constraints

- 不新增第三方依赖或测试框架。
- 保留已有 IndexedDB 数据；旧动作迁移为 `weight-reps`。
- 模板仅支持 `weight-reps`、`reps`、`duration`、`distance-duration`。
- UI 继续使用 `<script setup lang="ts">`、Vant 和项目现有的两空格/单引号风格。
- 此目录没有可用 Git 元数据；所有“提交”步骤均跳过并在交付时注明。

---

### Task 1: 定义模板、训练记录类型与数据库迁移

**Files:**
- Create: `src/utils/dataTemplate.ts`
- Modify: `src/types/index.ts`
- Modify: `src/db/database.ts`
- Test: `tests/dataTemplate.test.mjs`

**Interfaces:**
- Produces `DataTemplate` 联合类型、`DATA_TEMPLATE_OPTIONS`、`getTemplateFields(template)`。
- `Exercise.dataTemplate: DataTemplate`；`WorkoutRecord` 可选 `duration?: number` 和 `distance?: number`。

- [ ] **Step 1: 写入模板字段定义的失败测试**

```js
test('getTemplateFields returns the expected wheels for each template', async () => {
  const { getTemplateFields } = await loadModule()
  assert.deepEqual(getTemplateFields('reps').map(field => field.key), ['reps', 'sets'])
  assert.deepEqual(getTemplateFields('duration').map(field => field.unit), ['分钟', '组'])
  assert.deepEqual(getTemplateFields('distance-duration').map(field => field.key), ['distance', 'duration', 'sets'])
  assert.deepEqual(getTemplateFields('weight-reps').map(field => field.unit), ['次', '组', 'kg'])
})
```

- [ ] **Step 2: 运行测试并确认它因模块不存在而失败**

Run: `node --test tests/dataTemplate.test.mjs`

Expected: FAIL，提示无法加载 `src/utils/dataTemplate.ts`。

- [ ] **Step 3: 实现最小模板配置和类型扩展**

```ts
export type DataTemplate = 'weight-reps' | 'reps' | 'duration' | 'distance-duration'

export function getTemplateFields(template: DataTemplate): TemplateField[] {
  return TEMPLATE_FIELDS[template]
}
```

将 `dataTemplate: 'weight-reps'` 添加至所有默认动作；将 Dexie schema 提升到 `version(2)` 并使用 `upgrade()` 对旧动作调用 `table('exercises').toCollection().modify({ dataTemplate: 'weight-reps' })`。

- [ ] **Step 4: 运行模板测试并确认通过**

Run: `node --test tests/dataTemplate.test.mjs`

Expected: PASS，1 个测试通过。

### Task 2: 补齐器械与动作的 store CRUD

**Files:**
- Modify: `src/stores/exercise.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes `Equipment`、`Exercise` 和 `DataTemplate`。
- Produces `addEquipment(name)`、`updateEquipment(id, name)`、`deleteEquipment(id)`、`addExercise(input)`、`updateExercise(id, input)`、`deleteExercise(id)`。

- [ ] **Step 1: 定义 CRUD 输入与状态更新契约**

```ts
type ExerciseInput = Pick<Exercise, 'name' | 'equipmentId' | 'muscleGroup' | 'dataTemplate'>

async function deleteEquipment(id: string) {
  await db.transaction('rw', db.equipments, db.exercises, async () => {
    await db.exercises.where('equipmentId').equals(id).delete()
    await db.equipments.delete(id)
  })
  await loadData()
}
```

- [ ] **Step 2: 实现新增、编辑、删除方法**

为新增项生成与现有记录一致的 `Date.now()` + 随机字符串 id；每次写入后调用 `loadData()`，删除当前选中项时清空其选中 id。

- [ ] **Step 3: 执行类型构建**

Run: `npm run build`

Expected: TypeScript 类型检查通过，Vite 成功输出 `dist/`。

### Task 3: 新增器械与动作管理页面及路由

**Files:**
- Create: `src/views/EquipmentManagement.vue`
- Create: `src/views/ExerciseManagement.vue`
- Modify: `src/router/index.ts`
- Modify: `src/views/Settings.vue`

**Interfaces:**
- Consumes `useExerciseStore()` CRUD 方法、`MUSCLE_GROUPS` 和 `DATA_TEMPLATE_OPTIONS`。
- Route: `/equipment-management`；`/equipment-management/:equipmentId`。

- [ ] **Step 1: 新建器械管理页面**

```vue
<van-cell-group inset title="器械">
  <van-cell
    v-for="equipment in exerciseStore.equipments"
    :key="equipment.id"
    :title="equipment.name"
    :label="`${exerciseCount(equipment.id)} 个动作`"
    is-link
    @click="router.push(`/equipment-management/${equipment.id}`)"
  />
</van-cell-group>
```

用 Vant `van-dialog` 表单新增/编辑器械；删除时确认“该器械下的所有动作也会被删除”。

- [ ] **Step 2: 新建动作管理页面**

动作单元格显示名称、肌群和模板中文名。表单使用名称输入框、肌群 `van-picker` 与模板 `van-radio-group`，并在名称为空时用 `showToast('请输入动作名称')` 阻止保存。

- [ ] **Step 3: 注册路由并添加设置入口**

```ts
{ path: '/equipment-management', component: () => import('@/views/EquipmentManagement.vue') }
{ path: '/equipment-management/:equipmentId', component: () => import('@/views/ExerciseManagement.vue') }
```

在“数据管理”分组添加标题为“器械动作管理”、跳转 `/equipment-management` 的单元格。

- [ ] **Step 4: 执行生产构建**

Run: `npm run build`

Expected: TypeScript 检查和 Vite 构建均成功。

### Task 4: 按模板适配训练录入、明细与首页展示

**Files:**
- Modify: `src/components/SetPicker.vue`
- Modify: `src/components/EquipmentDrawer.vue`
- Modify: `src/views/Home.vue`
- Modify: `src/views/History.vue`
- Modify: `src/views/Calendar.vue`

**Interfaces:**
- Consumes `getTemplateFields(template)` 和动作的 `dataTemplate`。
- Produces按模板填充的 `WorkoutRecord`：不适用字段为 `undefined`。

- [ ] **Step 1: 将 `SetPicker` 改为由字段配置渲染**

```vue
<NumberWheelPicker
  v-model="pickerValue"
  :count="fields.length"
  :units="fields.map(field => field.unit)"
  :ranges="fields.map(field => field.range)"
/>
```

用 `Record<TemplateFieldKey, number>` 在组件边界传递数值，确保轮子数量随模板变化。

- [ ] **Step 2: 在 `EquipmentDrawer` 映射表单值与每组明细**

当选中动作改变时，从其模板得到默认值；创建每组明细时只复制该模板字段；编辑弹窗使用同样的动态字段。保存记录时写入 `reps`、`weight`、`duration`、`distance` 中适用的字段，并将 `sets` 维持为 `1`。

- [ ] **Step 3: 提取记录摘要并替换既有展示**

```ts
export function formatRecordDetail(record: WorkoutRecord): string {
  const parts = [`${record.sets}组`]
  if (record.reps !== undefined) parts.push(`${record.reps}次`)
  if (record.weight !== undefined) parts.push(`@${record.weight}kg`)
  if (record.distance !== undefined) parts.push(`${record.distance}公里`)
  if (record.duration !== undefined) parts.push(`${record.duration}分钟`)
  return parts.join(' × ')
}
```

将首页、历史与日历中的固定“组 × 次数 @重量”替换为此摘要，保证旧记录也正常显示。

- [ ] **Step 4: 执行所有 Node 测试与生产构建**

Run: `node --test tests/*.test.mjs && npm run build`

Expected: 所有 Node 测试通过，TypeScript 检查和 Vite 构建成功。

### Task 5: 手动验收

**Files:**
- No code changes.

- [ ] **Step 1: 在浏览器中执行管理操作**

确认可新增、重命名、删除器械，删除器械会移除其动作；确认可为一个器械新增、编辑和删除动作，且可选四种模板。

- [ ] **Step 2: 逐一验证四种录入模板**

分别记录：次数+重量、仅次数、时长、距离+时长；确认第二步明细与首页/历史/日历摘要只显示适用字段。

- [ ] **Step 3: 最终构建验证**

Run: `npm run build`

Expected: exit code 0。
