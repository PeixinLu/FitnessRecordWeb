<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRecordStore } from '@/stores/record'
import { useExerciseStore } from '@/stores/exercise'
import { formatRecordDetail } from '@/utils/dataTemplate'
import PrimaryPageHeader from '@/components/PrimaryPageHeader.vue'

const recordStore = useRecordStore()
const exerciseStore = useExerciseStore()

const currentDate = ref(new Date())
const selectedDate = ref(recordStore.getTodayDate())

interface CalendarDay {
  dayNum: number
  date: string
  dateObj: Date
  isToday: boolean
}

// 计算日历格子
function getCalendarDays(currentDate: Date): (CalendarDay | null)[] {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const today = new Date()

  const days: (CalendarDay | null)[] = []

  // 前面空格子（周日为第一天）
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null)
  }

  // 实际日期
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(year, month, d)
    const isToday =
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    days.push({
      dayNum: d,
      date: dateObj.toISOString().split('T')[0],
      dateObj,
      isToday,
    })
  }

  // 后面空格子（凑满 6 行 = 42 格）
  const remaining = 42 - days.length
  for (let i = 0; i < remaining; i++) {
    days.push(null)
  }

  return days
}

// 计算属性：日历格子
const calendarDays = computed(() => getCalendarDays(currentDate.value))

// 格式化月份显示
const monthTitle = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  return `${year}年${month}月`
})

// 有记录的日期
const datesWithRecords = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  return recordStore.getDatesWithRecords(year, month)
})

const selectedDateRecords = computed(() =>
  recordStore.records.filter(record => record.date === selectedDate.value)
)

const groupedSelectedDateRecords = computed(() => {
  const groups = new Map<string, typeof recordStore.records>()
  selectedDateRecords.value.forEach(record => {
    groups.set(record.exerciseId, [...(groups.get(record.exerciseId) ?? []), record])
  })
  return [...groups.values()]
})

// 月份导航
function prevMonth() {
  changeMonth(-1)
}

function nextMonth() {
  changeMonth(1)
}

function changeMonth(offset: number) {
  const nextMonth = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + offset, 1)
  currentDate.value = nextMonth
  const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
  if (!selectedDate.value.startsWith(nextMonthKey)) {
    selectedDate.value = recordStore.formatDate(nextMonth)
  }
}

// 日期是否有记录
function hasRecord(date: string): boolean {
  return datesWithRecords.value.includes(date)
}

// 点击日期
function onSelectDate(date: Date) {
  selectedDate.value = recordStore.formatDate(date)
}

function getMuscleGroup(exerciseId: string): string {
  return exerciseStore.exercises.find(exercise => exercise.id === exerciseId)?.muscleGroup ?? ''
}
</script>

<template>
  <div class="calendar-page">
    <PrimaryPageHeader title="日历" />

    <div class="primary-page-body">
      <!-- 月份导航 -->
      <van-cell-group inset>
      <van-cell center>
        <template #title>
          <div class="month-nav">
            <van-button size="small" icon="arrow-left" @click="prevMonth" />
            <span class="month-title">{{ monthTitle }}</span>
            <van-button size="small" icon="arrow" @click="nextMonth" />
          </div>
        </template>
      </van-cell>
      </van-cell-group>

    <!-- 日历网格 -->
      <van-cell-group inset>
      <div class="calendar-grid">
        <!-- 星期标题 -->
        <div class="weekday">日</div>
        <div class="weekday">一</div>
        <div class="weekday">二</div>
        <div class="weekday">三</div>
        <div class="weekday">四</div>
        <div class="weekday">五</div>
        <div class="weekday">六</div>

        <!-- 日期格子 -->
        <template v-for="(day, index) in calendarDays" :key="index">
          <div
            v-if="day"
            v-smooth-corners="8"
            class="day-cell"
            :class="{ 'has-record': hasRecord(day.date), 'is-today': day.isToday, 'is-selected': day.date === selectedDate }"
            @click="onSelectDate(day.dateObj)"
          >
            {{ day.dayNum }}
            <div v-if="hasRecord(day.date)" class="record-dot"></div>
          </div>
          <div v-else v-smooth-corners="8" class="day-cell empty"></div>
        </template>
      </div>
      </van-cell-group>

    <!-- 统计摘要 -->
      <van-cell-group inset title="本月统计">
      <van-cell title="训练天数" :value="`${datesWithRecords.length}天`" />
      <van-cell title="训练次数" :value="`${recordStore.records.filter(r => datesWithRecords.includes(r.date)).length}次`" />
      </van-cell-group>

      <van-cell-group inset title="当日训练">
      <div class="selected-date">{{ selectedDate }}</div>
      <van-empty v-if="groupedSelectedDateRecords.length === 0" description="当天暂无训练记录" />
      <van-cell
        v-for="records in groupedSelectedDateRecords"
        :key="records[0].exerciseId"
        :title="records[0].exerciseName"
        :value="`${records.length}组`"
      >
        <template #label>
          <div class="exercise-summary">
            <van-tag v-if="getMuscleGroup(records[0].exerciseId)" type="primary" plain>
              {{ getMuscleGroup(records[0].exerciseId) }}
            </van-tag>
            <span>{{ records.map(record => formatRecordDetail(record)).join(' · ') }}</span>
          </div>
        </template>
      </van-cell>
      </van-cell-group>
    </div>
  </div>
</template>

<style scoped>
.calendar-page {
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

.month-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.month-title {
  font-size: 18px;
  font-weight: bold;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  padding: 16px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  color: #969799;
  padding: 8px 0;
}

.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.day-cell:hover {
  background: #f2f3f5;
}

.day-cell.empty {
  background: transparent;
}

.day-cell.is-today {
  background: #1989fa;
  color: #fff;
}

.day-cell.has-record {
  position: relative;
}

.day-cell.is-selected {
  background: rgba(25, 137, 250, 0.12);
  color: #1989fa;
}

.record-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #07c160;
  margin-top: 2px;
}

.day-cell.is-today .record-dot {
  background: #fff;
}

.exercise-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-date {
  padding: 4px 16px 12px;
  color: #969799;
  font-size: 13px;
}
</style>
