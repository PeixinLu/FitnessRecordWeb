<script setup lang="ts">
import { computed, ref, nextTick, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import Sortable from 'sortablejs'
import { useExerciseStore } from '@/stores/exercise'
import { EQUIPMENT_CASES, normalizeEquipmentName, type EquipmentCase } from '@/data/equipmentCases'
import { getEquipmentIcon } from '@/utils/equipmentIcon'
import {
  MUSCLE_GROUPS,
  type DataTemplate,
  type Equipment,
  type Exercise,
  type MuscleGroup,
  type WeightProfile,
} from '@/types'
import { DATA_TEMPLATE_OPTIONS, getTemplateLabel } from '@/utils/dataTemplate'
import {
  buildSteppedWeightValues,
  normalizeWeightValues,
} from '@/utils/weightProfile'
import EquipmentEmptyState from '@/components/EquipmentEmptyState.vue'
import ImmersiveSheet from '@/components/ImmersiveSheet.vue'

const props = defineProps<{
  embedded?: boolean
  targetEquipmentId?: string
  targetExerciseId?: string
  targetRequestKey?: number
}>()
const emit = defineEmits<{
  close: []
  'flip-state-change': [flipping: boolean]
  'flip-animation-change': [animation: FlipAnimation]
}>()

const router = useRouter()
const exerciseStore = useExerciseStore()

function onNavBack() {
  if (props.embedded) {
    emit('close')
  } else {
    router.back()
  }
}

// ===== Search =====
const searchQuery = ref('')
const equipmentListRef = ref<HTMLElement | null>(null)

const filteredEquipments = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return exerciseStore.equipments
  return exerciseStore.equipments.filter(eq => {
    if (eq.name.toLowerCase().includes(q)) return true
    return exerciseStore.exercises.some(
      ex => ex.equipmentId === eq.id && ex.name.toLowerCase().includes(q),
    )
  })
})

const filteredCases = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return EQUIPMENT_CASES
  return EQUIPMENT_CASES.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.actions.some(a => a.name.toLowerCase().includes(q)),
  )
})

// ===== Expand/collapse =====
const expandedEquipmentId = ref<string | null>(null)
let pendingReveal: {
  equipmentId: string
  exerciseId?: string
  behavior: ScrollBehavior
} | null = null
let savedEquipmentRevealId: string | null = null
let savedExerciseRevealId: string | null = null

function toggleExpand(equipmentId: string) {
  expandedEquipmentId.value = expandedEquipmentId.value === equipmentId ? null : equipmentId
}

function beforeExpandEnter(element: Element) {
  const body = element as HTMLElement
  body.style.height = '0'
}

function expandEnter(element: Element) {
  const body = element as HTMLElement
  requestAnimationFrame(() => {
    body.style.height = `${body.scrollHeight}px`
  })
}

function afterExpandEnter(element: Element) {
  const body = element as HTMLElement
  body.style.height = 'auto'
  const equipmentId = body.closest<HTMLElement>('[data-equipment-id]')
    ?.dataset.equipmentId
  if (pendingReveal && equipmentId === pendingReveal.equipmentId) {
    const target = pendingReveal
    pendingReveal = null
    scheduleRevealScroll(target.equipmentId, target.exerciseId, target.behavior)
  }
}

function beforeExpandLeave(element: Element) {
  const body = element as HTMLElement
  body.style.height = `${body.scrollHeight}px`
}

function expandLeave(element: Element) {
  const body = element as HTMLElement
  // Read the current layout before starting the collapse so the browser keeps
  // the measured height as the first animation frame.
  void body.offsetHeight
  requestAnimationFrame(() => {
    body.style.height = '0'
  })
}

function afterExpandLeave(element: Element) {
  const body = element as HTMLElement
  body.style.height = ''
}

function getEquipmentExercises(equipmentId: string) {
  return exerciseStore.exercises.filter(e => e.equipmentId === equipmentId)
}

function scrollTargetIntoView(
  equipmentId: string,
  exerciseId?: string,
  behavior: ScrollBehavior = 'smooth',
): void {
  const list = equipmentListRef.value
  if (!list) return
  const equipmentElement = Array.from(
    list.querySelectorAll<HTMLElement>('[data-equipment-id]'),
  ).find(element => element.dataset.equipmentId === equipmentId)
  const exerciseElement = exerciseId
    ? Array.from(
      list.querySelectorAll<HTMLElement>('[data-exercise-id]'),
    ).find(element => element.dataset.exerciseId === exerciseId)
    : undefined
  const target = exerciseElement ?? equipmentElement
  if (!target) return

  const listRect = list.getBoundingClientRect()
  const searchRect = list.querySelector<HTMLElement>('.search-container')
    ?.getBoundingClientRect()
  const obscuredTop = searchRect
    ? Math.max(0, searchRect.bottom - listRect.top)
    : 0
  const targetRect = target.getBoundingClientRect()
  const targetTop = targetRect.top - listRect.top + list.scrollTop
  const visibleHeight = Math.max(0, list.clientHeight - obscuredTop)
  const centeredOffset = Math.max(12, (visibleHeight - targetRect.height) / 2)
  list.scrollTo({
    top: Math.max(0, targetTop - obscuredTop - centeredOffset),
    behavior,
  })
}

function scheduleRevealScroll(
  equipmentId: string,
  exerciseId?: string,
  behavior: ScrollBehavior = 'smooth',
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollTargetIntoView(equipmentId, exerciseId, behavior)
    })
  })
}

async function revealTarget(
  requestedEquipmentId?: string,
  requestedExerciseId?: string,
  behavior: ScrollBehavior = 'smooth',
): Promise<void> {
  const exercise = requestedExerciseId
    ? exerciseStore.exercises.find(item => item.id === requestedExerciseId)
    : undefined
  const equipmentId = exercise?.equipmentId ?? requestedEquipmentId
  if (!equipmentId || !exerciseStore.equipments.some(item => item.id === equipmentId)) {
    return
  }

  if (sortMode.value) await flipToSortMode(false)
  searchQuery.value = ''
  pendingReveal = {
    equipmentId,
    exerciseId: exercise?.id,
    behavior,
  }

  if (expandedEquipmentId.value === equipmentId) {
    await nextTick()
    const target = pendingReveal
    pendingReveal = null
    scheduleRevealScroll(target.equipmentId, target.exerciseId, target.behavior)
    return
  }
  expandedEquipmentId.value = equipmentId
}

watch(
  () => [
    props.targetEquipmentId,
    props.targetExerciseId,
    props.targetRequestKey,
  ] as const,
  ([equipmentId, exerciseId]) => {
    if (equipmentId || exerciseId) {
      void nextTick(() => revealTarget(equipmentId, exerciseId, 'auto'))
    }
  },
  { immediate: true, flush: 'post' },
)

