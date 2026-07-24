<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useExerciseStore } from "@/stores/exercise";
import { useRecordStore } from "@/stores/record";
import {
  closeToast,
  showConfirmDialog,
  showLoadingToast,
  showToast,
} from "vant";
import EquipmentDrawer from "@/components/EquipmentDrawer.vue";
import EquipmentEmptyState from "@/components/EquipmentEmptyState.vue";
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
import AccountPopup from "@/components/AccountPopup.vue";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { getAccountPreview } from "@/utils/accountPreview";

const exerciseStore = useExerciseStore();
const recordStore = useRecordStore();
const authStore = useAuthStore();
const syncStore = useSyncStore();
const accountPreview = getAccountPreview();
const displayedUser = computed(
  () => authStore.user ?? accountPreview?.user ?? null,
);
const displayedSyncTone = computed(() =>
  authStore.user
    ? syncStore.indicatorTone
    : (accountPreview?.tone ?? syncStore.indicatorTone),
);
const accountAvatarText = computed(
  () => displayedUser.value?.nickname.slice(0, 1) ?? "",
);
const showSyncLoginNudge = ref(false);
let syncLoginNudgeOpenTimer: number | undefined;
const currentMoment = ref(new Date());
let currentMomentTimer: number | undefined;
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

const todayWorkoutView = ref<TodayWorkoutViewMode>(
  getInitialTodayWorkoutView(),
);
const isSharingWorkout = ref(false);
const showAccount = ref(false);

function hideSyncLoginNudge(): void {
  window.clearTimeout(syncLoginNudgeOpenTimer);
  showSyncLoginNudge.value = false;
}

function scheduleSyncLoginNudge(): void {
  if (accountPreview || displayedUser.value || !authStore.hasRestoredSession)
    return;

  window.clearTimeout(syncLoginNudgeOpenTimer);
  syncLoginNudgeOpenTimer = window.setTimeout(() => {
    if (displayedUser.value || showAccount.value) return;
    showSyncLoginNudge.value = true;
  }, 900);
}

function openAccount(): void {
  hideSyncLoginNudge();
  showAccount.value = true;
}

watch(
  [() => authStore.hasRestoredSession, () => authStore.user?.id],
  () => {
    if (displayedUser.value) hideSyncLoginNudge();
    else scheduleSyncLoginNudge();
  },
  { immediate: true },
);

watch(showAccount, (show) => {
  if (show) hideSyncLoginNudge();
});

onBeforeUnmount(() => {
  window.clearTimeout(syncLoginNudgeOpenTimer);
  window.clearInterval(currentMomentTimer);
});

onMounted(() => {
  currentMoment.value = new Date();
  currentMomentTimer = window.setInterval(() => {
    currentMoment.value = new Date();
  }, 60_000);
});

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
const pressedEquipmentCardId = ref<string>("");
const showWorkoutDetail = ref(false);
const selectedWorkoutExerciseId = ref("");
const isNestedDrawerOpen = ref(false);
const isSecondaryPageOpen = computed(
  () =>
    showDrawer.value || showWorkoutDetail.value || showEquipmentManager.value,
);

// 器械管理弹窗
const showEquipmentManager = ref(false);
const isEquipmentManagerFlipping = ref(false);
const equipmentManagerFlipAnimation = ref("");
const equipmentManagerTargetEquipmentId = ref("");
const equipmentManagerTargetExerciseId = ref("");
const equipmentManagerTargetRequestKey = ref(0);
const pendingEquipmentManagementTarget = ref<{
  equipmentId: string;
  exerciseId: string;
} | null>(null);

watch([showDrawer, showEquipmentManager], ([drawerOpen, managerOpen]) => {
  if (!drawerOpen && !managerOpen && !pendingEquipmentManagementTarget.value) {
    pressedEquipmentCardId.value = "";
  }
});

