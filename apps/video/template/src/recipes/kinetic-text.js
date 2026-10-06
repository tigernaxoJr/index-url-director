// Recipe (needs GSAP: pnpm add gsap): kinetic typography. Lines of words fly in with a
// staggered, springy timeline; one word per line can be highlighted. For hook / benefit / cta
// when the words themselves are the picture ("不用設定。不用等待。直接上線。").
//
//   import kineticText from '../../../src/recipes/kinetic-text.js'
//   export default kineticText({ lines: ['不用設定', '不用等待', '直接上線'], highlight: ['上線'], times: [{ cue: 0 }, { cue: 1 }, { cue: 2 }] })
import { gsap } from 'gsap'
import { px, timeOf } from './util.js'

/**
 * @param {object} o
 * @param {string[]} o.lines              1–4 short lines; words are split on spaces (CJK: per character group as written)
 * @param {string[]} [o.highlight=[]]     words drawn in the accent color
 * @param {number|{cue:number}} [o.at=0.2]
 * @param {number} [o.lineGap=0.6]        seconds between lines
 * @param {(number|{cue:number})[]} [o.times]  exact start of each line (overrides at/lineGap)
 * @param {number} [o.size=110]           font size at 1080p
 */
export default function kineticText(o) {
  return (ctx) => {
    const { theme } = ctx
    ctx.root.style.background = theme.background
    const box = document.createElement('div')
    Object.assign(box.style, {
      position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: `${px(ctx, 24)}px`, fontFamily: theme.fontFamily, fontWeight: '700', fontSize: `${px(ctx, o.size ?? 110)}px`, color: theme.text,
    })
    ctx.root.append(box)
    const highlight = new Set(o.highlight ?? [])
    // A paused timeline is driven only by tl.seek(t) below, never by GSAP's own clock.
    const tl = gsap.timeline({ paused: true })
    const start = timeOf(ctx, o.at, 0.2)
    o.lines.forEach((text, i) => {
      const line = document.createElement('div')
      Object.assign(line.style, { display: 'flex', gap: `${px(ctx, 28)}px` })
      const words = text.split(/\s+/).filter(Boolean).map((word) => {
        const span = document.createElement('span')
        span.textContent = word
        span.style.display = 'inline-block'
        if (highlight.has(word)) span.style.color = theme.accent
        line.append(span)
        return span
      })
      box.append(line)
      const at = o.times?.[i] != null ? timeOf(ctx, o.times[i], start + i * (o.lineGap ?? 0.6)) : start + i * (o.lineGap ?? 0.6)
      tl.from(words, { y: px(ctx, 90), opacity: 0, scale: 0.6, rotation: -6, duration: 0.6, ease: 'back.out(2)', stagger: 0.08 }, at)
    })
    return (t) => {
      tl.seek(t, false)
    }
  }
}
