import type { Directive } from 'vue'

interface PullToDismissOptions {
  onDismiss: () => void
  disabled?: boolean
  ignoreSelector?: string
}

type PullToDismissBinding = (() => void) | PullToDismissOptions

interface TouchSample {
  y: number
  time: number
}

interface PullToDismissState {
  host: HTMLElement
  options: PullToDismissOptions
  tracking: boolean
  dragging: boolean
  startX: number
  startY: number
  distance: number
  scrollElement: HTMLElement | null
  samples: TouchSample[]
  resetTimer: number | undefined
  originalTransform: string
  originalTransition: string
  originalWillChange: string
  overlay: HTMLElement | null
  originalOverlayOpacity: string
  originalOverlayTransition: string
  onTouchStart: (event: TouchEvent) => void
  onTouchMove: (event: TouchEvent) => void
  onTouchEnd: () => void
  onTouchCancel: () => void
}

const states = new WeakMap<HTMLElement, PullToDismissState>()

const DEFAULT_IGNORE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '.number-wheel-picker',
  '.sort-handle',
  '[data-pull-dismiss-ignore]',
].join(',')

const INTENT_DISTANCE = 6
const MIN_FLICK_DISTANCE = 44
const DISMISS_VELOCITY = 0.65
const RETURN_DURATION = 280

function normalizeOptions(value: PullToDismissBinding): PullToDismissOptions {
  return typeof value === 'function' ? { onDismiss: value } : value
}

function findScrollableAncestor(
  target: HTMLElement,
  root: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = target

  while (current && current !== root) {
    const { overflowY } = window.getComputedStyle(current)
    const canScroll =
      /(auto|scroll)/.test(overflowY) &&
      current.scrollHeight > current.clientHeight + 1

    if (canScroll) return current
    current = current.parentElement
  }

  return null
}

function findOverlay(el: HTMLElement): HTMLElement | null {
  const sibling = el.previousElementSibling
  return sibling instanceof HTMLElement && sibling.classList.contains('van-overlay')
    ? sibling
    : null
}

function applyDragVisuals(el: HTMLElement, state: PullToDismissState): void {
  const height = Math.max(el.offsetHeight, 1)
  const resistanceStart = height * 0.45
  const translatedDistance =
    state.distance <= resistanceStart
      ? state.distance
      : resistanceStart + (state.distance - resistanceStart) * 0.32
  const progress = Math.min(translatedDistance / (height * 0.72), 1)

  el.style.transform = `translate3d(0, ${translatedDistance}px, 0)`

  if (state.overlay) {
    state.overlay.style.opacity = String(1 - progress * 0.58)
  }
}

function restoreInlineStyles(el: HTMLElement, state: PullToDismissState): void {
  el.style.transform = state.originalTransform
  el.style.transition = state.originalTransition
  el.style.willChange = state.originalWillChange
  el.classList.remove('pull-to-dismiss--dragging')

  if (state.overlay) {
    state.overlay.style.opacity = state.originalOverlayOpacity
    state.overlay.style.transition = state.originalOverlayTransition
  }
}

function clearResetTimer(state: PullToDismissState): void {
  if (state.resetTimer === undefined) return
  window.clearTimeout(state.resetTimer)
  state.resetTimer = undefined
}

function resetGesture(state: PullToDismissState): void {
  state.tracking = false
  state.dragging = false
  state.distance = 0
  state.scrollElement = null
  state.samples = []
}

function scheduleStyleCleanup(
  el: HTMLElement,
  state: PullToDismissState,
  delay: number,
): void {
  clearResetTimer(state)
  state.resetTimer = window.setTimeout(() => {
    state.resetTimer = undefined
    restoreInlineStyles(el, state)
  }, delay)
}

function getReleaseVelocity(samples: TouchSample[]): number {
  if (samples.length < 2) return 0

  const last = samples[samples.length - 1]
  if (performance.now() - last.time > 120) return 0

  const first = samples.find(sample => last.time - sample.time <= 100) ?? samples[0]
  const elapsed = last.time - first.time
  return elapsed > 0 ? (last.y - first.y) / elapsed : 0
}