// ===== 器械九宫格 =====
const equipmentPage = ref(0);
const equipmentPageSize = 6; // 每页6个（2行×3列）
const isSingleEquipmentRow = computed(() => {
  const equipmentCount = exerciseStore.equipments.length;
  const visibleCardCount =
    equipmentCount +
    (equipmentCount > 0 && equipmentCount < equipmentPageSize ? 1 : 0);
  return visibleCardCount > 0 && visibleCardCount <= 3;
});
const equipmentPages = computed(() => {
  const pages: Array<typeof exerciseStore.equipments> = [];
  const all = exerciseStore.equipments;
  for (let i = 0; i < all.length; i += equipmentPageSize) {
    pages.push(all.slice(i, i + equipmentPageSize));
  }
  return pages;
});

function onEquipmentClick(equipmentId: string) {
  pressedEquipmentCardId.value = equipmentId;
  if (!hasExercises(equipmentId)) {
    openEquipmentManagement(equipmentId);
    return;
  }
  selectedEquipmentId.value = equipmentId;
  showDrawer.value = true;
}

function openEquipmentManagementFromAddCard(): void {
  pressedEquipmentCardId.value = "add";
  openEquipmentManagement();
}

function hasExercises(equipmentId: string): boolean {
  return exerciseStore.exercises.some(
    (exercise) => exercise.equipmentId === equipmentId,
  );
}

