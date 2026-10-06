// Renders every animation recipe in src/recipes/ (rendering-guide.md#recipes) through render-scene
// and checks that each one draws and moves. The GSAP and Three.js recipes run only when those
// packages can be found (repo node_modules, or RECIPE_LIBS=<a node_modules folder>).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, test } from 'node:test'
import { baseProject, baseScene, makeProject } from './helpers.mjs'

const require = createRequire(import.meta.url)
const ffmpegBin = require('ffmpeg-static')
const templateSrc = new URL('../../template/src', import.meta.url)
const repoModules = fileURLToPath(new URL('../../../../node_modules', import.meta.url))

const W = 480
const H = 270
const IMPORT = "from '../../../src/recipes"
const RECIPES = {
  'count-up': `import r ${IMPORT}/count-up.js'\nexport default r({ to: 98, suffix: '%', label: '滿意度', at: 0.1, duration: 0.8 })`,
  flow: `import r ${IMPORT}/flow.js'\nexport default r({ nodes: ['推送', '建置', { label: '上線', highlight: true }], at: 0.05, step: 0.3 })`,
  bars: `import r ${IMPORT}/bars.js'\nexport default r({ bars: [{ label: '以前', value: 180 }, { label: '現在', value: 10, highlight: true }], unit: ' 分', at: 0.1, duration: 0.6 })`,
  compare: `import r ${IMPORT}/compare.js'\nexport default r({ before: { title: '以前', items: ['設定伺服器', '申請憑證'] }, after: { title: '現在', items: ['直接上線'] }, at: 0.05, step: 0.15, afterAt: 0.5 })`,
  particles: `import r ${IMPORT}/particles.js'\nexport default r({ text: 'Ship', at: 0.05, duration: 0.8, count: 600 })`,
  shader: `import r ${IMPORT}/shader.js'\nexport default r({ speed: 4 })`,
  'kinetic-text': `import r ${IMPORT}/kinetic-text.js'\nexport default r({ lines: ['不用設定', '直接 上線'], highlight: ['上線'], at: 0.05, lineGap: 0.3 })`,
  'device-3d': `import r ${IMPORT}/device-3d.js'\nexport default r({ image: new URL('./shot.png', import.meta.url), at: 0, duration: 1 })`,
}
const NEEDS = { 'kinetic-text': 'gsap', 'device-3d': 'three' }

const libDir = (name) => [process.env.RECIPE_LIBS, repoModules].filter(Boolean).map((d) => join(d, name)).find((d) => existsSync(join(d, 'package.json')))
const ids = Object.keys(RECIPES).filter((name) => !NEEDS[name] || libDir(NEEDS[name]))

/** Share of pixels whose brightness differs clearly between the frames at t1 and t2. */
function changed(file, t1, t2) {
  const frame = (t) => spawnSync(ffmpegBin, ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'format=gray', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout
  const a = frame(t1)
  const b = frame(t2)
  assert.equal(a.length, W * H, 'frame extracted')
  let n = 0
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 40) n++
  return n / a.length
}

let p
let result
before(async () => {
  const project = baseProject()
  project.project.format = { aspectRatio: '16:9', width: W, height: H, fps: 12, targetDurationSec: 10 }
  const scenes = ids.map((name, i) => {
    const id = `scene-${String(i + 1).padStart(3, '0')}`
    const scene = baseScene(id, { durationSec: 1.2, visual: { type: 'motion-graphic', description: name, motion: { file: 'assets/motion.js' } } })
    return { id, dir: `scenes/${String(i + 1).padStart(3, '0')}-${name}`, scene, script: '', name }
  })
  p = makeProject({ project, scenes })
  cpSync(templateSrc, p.path('src'), { recursive: true })
  for (const s of scenes) p.write(`${s.dir}/assets/motion.js`, RECIPES[s.name])
  for (const lib of new Set(ids.map((name) => NEEDS[name]).filter(Boolean))) {
    mkdirSync(p.path('node_modules'), { recursive: true })
    symlinkSync(libDir(lib), p.path('node_modules', lib), 'dir')
  }
  const shot = scenes.find((s) => s.name === 'device-3d')
  if (shot) spawnSync(ffmpegBin, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x400', '-frames:v', '1', p.path(shot.dir, 'assets', 'shot.png')])
  result = { scenes, run: await p.runAsync('render-scene.mjs', scenes.map((s) => s.id)) }
})
after(() => p?.cleanup())

describe('animation recipes', () => {
  for (const name of Object.keys(RECIPES)) {
    test(name, (t) => {
      if (!ids.includes(name)) return t.skip(`${NEEDS[name]} is not installed`)
      if (/no usable browser/.test(result.run.stderr)) return t.skip('no browser available')
      const s = result.scenes.find((x) => x.name === name)
      const out = p.path(s.dir, 'output', 'scene.mp4')
      assert.ok(existsSync(out), `${name} did not render:\n${result.run.stderr}`)
      assert.ok(changed(out, 0, 1) > 0.01, `${name}: the picture should change over the scene`)
    })
  }
})
