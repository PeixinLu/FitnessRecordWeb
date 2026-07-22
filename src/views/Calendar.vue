<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  showConfirmDialog,
  showToast,
  type SwipeInstance,
} from 'vant'
import ImmersiveSheet from '@/components/ImmersiveSheet.vue'
import PrimaryPageHeader from '@/components/PrimaryPageHeader.vue'
import TodayWorkoutExerciseView from '@/components/TodayWorkoutExerciseView.vue'
import TodayWorkoutTimelineView from '@/components/TodayWorkoutTimelineView.vue'
import { useExerciseStore } from '@/stores/exercise'
import { useRecordStore } from '@/stores/record'
import { formatLocalDate } from '@/utils/date'
import {
  buildTodayWorkoutExerciseItems,
  buildTodayWorkoutTimelineItems,
  type TodayWorkoutViewMode,
} from '@/utils/todayWorkoutViews'
import {
  groupRecordsByExercise,
  type WorkoutGroup,
} from '@/utils/workoutGroups'
import WorkoutDetail from '@/views/WorkoutDetail.vue'

type CalendarView = 'week' | 'month'

interface CalendarDay {
  date: string
  dateObj: Date
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
}

const calendarPageCenter = 60
const calendarPageOffsets = Array.from(
  { length: calendarPageCenter * 2 + 1 },
  (_, index) => index - calendarPageCenter,
)
const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']

const recordStore = useRecordStore()
const exerciseStore = useExerciseStore()
const today = startOfDay(new Date())
const todayDate = formatLocalDate(today)
const workoutViewStorageKey = 'fitness-record-today-workout-view'

const calendarView = ref<CalendarView>('month')
const calendarOrigin = ref(today)
const calendarPageIndex = ref(calendarPageCenter)
const calendarSwipeRef = ref<SwipeInstance>()
const selectedDate = ref(todayDate)
const workoutView = ref<TodayWorkoutViewMode>(getInitialWorkoutView())
const showWorkoutDetail = ref(false)
const selectedWorkoutExerciseId = ref('')
const isNestedEditorOpen = ref(false)

function getInitialWorkoutView(): TodayWorkoutViewMode {
  try {
    return localStorage.getItem(workoutViewStorageKey) === 'timeline'
      ? 'timeline'
      : 'exercise'
  } catch {
    return 'exercise'
  }
}

watch(workoutView, (view) => {
  try {
    localStorage.setItem(workoutViewStorageKey, view)
  } catch {
    // Safari 隐私模式下存储可能不可用，不影响本次切换。
  }
})

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseDateKey(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function addMonths(date: Date, amount: number): Date {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + amount, 1)
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
  ).getDate()
  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(date.getDate(), lastDay),
  )
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay())
}

function getPageDate(offset: number): Date {
  return calendarView.value === 'month'
    ? addMonths(calendarOrigin.value, offset)
    : addDays(calendarOrigin.value, offset * 7)
}

function getMonthDays(pageDate: Date): CalendarDay[] {
  const year = pageDate.getFullYear()
  const month = pageDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const gridStart = addDays(firstDay, -firstDay.getDay())
  const cellCount = Math.ceil((firstDay.getDay() + lastDay.getDate()) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const dateObj = addDays(gridStart, index)
    const date = formatLocalDate(dateObj)
    return {
      date,
      dateObj,
      dayNumber: dateObj.getDate(),
      isCurrentMonth: dateObj.getMonth() === month,
      isToday: date === todayDate,
    }
  })
}

function getWeekDays(pageDate: Date): CalendarDay[] {
  const weekStart = startOfWeek(pageDate)
  return Array.from({ length: 7 }, (_, index) => {
    const dateObj = addDays(weekStart, index)
    const date = formatLocalDate(dateObj)
    return {
      date,
      dateObj,
      dayNumber: dateObj.getDate(),
      isCurrentMonth: true,
      isToday: date === todayDate,
    }
  })
}

