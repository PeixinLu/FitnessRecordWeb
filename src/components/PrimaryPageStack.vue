<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, type Component } from 'vue'
import Home from '@/views/Home.vue'
import Calendar from '@/views/Calendar.vue'
import Statistics from '@/views/Statistics.vue'
import Settings from '@/views/Settings.vue'
import {
  activateCard,
  createCardStackState,
  finishCardRecall,
  getCardVisualState,
  toggleStack,
  type CardStackState,
} from '@/utils/cardStack'

interface PrimaryPage {
  label: string
  component: Component
}

const pages: PrimaryPage[] = [
  { label: '记录', component: Home },
  { label: '日历', component: Calendar },
  { label: '统计', component: Statistics },
  { label: '设置', component: Settings },
]

const FOREGROUND_TRANSITION_SECONDS = 0.3
const RECALL_MIN_LOCK_MS = 300
const RECALL_FALLBACK_MS = 450
const stackState = ref<CardStackState>(createCardStackState())
const cardStage = ref<HTMLElement | null>(null)
const stackFab = ref<HTMLButtonElement | null>(null)
let recallFallbackTimer: ReturnType<typeof window.setTimeout> | undefined
let recallLockedUntil = 0
const cardStates = computed(() =>
  pages.map((_, index) => getCardVisualState(index, pages.length, stackState.value)),
)

function clearRecallFallback() {
  if (recallFallbackTimer === undefined) return
  window.clearTimeout(recallFallbackTimer)
  recallFallbackTimer = undefined
}

function finishRecall() {
  if (!stackState.value.isSettling) return
  if (Date.now() < recallLockedUntil) return
  clearRecallFallback()
  recallLockedUntil = 0
  stackState.value = finishCardRecall(stackState.value)
}

function scheduleRecallFallback() {
  clearRecallFallback()
  recallLockedUntil = Date.now() + RECALL_MIN_LOCK_MS
  recallFallbackTimer = window.setTimeout(finishRecall, RECALL_FALLBACK_MS)
}

function toggleStackMode() {
  if (stackState.value.isSettling) return
  const wasStacked = stackState.value.isStacked
  stackState.value = toggleStack(stackState.value)

  if (wasStacked) {
    scheduleRecallFallback()
    return
  }

  nextTick(() => {
    const recallButtons = cardStage.value?.querySelectorAll<HTMLButtonElement>('.card-recall.enabled')
    recallButtons?.[stackState.value.activeIndex]?.focus()
  })
}

function activatePage(index: number) {
  if (!stackState.value.isStacked || stackState.value.isSettling) return
  stackFab.value?.focus()
  stackState.value = activateCard(stackState.value, index, pages.length)
  scheduleRecallFallback()
}

function handleStagePointerDown(event: PointerEvent) {
  if (!stackState.value.isSettling) return
  event.preventDefault()
  event.stopPropagation()
  stackFab.value?.focus()
}

function handleCardTransitionEnd(event: TransitionEvent, index: number) {
  if (
    event.target !== event.currentTarget ||
    event.propertyName !== 'transform' ||
    Math.abs(event.elapsedTime - FOREGROUND_TRANSITION_SECONDS) > 0.01 ||
    index !== stackState.value.activeIndex
  ) {
    return
  }
  finishRecall()
}

onBeforeUnmount(clearRecallFallback)
</script>

<template>
  <section
    ref="cardStage"
    class="card-stage"
    :class="{ stacked: stackState.isStacked }"
    @pointerdown.capture="handleStagePointerDown"
  >
    <article
      v-for="(page, index) in pages"
      :key="page.label"
      class="stack-card"
      :class="{ foreground: cardStates[index].isForeground }"
      :style="cardStates[index].style"
      @transitionend="handleCardTransitionEnd($event, index)"
    >
      <div
        class="card-page-content"
        :class="{ blocked: !cardStates[index].contentInteractive }"
        :inert="!cardStates[index].contentInteractive"
        :aria-hidden="!cardStates[index].contentInteractive"
      >
        <component :is="page.component" />
      </div>

      <button
        type="button"
        class="card-recall"
        :class="{
          enabled: cardStates[index].recallInteractive,
          guarding: cardStates[index].guardInteractive,
        }"
        :aria-label="`打开${page.label}页面`"
        :aria-hidden="!cardStates[index].recallInteractive"
        :tabindex="cardStates[index].recallInteractive ? 0 : -1"
        @click.stop="activatePage(index)"
      />
    </article>

    <button
      ref="stackFab"
      type="button"
      class="stack-fab"
      :aria-label="stackState.isStacked ? '恢复当前页面' : '显示页面堆栈'"
      :aria-expanded="stackState.isStacked"
      @click="toggleStackMode"
    >
      <span class="stack-fab-icon" :class="{ up: stackState.isStacked }" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
.card-stage {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #000;
  perspective: none;
}

.stack-card {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f7;
  transform-origin: top;
  transform-style: preserve-3d;
}

.card-page-content {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.card-page-content.blocked {
  pointer-events: none;
  user-select: none;
}

.card-recall {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  pointer-events: none;
}

.card-recall.enabled {
  cursor: pointer;
  pointer-events: auto;
}

.card-recall.guarding {
  cursor: wait;
  pointer-events: auto;
}

.card-recall.enabled:focus-visible {
  outline: 3px solid #0a84ff;
  outline-offset: -5px;
}

.stack-fab {
  position: fixed;
  right: calc(24px + env(safe-area-inset-right));
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #1a1a1a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  color: #fff;
}

.stack-fab-icon {
  position: relative;
  width: 24px;
  height: 24px;
}

.stack-fab-icon::before,
.stack-fab-icon::after {
  position: absolute;
  left: 50%;
  width: 10px;
  height: 10px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  content: '';
  transform: translateX(-50%) rotate(45deg);
  transition: transform 0.3s;
}

.stack-fab-icon::before {
  top: 0;
}

.stack-fab-icon::after {
  top: 6px;
}

.stack-fab-icon.up::before,
.stack-fab-icon.up::after {
  transform: translateX(-50%) rotate(-135deg);
}

@media (prefers-reduced-motion: reduce) {
  .stack-card,
  .stack-fab-icon::before,
  .stack-fab-icon::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
