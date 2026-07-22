<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useAttrs,
  useSlots,
  watch,
} from 'vue'
import {
  enterImmersivePopupEnvironment,
  leaveImmersivePopupEnvironment,
} from '@/utils/immersivePopupEnvironment'

defineOptions({ inheritAttrs: false })

type SheetPosition = 'top' | 'bottom'

const props = withDefaults(
  defineProps<{
    show: boolean
    position?: SheetPosition
    height?: string | number
    safeMargin?: number
    radius?: number
    closeOnClickOutside?: boolean
    swipeToDismiss?: boolean
    headerSafeSpace?: number
    footerSafeSpace?: number
    ariaLabel?: string
    zIndex?: number
  }>(),
  {
    position: 'bottom',
    safeMargin: 8,
    radius: 32,
    closeOnClickOutside: true,
    swipeToDismiss: true,
    headerSafeSpace: 76,
    footerSafeSpace: 88,
    ariaLabel: '弹窗',
    zIndex: 2000,
  },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
  opened: []
  closed: []
  'click-outside': []
}>()

const attrs = useAttrs()
const slots = useSlots()
const panelRef = ref<HTMLElement | null>(null)
const dragOffset = ref(0)
const dragging = ref(false)
const environmentToken = Symbol('immersive-sheet')
let environmentActive = false
let startY = 0
let lastY = 0
let lastTime = 0
let velocity = 0
let tracking = false
let previousFocus: HTMLElement | null = null

const hasHeader = computed(
  () => Boolean(slots.header || slots['header-left'] || slots['header-right']),
)
const hasFooter = computed(() => Boolean(slots.footer))

const normalizedHeight = computed(() => {
  if (props.height === undefined) return undefined
  return typeof props.height === 'number' ? `${props.height}px` : props.height
})

const panelStyle = computed(() => ({
  '--sheet-safe-margin': `${props.safeMargin}px`,
  '--sheet-radius': `${props.radius}px`,
  '--sheet-header-safe-space': hasHeader.value
    ? `${props.headerSafeSpace}px`
    : '0px',
  '--sheet-footer-safe-space': hasFooter.value
    ? `${props.footerSafeSpace}px`
    : '0px',
  height: normalizedHeight.value,
  transform: dragOffset.value
    ? `translate3d(0, ${dragOffset.value}px, 0)`
    : undefined,
}))

function enterEnvironment(): void {
  if (environmentActive) return
  environmentActive = true
  enterImmersivePopupEnvironment(environmentToken)
}

function leaveEnvironment(): void {
  if (!environmentActive) return
  environmentActive = false
  leaveImmersivePopupEnvironment(environmentToken)
}

function requestClose(): void {
  emit('update:show', false)
}

function closeFromOutside(): void {
  emit('click-outside')
  if (props.closeOnClickOutside) requestClose()
}

function findScrollableAncestor(target: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = target
  while (current && current !== panelRef.value) {
    const { overflowY } = window.getComputedStyle(current)
    if (
      /(auto|scroll)/.test(overflowY) &&
      current.scrollHeight > current.clientHeight + 1
    ) {
      return current
    }
    current = current.parentElement
  }
  return null
}

function isAtDismissBoundary(scroller: HTMLElement | null): boolean {
  if (!scroller) return true
  if (props.position === 'bottom') return scroller.scrollTop <= 1
  return (
    scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 1
  )
}

function onTouchStart(event: TouchEvent): void {
  if (!props.swipeToDismiss || event.touches.length !== 1) return
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return
  if (!isAtDismissBoundary(findScrollableAncestor(target))) return

  startY = event.touches[0].clientY
  lastY = startY
  lastTime = performance.now()
  velocity = 0
  tracking = true
}

