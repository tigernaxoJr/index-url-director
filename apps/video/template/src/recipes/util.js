// Shared helpers for the animation recipes (rendering-guide.md#recipes). Pure functions of time, so
// every frame comes out the same on every render.

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
/** 0 → 1 over [start, start + duration]. */
export const progress = (t, start, duration) => (duration <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / duration))
export const lerp = (a, b, p) => a + (b - a) * p

export const ease = {
  linear: (p) => p,
  out: (p) => 1 - (1 - p) ** 3,
  inOut: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  /** Overshoots a little, then settles. */
  back: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
}

/** Seeded random numbers in [0, 1): the same seed gives the same sequence on every render. */
export function random(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A recipe time: seconds, or { cue: i, offset? } = when narration line i starts (ctx.cues, from
 * pnpm run tts), so the picture follows the narration. Falls back to `fallback` without cues.
 */
export function timeOf(ctx, value, fallback = 0) {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'cue' in value) {
    const cue = ctx.cues?.[value.cue]
    return cue ? cue.start + (value.offset ?? 0) : fallback
  }
  return fallback
}

const NS = 'http://www.w3.org/2000/svg'
/** Creates an SVG element with attributes (camelCase keys stay as written) and appends it. */
export function svg(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  parent?.append(el)
  return el
}

/** A full-frame <svg> in ctx.root with the theme background behind it; viewBox is the frame size. */
export function stage(ctx, { background = true } = {}) {
  if (background) ctx.root.style.background = ctx.theme.background
  return svg('svg', { width: ctx.width, height: ctx.height, viewBox: `0 0 ${ctx.width} ${ctx.height}` }, ctx.root)
}

/** A full-frame <canvas> in ctx.root. */
export function canvas(ctx) {
  const c = document.createElement('canvas')
  c.width = ctx.width
  c.height = ctx.height
  Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
  ctx.root.append(c)
  return c
}

/** Font size in px relative to the frame height (1080p: 100 → 100px), so layouts scale with the format. */
export const px = (ctx, size1080) => (size1080 * ctx.height) / 1080

/** Formats a number with fixed decimals and thousands separators. */
export const formatNumber = (n, decimals = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
