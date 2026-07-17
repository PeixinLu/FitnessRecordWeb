<script setup lang="ts">
import { computed, nextTick, reactive, watch } from 'vue'
import {
  buildWheelValues,
  getNearestIndex,
  getOffsetForIndex,
  normalizeWheelCount,
  normalizeWheelModel,
  type WheelRange,
} from '@/utils/numberWheelMath'

interface Props {
  count: number
  units: string[]
  ranges: WheelRange[]
  modelValue: number[]
}

interface ColumnState {
  offset: number
  isDragging: boolean
  startY: number
  startOffset: number
  lastY: number
  lastTime: number
  velocity: number
  wheelTimer: number | undefined
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
  change: [value: number[]]
}>()

const ITEM_HEIGHT = 40
const VISIBLE_ITEMS = 5
const MOMENTUM_FRICTION = 0.94
const MIN_VELOCITY = 0.35

const wheelCount = computed(() => normalizeWheelCount(props.count))
const normalizedValue = computed(() =>
  normalizeWheelModel({
    count: wheelCount.value,
    ranges: props.ranges,
    modelValue: props.modelValue,
  })
)

const columns = computed(() =>
  Array.from({ length: wheelCount.value }, (_, index) => ({
    values: buildWheelValues(props.ranges[index] ?? [0, 0]),
    unit: props.units[index] ?? '',
  }))
)

const states = reactive<ColumnState[]>([])

function createState(): ColumnState {
  return {
    offset: 0,
    isDragging: false,
    startY: 0,
    startOffset: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
    wheelTimer: undefined,
  }
}

function syncStateCount() {
  while (states.length < wheelCount.value) {
    states.push(createState())
  }
  if (states.length > wheelCount.value) {
    states.splice(wheelCount.value)
  }
}

function getMinOffset(index: number): number {
  return getOffsetForIndex(columns.value[index].values.length - 1, ITEM_HEIGHT)
}

function getMaxOffset(): number {
  return 0
}

function clampOffset(index: number, offset: number): number {
  return Math.min(getMaxOffset(), Math.max(getMinOffset(index), offset))
}

function getSelectedIndex(index: number): number {
  return getNearestIndex(states[index].offset, ITEM_HEIGHT, columns.value[index].values.length)
}

function syncOffsetsFromValue() {
  syncStateCount()
  columns.value.forEach((column, index) => {
    const value = normalizedValue.value[index]
    const selectedIndex = Math.max(0, column.values.indexOf(value))
    states[index].offset = getOffsetForIndex(selectedIndex, ITEM_HEIGHT)
  })
}

function emitValue() {
  const value = columns.value.map((column, index) => column.values[getSelectedIndex(index)] ?? 0)
  emit('update:modelValue', value)
  emit('change', value)
}

function snapColumn(index: number) {
  const selectedIndex = getSelectedIndex(index)
  states[index].offset = getOffsetForIndex(selectedIndex, ITEM_HEIGHT)
  emitValue()
}

function animateMomentum(index: number) {
  const state = states[index]
  let velocity = state.velocity

  function step() {
    if (state.isDragging) return

    if (Math.abs(velocity) < MIN_VELOCITY) {
      snapColumn(index)
      return
    }

    const nextOffset = clampOffset(index, state.offset + velocity)
    state.offset = nextOffset

    if (nextOffset === getMaxOffset() || nextOffset === getMinOffset(index)) {
      snapColumn(index)
      return
    }

    velocity *= MOMENTUM_FRICTION
    requestAnimationFrame(step)
  }

  requestAnimationFrame(step)
}

function onTouchStart(index: number, event: TouchEvent) {
  const state = states[index]
  state.isDragging = true
  state.startY = event.touches[0].clientY
  state.startOffset = state.offset
  state.lastY = state.startY
  state.lastTime = Date.now()
  state.velocity = 0
}

function onTouchMove(index: number, event: TouchEvent) {
  const state = states[index]
  if (!state.isDragging) return

  const currentY = event.touches[0].clientY
  const deltaY = currentY - state.startY
  const now = Date.now()
  const dt = now - state.lastTime

  if (dt > 0) {
    state.velocity = ((currentY - state.lastY) / dt) * 16
  }

  state.lastY = currentY
  state.lastTime = now
  state.offset = clampOffset(index, state.startOffset + deltaY)
}

function onTouchEnd(index: number) {
  const state = states[index]
  if (!state.isDragging) return

  state.isDragging = false
  if (Math.abs(state.velocity) > 1) {
    animateMomentum(index)
  } else {
    snapColumn(index)
  }
}

function onWheel(index: number, event: WheelEvent) {
  event.preventDefault()
  const state = states[index]
  state.offset = clampOffset(index, state.offset - event.deltaY)

  if (state.wheelTimer) {
    window.clearTimeout(state.wheelTimer)
  }

  state.wheelTimer = window.setTimeout(() => {
    snapColumn(index)
  }, 120)
}

watch(
  () => [props.count, props.units, props.ranges, props.modelValue] as const,
  () => {
    nextTick(syncOffsetsFromValue)
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div class="number-wheel-picker" :style="{ '--visible-items': VISIBLE_ITEMS }">
    <div
      v-for="(column, index) in columns"
      :key="index"
      class="number-wheel-column"
      @touchstart="onTouchStart(index, $event)"
      @touchmove="onTouchMove(index, $event)"
      @touchend="onTouchEnd(index)"
      @touchcancel="onTouchEnd(index)"
      @wheel="onWheel(index, $event)"
    >
      <div class="number-wheel-highlight"></div>
      <div
        class="number-wheel-track"
        :style="{ transform: `translateY(${states[index]?.offset ?? 0}px)` }"
      >
        <div v-for="value in column.values" :key="value" class="number-wheel-item">
          {{ value }}
        </div>
      </div>
      <span class="number-wheel-unit">{{ column.unit }}</span>
    </div>
  </div>
</template>

<style scoped>
.number-wheel-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: calc(40px * var(--visible-items));
  user-select: none;
}

.number-wheel-column {
  position: relative;
  width: 76px;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  cursor: ns-resize;
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.25) 12%,
    black 30%,
    black 70%,
    rgba(0, 0, 0, 0.25) 88%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.25) 12%,
    black 30%,
    black 70%,
    rgba(0, 0, 0, 0.25) 88%,
    transparent 100%
  );
}

.number-wheel-highlight {
  position: absolute;
  top: 50%;
  left: 4px;
  width: 44px;
  height: 40px;
  transform: translateY(-50%);
  border-top: 1px solid #e5e5ea;
  border-bottom: 1px solid #e5e5ea;
  z-index: 0;
}

.number-wheel-track {
  position: absolute;
  top: 80px;
  left: 4px;
  width: 44px;
  transition: transform 0.16s ease-out;
  will-change: transform;
  z-index: 1;
}

.number-wheel-item {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1c1c1e;
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 24px;
  font-weight: 600;
  line-height: 1;
}

.number-wheel-unit {
  position: absolute;
  top: 50%;
  left: 52px;
  transform: translateY(-50%);
  color: #a1a1aa;
  font-size: 14px;
  font-weight: 500;
  line-height: 40px;
  text-align: left;
  z-index: 2;
  pointer-events: none;
}

@media (prefers-color-scheme: dark) {
  .number-wheel-highlight {
    border-color: #3a3a3c;
  }

  .number-wheel-item {
    color: #fff;
  }

  .number-wheel-unit {
    color: #8e8e93;
  }
}
</style>
