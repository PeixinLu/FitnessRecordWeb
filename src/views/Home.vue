<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useExerciseStore } from "@/stores/exercise";
import { useRecordStore } from "@/stores/record";
import {
  closeToast,
  showConfirmDialog,
  showLoadingToast,
  showToast,
} from "vant";
import EquipmentDrawer from "@/components/EquipmentDrawer.vue";
import ImmersiveSheet from "@/components/ImmersiveSheet.vue";
import PrimaryPageHeader from "@/components/PrimaryPageHeader.vue";
import TodayWorkoutExerciseView from "@/components/TodayWorkoutExerciseView.vue";
import TodayWorkoutTimelineView from "@/components/TodayWorkoutTimelineView.vue";
import { getEquipmentIcon } from "@/utils/equipmentIcon";
import {
  groupRecordsByExercise,
  type WorkoutGroup,
} from "@/utils/workoutGroups";
import {
  buildTodayWorkoutExerciseItems,
  buildTodayWorkoutTimelineItems,
  type TodayWorkoutViewMode,
} from "@/utils/todayWorkoutViews";
import { shareWorkoutCard } from "@/utils/workoutShare";
import WorkoutDetail from "@/views/WorkoutDetail.vue";
import EquipmentManagement from "@/views/EquipmentManagement.vue";

const exerciseStore = useExerciseStore();
const recordStore = useRecordStore();
const todayWorkoutViewStorageKey = "fitness-record-today-workout-view";

function getInitialTodayWorkoutView(): TodayWorkoutViewMode {
  try {
    return localStorage.getItem(todayWorkoutViewStorageKey) === "timeline"
      ? "timeline"
      : "exercise";
  } catch {
    return "exercise";
  }
}

const todayWorkoutView = ref<TodayWorkoutViewMode>(getInitialTodayWorkoutView());
const isSharingWorkout = ref(false);

watch(todayWorkoutView, (view) => {
  try {
    localStorage.setItem(todayWorkoutViewStorageKey, view);
  } catch {
    // Safari 隐私模式下存储可能不可用，不影响本次切换。
  }
});

// 抽屉状态
const showDrawer = ref(false);
const selectedEquipmentId = ref<string>("");
const showWorkoutDetail = ref(false);
const selectedWorkoutExerciseId = ref("");
const isNestedDrawerOpen = ref(false);
const isSecondaryPageOpen = computed(
  () => showDrawer.value || showWorkoutDetail.value || showEquipmentManager.value,
);

// 器械管理弹窗
const showEquipmentManager = ref(false)
const isEquipmentManagerFlipping = ref(false)
const equipmentManagerTargetEquipmentId = ref('')
const equipmentManagerTargetExerciseId = ref('')
const equipmentManagerTargetRequestKey = ref(0)
const pendingEquipmentManagementTarget = ref<{
  equipmentId: string
  exerciseId: string
} | null>(null)

// ===== 器械九宫格 =====
const equipmentPage = ref(0);
const equipmentPageSize = 6; // 每页6个（2行×3列）
const isSingleEquipmentRow = computed(
  () => exerciseStore.equipments.length > 0 && exerciseStore.equipments.length <= 3,
);
const equipmentPages = computed(() => {
  const pages: Array<typeof exerciseStore.equipments> = [];
  const all = exerciseStore.equipments;
  for (let i = 0; i < all.length; i += equipmentPageSize) {
    pages.push(all.slice(i, i + equipmentPageSize));
  }
  return pages;
});

function onEquipmentClick(equipmentId: string) {
  if (!hasExercises(equipmentId)) return;
  selectedEquipmentId.value = equipmentId;
  showDrawer.value = true;
}

function hasExercises(equipmentId: string): boolean {
  return exerciseStore.exercises.some(
    (exercise) => exercise.equipmentId === equipmentId,
  );
}

function onEquipmentPageChange(page: number) {
  equipmentPage.value = page;
}

