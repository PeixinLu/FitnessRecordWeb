import type { DataTemplate, WorkoutRecord } from '@/types'

export type TemplateFieldKey = 'reps' | 'sets' | 'weight' | 'duration' | 'distance'

export interface TemplateField {
  key: TemplateFieldKey
  unit: string
  range: [number, number]
}

export const DATA_TEMPLATE_OPTIONS: Array<{ value: DataTemplate; label: string }> = [
  { value: 'weight-reps', label: '次数 + 重量' },
  { value: 'reps', label: '仅次数' },
  { value: 'duration', label: '时长' },
  { value: 'distance-duration', label: '距离 + 时长' },
]

const TEMPLATE_FIELDS: Record<DataTemplate, TemplateField[]> = {
  'weight-reps': [
    { key: 'reps', unit: '次', range: [1, 50] },
    { key: 'sets', unit: '组', range: [1, 10] },
    { key: 'weight', unit: 'kg', range: [0, 200] },
  ],
  reps: [
    { key: 'reps', unit: '次', range: [1, 50] },
    { key: 'sets', unit: '组', range: [1, 10] },
  ],
  duration: [
    { key: 'duration', unit: '分钟', range: [1, 180] },
    { key: 'sets', unit: '组', range: [1, 10] },
  ],
  'distance-duration': [
    { key: 'distance', unit: '公里', range: [1, 100] },
    { key: 'duration', unit: '分钟', range: [1, 180] },
    { key: 'sets', unit: '组', range: [1, 10] },
  ],
}

export function getTemplateFields(template: DataTemplate): TemplateField[] {
  return TEMPLATE_FIELDS[template]
}

export function getTemplateLabel(template: DataTemplate): string {
  return DATA_TEMPLATE_OPTIONS.find(option => option.value === template)?.label ?? ''
}

export function formatRecordDetail(record: Pick<WorkoutRecord, 'sets' | 'reps' | 'weight' | 'duration' | 'distance'>): string {
  const parts = [`${record.sets}组`]
  if (record.reps !== undefined) parts.push(`${record.reps}次`)
  if (record.weight !== undefined) parts.push(`@${record.weight}kg`)
  if (record.distance !== undefined) parts.push(`${record.distance}公里`)
  if (record.duration !== undefined) parts.push(`${record.duration}分钟`)
  return parts.join(' × ')
}