function getCalendarDays(pageDate: Date): CalendarDay[] {
  return calendarView.value === 'month'
    ? getMonthDays(pageDate)
    : getWeekDays(pageDate)
}

const calendarPages = computed(() =>
  calendarPageOffsets.map((offset) => {
    const pageDate = getPageDate(offset)
    return {
      key: `${calendarView.value}-${formatLocalDate(pageDate)}`,
      days: getCalendarDays(pageDate),
    }
  }),
)

const visiblePageDate = computed(() =>
  getPageDate(calendarPageIndex.value - calendarPageCenter),
)

const calendarTitle = computed(() => {
  if (calendarView.value === 'month') {
    return `${visiblePageDate.value.getFullYear()}年${visiblePageDate.value.getMonth() + 1}月`
  }
  const start = startOfWeek(visiblePageDate.value)
  const end = addDays(start, 6)
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日–${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`
  }
  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}–${end.getDate()}日`
})

const datesWithRecords = computed(
  () => new Set(recordStore.records.map((record) => record.date)),
)

const selectedDateRecords = computed(() =>
  recordStore.records
    .filter((record) => record.date === selectedDate.value)
    .sort((left, right) => right.createdAt - left.createdAt),
)

const selectedWorkoutItems = computed(() =>
  buildTodayWorkoutExerciseItems(
    selectedDateRecords.value,
    exerciseStore.exercises,
    exerciseStore.equipments,
  ),
)

const selectedWorkoutTimelineItems = computed(() =>
  buildTodayWorkoutTimelineItems(
    selectedDateRecords.value,
    exerciseStore.exercises,
    exerciseStore.equipments,
  ),
)

const selectedWorkoutCount = computed(() =>
  workoutView.value === 'timeline'
    ? `${selectedDateRecords.value.length}组`
    : `${selectedWorkoutItems.value.length}个动作`,
)

const selectedWorkoutGroups = computed(() =>
  groupRecordsByExercise(selectedDateRecords.value),
)

const selectedWorkoutGroup = computed(() =>
  selectedWorkoutGroups.value.find(
    (group) => group.exerciseId === selectedWorkoutExerciseId.value,
  ),
)

const selectedWorkoutTitle = computed(() => {
  const group = selectedWorkoutGroup.value
  return group ? `${group.exerciseName} · ${group.records.length}组` : '训练详情'
})

const selectedDateTitle = computed(() => {
  if (selectedDate.value === todayDate) return '今天'
  const date = parseDateKey(selectedDate.value)
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${weekdayLabels[date.getDay()]}`
})

function hasRecord(date: string): boolean {
  return datesWithRecords.value.has(date)
}

async function setCalendarView(view: CalendarView): Promise<void> {
  if (calendarView.value === view) return
  calendarOrigin.value = parseDateKey(selectedDate.value)
  calendarPageIndex.value = calendarPageCenter
  calendarView.value = view
  await nextTick()
  calendarSwipeRef.value?.swipeTo(calendarPageCenter, { immediate: true })
}

async function goToToday(): Promise<void> {
  selectedDate.value = todayDate
  const offset = getPeriodOffset(calendarOrigin.value, today)
  const targetIndex = calendarPageCenter + offset
  if (targetIndex >= 0 && targetIndex < calendarPageOffsets.length) {
    calendarSwipeRef.value?.swipeTo(targetIndex)
    return
  }

  calendarOrigin.value = today
  calendarPageIndex.value = calendarPageCenter
  await nextTick()
  calendarSwipeRef.value?.swipeTo(calendarPageCenter, { immediate: true })
}

function getPeriodOffset(from: Date, to: Date): number {
  if (calendarView.value === 'month') {
    return (
      (to.getFullYear() - from.getFullYear()) * 12
      + to.getMonth()
      - from.getMonth()
    )
  }
  return Math.round(
    (startOfWeek(to).getTime() - startOfWeek(from).getTime())
      / (7 * 24 * 60 * 60 * 1000),
  )
}

function onCalendarPageChange(index: number): void {
  calendarPageIndex.value = index
}

function onSelectDate(day: CalendarDay): void {
  selectedDate.value = day.date
  if (calendarView.value === 'month' && !day.isCurrentMonth) {
    const targetIndex = calendarPageIndex.value
      + (day.dateObj < new Date(
        visiblePageDate.value.getFullYear(),
        visiblePageDate.value.getMonth(),
        1,
      ) ? -1 : 1)
    calendarSwipeRef.value?.swipeTo(targetIndex)
  }
}

function openWorkoutDetail(exerciseId: string): void {
  selectedWorkoutExerciseId.value = exerciseId
  showWorkoutDetail.value = true
}

async function deleteWorkoutGroup(group: WorkoutGroup): Promise<void> {
  try {
    await showConfirmDialog({
      title: '删除训练',
      message: `确定删除「${group.exerciseName}」的${group.records.length}组记录吗？`,
    })
    await Promise.all(
      group.records.map((record) => recordStore.deleteRecord(record.id)),
    )
    showToast('已删除')
  } catch {
    // 用户取消
  }
}

function deleteWorkoutGroupByExerciseId(exerciseId: string): void {
  const group = selectedWorkoutGroups.value.find(
    (item) => item.exerciseId === exerciseId,
  )
  if (group) void deleteWorkoutGroup(group)
}

async function deleteWorkoutRecord(recordId: string): Promise<void> {
  const record = selectedDateRecords.value.find((item) => item.id === recordId)
  if (!record) return

  try {
    await showConfirmDialog({
      title: '删除组别',
      message: `确定删除「${record.exerciseName}」的这组记录吗？`,
    })
    await recordStore.deleteRecord(record.id)
    showToast('已删除')
  } catch {
    // 用户取消
  }
}

</script>

<template>
  <div class="history-page">
    <PrimaryPageHeader title="训练历史" />

    <main class="history-content">
      <section
        v-smooth-corners="24"
        class="calendar-card"
        :class="`calendar-card--${calendarView}`"
      >
        <header class="calendar-toolbar">
          <button
            v-if="selectedDate !== todayDate"
            class="today-button"
            type="button"
            @click="goToToday"
          >
            今日
          </button>
          <strong class="calendar-title">{{ calendarTitle }}</strong>
          <div class="calendar-view-switch" role="tablist" aria-label="日历视图">
            <button
              type="button"
              role="tab"
              :aria-selected="calendarView === 'week'"
              :class="{ active: calendarView === 'week' }"
              @click="setCalendarView('week')"
            >
              周
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="calendarView === 'month'"
              :class="{ active: calendarView === 'month' }"
              @click="setCalendarView('month')"
            >
              月
            </button>
          </div>
        </header>

        <div class="weekday-row" aria-hidden="true">
          <span v-for="weekday in weekdayLabels" :key="weekday">
            {{ weekday }}
          </span>
        </div>

        <van-swipe
          :key="calendarView"
          ref="calendarSwipeRef"
          class="calendar-swipe"
          :initial-swipe="calendarPageCenter"
          lazy-render
          :loop="false"
          :show-indicators="false"
          @change="onCalendarPageChange"
        >
          <van-swipe-item
            v-for="page in calendarPages"
            :key="page.key"
          >
            <div class="calendar-grid">
              <button
                v-for="day in page.days"
                :key="day.date"
                v-smooth-corners="12"
                type="button"
                class="day-cell"
                :class="{
                  'is-outside': !day.isCurrentMonth,
                  'is-today': day.isToday,
                  'is-selected': day.date === selectedDate,
                  'has-record': hasRecord(day.date),
                }"
                :aria-label="day.date"
                :aria-current="day.isToday ? 'date' : undefined"
                :aria-pressed="day.date === selectedDate"
                @click="onSelectDate(day)"
              >
                <span class="day-number">{{ day.dayNumber }}</span>
                <i v-if="hasRecord(day.date)" class="record-dot" />
              </button>
            </div>
          </van-swipe-item>
        </van-swipe>
      </section>

      <section class="history-records">
        <header class="history-records-header">
          <div class="history-records-heading">
            <h2>{{ selectedDateTitle }}</h2>
            <span>{{ selectedDate }}</span>
            <span>{{ selectedWorkoutCount }}</span>
          </div>
          <div class="history-view-switch" role="tablist" aria-label="训练记录视图">
            <button
              type="button"
              role="tab"
              :aria-selected="workoutView === 'exercise'"
              :class="{ active: workoutView === 'exercise' }"
              @click="workoutView = 'exercise'"
            >
              组合
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="workoutView === 'timeline'"
              :class="{ active: workoutView === 'timeline' }"
              @click="workoutView = 'timeline'"
            >
              拆分
            </button>
          </div>
        </header>

        <div class="history-records-list">
          <van-empty
            v-if="selectedWorkoutItems.length === 0"
            description="当天暂无训练记录"
          />
          <TodayWorkoutExerciseView
            v-else-if="workoutView === 'exercise'"
            :items="selectedWorkoutItems"
            @open="openWorkoutDetail"
            @delete="deleteWorkoutGroupByExerciseId"
          />
          <TodayWorkoutTimelineView
            v-else
            :items="selectedWorkoutTimelineItems"
            @open="openWorkoutDetail"
            @delete="deleteWorkoutRecord"
          />
        </div>
      </section>
    </main>

    <ImmersiveSheet
      v-model:show="showWorkoutDetail"
      height="80%"
      :radius="24"
      :footer-safe-space="100"
      :recessed="isNestedEditorOpen"
      :swipe-to-dismiss="!isNestedEditorOpen"
      swipe-handle=".immersive-sheet-header"
      aria-label="训练记录详情"
    >
      <template #header-left>
        <button
          class="workout-detail-quiet-action"
          type="button"
          @click="showWorkoutDetail = false"
        >
          关闭
        </button>
      </template>

      <template #header>{{ selectedWorkoutTitle }}</template>

      <template #default="{ headerSafeSpace, footerSafeSpace }">
        <WorkoutDetail
          embedded
          :date="selectedDate"
          :exercise-id="selectedWorkoutExerciseId"
          :header-safe-space="headerSafeSpace"
          :footer-safe-space="footerSafeSpace"
          @close="showWorkoutDetail = false"
          @nested-editor-open="isNestedEditorOpen = $event"
        />
      </template>

      <template #footer>
        <div class="workout-detail-actions">
          <button
            class="workout-detail-cancel"
            type="button"
            @click="showWorkoutDetail = false"
          >
            取消
          </button>
          <button
            class="workout-detail-confirm"
            type="button"
            @click="showWorkoutDetail = false"
          >
            完成 <span>✓</span>
          </button>
        </div>
      </template>
    </ImmersiveSheet>
  </div>
</template>

<style scoped>
.history-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #f5f5f7;
}

.history-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 0 16px;
}

.calendar-card {
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid rgba(60, 60, 67, 0.07);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 5px 20px rgba(30, 35, 45, 0.05);
  transition: height 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.calendar-toolbar {
  position: relative;
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) 82px;
  align-items: center;
  min-height: 50px;
  padding: 8px 10px 4px;
}

.today-button {
  grid-column: 1;
  justify-self: start;
  min-width: 56px;
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 11px;
  background: rgba(0, 122, 255, 0.09);
  color: #007aff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.calendar-title {
  grid-column: 2;
  overflow: hidden;
  color: #1c1c1e;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-view-switch {
  grid-column: 3;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  justify-self: end;
  padding: 3px;
  border-radius: 11px;
  background: rgba(118, 118, 128, 0.12);
}

.calendar-view-switch button {
  width: 34px;
  min-height: 26px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #636366;
  font: inherit;
  font-size: 12px;
}

.calendar-view-switch button.active {
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 1px 3px rgba(30, 35, 45, 0.12);
  color: #1c1c1e;
  font-weight: 600;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 2px 12px 4px;
  color: #aeaeb2;
  font-size: 10px;
  text-align: center;
}

.calendar-swipe {
  transition: height 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.calendar-card--week .calendar-swipe {
  height: 50px;
}

.calendar-card--month .calendar-swipe {
  height: 252px;
}

.calendar-grid {
  display: grid;
  height: 100%;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: 1fr;
  gap: 2px 4px;
  padding: 0 12px 10px;
}

.day-cell {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #1c1c1e;
  font: inherit;
  font-size: 13px;
}

.day-cell.is-outside {
  color: #c7c7cc;
}

.day-number {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 50%;
}

.day-cell.has-record:not(.is-selected) .day-number {
  border-color: rgba(52, 199, 89, 0.14);
  background: rgba(52, 199, 89, 0.12);
  color: #248a3d;
  font-weight: 600;
}

.day-cell.is-today .day-number {
  border-color: rgba(0, 122, 255, 0.3);
  color: #007aff;
  font-weight: 700;
}

.day-cell.is-selected .day-number {
  border-color: #007aff;
  background: #007aff;
  color: #fff;
  box-shadow: 0 4px 10px rgba(0, 122, 255, 0.2);
}

.record-dot {
  position: absolute;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #34c759;
}

.day-cell.is-selected .record-dot {
  background: #fff;
}

.history-records {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.history-records-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 10px;
}

.history-records-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.history-records-header h2 {
  margin: 0;
  color: #1c1c1e;
  font-size: 16px;
  font-weight: 600;
}

.history-records-header span {
  color: #8e8e93;
  font-size: 12px;
}

.history-view-switch {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  background: rgba(118, 118, 128, 0.12);
}

.history-view-switch button {
  min-width: 48px;
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #636366;
  font: inherit;
  font-size: 12px;
}

.history-view-switch button.active {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 1px 3px rgba(30, 35, 45, 0.12);
  color: #1c1c1e;
  font-weight: 600;
}

.history-records-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}

.workout-detail-quiet-action {
  min-width: 52px;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.82);
  color: #007aff;
  font: inherit;
  font-size: 14px;
}

.workout-detail-actions {
  display: grid;
  width: 100%;
  grid-template-columns: 0.7fr 1.3fr;
  gap: 10px;
}

.workout-detail-actions button {
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  font: inherit;
  font-weight: 600;
}

.workout-detail-cancel {
  background: rgba(242, 242, 247, 0.9);
  color: #636366;
}

.workout-detail-confirm {
  background: #007aff;
  color: #fff;
}

.workout-detail-confirm span {
  margin-left: 4px;
}

@media (max-height: 700px) {
  .history-content {
    gap: 10px;
  }

  .calendar-card--month .calendar-swipe {
    height: 224px;
  }
}

@media (prefers-color-scheme: dark) {
  .history-page {
    background: #1c1c1e;
  }

  .calendar-card {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(44, 44, 46, 0.9);
  }

  .calendar-title,
  .day-cell,
  .history-records-header h2 {
    color: #fff;
  }

  .day-cell.is-outside {
    color: #636366;
  }

  .day-cell.has-record:not(.is-selected) .day-number {
    border-color: rgba(48, 209, 88, 0.2);
    background: rgba(48, 209, 88, 0.15);
    color: #30d158;
  }

  .calendar-view-switch button.active {
    background: #48484a;
    color: #fff;
  }

  .history-view-switch button.active {
    background: #48484a;
    color: #fff;
  }
}
</style>
