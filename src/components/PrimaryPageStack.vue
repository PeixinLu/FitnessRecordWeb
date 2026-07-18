<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type Component,
} from "vue";
import Home from "@/views/Home.vue";
import Calendar from "@/views/Calendar.vue";
import Statistics from "@/views/Statistics.vue";
import Settings from "@/views/Settings.vue";
import {
  activateCard,
  createCardStackState,
  finishCardRecall,
  getCardVisualState,
  toggleStack,
  type CardStackState,
} from "@/utils/cardStack";

interface PrimaryPage {
  label: string;
  component: Component;
}

type EnvironmentColor = readonly [number, number, number];

const pages: PrimaryPage[] = [
  { label: "记录", component: Home },
  { label: "日历", component: Calendar },
  { label: "统计", component: Statistics },
  { label: "设置", component: Settings },
];

const FOREGROUND_TRANSITION_SECONDS = 0.3;
const RECALL_MIN_LOCK_MS = 300;
const RECALL_FALLBACK_MS = 450;
const ENVIRONMENT_TRANSITION_MS = 280;
const PAGE_ENVIRONMENT_COLOR: EnvironmentColor = [245, 245, 247];
const STACK_ENVIRONMENT_COLOR: EnvironmentColor = [0, 0, 0];
const stackState = ref<CardStackState>(createCardStackState());
const cardStage = ref<HTMLElement | null>(null);
const stackFab = ref<HTMLButtonElement | null>(null);
const themeColorMeta = document.querySelector<HTMLMetaElement>(
  'meta[name="theme-color"]',
);
let recallFallbackTimer: ReturnType<typeof window.setTimeout> | undefined;
let environmentAnimationFrame: number | undefined;
let environmentColor = PAGE_ENVIRONMENT_COLOR;
let recallLockedUntil = 0;
const cardStates = computed(() =>
  pages.map((_, index) =>
    getCardVisualState(index, pages.length, stackState.value),
  ),
);
const usesStackEnvironment = computed(
  () => stackState.value.isStacked,
);

function cancelEnvironmentAnimation() {
  if (environmentAnimationFrame === undefined) return;
  window.cancelAnimationFrame(environmentAnimationFrame);
  environmentAnimationFrame = undefined;
}

function applyThemeColor(color: EnvironmentColor) {
  environmentColor = color;
  themeColorMeta?.setAttribute("content", `rgb(${color.join(", ")})`);
}

function animateThemeColor(targetColor: EnvironmentColor) {
  cancelEnvironmentAnimation();

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    environmentColor.every((channel, index) => channel === targetColor[index])
  ) {
    applyThemeColor(targetColor);
    return;
  }

  const startColor = environmentColor;
  const startedAt = performance.now();

  function updateThemeColor(timestamp: number) {
    const progress = Math.min(
      (timestamp - startedAt) / ENVIRONMENT_TRANSITION_MS,
      1,
    );
    const easedProgress = progress * progress * (3 - 2 * progress);
    const nextColor: EnvironmentColor = [
      Math.round(
        startColor[0] + (targetColor[0] - startColor[0]) * easedProgress,
      ),
      Math.round(
        startColor[1] + (targetColor[1] - startColor[1]) * easedProgress,
      ),
      Math.round(
        startColor[2] + (targetColor[2] - startColor[2]) * easedProgress,
      ),
    ];

    applyThemeColor(nextColor);

    if (progress < 1) {
      environmentAnimationFrame = window.requestAnimationFrame(updateThemeColor);
      return;
    }

    environmentAnimationFrame = undefined;
  }

  environmentAnimationFrame = window.requestAnimationFrame(updateThemeColor);
}

function syncBrowserEnvironment(active: boolean) {
  document.documentElement.classList.toggle("stack-environment", active);
  animateThemeColor(
    active ? STACK_ENVIRONMENT_COLOR : PAGE_ENVIRONMENT_COLOR,
  );
}

function resetBrowserEnvironment() {
  cancelEnvironmentAnimation();
  document.documentElement.classList.remove("stack-environment");
  applyThemeColor(PAGE_ENVIRONMENT_COLOR);
}

watch(
  usesStackEnvironment,
  (active) => syncBrowserEnvironment(active),
  { immediate: true },
);

function clearRecallFallback() {
  if (recallFallbackTimer === undefined) return;
  window.clearTimeout(recallFallbackTimer);
  recallFallbackTimer = undefined;
}