// Auto-expand when search narrows to exercises under one equipment
watch([searchQuery, filteredEquipments], () => {
  if (searchQuery.value.trim() && filteredEquipments.value.length === 1) {
    const eq = filteredEquipments.value[0]
    const q = searchQuery.value.trim().toLowerCase()
    const hasExerciseMatch = exerciseStore.exercises.some(
      ex => ex.equipmentId === eq.id && ex.name.toLowerCase().includes(q),
    )
    if (hasExerciseMatch) {
      expandedEquipmentId.value = eq.id
    }
  }
})

// ===== Equipment CRUD =====
const showEquipmentEditor = ref(false)
const editingEquipmentId = ref<string>()
const equipmentName = ref('')
const equipmentInputRef = ref<HTMLInputElement | null>(null)
type WeightMode = 'default' | 'step' | 'custom'
const equipmentWeightMode = ref<WeightMode>('default')
const equipmentWeightMin = ref('2.5')
const equipmentWeightMax = ref('100')
const equipmentWeightStep = ref('2.5')
const equipmentWeightList = ref('')

const equipmentWeightPreview = computed(() => {
  let values: number[] = []
  if (equipmentWeightMode.value === 'step') {
    values = buildSteppedWeightValues(
      Number(equipmentWeightMin.value),
      Number(equipmentWeightMax.value),
      Number(equipmentWeightStep.value),
    )
  } else if (equipmentWeightMode.value === 'custom') {
    values = normalizeWeightValues(parseWeightList(equipmentWeightList.value))
  }
  if (!values.length) return ''
  const shown = values.slice(0, 8).join('、')
  return values.length > 8 ? `${shown} 等 ${values.length} 档` : `${shown} kg`
})

function parseWeightList(input: string): number[] {
  return input
    .split(/[\s,，、]+/)
    .filter(Boolean)
    .map(value => Number(value))
}

function resetEquipmentWeightEditor(): void {
  equipmentWeightMode.value = 'default'
  equipmentWeightMin.value = '2.5'
  equipmentWeightMax.value = '100'
  equipmentWeightStep.value = '2.5'
  equipmentWeightList.value = ''
}

function openCreateEquipment() {
  editingEquipmentId.value = undefined
  equipmentName.value = ''
  resetEquipmentWeightEditor()
  showEquipmentEditor.value = true
}

function openEditEquipment(equipment: Equipment) {
  editingEquipmentId.value = equipment.id
  equipmentName.value = equipment.name
  resetEquipmentWeightEditor()
  const profile = equipment.weightProfile
  if (profile?.mode === 'step') {
    equipmentWeightMode.value = 'step'
    equipmentWeightMin.value = String(profile.min ?? profile.step ?? 1)
    equipmentWeightMax.value = String(profile.max ?? 100)
    equipmentWeightStep.value = String(profile.step ?? 1)
  } else if (profile?.mode === 'custom') {
    equipmentWeightMode.value = 'custom'
    equipmentWeightList.value = (profile.values ?? []).join(', ')
  }
  showEquipmentEditor.value = true
}

function focusEquipmentInput(): void {
  equipmentInputRef.value?.focus({ preventScroll: true })
  if (editingEquipmentId.value) equipmentInputRef.value?.select()
}

async function saveEquipment() {
  const name = equipmentName.value.trim()
  if (!name) {
    showToast('请输入器械名称')
    return
  }
  let weightProfile: WeightProfile | undefined
  if (equipmentWeightMode.value === 'step') {
    const min = Number(equipmentWeightMin.value)
    const max = Number(equipmentWeightMax.value)
    const step = Number(equipmentWeightStep.value)
    const values = buildSteppedWeightValues(min, max, step)
    if (
      !equipmentWeightMin.value.trim()
      || !equipmentWeightMax.value.trim()
      || !equipmentWeightStep.value.trim()
      || min <= 0
      || !values.length
    ) {
      showToast('请检查最小值、最大值和间隔，最多支持 500 档')
      return
    }
    weightProfile = { mode: 'step', min, max, step }
  } else if (equipmentWeightMode.value === 'custom') {
    const parsed = parseWeightList(equipmentWeightList.value)
    const values = normalizeWeightValues(parsed)
    if (
      !values.length
      || values.length > 500
      || parsed.some(value => !Number.isFinite(value) || value <= 0)
    ) {
      showToast('请输入 1–500 个大于 0 的有效重量')
      return
    }
    weightProfile = { mode: 'custom', values }
  }
  try {
    if (editingEquipmentId.value) {
      await exerciseStore.updateEquipment(
        editingEquipmentId.value,
        name,
        weightProfile,
      )
    } else {
      savedEquipmentRevealId = await exerciseStore.addEquipment(
        name,
        weightProfile,
      )
    }
    showEquipmentEditor.value = false
    showToast('已保存')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  }
}

function revealSavedEquipment(): void {
  if (!savedEquipmentRevealId) return
  const equipmentId = savedEquipmentRevealId
  savedEquipmentRevealId = null
  void revealTarget(equipmentId)
}

async function removeEquipment(id: string) {
  try {
    await showConfirmDialog({ title: '移除器械', message: '移除后该器械下的动作也会被删除。若为器械库项目，可重新从器械库添加。' })
    if (expandedEquipmentId.value === id) expandedEquipmentId.value = null
    await exerciseStore.deleteEquipment(id)
    showToast('已移除')
  } catch {
    // 用户取消
  }
}

// ===== Exercise edit dialog =====
const showExerciseEditor = ref(false)
const editingExerciseId = ref<string>()
const editingExerciseEquipmentId = ref<string>('')
const exerciseName = ref('')
const exerciseMuscleGroup = ref<MuscleGroup>('胸')
const exerciseDataTemplate = ref<DataTemplate>('weight-reps')
const exerciseInputRef = ref<HTMLInputElement | null>(null)

function openCreateExercise(equipmentId: string) {
  editingExerciseId.value = undefined
  editingExerciseEquipmentId.value = equipmentId
  exerciseName.value = ''
  exerciseMuscleGroup.value = '胸'
  exerciseDataTemplate.value = 'weight-reps'
  showExerciseEditor.value = true
}

function openEditExercise(exercise: Exercise) {
  editingExerciseId.value = exercise.id
  editingExerciseEquipmentId.value = exercise.equipmentId
  exerciseName.value = exercise.name
  exerciseMuscleGroup.value = exercise.muscleGroup
  exerciseDataTemplate.value = exercise.dataTemplate
  showExerciseEditor.value = true
}

