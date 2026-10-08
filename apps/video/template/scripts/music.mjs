// pnpm run music            → assets/music.mp3 + assets/music.json: instrumental BGM fitted to the scene timeline
// pnpm run music --preview  → brief/music/preview.mp3: the whole plan before narration exists (scene lengths estimated from script.md)
// pnpm run music --sample   → brief/music/sample.mp3: 24 s rising low → mid → high, to let the user hear the style
// Composed from project.audio.music and synthesized locally (scripts/lib/music.mjs); no network.
// Run after tts (scene lengths come from the narration); use the file by setting audio.bgm to assets/music.mp3.
// Writes files only; the agent records audio.bgm via `pnpm run state` (SPEC §7.3).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs, run } from './lib/cli.mjs'
import { ffmpeg, probeDuration } from './lib/media.mjs'
import { compose, renderAudio, wav } from './lib/music.mjs'
import { parseScript } from './lib/narration.mjs'
import { DEFAULTS, UsageError, findRoot, loadProject, loadScenes, resolveProjectPath } from './lib/project.mjs'
import { TAIL_SEC, sceneTiming } from './lib/scene-plan.mjs'
import { layout } from './lib/timeline.mjs'

const SR = 48000
// A little room so the dry synth does not sound like it is in a box.
const REVERB = 'aecho=0.8:0.6:73|131:0.22|0.14'
/** Speaking rate used by --preview when a scene has no narration audio yet (as in the storyboard step). */
const CHARS_PER_SEC = 4

run(async (argv) => {
  const { flags } = parseArgs(argv)
  const root = findRoot()
  const project = loadProject(root)
  const music = project.project.audio?.music

  if (flags.sample) {
    const energies = ['low', 'mid', 'high']
    const sampleMusic = { ...music, sections: Object.fromEntries(energies.map((energy) => [energy, { energy }])), cues: [] }
    const score = compose(sampleMusic, { totalSec: 24, sections: energies.map((scene, i) => ({ scene, start: i * 8 })) })
    const out = join(root, 'brief', 'music', 'sample.mp3')
    encode(score, out)
    console.log(`sample: ${describe(score)} → brief/music/sample.mp3 (${probeDuration(out).toFixed(2)}s)`)
    return 0
  }

  if (!music) throw new UsageError('project.audio.music is not set; add it (at least {}) with pnpm run state project --patch-file')
  const loaded = loadScenes(root, project)
  if (loaded.length === 0) throw new UsageError('video.project.json lists no scenes')
  const estimated = []
  const clips = loaded.map(({ ref, scene }) => {
    if (!scene) throw new UsageError(`${ref.id}: scene.json missing`)
    return { duration: sceneLength(root, project, ref, scene, flags.preview, estimated), transition: scene.visual.transitionIn ?? 'none' }
  })
  const { items, total } = layout(clips, project.project.format.fps)
  const sections = loaded.map(({ ref, scene }, i) => ({ scene: ref.id, start: items[i].start, speakers: speakers(root, project, ref, scene) }))
  const score = compose(music, { totalSec: total, sections })

  if (flags.preview) {
    const out = join(root, 'brief', 'music', 'preview.mp3')
    encode(score, out)
    console.log(`preview: ${describe(score)}, ${total.toFixed(2)}s → brief/music/preview.mp3`)
    if (estimated.length) console.log(`lengths estimated from script.md for ${estimated.join(', ')}; pnpm run music after tts fits the real ones`)
    report(score)
    return 0
  }

  const out = join(root, DEFAULTS.musicFile)
  encode(score, out)
  const { settings: s, events, ...info } = score
  const infoFile = join(root, DEFAULTS.musicInfoFile)
  const { rhythm, motif, progressions, ...settings } = s
  writeFileSync(`${infoFile}.tmp`, JSON.stringify({ ...settings, ...info, totalSec: Math.round(total * 1000) / 1000 }, null, 2) + '\n')
  renameSync(`${infoFile}.tmp`, infoFile)

  console.log(`music: ${describe(score)}, ${sections.length} section(s), ${probeDuration(out).toFixed(2)}s → ${DEFAULTS.musicFile} (+ ${DEFAULTS.musicInfoFile})`)
  report(score)
  if (project.project.audio?.bgm !== DEFAULTS.musicFile) {
    console.log(`next: set audio.bgm to "${DEFAULTS.musicFile}" with pnpm run state project --patch-file, then pnpm run assemble`)
  }
  return 0
})

/** The scene's length; with --preview, estimated from the script when there is no narration audio yet. */
function sceneLength(root, project, ref, scene, preview, estimated) {
  try {
    return sceneTiming(root, project, ref, scene).durationSec
  } catch (err) {
    if (!preview || !(err instanceof UsageError)) throw err
    const script = readFileSync(resolveProjectPath(root, join(root, ref.dir), scene.narration.scriptFile), 'utf8')
    const chars = parseScript(script).filter((b) => b.type === 'text').flatMap((b) => b.lines).join('').replace(/\s+/g, '').length
    estimated.push(ref.id)
    return Math.max(2, chars / CHARS_PER_SEC + TAIL_SEC)
  }
}

/** Cast ids of the characters who speak in the scene (【name】 lines), in order of appearance. */
function speakers(root, project, ref, scene) {
  const cast = project.project.cast ?? []
  const file = resolveProjectPath(root, join(root, ref.dir), scene.narration.scriptFile)
  if (!cast.length || !existsSync(file)) return []
  const names = parseScript(readFileSync(file, 'utf8')).map((b) => b.speaker).filter(Boolean)
  return [...new Set(names)].map((name) => cast.find((m) => m.name === name)?.id).filter(Boolean)
}

/** One line per scene: when its music starts and what it plays, so the agent can describe the plan. */
function report(score) {
  for (const p of score.sections) {
    console.log(`  ${p.scene}  ${p.start.toFixed(1)}s  ${p.energy}  ${p.key} ${p.mode} ${p.progression.join('–')}  ${p.instruments.join('+')}  melody: ${p.melody ?? 'none'}`)
  }
}

/** Synthesizes the score and writes it as MP3, replacing `out` only when encoding succeeds. */
function encode(score, out) {
  mkdirSync(dirname(out), { recursive: true })
  const work = mkdtempSync(join(tmpdir(), 'avp-music-'))
  const partial = out.replace(/\.mp3$/, '.partial.mp3')
  try {
    const file = join(work, 'music.wav')
    writeFileSync(file, wav(renderAudio(score, SR), SR))
    ffmpeg(['-i', file, '-af', REVERB, '-t', score.totalSec.toFixed(3), '-c:a', 'libmp3lame', '-b:a', '192k', partial])
    renameSync(partial, out)
  } catch (err) {
    rmSync(partial, { force: true })
    throw err
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function describe({ settings: s }) {
  return `${s.preset} ${s.bpm} BPM ${s.key} ${s.mode}, ${s.instruments.join(' + ')}`
}