function getExerciseCount(equipmentId: string): number {
  return exerciseStore.exercises.filter(
    (exercise) => exercise.equipmentId === equipmentId,
  ).length;
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

const emptyWorkoutDate = computed(() => {
  const month = String(currentMoment.value.getMonth() + 1).padStart(2, "0");
  const day = String(currentMoment.value.getDate()).padStart(2, "0");
  return `${month}.${day}`;
});

const emptyWorkoutGreeting = computed(() => {
  const hour = currentMoment.value.getHours();
  const greeting =
    hour < 5
      ? "凌晨好"
      : hour < 11
        ? "早上好"
        : hour < 13
          ? "中午好"
          : hour < 18
            ? "下午好"
            : "晚上好";
  return `${greeting}，今天练什么`;
});

const selectedWorkoutGroup = computed(() =>
  todayWorkoutGroups.value.find(
    (group) => group.exerciseId === selectedWorkoutExerciseId.value,
  ),
);

const selectedWorkoutTitle = computed(() => {
  const group = selectedWorkoutGroup.value;
  return group
    ? `${group.exerciseName} · ${group.records.length}组`
    : "训练详情";
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
    const result = await shareWorkoutCard(
      {
        title: "今日训练",
        date: recordStore.getTodayDate(),
        items: todayWorkoutExerciseItems.value,
      },
      closeToast,
    );
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

function openEquipmentManagement(equipmentId = "", exerciseId = ""): void {
  equipmentManagerTargetEquipmentId.value = equipmentId;
  equipmentManagerTargetExerciseId.value = exerciseId;
  equipmentManagerTargetRequestKey.value += 1;
  showEquipmentManager.value = true;
}

function openEquipmentManagementFromDrawer(
  equipmentId: string,
  exerciseId?: string,
) {
  pendingEquipmentManagementTarget.value = {
    equipmentId,
    exerciseId: exerciseId ?? "",
  };
  showDrawer.value = false;
  isNestedDrawerOpen.value = false;
}

function onEquipmentDrawerClosed(): void {
  const target = pendingEquipmentManagementTarget.value;
  if (!target) {
    pressedEquipmentCardId.value = "";
    return;
  }
  pendingEquipmentManagementTarget.value = null;
  openEquipmentManagement(target.equipmentId, target.exerciseId);
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
      <template #account>
        <button
          class="primary-page-account-button"
          :class="{
            'primary-page-account-button--sync-nudge': showSyncLoginNudge,
            'primary-page-account-button--signed-out': !displayedUser,
          }"
          type="button"
          :aria-label="
            displayedUser ? `${displayedUser.nickname}，打开账户` : '打开账户'
          "
          @click="openAccount"
        >
          <template v-if="displayedUser">
            <span class="home-account-avatar">
              <img
                v-if="displayedUser.image"
                :src="displayedUser.image"
                alt=""
              />
              <span v-else>{{ accountAvatarText }}</span>
              <i
                class="sync-indicator"
                :class="`sync-indicator--${displayedSyncTone}`"
                aria-hidden="true"
              />
            </span>
          </template>
          <template v-else>
            <span class="sync-login-nudge-icon" aria-hidden="true">
              <svg
                class="sync-login-account-icon"
                viewBox="0 0 1024 1024"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M672 320a160 160 0 1 0-160 160 160 160 0 0 0 160-160z m64 0A224 224 0 1 1 512 96a224 224 0 0 1 224 224z"
                />
                <path
                  d="M224 832a32 32 0 0 1-64 0 352 352 0 0 1 704 0 32 32 0 0 1-64 0 288 288 0 0 0-576 0z"
                />
              </svg>
              <i v-if="!showSyncLoginNudge" class="sync-login-nudge-dot" />
            </span>
            <span class="sync-login-nudge-label">登录以同步</span>
          </template>
        </button>
      </template>
    </PrimaryPageHeader>

    <!-- 器械九宫格（固定） -->
    <section
      class="equipment-section"
      :class="{ 'single-row': isSingleEquipmentRow }"
    >
      <div class="equipment-section-header">
        <h2 aria-label="常用器械或动作，点击器械开始记录">
          <span class="equipment-title-choice" aria-hidden="true"
            >常用器械｜动作</span
          >
          <span class="equipment-title-record" aria-hidden="true"
            >点击器械开始记录</span
          >
        </h2>
        <button
          type="button"
          class="equipment-manage-button"
          @click="openEquipmentManagement()"
        >
          管理
        </button>
      </div>

      <EquipmentEmptyState
        v-if="equipmentPages.length === 0"
        message="添加常用器械/动作以开始记录"
        action-label="添加器械"
        @action="openEquipmentManagement()"
      />
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
            <button
              v-for="equipment in page"
              :key="equipment.id"
              v-smooth-corners="14"
              type="button"
              class="equipment-card"
              :class="{
                'needs-setup': !hasExercises(equipment.id),
                'is-pressed': pressedEquipmentCardId === equipment.id,
              }"
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
              <div class="equipment-action-count">
                {{
                  getExerciseCount(equipment.id) > 0
                    ? `${getExerciseCount(equipment.id)} 个动作`
                    : "添加动作"
                }}
              </div>
            </button>
            <button
              v-if="exerciseStore.equipments.length < equipmentPageSize"
              v-smooth-corners="14"
              type="button"
              class="equipment-card equipment-card--add"
              :class="{ 'is-pressed': pressedEquipmentCardId === 'add' }"
              aria-label="添加器械"
              @click="openEquipmentManagementFromAddCard"
            >
              <div class="equipment-add-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div class="equipment-name">添加</div>
              <div class="equipment-action-count">管理器械</div>
            </button>
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
          <div
            class="records-view-switch"
            role="tablist"
            aria-label="训练记录视图"
          >
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
        <div v-if="todayRecords.length === 0" class="records-empty">
          <time
            class="records-empty-date"
            :datetime="recordStore.getTodayDate()"
          >
            {{ emptyWorkoutDate }}
          </time>
          <p>{{ emptyWorkoutGreeting }}</p>
        </div>
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

      <button
        v-if="todayRecords.length > 0"
        class="records-share-button"
        type="button"
        aria-label="分享今日训练"
        :disabled="isSharingWorkout"
        @click="shareTodayWorkout"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M12 15V3" />
          <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
          <path
            d="M7 10H5.5A2.5 2.5 0 0 0 3 12.5v6A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5v-6a2.5 2.5 0 0 0-2.5-2.5H17"
          />
        </svg>
      </button>
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
      :class="[
        { 'immersive-popup-flip--flipping': isEquipmentManagerFlipping },
        equipmentManagerFlipAnimation
          ? `immersive-popup-flip--${equipmentManagerFlipAnimation}`
          : '',
      ]"
      :aria-busy="isEquipmentManagerFlipping"
      aria-label="器械动作管理"
    >
      <EquipmentManagement
        embedded
        :target-equipment-id="equipmentManagerTargetEquipmentId"
        :target-exercise-id="equipmentManagerTargetExerciseId"
        :target-request-key="equipmentManagerTargetRequestKey"
        @close="showEquipmentManager = false"
        @flip-state-change="isEquipmentManagerFlipping = $event"
        @flip-animation-change="equipmentManagerFlipAnimation = $event"
      />
    </ImmersiveSheet>

    <AccountPopup v-model:show="showAccount" />
  </div>
</template>

<style scoped>
.primary-page-account-button {
  overflow: hidden;
  white-space: nowrap;
  transition:
    width 460ms cubic-bezier(0.16, 1, 0.3, 1),
    padding 460ms cubic-bezier(0.16, 1, 0.3, 1),
    border-radius 460ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 220ms ease,
    box-shadow 220ms ease,
    transform 160ms ease;
}

.primary-page-account-button--signed-out {
  justify-content: flex-start;
  gap: 0;
}

.primary-page-account-button--sync-nudge {
  width: 116px;
  gap: 8px;
  padding: 0 13px 0 7px;
  border-radius: 19px;
  background: rgba(235, 245, 255, 0.94);
  box-shadow:
    0 5px 18px rgba(0, 92, 190, 0.14),
    0 1px 3px rgba(30, 35, 45, 0.08);
}

.sync-login-nudge-icon {
  position: relative;
  display: flex;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  transition:
    width 460ms cubic-bezier(0.16, 1, 0.3, 1),
    flex-basis 460ms cubic-bezier(0.16, 1, 0.3, 1);
}

.primary-page-account-button--sync-nudge .sync-login-nudge-icon {
  width: 22px;
  flex-basis: 22px;
}

.sync-login-account-icon {
  width: 22px;
  height: 22px;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 10px;
  transform: translateY(0.5px);
}

.sync-login-nudge-label {
  overflow: hidden;
  max-width: 0;
  opacity: 0;
  color: #1672c4;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.1px;
  transform: translateX(-6px);
  transition:
    max-width 420ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 180ms ease 40ms,
    transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.primary-page-account-button--sync-nudge .sync-login-nudge-label {
  max-width: 64px;
  opacity: 1;
  transform: translateX(0);
}

.sync-login-nudge-dot {
  position: absolute;
  top: 7px;
  right: 6px;
  width: 7px;
  height: 7px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  background: #0a84ff;
  box-shadow: 0 0 0 rgba(10, 132, 255, 0.35);
  animation: sync-login-dot-pulse 3.2s ease-out infinite;
}

.primary-page-account-button--sync-nudge::after {
  position: absolute;
  width: 32px;
  height: 72px;
  opacity: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.68),
    transparent
  );
  content: "";
  pointer-events: none;
  transform: translateX(-48px) rotate(18deg);
  animation: sync-login-nudge-sheen 6s ease-in-out 600ms infinite;
}

