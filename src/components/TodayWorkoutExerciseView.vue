<script setup lang="ts">
import {
  formatWorkoutItemTitle,
  type TodayWorkoutExerciseItem,
} from '@/utils/todayWorkoutViews'

defineProps<{
  items: TodayWorkoutExerciseItem[]
}>()

const emit = defineEmits<{
  open: [exerciseId: string]
  delete: [exerciseId: string]
}>()
</script>

<template>
  <div class="exercise-view">
    <van-swipe-cell v-for="item in items" :key="item.exerciseId">
      <article
        v-smooth-corners="18"
        class="exercise-record-card"
        @click="emit('open', item.exerciseId)"
      >
        <header class="exercise-record-header">
          <div v-smooth-corners="11" class="exercise-record-icon">
            <img
              v-if="item.equipmentIcon"
              :src="item.equipmentIcon"
              :alt="`${item.exerciseName}器械图标`"
            />
            <span v-else>🏋️</span>
          </div>
          <strong>{{ formatWorkoutItemTitle(item.exerciseName, item.equipmentName) }}</strong>
          <span v-if="item.muscleGroup" class="muscle-label">
            {{ item.muscleGroup }}
          </span>
        </header>

        <div class="exercise-set-list">
          <div
            v-for="(set, index) in item.sets"
            :key="set.record.id"
            class="exercise-set-row"
          >
            <span class="set-index">第{{ index + 1 }}组</span>
            <span class="set-detail">{{ set.detail }}</span>
          </div>
        </div>
      </article>

      <template #right>
        <van-button
          v-smooth-corners="18"
          class="delete-card-button"
          type="danger"
          text="删除"
          @click="emit('delete', item.exerciseId)"
        />
      </template>
    </van-swipe-cell>
  </div>
</template>

<style scoped>
.exercise-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.exercise-record-card {
  overflow: hidden;
  border: 1px solid rgba(60, 60, 67, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 3px 14px rgba(30, 35, 45, 0.045);
}

.exercise-record-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 10px 14px;
}

.exercise-record-header strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #1c1c1e;
  font-size: 16px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exercise-record-icon {
  display: flex;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: #f2f2f7;
  font-size: 19px;
}

.exercise-record-icon img {
  width: 27px;
  height: 27px;
  object-fit: contain;
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg)
    brightness(102%) contrast(101%);
}

.muscle-label {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 9px;
  background: rgba(0, 122, 255, 0.08);
  color: #007aff;
  font-size: 12px;
  font-weight: 500;
}

.exercise-set-list {
  padding: 0 14px 8px 62px;
}

.exercise-set-row {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  min-height: 36px;
  border-top: 1px solid rgba(60, 60, 67, 0.08);
  font-size: 14px;
}

.set-index {
  color: #8e8e93;
  font-size: 12px;
}

.set-detail {
  overflow: hidden;
  color: #3a3a3c;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-card-button {
  height: 100%;
  min-height: 100%;
  margin-left: 8px;
  padding: 0 22px;
  border-radius: 18px;
}

@media (prefers-color-scheme: dark) {
  .exercise-record-card {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(44, 44, 46, 0.94);
  }

  .exercise-record-header strong,
  .set-detail {
    color: #fff;
  }

  .exercise-record-icon {
    background: #3a3a3c;
  }

  .exercise-set-row {
    border-color: rgba(255, 255, 255, 0.08);
  }
}
</style>