function onTouchMove(event: TouchEvent): void {
  if (!tracking || event.touches.length !== 1) return
  const currentY = event.touches[0].clientY
  const rawDistance = currentY - startY
  const dismissDistance =
    props.position === 'bottom' ? rawDistance : -rawDistance

  if (dismissDistance <= 0) {
    dragOffset.value = 0
    return
  }

  event.preventDefault()
  dragging.value = true
  const now = performance.now()
  const elapsed = now - lastTime
  if (elapsed > 0) velocity = (currentY - lastY) / elapsed
  lastY = currentY
  lastTime = now
  dragOffset.value = props.position === 'bottom'
    ? dismissDistance
    : -dismissDistance
}

function finishTouch(): void {
  if (!tracking) return
  tracking = false

  const panelHeight = panelRef.value?.offsetHeight ?? 0
  const distance = Math.abs(dragOffset.value)
  const directionalVelocity = props.position === 'bottom' ? velocity : -velocity
  const shouldClose =
    dragging.value &&
    (distance >= Math.min(120, panelHeight * 0.22) || directionalVelocity > 0.65)

  dragging.value = false
  dragOffset.value = 0
  if (shouldClose) requestClose()
}

function onAfterEnter(): void {
  emit('opened')
}

function onAfterLeave(): void {
  if (props.show) return
  leaveEnvironment()
  previousFocus?.focus({ preventScroll: true })
  previousFocus = null
  emit('closed')
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.show) requestClose()
}

watch(
  () => props.show,
  async (show) => {
    if (!show) return
    previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    enterEnvironment()
    await nextTick()
    panelRef.value?.focus({ preventScroll: true })
  },
  { immediate: true },
)

window.addEventListener('keydown', handleKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  leaveEnvironment()
})
</script>

