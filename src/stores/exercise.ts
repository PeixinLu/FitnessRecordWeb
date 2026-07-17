import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, initDefaultData } from '@/db/database'
import type { Equipment, Exercise, MuscleGroup, DataTemplate } from '@/types'
import { normalizeEquipmentName, type EquipmentCase } from '@/data/equipmentCases'

interface ExerciseInput {
  name: string
  equipmentId: string
  muscleGroup: MuscleGroup
  dataTemplate: DataTemplate
}

export const useExerciseStore = defineStore('exercise', () => {
  const equipments = ref<Equipment[]>([])
  const exercises = ref<Exercise[]>([])
  const selectedEquipmentId = ref<string>('')
  const selectedExerciseId = ref<string>('')

  // 根据器械筛选动作
  const filteredExercises = computed(() => {
    if (!selectedEquipmentId.value) return exercises.value
    return exercises.value.filter(e => e.equipmentId === selectedEquipmentId.value)
  })

  // 当前选中的器械
  const selectedEquipment = computed(() =>
    equipments.value.find(e => e.id === selectedEquipmentId.value)
  )

  // 当前选中的动作
  const selectedExercise = computed(() =>
    exercises.value.find(e => e.id === selectedExerciseId.value)
  )

  // 加载所有器械和动作
  async function loadData() {
    await initDefaultData()
    equipments.value = await db.equipments.toArray()
    exercises.value = await db.exercises.toArray()
  }

  function createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  async function addEquipment(name: string) {
    const normalizedName = normalizeEquipmentName(name)
    if (equipments.value.some(item => (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)) {
      throw new Error('器械名称已存在')
    }
    await db.equipments.add({ id: createId('equipment'), name, normalizedName, source: 'manual' })
    await loadData()
  }

  async function updateEquipment(id: string, name: string) {
    const normalizedName = normalizeEquipmentName(name)
    if (equipments.value.some(item => item.id !== id && (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)) {
      throw new Error('器械名称已存在')
    }
    await db.equipments.update(id, { name, normalizedName })
    await loadData()
  }

  async function deleteEquipment(id: string) {
    await db.transaction('rw', db.equipments, db.exercises, async () => {
      await db.exercises.where('equipmentId').equals(id).delete()
      await db.equipments.delete(id)
    })
    if (selectedEquipmentId.value === id) selectedEquipmentId.value = ''
    if (exercises.value.some(exercise => exercise.equipmentId === id && exercise.id === selectedExerciseId.value)) {
      selectedExerciseId.value = ''
    }
    await loadData()
  }

  async function addExercise(input: ExerciseInput) {
    const normalizedName = normalizeEquipmentName(input.name)
    if (exercises.value.some(item => item.equipmentId === input.equipmentId && (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)) {
      throw new Error('动作名称已存在')
    }
    await db.exercises.add({ id: createId('exercise'), ...input, normalizedName, source: 'manual' })
    await loadData()
  }

  async function updateExercise(id: string, input: ExerciseInput) {
    const normalizedName = normalizeEquipmentName(input.name)
    if (exercises.value.some(item => item.id !== id && item.equipmentId === input.equipmentId && (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)) {
      throw new Error('动作名称已存在')
    }
    await db.exercises.update(id, { ...input, normalizedName })
    await loadData()
  }

  async function deleteExercise(id: string) {
    await db.exercises.delete(id)
    if (selectedExerciseId.value === id) selectedExerciseId.value = ''
    await loadData()
  }

  async function addCaseEquipment(equipmentCase: EquipmentCase, actionIds: string[]) {
    const normalizedName = normalizeEquipmentName(equipmentCase.name)
    let target = equipments.value.find(item => (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)
    if (!target) {
      target = {
        id: createId('equipment'),
        name: equipmentCase.name,
        normalizedName,
        icon: equipmentCase.icon,
        source: 'case',
      }
      await db.equipments.add(target)
    }
    const selectedActions = equipmentCase.actions.filter(action => actionIds.includes(action.id))
    for (const action of selectedActions) {
      const actionName = normalizeEquipmentName(action.name)
      const exists = exercises.value.some(item => item.equipmentId === target.id && (item.normalizedName ?? normalizeEquipmentName(item.name)) === actionName)
      if (!exists) {
        await db.exercises.add({
          id: createId('exercise'),
          name: action.name,
          normalizedName: actionName,
          equipmentId: target.id,
          muscleGroup: action.muscleGroup,
          dataTemplate: action.dataTemplate,
          source: 'case',
        })
      }
    }
    await loadData()
  }

  async function resetAllData() {
    await db.transaction('rw', db.records, db.exercises, db.equipments, async () => {
      await db.records.clear()
      await db.exercises.clear()
      await db.equipments.clear()
    })
    selectedEquipmentId.value = ''
    selectedExerciseId.value = ''
    await loadData()
  }

  return {
    equipments,
    exercises,
    selectedEquipmentId,
    selectedExerciseId,
    filteredExercises,
    selectedEquipment,
    selectedExercise,
    loadData,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    addExercise,
    updateExercise,
    deleteExercise,
    addCaseEquipment,
    resetAllData,
  }
})
