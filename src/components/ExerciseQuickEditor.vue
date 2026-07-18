<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue"
import { useExerciseStore } from "@/stores/exercise"
import { showConfirmDialog, showToast } from "vant"
import { getTemplateLabel } from "@/utils/dataTemplate"
import type { Exercise, MuscleGroup, DataTemplate } from "@/types"

interface Props {
  show: boolean
  equipmentId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  "update:show": [value: boolean]
  close: []
  changed: []
}>()

const exerciseStore = useExerciseStore()

const exerciseList = computed(() =>
  exerciseStore.exercises.filter((e) => e.equipmentId === props.equipmentId),
)

// --- Editing state ---
type EditMode = "idle" | "editing" | "adding"
const editMode = ref<EditMode>("idle")
const editingExercise = ref<Exercise | null>(null)
const exerciseName = ref("")
const inputRef = ref<HTMLInputElement | null>(null)
const isCheckClick = ref(false)

function onInputBlur() {
  // 延时让 ✓ 按钮的 click 事件先触发，避免 blur 抢先清空输入
  setTimeout(() => {
    if (!isCheckClick.value && editMode.value !== "idle") {
      cancelEdit()
    }
    isCheckClick.value = false
  }, 150)
}

// --- Reset on popup close ---
watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      editMode.value = "idle"
      editingExercise.value = null
      exerciseName.value = ""
    }
  },
)

// --- Actions ---
function openAdd() {
  editMode.value = "adding"
  editingExercise.value = null
  exerciseName.value = ""
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function openEdit(exercise: Exercise) {
  editMode.value = "editing"
  editingExercise.value = exercise
  exerciseName.value = exercise.name
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

async function saveExercise() {
  const name = exerciseName.value.trim()
  if (!name) {
    cancelEdit()
    return
  }
  try {
    if (editMode.value === "editing" && editingExercise.value) {
      await exerciseStore.updateExercise(editingExercise.value.id, {
        name,
        equipmentId: props.equipmentId,
        muscleGroup: editingExercise.value.muscleGroup,
        dataTemplate: editingExercise.value.dataTemplate,
      })
    } else if (editMode.value === "adding") {
      await exerciseStore.addExercise({
        name,
        equipmentId: props.equipmentId,
        muscleGroup: "胸" as MuscleGroup,
        dataTemplate: "weight-reps" as DataTemplate,
      })
    }
    cancelEdit()
    emit("changed")
    showToast("已保存")
  } catch (error) {
    showToast(error instanceof Error ? error.message : "保存失败")
  }
}

function cancelEdit() {
  editMode.value = "idle"
  editingExercise.value = null
  exerciseName.value = ""
}

async function removeExercise(id: string) {
  try {
    await showConfirmDialog({
      title: "删除动作",
      message: "确定要删除这个动作吗？",
    })
    await exerciseStore.deleteExercise(id)
    if (editingExercise.value?.id === id) cancelEdit()
    emit("changed")
    showToast("已删除")
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <van-popup
    :show="props.show"
    v-smooth-corners="24"
    teleport="body"
    position="bottom"
    round
    :overlay-style="{ background: 'rgba(0, 0, 0, 0.2)' }"
    :style="{
      width: 'calc(100% - 16px)',
      left: '8px',
      bottom: '8px',
      height: '80%',
      borderRadius: '24px',
      background: 'transparent',
      '--van-ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
      '--van-ease-in': 'cubic-bezier(0.16, 1, 0.3, 1)',
    }"
    @update:show="emit('update:show', $event)"
  >
    <div class="manager-container">
      <!-- Header -->
      <header class="manager-header">
        <h2 class="manager-title">管理动作</h2>
        <button
          v-smooth-corners="22"
          class="add-fab"
          @click="openAdd"
          aria-label="新增动作"
        >
          <van-icon name="plus" size="20" color="#fff" />
        </button>
      </header>

      <!-- Exercise List -->
      <section class="exercise-list">
        <van-empty
          v-if="exerciseList.length === 0"
          description="暂无动作，点击右上角 + 添加"
        />

        <van-swipe-cell
          v-for="exercise in exerciseList"
          :key="exercise.id"
        >
          <div
            v-smooth-corners="12"
            class="manager-exercise-card"
            :class="{
              'manager-exercise-card--editing':
                editMode === 'editing' && editingExercise?.id === exercise.id,
            }"
            @click="openEdit(exercise)"
          >
            <div class="exercise-info">
              <span class="exercise-name">{{ exercise.name }}</span>
              <span class="exercise-meta">
                {{ exercise.muscleGroup }} · {{ getTemplateLabel(exercise.dataTemplate) }}
              </span>
            </div>
          </div>

          <template #right>
            <van-button
              v-smooth-corners="12"
              class="delete-exercise-btn"
              type="danger"
              text="删除"
              @click="removeExercise(exercise.id)"
            />
          </template>
        </van-swipe-cell>
      </section>

      <!-- Inline input bar at bottom of popup -->
      <div
        v-if="editMode !== 'idle'"
        v-smooth-corners="12"
        class="input-bar"
      >
        <input
          ref="inputRef"
          v-model="exerciseName"
          type="text"
          class="name-input"
          :placeholder="editMode === 'adding' ? '输入动作名称' : '编辑动作名称'"
          enterkeyhint="done"
          @keyup.enter="saveExercise"
          @blur="onInputBlur"
        />
        <button
          v-smooth-corners="10"
          class="check-btn"
          :class="{ 'check-btn--active': exerciseName.trim().length > 0 }"
          @touchstart.prevent="isCheckClick = true"
          @mousedown.prevent="isCheckClick = true"
          @click="saveExercise"
          aria-label="保存"
        >
          <van-icon name="success" size="18" color="#fff" />
        </button>
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
/* ===== Container ===== */
.manager-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
}

/* ===== Header ===== */
.manager-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  position: relative;
  border-bottom: 1px solid #f5f5f7;
}