@keyframes sync-login-dot-pulse {
  0%,
  62%,
  100% {
    box-shadow: 0 0 0 0 rgba(10, 132, 255, 0);
  }

  72% {
    box-shadow: 0 0 0 5px rgba(10, 132, 255, 0.14);
  }
}

@keyframes sync-login-nudge-sheen {
  0% {
    opacity: 0;
    transform: translateX(-48px) rotate(18deg);
  }

  4% {
    opacity: 0;
  }

  9% {
    opacity: 0.78;
  }

  19% {
    opacity: 0;
    transform: translateX(110px) rotate(18deg);
  }

  20%,
  100% {
    opacity: 0;
    transform: translateX(110px) rotate(18deg);
  }
}

.home-account-avatar {
  position: relative;
  display: flex;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #2f95ff, #0068db);
  color: #fff;
  font-size: 13px;
  font-weight: 650;
}

.home-account-avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.sync-indicator {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 9px;
  height: 9px;
  border: 2px solid #fff;
  border-radius: 50%;
}

.sync-indicator--synced {
  background: #34c759;
  box-shadow: 0 0 7px rgba(52, 199, 89, 0.9);
}

.sync-indicator--pending {
  background: #ff9500;
  box-shadow: 0 0 7px rgba(255, 149, 0, 0.85);
}

