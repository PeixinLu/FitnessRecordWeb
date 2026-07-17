import type { DataTemplate, MuscleGroup } from '@/types'

export interface EquipmentCaseAction {
  id: string
  name: string
  muscleGroup: MuscleGroup
  dataTemplate: DataTemplate
}

export interface EquipmentCase {
  id: string
  name: string
  icon: string
  actions: EquipmentCaseAction[]
}

const weightReps: DataTemplate = 'weight-reps'

export const EQUIPMENT_CASES: EquipmentCase[] = [
  {
    id: 'butterfly-machine', name: '蝴蝶机', icon: 'butterfly-machine',
    actions: [
      { id: 'butterfly-chest-fly', name: '夹胸', muscleGroup: '胸', dataTemplate: weightReps },
      { id: 'butterfly-reverse-fly', name: '反向飞鸟', muscleGroup: '背', dataTemplate: weightReps },
    ],
  },
  {
    id: 'bodyweight', name: '徒手', icon: 'bodyweight',
    actions: [
      { id: 'pull-up', name: '引体', muscleGroup: '背', dataTemplate: weightReps },
      { id: 'hanging-leg-raise', name: '悬垂举腿', muscleGroup: '核心', dataTemplate: weightReps },
    ],
  },
  {
    id: 'barbell', name: '杠铃', icon: 'barbell',
    actions: [{ id: 'barbell-preacher-curl', name: '牧师凳弯举', muscleGroup: '臂', dataTemplate: weightReps }],
  },
  {
    id: 'hip-adductor', name: '分夹腿训练器', icon: 'hip-adductor',
    actions: [
      { id: 'hip-adduction', name: '髋内收', muscleGroup: '腿', dataTemplate: weightReps },
      { id: 'hip-abduction', name: '髋外展', muscleGroup: '腿', dataTemplate: weightReps },
    ],
  },
  {
    id: 'lat-pulldown-machine', name: '高位下拉机', icon: 'lat-pulldown',
    actions: [
      { id: 'wide-lat-pulldown', name: '宽距高位下拉', muscleGroup: '背', dataTemplate: weightReps },
      { id: 'narrow-lat-pulldown', name: '窄距高位下拉', muscleGroup: '背', dataTemplate: weightReps },
      { id: 'behind-neck-lat-pulldown', name: '颈后下拉', muscleGroup: '背', dataTemplate: weightReps },
    ],
  },
  {
    id: 'cable-machine', name: '龙门架', icon: 'cable-machine',
    actions: [
      { id: 'cable-row', name: '绳索划船', muscleGroup: '背', dataTemplate: weightReps },
      { id: 'tricep-pushdown', name: '三头下压', muscleGroup: '臂', dataTemplate: weightReps },
      { id: 'cable-fly', name: '绳索夹胸', muscleGroup: '胸', dataTemplate: weightReps },
      { id: 'cable-curl', name: '绳索弯举', muscleGroup: '臂', dataTemplate: weightReps },
    ],
  },
  {
    id: 'rowing-machine', name: '划船机', icon: 'rowing-machine',
    actions: [{ id: 'rowing', name: '划船', muscleGroup: '背', dataTemplate: weightReps }],
  },
]

export function normalizeEquipmentName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase()
}
