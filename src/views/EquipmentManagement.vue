<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { useExerciseStore } from '@/stores/exercise'
import { EQUIPMENT_CASES, normalizeEquipmentName, type EquipmentCase } from '@/data/equipmentCases'

const router = useRouter()
const exerciseStore = useExerciseStore()
const showEditor = ref(false)
const editingId = ref<string>()
const equipmentName = ref('')
const showCaseLibrary = ref(false)
const selectedCase = ref<EquipmentCase>()
const selectedActionIds = ref<string[]>([])

const editorTitle = computed(() => editingId.value ? '编辑器械' : '新增器械')

function exerciseCount(equipmentId: string): number {
  return exerciseStore.exercises.filter(exercise => exercise.equipmentId === equipmentId).length
}

function openCreate() {
  editingId.value = undefined
  equipmentName.value = ''
  showEditor.value = true
}

function openEdit(id: string, name: string) {
  editingId.value = id
  equipmentName.value = name
  showEditor.value = true
}

async function saveEquipment() {
  const name = equipmentName.value.trim()
  if (!name) {
    showToast('请输入器械名称')
    return
  }
  try {
    if (editingId.value) {
      await exerciseStore.updateEquipment(editingId.value, name)
    } else {
      await exerciseStore.addEquipment(name)
    }
    showEditor.value = false
    showToast('已保存')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  }
}

function openCaseActions(equipmentCase: EquipmentCase) {
  if (isCaseComplete(equipmentCase)) return
  selectedCase.value = equipmentCase
  selectedActionIds.value = equipmentCase.actions
    .filter(action => !isActionAdded(equipmentCase, action.id))
    .map(action => action.id)
}

function getCaseEquipment(equipmentCase: EquipmentCase) {
  const normalizedName = normalizeEquipmentName(equipmentCase.name)
  return exerciseStore.equipments.find(item =>
    (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName
  )
}

function isActionAdded(equipmentCase: EquipmentCase, actionId: string): boolean {
  const equipment = getCaseEquipment(equipmentCase)
  const action = equipmentCase.actions.find(item => item.id === actionId)
  if (!equipment || !action) return false
  const normalizedName = normalizeEquipmentName(action.name)
  return exerciseStore.exercises.some(item =>
    item.equipmentId === equipment.id &&
    (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName
  )
}

function isCaseComplete(equipmentCase: EquipmentCase): boolean {
  return equipmentCase.actions.every(action => isActionAdded(equipmentCase, action.id))
}

function toggleCaseAction(actionId: string) {
  if (!selectedCase.value || isActionAdded(selectedCase.value, actionId)) return
  selectedActionIds.value = selectedActionIds.value.includes(actionId)
    ? selectedActionIds.value.filter(id => id !== actionId)
    : [...selectedActionIds.value, actionId]
}

async function addSelectedCase() {
  if (!selectedCase.value) return
  await exerciseStore.addCaseEquipment(selectedCase.value, selectedActionIds.value)
  showCaseLibrary.value = false
  selectedCase.value = undefined
  showToast('已添加到常用器械')
}

async function removeEquipment(id: string) {
  try {
    await showConfirmDialog({ title: '删除器械', message: '删除后，该器械下的所有动作也会被删除。' })
    await exerciseStore.deleteEquipment(id)
    showToast('已删除')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="management-page">
    <van-nav-bar title="器械动作管理" left-arrow @click-left="router.back()" />
    <van-cell-group inset title="我的器械">
      <van-empty v-if="exerciseStore.equipments.length === 0" description="还没有常用器械" />
      <van-swipe-cell v-for="equipment in exerciseStore.equipments" :key="equipment.id">
        <van-cell
          :title="equipment.name"
          :label="`${exerciseCount(equipment.id)} 个动作`"
          is-link
          @click="router.push(`/equipment-management/${equipment.id}`)"
        />
        <template #right>
          <van-button square type="primary" text="编辑" @click="openEdit(equipment.id, equipment.name)" />
          <van-button square type="danger" text="删除" @click="removeEquipment(equipment.id)" />
        </template>
      </van-swipe-cell>
    </van-cell-group>
    <div class="action-buttons">
      <van-button block plain type="primary" icon="apps-o" @click="showCaseLibrary = true">从案例库添加</van-button>
      <van-button block type="primary" icon="plus" @click="openCreate">新建器械</van-button>
    </div>

    <van-dialog v-model:show="showEditor" :title="editorTitle" show-cancel-button @confirm="saveEquipment">
      <van-field v-model="equipmentName" label="器械名称" placeholder="例如：跑步机" autofocus />
    </van-dialog>

    <van-popup v-model:show="showCaseLibrary" position="bottom" round :style="{ height: '78%' }">
      <div class="case-library">
        <template v-if="!selectedCase">
          <van-nav-bar title="案例库" right-text="关闭" @click-right="showCaseLibrary = false" />
          <van-cell-group inset title="选择器械案例">
            <van-cell
              v-for="equipmentCase in EQUIPMENT_CASES"
              :key="equipmentCase.id"
              :title="equipmentCase.name"
              :label="isCaseComplete(equipmentCase) ? '已添加全部动作' : `${equipmentCase.actions.length} 个预设动作`"
              :is-link="!isCaseComplete(equipmentCase)"
              :class="{ 'case-disabled': isCaseComplete(equipmentCase) }"
              @click="openCaseActions(equipmentCase)"
            />
          </van-cell-group>
        </template>
        <template v-else>
          <van-nav-bar :title="selectedCase.name" left-arrow right-text="返回" @click-left="selectedCase = undefined" @click-right="selectedCase = undefined" />
          <van-cell-group inset title="选择要添加的动作">
            <van-checkbox-group v-model="selectedActionIds">
              <van-cell
                v-for="action in selectedCase.actions"
                :key="action.id"
                :clickable="!isActionAdded(selectedCase, action.id)"
                :class="{ 'case-disabled': isActionAdded(selectedCase, action.id) }"
                @click="toggleCaseAction(action.id)"
              >
                <template #title>{{ action.name }}</template>
                <template #label>{{ isActionAdded(selectedCase, action.id) ? '已添加' : `${action.muscleGroup} · ${action.dataTemplate === 'weight-reps' ? '次数 + 重量' : action.dataTemplate}` }}</template>
                <template #right-icon><van-checkbox :name="action.id" :disabled="isActionAdded(selectedCase, action.id)" /></template>
              </van-cell>
            </van-checkbox-group>
          </van-cell-group>
          <van-button class="case-add-button" block type="primary" :disabled="selectedActionIds.length === 0" @click="addSelectedCase">添加到我的器械</van-button>
        </template>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.management-page { min-height: 100vh; padding-bottom: 116px; }
.action-buttons { position: fixed; bottom: 88px; left: 16px; width: calc(100% - 32px); display: grid; gap: 8px; }
.case-library { min-height: 100%; background: #f5f5f7; padding-bottom: 76px; }
.case-add-button { position: fixed; bottom: 16px; left: 16px; width: calc(100% - 32px); }
.case-disabled { opacity: 0.48; }
</style>