function focusExerciseInput(): void {
  exerciseInputRef.value?.focus({ preventScroll: true })
  if (editingExerciseId.value) exerciseInputRef.value?.select()
}

async function saveExercise() {
  const name = exerciseName.value.trim()
  if (!name) {
    showToast('请输入动作名称')
    return
  }
  const input = {
    name,
    equipmentId: editingExerciseEquipmentId.value,
    muscleGroup: exerciseMuscleGroup.value,
    dataTemplate: exerciseDataTemplate.value,
  }
  try {
    if (editingExerciseId.value) {
      await exerciseStore.updateExercise(editingExerciseId.value, input)
    } else {
      savedExerciseRevealId = await exerciseStore.addExercise(input)
    }
    showExerciseEditor.value = false
    showToast('已保存')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  }
}

function revealSavedExercise(): void {
  if (!savedExerciseRevealId) return
  const exerciseId = savedExerciseRevealId
  savedExerciseRevealId = null
  void revealTarget(undefined, exerciseId)
}

async function removeExercise(id: string) {
  try {
    await showConfirmDialog({ title: '删除动作', message: '确定要删除这个动作吗？' })
    await exerciseStore.deleteExercise(id)
    showToast('已删除')
  } catch {
    // 用户取消
  }
}

// ===== Case library inline =====
function getCaseEquipment(equipmentCase: EquipmentCase) {
  const normalizedName = normalizeEquipmentName(equipmentCase.name)
  return exerciseStore.equipments.find(item =>
    (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName,
  )
}

function isCaseFullyComplete(equipmentCase: EquipmentCase): boolean {
  const equipment = getCaseEquipment(equipmentCase)
  if (!equipment) return false
  return equipmentCase.actions.every(action => {
    const normalizedName = normalizeEquipmentName(action.name)
    return exerciseStore.exercises.some(item =>
      item.equipmentId === equipment.id &&
      (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName,
    )
  })
}

async function quickAddCase(equipmentCase: EquipmentCase) {
  if (isCaseFullyComplete(equipmentCase)) return
  const equipmentId = await exerciseStore.addCaseEquipment(
    equipmentCase,
    equipmentCase.actions.map(a => a.id),
  )
  showToast(`已添加「${equipmentCase.name}」`)
  await revealTarget(equipmentId)
}

function isEquipmentFromCase(equipmentId: string): boolean {
  const equipment = exerciseStore.equipments.find(e => e.id === equipmentId)
  if (!equipment) return false
  const normalizedName = equipment.normalizedName ?? normalizeEquipmentName(equipment.name)
  return EQUIPMENT_CASES.some(c => normalizeEquipmentName(c.name) === normalizedName)
}

// ===== Sort workspace =====
type SortSection = 'equipment' | 'exercise'
type FlipAnimation =
  | ''
  | 'flip-enter-out'
  | 'flip-enter-in'
  | 'flip-exit-out'
  | 'flip-exit-in'

const sortMode = ref(false)
const flipAnimation = ref<FlipAnimation>('')
const isFlipping = ref(false)
const sortSection = ref<SortSection>('equipment')
const selectedSortEquipmentId = ref('')
const equipmentOrderDraft = ref<string[]>([])
const exerciseOrderDrafts = ref<Record<string, string[]>>({})
const equipmentSortListRef = ref<HTMLElement | null>(null)
const exerciseSortListRef = ref<HTMLElement | null>(null)
let equipmentSortable: Sortable | null = null
let exerciseSortable: Sortable | null = null
let flipTimer: ReturnType<typeof setTimeout> | null = null

const sortEquipmentItems = computed(() => equipmentOrderDraft.value
  .map(id => exerciseStore.equipments.find(equipment => equipment.id === id))
  .filter((equipment): equipment is NonNullable<typeof equipment> => Boolean(equipment)))

const sortExerciseItems = computed(() => {
  const ids = exerciseOrderDrafts.value[selectedSortEquipmentId.value] ?? []
  return ids
    .map(id => exerciseStore.exercises.find(exercise => exercise.id === id))
    .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
})

function destroySortables() {
  equipmentSortable?.destroy()
  exerciseSortable?.destroy()
  equipmentSortable = null
  exerciseSortable = null
}

function createEquipmentSortable() {
  if (!equipmentSortListRef.value) return
  equipmentSortable?.destroy()
  equipmentSortable = Sortable.create(equipmentSortListRef.value, {
    animation: 200,
    direction: 'vertical',
    group: {
      name: 'equipment-sort-workspace',
      pull: false,
      put: false,
    },
    handle: '.sort-handle',
    forceFallback: true,
    ghostClass: 'equipment-card--ghost',
    dragClass: 'equipment-card--dragging',
    touchStartThreshold: 6,
    onEnd() {
      equipmentOrderDraft.value = Array.from(
        equipmentSortListRef.value!.querySelectorAll('[data-sort-equipment-id]'),
      ).map(element => (element as HTMLElement).dataset.sortEquipmentId!)
      exerciseStore.reorderEquipments(equipmentOrderDraft.value).catch(() => {
        showToast('排序保存失败，请重试')
      })
    },
  })
}

function createExerciseSortable() {
  if (!exerciseSortListRef.value) return
  exerciseSortable?.destroy()
  exerciseSortable = Sortable.create(exerciseSortListRef.value, {
    animation: 200,
    direction: 'vertical',
    group: {
      name: 'exercise-sort-workspace',
      pull: false,
      put: false,
    },
    handle: '.sort-handle',
    forceFallback: true,
    ghostClass: 'exercise-sort-item--ghost',
    dragClass: 'exercise-sort-item--dragging',
    touchStartThreshold: 6,
    onEnd() {
      exerciseOrderDrafts.value[selectedSortEquipmentId.value] = Array.from(
        exerciseSortListRef.value!.querySelectorAll('[data-sort-exercise-id]'),
      ).map(element => (element as HTMLElement).dataset.sortExerciseId!)
      exerciseStore.reorderExercises(
        selectedSortEquipmentId.value,
        exerciseOrderDrafts.value[selectedSortEquipmentId.value],
      ).catch(() => {
        showToast('排序保存失败，请重试')
      })
    },
  })
}

function waitForFlip(duration: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return nextTick()
  }
  return new Promise<void>(resolve => {
    flipTimer = setTimeout(() => {
      flipTimer = null
      resolve()
    }, duration)
  })
}

async function flipToSortMode(targetSortMode: boolean) {
  if (isFlipping.value || sortMode.value === targetSortMode) return false
  isFlipping.value = true
  emit('flip-state-change', true)
  flipAnimation.value = targetSortMode ? 'flip-enter-out' : 'flip-exit-out'
  emit('flip-animation-change', flipAnimation.value)
  await waitForFlip(160)

  if (targetSortMode) {
    sortMode.value = true
    await nextTick()
    createEquipmentSortable()
  } else {
    destroySortables()
    sortMode.value = false
    await nextTick()
  }

  flipAnimation.value = targetSortMode ? 'flip-enter-in' : 'flip-exit-in'
  emit('flip-animation-change', flipAnimation.value)
  await waitForFlip(240)
  flipAnimation.value = ''
  emit('flip-animation-change', '')
  isFlipping.value = false
  emit('flip-state-change', false)
  return true
}

async function startSortMode() {
  if (isFlipping.value || sortMode.value) return
  searchQuery.value = ''
  expandedEquipmentId.value = null
  equipmentOrderDraft.value = exerciseStore.equipments.map(equipment => equipment.id)
  exerciseOrderDrafts.value = Object.fromEntries(
    exerciseStore.equipments.map(equipment => [
      equipment.id,
      getEquipmentExercises(equipment.id).map(exercise => exercise.id),
    ]),
  )
  selectedSortEquipmentId.value = equipmentOrderDraft.value[0] ?? ''
  sortSection.value = 'equipment'
  await flipToSortMode(true)
}

async function exitSortMode() {
  await flipToSortMode(false)
}

async function setSortSection(section: SortSection) {
  if (sortSection.value === section) return
  destroySortables()
  sortSection.value = section
  await nextTick()
  if (section === 'equipment') createEquipmentSortable()
  else createExerciseSortable()
}

watch(selectedSortEquipmentId, async () => {
  if (!sortMode.value || sortSection.value !== 'exercise') return
  exerciseSortable?.destroy()
  exerciseSortable = null
  await nextTick()
  createExerciseSortable()
})

onUnmounted(() => {
  destroySortables()
  if (flipTimer) clearTimeout(flipTimer)
  emit('flip-animation-change', '')
  emit('flip-state-change', false)
})
</script>

<template>
  <div
    class="management-flip-stage"
    :class="[
      { 'management-flip-stage--flipping': isFlipping && !embedded },
      flipAnimation && !embedded ? `management-flip-stage--${flipAnimation}` : '',
    ]"
    :aria-busy="isFlipping"
  >
    <div
      v-smooth-corners="embedded ? 38 : 0"
      class="management-page"
      :class="{ 'management-page--embedded': embedded }"
    >
    <!-- Header -->
    <van-nav-bar
      v-if="!embedded"
      title="器械动作管理"
      left-arrow
      @click-left="onNavBack"
    />
    <header v-else class="popup-header" data-sheet-swipe-handle>
      <button
        v-if="sortMode"
        v-smooth-corners="22"
        class="sort-toggle-btn"
        @click="exitSortMode"
        aria-label="返回"
      >
        <van-icon name="arrow-left" size="18" color="#8e8e93" />
      </button>
      <button
        v-else
        v-smooth-corners="22"
        class="sort-entry-btn"
        @click="startSortMode"
        aria-label="整理顺序"
      >
        <van-icon name="bars" size="18" color="#8e8e93" />
        <span>排序</span>
      </button>
      <h2 class="popup-title">{{ sortMode ? '整理顺序' : '器械动作管理' }}</h2>
      <button
        v-if="sortMode"
        v-smooth-corners="22"
        class="sort-confirm-btn"
        @click="exitSortMode"
        aria-label="完成"
      >
        <van-icon name="success" size="18" color="#fff" />
      </button>
      <button
        v-else
        v-smooth-corners="22"
        class="popup-done-btn"
        @click="onNavBack"
        aria-label="完成"
      >
        <van-icon name="success" size="18" color="#fff" />
      </button>
    </header>

    <!-- Sort workspace -->
    <div v-if="sortMode" class="sort-workspace">
      <div v-smooth-corners="12" class="sort-segmented-control">
        <button
          class="sort-segment-button"
          :class="{ 'sort-segment-button--active': sortSection === 'equipment' }"
          @click="setSortSection('equipment')"
        >器械</button>
        <button
          class="sort-segment-button"
          :class="{ 'sort-segment-button--active': sortSection === 'exercise' }"
          @click="setSortSection('exercise')"
        >动作</button>
      </div>

      <div v-if="sortSection === 'equipment'" class="sort-pane">
        <p class="sort-hint">拖动右侧手柄调整器械顺序</p>
        <van-empty v-if="sortEquipmentItems.length === 0" description="暂无可排序的器械" />
        <div v-else ref="equipmentSortListRef" class="sort-list">
          <div
            v-for="equipment in sortEquipmentItems"
            :key="equipment.id"
            v-smooth-corners="14"
            class="equipment-sort-item"
            :data-sort-equipment-id="equipment.id"
          >
            <div class="equipment-card-left">
              <div v-smooth-corners="10" class="equipment-icon">
                <img
                  v-if="getEquipmentIcon(equipment.icon)"
                  :src="getEquipmentIcon(equipment.icon)"
                  :alt="`${equipment.name}图标`"
                />
                <span v-else>🏋️</span>
              </div>
              <div class="equipment-card-info">
                <span class="equipment-name">{{ equipment.name }}</span>
                <span class="equipment-count">{{ getEquipmentExercises(equipment.id).length }} 个动作</span>
              </div>
            </div>
            <span class="sort-handle sort-handle--visible" aria-label="拖动排序">
              <span class="sort-handle-bar" /><span class="sort-handle-bar" /><span class="sort-handle-bar" />
            </span>
          </div>
        </div>
      </div>

      <div v-else class="sort-pane">
        <label v-if="sortEquipmentItems.length" class="sort-equipment-select-wrap">
          <span>当前器械</span>
          <select v-model="selectedSortEquipmentId" class="sort-equipment-select">
            <option
              v-for="equipment in sortEquipmentItems"
              :key="equipment.id"
              :value="equipment.id"
            >{{ equipment.name }}</option>
          </select>
        </label>
        <p class="sort-hint">动作只能在当前器械内排序</p>
        <van-empty
          v-if="!selectedSortEquipmentId || sortExerciseItems.length === 0"
          :description="selectedSortEquipmentId ? '当前器械暂无动作' : '暂无可选择的器械'"
        />
        <div v-else ref="exerciseSortListRef" class="sort-list">
          <div
            v-for="exercise in sortExerciseItems"
            :key="exercise.id"
            v-smooth-corners="14"
            class="exercise-sort-item"
            :data-sort-exercise-id="exercise.id"
          >
            <div class="exercise-sort-info">
              <span class="exercise-name">{{ exercise.name }}</span>
              <span class="exercise-meta">{{ exercise.muscleGroup }} · {{ getTemplateLabel(exercise.dataTemplate) }}</span>
            </div>
            <span class="sort-handle sort-handle--visible" aria-label="拖动排序">
              <span class="sort-handle-bar" /><span class="sort-handle-bar" /><span class="sort-handle-bar" />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Normal management content -->
    <div v-if="!sortMode" ref="equipmentListRef" class="equipment-list">
      <!-- Search bar -->
      <div class="search-container">
        <div v-smooth-corners="12" class="search-bar">
          <van-icon name="search" size="16" color="#8e8e93" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索器械或动作..."
            enterkeyhint="search"
          />
          <van-icon
            v-if="searchQuery"
            name="clear"
            size="16"
            color="#c7c7cc"
            class="search-clear"
            @click="searchQuery = ''"
          />
        </div>
      </div>

      <!-- ====== 我的器械 ====== -->
      <div v-if="!searchQuery || filteredEquipments.length" class="section-label">我的器械</div>

      <EquipmentEmptyState
        v-if="exerciseStore.equipments.length === 0 && !searchQuery"
        class="management-empty-state"
        message="还没有常用器械，可从器械库添加"
      />
      <van-empty
        v-else-if="exerciseStore.equipments.length > 0 && filteredEquipments.length === 0 && searchQuery"
        description="无匹配的器械"
      />

      <div>
      <van-swipe-cell
        v-for="equipment in filteredEquipments"
        :key="equipment.id"
      >
        <div
          v-smooth-corners="14"
          class="equipment-card"
          :class="{ 'equipment-card--expanded': expandedEquipmentId === equipment.id }"
          :data-equipment-id="equipment.id"
        >
          <!-- Card header -->
          <div
            class="equipment-card-header"
            @click="toggleExpand(equipment.id)"
          >
            <div class="equipment-card-left">
              <div v-smooth-corners="10" class="equipment-icon">
                <img
                  v-if="getEquipmentIcon(equipment.icon)"
                  :src="getEquipmentIcon(equipment.icon)"
                  :alt="`${equipment.name}图标`"
                />
                <span v-else>🏋️</span>
              </div>
              <div class="equipment-card-info">
                <span class="equipment-name">{{ equipment.name }}</span>
                <span class="equipment-count">{{ getEquipmentExercises(equipment.id).length }} 个动作</span>
              </div>
            </div>
            <van-icon
              name="arrow-down"
              size="16"
              color="#c7c7cc"
              class="chevron"
              :class="{ 'chevron--expanded': expandedEquipmentId === equipment.id }"
            />
          </div>

          <!-- Expanded body -->
          <Transition
            name="expand"
            @before-enter="beforeExpandEnter"
            @enter="expandEnter"
            @after-enter="afterExpandEnter"
            @before-leave="beforeExpandLeave"
            @leave="expandLeave"
            @after-leave="afterExpandLeave"
          >
            <div v-if="expandedEquipmentId === equipment.id" class="equipment-card-body">
              <div class="equipment-card-content">
                <div class="exercise-list">
                  <EquipmentEmptyState
                    v-if="getEquipmentExercises(equipment.id).length === 0"
                    compact
                    message="还没有动作"
                  />
                  <van-swipe-cell
                    v-for="exercise in getEquipmentExercises(equipment.id)"
                    :key="exercise.id"
                    stop-propagation
                  >
                    <div
                      v-smooth-corners="12"
                      class="exercise-item"
                      :data-exercise-id="exercise.id"
                      @click="openEditExercise(exercise)"
                    >
                      <div class="exercise-info">
                        <span class="exercise-name">{{ exercise.name }}</span>
                        <span class="exercise-meta">{{ exercise.muscleGroup }} · {{ getTemplateLabel(exercise.dataTemplate) }}</span>
                      </div>
                      <van-icon name="arrow" size="14" color="#c7c7cc" />
                    </div>
                    <template #right>
                      <van-button
                        v-smooth-corners="12"
                        class="delete-exercise-btn"
                        type="danger"
                        text="删除"
                        @click="removeExercise(exercise.id)"
                      />
                    </template>
                  </van-swipe-cell>
                </div>

                <div
                  v-smooth-corners="12"
                  class="add-exercise-row"
                  @click="openCreateExercise(equipment.id)"
                >
                  <van-icon name="plus" size="16" color="#007aff" />
                  <span>新增动作</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <template #right>
          <div class="equipment-swipe-actions">
            <van-button
              v-smooth-corners="14"
              class="equipment-swipe-action equipment-swipe-edit"
              type="primary"
              text="编辑"
              @click.stop="openEditEquipment(equipment)"
            />
            <van-button
              v-smooth-corners="14"
              class="equipment-swipe-action"
              type="danger"
              :text="isEquipmentFromCase(equipment.id) ? '移除' : '删除'"
              @click.stop="removeEquipment(equipment.id)"
            />
          </div>
        </template>
      </van-swipe-cell>
      </div>

      <div
        v-if="!searchQuery"
        v-smooth-corners="12"
        class="add-exercise-row add-equipment-row"
        @click="openCreateEquipment"
      >
        <van-icon name="plus" size="16" color="#007aff" />
        <span>新增器械</span>
      </div>

      <!-- ====== 器械库 ====== -->
      <div
        v-if="(!searchQuery || filteredCases.length) && exerciseStore.equipments.length >= 0"
        class="section-label section-label--library"
      >器械库</div>

      <div
        v-for="equipmentCase in filteredCases"
        :key="equipmentCase.id"
        v-smooth-corners="14"
        class="case-card"
        :class="{ 'case-card--added': isCaseFullyComplete(equipmentCase) }"
        @click="quickAddCase(equipmentCase)"
      >
        <div class="case-card-left">
          <div v-smooth-corners="10" class="equipment-icon case-icon">
            <img
              v-if="getEquipmentIcon(equipmentCase.icon)"
              :src="getEquipmentIcon(equipmentCase.icon)"
              :alt="`${equipmentCase.name}图标`"
            />
            <span v-else>🏋️</span>
          </div>
          <div class="case-card-info">
            <span class="case-name">{{ equipmentCase.name }}</span>
            <span class="case-count">{{ equipmentCase.actions.length }} 个预设动作</span>
          </div>
        </div>
        <div class="case-card-right">
          <span v-if="isCaseFullyComplete(equipmentCase)" class="case-added-label">已添加</span>
          <span v-else class="case-hint">点击添加</span>
        </div>
      </div>

    </div>

    <!-- Equipment create/edit card popup -->
    <ImmersiveSheet
      v-model:show="showEquipmentEditor"
      position="top"
      :radius="24"
      elevation="prominent"
      :z-index="2010"
      swipe-handle="[data-sheet-swipe-handle]"
      aria-label="编辑器械"
      @opened="focusEquipmentInput"
      @closed="revealSavedEquipment"
    >
      <div
        class="equipment-editor-card"
      >
        <div class="editor-card-header" data-sheet-swipe-handle>
          <span class="editor-card-title">{{ editingEquipmentId ? '编辑器械' : '新建器械' }}</span>
          <button
            v-smooth-corners="18"
            class="editor-confirm-btn"
            :class="{ 'editor-confirm-btn--active': equipmentName.trim().length > 0 }"
            @click="saveEquipment"
            aria-label="确认"
          >
            <van-icon name="success" size="18" color="#fff" />
          </button>
        </div>
        <input
          ref="equipmentInputRef"
          autofocus
          v-model="equipmentName"
          type="text"
          class="editor-input"
          placeholder="输入器械名称..."
          enterkeyhint="done"
          @keyup.enter="saveEquipment"
        />

        <div class="weight-profile-editor">
          <div class="weight-profile-heading">
            <span>重量档位</span>
            <small>kg</small>
          </div>
          <div class="pill-group weight-mode-group">
            <button
              v-for="option in [
                { value: 'default', label: '默认整数' },
                { value: 'step', label: '固定间隔' },
                { value: 'custom', label: '自定义' },
              ]"
              :key="option.value"
              class="pill-btn"
              :class="{ 'pill-btn--active': equipmentWeightMode === option.value }"
              type="button"
              @click="equipmentWeightMode = option.value as WeightMode"
            >{{ option.label }}</button>
          </div>

          <div v-if="equipmentWeightMode === 'step'" class="weight-step-fields">
            <label>
              <span>最小值</span>
              <input v-model="equipmentWeightMin" type="number" min="0.001" inputmode="decimal" />
            </label>
            <label>
              <span>最大值</span>
              <input v-model="equipmentWeightMax" type="number" min="0" inputmode="decimal" />
            </label>
            <label>
              <span>间隔</span>
              <input v-model="equipmentWeightStep" type="number" min="0.001" inputmode="decimal" />
            </label>
          </div>

          <div v-else-if="equipmentWeightMode === 'custom'" class="weight-custom-field">
            <textarea
              v-model="equipmentWeightList"
              rows="2"
              placeholder="例如：4.5, 9, 13.5, 18, 22.5"
            ></textarea>
            <small>使用逗号或空格分隔，保存后会自动排序、去重</small>
          </div>

          <p v-if="equipmentWeightPreview" class="weight-preview">
            预览：{{ equipmentWeightPreview }}
          </p>
          <p v-else-if="equipmentWeightMode === 'default'" class="weight-profile-note">
            使用 1–200 kg 的整数档位
          </p>
        </div>
      </div>
    </ImmersiveSheet>

    <!-- Exercise edit card popup -->
    <ImmersiveSheet
      v-model:show="showExerciseEditor"
      position="top"
      :radius="24"
      elevation="prominent"
      :z-index="2010"
      swipe-handle=".immersive-sheet-header"
      aria-label="编辑动作"
      @opened="focusExerciseInput"
      @closed="revealSavedExercise"
    >
      <template #header>
        <span>{{ editingExerciseId ? '编辑动作' : '新增动作' }}</span>
      </template>

      <template #header-right>
        <button
          v-smooth-corners="18"
          class="editor-confirm-btn"
          :class="{ 'editor-confirm-btn--active': exerciseName.trim().length > 0 }"
          @click="saveExercise"
          aria-label="确认"
        >
          <van-icon name="success" size="18" color="#fff" />
        </button>
      </template>

      <template #default="{ headerSafeSpace }">
        <div
          class="exercise-editor-card"
          :style="{ paddingTop: `${headerSafeSpace}px` }"
        >
        <input
          ref="exerciseInputRef"
          autofocus
          v-model="exerciseName"
          type="text"
          class="editor-input"
          placeholder="输入动作名称..."
          enterkeyhint="done"
          @keyup.enter="saveExercise"
        />

        <!-- Muscle group pills -->
        <div class="pill-group">
          <button
            v-for="group in MUSCLE_GROUPS"
            :key="group"
            v-smooth-corners="8"
            class="pill-btn"
            :class="{ 'pill-btn--active': exerciseMuscleGroup === group }"
            @click="exerciseMuscleGroup = group"
          >{{ group }}</button>
        </div>

        <!-- Data template pills -->
        <div class="pill-group">
          <button
            v-for="option in DATA_TEMPLATE_OPTIONS"
            :key="option.value"
            v-smooth-corners="8"
            class="pill-btn pill-btn--wide"
            :class="{ 'pill-btn--active': exerciseDataTemplate === option.value }"
            @click="exerciseDataTemplate = option.value"
          >{{ option.label }}</button>
        </div>
        </div>
      </template>
    </ImmersiveSheet>
    </div>
  </div>
