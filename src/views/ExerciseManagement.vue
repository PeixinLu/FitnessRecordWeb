<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useExerciseStore } from '@/stores/exercise'
import { MUSCLE_GROUPS, type DataTemplate, type MuscleGroup } from '@/types'
import { DATA_TEMPLATE_OPTIONS, getTemplateLabel } from '@/utils/dataTemplate'

const route = useRoute()
const router = useRouter()
const exerciseStore = useExerciseStore()
const equipmentId = computed(() => String(route.params.equipmentId))
const equipment = computed(() => exerciseStore.equipments.find(item => item.id === equipmentId.value))
const exercises = computed(() => exerciseStore.exercises.filter(item => item.equipmentId === equipmentId.value))
const showEditor = ref(false)
const editingId = ref<string>()
const exerciseName = ref('')
const muscleGroup = ref<MuscleGroup>('胸')
const dataTemplate = ref<DataTemplate>('weight-reps')
const editorTitle = computed(() => editingId.value ? '编辑动作' : '新增动作')

function openCreate() {
  editingId.value = undefined
  exerciseName.value = ''
  muscleGroup.value = '胸'
  dataTemplate.value = 'weight-reps'
  showEditor.value = true
}

function openEdit(id: string) {
  const exercise = exercises.value.find(item => item.id === id)
  if (!exercise) return
  editingId.value = id
  exerciseName.value = exercise.name
  muscleGroup.value = exercise.muscleGroup
  dataTemplate.value = exercise.dataTemplate
  showEditor.value = true
}

async function saveExercise() {
  const name = exerciseName.value.trim()
  if (!name) {
    showToast('请输入动作名称')
    return
  }
  const input = { name, equipmentId: equipmentId.value, muscleGroup: muscleGroup.value, dataTemplate: dataTemplate.value }
  try {
    if (editingId.value) {
      await exerciseStore.updateExercise(editingId.value, input)
    } else {
      await exerciseStore.addExercise(input)
    }
    showEditor.value = false
    showToast('已保存')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  }
}

async function removeExercise(id: string) {
  try {
    await showConfirmDialog({ title: '删除动作', message: '确定要删除这个动作吗？' })
    await exerciseStore.deleteExercise(id)
    showToast('已删除')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="management-page">
    <van-nav-bar :title="equipment?.name || '动作管理'" left-arrow @click-left="router.back()" />
    <van-cell-group inset title="动作">
      <van-empty v-if="!equipment" description="器械不存在" />
      <van-empty v-else-if="exercises.length === 0" description="暂无动作" />
      <van-swipe-cell v-for="exercise in exercises" :key="exercise.id">
        <van-cell :title="exercise.name" :label="`${exercise.muscleGroup} · ${getTemplateLabel(exercise.dataTemplate)}`" />
        <template #right>
          <van-button square type="primary" text="编辑" @click="openEdit(exercise.id)" />
          <van-button square type="danger" text="删除" @click="removeExercise(exercise.id)" />
        </template>
      </van-swipe-cell>
    </van-cell-group>
    <van-button v-if="equipment" class="add-button" block type="primary" icon="plus" @click="openCreate">新增动作</van-button>

    <van-dialog v-model:show="showEditor" :title="editorTitle" show-cancel-button @confirm="saveExercise">
      <van-cell-group inset>
        <van-field v-model="exerciseName" label="动作名称" placeholder="例如：跑步" />
        <van-cell title="肌群">
          <template #value>
            <van-radio-group v-model="muscleGroup" direction="horizontal">
              <van-radio v-for="group in MUSCLE_GROUPS" :key="group" :name="group">{{ group }}</van-radio>
            </van-radio-group>
          </template>
        </van-cell>
        <van-cell title="数据模板">
          <template #label>
            <van-radio-group v-model="dataTemplate">
              <van-radio v-for="option in DATA_TEMPLATE_OPTIONS" :key="option.value" :name="option.value">{{ option.label }}</van-radio>
            </van-radio-group>
          </template>
        </van-cell>
      </van-cell-group>
    </van-dialog>
  </div>
</template>

<style scoped>
.management-page { min-height: 100vh; padding-bottom: 92px; }
.add-button { position: fixed; bottom: 88px; left: 16px; width: calc(100% - 32px); }
</style>
