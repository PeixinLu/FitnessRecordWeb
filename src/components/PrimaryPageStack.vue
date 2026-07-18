<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import Home from '@/views/Home.vue'
import Calendar from '@/views/Calendar.vue'
import Statistics from '@/views/Statistics.vue'
import Settings from '@/views/Settings.vue'
import {
  activateCard,
  createCardStackState,
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

const stackState = ref<CardStackState>(createCardStackState())
const cardStates = computed(() =>
  pages.map((_, index) => getCardVisualState(index, pages.length, stackState.value)),
)

function toggleStackMode() {
  stackState.value = toggleStack(stackState.value)
}

function activatePage(index: number) {
  if (!stackState.value.isStacked) return
  stackState.value = activateCard(stackState.value, index, pages.length)
}
</script>

<template>
  <section class="card-stage" :class="{ stacked: stackState.isStacked }">
    <article
      v-for="(page, index) in pages"
      :key="page.label"
      class="stack-card"
      :class="{ foreground: cardStates[index].isForeground }"
      :style="cardStates[index].style"
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
        :class="{ enabled: cardStates[index].recallInteractive }"
        :aria-label="`打开${page.label}页面`"
        :aria-hidden="!cardStates[index].recallInteractive"
        :tabindex="cardStates[index].recallInteractive ? 0 : -1"
        @click.stop="activatePage(index)"
      />
    </article>

    <button
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