</template>

<style scoped>
/* ===== Page layout ===== */
.management-flip-stage {
  width: 100%;
  height: 100%;
  transform-origin: center center;
}

.management-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: #f5f5f7;
  overflow: hidden;
}

.management-page--embedded {
  height: 100%;
  border-radius: 38px;
  background: #fff;
}

.management-flip-stage--flipping {
  pointer-events: none;
  will-change: transform;
}

.management-flip-stage--flip-enter-out {
  animation: flip-enter-out 160ms ease-in both;
}

.management-flip-stage--flip-enter-in {
  animation: flip-enter-in 240ms ease-out both;
}

.management-flip-stage--flip-exit-out {
  animation: flip-exit-out 160ms ease-in both;
}

.management-flip-stage--flip-exit-in {
  animation: flip-exit-in 240ms ease-out both;
}

@keyframes flip-enter-out {
  0% { transform: perspective(2200px) rotateY(0deg); }
  100% { transform: perspective(2200px) rotateY(90deg); }
}

@keyframes flip-enter-in {
  0% { transform: perspective(2200px) rotateY(-90deg); }
  70% { transform: perspective(2200px) rotateY(2.5deg); }
  88% { transform: perspective(2200px) rotateY(-0.8deg); }
  100% { transform: perspective(2200px) rotateY(0deg); }
}

