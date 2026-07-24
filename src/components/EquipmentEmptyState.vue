<script setup lang="ts">
import { getEquipmentIcon } from '@/utils/equipmentIcon'

withDefaults(
  defineProps<{
    message: string
    actionLabel?: string
    compact?: boolean
  }>(),
  {
    actionLabel: '',
    compact: false,
  },
)

defineEmits<{
  action: []
}>()

const carouselItems = [
  { name: '蝴蝶机', icon: 'butterfly-machine', motion: 'butterfly' },
  { name: '徒手训练', icon: 'bodyweight', motion: 'bodyweight' },
  { name: '杠铃', icon: 'barbell', motion: 'barbell' },
] as const
</script>

<template>
  <div class="equipment-empty-state" :class="{ compact }">
    <div class="equipment-empty-visual" aria-hidden="true">
      <div
        v-for="(item, index) in carouselItems"
        :key="item.icon"
        class="equipment-empty-item"
        :class="[
          `equipment-empty-item--${index + 1}`,
          `equipment-empty-item--${item.motion}`,
        ]"
      >
        <img :src="getEquipmentIcon(item.icon)" alt="" />
        <span>{{ item.name }}</span>
      </div>
    </div>

    <p>{{ message }}</p>

    <button
      v-if="actionLabel"
      type="button"
      class="equipment-empty-action"
      @click="$emit('action')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.equipment-empty-state {
  display: flex;
  min-height: 168px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px 8px 8px;
}

.equipment-empty-visual {
  position: relative;
  width: 108px;
  height: 68px;
  margin-bottom: 2px;
}

.equipment-empty-item {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  opacity: 0;
  color: #636366;
  font-size: 11px;
  line-height: 16px;
  animation: equipment-empty-carousel 12s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.equipment-empty-item--1 {
  animation-delay: -600ms;
}

.equipment-empty-item--2 {
  animation-delay: 3.4s;
}

.equipment-empty-item--3 {
  animation-delay: 7.4s;
}

.equipment-empty-item img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg)
    brightness(102%) contrast(101%);
  transform-origin: center;
}

.equipment-empty-item--butterfly img {
  animation: equipment-empty-butterfly-motion 4.8s ease-in-out infinite;
}

.equipment-empty-item--bodyweight img {
  animation: equipment-empty-bodyweight-motion 4.8s ease-in-out infinite;
}

.equipment-empty-item--barbell img {
  animation: equipment-empty-barbell-motion 4.8s ease-in-out infinite;
}

.equipment-empty-state p {
  margin: 0 0 11px;
  color: #636366;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.equipment-empty-action {
  position: relative;
  display: inline-flex;
  min-width: 112px;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
  padding: 0 19px 0 13px;
  border: 0;
  border-radius: 19px;
  background: #eaf4ff;
  box-shadow:
    0 4px 14px rgba(0, 92, 190, 0.1),
    0 1px 2px rgba(30, 35, 45, 0.05);
  color: #1672c4;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.equipment-empty-action svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.equipment-empty-action::after {
  position: absolute;
  width: 32px;
  height: 64px;
  opacity: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.72),
    transparent
  );
  content: '';
  pointer-events: none;
  animation: equipment-empty-action-sheen 6s ease-in-out 1.2s infinite;
}

.equipment-empty-action:active {
  transform: scale(0.96);
  background: #dceeff;
}

.equipment-empty-state.compact {
  min-height: 110px;
  padding: 8px 0 2px;
}

.equipment-empty-state.compact .equipment-empty-visual {
  height: 56px;
  margin-bottom: 0;
}

.equipment-empty-state.compact .equipment-empty-item img {
  width: 30px;
  height: 30px;
}

.equipment-empty-state.compact p {
  margin-bottom: 5px;
  color: #8e8e93;
}

@keyframes equipment-empty-carousel {
  0% {
    opacity: 0;
    transform: translateY(5px) scale(0.96);
  }

  6%,
  27% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  33%,
  100% {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}

@keyframes equipment-empty-butterfly-motion {
  0%,
  100% {
    transform: translateY(1px) rotate(-1deg);
  }

  50% {
    transform: translateY(-1px) rotate(1deg);
  }
}

@keyframes equipment-empty-bodyweight-motion {
  0%,
  100% {
    transform: translateY(1px);
  }

  50% {
    transform: translateY(-2px);
  }
}

@keyframes equipment-empty-barbell-motion {
  0%,
  100% {
    transform: scaleX(0.98);
  }

  50% {
    transform: scaleX(1.04);
  }
}

@keyframes equipment-empty-action-sheen {
  0% {
    opacity: 0;
    transform: translateX(-70px) rotate(18deg);
  }

  4% {
    opacity: 0;
  }

  9% {
    opacity: 0.74;
  }

  19% {
    opacity: 0;
    transform: translateX(90px) rotate(18deg);
  }

  20%,
  100% {
    opacity: 0;
  }
}

@media (prefers-color-scheme: dark) {
  .equipment-empty-item,
  .equipment-empty-state p {
    color: #aeaeb2;
  }

  .equipment-empty-action {
    background: rgba(10, 132, 255, 0.16);
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.16),
      0 1px 2px rgba(0, 0, 0, 0.14);
    color: #64a9f3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .equipment-empty-item {
    display: none;
    animation: none;
  }

  .equipment-empty-item--1 {
    display: flex;
    opacity: 1;
    transform: none;
  }

  .equipment-empty-item img,
  .equipment-empty-action::after {
    animation: none;
  }
}
</style>
