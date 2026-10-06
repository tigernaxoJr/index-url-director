// Recipe: a big number counts up while a ring fills; a label below. For benefit / social-proof
// ("快 10 倍", "98% 滿意度", "每月省 40 小時").
//
//   import countUp from '../../../src/recipes/count-up.js'
//   export default countUp({ to: 10, suffix: '×', label: '部署速度', at: { cue: 0 } })
import { ease, formatNumber, lerp, progress, px, stage, svg, timeOf } from './util.js'

/**
 * @param {object} o
 * @param {number} o.to            final value
 * @param {number} [o.from=0]
 * @param {number} [o.decimals=0]
 * @param {string} [o.prefix='']   e.g. '$'
 * @param {string} [o.suffix='']   e.g. '%', '×', ' 小時'
 * @param {string} [o.label]       small text under the number
 * @param {number|{cue:number}} [o.at=0.3]  when counting starts
 * @param {number} [o.duration=1.6]         seconds to reach `to`
 * @param {boolean} [o.ring=true]  draw the progress ring
 */
export default function countUp(o) {
  return (ctx) => {
    const { width: w, height: h, theme } = ctx
    const root = stage(ctx)
    const cx = w / 2
    const cy = h / 2
    const r = h * 0.3
    const circumference = 2 * Math.PI * r
    let arc = null
    if (o.ring !== false) {
      svg('circle', { cx, cy, r, fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': px(ctx, 18) }, root)
      arc = svg('circle', {
        cx, cy, r, fill: 'none', stroke: theme.accent, 'stroke-width': px(ctx, 18), 'stroke-linecap': 'round',
        'stroke-dasharray': circumference, transform: `rotate(-90 ${cx} ${cy})`,
      }, root)
    }
    const number = svg('text', {
      x: cx, y: cy + (o.label ? 0 : px(ctx, 40)), 'text-anchor': 'middle', 'font-family': theme.fontFamily,
      'font-weight': 700, 'font-size': px(ctx, 190), fill: theme.text,
    }, root)
    let label = null
    if (o.label) {
      label = svg('text', {
        x: cx, y: cy + px(ctx, 120), 'text-anchor': 'middle', 'font-family': theme.fontFamily,
        'font-weight': 700, 'font-size': px(ctx, 56), fill: theme.accent,
      }, root)
      label.textContent = o.label
    }
    const start = timeOf(ctx, o.at, 0.3)
    const duration = o.duration ?? 1.6
    const from = o.from ?? 0

    return (t) => {
      const p = ease.out(progress(t, start, duration))
      number.textContent = `${o.prefix ?? ''}${formatNumber(lerp(from, o.to, p), o.decimals ?? 0)}${o.suffix ?? ''}`
      const appear = ease.back(progress(t, start - 0.3, 0.5))
      number.setAttribute('opacity', progress(t, start - 0.3, 0.3))
      number.setAttribute('transform', `translate(${cx} ${cy}) scale(${0.7 + 0.3 * appear}) translate(${-cx} ${-cy})`)
      arc?.setAttribute('stroke-dashoffset', circumference * (1 - p))
      label?.setAttribute('opacity', progress(t, start + duration * 0.6, 0.4))
    }
  }
}