@keyframes flip-exit-out {
  0% { transform: perspective(2200px) rotateY(0deg); }
  100% { transform: perspective(2200px) rotateY(-90deg); }
}

@keyframes flip-exit-in {
  0% { transform: perspective(2200px) rotateY(90deg); }
  70% { transform: perspective(2200px) rotateY(-2.5deg); }
  88% { transform: perspective(2200px) rotateY(0.8deg); }
  100% { transform: perspective(2200px) rotateY(0deg); }
}

@media (prefers-reduced-motion: reduce) {
  .management-flip-stage--flip-enter-out,
  .management-flip-stage--flip-enter-in,
  .management-flip-stage--flip-exit-out,
  .management-flip-stage--flip-exit-in {
    animation: none;
  }
}

/* ===== Popup header ===== */
.popup-header {
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 76px;
  padding: 0 20px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.popup-title {
  font-size: 20px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0;
}

.sort-toggle-btn {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: none;
  background: #f5f5f7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease, background 0.15s ease;
}

.sort-toggle-btn:active {
  transform: translateY(-50%) scale(0.92);
}

.sort-entry-btn {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 22px;
  background: #f5f5f7;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #3a3a3c;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease;
}

.sort-entry-btn:active {
  transform: translateY(-50%) scale(0.95);
}

.sort-confirm-btn,
.popup-done-btn {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: none;
  background: #007aff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.15s ease;
}

.sort-confirm-btn:active,
.popup-done-btn:active {
  transform: translateY(-50%) scale(0.92);
}

/* ===== Search bar ===== */
.search-container {
  position: sticky;
  z-index: 2;
  top: 0;
  margin: 0 -16px;
  padding: 8px 16px 18px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(255, 255, 255, 0.68) 68%,
    rgba(255, 255, 255, 0) 100%
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.management-page--embedded .search-container {
  top: 0;
  padding-top: 84px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.76);
  border-radius: 12px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  font-family: inherit;
  color: #1c1c1e;
  background: transparent;
}

.search-input::placeholder {
  color: #c7c7cc;
}

.search-clear {
  cursor: pointer;
}

/* ===== Section labels ===== */
.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #8e8e93;
  padding: 4px 4px 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-label--library {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* ===== Equipment list ===== */
.equipment-list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 16px;
}

.management-page--embedded .equipment-list {
  padding-top: 0;
  padding-bottom: 16px;
}

.management-empty-state {
  margin: 6px 0 12px;
}

.sort-workspace {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 4px 16px 16px;
  overflow: hidden;
}

.management-page--embedded .sort-workspace {
  padding-top: 80px;
}

.sort-segmented-control {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  flex-shrink: 0;
  gap: 4px;
  padding: 4px;
  background: #f2f2f7;
  border-radius: 12px;
}

.sort-segment-button {
  padding: 8px 12px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: #8e8e93;
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.sort-segment-button--active {
  background: #fff;
  color: #1c1c1e;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.sort-pane {
  flex: 1;
  min-height: 0;
  padding-top: 12px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.sort-hint {
  margin: 0 4px 10px;
  color: #8e8e93;
  font-size: 13px;
}

.sort-equipment-select-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f5f5f7;
  color: #8e8e93;
  font-size: 14px;
}

.sort-equipment-select {
  min-width: 0;
  max-width: 65%;
  border: none;
  outline: none;
  background: transparent;
  color: #1c1c1e;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  text-align: right;
}

.sort-list {
  position: relative;
  clip-path: inset(0);
  padding-bottom: 12px;
}

.equipment-sort-item,
.exercise-sort-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  background: #fff;
}

.exercise-sort-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.exercise-sort-info .exercise-meta {
  margin-left: 0;
}

.exercise-sort-item--ghost {
  opacity: 0.35;
  background: rgba(0, 122, 255, 0.08) !important;
}

.exercise-sort-item--dragging {
  z-index: 100;
  opacity: 0.85;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

/* ===== Equipment card ===== */
.equipment-card {
  background: rgba(255, 255, 255, 0.76);
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 10px;
  overflow: hidden;
  transition: background 0.15s ease;
}

.equipment-card--expanded {
  background: #fff;
}

.equipment-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.equipment-card-header:active {
  /* no background change to avoid visual disconnect with expanded body */
}

/* ===== Sort handle ===== */
.sort-handle {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  width: 24px;
  margin-left: 4px;
  visibility: hidden;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}

.sort-handle--visible {
  visibility: visible;
}

.sort-handle-bar {
  width: 16px;
  height: 2px;
  border-radius: 1px;
  background: #c7c7cc;
}

/* Sortable drag states */
.equipment-card--ghost {
  opacity: 0.35;
  background: rgba(0, 122, 255, 0.08) !important;
}

.equipment-card--dragging {
  opacity: 0.85;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  z-index: 100;
}

.equipment-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.equipment-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
  border-radius: 10px;
  font-size: 24px;
  flex-shrink: 0;
  color: #007aff;
}

.equipment-icon img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg) brightness(102%) contrast(101%);
}

