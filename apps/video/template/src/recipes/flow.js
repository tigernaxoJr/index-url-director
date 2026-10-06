// Recipe: boxes appear one by one, the lines between them draw themselves, then dots keep flowing
// along the lines. For how-it-works / solution ("程式碼 → 建置 → 上線", data flow, architecture).
//
//   import flow from '../../../src/recipes/flow.js'
//   export default flow({ nodes: ['推送程式碼', '自動建置', '網站上線'], at: { cue: 0 }, step: 0.8 })
import { ease, progress, px, stage, svg, timeOf } from './util.js'

/**
 * @param {object} o
 * @param {(string|{label:string, highlight?:boolean})[]} o.nodes  2–5 boxes, left to right
 * @param {number|{cue:number}} [o.at=0.3]  when the first box appears
 * @param {number} [o.step=0.7]             seconds between boxes
 * @param {(number|{cue:number})[]} [o.times]  exact time of each box (overrides at/step), e.g. one cue per box
 * @param {boolean} [o.particles=true]      dots flow along the lines once drawn
 */
export default function flow(o) {
  return (ctx) => {
    const { width: w, height: h, theme } = ctx
    const root = stage(ctx)
    const nodes = o.nodes.map((n) => (typeof n === 'string' ? { label: n } : n))
    const n = nodes.length
    const boxW = Math.min(w * 0.2, (w * 0.84) / n - px(ctx, 60))
    const boxH = px(ctx, 170)
    const gap = (w * 0.84 - boxW * n) / Math.max(1, n - 1)
    const x0 = w * 0.08
    const cy = h / 2
    const start = timeOf(ctx, o.at, 0.3)
    const step = o.step ?? 0.7
    const times = nodes.map((_, i) => (o.times?.[i] != null ? timeOf(ctx, o.times[i], start + i * step) : start + i * step))

    const lines = []
    for (let i = 0; i < n - 1; i++) {
      const x1 = x0 + boxW * (i + 1) + gap * i + px(ctx, 16)
      const x2 = x0 + (boxW + gap) * (i + 1) - px(ctx, 16)
      const length = x2 - x1
      const line = svg('line', {
        x1, y1: cy, x2, y2: cy, stroke: theme.accent, 'stroke-width': px(ctx, 6), 'stroke-linecap': 'round',
        'stroke-dasharray': length, 'stroke-dashoffset': length,
      }, root)
      const head = svg('path', { d: `M ${x2 - px(ctx, 22)} ${cy - px(ctx, 14)} L ${x2} ${cy} L ${x2 - px(ctx, 22)} ${cy + px(ctx, 14)}`, fill: 'none', stroke: theme.accent, 'stroke-width': px(ctx, 6), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, root)
      const dots = o.particles === false ? [] : [0, 1, 2].map(() => svg('circle', { r: px(ctx, 9), cy, fill: '#fff', opacity: 0 }, root))
      lines.push({ line, head, dots, x1, length, from: times[i] + 0.35, to: times[i + 1] })
    }
    const boxes = nodes.map((node, i) => {
      const x = x0 + (boxW + gap) * i
      const g = svg('g', { opacity: 0 }, root)
      svg('rect', {
        x, y: cy - boxH / 2, width: boxW, height: boxH, rx: px(ctx, 28),
        fill: node.highlight ? 'rgba(56,189,248,0.22)' : theme.panel, stroke: node.highlight ? theme.accent : 'rgba(255,255,255,0.25)', 'stroke-width': px(ctx, 4),
      }, g)
      const text = svg('text', {
        x: x + boxW / 2, y: cy + px(ctx, 18), 'text-anchor': 'middle', 'font-family': theme.fontFamily, 'font-weight': 700,
        'font-size': Math.min(px(ctx, 52), (boxW * 0.86) / Math.max(1, [...node.label].length)), fill: theme.text,
      }, g)
      text.textContent = node.label
      return { g, cx: x + boxW / 2, at: times[i] }
    })

    return (t) => {
      for (const b of boxes) {
        const p = progress(t, b.at, 0.45)
        const s = 0.8 + 0.2 * ease.back(p)
        b.g.setAttribute('opacity', p)
        b.g.setAttribute('transform', `translate(${b.cx} ${cy}) scale(${s}) translate(${-b.cx} ${-cy})`)
      }
      for (const l of lines) {
        const p = ease.inOut(progress(t, l.from, Math.max(0.2, l.to - l.from)))
        l.line.setAttribute('stroke-dashoffset', l.length * (1 - p))
        l.head.setAttribute('opacity', p >= 1 ? 1 : 0)
        l.dots.forEach((d, k) => {
          // Each dot loops along the line every 1.2 s, starting once the line is drawn.
          const since = t - l.to - k * 0.4
          if (p < 1 || since < 0) return d.setAttribute('opacity', 0)
          const f = (since / 1.2) % 1
          d.setAttribute('cx', l.x1 + l.length * f)
          d.setAttribute('opacity', Math.sin(Math.PI * f))
        })
      }
    }
  }
}
