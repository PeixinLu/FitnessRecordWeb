// 器械类型
export interface Equipment {
  id: string
  name: string
  normalizedName?: string
  icon?: string
  source?: 'manual' | 'case'
  order?: number
}

// 动作类型
export interface Exercise {
  id: string
  name: string
  normalizedName?: string
  equipmentId: string
  order?: number
  muscleGroup: MuscleGroup
  dataTemplate: DataTemplate
  source?: 'manual' | 'case'
}

// 肌群
export type MuscleGroup = '胸' | '背' | '腿' | '肩' | '臂' | '核心' | '全身'

export const MUSCLE_GROUPS: MuscleGroup[] = ['胸', '背', '腿', '肩', '臂', '核心', '全身']

export type DataTemplate = 'weight-reps' | 'reps' | 'duration' | 'distance-duration'

// 训练记录
export interface WorkoutRecord {
  id: string
  date: string // YYYY-MM-DD
  exerciseId: string
  exerciseName: string
  sets: number
  reps?: number
  weight?: number
  duration?: number
  distance?: number
  notes?: string
  createdAt: number // timestamp
}

// 训练日汇总
export interface WorkoutDay {
  date: string
  records: WorkoutRecord[]
  duration?: number
  notes?: string
}
