<script setup lang="ts">
import { computed } from 'vue'
import { useRecordStore } from '@/stores/record'
import PrimaryPageHeader from '@/components/PrimaryPageHeader.vue'

const recordStore = useRecordStore()

// 统计数据
const stats = computed(() => {
  const records = recordStore.records

  // 本周训练次数
  const today = new Date()
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
  const weekRecords = records.filter(r => new Date(r.date) >= weekStart)

  // 本月训练次数
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthRecords = records.filter(r => new Date(r.date) >= monthStart)

  return {
    totalRecords: records.length,
    weekCount: weekRecords.length,
    monthCount: monthRecords.length,
  }
})
</script>

<template>
  <div class="statistics-page">
    <PrimaryPageHeader title="统计" />

    <div class="primary-page-body">
      <van-cell-group inset title="训练统计">
        <van-cell title="总记录数" :value="`${stats.totalRecords}条`" />
        <van-cell title="本周训练" :value="`${stats.weekCount}次`" />
        <van-cell title="本月训练" :value="`${stats.monthCount}次`" />
      </van-cell-group>

      <van-empty v-if="recordStore.records.length === 0" description="暂无统计数据" />
    </div>
  </div>
</template>

<style scoped>
.statistics-page {
  height: 100%;
  padding: 0;
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
  overflow-y: auto;
  background: #f5f5f7;
  -webkit-overflow-scrolling: touch;
}

.primary-page-body {
  padding: 0 16px;
}
</style>
