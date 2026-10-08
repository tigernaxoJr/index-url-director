// pnpm run assemble   → output/final.mp4 (+ output/final.srt unless captions.mode is none)
// Joins scene outputs in video.project.json order with transitions, merges captions, mixes BGM.
// Scene videos are stream-copied; only transitions (out to the nearest keyframes) are re-encoded,
// unless the scenes are encoded differently.
// Burned captions are already in the scene videos (render-scene draws them).
// Writes files only; the agent records status via `pnpm run state` (SPEC §7.3).
// The previous final.mp4 / final.srt are replaced only when the new assemble succeeds.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseArgs, run } from './lib/cli.mjs'
import { AUDIO_ENCODE, VIDEO_ENCODE, ffmpeg, keyframes, probeDuration, probeVideoDuration, videoSignature } from './lib/media.mjs'
import { DEFAULTS, UsageError, findRoot, loadProject, resolveProjectPath } from './lib/project.mjs'
import { inspectScenes } from './lib/status.mjs'
import { concatList, copyPlan, filterGraph, layout, mergeCaptions, spanGraph, toSrt } from './lib/timeline.mjs'

run(async (argv) => {
  parseArgs(argv)
  const root = findRoot()
  const project = loadProject(root)
  const { format, captions = {}, audio = {} } = project.project
  if (project.scenes.length === 0) throw new UsageError('video.project.json lists no scenes')

  // Every scene must be rendered/approved, have its output, and be unchanged since it was rendered.
  const inspected = inspectScenes(root, project)
  const notReady = inspected.filter((s) => !s.upToDate)
  if (notReady.length) {
    const why = (s) =>
      s.missing ? 'scene.json missing'
        : !['rendered', 'approved'].includes(s.scene.status) ? `status ${s.scene.status}`
        : !s.hasOutput ? 'output missing'
        : 'inputs changed since render'
    throw new UsageError(
      `not ready to assemble; redo these scenes first (pnpm run status):\n${notReady.map((s) => `  - ${s.ref.id}: ${why(s)}`).join('\n')}`,
    )
  }

  const warnings = []
  const clips = inspected.map((s) => ({
    file: s.output,
    duration: Math.round(probeVideoDuration(s.output) * format.fps) / format.fps,
    transition: s.scene.visual.transitionIn ?? 'none',
  }))
  const timeline = layout(clips, format.fps)

  const mode = captions.mode ?? 'srt'
  const cues = mergeCaptions(
    timeline,
    inspected.map((s) => {
      const file = join(root, s.ref.dir, DEFAULTS.captionsFile)
      if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
      if (mode !== 'none') warnings.push(`${s.ref.id}: no ${DEFAULTS.captionsFile}; run pnpm run tts ${s.ref.id} to get captions`)
      return []
    }),
  )

  let bgm = null
  if (audio.bgm) {
    const file = resolveProjectPath(root, root, audio.bgm)
    if (existsSync(file)) bgm = { file, volume: audio.bgmVolume ?? 0.25, ducking: audio.ducking ?? true }
    else warnings.push(`audio.bgm ${audio.bgm} not found; assembling without background music`)
    const info = join(root, DEFAULTS.musicInfoFile)
    if (bgm && file === join(root, DEFAULTS.musicFile) && existsSync(info)) {
      const made = JSON.parse(readFileSync(info, 'utf8')).totalSec
      if (Math.abs(made - timeline.total) > 0.05) {
        warnings.push(`${DEFAULTS.musicFile} was made for ${made}s but the video is ${timeline.total.toFixed(2)}s; run pnpm run music to fit it again`)
      }
    }
  }

  const work = join(root, '.tmp', 'assemble')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const outDir = join(root, 'output')
  mkdirSync(outDir, { recursive: true })
  const finalFile = join(root, DEFAULTS.finalFile)
  const partial = finalFile.replace(/\.mp4$/, '.partial.mp4')

  try {
    const copied = copyVideo(clips, timeline, format.fps, work)
    const graph = filterGraph(timeline, { fps: format.fps, bgm, video: !copied })
    const inputs = clips.flatMap((c) => ['-i', c.file])
    if (bgm) inputs.push('-stream_loop', '-1', '-i', bgm.file)
    let video = ['-map', '[vout]', ...VIDEO_ENCODE, '-r', String(format.fps)]
    if (copied) {
      // The video was put together by copyVideo; only the audio (narration, BGM) is mixed and encoded.
      inputs.push('-f', 'concat', '-safe', '0', '-i', 'videos.txt')
      video = ['-map', `${clips.length + (bgm ? 1 : 0)}:v`, '-c:v', 'copy']
    }
    const how = !copied ? 're-encoding video'
      : copied.encoded ? `re-encoding ${(copied.encoded / format.fps).toFixed(2)}s around transitions, copying the rest`
      : 'joining video without re-encoding'
    console.log(`assembling ${clips.length} scene(s), ${timeline.total.toFixed(2)}s${bgm ? ', with BGM' : ''}, ${how}`)
    ffmpeg(
      [...inputs, '-filter_complex', graph, ...video, '-map', '[aout]', ...AUDIO_ENCODE, '-movflags', '+faststart', '-t', timeline.total.toFixed(3), partial],
      { cwd: work },
    )
    renameSync(partial, finalFile)
    if (mode !== 'none') {
      const srt = join(outDir, 'final.srt')
      writeFileSync(`${srt}.tmp`, toSrt(cues))
      renameSync(`${srt}.tmp`, srt)
    }
  } catch (err) {
    rmSync(partial, { force: true })
    throw err
  } finally {
    rmSync(work, { recursive: true, force: true })
  }

  for (const w of warnings) console.warn(`warning: ${w}`)
  const rel = (p) => relative(root, p).split('\\').join('/')
  console.log(`assembled ${rel(finalFile)} (${probeDuration(finalFile).toFixed(2)}s)${mode !== 'none' ? `, ${cues.length} caption(s) → output/final.srt` : ''}`)
  return 0
})