.sync-indicator--syncing {
  background: #ffd60a;
  box-shadow: 0 0 7px rgba(255, 214, 10, 0.9);
}

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
  margin: 6px 16px 8px;
  padding: 14px 12px 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 9;
  transition: padding 0.22s ease;
}

.equipment-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
  margin: 0 4px 10px;
}

.equipment-section-header h2 {
  position: relative;
  width: 144px;
  height: 22px;
  overflow: hidden;
  margin: 0;
  color: #636366;
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
}

.equipment-section-header h2 span {
  --equipment-title-wipe: -12px;
  position: absolute;
  inset: 0;
  white-space: nowrap;
  -webkit-mask-image: linear-gradient(
    to right,
    var(--equipment-title-mask-start)
      calc(var(--equipment-title-wipe) - 8px),
    var(--equipment-title-mask-end)
      calc(var(--equipment-title-wipe) + 8px)
  );
  mask-image: linear-gradient(
    to right,
    var(--equipment-title-mask-start)
      calc(var(--equipment-title-wipe) - 8px),
    var(--equipment-title-mask-end)
      calc(var(--equipment-title-wipe) + 8px)
  );
  will-change: mask-image, opacity;
}

.equipment-title-choice {
  --equipment-title-mask-start: transparent;
  --equipment-title-mask-end: #000;
}

.equipment-title-record {
  --equipment-title-mask-start: #000;
  --equipment-title-mask-end: transparent;
}

.equipment-title-choice {
  animation: equipment-title-choice 12s linear infinite;
}

.equipment-title-record {
  animation: equipment-title-record 12s linear infinite;
}

@property --equipment-title-wipe {
  syntax: "<length-percentage>";
  inherits: false;
  initial-value: -12px;
}

@keyframes equipment-title-choice {
  0%,
  42% {
    opacity: 1;
    --equipment-title-wipe: -12px;
    --equipment-title-mask-start: transparent;
    --equipment-title-mask-end: #000;
  }

  50%,
  84.99% {
    opacity: 1;
    --equipment-title-wipe: calc(100% + 12px);
    --equipment-title-mask-start: transparent;
    --equipment-title-mask-end: #000;
  }

  85% {
    opacity: 1;
    --equipment-title-wipe: -12px;
    --equipment-title-mask-start: #000;
    --equipment-title-mask-end: transparent;
  }

  93%,
  100% {
    opacity: 1;
    --equipment-title-wipe: calc(100% + 12px);
    --equipment-title-mask-start: #000;
    --equipment-title-mask-end: transparent;
  }
}

@keyframes equipment-title-record {
  0%,
  42% {
    opacity: 1;
    --equipment-title-wipe: -12px;
    --equipment-title-mask-start: #000;
    --equipment-title-mask-end: transparent;
  }

  50%,
  84.99% {
    opacity: 1;
    --equipment-title-wipe: calc(100% + 12px);
    --equipment-title-mask-start: #000;
    --equipment-title-mask-end: transparent;
  }

  85% {
    opacity: 1;
    --equipment-title-wipe: -12px;
    --equipment-title-mask-start: transparent;
    --equipment-title-mask-end: #000;
  }

  93%,
  100% {
    opacity: 1;
    --equipment-title-wipe: calc(100% + 12px);
    --equipment-title-mask-start: transparent;
    --equipment-title-mask-end: #000;
  }
}

