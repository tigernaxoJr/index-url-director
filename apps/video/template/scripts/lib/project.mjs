// Project discovery, file access and path resolution shared by all scripts.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const PROJECT_FILE = 'video.project.json'
export const NIL_UUID = '00000000-0000-0000-0000-000000000000'

export class UsageError extends Error {}

/** Walks up from `start` until a directory containing video.project.json is found. */
export function findRoot(start = process.cwd()) {
  let dir = resolve(start)
  for (;;) {
    if (existsSync(join(dir, PROJECT_FILE))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new UsageError(`${PROJECT_FILE} not found in ${start} or any parent directory`)
    dir = parent
  }
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new UsageError(`cannot read ${path}: ${err.message}`)
  }
}

export function loadProject(root) {
  return readJson(join(root, PROJECT_FILE))
}

export function sceneFile(root, ref) {
  return join(root, ref.dir, 'scene.json')
}

export function findSceneRef(project, id) {
  const ref = project.scenes.find((s) => s.id === id)
  if (!ref) throw new UsageError(`scene ${id} is not listed in ${PROJECT_FILE}`)
  return ref
}

/** Loads every scene listed in the project, in playback order. Missing files yield `scene: null`. */
export function loadScenes(root, project) {
  return project.scenes.map((ref) => {
    const file = sceneFile(root, ref)
    return { ref, file, scene: existsSync(file) ? readJson(file) : null }
  })
}

/** True when `path` is inside `root` (or equal to it). */
export function isInside(root, path) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel) && !rel.startsWith(sep))
}

/**
 * Resolves a path stored in a scene or project file.
 * `@/x` is relative to the project root; anything else is relative to `baseDir`.
 * Throws when the result escapes the project root.
 */
export function resolveProjectPath(root, baseDir, p) {
  const abs = p.startsWith('@/') ? join(root, p.slice(2)) : resolve(baseDir, p)
  if (!isInside(root, abs)) throw new UsageError(`path ${p} escapes the project root`)
  return abs
}

/** All project-relative paths a scene references, as [label, storedPath] pairs. */
export function scenePaths(scene) {
  const paths = []
  const add = (label, p) => p && paths.push([label, p])
  add('narration.scriptFile', scene.narration?.scriptFile)
  add('narration.audioFile', scene.narration?.audioFile)
  add('visual.code.file', scene.visual?.code?.file)
  add('visual.asset.src', scene.visual?.asset?.src)
  scene.visual?.motion?.uses?.forEach((p, i) => add(`visual.motion.uses[${i}]`, p))
  scene.visual?.capture?.actions?.forEach((a, i) => add(`visual.capture.actions[${i}].file`, a.file))
  scene.visual?.elements?.forEach((el, i) => add(`visual.elements[${i}].src`, el.src))
  add('render.outputFile', scene.render?.outputFile)
  return paths
}

export const DEFAULTS = {
  scriptFile: 'script.md',
  audioFile: 'assets/narration.mp3',
  captionsFile: 'assets/captions.json',
  outputFile: 'output/scene.mp4',
  finalFile: 'output/final.mp4',
  musicFile: 'assets/music.mp3',
  musicInfoFile: 'assets/music.json',
}