/**
 * Puts the video together without re-encoding the scenes: writes `work`/videos.txt (a concat list
 * of scene pieces cut at keyframes and re-encoded transition spans) and returns { encoded } (frames
 * re-encoded). Returns null when the scenes cannot be copied: their encodings differ, or a
 * re-encoded span would not match them; the caller then re-encodes everything.
 */
function copyVideo(clips, timeline, fps, work) {
  const signatures = clips.map((c) => videoSignature(c.file))
  if (signatures.some((s) => s !== signatures[0])) return null
  const keys = timeline.items.map((item, i) => (item.overlap || timeline.items[i + 1]?.overlap ? keyframes(clips[i].file, fps) : [0]))
  const at = (frame) => ((frame - 0.5) / fps).toFixed(6) // just before a frame, so float error cannot skip it
  const pieces = []
  let encoded = 0
  for (const [k, span] of copyPlan(timeline, keys, fps).entries()) {
    if (span.copy) {
      const { scene, from, to } = span.copy
      const frames = Math.round(clips[scene].duration * fps)
      let file = clips[scene].file
      if (from > 0 || to < frames) {
        // Cut at the keyframes `from` / `to`; the segment muxer splits only on keyframes.
        const times = [from, to].filter((f) => f > 0 && f < frames).map(at)
        ffmpeg(['-i', file, '-map', '0:v', '-c', 'copy', '-f', 'segment', '-segment_times', times.join(','), '-reset_timestamps', '1', `piece-${k}-%d.mp4`], { cwd: work })
        file = join(work, `piece-${k}-${from > 0 ? 1 : 0}.mp4`)
      }
      pieces.push({ file, frames: to - from })
    } else {
      const seek = span.encode.map((p) => keys[p.scene].findLast((f) => f <= p.from) ?? 0)
      const inputs = span.encode.flatMap((p, i) => [
        ...(seek[i] > 0 ? ['-noaccurate_seek', '-ss', ((seek[i] + 0.25) / fps).toFixed(6)] : []),
        '-t', ((p.to - seek[i] + 2) / fps).toFixed(6),
        '-i', clips[p.scene].file,
      ])
      const file = join(work, `span-${k}.mp4`)
      ffmpeg([...inputs, '-filter_complex', spanGraph(span.encode, seek, fps), '-map', '[vout]', ...VIDEO_ENCODE, '-r', String(fps), '-frames:v', String(span.frames), file])
      if (videoSignature(file) !== signatures[0]) return null
      pieces.push({ file, frames: span.frames })
      encoded += span.frames
    }
  }
  writeFileSync(join(work, 'videos.txt'), concatList(pieces, fps))
  return { encoded }
}
