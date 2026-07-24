export type WheelRange = [number, number]

export interface NormalizeWheelModelOptions {
  count: number
  ranges: WheelRange[]
  modelValue: number[]
  values?: Array<number[] | undefined>
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function buildWheelValues(range: WheelRange, step = 1): number[] {
  const [start, end] = range
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
    return []
  }
  const count = Math.floor((max - min) / step + 1e-9) + 1

  return Array.from({ length: count }, (_, index) => min + index * step)
}

export function normalizeWheelCount(count: number): number {
  return clamp(Math.trunc(count), 1, 4)
}

export function normalizeWheelModel({
  count,
  ranges,
  modelValue,
  values: optionValues,
}: NormalizeWheelModelOptions): number[] {
  const wheelCount = normalizeWheelCount(count)

  return Array.from({ length: wheelCount }, (_, index) => {
    const range = ranges[index] ?? [0, 0]
    const values = optionValues?.[index]?.length
      ? optionValues[index]!
      : buildWheelValues(range)
    const fallback = values[0] ?? 0
    const value = modelValue[index] ?? fallback
    return values.reduce((nearest, candidate) => (
      Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest
    ), fallback)
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
