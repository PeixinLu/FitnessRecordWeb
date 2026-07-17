import type { WorkoutRecord } from '@/types'

export interface WorkoutGroup {
  exerciseId: string
  exerciseName: string
  records: WorkoutRecord[]
}

export function groupRecordsByExercise(records: WorkoutRecord[]): WorkoutGroup[] {
  const groups = new Map<string, WorkoutGroup>()

  records.forEach(record => {
    const group = groups.get(record.exerciseId)
    if (group) {
      group.records.push(record)
    } else {
      groups.set(record.exerciseId, {
        exerciseId: record.exerciseId,
        exerciseName: record.exerciseName,
        records: [record],
      })
    }
  })

  return [...groups.values()].map(group => ({
    ...group,
    records: [...group.records].sort((a, b) => b.createdAt - a.createdAt),
  }))
}

export function summarizeWorkoutSets(records: WorkoutRecord[]): string {
  const summaries = new Map<string, { values: string[]; count: number }>()

  records.forEach(record => {
    const values = [
      record.reps !== undefined ? `${record.reps}次` : '',
      record.weight !== undefined ? `${record.weight}kg` : '',
      record.duration !== undefined ? `${record.duration}秒` : '',
      record.distance !== undefined ? `${record.distance}km` : '',
    ].filter(Boolean)
    const key = values.join('*') || '未记录数据'
    const summary = summaries.get(key)
    if (summary) summary.count += 1
    else summaries.set(key, { values, count: 1 })
  })

  return [...summaries.values()]
    .map(summary => `${summary.count}组*${summary.values.join('*') || '未记录数据'}`)
    .join(' / ')
}
