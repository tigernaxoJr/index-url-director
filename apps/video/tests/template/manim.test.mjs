// manim.mjs (visual.type manim) with a stand-in for the manim CLI, its use as the background in
// render-scene.mjs, and the input hash covering the Python program and its `uses`.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, describe, test } from 'node:test'
import { hashedDirs, referencedPaths } from '../../template/scripts/lib/core.mjs'
import { probeDuration } from '../../template/scripts/lib/media.mjs'
import { baseProject, baseScene, makeProject } from './helpers.mjs'

const require = createRequire(import.meta.url)
const ffmpegBin = require('ffmpeg-static')
const templateSrc = new URL('../../template/src', import.meta.url)

// Writes media_dir/videos/<stem>/<h>p<fps>/<output>.mp4 like manim does, filled with red and as
// long as AVP_TIMING says, plus a decoy under partial_movie_files. Records its arguments.
const FAKE_MANIM = `
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { spawnSync } from 'node:child_process'
const args = process.argv.slice(2)
const opt = (name) => args[args.indexOf(name) + 1]
const [w, h] = opt('--resolution').split(',')
const fps = opt('--frame_rate')
const timing = JSON.parse(readFileSync(process.env.AVP_TIMING, 'utf8'))
writeFileSync(join(process.env.FAKE_MANIM_LOG), JSON.stringify({ args, cwd: process.cwd(), timing, pythonpath: process.env.PYTHONPATH }))
if (process.env.FAKE_MANIM_FAIL) { console.error('NameError: name Foo is not defined'); process.exit(1) }
const dir = join(opt('--media_dir'), 'videos', basename(args[1], '.py'), h + 'p' + fps)
mkdirSync(join(dir, 'partial_movie_files', args[2]), { recursive: true })
writeFileSync(join(dir, 'partial_movie_files', args[2], 'manim.mp4'), 'not a video')
const sec = Number(process.env.FAKE_MANIM_SEC ?? timing.durationSec)
const r = spawnSync(${JSON.stringify(ffmpegBin)}, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=' + w + 'x' + h + ':r=' + fps + ':d=' + sec, '-pix_fmt', 'yuv420p', join(dir, opt('--output_file') + '.mp4')])
process.exit(r.status)
`

let p
afterEach(() => p?.cleanup())

function manimProject(visual = {}) {
  const project = baseProject()
  project.project.format = { aspectRatio: '16:9', width: 640, height: 360, fps: 24, targetDurationSec: 10 }
  const scene = baseScene('scene-001', {
    durationSec: 1.5,
    visual: { type: 'manim', description: 'formula', manim: { file: 'assets/scene.py', class: 'Proof' }, ...visual },
  })
  p = makeProject({ project, scenes: [{ id: 'scene-001', dir: 'scenes/001-proof', scene, script: '' }] })
  p.write('scenes/001-proof/assets/scene.py', 'from manim import *\n')
  p.write('fake-manim.mjs', FAKE_MANIM)
  p.write('scenes/001-proof/assets/captions.json', JSON.stringify([{ start: 0, end: 0.8, text: '第一句' }]))
  return p
}

const env = (extra = {}) => ({ VIDEO_MANIM: p.path('fake-manim.mjs'), FAKE_MANIM_LOG: p.path('manim-log.json'), ...extra })