// ===== 今日记录 =====
const todayRecords = computed(() => {
  const today = recordStore.getTodayDate();
  return recordStore.records
    .filter((r) => r.date === today)
    .sort((a, b) => b.createdAt - a.createdAt); // 最新在上
});

const todayWorkoutGroups = computed(() =>
  groupRecordsByExercise(todayRecords.value),
);

const todayWorkoutExerciseItems = computed(() =>
  buildTodayWorkoutExerciseItems(
    todayRecords.value,
    exerciseStore.exercises,
    exerciseStore.equipments,
  ),
);

const todayWorkoutTimelineItems = computed(() =>
  buildTodayWorkoutTimelineItems(
    todayRecords.value,
    exerciseStore.exercises,
    exerciseStore.equipments,
  ),
);

const todayWorkoutCount = computed(() =>
  todayWorkoutView.value === "timeline"
    ? `${todayRecords.value.length}组`
    : `${todayWorkoutGroups.value.length}个动作`,
);

const selectedWorkoutGroup = computed(() =>
  todayWorkoutGroups.value.find(
    (group) => group.exerciseId === selectedWorkoutExerciseId.value,
  ),
);

const selectedWorkoutTitle = computed(() => {
  const group = selectedWorkoutGroup.value;
  return group ? `${group.exerciseName} · ${group.records.length}组` : "训练详情";
});

function openWorkoutDetail(exerciseId: string) {
  selectedWorkoutExerciseId.value = exerciseId;
  showWorkoutDetail.value = true;
}

async function deleteWorkoutRecord(recordId: string) {
  const record = todayRecords.value.find((item) => item.id === recordId);
  if (!record) return;

  try {
    await showConfirmDialog({
      title: "删除组别",
      message: `确定删除「${record.exerciseName}」的这组记录吗？`,
    });
    await recordStore.deleteRecord(record.id);
    showToast("已删除");
  } catch {
    // 用户取消
  }
}

function deleteWorkoutGroupByExerciseId(exerciseId: string) {
  const group = todayWorkoutGroups.value.find(
    (item) => item.exerciseId === exerciseId,
  );
  if (group) void deleteWorkoutGroup(group);
}

async function shareTodayWorkout() {
  if (todayWorkoutExerciseItems.value.length === 0 || isSharingWorkout.value) {
    return;
  }

  isSharingWorkout.value = true;
  showLoadingToast({
    message: "生成分享卡片...",
    duration: 0,
    forbidClick: true,
  });
  try {
    const result = await shareWorkoutCard({
      title: "今日训练",
      date: recordStore.getTodayDate(),
      items: todayWorkoutExerciseItems.value,
    });
    closeToast();
    if (result === "downloaded") showToast("分享不可用，已下载图片");
  } catch {
    closeToast();
    showToast("分享失败，请稍后重试");
  } finally {
    isSharingWorkout.value = false;
  }
}

async function deleteWorkoutGroup(group: WorkoutGroup) {
  try {
    await showConfirmDialog({
      title: "删除训练",
      message: `确定删除「${group.exerciseName}」的${group.records.length}组记录吗？`,
    });
    await Promise.all(
      group.records.map((record) => recordStore.deleteRecord(record.id)),
    );
    showToast("已删除");
  } catch {
    // 用户取消
  }
}

// 抽屉关闭
function onDrawerClose() {
  showDrawer.value = false;
}

function openEquipmentManagement(
  equipmentId = '',
  exerciseId = '',
): void {
  equipmentManagerTargetEquipmentId.value = equipmentId
  equipmentManagerTargetExerciseId.value = exerciseId
  equipmentManagerTargetRequestKey.value += 1
  showEquipmentManager.value = true
}

function openEquipmentManagementFromDrawer(
  equipmentId: string,
  exerciseId?: string,
) {
  pendingEquipmentManagementTarget.value = {
    equipmentId,
    exerciseId: exerciseId ?? '',
  }
  showDrawer.value = false
  isNestedDrawerOpen.value = false
}

