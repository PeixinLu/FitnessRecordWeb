<script setup lang="ts">
import { computed } from 'vue'
import { useRecordStore } from '@/stores/record'
import { useExerciseStore } from '@/stores/exercise'
import { showConfirmDialog, showToast } from 'vant'
import { formatRecordDetail } from '@/utils/dataTemplate'

const recordStore = useRecordStore()
const exerciseStore = useExerciseStore()

// 按日期分组
const groupedRecords = computed(() => {
  const groups: Record<string, typeof recordStore.records> = {}
  recordStore.records.forEach(record => {
    if (!groups[record.date]) {
      groups[record.date] = []
    }
    groups[record.date].push(record)
  })
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
})

// 删除记录
async function deleteRecord(id: string) {
  try {
    await showConfirmDialog({ title: '确认删除', message: '确定要删除这条记录吗？' })
    await recordStore.deleteRecord(id)
    showToast('已删除')
  } catch {
    // 用户取消
  }
}

// 获取肌群标签
function getMuscleGroup(exerciseId: string): string {
  const exercise = exerciseStore.exercises.find(e => e.id === exerciseId)
  return exercise?.muscleGroup || ''
}
</script>

<template>
  <div class="history-page">
    <van-empty v-if="recordStore.records.length === 0" description="暂无训练记录" />
    <div v-else>
      <van-cell-group v-for="[date, records] in groupedRecords" :key="date" inset :title="date">
        <van-swipe-cell v-for="record in records" :key="record.id">
          <van-cell :title="record.exerciseName">
            <template #label>
              {{ formatRecordDetail(record) }}
            </template>
            <template #value>
              <van-tag type="primary">{{ getMuscleGroup(record.exerciseId) }}</van-tag>
            </template>
          </van-cell>
          <template #right>
            <van-button square type="danger" text="删除" @click="deleteRecord(record.id)" />
          </template>
        </van-swipe-cell>
      </van-cell-group>
    </div>
  </div>
</template>

<style scoped>
.history-page {
  padding: 16px;
  padding-bottom: 60px;
}
</style>
