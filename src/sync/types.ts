import type { Equipment, Exercise, WorkoutRecord } from '@/types'

export const syncProtocolVersion = 1

export type SyncEntityType = 'equipment' | 'exercise' | 'workoutRecord'
export type SyncOperation = 'upsert' | 'delete'
export type SyncEntity = Equipment | Exercise | WorkoutRecord

export interface SyncOutboxItem {
  key: string
  mutationId: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: Record<string, unknown> | null
  createdAt: number
  attempts: number
  nextAttemptAt: number
}

export interface SyncState {
  id: 'current'
  userId: string
  cursor: number
  lastSyncedAt?: number
}

export interface SyncLease {
  id: 'sync'
  ownerId: string
  expiresAt: number
}

export interface SyncStatusResponse {
  protocolVersion: number
  revision: number
  entityCount: number
  hasCloudData: boolean
}

export interface SyncSnapshotEntity {
  entityType: SyncEntityType
  entityId: string
  payload: Record<string, unknown>
}

export interface SyncSnapshotPage {
  protocolVersion: number
  snapshotRevision: number
  entities: SyncSnapshotEntity[]
  next: {
    afterType: SyncEntityType
    afterId: string
  } | null
}

export interface SyncChange {
  revision: number
  mutationId: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncOperation
  payload: Record<string, unknown> | null
}

export interface SyncResponse {
  protocolVersion: number
  status: 'ok' | 'pull_required'
  acknowledged: string[]
  cursor: number
  currentRevision: number
  changes: SyncChange[]
  hasMore: boolean
}

export interface SyncSnapshot {
  revision: number
  equipments: Equipment[]
  exercises: Exercise[]
  records: WorkoutRecord[]
}
