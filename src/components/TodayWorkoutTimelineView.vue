<script setup lang="ts">
import {
  formatWorkoutItemTitle,
  type TodayWorkoutTimelineItem,
} from '@/utils/todayWorkoutViews'

defineProps<{
  items: TodayWorkoutTimelineItem[]
}>()

const emit = defineEmits<{
  open: [exerciseId: string]
  delete: [recordId: string]
}>()
</script>

<template>
  <div class="timeline-view">
    <div
      v-for="item in items"
      :key="item.record.id"
      class="timeline-entry"
    >
      <div class="timeline-marker" aria-hidden="true">
        <i />
      </div>

      <van-swipe-cell class="timeline-swipe-cell">
        <article
          v-smooth-corners="16"
          class="timeline-record-card"
          @click="emit('open', item.exerciseId)"
        >
          <div v-smooth-corners="10" class="timeline-record-icon">
            <img
              v-if="item.equipmentIcon"
              :src="item.equipmentIcon"
              :alt="`${item.exerciseName}器械图标`"
            />
            <span v-else>🏋️</span>
          </div>
          <div class="timeline-record-main">
            <div class="timeline-record-title">
              <strong>{{ formatWorkoutItemTitle(item.exerciseName, item.equipmentName) }}</strong>
              <span v-if="item.muscleGroup">{{ item.muscleGroup }}</span>
            </div>
            <div class="timeline-record-detail">{{ item.detail }}</div>
          </div>
          <time :datetime="new Date(item.record.createdAt).toISOString()">
            {{ item.savedTime }}
          </time>
        </article>

        <template #right>
          <van-button
            v-smooth-corners="16"
            class="delete-timeline-button"
            type="danger"
            text="删除"
            @click="emit('delete', item.record.id)"
          />
        </template>
      </van-swipe-cell>
    </div>
  </div>
</template>

<style scoped>
.timeline-view {
  display: flex;
  flex-direction: column;
}

.timeline-entry {
  position: relative;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
}

.timeline-marker {
  position: relative;
  display: flex;
  justify-content: center;
  padding-top: 29px;
}

.timeline-marker::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: rgba(0, 122, 255, 0.18);
  content: '';
}

.timeline-entry:first-child .timeline-marker::after {
  top: 32px;
}

.timeline-entry:last-child .timeline-marker::after {
  bottom: calc(100% - 32px);
}

.timeline-marker i {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  border: 2px solid #f5f5f7;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.66);
  box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.16);
}

.timeline-swipe-cell {
  min-width: 0;
  margin-bottom: 9px;
}

.timeline-record-card {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(60, 60, 67, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
}

.timeline-record-icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f2f2f7;
  font-size: 18px;
}

.timeline-record-icon img {
  width: 25px;
  height: 25px;
  object-fit: contain;
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg)
    brightness(102%) contrast(101%);
}

.timeline-record-main {
  flex: 1;
  min-width: 0;
}

.timeline-record-title {
  display: flex;
  align-items: center;
  gap: 7px;
}

.timeline-record-title strong {
  overflow: hidden;
  color: #1c1c1e;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-record-title span {
  flex: 0 0 auto;
  color: rgba(0, 122, 255, 0.65);
  font-size: 11px;
}

.timeline-record-detail {
  overflow: hidden;
  margin-top: 3px;
  color: #636366;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-record-card time {
  align-self: flex-start;
  padding-top: 3px;
  color: rgba(99, 99, 102, 0.45);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.delete-timeline-button {
  height: 100%;
  min-height: 100%;
  margin-left: 8px;
  padding: 0 20px;
  border-radius: 16px;
}

@media (prefers-color-scheme: dark) {
  .timeline-marker i {
    border-color: #1c1c1e;
  }

  .timeline-record-card {
    border-color: rgba(255, 255, 255, 0.07);
    background: rgba(44, 44, 46, 0.9);
  }

  .timeline-record-icon {
    background: #3a3a3c;
  }

  .timeline-record-title strong {
    color: #fff;
  }

  .timeline-record-detail {
    color: #aeaeb2;
  }
}
</style>