describe('manim', () => {
  test('renders the program at the project size and fps with the scene timing', () => {
    manimProject()
    const r = p.run('manim.mjs', ['scene-001'], env())
    assert.equal(r.code, 0, r.stderr)
    const out = p.path('scenes/001-proof/assets/manim.mp4')
    assert.ok(Math.abs(probeDuration(out) - 1.5) < 0.1)
    assert.equal(existsSync(p.path('.tmp/manim-scene-001')), false, 'scratch files are removed')

    const log = JSON.parse(readFileSync(p.path('manim-log.json'), 'utf8'))
    assert.equal(log.args[0], 'render')
    assert.equal(log.args[1], p.path('scenes/001-proof/assets/scene.py'))
    assert.equal(log.args[2], 'Proof')
    assert.equal(log.args[log.args.indexOf('--resolution') + 1], '640,360')
    assert.equal(log.args[log.args.indexOf('--frame_rate') + 1], '24')
    assert.deepEqual(log.timing, { durationSec: 1.5, fps: 24, width: 640, height: 360, cues: [{ start: 0, end: 0.8, text: '第一句' }] })
    assert.equal(log.pythonpath.split(/[:;]/)[0], p.path('src/lib'), 'manim_timing.py is importable')
    assert.equal(log.cwd, p.path('scenes/001-proof'))
  })

  test('warns when the animation does not fill the scene', () => {
    manimProject()
    const r = p.run('manim.mjs', ['scene-001'], env({ FAKE_MANIM_SEC: '0.5' }))
    assert.equal(r.code, 0, r.stderr)
    assert.match(r.stderr, /ends 1\.0s early.*finish\(self\)/)
  })

  test('skips scenes of other types', () => {
    manimProject({ type: 'motion-graphic', manim: undefined })
    const r = p.run('manim.mjs', ['scene-001'], env())
    assert.equal(r.code, 0, r.stderr)
    assert.match(r.stdout, /needs no manim/)
    assert.equal(existsSync(p.path('manim-log.json')), false)
  })

  test('reports a missing manim as gate manimInstall', () => {
    manimProject()
    const r = p.run('manim.mjs', ['scene-001'], { VIDEO_MANIM: p.path('no-such-manim') })
    assert.notEqual(r.code, 0)
    assert.match(r.stderr, /Manim is not installed \(gate manimInstall\)/)
  })

  test('fails with the program error and keeps the previous video', () => {
    manimProject()
    p.write('scenes/001-proof/assets/manim.mp4', 'previous')
    const r = p.run('manim.mjs', ['scene-001'], env({ FAKE_MANIM_FAIL: '1' }))
    assert.notEqual(r.code, 0)
    assert.match(r.stderr, /NameError/)
    assert.match(r.stderr, /manim exited with code 1/)
    assert.equal(readFileSync(p.path('scenes/001-proof/assets/manim.mp4'), 'utf8'), 'previous')
  })

  test('render-scene uses the manim video as the background', async (t) => {
    manimProject({ elements: [{ type: 'text', content: '證明', at: 0, animation: 'none', position: 'top' }] })
    cpSync(templateSrc, p.path('src'), { recursive: true })
    assert.equal(p.run('manim.mjs', ['scene-001'], env()).code, 0)
    const r = await p.runAsync('render-scene.mjs', ['scene-001'])
    if (/no usable browser/.test(r.stderr)) return t.skip('no browser available')
    assert.equal(r.code, 0, r.stderr)
    const out = p.path('scenes/001-proof/output/scene.mp4')
    const px = spawnSync(ffmpegBin, ['-v', 'error', '-ss', '1', '-i', out, '-frames:v', '1', '-vf', 'format=rgb24,crop=1:1:600:340', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' }).stdout
    assert.ok(px[0] > 200 && px[1] < 60 && px[2] < 60, `background is the manim video: rgb(${[...px]})`)
  })

  test('render-scene asks for pnpm run manim when the video is missing', () => {
    manimProject()
    const r = p.run('render-scene.mjs', ['scene-001'])
    assert.notEqual(r.code, 0)
    assert.match(r.stderr, /manim video \(run pnpm run manim\) not found/)
  })

  test('the input hash covers the program and its uses', () => {
    const scene = baseScene('scene-001', {
      visual: { type: 'manim', description: 'x', manim: { file: 'assets/scene.py', uses: ['@/assets/manim/', '@/assets/axes.py'] } },
    })
    assert.ok(referencedPaths(scene).includes('assets/scene.py'))
    assert.ok(referencedPaths(scene).includes('@/assets/axes.py'))
    assert.deepEqual(hashedDirs('scenes/001-proof', scene), ['scenes/001-proof/assets', 'assets/manim'])
  })
})
