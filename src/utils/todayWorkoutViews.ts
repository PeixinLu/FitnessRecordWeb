import type { Equipment, Exercise, MuscleGroup, WorkoutRecord } from '@/types'
import { getEquipmentIcon } from '@/utils/equipmentIcon'

export type TodayWorkoutViewMode = 'exercise' | 'timeline'

export interface TodayWorkoutSetItem {
  record: WorkoutRecord
  detail: string
  savedTime: string
}

export interface TodayWorkoutExerciseItem {
  exerciseId: string
  exerciseName: string
  muscleGroup?: MuscleGroup
  equipmentIcon?: string
  sets: TodayWorkoutSetItem[]
}

export interface TodayWorkoutTimelineItem extends TodayWorkoutSetItem {
  exerciseId: string
  exerciseName: string
  muscleGroup?: MuscleGroup
  equipmentIcon?: string
}

function getExerciseMeta(
  exerciseId: string,
  exercises: Exercise[],
  equipments: Equipment[],
) {
  const exercise = exercises.find((item) => item.id === exerciseId)
  const equipment = equipments.find(
    (item) => item.id === exercise?.equipmentId,
  )

  return {
    muscleGroup: exercise?.muscleGroup,
    equipmentIcon: getEquipmentIcon(equipment?.icon),
  }
}

export function formatWorkoutSet(record: WorkoutRecord): string {
  const parts: string[] = []
  if (record.reps !== undefined) parts.push(`${record.reps}次`)
  if (record.weight !== undefined) parts.push(`${record.weight}kg`)
  if (record.distance !== undefined) parts.push(`${record.distance}公里`)
  if (record.duration !== undefined) parts.push(`${record.duration}分钟`)
  return parts.join(' · ') || '未记录数据'
}

export function formatSavedTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp)
}

export function buildTodayWorkoutExerciseItems(
  records: WorkoutRecord[],
  exercises: Exercise[],
  equipments: Equipment[],
): TodayWorkoutExerciseItem[] {
  const groups = new Map<string, TodayWorkoutExerciseItem>()

  records.forEach((record) => {
    let group = groups.get(record.exerciseId)
    if (!group) {
      group = {
        exerciseId: record.exerciseId,
        exerciseName: record.exerciseName,
        ...getExerciseMeta(record.exerciseId, exercises, equipments),
        sets: [],
      }
      groups.set(record.exerciseId, group)
    }
    group.sets.push({
      record,
      detail: formatWorkoutSet(record),
      savedTime: formatSavedTime(record.createdAt),
    })
  })

  return [...groups.values()].map((group) => ({
    ...group,
    sets: [...group.sets].sort(
      (left, right) => left.record.createdAt - right.record.createdAt,
    ),
  }))
}

export function buildTodayWorkoutTimelineItems(
  records: WorkoutRecord[],
  exercises: Exercise[],
  equipments: Equipment[],
): TodayWorkoutTimelineItem[] {
  return [...records]
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((record) => ({
      record,
      exerciseId: record.exerciseId,
      exerciseName: record.exerciseName,
      ...getExerciseMeta(record.exerciseId, exercises, equipments),
      detail: formatWorkoutSet(record),
      savedTime: formatSavedTime(record.createdAt),
    }))
}
