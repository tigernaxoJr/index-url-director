// Recipe: scattered particles fly together and form a word or short phrase, then shimmer. Without
// `text`, a slow drifting field of light (a backdrop for elements). For hook / cta / brand moments.
//
//   import particles from '../../../src/recipes/particles.js'
//   export default particles({ text: 'ShipIt', at: 0.2, duration: 1.8 })
import { canvas, ease, progress, px, random, timeOf } from './util.js'

/**
 * @param {object} o
 * @param {string} [o.text]          up to ~8 CJK characters or ~12 Latin letters
 * @param {number|{cue:number}} [o.at=0.2]  when the particles start moving together
 * @param {number} [o.duration=1.8]  seconds to assemble
 * @param {number} [o.count=1400]    particles (keep ≤ 3000: every frame is drawn on the CPU)
 * @param {number} [o.seed=7]
 */
export default function particles(o = {}) {
  return (ctx) => {
    const { width: w, height: h, theme } = ctx
    ctx.root.style.background = theme.background
    const c = canvas(ctx)
    const g = c.getContext('2d')
    const rnd = random(o.seed ?? 7)
    const count = o.count ?? 1400
    const targets = o.text ? textPoints(ctx, o.text, count, rnd) : null
    const ps = Array.from({ length: count }, (_, i) => ({
      x: rnd() * w,
      y: rnd() * h,
      // Drift: each particle circles slowly around its start point.
      r: px(ctx, 20 + rnd() * 60),
      speed: 0.2 + rnd() * 0.5,
      phase: rnd() * Math.PI * 2,
      size: px(ctx, 2 + rnd() * 3),
      delay: rnd() * 0.35,
      target: targets?.[i % targets.length],
    }))
    const start = timeOf(ctx, o.at, 0.2)
    const duration = o.duration ?? 1.8

    return (t) => {
      g.clearRect(0, 0, w, h)
      for (const p of ps) {
        const a = p.phase + t * p.speed
        const dx = p.x + Math.cos(a) * p.r
        const dy = p.y + Math.sin(a) * p.r
        let x = dx
        let y = dy
        let alpha = 0.35
        if (p.target) {
          const k = ease.inOut(progress(t, start + p.delay * duration, duration * (1 - p.delay * 0.5)))
          const shimmer = Math.sin(t * 3 + p.phase) * px(ctx, 1.5)
          x = dx + (p.target[0] + shimmer - dx) * k
          y = dy + (p.target[1] - dy) * k
          alpha = 0.35 + 0.6 * k
        }
        g.globalAlpha = alpha
        g.fillStyle = p.target && alpha > 0.8 ? theme.text : theme.accent
        g.beginPath()
        g.arc(x, y, p.size, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    }
  }
}

/** `count` points inside the glyphs of `text`, centered in the frame. */
function textPoints(ctx, text, count, rnd) {
  const { width: w, height: h, theme } = ctx
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  let size = px(ctx, 300)
  g.font = `700 ${size}px ${theme.fontFamily}`
  const fit = (w * 0.8) / g.measureText(text).width
  if (fit < 1) size *= fit
  g.font = `700 ${size}px ${theme.fontFamily}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#fff'
  g.fillText(text, w / 2, h / 2)
  const data = g.getImageData(0, 0, w, h).data
  const inside = []
  const step = Math.max(2, Math.round(px(ctx, 4)))
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] > 128) inside.push([x, y])
  }
  if (!inside.length) return null
  // Pick points spread evenly over the glyphs, in a seeded order.
  for (let i = inside.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[inside[i], inside[j]] = [inside[j], inside[i]]
  }
  return inside.slice(0, count)
}
