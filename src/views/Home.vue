<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useExerciseStore } from '@/stores/exercise'
import { useRecordStore } from '@/stores/record'
import { showConfirmDialog, showToast } from 'vant'
import EquipmentDrawer from '@/components/EquipmentDrawer.vue'
import PrimaryPageTitle from '@/components/PrimaryPageTitle.vue'
import { getEquipmentIcon } from '@/utils/equipmentIcon'
import { groupRecordsByExercise, summarizeWorkoutSets, type WorkoutGroup } from '@/utils/workoutGroups'
import WorkoutDetail from '@/views/WorkoutDetail.vue'

const exerciseStore = useExerciseStore()
const recordStore = useRecordStore()
const router = useRouter()

// 抽屉状态
const showDrawer = ref(false)
const selectedEquipmentId = ref<string>('')
const showWorkoutDetail = ref(false)
const selectedWorkoutExerciseId = ref('')
const isEquipmentCollapsed = ref(false)
const isNestedDrawerOpen = ref(false)
const isSecondaryPageOpen = computed(() => showDrawer.value || showWorkoutDetail.value)

// ===== 器械九宫格 =====
const equipmentPage = ref(0)
const equipmentPageSize = 6 // 每页6个（2行×3列）
const equipmentPages = computed(() => {
  const pages: Array<typeof exerciseStore.equipments> = []
  const all = exerciseStore.equipments
  for (let i = 0; i < all.length; i += equipmentPageSize) {
    pages.push(all.slice(i, i + equipmentPageSize))
  }
  return pages
})

function onEquipmentClick(equipmentId: string) {
  if (!hasExercises(equipmentId)) return
  selectedEquipmentId.value = equipmentId
  showDrawer.value = true
}

function hasExercises(equipmentId: string): boolean {
  return exerciseStore.exercises.some(exercise => exercise.equipmentId === equipmentId)
}

function onEquipmentPageChange(page: number) {
  equipmentPage.value = page
}

function onRecordsScroll(event: Event) {
  isEquipmentCollapsed.value = (event.target as HTMLElement).scrollTop > 8
}

// ===== 今日记录 =====
const todayRecords = computed(() => {
  const today = recordStore.getTodayDate()
  return recordStore.records
    .filter(r => r.date === today)
    .sort((a, b) => b.createdAt - a.createdAt) // 最新在上
})

const todayWorkoutGroups = computed(() => groupRecordsByExercise(todayRecords.value))

function getGroupEquipmentIcon(group: WorkoutGroup): string | undefined {
  const exercise = exerciseStore.exercises.find(item => item.id === group.exerciseId)
  const equipment = exerciseStore.equipments.find(item => item.id === exercise?.equipmentId)
  return getEquipmentIcon(equipment?.icon)
}

function openWorkoutDetail(exerciseId: string) {
  selectedWorkoutExerciseId.value = exerciseId
  showWorkoutDetail.value = true
}

async function deleteWorkoutGroup(group: WorkoutGroup) {
  try {
    await showConfirmDialog({
      title: '删除训练',
      message: `确定删除「${group.exerciseName}」的${group.records.length}组记录吗？`,
    })
    await Promise.all(group.records.map(record => recordStore.deleteRecord(record.id)))
    showToast('已删除')
  } catch {
    // 用户取消
  }
}

// 抽屉关闭
function onDrawerClose() {
  showDrawer.value = false
}

// 记录保存成功
function onRecordSaved() {
  showDrawer.value = false
}
</script>

<template>
  <div class="home-page" :class="{ 'secondary-page-open': isSecondaryPageOpen, 'nested-secondary-page-open': isSecondaryPageOpen && isNestedDrawerOpen }">
    <PrimaryPageTitle title="记录" />

    <!-- 器械九宫格（固定） -->
    <section class="equipment-section" :class="{ collapsed: isEquipmentCollapsed }">
      <van-empty
        v-if="equipmentPages.length === 0"
        image="search"
        description="还没有常用器械"
      >
        <van-button type="primary" size="small" @click="router.push('/equipment-management')">去添加器械</van-button>
      </van-empty>
      <van-swipe
        v-else
        v-model:active="equipmentPage"
        :show-indicators="false"
        class="equipment-swipe"
        @change="onEquipmentPageChange"
      >
        <van-swipe-item v-for="(page, pageIndex) in equipmentPages" :key="pageIndex">
          <div class="equipment-grid">
            <div
              v-for="equipment in page"
              :key="equipment.id"
              class="equipment-card"
              :class="{ disabled: !hasExercises(equipment.id) }"
              @click="onEquipmentClick(equipment.id)"
            >
              <div class="equipment-icon">
                <img
                  v-if="getEquipmentIcon(equipment.icon)"
                  :src="getEquipmentIcon(equipment.icon)"
                  :alt="`${equipment.name}图标`"
                />
                <span v-else>🏋️</span>
              </div>
              <div class="equipment-name">{{ equipment.name }}</div>
            </div>
          </div>
        </van-swipe-item>
      </van-swipe>

      <!-- 翻页指示 -->
      <div class="page-indicator" v-if="equipmentPages.length > 1">
        <span
          v-for="(_, i) in equipmentPages"
          :key="i"
          class="dot"
          :class="{ active: i === equipmentPage }"
        />
      </div>
    </section>

    <!-- 今日记录（可滚动） -->
    <section class="records-section" @scroll="onRecordsScroll">
      <div class="records-header">
        <span class="records-title">今日训练</span>
        <span class="records-count">{{ todayWorkoutGroups.length }}个动作</span>
      </div>

      <div class="records-list">
        <van-empty v-if="todayWorkoutGroups.length === 0" description="还没有训练记录，点击上方器械开始" />

        <van-swipe-cell v-for="group in todayWorkoutGroups" :key="group.exerciseId">
          <div class="record-item" @click="openWorkoutDetail(group.exerciseId)">
            <div v-if="getGroupEquipmentIcon(group)" class="record-icon">
              <img :src="getGroupEquipmentIcon(group)" :alt="`${group.exerciseName}器械图标`" />
            </div>
            <div v-else class="record-icon">🏋️</div>
            <div class="record-info">
              <div class="record-name">{{ group.exerciseName }}</div>
              <div class="record-detail">
                {{ summarizeWorkoutSets(group.records) }}
              </div>
            </div>
            <van-icon name="arrow" color="#8e8e93" />
          </div>
          <template #right>
            <van-button class="delete-group-button" type="danger" text="删除" @click="deleteWorkoutGroup(group)" />
          </template>
        </van-swipe-cell>
      </div>
    </section>

    <!-- 器械动作抽屉 -->
    <EquipmentDrawer
      v-model:show="showDrawer"
      :equipment-id="selectedEquipmentId"
      @close="onDrawerClose"
      @saved="onRecordSaved"
      @nested-editor-open="isNestedDrawerOpen = $event"
    />

    <van-popup v-model:show="showWorkoutDetail" teleport="body" position="bottom" round :style="{ width: 'calc(100% - 16px)', left: '8px', bottom: '8px', height: '80%', borderRadius: '24px', background: 'transparent', '--van-ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)', '--van-ease-in': 'cubic-bezier(0.16, 1, 0.3, 1)' }">
      <WorkoutDetail
        embedded
        :date="recordStore.getTodayDate()"
        :exercise-id="selectedWorkoutExerciseId"
        @close="showWorkoutDetail = false"
        @nested-editor-open="isNestedDrawerOpen = $event"
      />
    </van-popup>
  </div>
