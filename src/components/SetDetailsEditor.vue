<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  formatRecordDetail,
  type TemplateField,
  type TemplateFieldKey,
} from "@/utils/dataTemplate";
import NumberWheelPicker from "@/components/NumberWheelPicker.vue";
import ImmersiveSheet from "@/components/ImmersiveSheet.vue";

export interface EditableSetDetail {
  id: string;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
}

type TemplateValues = Record<TemplateFieldKey, number>;

const props = defineProps<{
  sets: EditableSetDetail[];
  fields: TemplateField[];
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
}>();

const emit = defineEmits<{
  update: [id: string, changes: Partial<EditableSetDetail>];
  delete: [id: string];
  "editor-visibility": [visible: boolean];
}>();

const editingId = ref("");
const showEditor = ref(false);
const editingValues = ref<TemplateValues>({
  reps: 12,
  sets: 1,
  weight: 0,
  duration: 30,
  distance: 1,
});
const originalValues = ref<TemplateValues>({
  reps: 12,
  sets: 1,
  weight: 0,
  duration: 30,
  distance: 1,
});
const detailFields = computed(() =>
  props.fields.filter((field) => field.key !== "sets"),
);

const hasChanges = computed(() =>
  detailFields.value.some(
    (field) =>
      editingValues.value[field.key] !== originalValues.value[field.key],
  ),
);

watch(showEditor, (visible) => emit("editor-visibility", visible));
const editValue = computed<number[]>({
  get: () => detailFields.value.map((field) => editingValues.value[field.key]),
  set: (values) => {
    const next = { ...editingValues.value };
    detailFields.value.forEach((field, index) => {
      next[field.key] = values[index] ?? next[field.key];
    });
    editingValues.value = next;
  },
});

function openEditor(detail: EditableSetDetail) {
  editingId.value = detail.id;
  const initial = {
    reps: 12,
    sets: 1,
    weight: 0,
    duration: 30,
    distance: 1,
    ...detail,
  };
  editingValues.value = { ...initial };
  originalValues.value = { ...initial };
  showEditor.value = true;
}

function saveEditor() {
  const changes: Partial<EditableSetDetail> = {};
  detailFields.value.forEach((field) => {
    (changes as Partial<TemplateValues>)[field.key] =
      editingValues.value[field.key];
  });
  emit("update", editingId.value, changes);
  showEditor.value = false;
}
</script>

<template>
  <section
    class="sets-section"
    :style="{
      paddingTop: `${props.contentPaddingTop ?? 0}px`,
      paddingBottom: `${props.contentPaddingBottom ?? 0}px`,
    }"
  >
    <van-swipe-cell v-for="(detail, index) in sets" :key="detail.id">
      <div v-smooth-corners="12" class="set-item" @click="openEditor(detail)">
        <span class="set-label">第{{ index + 1 }}组</span>
        <span class="set-detail">{{
          formatRecordDetail({ sets: 1, ...detail })
        }}</span>
        <van-icon name="edit" class="edit-icon" />
      </div>
      <template #right>
        <van-button
          v-smooth-corners="12"
          class="delete-set-button"
          type="danger"
          text="删除"
          @click="emit('delete', detail.id)"
        />
      </template>
    </van-swipe-cell>
    <van-empty v-if="sets.length === 0" description="没有组数据" />
  </section>

  <ImmersiveSheet
    v-model:show="showEditor"
    position="bottom"
    height="60%"
    :radius="24"
    :footer-safe-space="96"
    :z-index="2020"
    swipe-handle=".immersive-sheet-header"
    aria-label="编辑组别"
  >
    <template #header>
      编辑组别
    </template>

    <template #default="{ headerSafeSpace, footerSafeSpace }">
      <div
        class="edit-set-popup"
        :style="{
          paddingTop: `${headerSafeSpace}px`,
          paddingBottom: `${footerSafeSpace}px`,
        }"
      >
        <div class="edit-wheels" data-sheet-swipe-ignore>
          <NumberWheelPicker
            v-model="editValue"
            :count="detailFields.length"
            :units="detailFields.map((field) => field.unit)"
            :ranges="detailFields.map((field) => field.range)"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="edit-footer">
        <button class="edit-cancel" @click="showEditor = false">取消</button>
        <button
          class="edit-save"
          :class="{ show: hasChanges }"
          @click="saveEditor"
        >
          保存
        </button>
      </div>
    </template>
  </ImmersiveSheet>
</template>

<style scoped>
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
.delete-set-button {
  height: 100%;
  min-height: 100%;
  margin-left: 8px;
  padding: 0 22px;
  border-radius: 12px;
}
.edit-set-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}
.edit-wheels {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  overflow: hidden;
}
.edit-footer {
  display: flex;
  width: 100%;
  gap: 12px;
}
.edit-cancel {
  flex: 1;
  padding: 12px 24px;
  border: 0;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  background: #f5f5f7;
  color: #8e8e93;
}
.edit-save {
  flex: 0;
  max-width: 0;
  padding: 12px 0;
  border: 0;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  background: #007aff;
  color: #fff;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  transition:
    flex 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    padding 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease-out;
}
.edit-save.show {
  flex: 1;
  max-width: 160px;
  padding: 12px 24px;
  opacity: 1;
}

@media (prefers-color-scheme: dark) {
  .edit-set-popup {
    background: #2c2c2e;
  }
  .edit-cancel {
    background: #3a3a3c;
  }
  .edit-save {
    background: #0a84ff;
  }
}
</style>
