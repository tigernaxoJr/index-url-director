// Recipe: a bar chart whose bars grow one after another, values counting up; one bar can be
// highlighted. For benefit / problem / social-proof comparisons ("過去 3 天 vs 現在 10 分鐘").
//
//   import bars from '../../../src/recipes/bars.js'
//   export default bars({ bars: [{ label: '手動', value: 180 }, { label: '用了之後', value: 10, highlight: true }], unit: ' 分鐘' })
import { ease, formatNumber, progress, px, stage, svg, timeOf } from './util.js'

/**
 * @param {object} o
 * @param {{label:string, value:number, highlight?:boolean}[]} o.bars  2–6 bars
 * @param {string} [o.unit='']        appended to each value
 * @param {number} [o.decimals=0]
 * @param {number|{cue:number}} [o.at=0.3]
 * @param {number} [o.stagger=0.35]   seconds between bars
 * @param {number} [o.duration=0.9]   seconds each bar takes to grow
 */
export default function bars(o) {
  return (ctx) => {
    const { width: w, height: h, theme } = ctx
    const root = stage(ctx)
    const n = o.bars.length
    const max = Math.max(...o.bars.map((b) => b.value), 1e-9)
    const left = w * 0.14
    const right = w * 0.86
    const base = h * 0.8
    const top = h * 0.2
    const slot = (right - left) / n
    const barW = Math.min(slot * 0.56, px(ctx, 260))
    svg('line', { x1: left, y1: base, x2: right, y2: base, stroke: 'rgba(255,255,255,0.3)', 'stroke-width': px(ctx, 3) }, root)
    const start = timeOf(ctx, o.at, 0.3)
    const stagger = o.stagger ?? 0.35
    const duration = o.duration ?? 0.9

    const items = o.bars.map((b, i) => {
      const cx = left + slot * (i + 0.5)
      const fill = b.highlight ? theme.accent : 'rgba(255,255,255,0.35)'
      const rect = svg('rect', { x: cx - barW / 2, width: barW, rx: px(ctx, 14), fill }, root)
      const value = svg('text', { x: cx, 'text-anchor': 'middle', 'font-family': theme.fontFamily, 'font-weight': 700, 'font-size': px(ctx, 54), fill: b.highlight ? theme.accent : theme.text }, root)
      const label = svg('text', { x: cx, y: base + px(ctx, 70), 'text-anchor': 'middle', 'font-family': theme.fontFamily, 'font-weight': 700, 'font-size': px(ctx, 44), fill: theme.text }, root)
      label.textContent = b.label
      return { b, rect, value, label, at: start + i * stagger, full: ((base - top) * b.value) / max }
    })

    return (t) => {
      for (const it of items) {
        const p = ease.out(progress(t, it.at, duration))
        const hgt = Math.max(0, it.full * p)
        it.rect.setAttribute('y', base - hgt)
        it.rect.setAttribute('height', hgt)
        it.value.setAttribute('y', base - hgt - px(ctx, 24))
        it.value.textContent = `${formatNumber(it.b.value * p, o.decimals ?? 0)}${o.unit ?? ''}`
        it.value.setAttribute('opacity', progress(t, it.at, 0.2))
        it.label.setAttribute('opacity', progress(t, it.at - 0.2, 0.3))
      }
    }
  }
}