.equipment-manage-button {
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #007aff;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.equipment-manage-button:active {
  background: rgba(0, 122, 255, 0.1);
}

.equipment-swipe {
  height: 180px;
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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 14px;
  background: #f4f5f7;
  min-height: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.96),
    inset -1px -1px 0 rgba(164, 173, 184, 0.11),
    -4px -4px 9px rgba(255, 255, 255, 0.88),
    5px 5px 11px rgba(153, 162, 173, 0.28);
  transition:
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
    background 180ms ease,
    box-shadow 180ms ease;
}

.equipment-card:active,
.equipment-card.is-pressed {
  transform: translateY(1px) scale(0.97);
  background: #eef0f3;
  box-shadow:
    inset 4px 4px 8px rgba(160, 169, 180, 0.23),
    inset -3px -3px 7px rgba(255, 255, 255, 0.86);
}

.equipment-card:active .equipment-icon,
.equipment-card.is-pressed .equipment-icon {
  transform: translateY(1px) scale(0.97);
}

.equipment-card.needs-setup {
  border-style: dashed;
}

.equipment-icon {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #007aff;
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.equipment-add-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  color: #007aff;
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.equipment-add-icon svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.equipment-card:active .equipment-add-icon,
.equipment-card.is-pressed .equipment-add-icon {
  transform: translateY(1px) scale(0.97);
}

.equipment-card--add .equipment-action-count {
  color: #2684d9;
}

.equipment-icon img {
  width: 29px;
  height: 29px;
  object-fit: contain;
  filter: invert(46%) sepia(92%) saturate(2835%) hue-rotate(194deg)
    brightness(102%) contrast(101%);
}

.equipment-name {
  font-size: 13px;
  font-weight: 600;
  color: #1c1c1e;
}

.equipment-action-count {
  color: #8e8e93;
  font-size: 10px;
  line-height: 13px;
}

.equipment-card.needs-setup .equipment-action-count {
  color: #2684d9;
  font-weight: 600;
}

@media (hover: hover) {
  .equipment-card:hover:not(.is-pressed) {
    transform: translateY(-1px);
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.98),
      inset -1px -1px 0 rgba(164, 173, 184, 0.1),
      -5px -5px 11px rgba(255, 255, 255, 0.94),
      6px 6px 13px rgba(153, 162, 173, 0.3);
  }
}

.page-indicator {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
}

