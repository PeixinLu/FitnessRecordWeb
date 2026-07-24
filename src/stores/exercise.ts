import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, initDefaultData } from '@/db/database'
import type {
  DataTemplate,
  Equipment,
  Exercise,
  MuscleGroup,
  WeightProfile,
} from '@/types'
import { normalizeEquipmentName, type EquipmentCase } from '@/data/equipmentCases'
import {
  addCaseEntitiesWithSync,
  addEquipmentWithSync,
  addExerciseWithSync,
  deleteEquipmentWithSync,
  deleteExerciseWithSync,
  replaceEquipmentOrderWithSync,
  replaceExerciseOrderWithSync,
  resetAllDataWithSync,
  updateEquipmentWithSync,
  updateExerciseWithSync,
} from '@/repositories/fitnessRepository'

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
    const eqs = await db.equipments.toArray()
    eqs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    equipments.value = eqs
    const exs = await db.exercises.toArray()
    exs.sort((a, b) => {
      if (a.equipmentId !== b.equipmentId) {
        return a.equipmentId.localeCompare(b.equipmentId)
      }
      return (a.order ?? 0) - (b.order ?? 0)
    })
    exercises.value = exs
  }

  function createId(): string {
    return crypto.randomUUID()
  }

  async function addEquipment(name: string, weightProfile?: WeightProfile) {
    const normalizedName = normalizeEquipmentName(name)
    if (equipments.value.some(item => (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)) {
      throw new Error('器械名称已存在')
    }
    const maxOrder = equipments.value.reduce((max, eq) => Math.max(max, eq.order ?? 0), -1)
    const id = createId()
    await addEquipmentWithSync({
      id,
      name,
      normalizedName,
      source: 'manual',
      order: maxOrder + 1,
      weightProfile,
    })
    await loadData()
    return id
  }

  async function updateEquipment(
    id: string,
    name: string,
    weightProfile?: WeightProfile,
  ) {
    const normalizedName = normalizeEquipmentName(name)
    if (equipments.value.some(item => item.id !== id && (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)) {
      throw new Error('器械名称已存在')
    }
    await updateEquipmentWithSync(id, { name, normalizedName, weightProfile })
    await loadData()
  }

  async function deleteEquipment(id: string) {
    await deleteEquipmentWithSync(id)
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
    const maxOrder = exercises.value
      .filter(exercise => exercise.equipmentId === input.equipmentId)
      .reduce((max, exercise) => Math.max(max, exercise.order ?? 0), -1)
    const id = createId()
    await addExerciseWithSync({
      id,
      ...input,
      normalizedName,
      source: 'manual',
      order: maxOrder + 1,
    })
    await loadData()
    return id
  }

  async function updateExercise(id: string, input: ExerciseInput) {
    const normalizedName = normalizeEquipmentName(input.name)
    if (exercises.value.some(item => item.id !== id && item.equipmentId === input.equipmentId && (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)) {
      throw new Error('动作名称已存在')
    }
    await updateExerciseWithSync(id, { ...input, normalizedName })
    await loadData()
  }

  async function deleteExercise(id: string) {
    await deleteExerciseWithSync(id)
    if (selectedExerciseId.value === id) selectedExerciseId.value = ''
    await loadData()
  }

  async function addCaseEquipment(equipmentCase: EquipmentCase, actionIds: string[]) {
    const normalizedName = normalizeEquipmentName(equipmentCase.name)
    let target = equipments.value.find(item => (item.normalizedName ?? normalizeEquipmentName(item.name)) === normalizedName)
    let newEquipment: Equipment | null = null
    if (!target) {
      const maxOrder = equipments.value.reduce((max, eq) => Math.max(max, eq.order ?? 0), -1)
      target = {
        id: createId(),
        name: equipmentCase.name,
        normalizedName,
        icon: equipmentCase.icon,
        source: 'case',
        order: maxOrder + 1,
      }
      newEquipment = target
    }
    const selectedActions = equipmentCase.actions.filter(action => actionIds.includes(action.id))
    let nextOrder = exercises.value
      .filter(exercise => exercise.equipmentId === target.id)
      .reduce((max, exercise) => Math.max(max, exercise.order ?? 0), -1) + 1
    const newExercises: Exercise[] = []
    for (const action of selectedActions) {
      const actionName = normalizeEquipmentName(action.name)
      const exists = exercises.value.some(item => item.equipmentId === target.id && (item.normalizedName ?? normalizeEquipmentName(item.name)) === actionName)
      if (!exists) {
        newExercises.push({
          id: createId(),
          name: action.name,
          normalizedName: actionName,
          equipmentId: target.id,
          muscleGroup: action.muscleGroup,
          dataTemplate: action.dataTemplate,
          source: 'case',
          order: nextOrder++,
        })
      }
    }
    await addCaseEntitiesWithSync(newEquipment, newExercises)
    await loadData()
    return target.id
  }

  async function resetAllData() {
    await resetAllDataWithSync()
    selectedEquipmentId.value = ''
    selectedExerciseId.value = ''
    await loadData()
  }

  async function reorderEquipments(orderedIds: string[]) {
    await replaceEquipmentOrderWithSync(orderedIds)
    // Update local state without full reload
    for (let i = 0; i < orderedIds.length; i++) {
      const eq = equipments.value.find(e => e.id === orderedIds[i])
      if (eq) eq.order = i
    }
    equipments.value.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  async function reorderExercises(equipmentId: string, orderedIds: string[]) {
    const equipmentExerciseIds = new Set(
      exercises.value
        .filter(exercise => exercise.equipmentId === equipmentId)
        .map(exercise => exercise.id),
    )
    const validOrderedIds = orderedIds.filter(id => equipmentExerciseIds.has(id))
    await replaceExerciseOrderWithSync(validOrderedIds)
    for (let i = 0; i < validOrderedIds.length; i++) {
      const exercise = exercises.value.find(item => item.id === validOrderedIds[i])
      if (exercise) exercise.order = i
    }
    exercises.value.sort((a, b) => {
      if (a.equipmentId !== b.equipmentId) {
        return a.equipmentId.localeCompare(b.equipmentId)
      }
      return (a.order ?? 0) - (b.order ?? 0)
    })
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
    reorderEquipments,
    reorderExercises,
  }
})
