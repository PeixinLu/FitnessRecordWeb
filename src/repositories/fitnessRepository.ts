import { db } from '@/db/database'
import type { Equipment, Exercise, WorkoutRecord } from '@/types'
import type {
  SyncEntity,
  SyncEntityType,
  SyncOperation,
  SyncOutboxItem,
} from '@/sync/types'

export const localDataChangedEvent = 'fitness-record:local-data-changed'

function createMutationId(): string {
  return crypto.randomUUID()
}

function asPayload(entity: SyncEntity): Record<string, unknown> {
  return { ...entity } as Record<string, unknown>
}

function createOutboxItem(
  entityType: SyncEntityType,
  entityId: string,
  operation: SyncOperation,
  payload: Record<string, unknown> | null,
): SyncOutboxItem {
  const now = Date.now()
  return {
    key: `${entityType}:${entityId}`,
    mutationId: createMutationId(),
    entityType,
    entityId,
    operation,
    payload,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
  }
}

function notifyLocalDataChanged(): void {
  window.dispatchEvent(new CustomEvent(localDataChangedEvent))
}

export function equipmentUpsertMutation(equipment: Equipment): SyncOutboxItem {
  return createOutboxItem('equipment', equipment.id, 'upsert', asPayload(equipment))
}

export function exerciseUpsertMutation(exercise: Exercise): SyncOutboxItem {
  return createOutboxItem('exercise', exercise.id, 'upsert', asPayload(exercise))
}

export function recordUpsertMutation(record: WorkoutRecord): SyncOutboxItem {
  return createOutboxItem('workoutRecord', record.id, 'upsert', asPayload(record))
}

export function deleteMutation(
  entityType: SyncEntityType,
  entityId: string,
): SyncOutboxItem {
  return createOutboxItem(entityType, entityId, 'delete', null)
}

export async function addEquipmentWithSync(equipment: Equipment): Promise<void> {
  await db.transaction('rw', db.equipments, db.syncOutbox, async () => {
    await db.equipments.add(equipment)
    await db.syncOutbox.put(equipmentUpsertMutation(equipment))
  })
  notifyLocalDataChanged()
}

export async function updateEquipmentWithSync(
  id: string,
  changes: Partial<Equipment>,
): Promise<void> {
  await db.transaction('rw', db.equipments, db.syncOutbox, async () => {
    await db.equipments.update(id, changes)
    const equipment = await db.equipments.get(id)
    if (equipment) await db.syncOutbox.put(equipmentUpsertMutation(equipment))
  })
  notifyLocalDataChanged()
}

export async function deleteEquipmentWithSync(id: string): Promise<void> {
  await db.transaction(
    'rw',
    db.equipments,
    db.exercises,
    db.syncOutbox,
    async () => {
      const exercises = await db.exercises.where('equipmentId').equals(id).toArray()
      for (const exercise of exercises) {
        await db.syncOutbox.put(deleteMutation('exercise', exercise.id))
      }
      await db.syncOutbox.put(deleteMutation('equipment', id))
      await db.exercises.where('equipmentId').equals(id).delete()
      await db.equipments.delete(id)
    },
  )
  notifyLocalDataChanged()
}

export async function addExerciseWithSync(exercise: Exercise): Promise<void> {
  await db.transaction('rw', db.exercises, db.syncOutbox, async () => {
    await db.exercises.add(exercise)
    await db.syncOutbox.put(exerciseUpsertMutation(exercise))
  })
  notifyLocalDataChanged()
}

export async function updateExerciseWithSync(
  id: string,
  changes: Partial<Exercise>,
): Promise<void> {
  await db.transaction('rw', db.exercises, db.syncOutbox, async () => {
    await db.exercises.update(id, changes)
    const exercise = await db.exercises.get(id)
    if (exercise) await db.syncOutbox.put(exerciseUpsertMutation(exercise))
  })
  notifyLocalDataChanged()
}

export async function deleteExerciseWithSync(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.syncOutbox, async () => {
    await db.syncOutbox.put(deleteMutation('exercise', id))
    await db.exercises.delete(id)
  })
  notifyLocalDataChanged()
}

