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
    this.version(3).stores({
      equipments: 'id, name, order',
      exercises: 'id, name, equipmentId, muscleGroup',
      records: 'id, date, exerciseId, createdAt',
    }).upgrade(async tx => {
      // Backfill order for existing equipment based on creation order (id contains timestamp)
      const all = await tx.table('equipments').toArray()
      all.sort((a, b) => a.id.localeCompare(b.id))
      for (let i = 0; i < all.length; i++) {
        await tx.table('equipments').update(all[i].id, { order: i })
      }
    })
    this.version(4).stores({
      equipments: 'id, name, order',
      exercises: 'id, name, equipmentId, muscleGroup, order',
      records: 'id, date, exerciseId, createdAt',
    }).upgrade(async tx => {
      const all = await tx.table('exercises').toArray()
      const equipmentIds = [...new Set(all.map(exercise => exercise.equipmentId))]
      for (const equipmentId of equipmentIds) {
        const equipmentExercises = all
          .filter(exercise => exercise.equipmentId === equipmentId)
          .sort((a, b) => a.id.localeCompare(b.id))
        for (let i = 0; i < equipmentExercises.length; i++) {
          await tx.table('exercises').update(equipmentExercises[i].id, { order: i })
        }
      }
    })
  }
}

export const db = new FitnessDatabase()

// 常用器械由用户手动创建或从案例库添加，初始状态保持空白。
export async function initDefaultData() {}