</template>

<style scoped>
.home-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #f5f5f7;
}

/* ===== 器械区域 ===== */
.equipment-section {
  padding: 6px 16px 8px;
  background: rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 9;
  transition: padding 0.22s ease;
}

.equipment-swipe {
  height: 168px;
  transition: height 0.22s ease;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0 4px;
  height: 100%;
}

.equipment-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #f5f5f7;
  border-radius: 14px;
  padding: 8px;
  min-height: 0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.equipment-card:active {
  transform: scale(0.95);
  background: #e8e8ea;
}

.equipment-card.disabled {
  cursor: default;
  opacity: 0.45;
}

.equipment-card.disabled:active {
  transform: none;
  background: #f5f5f7;
}

.equipment-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #007aff;
}

.equipment-icon img {
  width: 34px;
  height: 34px;
  object-fit: contain;
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg) brightness(102%) contrast(101%);
}

.equipment-name {
  font-size: 13px;
  font-weight: 500;
  color: #1c1c1e;
}

.page-indicator {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
}

.equipment-section.collapsed {
  padding-top: 4px;
  padding-bottom: 4px;
}

.equipment-section.collapsed .equipment-swipe {
  height: 54px;
}

.equipment-section.collapsed .equipment-grid {
  grid-template-rows: 1fr;
}

.equipment-section.collapsed .equipment-card:nth-child(n + 4),
.equipment-section.collapsed .page-indicator {
  display: none;
}

.equipment-section.collapsed .equipment-card {
  flex-direction: row;
  gap: 6px;
  padding: 6px;
}

.equipment-section.collapsed .equipment-icon,
.equipment-section.collapsed .equipment-icon img {
  width: 26px;
  height: 26px;
}

.equipment-section.collapsed .equipment-name {
  font-size: 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: #c7c7cc;
}

.dot.active {
  width: 18px;
  background: #007aff;
}

/* ===== 记录区域 ===== */
.records-section {
  position: relative;
  z-index: 1;
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.records-title {
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
}

.records-count {
  font-size: 14px;
  color: #8e8e93;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 12px;
}

.delete-group-button {
  height: 100%;
  min-height: 100%;
  margin-left: 8px;
  padding: 0 22px;
  border-radius: 12px;
}

.record-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
  border-radius: 10px;
  font-size: 20px;
}

.record-icon img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg) brightness(102%) contrast(101%);
}

.record-info {
  flex: 1;
}

.record-name {
  font-size: 15px;
  font-weight: 500;
  color: #1c1c1e;
}

.record-detail {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 2px;
}

.record-time {
  font-size: 12px;
  color: #8e8e93;
}

@media (max-height: 667px) {
  .equipment-section {
    padding-top: 4px;
    padding-bottom: 6px;
    top: 0;
  }

  .equipment-swipe {
    height: 156px;
  }

  .page-indicator {
    margin-top: 4px;
  }

  .records-section {
    padding-top: 10px;
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }

  .records-header {
    margin-bottom: 8px;
  }
}

/* ===== 深色模式 ===== */
@media (prefers-color-scheme: dark) {
  .home-page {
    background: #1c1c1e;
  }

  .equipment-section {
    background: #2c2c2e;
  }

  .equipment-section {
    background: rgba(44, 44, 46, 0.76);
  }

  .equipment-card {
    background: #3a3a3c;
  }

  .equipment-card:active {
    background: #48484a;
  }

  .equipment-name {
    color: #fff;
  }

  .record-item {
    background: #2c2c2e;
  }

  .record-icon {
    background: #3a3a3c;
  }

  .record-name {
    color: #fff;
  }

  .records-title {
    color: #fff;
  }
}
</style>