function onEquipmentDrawerClosed(): void {
  const target = pendingEquipmentManagementTarget.value
  if (!target) return
  pendingEquipmentManagementTarget.value = null
  openEquipmentManagement(target.equipmentId, target.exerciseId)
}

// 记录保存成功
function onRecordSaved() {
  showDrawer.value = false;
}
</script>

<template>
  <div
    class="home-page"
    :class="{
      'secondary-page-open': isSecondaryPageOpen,
      'nested-secondary-page-open': isSecondaryPageOpen && isNestedDrawerOpen,
    }"
  >
    <PrimaryPageHeader title="记录">
      <template #action>
        <button
          class="primary-page-header-action"
          @click="openEquipmentManagement()"
        >
          <van-icon name="setting-o" size="14" color="#007aff" />
          <span>器械管理</span>
        </button>
      </template>
    </PrimaryPageHeader>

    <!-- 器械九宫格（固定） -->
    <section
      class="equipment-section"
      :class="{ 'single-row': isSingleEquipmentRow }"
    >
      <van-empty
        v-if="equipmentPages.length === 0"
        image="search"
        description="还没有常用器械"
      >
        <van-button
          type="primary"
          size="small"
          @click="openEquipmentManagement()"
          >去添加器械</van-button
        >
      </van-empty>
      <van-swipe
        v-else
        v-model:active="equipmentPage"
        :show-indicators="false"
        class="equipment-swipe"
        @change="onEquipmentPageChange"
      >
        <van-swipe-item
          v-for="(page, pageIndex) in equipmentPages"
          :key="pageIndex"
        >
          <div class="equipment-grid">
            <div
              v-for="equipment in page"
              :key="equipment.id"
              v-smooth-corners="14"
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
    <section class="records-section">
      <div class="records-header">
        <div class="records-heading">
          <span class="records-title">今日训练</span>
          <span class="records-count">{{ todayWorkoutCount }}</span>
        </div>
        <div class="records-header-actions">
          <button
            v-if="todayRecords.length > 0"
            class="records-share-button"
            type="button"
            aria-label="分享今日训练"
            :disabled="isSharingWorkout"
            @click="shareTodayWorkout"
          >
            <van-icon name="share-o" size="17" />
          </button>
          <div class="records-view-switch" role="tablist" aria-label="训练记录视图">
            <button
              type="button"
              role="tab"
              :aria-selected="todayWorkoutView === 'exercise'"
              :class="{ active: todayWorkoutView === 'exercise' }"
              @click="todayWorkoutView = 'exercise'"
            >
              组合
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="todayWorkoutView === 'timeline'"
              :class="{ active: todayWorkoutView === 'timeline' }"
              @click="todayWorkoutView = 'timeline'"
            >
              拆分
            </button>
          </div>
        </div>
      </div>

      <div class="records-list">
        <van-empty
          v-if="todayRecords.length === 0"
          description="还没有训练记录，点击上方器械开始"
        />
        <TodayWorkoutExerciseView
          v-else-if="todayWorkoutView === 'exercise'"
          :items="todayWorkoutExerciseItems"
          @open="openWorkoutDetail"
          @delete="deleteWorkoutGroupByExerciseId"
        />
        <TodayWorkoutTimelineView
          v-else
          :items="todayWorkoutTimelineItems"
          @open="openWorkoutDetail"
          @delete="deleteWorkoutRecord"
        />
      </div>
    </section>

    <!-- 器械动作抽屉 -->
    <EquipmentDrawer
      v-model:show="showDrawer"
      :equipment-id="selectedEquipmentId"
      @close="onDrawerClose"
      @closed="onEquipmentDrawerClosed"
      @saved="onRecordSaved"
      @nested-editor-open="isNestedDrawerOpen = $event"
      @open-equipment-management="openEquipmentManagementFromDrawer"
    />

    <ImmersiveSheet
      v-model:show="showWorkoutDetail"
      height="80%"
      :radius="24"
      :footer-safe-space="100"
      :recessed="isNestedDrawerOpen"
      :swipe-to-dismiss="!isNestedDrawerOpen"
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

      <template #header>
        {{ selectedWorkoutTitle }}
      </template>

      <template #default="{ headerSafeSpace, footerSafeSpace }">
        <WorkoutDetail
          embedded
          :date="recordStore.getTodayDate()"
          :exercise-id="selectedWorkoutExerciseId"
          :header-safe-space="headerSafeSpace"
          :footer-safe-space="footerSafeSpace"
          @close="showWorkoutDetail = false"
          @nested-editor-open="isNestedDrawerOpen = $event"
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

    <!-- 器械管理弹窗 -->
    <ImmersiveSheet
      v-model:show="showEquipmentManager"
      height="90%"
      :radius="38"
      :swipe-to-dismiss="!isEquipmentManagerFlipping"
      swipe-handle="[data-sheet-swipe-handle]"
      class="equipment-management-popup"
      :class="{ 'equipment-management-popup--flipping': isEquipmentManagerFlipping }"
      aria-label="器械动作管理"
    >
      <EquipmentManagement
        embedded
        :target-equipment-id="equipmentManagerTargetEquipmentId"
        :target-exercise-id="equipmentManagerTargetExerciseId"
        :target-request-key="equipmentManagerTargetRequestKey"
        @close="showEquipmentManager = false"
        @flip-state-change="isEquipmentManagerFlipping = $event"
      />
    </ImmersiveSheet>

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

