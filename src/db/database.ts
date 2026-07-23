import Dexie, { type Table } from 'dexie'
import type { Equipment, Exercise, WorkoutRecord } from '@/types'
import type { SyncLease, SyncOutboxItem, SyncState } from '@/sync/types'

class FitnessDatabase extends Dexie {
  equipments!: Table<Equipment>
  exercises!: Table<Exercise>
  records!: Table<WorkoutRecord>
  syncOutbox!: Table<SyncOutboxItem>
  syncState!: Table<SyncState>
  syncLease!: Table<SyncLease>

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
    this.version(5).stores({
      equipments: 'id, name, order',
      exercises: 'id, name, equipmentId, muscleGroup, order',
      records: 'id, date, exerciseId, createdAt',
      syncOutbox: 'key, mutationId, nextAttemptAt, createdAt',
      syncState: 'id, userId',
    })
    this.version(6).stores({
      equipments: 'id, name, order',
      exercises: 'id, name, equipmentId, muscleGroup, order',
      records: 'id, date, exerciseId, createdAt',
      syncOutbox: 'key, mutationId, nextAttemptAt, createdAt',
      syncState: 'id, userId',
      syncLease: 'id, expiresAt',
    })
  }
}

export const db = new FitnessDatabase()

// 常用器械由用户手动创建或从案例库添加，初始状态保持空白。
export async function initDefaultData() {}
