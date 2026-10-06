// Turns scene.json + project format into a render plan (SPEC §7.6): duration,
// background layer, overlay elements and narration. The renderer draws exactly this plan.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { probeDuration } from './media.mjs'
import { DEFAULTS, UsageError, resolveProjectPath } from './project.mjs'

/** Silence kept after the narration when durationSec is null (SPEC §4.2). */
export const TAIL_SEC = 0.5

/**
 * Returns { plan, warnings }. File-backed layers carry an absolute `file`; the renderer turns
 * them into URLs. Video layers also carry `span` (seconds on screen) for normalization.
 */
export function buildPlan(root, project, ref, scene) {
  const { width, height, fps } = project.project.format
  const sceneDir = join(root, ref.dir)
  const resolve = (p) => resolveProjectPath(root, sceneDir, p)
  const need = (file, what) => {
    if (!existsSync(file)) throw new UsageError(`${scene.id}: ${what} not found (${file})`)
    return file
  }

  const { audioFile, audioSec, frames, durationSec: duration, warnings } = sceneTiming(root, project, ref, scene)
  const plan = {
    id: scene.id,
    width,
    height,
    fps,
    frames,
    durationSec: duration,
    background: background(scene.visual, resolve, need, sceneDir, duration),
    elements: [],
    audio: audioSec == null ? null : { file: audioFile, durationSec: audioSec },
  }
  if (plan.background.kind === 'module') {
    // Who says what when, so a motion module can animate the speaking character.
    const captionsFile = join(sceneDir, DEFAULTS.captionsFile)
    plan.cues = existsSync(captionsFile) ? JSON.parse(readFileSync(captionsFile, 'utf8')) : []
    plan.cast = (project.project.cast ?? []).map(({ id, name }) => ({ id, name }))
  }
  if (['web-capture', 'manim'].includes(scene.visual.type)) {
    const recSec = probeDuration(plan.background.file)
    const what = scene.visual.type === 'manim' ? 'manim video' : 'recording'
    if (recSec > duration + 0.5) {
      warnings.push(`the ${what} (${recSec.toFixed(2)}s) is longer than the scene (${duration.toFixed(2)}s); the last ${(recSec - duration).toFixed(1)}s is cut`)
    } else if (scene.visual.type === 'manim' && recSec < duration - 0.5) {
      warnings.push(`the manim video (${recSec.toFixed(2)}s) is shorter than the scene (${duration.toFixed(2)}s); its last frame is held; run "pnpm run manim ${scene.id}" again if the narration changed`)
    }
  }

  for (const [i, el] of (scene.visual.elements ?? []).entries()) {
    if (el.at >= duration) {
      warnings.push(`visual.elements[${i}] starts at ${el.at}s, after the scene ends (${duration.toFixed(2)}s); skipped`)
      continue
    }
    const end = el.duration ? Math.min(el.at + el.duration, duration) : duration
    const item = {
      type: el.type,
      at: el.at,
      end,
      exitAt: el.duration ? end : null,
      animation: el.animation ?? 'fadeIn',
      position: el.position ?? 'center',
    }
    if (el.type === 'text') Object.assign(item, { content: el.content, size: el.size ?? 'normal' })
    else item.file = need(resolve(el.src), `visual.elements[${i}].src`)
    if (el.type === 'video') item.span = end - el.at
    plan.elements.push(item)
  }
  return { plan, warnings }
}

/**
 * The scene's length: durationSec, or the narration plus TAIL_SEC when null, rounded to whole
 * frames. Returns { audioFile, audioSec, frames, durationSec, warnings }.
 */
export function sceneTiming(root, project, ref, scene) {
  const { fps } = project.project.format
  const warnings = []
  const audioFile = resolveProjectPath(root, join(root, ref.dir), scene.narration.audioFile ?? DEFAULTS.audioFile)
  const audioSec = existsSync(audioFile) ? probeDuration(audioFile) : null
  let duration = scene.durationSec
  if (duration == null) {
    if (audioSec == null) {
      throw new UsageError(`${scene.id}: durationSec is null and there is no narration audio; run "pnpm run tts ${scene.id}" or set durationSec`)
    }
    duration = audioSec + TAIL_SEC
  } else if (audioSec != null && audioSec > duration) {
    warnings.push(`narration (${audioSec.toFixed(2)}s) is longer than durationSec (${duration}s) and will be cut off`)
  }
  const frames = Math.max(1, Math.round(duration * fps))
  return { audioFile, audioSec, frames, durationSec: frames / fps, warnings }
}

function background(visual, resolve, need, sceneDir, duration) {
  switch (visual.type) {
    case 'web-capture':
      return {
        kind: 'video',
        file: need(join(sceneDir, 'assets', 'capture.mp4'), 'web-capture recording (run pnpm run capture)'),
        fit: 'contain',
        trimStart: 0,
        trimEnd: null,
        span: duration,
      }
    case 'screenshot':
      return {
        kind: 'image',
        file: need(join(sceneDir, 'assets', 'capture.png'), 'screenshot (run pnpm run capture)'),
        fit: 'cover',
        kenBurns: true,
      }
    case 'code': {
      const { code } = visual
      const source = code.file ? readFileSync(need(resolve(code.file), 'visual.code.file'), 'utf8') : code.content
      const lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/\n+$/, '').split('\n')
      return { kind: 'code', language: code.language, lines, highlightLines: code.highlightLines ?? [] }
    }
    case 'user-asset': {
      const { asset } = visual
      const file = need(resolve(asset.src), 'visual.asset.src')
      if (asset.kind === 'image') return { kind: 'image', file, fit: asset.fit ?? 'contain', kenBurns: false }
      return { kind: 'video', file, fit: asset.fit ?? 'contain', trimStart: asset.trimStartSec ?? 0, trimEnd: asset.trimEndSec ?? null, span: duration }
    }
    case 'manim':
      return {
        kind: 'video',
        file: need(join(sceneDir, 'assets', 'manim.mp4'), 'manim video (run pnpm run manim)'),
        fit: 'contain',
        trimStart: 0,
        trimEnd: null,
        span: duration,
      }
    default: // motion-graphic: the agent's own animation module, or the theme gradient
      if (visual.motion) return { kind: 'module', file: need(resolve(visual.motion.file), 'visual.motion.file') }
      return { kind: 'gradient' }
  }
}

/** Every video layer in the plan (background first), for normalization before rendering. */
export function videoLayers(plan) {
  return [plan.background, ...plan.elements].filter((l) => l.kind === 'video' || l.type === 'video')
}