function finishRecall() {
  if (!stackState.value.isSettling) return;
  if (Date.now() < recallLockedUntil) return;
  clearRecallFallback();
  recallLockedUntil = 0;
  stackState.value = finishCardRecall(stackState.value);
}

function scheduleRecallFallback() {
  clearRecallFallback();
  recallLockedUntil = Date.now() + RECALL_MIN_LOCK_MS;
  recallFallbackTimer = window.setTimeout(finishRecall, RECALL_FALLBACK_MS);
}

function toggleStackMode() {
  if (stackState.value.isSettling) return;
  const wasStacked = stackState.value.isStacked;
  stackState.value = toggleStack(stackState.value);

  if (wasStacked) {
    scheduleRecallFallback();
    return;
  }

  nextTick(() => {
    const recallButtons = cardStage.value?.querySelectorAll<HTMLButtonElement>(
      ".card-recall.enabled",
    );
    recallButtons?.[stackState.value.activeIndex]?.focus();
  });
}

function activatePage(index: number) {
  if (!stackState.value.isStacked || stackState.value.isSettling) return;
  stackFab.value?.focus();
  stackState.value = activateCard(stackState.value, index, pages.length);
  scheduleRecallFallback();
}

function handleStagePointerDown(event: PointerEvent) {
  if (!stackState.value.isSettling) return;
  event.preventDefault();
  event.stopPropagation();
  stackFab.value?.focus();
}

function handleCardTransitionEnd(event: TransitionEvent, index: number) {
  if (
    event.target !== event.currentTarget ||
    event.propertyName !== "transform" ||
    Math.abs(event.elapsedTime - FOREGROUND_TRANSITION_SECONDS) > 0.01 ||
    index !== stackState.value.activeIndex
  ) {
    return;
  }
  finishRecall();
}

onBeforeUnmount(() => {
  clearRecallFallback();
  resetBrowserEnvironment();
});
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
      :class="{ stacked: stackState.isStacked }"
      :aria-label="stackState.isStacked ? '恢复当前页面' : '显示页面堆栈'"
      :aria-expanded="stackState.isStacked"
      @click="toggleStackMode"
    >
      <span class="stack-tabs-icon" aria-hidden="true">
        <span class="stack-tabs-icon-back" />
        <span class="stack-tabs-icon-front" />
      </span>
      <span class="stack-back-icon" aria-hidden="true" />
    </button>
  </section>
</template>

<style scoped>
.card-stage {
  position: relative;
  width: 100vw;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  background-color: var(--app-environment-color);
  perspective: none;
  transition: background-color var(--app-environment-transition-duration) ease;
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
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.card-page-content.blocked {
  overflow: hidden;
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
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    0 8px 28px rgba(31, 31, 35, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  color: #3a3a3c;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  transition:
    opacity 0.3s ease,
    background-color 0.3s ease,
    transform 0.3s ease;
}

.stack-fab.stacked {
  background: rgba(255, 255, 255, 0.74);
  opacity: 0.82;
}

.stack-tabs-icon,
.stack-back-icon {
  position: absolute;
  transition:
    opacity 0.25s ease,
    transform 0.3s ease;
}

.stack-tabs-icon {
  width: 25px;
  height: 25px;
  opacity: 1;
}

.stack-tabs-icon-back,
.stack-tabs-icon-front {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-radius: 4px;
}

.stack-tabs-icon-back {
  top: 2px;
  left: 2px;
  opacity: 0.42;
  border-radius: 5px;
}

.stack-tabs-icon-front {
  right: 2px;
  bottom: 2px;
  background: rgba(255, 255, 255, 1);
}

.stack-back-icon {
  width: 13px;
  height: 13px;
  border-bottom: 2px solid currentColor;
  border-left: 2px solid currentColor;
  border-radius: 0 4px 0 0;
  opacity: 0;
  transform: translateX(4px) rotate(45deg);
}

.stack-fab.stacked .stack-tabs-icon {
  opacity: 0;
  transform: scale(0.82);
}

.stack-fab.stacked .stack-back-icon {
  opacity: 1;
  transform: translateX(2px) rotate(45deg);
}

@media (prefers-reduced-motion: reduce) {
  .card-stage,
  .stack-card,
  .stack-fab,
  .stack-tabs-icon,
  .stack-back-icon {
    transition-duration: 0.01ms !important;
  }
}
</style>
