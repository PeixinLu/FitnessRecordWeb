<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatRecordDetail, type TemplateField, type TemplateFieldKey } from '@/utils/dataTemplate'
import NumberWheelPicker from '@/components/NumberWheelPicker.vue'

export interface EditableSetDetail {
  id: string
  reps?: number
  weight?: number
  duration?: number
  distance?: number
}

type TemplateValues = Record<TemplateFieldKey, number>

const props = defineProps<{
  sets: EditableSetDetail[]
  fields: TemplateField[]
}>()

const emit = defineEmits<{
  update: [id: string, changes: Partial<EditableSetDetail>]
  delete: [id: string]
  'editor-visibility': [visible: boolean]
}>()

const editingId = ref('')
const showEditor = ref(false)
const editingValues = ref<TemplateValues>({ reps: 12, sets: 1, weight: 0, duration: 30, distance: 1 })
const detailFields = computed(() => props.fields.filter(field => field.key !== 'sets'))

watch(showEditor, visible => emit('editor-visibility', visible))
const editValue = computed<number[]>({
  get: () => detailFields.value.map(field => editingValues.value[field.key]),
  set: values => {
    const next = { ...editingValues.value }
    detailFields.value.forEach((field, index) => {
      next[field.key] = values[index] ?? next[field.key]
    })
    editingValues.value = next
  },
})

function openEditor(detail: EditableSetDetail) {
  editingId.value = detail.id
  editingValues.value = { reps: 12, sets: 1, weight: 0, duration: 30, distance: 1, ...detail }
  showEditor.value = true
}

function saveEditor() {
  const changes: Partial<EditableSetDetail> = {}
  detailFields.value.forEach(field => {
    ;(changes as Partial<TemplateValues>)[field.key] = editingValues.value[field.key]
  })
  emit('update', editingId.value, changes)
  showEditor.value = false
}
</script>

<template>
  <section class="sets-section">
    <van-swipe-cell v-for="(detail, index) in sets" :key="detail.id">
      <div class="set-item" @click="openEditor(detail)">
        <span class="set-label">第{{ index + 1 }}组</span>
        <span class="set-detail">{{ formatRecordDetail({ sets: 1, ...detail }) }}</span>
        <van-icon name="edit" class="edit-icon" />
      </div>
      <template #right>
        <van-button class="delete-set-button" type="danger" text="删除" @click="emit('delete', detail.id)" />
      </template>
    </van-swipe-cell>
    <van-empty v-if="sets.length === 0" description="没有组数据" />
  </section>

  <van-popup v-model:show="showEditor" teleport="body" position="bottom" round :style="{ width: 'calc(100% - 16px)', left: '8px', bottom: '8px', height: '60%', borderRadius: '24px', '--van-ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)', '--van-ease-in': 'cubic-bezier(0.16, 1, 0.3, 1)' }">
    <div class="edit-set-popup">
      <header class="edit-header">
        <button class="edit-cancel" @click="showEditor = false">取消</button>
        <h3 class="edit-title">编辑组别</h3>
        <button class="edit-save" @click="saveEditor">保存</button>
      </header>
      <div class="edit-wheels">
        <NumberWheelPicker
          v-model="editValue"
          :count="detailFields.length"
          :units="detailFields.map(field => field.unit)"
          :ranges="detailFields.map(field => field.range)"
        />
      </div>
    </div>
  </van-popup>
</template>

<style scoped>
.sets-section { flex: 1; overflow-y: auto; padding: 0 20px; }
.set-item { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #f5f5f7; border-radius: 12px; margin-bottom: 8px; }
.set-label { font-size: 15px; font-weight: 500; color: #1c1c1e; }
.set-detail { font-size: 14px; color: #8e8e93; }
.edit-icon { color: #007aff; }
.delete-set-button { height: 100%; min-height: 100%; margin-left: 8px; padding: 0 22px; border-radius: 12px; }
.edit-set-popup { height: 100%; display: flex; flex-direction: column; background: #fff; }
.edit-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f5f5f7; }
.edit-title { margin: 0; font-size: 17px; font-weight: 600; color: #1c1c1e; }
.edit-cancel, .edit-save { padding: 8px; border: 0; background: none; font-size: 16px; cursor: pointer; }
.edit-cancel { color: #8e8e93; }
.edit-save { color: #007aff; font-weight: 500; }
.edit-wheels { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 16px; }
</style>
