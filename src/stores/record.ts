import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/db/database'
import type { WorkoutRecord } from '@/types'

export const useRecordStore = defineStore('record', () => {
  const records = ref<WorkoutRecord[]>([])
  const selectedDate = ref<string>(getTodayDate())

  // 获取今日日期 YYYY-MM-DD
  function getTodayDate(): string {
    const today = new Date()
    return formatDate(today)
  }

  // 格式化日期
  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  // 今日记录
  const todayRecords = computed(() =>
    records.value.filter(r => r.date === selectedDate.value)
  )

  // 某月所有有记录的日期
  function getDatesWithRecords(year: number, month: number): string[] {
    const dates: string[] = []
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    records.value.forEach(r => {
      if (r.date.startsWith(monthStr)) {
        dates.push(r.date)
      }
    })
    return [...new Set(dates)]
  }

  // 加载所有记录
  async function loadRecords() {
    records.value = await db.records.orderBy('createdAt').reverse().toArray()
  }

  // 添加记录
  async function addRecord(record: Omit<WorkoutRecord, 'id' | 'createdAt'>) {
    const newRecord: WorkoutRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
    }
    await db.records.add(newRecord)
    records.value.unshift(newRecord)
    return newRecord
  }

  // 删除记录
  async function deleteRecord(id: string) {
    await db.records.delete(id)
    records.value = records.value.filter(r => r.id !== id)
  }

  async function updateRecord(id: string, changes: Partial<Omit<WorkoutRecord, 'id' | 'createdAt'>>) {
    await db.records.update(id, changes)
    records.value = records.value.map(record =>
      record.id === id ? { ...record, ...changes } : record
    )
  }

  return {
    records,
    selectedDate,
    todayRecords,
    getTodayDate,
    formatDate,
    getDatesWithRecords,
    loadRecords,
    addRecord,
    deleteRecord,
    updateRecord,
  }
})
