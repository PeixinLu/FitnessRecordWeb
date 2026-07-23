import type { CurrentUser } from '@/api/auth'

export type AccountPreviewTone = 'synced' | 'pending' | 'syncing'

export interface AccountPreview {
  user: CurrentUser
  tone: AccountPreviewTone
  statusLabel: string
  syncDetail: string
}

const previewCopy: Record<
  AccountPreviewTone,
  Pick<AccountPreview, 'statusLabel' | 'syncDetail'>
> = {
  synced: {
    statusLabel: '已同步',
    syncDetail: '上次同步 刚刚',
  },
  pending: {
    statusLabel: '待同步 1 项',
    syncDetail: '本地修改已保存，稍后会自动同步',
  },
  syncing: {
    statusLabel: '正在同步…',
    syncDetail: '正在上传本地修改并获取云端数据',
  },
}

export function getAccountPreview(): AccountPreview | null {
  if (!import.meta.env.DEV) return null
  const value = new URLSearchParams(window.location.search).get('mockAccount')
  if (value !== 'synced' && value !== 'pending' && value !== 'syncing') return null

  return {
    user: {
      id: 'development-preview',
      nickname: '训练玩家',
      image: null,
    },
    tone: value,
    ...previewCopy[value],
  }
}