.equipment-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.equipment-name {
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipment-count {
  font-size: 13px;
  color: #8e8e93;
}

.chevron {
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.chevron--expanded {
  transform: rotate(180deg);
}

/* ===== Expand animation ===== */
.expand-enter-active,
.expand-leave-active {
  transition:
    height 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease-out,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  will-change: height, opacity, transform;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* ===== Card body ===== */
.equipment-card-body {
  min-height: 0;
}

.equipment-card-content {
  padding: 0 16px 16px;
}

/* ===== Exercise list ===== */
.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.exercise-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #f5f5f7;
  border-radius: 12px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s ease;
}

.exercise-item:active {
  background: #e8e8ea;
}

.exercise-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  margin-right: 8px;
}

.exercise-name {
  font-size: 15px;
  font-weight: 500;
  color: #1c1c1e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exercise-meta {
  font-size: 13px;
  color: #8e8e93;
  flex-shrink: 0;
  margin-left: 12px;
}

.delete-exercise-btn {
  height: 100%;
  min-height: 100%;
  margin-left: 8px;
  padding: 0 22px;
  border-radius: 12px;
}

/* ===== Add exercise row ===== */
.add-exercise-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background: rgba(0, 122, 255, 0.06);
  border-radius: 12px;
  border: 1px dashed rgba(0, 122, 255, 0.25);
  color: #007aff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  margin-bottom: 10px;
  transition: background 0.1s ease;
}

