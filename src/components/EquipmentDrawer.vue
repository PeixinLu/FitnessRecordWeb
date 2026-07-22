<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useExerciseStore } from "@/stores/exercise";
import { useRecordStore } from "@/stores/record";
import SetPicker from "@/components/SetPicker.vue";
import SetDetailsEditor from "@/components/SetDetailsEditor.vue";
import ImmersiveSheet from "@/components/ImmersiveSheet.vue";
import { showToast } from "vant";
import { getTemplateFields, type TemplateFieldKey } from "@/utils/dataTemplate";

interface Props {
  show: boolean;
  equipmentId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:show": [value: boolean];
  close: [];
  saved: [];
  "nested-editor-open": [value: boolean];
  "open-equipment-management": [];
}>();

const exerciseStore = useExerciseStore();
const recordStore = useRecordStore();

// 当前器械
const currentEquipment = computed(() =>
  exerciseStore.equipments.find((e) => e.id === props.equipmentId),
);

// 该器械下的动作列表
const exerciseList = computed(() =>
  exerciseStore.exercises.filter((e) => e.equipmentId === props.equipmentId),
);

// 当前选中的动作
const selectedExerciseId = ref("");
const selectedExercise = computed(() =>
  exerciseList.value.find((e) => e.id === selectedExerciseId.value),
);

// 当前页面（0: 选择动作/组数，1: 编辑组详情）
const currentPage = ref(0);
const nestedEditorOpen = ref(false);

type TemplateValues = Record<TemplateFieldKey, number>;

function createDefaultValues(): TemplateValues {
  return { reps: 12, sets: 4, weight: 0, duration: 30, distance: 1 };
}

const formValues = ref<TemplateValues>(createDefaultValues());
const templateFields = computed(() =>
  getTemplateFields(selectedExercise.value?.dataTemplate ?? "weight-reps"),
);
const detailFields = computed(() =>
  templateFields.value.filter((field) => field.key !== "sets"),
);

// 组详情数据
interface SetDetail {
  id: string;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
}

const setDetails = ref<SetDetail[]>([]);

// ===== 初始化 =====
watch(
  () => props.show,
  (show) => {
    if (!show) nestedEditorOpen.value = false;
    if (show && props.equipmentId) {
      currentPage.value = 0;
      if (exerciseList.value.length > 0) {
        selectedExerciseId.value = exerciseList.value[0].id;
      }
      formValues.value = createDefaultValues();
      setDetails.value = [];
    }
  },
);

function onNestedEditorVisibility(visible: boolean) {
  nestedEditorOpen.value = visible;
  emit("nested-editor-open", visible);
}

// ===== 滚轮变化 =====
function onPickerChange(values: TemplateValues) {
  formValues.value = values;
}

// ===== 页面切换 =====
function goToPage2() {
  if (!selectedExerciseId.value) {
    showToast("请先选择动作");
    return;
  }

  setDetails.value = Array.from({ length: formValues.value.sets }, (_, i) => {
    const detail: SetDetail = { id: `set-${Date.now()}-${i}` };
    detailFields.value.forEach((field) => {
      (detail as Partial<TemplateValues>)[field.key] =
        formValues.value[field.key];
    });
    return detail;
  });

  currentPage.value = 1;
}

function goToPage1() {
  currentPage.value = 0;
}

function updateSet(id: string, changes: Partial<SetDetail>) {
  const detail = setDetails.value.find((item) => item.id === id);
  if (detail) Object.assign(detail, changes);
}

function deleteSet(id: string) {
  setDetails.value = setDetails.value.filter((detail) => detail.id !== id);
}

// ===== 保存记录 =====
async function saveRecord() {
  if (!selectedExercise.value) {
    showToast("请先选择动作");
    return;
  }

  for (const detail of setDetails.value) {
    await recordStore.addRecord({
      date: recordStore.getTodayDate(),
      exerciseId: selectedExercise.value.id,
      exerciseName: selectedExercise.value.name,
      sets: 1,
      reps: detail.reps,
      weight: detail.weight && detail.weight > 0 ? detail.weight : undefined,
      duration: detail.duration,
      distance: detail.distance,
    });
  }

  showToast("记录已保存");
  emit("saved");
  emit("update:show", false);
}

// ===== 关闭抽屉 =====
function closeDrawer() {
  emit("update:show", false);
  emit("close");
}
</script>