<template>
  <Teleport to="#app-popup-root">
    <div class="immersive-sheet-host" :style="{ zIndex: props.zIndex }">
      <Transition name="immersive-sheet-click-layer">
        <div
          v-if="props.show"
          class="immersive-sheet-click-layer"
          aria-hidden="true"
          @click="closeFromOutside"
        />
      </Transition>

      <Transition
        :name="`immersive-sheet-${props.position}`"
        @after-enter="onAfterEnter"
        @after-leave="onAfterLeave"
      >
        <section
          v-if="props.show"
          ref="panelRef"
          v-bind="attrs"
          v-smooth-corners="props.radius"
          class="immersive-sheet-panel"
          :class="[
            `immersive-sheet-panel--${props.position}`,
            { 'immersive-sheet-panel--dragging': dragging },
          ]"
          :style="panelStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="props.ariaLabel"
          tabindex="-1"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="finishTouch"
          @touchcancel="finishTouch"
        >
          <div class="immersive-sheet-content">
            <slot
              :header-safe-space="hasHeader ? props.headerSafeSpace : 0"
              :footer-safe-space="hasFooter ? props.footerSafeSpace : 0"
            />
          </div>

          <header v-if="hasHeader" class="immersive-sheet-header">
            <div class="immersive-sheet-frost" />
            <div class="immersive-sheet-header-left">
              <slot name="header-left" />
            </div>
            <div class="immersive-sheet-header-title">
              <slot name="header" />
            </div>
            <div class="immersive-sheet-header-right">
              <slot name="header-right" />
            </div>
          </header>

          <footer v-if="hasFooter" class="immersive-sheet-footer">
            <div class="immersive-sheet-frost" />
            <div class="immersive-sheet-footer-content">
              <slot name="footer" />
            </div>
          </footer>
        </section>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.immersive-sheet-host {
  position: absolute;
  z-index: 2000;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.immersive-sheet-click-layer {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: auto;
}

.immersive-sheet-panel {
  position: absolute;
  right: var(--sheet-safe-margin);
  left: var(--sheet-safe-margin);
  display: grid;
  max-width: 720px;
  max-height: calc(
    100% - env(safe-area-inset-top) - env(safe-area-inset-bottom) -
      var(--sheet-safe-margin) - var(--sheet-safe-margin)
  );
  margin-inline: auto;
  overflow: hidden;
  border: 1px solid rgba(60, 60, 67, 0.1);
  border-radius: var(--sheet-radius);
  outline: none;
  background: #fff;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.2),
    0 4px 16px rgba(0, 0, 0, 0.08);
  pointer-events: auto;
  corner-shape: superellipse(1.2);
  touch-action: pan-y;
  will-change: transform;
}

.immersive-sheet-panel--top {
  top: max(var(--sheet-safe-margin), env(safe-area-inset-top));
}

.immersive-sheet-panel--bottom {
  bottom: max(var(--sheet-safe-margin), env(safe-area-inset-bottom));
}

.immersive-sheet-panel--dragging {
  transition: none !important;
}

.immersive-sheet-content {
  min-height: 0;
  max-height: inherit;
  overflow: hidden;
}

.immersive-sheet-content :deep(.sheet-scroll-content) {
  height: 100%;
  padding-top: var(--sheet-header-safe-space);
  padding-bottom: var(--sheet-footer-safe-space);
  overflow-y: auto;
  scroll-padding-top: var(--sheet-header-safe-space);
  scroll-padding-bottom: var(--sheet-footer-safe-space);
  -webkit-overflow-scrolling: touch;
}

.immersive-sheet-header,
.immersive-sheet-footer {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 2;
  pointer-events: none;
}

.immersive-sheet-header {
  top: 0;
  display: grid;
  min-height: var(--sheet-header-safe-space);
  grid-template-columns: minmax(52px, 1fr) auto minmax(52px, 1fr);
  align-items: start;
  padding: 14px 16px 24px;
}

.immersive-sheet-footer {
  bottom: 0;
  min-height: var(--sheet-footer-safe-space);
  padding: 28px 16px max(16px, env(safe-area-inset-bottom));
}

.immersive-sheet-frost {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.immersive-sheet-header .immersive-sheet-frost {
  mask-image: linear-gradient(to bottom, #000 58%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 58%, transparent 100%);
}

.immersive-sheet-footer .immersive-sheet-frost {
  mask-image: linear-gradient(to top, #000 58%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, #000 58%, transparent 100%);
}

.immersive-sheet-header-left,
.immersive-sheet-header-title,
.immersive-sheet-header-right,
.immersive-sheet-footer-content {
  position: relative;
  z-index: 1;
  pointer-events: auto;
}

.immersive-sheet-header-title {
  color: #1c1c1e;
  font-size: 18px;
  font-weight: 600;
  line-height: 36px;
  text-align: center;
}

.immersive-sheet-header-right {
  display: flex;
  justify-content: flex-end;
}

.immersive-sheet-panel :deep(button) {
  corner-shape: superellipse(1.2);
}

.immersive-sheet-click-layer-enter-active,
.immersive-sheet-click-layer-leave-active {
  transition: opacity 180ms ease;
}

.immersive-sheet-click-layer-enter-from,
.immersive-sheet-click-layer-leave-to {
  opacity: 0;
}

.immersive-sheet-bottom-enter-active,
.immersive-sheet-bottom-leave-active,
.immersive-sheet-top-enter-active,
.immersive-sheet-top-leave-active {
  transition:
    opacity 180ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.immersive-sheet-bottom-enter-from,
.immersive-sheet-bottom-leave-to {
  opacity: 0;
  transform: translate3d(0, calc(100% + var(--sheet-safe-margin)), 0);
}

.immersive-sheet-top-enter-from,
.immersive-sheet-top-leave-to {
  opacity: 0;
  transform: translate3d(0, calc(-100% - var(--sheet-safe-margin)), 0);
}

@media (prefers-reduced-motion: reduce) {
  .immersive-sheet-click-layer-enter-active,
  .immersive-sheet-click-layer-leave-active,
  .immersive-sheet-bottom-enter-active,
  .immersive-sheet-bottom-leave-active,
  .immersive-sheet-top-enter-active,
  .immersive-sheet-top-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
