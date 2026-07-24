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
type SheetElevation = 'standard' | 'prominent'

const props = withDefaults(
  defineProps<{
    show: boolean
    position?: SheetPosition
    height?: string | number
    safeMargin?: number
    radius?: number
    closeOnClickOutside?: boolean
    swipeToDismiss?: boolean
    swipeHandle?: string
    headerSafeSpace?: number
    footerSafeSpace?: number
    ariaLabel?: string
    zIndex?: number
    elevation?: SheetElevation
    recessed?: boolean
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
    elevation: 'standard',
    recessed: false,
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

const frameTransform = computed(() => {
  const recessedOffset = props.recessed ? 8 : 0
  const translateY = dragOffset.value + recessedOffset
  const transforms: string[] = []
  if (translateY) transforms.push(`translate3d(0, ${translateY}px, 0)`)
  if (props.recessed) transforms.push('scale3d(0.965, 0.965, 1)')
  return transforms.length ? transforms.join(' ') : undefined
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
  transform: frameTransform.value,
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
  if (
    target.closest(
      'button, a, input, textarea, select, [contenteditable="true"], [data-sheet-swipe-ignore]',
    )
  ) {
    return
  }
  if (props.swipeHandle && !target.closest(props.swipeHandle)) return
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
    if (!show) {
      leaveEnvironment()
      return
    }
    previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    enterEnvironment()
    await nextTick()
    const autofocusTarget = panelRef.value?.querySelector<HTMLElement>('[autofocus]')
    const focusTarget = autofocusTarget ?? panelRef.value
    focusTarget?.focus({ preventScroll: true })
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
        <div
          v-if="props.show"
          class="immersive-sheet-frame"
          :class="[
            `immersive-sheet-frame--${props.position}`,
            `immersive-sheet-frame--${props.elevation}`,
            {
              'immersive-sheet-frame--dragging': dragging,
              'immersive-sheet-frame--sized': normalizedHeight !== undefined,
              'immersive-sheet-frame--recessed': props.recessed,
            },
          ]"
          :style="panelStyle"
        >
          <section
            ref="panelRef"
            v-bind="attrs"
            v-smooth-corners="props.radius"
            class="immersive-sheet-panel"
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

            <div
              class="immersive-sheet-recessed-scrim"
              :class="{ 'immersive-sheet-recessed-scrim--visible': props.recessed }"
              aria-hidden="true"
            />
          </section>
        </div>
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

.immersive-sheet-frame {
  --sheet-frame-shadow: none;
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
  isolation: isolate;
  pointer-events: auto;
  transform-origin: center center;
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.immersive-sheet-frame::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  border-radius: var(--sheet-radius);
  box-shadow: var(--sheet-frame-shadow);
  content: '';
  pointer-events: none;
  corner-shape: superellipse(1.2);
}

.immersive-sheet-frame--top {
  top: max(var(--sheet-safe-margin), env(safe-area-inset-top));
}

.immersive-sheet-frame--bottom {
  bottom: max(var(--sheet-safe-margin), env(safe-area-inset-bottom));
}

.immersive-sheet-frame--dragging {
  transition: none !important;
}

.immersive-sheet-frame--prominent {
  --sheet-frame-shadow:
    0 18px 28px rgba(0, 0, 0, 0.2),
    0 4px 8px rgba(0, 0, 0, 0.12);
}

.immersive-sheet-panel {
  position: relative;
  z-index: 1;
  display: grid;
  width: 100%;
  height: auto;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  border: 1px solid rgba(60, 60, 67, 0.1);
  border-radius: var(--sheet-radius);
  outline: none;
  background: #fff;
  pointer-events: auto;
  corner-shape: superellipse(1.2);
  touch-action: pan-y;
}

.immersive-sheet-frame--sized .immersive-sheet-panel {
  height: 100%;
}

.immersive-sheet-content {
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
}

.immersive-sheet-frame--sized .immersive-sheet-content {
  height: 100%;
}

.immersive-sheet-frame:not(.immersive-sheet-frame--sized) .immersive-sheet-content {
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.immersive-sheet-frame:not(.immersive-sheet-frame--sized) .immersive-sheet-content::-webkit-scrollbar {
  display: none;
}

.immersive-sheet-content :deep(.sheet-scroll-content) {
  box-sizing: border-box;
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

.immersive-sheet-recessed-scrim {
  position: absolute;
  z-index: 10;
  inset: 0;
  background: rgba(60, 60, 67, 0.08);
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.immersive-sheet-recessed-scrim--visible {
  opacity: 1;
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
.immersive-sheet-top-enter-active {
  transition:
    opacity 180ms ease,
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.immersive-sheet-bottom-leave-active,
.immersive-sheet-top-leave-active {
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

.immersive-sheet-bottom-enter-from {
  opacity: 0;
  transform: translate3d(0, calc(100% + var(--sheet-safe-margin)), 0);
}

.immersive-sheet-bottom-leave-to {
  transform: translate3d(0, calc(100% + var(--sheet-safe-margin)), 0);
}

.immersive-sheet-top-enter-from {
  opacity: 0;
  transform: translate3d(0, calc(-100% - var(--sheet-safe-margin)), 0);
}

.immersive-sheet-top-leave-to {
  transform: translate3d(0, calc(-100% - var(--sheet-safe-margin)), 0);
}

@media (prefers-reduced-motion: reduce) {
  .immersive-sheet-click-layer-enter-active,
  .immersive-sheet-click-layer-leave-active,
  .immersive-sheet-bottom-enter-active,
  .immersive-sheet-bottom-leave-active,
  .immersive-sheet-top-enter-active,
  .immersive-sheet-top-leave-active,
  .immersive-sheet-recessed-scrim {
    transition-duration: 0.01ms;
  }
}

@media (prefers-color-scheme: dark) {
  .immersive-sheet-click-layer {
    background: rgba(0, 0, 0, 0.32);
  }

  .immersive-sheet-frame--prominent {
    --sheet-frame-shadow:
      0 20px 32px rgba(0, 0, 0, 0.48),
      0 4px 10px rgba(0, 0, 0, 0.3);
  }

  .immersive-sheet-panel {
    border-color: rgba(255, 255, 255, 0.1);
    background: #1c1c1e;
  }

  .immersive-sheet-frost {
    background: rgba(28, 28, 30, 0.78);
  }

  .immersive-sheet-header-title {
    color: #f5f5f7;
  }

  .immersive-sheet-recessed-scrim {
    background: rgba(0, 0, 0, 0.3);
  }
}
</style>