<template>
  <ImmersiveSheet
    :show="props.show"
    height="80%"
    :radius="24"
    swipe-handle="[data-sheet-swipe-handle]"
    aria-label="记录训练"
    @update:show="emit('update:show', $event)"
  >
    <div
      class="drawer-container"
      :class="{ 'nested-drawer-open': nestedEditorOpen }"
    >
      <!-- 页面切换容器 -->
      <div
        class="pages-wrapper"
        :style="{ transform: `translateX(-${currentPage * 50}%)` }"
      >
        <!-- 第一页：选择动作和组数 -->
        <div class="page page-1">
          <header
            class="drawer-header drawer-header--with-action"
            data-sheet-swipe-handle
          >
            <h2 class="equipment-title">{{ currentEquipment?.name }}</h2>
            <button
              class="header-icon-btn"
              @click="emit('open-equipment-management')"
            >
              <van-icon name="setting-o" size="20" />
            </button>
          </header>

          <section class="exercise-section">
            <div class="exercise-cards">
              <div
                v-for="exercise in exerciseList"
                :key="exercise.id"
                v-smooth-corners="12"
                class="exercise-card"
                :class="{ selected: exercise.id === selectedExerciseId }"
                @click="selectedExerciseId = exercise.id"
              >
                <span class="exercise-name">{{ exercise.name }}</span>
              </div>
            </div>
          </section>

          <section class="picker-section">
            <SetPicker
              :fields="templateFields"
              :values="formValues"
              @change="onPickerChange"
            />
          </section>

          <footer class="drawer-footer">
            <button
              v-smooth-corners="12"
              class="btn btn-secondary"
              @click="closeDrawer"
            >
              取消
            </button>
            <button
              v-smooth-corners="12"
              class="btn btn-primary"
              @click="goToPage2"
            >
              确认
              <span class="btn-arrow">→</span>
            </button>
          </footer>
        </div>

        <!-- 第二页：编辑组详情 -->
        <div class="page page-2">
          <header class="drawer-header" data-sheet-swipe-handle>
            <h2 class="detail-title">
              {{ selectedExercise?.name }} · {{ setDetails.length }}组
            </h2>
          </header>

          <SetDetailsEditor
            :sets="setDetails"
            :fields="templateFields"
            @update="updateSet"
            @delete="deleteSet"
            @editor-visibility="onNestedEditorVisibility"
          />

          <footer class="drawer-footer">
            <button
              v-smooth-corners="12"
              class="btn btn-secondary"
              @click="goToPage1"
            >
              <span class="btn-arrow">←</span>
              上一页
            </button>
            <button
              v-smooth-corners="12"
              class="btn btn-primary"
              @click="saveRecord"
            >
              记录
              <span class="btn-check">✓</span>
            </button>
          </footer>
        </div>
      </div>
    </div>
  </ImmersiveSheet>

</template>

<style scoped>
.drawer-container {
  height: 100%;
  background: #fff;
  overflow: hidden;
  border-radius: 24px;
  transform-origin: top center;
  transition: transform 0.28s ease;
}

.drawer-container.nested-drawer-open {
  transform: translateY(8px) scale3d(0.965, 0.965, 1);
}

.pages-wrapper {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 0.3s ease;
}

.page {
  width: 50%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ===== 第一页 ===== */
.drawer-header {
  padding: 16px 20px;
  text-align: center;
  position: relative;
}

.drawer-header--with-action {
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon-btn {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #007aff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.header-icon-btn:active {
  background: rgba(0, 122, 255, 0.1);
}

.equipment-title {
  font-size: 22px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0;
}

.exercise-section {
  padding: 0 20px;
}

.exercise-cards {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 12px;
  -webkit-overflow-scrolling: touch;
}

.exercise-cards::-webkit-scrollbar {
  display: none;
}

.exercise-card {
  flex-shrink: 0;
  padding: 12px 20px;
  background: #f5f5f7;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: transform 0.1s ease; /* 背景/边框瞬时切换，仅缩放保留过渡 */
  -webkit-tap-highlight-color: transparent;
}

.exercise-card:active {
  transform: scale(0.96);
}

.exercise-card.selected {
  background: rgba(0, 122, 255, 0.1);
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.25); /* 外发光点亮 */
}

.exercise-name {
  font-size: 15px;
  font-weight: 500;
  color: #1c1c1e;
}

.picker-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ===== 第二页 ===== */
.detail-title {
  font-size: 20px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0;
}

.sets-section {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

.set-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f5f5f7;
  border-radius: 12px;
  margin-bottom: 8px;
}

.set-label {
  font-size: 15px;
  font-weight: 500;
  color: #1c1c1e;
}

.set-detail {
  font-size: 14px;
  color: #8e8e93;
}

.edit-icon {
  color: #007aff;
}

/* ===== 底部按钮 ===== */
.drawer-footer {
  padding: 16px;
  display: flex;
  gap: 12px;
  background: #fff;
}

.btn {
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  flex: 0.35;
  background: #f5f5f7;
  color: #8e8e93;
}

.btn-primary {
  flex: 0.65;
  background: #007aff;
  color: #fff;
  padding-right: 28px; /* 视觉居中补偿：箭头 → 视觉重量轻，右 padding 多 4px */
}

.btn-arrow,
.btn-check {
  margin-left: 2px;
}

.btn-primary:active {
  background: #0051d5;
}

/* ===== 编辑弹窗 ===== */
.edit-set-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f5f5f7;
}

.edit-title {
  font-size: 17px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0;
}

.edit-cancel {
  font-size: 16px;
  color: #8e8e93;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
}

.edit-save {
  font-size: 16px;
  color: #007aff;
  font-weight: 500;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
}

.edit-wheels {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
}

/* ===== 深色模式 ===== */
@media (prefers-color-scheme: dark) {
  .drawer-container,
  .edit-set-popup {
    background: #2c2c2e;
  }

  .equipment-title,
  .detail-title,
  .exercise-name,
  .set-label,
  .edit-title {
    color: #fff;
  }

  .exercise-card {
    background: #3a3a3c;
  }

  .exercise-card.selected {
    background: rgba(10, 132, 255, 0.2);
    border-color: #0a84ff;
    box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.3);
  }

  .set-item,
  .btn-secondary {
    background: #3a3a3c;
  }

  .drawer-footer,
  .edit-header {
    background: #2c2c2e;
    border-top-color: #3a3a3c;
  }

  .btn-primary,
  .edit-save {
    background: #0a84ff;
    color: #fff;
  }

  .edit-cancel {
    color: #8e8e93;
  }

  .header-icon-btn {
    color: #0a84ff;
  }

  .header-icon-btn:active {
    background: rgba(10, 132, 255, 0.15);
  }
}
</style>
