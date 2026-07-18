export interface CardStackState {
  activeIndex: number
  isStacked: boolean
}

export interface CardVisualState {
  style: {
    transform: string
    borderRadius: string
    boxShadow: string
    zIndex: number
    transition: string
  }
  isForeground: boolean
  contentInteractive: boolean
  recallInteractive: boolean
}

const STACKED_TRANSITION =
  'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.08), border-radius 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.08), box-shadow 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.08)'
const FOREGROUND_TRANSITION =
  'transform 0.3s cubic-bezier(0, 0, 0.2, 1), border-radius 0.3s cubic-bezier(0, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0, 0, 0.2, 1)'
const STACKED_SHADOW = '0 30px 80px rgba(0, 0, 0, 0.35)'

export function createCardStackState(): CardStackState {
  return { activeIndex: 0, isStacked: false }
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return -1
  return Math.min(Math.max(Math.trunc(index), 0), count - 1)
}

export function toggleStack(state: CardStackState): CardStackState {
  return { ...state, isStacked: !state.isStacked }
}

export function activateCard(state: CardStackState, index: number, count: number): CardStackState {
  if (!state.isStacked) return state
  return { activeIndex: clampIndex(index, count), isStacked: false }
}

export function getCardVisualState(
  index: number,
  count: number,
  state: CardStackState,
): CardVisualState {
  if (count <= 0 || index < 0 || index >= count) {
    throw new RangeError('Card index must reference a non-empty stack')
  }

  const activeIndex = clampIndex(state.activeIndex, count)
  const z = -(9 + (count - 1 - index))

  if (state.isStacked) {
    const y = index === 0 ? '10px' : `${(index * 100 / count).toFixed(2)}%`
    return {
      style: {
        transform: `perspective(80px) translate3d(0, ${y}, ${z}px) rotateX(-1deg)`,
        borderRadius: '20px',
        boxShadow: STACKED_SHADOW,
        zIndex: index + 1,
        transition: STACKED_TRANSITION,
      },
      isForeground: false,
      contentInteractive: false,
      recallInteractive: true,
    }
  }

  if (index === activeIndex) {
    return {
      style: {
        transform: 'translate3d(0, 0, 0)',
        borderRadius: '0',
        boxShadow: 'none',
        zIndex: 99,
        transition: FOREGROUND_TRANSITION,
      },
      isForeground: true,
      contentInteractive: true,
      recallInteractive: false,
    }
  }

  const y = index < activeIndex ? '-100%' : '100%'
  return {
    style: {
      transform: `perspective(80px) translate3d(0, ${y}, ${z}px) rotateX(-1deg)`,
      borderRadius: '20px',
      boxShadow: STACKED_SHADOW,
      zIndex: index + 1,
      transition: FOREGROUND_TRANSITION,
    },
    isForeground: false,
    contentInteractive: false,
    recallInteractive: false,
  }
}
