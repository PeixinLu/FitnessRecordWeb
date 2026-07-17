export type WheelRange = [number, number]

export interface NormalizeWheelModelOptions {
  count: number
  ranges: WheelRange[]
  modelValue: number[]
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function buildWheelValues(range: WheelRange): number[] {
  const [start, end] = range
  const min = Math.ceil(Math.min(start, end))
  const max = Math.floor(Math.max(start, end))

  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}

export function normalizeWheelCount(count: number): number {
  return clamp(Math.trunc(count), 1, 4)
}

export function normalizeWheelModel({
  count,
  ranges,
  modelValue,
}: NormalizeWheelModelOptions): number[] {
  const wheelCount = normalizeWheelCount(count)

  return Array.from({ length: wheelCount }, (_, index) => {
    const range = ranges[index] ?? [0, 0]
    const values = buildWheelValues(range)
    const fallback = values[0] ?? 0
    const value = modelValue[index] ?? fallback
    const min = values[0] ?? fallback
    const max = values[values.length - 1] ?? fallback

    return clamp(Math.trunc(value), min, max)
  })
}

export function getNearestIndex(offset: number, itemHeight: number, valueCount: number): number {
  const rawIndex = Math.round(-offset / itemHeight)
  return clamp(rawIndex, 0, Math.max(0, valueCount - 1))
}

export function getOffsetForIndex(index: number, itemHeight: number): number {
  if (index === 0) return 0
  return -index * itemHeight
}