.equipment-management-popup--flipping {
  overflow: visible !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
}

/* ===== 器械区域 ===== */
.equipment-section {
  padding: 6px 16px 8px;
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
  background: rgba(255, 255, 255, 0.76);
  border-radius: 14px;
  padding: 8px;
  min-height: 0;
  cursor: pointer;
  box-shadow:
    0 1px 2px rgba(30, 35, 45, 0.06),
    0 4px 10px rgba(30, 35, 45, 0.05);
  transition:
    transform 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.equipment-card:active {
  transform: scale(0.95);
  background: #e8e8ea;
  box-shadow: 0 1px 2px rgba(30, 35, 45, 0.05);
}

.equipment-card.disabled {
  cursor: default;
  opacity: 0.45;
  box-shadow: none;
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
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg)
    brightness(102%) contrast(101%);
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

.equipment-section.single-row .equipment-swipe {
  height: 80px;
}

.equipment-section.single-row .equipment-grid {
  grid-template-rows: 1fr;
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
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 16px 16px 0;
}

.records-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.records-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.records-title {
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
}

.records-count {
  font-size: 12px;
  color: #8e8e93;
}

.records-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.records-share-button {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 3px rgba(30, 35, 45, 0.08);
  color: #007aff;
}

.records-share-button:disabled {
  opacity: 0.45;
}

.records-view-switch {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  padding: 3px;
  border-radius: 11px;
  background: rgba(118, 118, 128, 0.12);
}

.records-view-switch button {
  min-width: 48px;
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #636366;
  font: inherit;
  font-size: 12px;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.records-view-switch button.active {
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 1px 3px rgba(30, 35, 45, 0.12);
  color: #1c1c1e;
  font-weight: 600;
}

.records-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
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

@media (max-height: 667px) {
  .equipment-section {
    padding-top: 4px;
    padding-bottom: 6px;
    top: 0;
  }

  .equipment-swipe {
    height: 156px;
  }

  .equipment-section.single-row .equipment-swipe {
    height: 76px;
  }

  .page-indicator {
    margin-top: 4px;
  }

  .records-section {
    padding-top: 10px;
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
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.18),
      0 4px 10px rgba(0, 0, 0, 0.14);
  }

  .equipment-card:active {
    background: #48484a;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
  }

  .equipment-card.disabled {
    box-shadow: none;
  }

  .equipment-name {
    color: #fff;
  }

  .records-title {
    color: #fff;
  }

  .records-view-switch button.active {
    background: #48484a;
    color: #fff;
  }

  .records-share-button {
    background: #3a3a3c;
    color: #0a84ff;
  }

}
</style>
