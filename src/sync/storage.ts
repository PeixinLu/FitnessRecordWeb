import { db } from '@/db/database'
import {
  equipmentUpsertMutation,
  exerciseUpsertMutation,
  recordUpsertMutation,
} from '@/repositories/fitnessRepository'
import type { DataTemplate, Equipment, Exercise, MuscleGroup, WorkoutRecord } from '@/types'
import {
  syncProtocolVersion,
  type SyncChange,
  type SyncEntityType,
  type SyncOutboxItem,
  type SyncResponse,
  type SyncSnapshot,
  type SyncSnapshotEntity,
} from '@/sync/types'

const muscleGroups: MuscleGroup[] = ['胸', '背', '腿', '肩', '臂', '核心', '全身']
const dataTemplates: DataTemplate[] = [
  'weight-reps',
  'reps',
  'duration',
  'distance-duration',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}

function validateCommonPayload(
  entity: SyncSnapshotEntity,
): Record<string, unknown> {
  if (!isRecord(entity.payload) || entity.payload.id !== entity.entityId) {
    throw new Error('SYNC_SNAPSHOT_ENTITY_INVALID')
  }
  return entity.payload
}

function decodeEquipment(entity: SyncSnapshotEntity): Equipment {
  const payload = validateCommonPayload(entity)
  if (
    typeof payload.id !== 'string'
    || typeof payload.name !== 'string'
    || !isOptionalString(payload.normalizedName)
    || !isOptionalString(payload.icon)
    || !isOptionalNumber(payload.order)
    || (payload.source !== undefined && !['manual', 'case'].includes(String(payload.source)))
  ) {
    throw new Error('SYNC_EQUIPMENT_INVALID')
  }
  return payload as unknown as Equipment
}

function decodeExercise(entity: SyncSnapshotEntity): Exercise {
  const payload = validateCommonPayload(entity)
  if (
    typeof payload.id !== 'string'
    || typeof payload.name !== 'string'
    || typeof payload.equipmentId !== 'string'
    || !muscleGroups.includes(payload.muscleGroup as MuscleGroup)
    || !dataTemplates.includes(payload.dataTemplate as DataTemplate)
    || !isOptionalString(payload.normalizedName)
    || !isOptionalNumber(payload.order)
    || (payload.source !== undefined && !['manual', 'case'].includes(String(payload.source)))
  ) {
    throw new Error('SYNC_EXERCISE_INVALID')
  }
  return payload as unknown as Exercise
}

function decodeWorkoutRecord(entity: SyncSnapshotEntity): WorkoutRecord {
  const payload = validateCommonPayload(entity)
  if (
    typeof payload.id !== 'string'
    || typeof payload.date !== 'string'
    || typeof payload.exerciseId !== 'string'
    || typeof payload.exerciseName !== 'string'
    || typeof payload.sets !== 'number'
    || typeof payload.createdAt !== 'number'
    || !isOptionalNumber(payload.reps)
    || !isOptionalNumber(payload.weight)
    || !isOptionalNumber(payload.duration)
    || !isOptionalNumber(payload.distance)
    || !isOptionalString(payload.notes)
  ) {
    throw new Error('SYNC_WORKOUT_RECORD_INVALID')
  }
  return payload as unknown as WorkoutRecord
}

export function decodeSnapshot(
  revision: number,
  entities: SyncSnapshotEntity[],
): SyncSnapshot {
  const snapshot: SyncSnapshot = {
    revision,
    equipments: [],
    exercises: [],
    records: [],
  }
  const seen = new Set<string>()
  for (const entity of entities) {
    const key = `${entity.entityType}:${entity.entityId}`
    if (seen.has(key)) throw new Error('SYNC_SNAPSHOT_DUPLICATE_ENTITY')
    seen.add(key)
    if (entity.entityType === 'equipment') {
      snapshot.equipments.push(decodeEquipment(entity))
    } else if (entity.entityType === 'exercise') {
      snapshot.exercises.push(decodeExercise(entity))
    } else if (entity.entityType === 'workoutRecord') {
      snapshot.records.push(decodeWorkoutRecord(entity))
    } else {
      throw new Error('SYNC_ENTITY_TYPE_INVALID')
    }
  }
  return snapshot
}

function tableForEntity(entityType: SyncEntityType) {
  if (entityType === 'equipment') return db.equipments
  if (entityType === 'exercise') return db.exercises
  return db.records
}

async function applyOutboxTarget(mutation: SyncOutboxItem): Promise<void> {
  const table = tableForEntity(mutation.entityType)
  if (mutation.operation === 'delete') {
    await table.delete(mutation.entityId)
    return
  }
  if (!mutation.payload) return
  const decoded = decodeSnapshot(0, [{
    entityType: mutation.entityType,
    entityId: mutation.entityId,
    payload: mutation.payload,
  }])
  if (mutation.entityType === 'equipment') await db.equipments.put(decoded.equipments[0])
  if (mutation.entityType === 'exercise') await db.exercises.put(decoded.exercises[0])
  if (mutation.entityType === 'workoutRecord') await db.records.put(decoded.records[0])
}

