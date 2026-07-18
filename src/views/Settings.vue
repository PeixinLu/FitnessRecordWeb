<script setup lang="ts">
import { useRecordStore } from '@/stores/record'
import { useExerciseStore } from '@/stores/exercise'
import { showToast } from 'vant'
import { formatRecordDetail } from '@/utils/dataTemplate'
import PrimaryPageTitle from '@/components/PrimaryPageTitle.vue'

const recordStore = useRecordStore()
const exerciseStore = useExerciseStore()

// 导出为 JSON
function exportJSON() {
  const data = JSON.stringify(recordStore.records, null, 2)
  downloadFile(data, 'fitness-records.json', 'application/json')
  showToast('导出成功')
}

// 导出为 CSV
function exportCSV() {
  const headers = ['日期', '动作', '组数', '次数', '重量(kg)', '时长(分钟)', '距离(公里)', '备注']
  const rows = recordStore.records.map(r => [
    r.date,
    r.exerciseName,
    r.sets,
    r.reps ?? '',
    r.weight ?? '',
    r.duration ?? '',
    r.distance ?? '',
    r.notes || '',
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  downloadFile(csv, 'fitness-records.csv', 'text/csv')
  showToast('导出成功')
}

// 导出为文本
function exportText() {
  const lines = recordStore.records.map(r => {
    return `${r.date} ${r.exerciseName} ${formatRecordDetail(r)}`
  })
  const text = '=== 健身训练记录 ===\n\n' + lines.join('\n')
  downloadFile(text, 'fitness-records.txt', 'text/plain')
  showToast('导出成功')
}

// 下载文件
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 清空所有数据
async function clearAllData() {
  try {
    await showConfirmDialog({
      title: '警告',
      message: '确定要清空训练记录、常用器械和动作吗？此操作不可恢复！',
    })
    await exerciseStore.resetAllData()
    await recordStore.loadRecords()
    showToast('已重置')
  } catch {
    // 用户取消
  }
}

import { showConfirmDialog } from 'vant'
</script>

<template>
  <div class="settings-page">
    <PrimaryPageTitle title="设置" />

    <div class="primary-page-body">
      <van-cell-group inset title="导出数据">
      <van-cell title="导出 JSON" is-link @click="exportJSON">
        <template #icon>
          <van-icon name="description" />
        </template>
      </van-cell>
      <van-cell title="导出 CSV" is-link @click="exportCSV">
        <template #icon>
          <van-icon name="balance-list-o" />
        </template>
      </van-cell>
      <van-cell title="导出文本" is-link @click="exportText">
        <template #icon>
          <van-icon name="notes-o" />
        </template>
      </van-cell>
      </van-cell-group>

      <van-cell-group inset title="数据管理">
      <van-cell title="器械动作管理" is-link to="/equipment-management">
        <template #icon>
          <van-icon name="records-o" />
        </template>
      </van-cell>
      <van-cell title="训练记录数" :value="`${recordStore.records.length}条`" />
      <van-cell title="重置所有数据" is-link @click="clearAllData">
        <template #icon>
          <van-icon name="delete-o" color="#ee0a24" />
        </template>
      </van-cell>
      </van-cell-group>

      <van-cell-group inset title="关于">
      <van-cell title="版本" value="1.0.0" />
      <van-cell title="作者" value="Fitness Record" />
      </van-cell-group>

      <van-cell-group inset title="调试">
      <van-cell title="数字滚轮调试" is-link to="/debug/number-wheel">
        <template #icon>
          <van-icon name="setting-o" />
        </template>
      </van-cell>
      </van-cell-group>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 0;
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}

.primary-page-body {
  padding: 0 16px;
}
</style>
