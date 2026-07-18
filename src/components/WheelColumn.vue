<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

interface Props {
  value: number
  list: number[]
  unit: string
  format?: (v: number) => string
}

const props = withDefaults(defineProps<Props>(), {
  format: (v: number) => String(v),
})

const emit = defineEmits<{
  change: [value: number]
}>()

// 滚轮配置
const ITEM_HEIGHT = 40
const VISIBLE_ITEMS = 5

// 滚动位置
const offset = ref(0)

// 拖动状态
interface DragState {
  isDragging: boolean
  startY: number
  startOffset: number
  velocity: number
  lastY: number
  lastTime: number
}

const drag: DragState = {
  isDragging: false,
  startY: 0,
  startOffset: 0,
  velocity: 0,
  lastY: 0,
  lastTime: 0,
}

// 计算初始偏移
function calculateInitialOffset(index: number): number {
  return -(index - Math.floor(VISIBLE_ITEMS / 2)) * ITEM_HEIGHT
}

// 初始化滚动位置
function initOffset() {
  const index = props.list.indexOf(props.value)
  if (index >= 0) {
    offset.value = calculateInitialOffset(index)
  }
}

// 滚动到最近的有效位置
function snapToNearest(): number {
  const rawIndex = Math.round(-offset.value / ITEM_HEIGHT) + Math.floor(VISIBLE_ITEMS / 2)
  const clampedIndex = Math.max(0, Math.min(props.list.length - 1, rawIndex))
  const newValue = props.list[clampedIndex]
  emit('change', newValue)
  return calculateInitialOffset(clampedIndex)
}

// 惯性滚动
function inertiaScroll() {
  const friction = 0.95
  const minVelocity = 0.5
  let velocity = drag.velocity

  function animate() {
    if (Math.abs(velocity) < minVelocity) {
      offset.value = snapToNearest()
      return
    }

    offset.value += velocity
    velocity *= friction

    // 边界检查
    const minOffset = -(props.list.length - 1 - Math.floor(VISIBLE_ITEMS / 2)) * ITEM_HEIGHT
    const maxOffset = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT

    if (offset.value > maxOffset) {
      offset.value = maxOffset
      velocity = 0
    } else if (offset.value < minOffset) {
      offset.value = minOffset
      velocity = 0
    }

    requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
}

// 触摸事件
function onTouchStart(e: TouchEvent) {
  drag.isDragging = true
  drag.startY = e.touches[0].clientY
  drag.startOffset = offset.value
  drag.lastY = drag.startY
  drag.lastTime = Date.now()
  drag.velocity = 0
}

function onTouchMove(e: TouchEvent) {
  if (!drag.isDragging) return

  const currentY = e.touches[0].clientY
  const deltaY = currentY - drag.startY
  const now = Date.now()

  const dt = now - drag.lastTime
  if (dt > 0) {
    drag.velocity = (currentY - drag.lastY) / dt * 16
  }

  drag.lastY = currentY
  drag.lastTime = now

  offset.value = drag.startOffset + deltaY
}

function onTouchEnd() {
  if (!drag.isDragging) return
  drag.isDragging = false

  if (Math.abs(drag.velocity) > 2) {
    inertiaScroll()
  } else {
    offset.value = snapToNearest()
  }
}

// 监听外部值变化
watch(() => props.value, (v) => {
  if (!drag.isDragging) {
    const index = props.list.indexOf(v)
    if (index >= 0) {
      offset.value = calculateInitialOffset(index)
    }
  }
})

// 初始化
onMounted(() => {
  initOffset()
})
</script>

<template>
  <div
    class="wheel-column"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <!-- 高亮遮罩 -->
    <div v-smooth-corners="8" class="highlight-bar"></div>

    <div class="wheel-inner" :style="{ transform: `translateY(${offset}px)` }">
      <div v-for="n in list" :key="n" class="wheel-item">
        <span class="wheel-value">{{ format(n) }}</span>
        <span class="wheel-unit">{{ unit }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wheel-column {
  position: relative;
  width: 64px;
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
  touch-action: pan-y;
  /* 渐变遮罩 */
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 20%,
    black 35%,
    black 65%,
    transparent 80%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 20%,
    black 35%,
    black 65%,
    transparent 80%,
    transparent 100%
  );
}

/* 高亮条 */
.highlight-bar {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: rgba(0, 122, 255, 0.1);
  border-radius: 8px;
  z-index: 0;
}

.wheel-inner {
  display: flex;
  flex-direction: column;
  will-change: transform;
  z-index: 1;
}

.wheel-item {
  position: relative;
  width: 64px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wheel-value {
  font-size: 24px;
  font-weight: 600;
  color: #1c1c1e;
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  min-width: 40px;
  text-align: center;
}

.wheel-unit {
  position: absolute;
  left: calc(50% + 18px);
  font-size: 14px;
  font-weight: 500;
  color: #8e8e93;
  min-width: 2ch;
  text-align: left;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .wheel-value {
    color: #fff;
  }

  .highlight-bar {
    background: rgba(10, 132, 255, 0.15);
  }
}
</style>
