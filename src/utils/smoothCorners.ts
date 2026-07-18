// 超椭圆（squircle）拐角路径生成
// 用 cubic Bezier 近似 n=4 超椭圆，产生 iOS 风格的连续曲率圆角
//
// 标准圆弧控制点偏移比 k = 0.552
// 连续曲率/squircle 偏移比 k ≈ 0.45

const SQUIRCLE_K = 0.45

export interface SquircleOptions {
  /** 元素宽度 px */
  width: number
  /** 元素高度 px */
  height: number
  /** 圆角半径 px，或字符串如 "50%" 表示胶囊形 */
  radius: number | string
}

function resolveRadius(width: number, height: number, radius: number | string): number {
  if (typeof radius === 'string' && radius.endsWith('%')) {
    const pct = Number.parseFloat(radius) / 100
    return Math.min(width, height) * pct
  }
  const r = Number(radius)
  if (!Number.isFinite(r) || r <= 0) return 0
  return Math.min(r, width / 2, height / 2)
}

function buildSquirclePath(W: number, H: number, R: number): string {
  if (R <= 0) return `M 0,0 L ${W},0 L ${W},${H} L 0,${H} Z`

  const k = SQUIRCLE_K
  const rc1 = R * k // control point inset

  // 每个角使用 cubic Bezier: 控制点偏移 0.45R（而非标准圆的 0.552R）
  return [
    // 从左上角顶部开始
    `M ${R},0`,
    // 顶边
    `L ${W - R},0`,
    // 右上角
    `C ${W - rc1},0, ${W},${rc1}, ${W},${R}`,
    // 右边
    `L ${W},${H - R}`,
    // 右下角
    `C ${W},${H - rc1}, ${W - rc1},${H}, ${W - R},${H}`,
    // 底边
    `L ${R},${H}`,
    // 左下角
    `C ${rc1},${H}, 0,${H - rc1}, 0,${H - R}`,
    // 左边
    `L 0,${R}`,
    // 左上角
    `C 0,${rc1}, ${rc1},0, ${R},0`,
    'Z',
  ].join(' ')
}

/**
 * 生成 squircle SVG mask 的 data URI，可直接用于 mask-image CSS 属性
 *
 * 返回格式: url("data:image/svg+xml,...svg...")
 * 配合 mask-size: 100% 100% 使 mask 填充整个元素
 */
export function generateSquircleMaskURI(
  width: number,
  height: number,
  radius: number | string,
): string {
  const W = Math.max(1, Math.round(width))
  const H = Math.max(1, Math.round(height))
  const R = resolveRadius(W, H, radius)

  const path = buildSquirclePath(W, H, R)

  // 直接渲染白色 squircle 形状 — 作为 mask 时白色区域显示元素，透明区域隐藏
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${path}" fill="white" fill-rule="evenodd"/></svg>`

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * 生成对应的 CSS 样式对象，包含 mask-image 及必要的配套属性
 */
export function smoothCornerStyle(
  width: number,
  height: number,
  radius: number | string,
): Record<string, string> {
  const maskImage = generateSquircleMaskURI(width, height, radius)
  return {
    maskImage,
    WebkitMaskImage: maskImage,
    maskSize: `${width}px ${height}px`,
    WebkitMaskSize: `${width}px ${height}px`,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: '0 0',
    WebkitMaskPosition: '0 0',
  }
}
