// pnpm run manim <scene-id>   → <scene>/assets/manim.mp4 (visual.type manim; rendering-guide.md#manim)
// Renders the scene's Manim program at the project's size and fps. The program reads the scene's
// length and narration cues through src/lib/manim_timing.py (env AVP_TIMING), so its animation can
// follow the narration. Run tts first when durationSec is null.
// Manim is looked up as VIDEO_MANIM, then the project's .venv, then `manim` on PATH.
// Writes files only; the agent records status via `pnpm run state` (SPEC §7.3).
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { parseArgs, run } from './lib/cli.mjs'
import { probeDuration } from './lib/media.mjs'
import { DEFAULTS, UsageError, findRoot, findSceneRef, loadProject, readJson, resolveProjectPath, sceneFile } from './lib/project.mjs'
import { sceneTiming } from './lib/scene-plan.mjs'

/** Frame background: the darkest stop of THEME.background (src/lib/motion.js), so cuts between scenes match. */
const BACKGROUND = '#0f172a'
const INSTALL_HINT =
  'Manim is not installed (gate manimInstall). Install it in the project: ' +
  'uv venv .venv --python 3.12 && uv pip install --python .venv manim ' +
  '(Linux also needs the cairo and pango development packages, e.g. apt install libcairo2-dev libpango1.0-dev pkg-config); ' +
  'or set VIDEO_MANIM to the manim executable'

run(async (argv) => {
  const { positional } = parseArgs(argv, {})
  const [id] = positional
  if (!id) throw new UsageError('usage: manim <scene-id>')
  const root = findRoot()
  const project = loadProject(root)
  const ref = findSceneRef(project, id)
  const scene = readJson(sceneFile(root, ref))
  if (scene.visual.type !== 'manim') {
    console.log(`${id}: visual.type ${scene.visual.type} needs no manim`)
    return 0
  }

  const sceneDir = join(root, ref.dir)
  const { manim } = scene.visual
  const file = resolveProjectPath(root, sceneDir, manim.file)
  if (!existsSync(file)) throw new UsageError(`${id}: visual.manim.file not found (${file})`)
  const { width, height, fps } = project.project.format
  const { durationSec, warnings } = sceneTiming(root, project, ref, scene)
  for (const w of warnings) console.warn(`warning: ${id}: ${w}`)

  const work = join(root, '.tmp', `manim-${id}`)
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const captionsFile = join(sceneDir, DEFAULTS.captionsFile)
  const cues = existsSync(captionsFile) ? JSON.parse(readFileSync(captionsFile, 'utf8')) : []
  const timingFile = join(work, 'timing.json')
  writeFileSync(timingFile, JSON.stringify({ durationSec, fps, width, height, cues }, null, 2) + '\n')

  const args = [
    'render', file, manim.class ?? 'Main',
    '--resolution', `${width},${height}`,
    '--frame_rate', String(fps),
    '--background_color', BACKGROUND,
    '--format', 'mp4',
    '--media_dir', work,
    '--output_file', 'manim',
    '--disable_caching',
    '--progress_bar', 'none',
  ]
  const env = {
    ...process.env,
    AVP_TIMING: timingFile,
    PYTHONPATH: [join(root, 'src', 'lib'), process.env.PYTHONPATH].filter(Boolean).join(delimiter),
  }
  const [command, ...pre] = manimCommand(root)
  console.log(`${id}: manim ${manim.file} ${manim.class ?? 'Main'} @ ${width}×${height} ${fps} fps (${durationSec.toFixed(2)}s)`)
  const r = spawnSync(command, [...pre, ...args], { cwd: sceneDir, env, stdio: 'inherit', windowsHide: true })
  if (r.error?.code === 'ENOENT') throw new UsageError(INSTALL_HINT)
  if (r.error) throw r.error
  if (r.status !== 0) throw new UsageError(`${id}: manim exited with code ${r.status}; see its error above`)

  const produced = findVideo(join(work, 'videos'))
  if (!produced) throw new UsageError(`${id}: manim finished but wrote no manim.mp4 under ${work}`)
  const out = join(sceneDir, 'assets', 'manim.mp4')
  mkdirSync(join(sceneDir, 'assets'), { recursive: true })
  copyFileSync(produced, `${out}.partial`)
  renameSync(`${out}.partial`, out)
  rmSync(work, { recursive: true, force: true })

  const sec = probeDuration(out)
  console.log(`${id}: wrote ${ref.dir}/assets/manim.mp4 (${sec.toFixed(2)}s, scene ${durationSec.toFixed(2)}s)`)
  if (sec < durationSec - 0.5) console.warn(`warning: ${id}: the animation ends ${(durationSec - sec).toFixed(1)}s early and its last frame is held; end construct() with finish(self)`)
  if (sec > durationSec + 0.5) console.warn(`warning: ${id}: the animation runs ${(sec - durationSec).toFixed(1)}s past the scene and is cut`)
  return 0
})

/** [command, ...leading args]. VIDEO_MANIM may name a Node script (a stand-in used by tests). */
function manimCommand(root) {
  const env = process.env.VIDEO_MANIM
  if (env) return /\.m?js$/.test(env) ? [process.execPath, env] : [env]
  for (const p of [join(root, '.venv', 'bin', 'manim'), join(root, '.venv', 'Scripts', 'manim.exe')]) {
    if (existsSync(p)) return [p]
  }
  return ['manim']
}

/** media_dir/videos/<file>/<quality>/manim.mp4; partial_movie_files holds the per-animation pieces. */
function findVideo(dir) {
  if (!existsSync(dir)) return null
  for (const d of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    const path = join(d.parentPath ?? d.path, d.name)
    if (d.isFile() && d.name === 'manim.mp4' && !path.includes('partial_movie_files')) return path
  }
  return null
}
