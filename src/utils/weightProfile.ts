import type { WeightProfile } from '@/types'

export const DEFAULT_WEIGHT_RANGE: [number, number] = [1, 200]
const MAX_WEIGHT_OPTIONS = 500

function decimalPlaces(value: number): number {
  const text = String(value).toLowerCase()
  if (text.includes('e-')) return Number(text.split('e-')[1])
  return text.includes('.') ? text.split('.')[1].length : 0
}

function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function normalizeWeightValues(values: number[]): number[] {
  return [...new Set(
    values
      .filter(value => Number.isFinite(value) && value > 0)
      .map(value => roundToPrecision(value, Math.min(decimalPlaces(value), 3))),
  )].sort((a, b) => a - b)
}

export function buildSteppedWeightValues(
  min: number,
  max: number,
  step: number,
): number[] {
  if (
    !Number.isFinite(min)
    || !Number.isFinite(max)
    || !Number.isFinite(step)
    || min < 0
    || max < min
    || step <= 0
  ) {
    return []
  }

  const precision = Math.min(
    Math.max(decimalPlaces(min), decimalPlaces(max), decimalPlaces(step)),
    3,
  )
  const count = Math.floor((max - min) / step + 1e-9) + 1
  if (count > MAX_WEIGHT_OPTIONS) return []

  return Array.from(
    { length: count },
    (_, index) => roundToPrecision(min + index * step, precision),
  )
}

export function getWeightValues(profile?: WeightProfile): number[] | undefined {
  if (!profile) return undefined
  if (profile.mode === 'custom') {
    const values = normalizeWeightValues(profile.values ?? [])
    return values.length ? values : undefined
  }

  const values = normalizeWeightValues(buildSteppedWeightValues(
    profile.min ?? profile.step ?? 1,
    profile.max ?? 200,
    profile.step ?? 1,
  ))
  return values.length ? values : undefined
}
