import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getSyncSnapshotEntities, getSyncStatus, postSync, SyncApiError } from '@/api/sync'
import { db } from '@/db/database'
import {
  enqueueAllLocalEntities,
  getLocalEntityCount,
  localDataChangedEvent,
} from '@/repositories/fitnessRepository'
import {
  applySyncResponse,
  decodeSnapshot,
  mergeLocalWithCloudSnapshot,
  replaceWithCloudSnapshot,
} from '@/sync/storage'
import type { SyncOutboxItem } from '@/sync/types'
import { useExerciseStore } from '@/stores/exercise'
import { useRecordStore } from '@/stores/record'
import { syncProtocolVersion } from '@/sync/types'

type SyncPhase =
  | 'signed-out'
  | 'checking'
  | 'decision-required'
  | 'syncing'
  | 'synced'
  | 'pending'
  | 'error'
  | 'account-mismatch'

const retryDelays = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000]

function getSyncErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return '网络不可用，稍后会自动重试，本地数据已保留'
  if (error instanceof SyncApiError) {
    if (error.status === 401) return '登录已失效，待同步数据已保留'
    if (error.status === 403) return '当前页面来源不受同步服务信任'
    if (error.status === 429) return '同步操作较频繁，稍后会自动重试'
    if (error.status >= 500) return '云端同步服务暂时不可用，稍后会自动重试'
    if (error.code === 'PROTOCOL_VERSION_UNSUPPORTED') return '同步协议已升级，请刷新应用'
  }
  if (error instanceof Error && error.message === 'SYNC_ENTITY_ID_CONFLICT') {
    return '本机和云端存在相同 ID 的不同数据，已停止自动合并'
  }
  if (error instanceof Error && error.message === 'SYNC_USER_CHANGED') {
    return '登录账户已变化，本次同步已停止'
  }
  return error instanceof Error ? error.message : '同步失败，本地数据已保留'
}

