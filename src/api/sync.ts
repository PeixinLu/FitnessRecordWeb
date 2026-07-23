import { authOrigin } from '@/api/auth'
import {
  syncProtocolVersion,
  type SyncOutboxItem,
  type SyncResponse,
  type SyncSnapshotEntity,
  type SyncSnapshotPage,
  type SyncStatusResponse,
} from '@/sync/types'

interface SyncErrorBody {
  code?: string
  message?: string
}

export class SyncApiError extends Error {
  status: number
  code: string
  retryAfter?: number

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.name = 'SyncApiError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

async function createSyncApiError(response: Response): Promise<SyncApiError> {
  let body: SyncErrorBody = {}
  try {
    body = await response.json() as SyncErrorBody
  } catch {
    // 非 JSON 错误仍保留 HTTP 状态。
  }
  const retryAfterValue = response.headers.get('Retry-After')
  const retryAfter = retryAfterValue ? Number(retryAfterValue) : undefined
  return new SyncApiError(
    response.status,
    body.code ?? 'SYNC_REQUEST_FAILED',
    body.message ?? '同步请求失败',
    Number.isFinite(retryAfter) ? retryAfter : undefined,
  )
}

async function syncFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${authOrigin}/api/sync${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) throw await createSyncApiError(response)
  return response.json() as Promise<T>
}

export function getSyncStatus(): Promise<SyncStatusResponse> {
  return syncFetch<SyncStatusResponse>('/status')
}

export function postSync(
  cursor: number,
  mutations: SyncOutboxItem[],
): Promise<SyncResponse> {
  return syncFetch<SyncResponse>('', {
    method: 'POST',
    body: JSON.stringify({
      protocolVersion: syncProtocolVersion,
      cursor,
      mutations: mutations.map((mutation) => ({
        mutationId: mutation.mutationId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        operation: mutation.operation,
        payload: mutation.payload,
      })),
    }),
  })
}

export async function getSyncSnapshotEntities(): Promise<{
  revision: number
  entities: SyncSnapshotEntity[]
}> {
  const entities: SyncSnapshotEntity[] = []
  let snapshotRevision: number | null = null
  let afterType: string | undefined
  let afterId: string | undefined

  do {
    const params = new URLSearchParams({ limit: '500' })
    if (afterType && afterId) {
      params.set('afterType', afterType)
      params.set('afterId', afterId)
    }
    const page = await syncFetch<SyncSnapshotPage>(`/snapshot?${params.toString()}`)
    if (page.protocolVersion !== syncProtocolVersion) {
      throw new SyncApiError(400, 'PROTOCOL_VERSION_UNSUPPORTED', '同步协议版本不兼容')
    }
    if (snapshotRevision === null) snapshotRevision = page.snapshotRevision
    entities.push(...page.entities)
    afterType = page.next?.afterType
    afterId = page.next?.afterId
  } while (afterType && afterId)

  return { revision: snapshotRevision ?? 0, entities }
}