.add-exercise-row:active {
  background: rgba(0, 122, 255, 0.12);
}

.add-equipment-row {
  margin-top: 8px;
}

/* ===== Equipment swipe actions ===== */
.equipment-swipe-actions {
  display: flex;
  gap: 8px;
  height: 100%;
  min-height: 100%;
  margin-left: 8px;
}

.equipment-swipe-action {
  height: 100%;
  min-height: 100%;
  padding: 0 20px;
  border-radius: 14px;
}

.equipment-swipe-edit {
  background: #007aff;
  border-color: #007aff;
}

/* ===== Case library cards ===== */
.case-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.76);
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s ease, opacity 0.2s ease;
}

.case-card:active {
  background: rgba(0, 0, 0, 0.04);
}

.case-card--added {
  opacity: 0.48;
  cursor: default;
}

.case-card--added:active {
  background: rgba(255, 255, 255, 0.76);
}

.case-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.case-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.case-name {
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
}

.case-count {
  font-size: 13px;
  color: #8e8e93;
}

.case-card-right {
  flex-shrink: 0;
  margin-left: 12px;
}

.case-added-label {
  font-size: 13px;
  color: #8e8e93;
}

.case-hint {
  font-size: 12px;
  color: #c7c7cc;
}

/* ===== Equipment editor card popup ===== */
.equipment-editor-card {
  background: transparent;
  padding: 18px 20px 24px;
}