async function applyRemoteChange(change: SyncChange): Promise<void> {
  const key = `${change.entityType}:${change.entityId}`
  const pending = await db.syncOutbox.get(key)
  if (pending) {
    if (pending.mutationId === change.mutationId) {
      await db.syncOutbox.delete(key)
    }
    return
  }
  const table = tableForEntity(change.entityType)
  if (change.operation === 'delete') {
    await table.delete(change.entityId)
    return
  }
  const decoded = decodeSnapshot(0, [{
    entityType: change.entityType,
    entityId: change.entityId,
    payload: change.payload ?? {},
  }])
  if (change.entityType === 'equipment') await db.equipments.put(decoded.equipments[0])
  if (change.entityType === 'exercise') await db.exercises.put(decoded.exercises[0])
  if (change.entityType === 'workoutRecord') await db.records.put(decoded.records[0])
}

export async function applySyncResponse(
  userId: string,
  response: SyncResponse,
  submitted: SyncOutboxItem[],
): Promise<void> {
  if (response.protocolVersion !== syncProtocolVersion) {
    throw new Error('SYNC_PROTOCOL_VERSION_UNSUPPORTED')
  }
  const acknowledged = new Set(response.acknowledged)
  await db.transaction(
    'rw',
    [db.equipments, db.exercises, db.records, db.syncOutbox, db.syncState],
    async () => {
      for (const mutation of submitted) {
        if (!acknowledged.has(mutation.mutationId)) continue
        const current = await db.syncOutbox.get(mutation.key)
        if (current?.mutationId === mutation.mutationId) {
          await db.syncOutbox.delete(mutation.key)
        }
      }
      for (const change of response.changes) await applyRemoteChange(change)
      await db.syncState.put({
        id: 'current',
        userId,
        cursor: response.cursor,
        lastSyncedAt: Date.now(),
      })
    },
  )
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`
  }
  return JSON.stringify(value)
}

function assertNoMergeConflicts<T extends { id: string }>(
  local: T[],
  remote: T[],
): void {
  const remoteById = new Map(remote.map(entity => [entity.id, entity]))
  for (const entity of local) {
    const remoteEntity = remoteById.get(entity.id)
    if (remoteEntity && stableStringify(remoteEntity) !== stableStringify(entity)) {
      throw new Error('SYNC_ENTITY_ID_CONFLICT')
    }
  }
}

export async function replaceWithCloudSnapshot(
  userId: string,
  snapshot: SyncSnapshot,
  preserveOutbox: boolean,
): Promise<void> {
  await db.transaction(
    'rw',
    [db.equipments, db.exercises, db.records, db.syncOutbox, db.syncState],
    async () => {
      const outbox = preserveOutbox ? await db.syncOutbox.toArray() : []
      await Promise.all([
        db.equipments.clear(),
        db.exercises.clear(),
        db.records.clear(),
      ])
      await db.equipments.bulkPut(snapshot.equipments)
      await db.exercises.bulkPut(snapshot.exercises)
      await db.records.bulkPut(snapshot.records)
      if (!preserveOutbox) await db.syncOutbox.clear()

      for (const mutation of outbox) await applyOutboxTarget(mutation)
      await db.syncState.put({
        id: 'current',
        userId,
        cursor: snapshot.revision,
        lastSyncedAt: Date.now(),
      })
    },
  )
}

export async function mergeLocalWithCloudSnapshot(
  userId: string,
  snapshot: SyncSnapshot,
): Promise<void> {
  const [localEquipments, localExercises, localRecords] = await Promise.all([
    db.equipments.toArray(),
    db.exercises.toArray(),
    db.records.toArray(),
  ])
  assertNoMergeConflicts(localEquipments, snapshot.equipments)
  assertNoMergeConflicts(localExercises, snapshot.exercises)
  assertNoMergeConflicts(localRecords, snapshot.records)

  const remoteEquipmentIds = new Set(snapshot.equipments.map(entity => entity.id))
  const remoteExerciseIds = new Set(snapshot.exercises.map(entity => entity.id))
  const remoteRecordIds = new Set(snapshot.records.map(entity => entity.id))

  await db.transaction(
    'rw',
    [db.equipments, db.exercises, db.records, db.syncOutbox, db.syncState],
    async () => {
      await db.equipments.bulkPut(snapshot.equipments)
      await db.exercises.bulkPut(snapshot.exercises)
      await db.records.bulkPut(snapshot.records)
      for (const entity of localEquipments) {
        await db.equipments.put(entity)
        if (!remoteEquipmentIds.has(entity.id)) {
          await db.syncOutbox.put(equipmentUpsertMutation(entity))
        }
      }
      for (const entity of localExercises) {
        await db.exercises.put(entity)
        if (!remoteExerciseIds.has(entity.id)) {
          await db.syncOutbox.put(exerciseUpsertMutation(entity))
        }
      }
      for (const entity of localRecords) {
        await db.records.put(entity)
        if (!remoteRecordIds.has(entity.id)) {
          await db.syncOutbox.put(recordUpsertMutation(entity))
        }
      }
      const pendingTargets = await db.syncOutbox.toArray()
      for (const mutation of pendingTargets) await applyOutboxTarget(mutation)
      await db.syncState.put({
        id: 'current',
        userId,
        cursor: snapshot.revision,
        lastSyncedAt: Date.now(),
      })
    },
  )
}
