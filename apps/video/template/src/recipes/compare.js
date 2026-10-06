// Recipe: before / after side by side. The "before" card fills with pain points that get crossed
// out, then the "after" card slides in with check marks. For problem → solution.
//
//   import compare from '../../../src/recipes/compare.js'
//   export default compare({
//     before: { title: '以前', items: ['設定伺服器', '申請憑證', '串接 CI'] },
//     after: { title: '現在', items: ['git push 就上線'] },
//     afterAt: { cue: 1 },
//   })
import { ease, progress, px, stage, svg, timeOf } from './util.js'

/**
 * @param {object} o
 * @param {{title:string, items:string[]}} o.before  up to 4 items
 * @param {{title:string, items:string[]}} o.after   up to 4 items
 * @param {number|{cue:number}} [o.at=0.3]       when the before card appears
 * @param {number|{cue:number}} [o.afterAt]      when the after card appears (default: after the before items)
 * @param {number} [o.step=0.5]                  seconds between items
 */
export default function compare(o) {
  return (ctx) => {
    const { width: w, height: h, theme } = ctx
    const root = stage(ctx)
    const step = o.step ?? 0.5
    const start = timeOf(ctx, o.at, 0.3)
    const afterAt = timeOf(ctx, o.afterAt, start + 0.4 + o.before.items.length * step + 0.3)
    const cardW = w * 0.38
    const cardH = h * 0.66
    const y = (h - cardH) / 2
    const font = (size, fill = theme.text) => ({ 'font-family': theme.fontFamily, 'font-weight': 700, 'font-size': px(ctx, size), fill })

    function card(x, spec, good, at) {
      const g = svg('g', { opacity: 0 }, root)
      svg('rect', { x, y, width: cardW, height: cardH, rx: px(ctx, 32), fill: good ? 'rgba(56,189,248,0.14)' : theme.panel, stroke: good ? theme.accent : 'rgba(255,255,255,0.18)', 'stroke-width': px(ctx, 4) }, g)
      const title = svg('text', { x: x + px(ctx, 56), y: y + px(ctx, 110), ...font(64, good ? theme.accent : 'rgba(255,255,255,0.7)') }, g)
      title.textContent = spec.title
      const rows = spec.items.map((text, i) => {
        const ry = y + px(ctx, 230) + i * px(ctx, 110)
        const row = svg('g', { opacity: 0 }, g)
        const label = svg('text', { x: x + px(ctx, 130), y: ry, ...font(48, good ? theme.text : 'rgba(255,255,255,0.75)') }, row)
        label.textContent = text
        const ix = x + px(ctx, 76)
        const iy = ry - px(ctx, 16)
        const s = px(ctx, 20)
        const mark = good
          ? svg('path', { d: `M ${ix - s} ${iy} L ${ix - s / 3} ${iy + s * 0.75} L ${ix + s} ${iy - s * 0.8}`, fill: 'none', stroke: theme.accent, 'stroke-width': px(ctx, 9), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, row)
          : svg('path', { d: `M ${ix - s} ${iy - s} L ${ix + s} ${iy + s} M ${ix + s} ${iy - s} L ${ix - s} ${iy + s}`, stroke: '#f87171', 'stroke-width': px(ctx, 9), 'stroke-linecap': 'round' }, row)
        const len = (s * 2 * Math.SQRT2 + 1) * 2
        mark.setAttribute('stroke-dasharray', len)
        // A strike-through for crossed-out pain points; its length is set once the text is measured.
        const strike = good ? null : svg('line', { x1: x + px(ctx, 124), y1: ry - px(ctx, 16), y2: ry - px(ctx, 16), stroke: 'rgba(248,113,113,0.8)', 'stroke-width': px(ctx, 5) }, row)
        return { row, mark, len, strike, label, at: at + 0.4 + i * step }
      })
      return { g, x, rows, at }
    }

    const before = card(w * 0.08, o.before, false, start)
    const after = card(w * 0.54, o.after, true, afterAt)
    for (const r of before.rows) {
      r.strikeLen = r.label.getComputedTextLength() + px(ctx, 12)
      r.strike.setAttribute('x2', Number(r.strike.getAttribute('x1')) + r.strikeLen)
      r.strike.setAttribute('stroke-dasharray', r.strikeLen)
    }

    return (t) => {
      for (const c of [before, after]) {
        const p = progress(t, c.at, 0.5)
        c.g.setAttribute('opacity', p)
        c.g.setAttribute('transform', `translate(${(1 - ease.out(p)) * px(ctx, c === after ? 80 : -80)} 0)`)
        for (const r of c.rows) {
          r.row.setAttribute('opacity', progress(t, r.at, 0.3))
          r.mark.setAttribute('stroke-dashoffset', r.len * (1 - ease.out(progress(t, r.at + 0.15, 0.35))))
          r.strike?.setAttribute('stroke-dashoffset', r.strikeLen * (1 - ease.inOut(progress(t, r.at + 0.3, 0.3))))
        }
      }
      // The before card dims once the after card is in.
      before.g.setAttribute('opacity', progress(t, before.at, 0.5) * (1 - 0.45 * progress(t, after.at, 0.5)))
    }
  }
}
