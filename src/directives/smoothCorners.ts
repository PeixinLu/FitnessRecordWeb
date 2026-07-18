import type { Directive } from 'vue'
import { smoothCornerStyle } from '@/utils/smoothCorners'

interface SmoothCornersState {
  observer: ResizeObserver | null
  rafId: number | null
  radius: number | string
  applied: boolean
}

function applyMask(el: HTMLElement, state: SmoothCornersState): void {
  const { width, height } = el.getBoundingClientRect()
  if (width === 0 || height === 0) return

  const style = smoothCornerStyle(width, height, state.radius)
  for (const [key, value] of Object.entries(style)) {
    ;(el.style as unknown as Record<string, string>)[key] = value
  }
  state.applied = true
}

function scheduleApply(el: HTMLElement, state: SmoothCornersState): void {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId)
  }
  state.rafId = requestAnimationFrame(() => {
    state.rafId = null
    applyMask(el, state)
  })
}

export const vSmoothCorners: Directive<HTMLElement, number | string> = {
  mounted(el, binding) {
    const radius = binding.value ?? 0
    const state: SmoothCornersState = {
      observer: null,
      rafId: null,
      radius,
      applied: false,
    }

    // 存储状态到元素上，供后续钩子使用
    ;(el as any).__smoothCorners = state

    // 首次应用
    applyMask(el, state)

    // 监听尺寸变化（旋转、窗口缩放等）
    state.observer = new ResizeObserver(() => {
      scheduleApply(el, state)
    })
    state.observer.observe(el)
  },

  updated(el, binding) {
    const state = (el as any).__smoothCorners as SmoothCornersState | undefined
    if (!state) return

    const newRadius = binding.value ?? 0
    if (newRadius !== state.radius) {
      state.radius = newRadius
      scheduleApply(el, state)
    }
  },

  unmounted(el) {
    const state = (el as any).__smoothCorners as SmoothCornersState | undefined
    if (!state) return

    if (state.observer) {
      state.observer.disconnect()
      state.observer = null
    }
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId)
      state.rafId = null
    }

    // 清理 style
    el.style.maskImage = ''
    el.style.webkitMaskImage = ''
    el.style.maskSize = ''
    el.style.webkitMaskSize = ''
    el.style.maskRepeat = ''
    el.style.webkitMaskRepeat = ''
    el.style.maskPosition = ''
    el.style.webkitMaskPosition = ''

    delete (el as any).__smoothCorners
  },
}