export const useSyncStore = defineStore('sync', () => {
  const phase = ref<SyncPhase>('signed-out')
  const pendingCount = ref(0)
  const lastSyncedAt = ref<number>()
  const errorMessage = ref('')
  const currentUserId = ref('')
  const leaseOwnerId = crypto.randomUUID()
  let syncFlight: Promise<void> | null = null
  let debounceTimer: number | undefined
  let retryTimer: number | undefined
  let schedulerStarted = false

  const statusLabel = computed(() => {
    if (phase.value === 'syncing' || phase.value === 'checking') return '正在同步…'
    if (phase.value === 'decision-required') return '需要选择同步方式'
    if (phase.value === 'account-mismatch') return '账户与本机数据不匹配'
    if (phase.value === 'error') return '同步失败'
    if (pendingCount.value > 0) return `待同步 ${pendingCount.value} 项`
    if (phase.value === 'synced') return '已同步'
    return '登录后同步'
  })

  const indicatorTone = computed<'synced' | 'pending' | 'syncing'>(() => {
    if (phase.value === 'syncing' || phase.value === 'checking') return 'syncing'
    if (phase.value === 'synced' && pendingCount.value === 0) return 'synced'
    return 'pending'
  })

  async function refreshLocalStatus(): Promise<void> {
    pendingCount.value = await db.syncOutbox.count()
    const state = await db.syncState.get('current')
    lastSyncedAt.value = state?.lastSyncedAt
    if (
      pendingCount.value > 0
      && !['syncing', 'account-mismatch', 'decision-required', 'error'].includes(phase.value)
    ) {
      phase.value = 'pending'
    }
  }

  async function reloadBusinessStores(): Promise<void> {
    await Promise.all([
      useExerciseStore().loadData(),
      useRecordStore().loadRecords(),
    ])
  }

  async function bindState(userId: string, cursor: number): Promise<void> {
    await db.syncState.put({ id: 'current', userId, cursor })
  }

  async function downloadSnapshot() {
    const rawSnapshot = await getSyncSnapshotEntities()
    return decodeSnapshot(rawSnapshot.revision, rawSnapshot.entities)
  }

  async function recoverSnapshot(
    preserveOutbox = true,
    userId = currentUserId.value,
  ): Promise<void> {
    const snapshot = await downloadSnapshot()
    if (!userId || currentUserId.value !== userId) {
      throw new Error('SYNC_USER_CHANGED')
    }
    await replaceWithCloudSnapshot(userId, snapshot, preserveOutbox)
    await reloadBusinessStores()
  }

  async function markAttemptFailed(
    submitted: SyncOutboxItem[],
    retryAfter?: number,
  ): Promise<void> {
    const now = Date.now()
    await db.transaction('rw', db.syncOutbox, async () => {
      for (const item of submitted) {
        const current = await db.syncOutbox.get(item.key)
        if (current?.mutationId !== item.mutationId) continue
        const attempts = current.attempts + 1
        const delay = retryAfter
          ? retryAfter * 1000
          : retryDelays[Math.min(attempts - 1, retryDelays.length - 1)]
        await db.syncOutbox.update(item.key, {
          attempts,
          nextAttemptAt: now + delay,
        })
      }
    })
  }

  async function performSync(force: boolean): Promise<void> {
    const syncUserId = currentUserId.value
    if (!syncUserId || phase.value === 'decision-required') return
    const state = await db.syncState.get('current')
    if (!state || state.userId !== syncUserId) return
    phase.value = 'syncing'
    errorMessage.value = ''

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const currentState = await db.syncState.get('current')
      if (!currentState) return
      const outbox = force
        ? await db.syncOutbox.orderBy('createdAt').limit(10).toArray()
        : await db.syncOutbox.where('nextAttemptAt').belowOrEqual(Date.now()).limit(10).toArray()
      let response
      try {
        response = await postSync(currentState.cursor, outbox)
      } catch (error) {
        if (
          error instanceof SyncApiError
          && ['SYNC_CURSOR_AHEAD', 'SYNC_CURSOR_EXPIRED', 'CURSOR_INVALID'].includes(error.code)
        ) {
          await recoverSnapshot(true, syncUserId)
          continue
        }
        if (error instanceof SyncApiError && error.status === 401) {
          phase.value = 'signed-out'
          return
        }
        await markAttemptFailed(outbox, error instanceof SyncApiError ? error.retryAfter : undefined)
        throw error
      }

      if (currentUserId.value !== syncUserId) return
      await applySyncResponse(syncUserId, response, outbox)
      if (response.changes.length > 0) await reloadBusinessStores()
      if (response.hasMore || response.cursor < response.currentRevision) continue
      const remaining = await db.syncOutbox.count()
      if (remaining > 0 && (outbox.length > 0 || force)) continue
      break
    }
    await refreshLocalStatus()
    phase.value = pendingCount.value > 0 ? 'pending' : 'synced'
  }

  async function withCrossTabLock(task: () => Promise<void>): Promise<void> {
    if ('locks' in navigator) {
      await navigator.locks.request(
        'fitness-record-sync',
        { mode: 'exclusive', ifAvailable: true },
        async lock => {
          if (lock) await task()
        },
      )
      return
    }
    const acquired = await db.transaction('rw', db.syncLease, async () => {
      const lease = await db.syncLease.get('sync')
      if (lease && lease.expiresAt > Date.now() && lease.ownerId !== leaseOwnerId) {
        return false
      }
      await db.syncLease.put({
        id: 'sync',
        ownerId: leaseOwnerId,
        expiresAt: Date.now() + 5 * 60_000,
      })
      return true
    })
    if (!acquired) return
    try {
      await task()
    } finally {
      await db.transaction('rw', db.syncLease, async () => {
        const lease = await db.syncLease.get('sync')
        if (lease?.ownerId === leaseOwnerId) await db.syncLease.delete('sync')
      })
    }
  }

  function syncNow(force = true): Promise<void> {
    if (syncFlight) return syncFlight
    syncFlight = withCrossTabLock(() => performSync(force))
      .catch((error: unknown) => {
        phase.value = 'error'
        errorMessage.value = getSyncErrorMessage(error)
      })
      .finally(async () => {
        syncFlight = null
        await refreshLocalStatus()
        await scheduleNextRetry()
      })
    return syncFlight
  }

  async function scheduleNextRetry(): Promise<void> {
    window.clearTimeout(retryTimer)
    if (!currentUserId.value || phase.value === 'decision-required') return
    const next = await db.syncOutbox.orderBy('nextAttemptAt').first()
    if (!next) return
    const delay = Math.max(1_000, next.nextAttemptAt - Date.now())
    retryTimer = window.setTimeout(() => void syncNow(false), delay)
  }

  function scheduleSync(): void {
    void refreshLocalStatus()
    if (!currentUserId.value || phase.value === 'decision-required') return
    window.clearTimeout(debounceTimer)
    window.clearTimeout(retryTimer)
    debounceTimer = window.setTimeout(() => void syncNow(false), 15_000)
  }

  async function handleAuthenticated(userId: string): Promise<void> {
    currentUserId.value = userId
    phase.value = 'checking'
    errorMessage.value = ''
    try {
      const [state, localCount, cloudStatus] = await Promise.all([
        db.syncState.get('current'),
        getLocalEntityCount(),
        getSyncStatus(),
      ])
      if (cloudStatus.protocolVersion !== syncProtocolVersion) {
        throw new Error('同步协议版本不兼容，请刷新应用')
      }
      if (state && state.userId !== userId) {
        phase.value = 'account-mismatch'
        errorMessage.value = '本机数据已绑定其他账户，已停止自动同步'
        return
      }
      if (state) {
        await syncNow(false)
        return
      }
      if (localCount > 0 && cloudStatus.hasCloudData) {
        phase.value = 'decision-required'
        return
      }
      if (localCount === 0 && cloudStatus.hasCloudData) {
        await recoverSnapshot(false, userId)
        await syncNow(false)
        return
      }
      await bindState(userId, cloudStatus.revision)
      if (localCount > 0) await enqueueAllLocalEntities()
      await syncNow(true)
    } catch (error) {
      phase.value = 'error'
      errorMessage.value = getSyncErrorMessage(error)
    } finally {
      await refreshLocalStatus()
    }
  }

  async function useCloudData(): Promise<void> {
    const userId = currentUserId.value
    if (!userId) return
    phase.value = 'syncing'
    try {
      await recoverSnapshot(false, userId)
      await syncNow(false)
    } catch (error) {
      phase.value = 'error'
      errorMessage.value = getSyncErrorMessage(error)
    }
  }

  async function mergeLocalData(): Promise<void> {
    const userId = currentUserId.value
    if (!userId) return
    phase.value = 'syncing'
    try {
      const snapshot = await downloadSnapshot()
      if (currentUserId.value !== userId) throw new Error('SYNC_USER_CHANGED')
      await mergeLocalWithCloudSnapshot(userId, snapshot)
      await reloadBusinessStores()
      await syncNow(true)
    } catch (error) {
      phase.value = 'error'
      errorMessage.value = getSyncErrorMessage(error)
    }
  }

  function handleSignedOut(): void {
    currentUserId.value = ''
    phase.value = 'signed-out'
    window.clearTimeout(debounceTimer)
    void refreshLocalStatus()
  }

  function startScheduler(): void {
    if (schedulerStarted) return
    schedulerStarted = true
    window.addEventListener(localDataChangedEvent, scheduleSync)
    window.addEventListener('online', () => void syncNow(true))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void syncNow(false)
    })
    void refreshLocalStatus()
  }

  return {
    phase,
    pendingCount,
    lastSyncedAt,
    errorMessage,
    statusLabel,
    indicatorTone,
    startScheduler,
    handleAuthenticated,
    handleSignedOut,
    syncNow,
    useCloudData,
    mergeLocalData,
  }
})