.editor-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.editor-card-title {
  font-size: 17px;
  font-weight: 600;
  color: #1c1c1e;
}

.editor-confirm-btn {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  border: none;
  background: #007aff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.35;
  transition: opacity 0.15s ease, transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.editor-confirm-btn--active {
  opacity: 1;
}

.editor-confirm-btn:active {
  transform: scale(0.9);
}

.editor-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  border: none;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  font-size: 24px;
  font-weight: 500;
  font-family: inherit;
  line-height: 1.3;
  color: #1c1c1e;
  background: transparent;
  padding: 6px 2px 8px;
}

.editor-input::placeholder {
  color: #c7c7cc;
  line-height: inherit;
  opacity: 1;
}

.weight-profile-editor {
  margin-top: 14px;
  padding-top: 16px;
  border-top: 1px solid rgba(60, 60, 67, 0.12);
}

.weight-profile-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: #1c1c1e;
  font-size: 15px;
  font-weight: 600;
}

.weight-profile-heading small,
.weight-custom-field small {
  color: #8e8e93;
  font-size: 12px;
  font-weight: 400;
}

.weight-mode-group {
  margin-top: 10px;
}

.weight-step-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.weight-step-fields label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #8e8e93;
  font-size: 12px;
}

.weight-step-fields input,
.weight-custom-field textarea {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid rgba(60, 60, 67, 0.12);
  border-radius: 10px;
  outline: none;
  background: rgba(118, 118, 128, 0.08);
  color: #1c1c1e;
  font: inherit;
}

.weight-step-fields input {
  min-height: 42px;
  padding: 8px 10px;
  font-size: 16px;
}

.weight-custom-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.weight-custom-field textarea {
  min-height: 64px;
  padding: 10px 12px;
  resize: vertical;
  font-size: 15px;
  line-height: 1.45;
}

.weight-preview,
.weight-profile-note {
  margin: 10px 0 0;
  color: #8e8e93;
  font-size: 12px;
  line-height: 1.5;
}

.weight-preview {
  color: #007aff;
}

/* ===== Exercise editor card ===== */
.exercise-editor-card {
  background: transparent;
  padding: 18px 20px 24px;
}

/* ===== Pill toggle buttons ===== */
.pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.pill-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: #8e8e93;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.15s ease;
}

.pill-btn--wide {
  padding: 8px 16px;
}

.pill-btn--active {
  background: #007aff;
  color: #fff;
}

.pill-btn:active {
  transform: scale(0.95);
}

@media (max-height: 600px) {
  .exercise-editor-card {
    padding-top: 12px;
    padding-bottom: 14px;
  }

  .exercise-editor-card .editor-card-header {
    margin-bottom: 8px;
  }

  .exercise-editor-card .editor-input {
    min-height: 40px;
    padding-top: 2px;
    padding-bottom: 4px;
  }

  .exercise-editor-card .pill-group {
    margin-top: 10px;
  }

  .exercise-editor-card .pill-btn {
    padding-top: 7px;
    padding-bottom: 7px;
  }
}

/* ===== Dark mode ===== */
@media (prefers-color-scheme: dark) {
  .management-page {
    background: #1c1c1e;
  }

  .management-page--embedded {
    background: #2c2c2e;
  }

  .popup-title {
    color: #fff;
  }

  .popup-header {
    background: rgba(44, 44, 46, 0.72);
  }

  .sort-toggle-btn,
  .sort-entry-btn {
    background: #3a3a3c;
  }

  .sort-entry-btn {
    color: #fff;
  }

  .sort-confirm-btn,
  .popup-done-btn {
    background: #0a84ff;
  }

  .sort-segmented-control,
  .sort-equipment-select-wrap {
    background: #3a3a3c;
  }

  .sort-segment-button--active {
    background: #636366;
    color: #fff;
    box-shadow: none;
  }

  .sort-equipment-select {
    color: #fff;
  }

  .equipment-sort-item,
  .exercise-sort-item {
    border-color: rgba(255, 255, 255, 0.06);
    background: #2c2c2e;
  }

  .exercise-sort-item--ghost {
    background: rgba(10, 132, 255, 0.12) !important;
  }

  .sort-handle-bar {
    background: #636366;
  }

  .search-bar {
    background: #3a3a3c;
  }

  .search-container {
    background: linear-gradient(
      to bottom,
      rgba(44, 44, 46, 0.74) 0%,
      rgba(44, 44, 46, 0.7) 68%,
      rgba(44, 44, 46, 0) 100%
    );
  }

  .search-input {
    color: #fff;
  }

  .section-label--library {
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  .equipment-card {
    background: #2c2c2e;
    border-color: rgba(255, 255, 255, 0.06);
  }

  .equipment-card--expanded {
    background: #2c2c2e;
  }

  .equipment-icon {
    background: #3a3a3c;
  }

  .equipment-name {
    color: #fff;
  }

  .equipment-card--ghost {
    background: rgba(10, 132, 255, 0.12) !important;
  }

  .exercise-item {
    background: #3a3a3c;
  }

  .exercise-item:active {
    background: #48484a;
  }

  .exercise-name {
    color: #fff;
  }

  .add-exercise-row {
    background: rgba(10, 132, 255, 0.1);
    border-color: rgba(10, 132, 255, 0.3);
    color: #0a84ff;
  }

  .add-exercise-row:active {
    background: rgba(10, 132, 255, 0.18);
  }

  .case-card {
    background: #2c2c2e;
    border-color: rgba(255, 255, 255, 0.06);
  }

  .case-card:active {
    background: rgba(255, 255, 255, 0.06);
  }

  .case-card--added:active {
    background: #2c2c2e;
  }

  .case-name {
    color: #fff;
  }

  .editor-card-title {
    color: #fff;
  }

  .editor-input {
    color: #fff;
  }

  .editor-confirm-btn {
    background: #0a84ff;
  }

  .pill-btn {
    background: rgba(255, 255, 255, 0.08);
    color: #aeaeb2;
  }

  .pill-btn--active {
    background: #0a84ff;
    color: #fff;
  }
}
</style>