.equipment-section.single-row .equipment-swipe {
  height: 92px;
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
  position: absolute;
  right: 24px;
  bottom: calc(20px + env(safe-area-inset-bottom));
  z-index: 4;
  display: flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 8px 24px rgba(30, 35, 45, 0.18),
    0 2px 6px rgba(30, 35, 45, 0.12);
  color: #007aff;
  cursor: pointer;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.records-share-button svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.records-share-button:active:not(:disabled) {
  transform: scale(0.92);
  box-shadow:
    0 4px 12px rgba(30, 35, 45, 0.16),
    0 1px 3px rgba(30, 35, 45, 0.12);
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

.records-empty {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 220px;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  isolation: isolate;
}

.records-empty-date {
  position: relative;
  z-index: 0;
  margin-bottom: 30px;
  background: linear-gradient(
    180deg,
    rgba(0, 122, 255, 0.16) 0%,
    rgba(31, 112, 190, 0.065) 62%,
    rgba(31, 112, 190, 0) 100%
  );
  background-clip: text;
  color: transparent;
  font-size: clamp(96px, 28vw, 116px);
  font-stretch: ultra-condensed;
  font-variant-numeric: tabular-nums;
  font-family:
    "DIN Condensed",
    "Arial Narrow",
    "Roboto Condensed",
    "SF Pro Display",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  font-weight: 420;
  letter-spacing: -0.025em;
  line-height: 1;
  white-space: nowrap;
  transform: scaleX(0.72) scaleY(1.42);
  transform-origin: center;
  user-select: none;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: records-empty-date-reveal 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.records-empty p {
  position: relative;
  z-index: 1;
  margin: 0;
  color: #7c7c80;
  font-size: 16px;
  font-weight: 550;
  letter-spacing: -0.15px;
  line-height: 24px;
  animation: records-empty-greeting-reveal 620ms ease 140ms both;
}

@keyframes records-empty-date-reveal {
  from {
    opacity: 0;
    transform: translateY(8px) scaleX(0.7) scaleY(1.34);
  }

  to {
    opacity: 1;
    transform: translateY(0) scaleX(0.72) scaleY(1.42);
  }
}

@keyframes records-empty-greeting-reveal {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
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
    margin-top: 4px;
    margin-bottom: 6px;
    padding-top: 12px;
    padding-bottom: 10px;
    top: 0;
  }

  .equipment-section-header {
    margin-bottom: 8px;
  }

  .equipment-swipe {
    height: 168px;
  }

  .equipment-section.single-row .equipment-swipe {
    height: 86px;
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
  .primary-page-account-button--sync-nudge {
    background: rgba(31, 62, 91, 0.94);
    box-shadow:
      0 5px 18px rgba(0, 0, 0, 0.22),
      0 1px 3px rgba(0, 0, 0, 0.18);
  }

  .sync-login-nudge-label {
    color: #70b8ff;
  }

  .sync-login-nudge-dot {
    border-color: #3a3a3c;
  }

  .sync-indicator {
    border-color: #3a3a3c;
  }

  .home-page {
    background: #1c1c1e;
  }

  .equipment-section {
    background: rgba(44, 44, 46, 0.22);
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.035);
  }

  .equipment-section-header h2 {
    color: #aeaeb2;
  }

  .equipment-manage-button {
    color: #0a84ff;
  }

  .equipment-card {
    border-color: rgba(255, 255, 255, 0.075);
    background: #303033;
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.055),
      inset -1px -1px 0 rgba(0, 0, 0, 0.18),
      -4px -4px 9px rgba(255, 255, 255, 0.025),
      5px 5px 11px rgba(0, 0, 0, 0.32);
  }

  .equipment-card:active,
  .equipment-card.is-pressed {
    background: #2b2b2e;
    box-shadow:
      inset 3px 3px 7px rgba(0, 0, 0, 0.24),
      inset -3px -3px 7px rgba(255, 255, 255, 0.025);
  }

  .equipment-card:hover:not(.is-pressed) {
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.065),
      inset -1px -1px 0 rgba(0, 0, 0, 0.16),
      -5px -5px 11px rgba(255, 255, 255, 0.03),
      6px 6px 13px rgba(0, 0, 0, 0.36);
  }

  .equipment-name {
    color: #fff;
  }

  .equipment-action-count {
    color: #8e8e93;
  }

  .records-title {
    color: #fff;
  }

  .records-empty-date {
    background: linear-gradient(
      180deg,
      rgba(100, 169, 243, 0.2) 0%,
      rgba(100, 169, 243, 0.075) 62%,
      rgba(100, 169, 243, 0) 100%
    );
    background-clip: text;
    -webkit-background-clip: text;
  }

  .records-empty p {
    color: #a6a6aa;
  }

  .records-view-switch button.active {
    background: #48484a;
    color: #fff;
  }

  .records-share-button {
    background: rgba(58, 58, 60, 0.96);
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.34),
      0 2px 6px rgba(0, 0, 0, 0.24);
    color: #0a84ff;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-page-account-button,
  .sync-login-nudge-label {
    transition-duration: 0.01ms;
  }

  .sync-login-nudge-dot,
  .primary-page-account-button--sync-nudge::after {
    animation: none;
  }

  .equipment-section-header h2 span {
    opacity: 0;
    animation: none;
    -webkit-mask-image: none;
    mask-image: none;
  }

  .equipment-section-header h2 .equipment-title-choice {
    opacity: 1;
  }

  .records-empty-date,
  .records-empty p {
    animation: none;
  }
}
</style>
