import Dexie, { type Table } from 'dexie'
import type { Equipment, Exercise, WorkoutRecord } from '@/types'

class FitnessDatabase extends Dexie {
  equipments!: Table<Equipment>
  exercises!: Table<Exercise>
  records!: Table<WorkoutRecord>

  constructor() {
    super('FitnessRecordDB')
    this.version(1).stores({
      equipments: 'id, name',
      exercises: 'id, name, equipmentId, muscleGroup',
      records: 'id, date, exerciseId, createdAt',
    })
    this.version(2).stores({
      equipments: 'id, name',
      exercises: 'id, name, equipmentId, muscleGroup',
      records: 'id, date, exerciseId, createdAt',
    }).upgrade(async tx => {
      await tx.table('exercises').toCollection().modify(exercise => {
        if (!exercise.dataTemplate) {
          exercise.dataTemplate = 'weight-reps'
        }
      })
    })
  }
}

export const db = new FitnessDatabase()

// 常用器械由用户手动创建或从案例库添加，初始状态保持空白。
export async function initDefaultData() {}
