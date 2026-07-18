<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { showConfirmDialog, showToast } from "vant";
import { useRecordStore } from "@/stores/record";
import type { WorkoutRecord } from "@/types";
import type { TemplateField } from "@/utils/dataTemplate";
import SetDetailsEditor from "@/components/SetDetailsEditor.vue";

const route = useRoute();
const router = useRouter();
const recordStore = useRecordStore();
const props = defineProps<{
  date?: string;
  exerciseId?: string;
  embedded?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  "nested-editor-open": [value: boolean];
}>();
const nestedEditorOpen = ref(false);
const date = computed(() => props.date ?? String(route.params.date));
const exerciseId = computed(
  () => props.exerciseId ?? String(route.params.exerciseId),
);
const records = computed(() =>
  recordStore.records
    .filter(
      (record) =>
        record.date === date.value && record.exerciseId === exerciseId.value,
    )
    .sort((a, b) => a.createdAt - b.createdAt),
);
const exerciseName = computed(
  () => records.value[0]?.exerciseName ?? "训练详情",
);
function closeDetail() {
  if (props.embedded) {
    emit("close");
  } else {
    router.back();
  }
}

function onNestedEditorVisibility(visible: boolean) {
  nestedEditorOpen.value = visible;
  emit("nested-editor-open", visible);
}

const detailFields: TemplateField[] = [
  { key: "reps", unit: "次", range: [1, 50] },
  { key: "weight", unit: "kg", range: [0, 200] },
];

async function updateSet(id: string, changes: Partial<WorkoutRecord>) {
  await recordStore.updateRecord(id, {
    reps: changes.reps,
    weight: changes.weight && changes.weight > 0 ? changes.weight : undefined,
  });
  showToast("已保存");
}

async function removeRecord(id: string) {
  try {
    await showConfirmDialog({
      title: "删除组别",
      message: "确定要删除这一组吗？",
    });
    await recordStore.deleteRecord(id);
    if (records.value.length === 0) closeDetail();
    showToast("已删除");
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div
    class="drawer-container"
    :class="{ 'nested-drawer-open': nestedEditorOpen }"
  >
    <div class="page">
      <header class="drawer-header">
        <h2 class="detail-title">
          {{ exerciseName }} · {{ records.length }}组
        </h2>
      </header>

      <SetDetailsEditor
        :sets="records"
        :fields="detailFields"
        @update="updateSet"
        @delete="removeRecord"
        @editor-visibility="onNestedEditorVisibility"
      />

      <footer class="drawer-footer">
        <button
          v-smooth-corners="12"
          class="btn btn-secondary"
          @click="closeDetail"
        >
          取消
        </button>
        <button
          v-smooth-corners="12"
          class="btn btn-primary"
          @click="closeDetail"
        >
          完成
          <span class="btn-check">✓</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.drawer-container {
  height: 100%;
  overflow: hidden;
  background: #fff;
  border-radius: 24px;
  transform-origin: top center;
  transition: transform 0.28s ease;
}
.drawer-container.nested-drawer-open {
  transform: translateY(8px) scale3d(0.965, 0.965, 1);
}
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.drawer-header {
  padding: 16px 20px 16px;
  text-align: center;
}
.detail-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1c1c1e;
}
.drawer-footer {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
}
.btn {
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
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
}
.btn-primary:active {
  background: #0051d5;
}
.btn-check {
  margin-left: 4px;
}

@media (prefers-color-scheme: dark) {
  .drawer-container,
  .drawer-footer {
    background: #2c2c2e;
  }
  .detail-title {
    color: #fff;
  }
  .drawer-footer {
    border-top-color: #3a3a3c;
  }
  .btn-secondary {
    background: #3a3a3c;
  }
  .btn-primary {
    background: #0a84ff;
  }
}
</style>