export async function addRecordWithSync(record: WorkoutRecord): Promise<void> {
  await db.transaction('rw', db.records, db.syncOutbox, async () => {
    await db.records.add(record)
    await db.syncOutbox.put(recordUpsertMutation(record))
  })
  notifyLocalDataChanged()
}

export async function updateRecordWithSync(
  id: string,
  changes: Partial<Omit<WorkoutRecord, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.transaction('rw', db.records, db.syncOutbox, async () => {
    await db.records.update(id, changes)
    const record = await db.records.get(id)
    if (record) await db.syncOutbox.put(recordUpsertMutation(record))
  })
  notifyLocalDataChanged()
}

export async function deleteRecordWithSync(id: string): Promise<void> {
  await db.transaction('rw', db.records, db.syncOutbox, async () => {
    await db.syncOutbox.put(deleteMutation('workoutRecord', id))
    await db.records.delete(id)
  })
  notifyLocalDataChanged()
}

export async function replaceEquipmentOrderWithSync(
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.equipments, db.syncOutbox, async () => {
    for (let order = 0; order < orderedIds.length; order += 1) {
      const id = orderedIds[order]
      await db.equipments.update(id, { order })
      const equipment = await db.equipments.get(id)
      if (equipment) await db.syncOutbox.put(equipmentUpsertMutation(equipment))
    }
  })
  notifyLocalDataChanged()
}

export async function replaceExerciseOrderWithSync(
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.exercises, db.syncOutbox, async () => {
    for (let order = 0; order < orderedIds.length; order += 1) {
      const id = orderedIds[order]
      await db.exercises.update(id, { order })
      const exercise = await db.exercises.get(id)
      if (exercise) await db.syncOutbox.put(exerciseUpsertMutation(exercise))
    }
  })
  notifyLocalDataChanged()
}

export async function resetAllDataWithSync(): Promise<void> {
  await db.transaction(
    'rw',
    db.records,
    db.exercises,
    db.equipments,
    db.syncOutbox,
    async () => {
      const [records, exercises, equipments] = await Promise.all([
        db.records.toArray(),
        db.exercises.toArray(),
        db.equipments.toArray(),
      ])
      for (const record of records) {
        await db.syncOutbox.put(deleteMutation('workoutRecord', record.id))
      }
      for (const exercise of exercises) {
        await db.syncOutbox.put(deleteMutation('exercise', exercise.id))
      }
      for (const equipment of equipments) {
        await db.syncOutbox.put(deleteMutation('equipment', equipment.id))
      }
      await db.records.clear()
      await db.exercises.clear()
      await db.equipments.clear()
    },
  )
  notifyLocalDataChanged()
}

export async function enqueueAllLocalEntities(): Promise<void> {
  await db.transaction(
    'rw',
    db.records,
    db.exercises,
    db.equipments,
    db.syncOutbox,
    async () => {
      const [records, exercises, equipments] = await Promise.all([
        db.records.toArray(),
        db.exercises.toArray(),
        db.equipments.toArray(),
      ])
      for (const equipment of equipments) {
        await db.syncOutbox.put(equipmentUpsertMutation(equipment))
      }
      for (const exercise of exercises) {
        await db.syncOutbox.put(exerciseUpsertMutation(exercise))
      }
      for (const record of records) {
        await db.syncOutbox.put(recordUpsertMutation(record))
      }
    },
  )
  notifyLocalDataChanged()
}

export async function getLocalEntityCount(): Promise<number> {
  const counts = await Promise.all([
    db.equipments.count(),
    db.exercises.count(),
    db.records.count(),
  ])
  return counts.reduce((total, count) => total + count, 0)
}

export async function addCaseEntitiesWithSync(
  equipment: Equipment | null,
  exercises: Exercise[],
): Promise<void> {
  await db.transaction(
    'rw',
    db.equipments,
    db.exercises,
    db.syncOutbox,
    async () => {
      if (equipment) {
        await db.equipments.add(equipment)
        await db.syncOutbox.put(equipmentUpsertMutation(equipment))
      }
      for (const exercise of exercises) {
        await db.exercises.add(exercise)
        await db.syncOutbox.put(exerciseUpsertMutation(exercise))
      }
    },
  )
  notifyLocalDataChanged()
}