.manager-title {
  font-size: 20px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0;
}

.add-fab {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: none;
  background: #007aff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.add-fab:active {
  transform: translateY(-50%) scale(0.92);
  box-shadow: 0 1px 4px rgba(0, 122, 255, 0.2);
}

/* ===== Exercise List ===== */
.exercise-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  -webkit-overflow-scrolling: touch;
}

.manager-exercise-card {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  background: #f5f5f7;
  border-radius: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.1s ease;
  -webkit-tap-highlight-color: transparent;
}

.manager-exercise-card:active {
  background: #e8e8ea;
}

.manager-exercise-card--editing {
  background: rgba(0, 122, 255, 0.08);
  border: 2px solid rgba(0, 122, 255, 0.3);
  padding: 12px 16px; /* compensate for 2px border */
}

.exercise-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.exercise-name {
  font-size: 16px;
  font-weight: 500;
  color: #1c1c1e;
}

.exercise-meta {
  font-size: 13px;
  color: #8e8e93;
  flex-shrink: 0;
  margin-left: 12px;
}

/* Swipe-cell delete button */
.delete-exercise-btn {
  height: 100%;
  min-height: 100%;
  margin-left: 8px;
  padding: 0 22px;
  border-radius: 12px;
}

/* ===== Inline Input Bar ===== */
.input-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 16px 16px;
  padding: 10px 14px;
  background: #f5f5f7;
  border-radius: 12px;
  flex-shrink: 0;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
}

.name-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px; /* >= 16px to prevent iOS auto-zoom */
  font-family: inherit;
  color: #1c1c1e;
  background: transparent;
  padding: 6px 0;
}

.name-input::placeholder {
  color: #c7c7cc;
}

.check-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: #007aff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.4;
  transition: opacity 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.check-btn--active {
  opacity: 1;
}

.check-btn:active {
  transform: scale(0.92);
}

/* ===== Dark Mode ===== */
@media (prefers-color-scheme: dark) {
  .manager-container {
    background: #2c2c2e;
  }

  .manager-header {
    border-bottom-color: #3a3a3c;
  }

  .manager-title {
    color: #fff;
  }

  .manager-exercise-card {
    background: #3a3a3c;
  }

  .manager-exercise-card:active {
    background: #48484a;
  }

  .manager-exercise-card--editing {
    background: rgba(10, 132, 255, 0.15);
    border-color: rgba(10, 132, 255, 0.4);
  }

  .exercise-name {
    color: #fff;
  }

  .input-bar {
    background: #3a3a3c;
  }

  .name-input {
    color: #fff;
  }

  .add-fab {
    background: #0a84ff;
    box-shadow: 0 2px 8px rgba(10, 132, 255, 0.3);
  }

  .check-btn {
    background: #0a84ff;
  }
}
</style>