function mountPullToDismiss(
  el: HTMLElement,
  binding: PullToDismissBinding,
): PullToDismissState {
  const host = el.closest<HTMLElement>('.van-popup') ?? el
  const state: PullToDismissState = {
    host,
    options: normalizeOptions(binding),
    tracking: false,
    dragging: false,
    startX: 0,
    startY: 0,
    distance: 0,
    scrollElement: null,
    samples: [],
    resetTimer: undefined,
    originalTransform: '',
    originalTransition: '',
    originalWillChange: '',
    overlay: null,
    originalOverlayOpacity: '',
    originalOverlayTransition: '',
    onTouchStart: () => {},
    onTouchMove: () => {},
    onTouchEnd: () => {},
    onTouchCancel: () => {},
  }

  state.onTouchStart = (event: TouchEvent) => {
    if (state.options.disabled || event.touches.length !== 1) return

    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const ignoreSelector = state.options.ignoreSelector ?? DEFAULT_IGNORE_SELECTOR
    if (target.closest(ignoreSelector)) return

    const scrollElement = findScrollableAncestor(target, host)
    if (scrollElement && scrollElement.scrollTop > 0) return

    clearResetTimer(state)
    const touch = event.touches[0]
    state.tracking = true
    state.dragging = false
    state.startX = touch.clientX
    state.startY = touch.clientY
    state.distance = 0
    state.scrollElement = scrollElement
    state.samples = [{ y: touch.clientY, time: performance.now() }]
  }

  state.onTouchMove = (event: TouchEvent) => {
    if (!state.tracking || event.touches.length !== 1) return

    const touch = event.touches[0]
    const deltaX = touch.clientX - state.startX
    const deltaY = touch.clientY - state.startY

    if (!state.dragging) {
      if (Math.abs(deltaX) > INTENT_DISTANCE || Math.abs(deltaY) > INTENT_DISTANCE) {
        if (deltaY <= 0 || Math.abs(deltaX) >= Math.abs(deltaY)) {
          resetGesture(state)
          return
        }

        if (state.scrollElement && state.scrollElement.scrollTop > 0) {
          resetGesture(state)
          return
        }

        state.dragging = true
        state.originalTransform = host.style.transform
        state.originalTransition = host.style.transition
        state.originalWillChange = host.style.willChange
        state.overlay = findOverlay(host)
        state.originalOverlayOpacity = state.overlay?.style.opacity ?? ''
        state.originalOverlayTransition = state.overlay?.style.transition ?? ''

        host.style.transition = 'none'
        host.style.willChange = 'transform'
        host.classList.add('pull-to-dismiss--dragging')

        if (state.overlay) {
          state.overlay.style.transition = 'none'
        }
      } else {
        return
      }
    }

    event.preventDefault()
    state.distance = Math.max(0, deltaY)

    const now = performance.now()
    state.samples.push({ y: touch.clientY, time: now })
    state.samples = state.samples.filter(sample => now - sample.time <= 140)
    applyDragVisuals(host, state)
  }

  state.onTouchEnd = () => {
    if (!state.tracking) return

    if (!state.dragging) {
      resetGesture(state)
      return
    }

    const height = Math.max(host.offsetHeight, 1)
    const distanceThreshold = Math.min(150, Math.max(96, height * 0.2))
    const velocity = getReleaseVelocity(state.samples)
    const shouldDismiss =
      state.distance >= distanceThreshold ||
      (state.distance >= MIN_FLICK_DISTANCE && velocity >= DISMISS_VELOCITY)

    if (shouldDismiss) {
      resetGesture(state)
      state.options.onDismiss()
      scheduleStyleCleanup(host, state, 360)
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    host.style.transition = reducedMotion
      ? 'none'
      : `transform ${RETURN_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`
    host.style.transform = state.originalTransform || 'translate3d(0, 0, 0)'

    if (state.overlay) {
      state.overlay.style.transition = reducedMotion
        ? 'none'
        : `opacity ${RETURN_DURATION}ms ease-out`
      state.overlay.style.opacity = state.originalOverlayOpacity || '1'
    }

    resetGesture(state)
    scheduleStyleCleanup(host, state, reducedMotion ? 0 : RETURN_DURATION)
  }

  state.onTouchCancel = () => {
    if (!state.tracking) return
    state.distance = 0
    state.onTouchEnd()
  }

  host.addEventListener('touchstart', state.onTouchStart, { passive: true })
  host.addEventListener('touchmove', state.onTouchMove, { passive: false })
  host.addEventListener('touchend', state.onTouchEnd, { passive: true })
  host.addEventListener('touchcancel', state.onTouchCancel, { passive: true })
  host.classList.toggle('pull-to-dismiss', !state.options.disabled)
  states.set(el, state)

  return state
}

export const vPullToDismiss: Directive<HTMLElement, PullToDismissBinding> = {
  mounted(el, binding) {
    mountPullToDismiss(el, binding.value)
  },

  updated(el, binding) {
    const state = states.get(el)
    if (!state) return

    state.options = normalizeOptions(binding.value)
    state.host.classList.toggle('pull-to-dismiss', !state.options.disabled)
  },

  unmounted(el) {
    const state = states.get(el)
    if (!state) return

    clearResetTimer(state)
    state.host.removeEventListener('touchstart', state.onTouchStart)
    state.host.removeEventListener('touchmove', state.onTouchMove)
    state.host.removeEventListener('touchend', state.onTouchEnd)
    state.host.removeEventListener('touchcancel', state.onTouchCancel)
    restoreInlineStyles(state.host, state)
    state.host.classList.remove('pull-to-dismiss')
    states.delete(el)
  },
}
