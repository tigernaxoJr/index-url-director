// Environment-neutral protocol logic shared by the Node scripts and the Web UI (apps/video).
// No Node or DOM APIs here: callers supply file access and hashing.

/** Fields that describe state rather than content; excluded from the input hash (SPEC §4.2). */
export const HASH_EXCLUDED = new Set(['$schema', 'status', 'render', 'error', 'attempts', 'locked', 'updatedAt', 'updatedBy'])

/** JSON with object keys sorted, so key order never changes the hash. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** A script line spoken by a character: `【小狐狸】今天的月亮好圓。` (story projects). */
export const SPEAKER = /^【([^【】\s]+)】\s*(.*)$/

/** Sorted names of the characters who speak in a script. */
export function scriptSpeakers(script) {
  const names = new Set()
  for (const line of script.split(/\r?\n/)) {
    const m = line.trim().match(SPEAKER)
    if (m) names.add(m[1])
  }
  return [...names].sort()
}

/** A `uses` entry ending in `/` names a whole folder. */
const isDir = (p) => p.endsWith('/')

/** The scene's own animation program: `visual.motion` (JavaScript) or `visual.manim` (Python). */
const program = (scene) => scene.visual?.motion ?? scene.visual?.manim

/**
 * Paths a scene's content refers to (script, code file, asset, animation program and the shared
 * files it uses, element sources). Folders from `uses` are left out; see hashedDirs().
 */
export function referencedPaths(scene) {
  return [
    scene.narration?.scriptFile ?? 'script.md',
    scene.visual?.code?.file,
    program(scene)?.file,
    ...(program(scene)?.uses ?? []).filter((p) => !isDir(p)),
    scene.visual?.asset?.src,
    ...(scene.visual?.elements ?? []).map((el) => el.src),
  ].filter(Boolean)
}

/**
 * Project-relative folders whose every file the input hash covers: the scene's assets/ and the
 * folders in `motion.uses` / `manim.uses`. Callers list them and pass the files to hashFiles().
 */
export function hashedDirs(sceneDir, scene) {
  const used = (program(scene)?.uses ?? []).filter(isDir).map((p) => projectRelative(sceneDir, p))
  return [`${sceneDir}/assets`, ...used.filter((d) => d !== null)]
}

/**
 * Joins a stored path to a project-relative path: `@/x` is relative to the project root, anything
 * else to `sceneDir`. Returns null when the result would leave the project.
 */
export function projectRelative(sceneDir, p) {
  const parts = []
  for (const seg of (p.startsWith('@/') ? p.slice(2) : `${sceneDir}/${p}`).split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (!parts.length) return null
      parts.pop()
    } else parts.push(seg)
  }
  return parts.join('/')
}

/** Stand-in bytes for a referenced file that does not exist. */
export const MISSING = '<missing>'

/**
 * What the input hash covers, in order: [{ label, text } | { label, file }]. `files` is the sorted
 * list from hashFiles(). Each part contributes `label` + NUL, its bytes (text as UTF-8, file
 * contents, or MISSING), then NUL; SHA-256 over that sequence is `render.inputHash`. Callers read the
 * files, synchronously (Node) or asynchronously (browser). `speakers` is scriptSpeakers() of the
 * scene's script.
 */
export function hashParts(project, scene, files, speakers = []) {
  const content = Object.fromEntries(Object.entries(scene).filter(([k]) => !HASH_EXCLUDED.has(k)))
  const cast = (project.project.cast ?? []).filter((m) => speakers.includes(m.name))
  return [
    { label: 'scene', text: canonical(content) },
    // Burned captions are drawn when the scene renders, so their settings belong to the scene too.
    // The voices of the characters who speak in this scene (scriptSpeakers()) shape its audio.
    // Absent when nobody speaks, so product hashes stay as they were.
    {
      label: 'project',
      text: canonical({
        format: project.project.format,
        ...(project.project.captions?.mode === 'burn' && { captions: project.project.captions }),
        ...(cast.length && { cast }),
      }),
    },
    ...files.map((file) => ({ label: `file:${file}`, file })),
  ]
}

/** Sorted, de-duplicated list of files the hash covers, given the files listed under hashedDirs(). */
export function hashFiles(sceneDir, scene, assetFiles) {
  const files = new Set(assetFiles)
  for (const p of referencedPaths(scene)) {
    const rel = projectRelative(sceneDir, p)
    if (rel !== null) files.add(rel)
  }
  return [...files].sort()
}

/**
 * Suggests the next agent command from the project status and per-scene facts
 * ({ id, status, outdated, locked, error }). Shared by `pnpm run status` and the Web UI.
 */
export function suggestNext(project, scenes, errors = []) {
  if (errors.length) return { command: null, reason: 'fix the validation errors first' }
  const status = project.status
  if (project.project?.kind === 'story') {
    if (status === 'initialized') return { command: '/video-story', reason: 'project is initialized' }
    if (status === 'analyzed') return { command: '/video-design', reason: 'story is ready' }
    if (status === 'designed') return { command: '/video-storyboard', reason: 'cast and art are ready' }
  }
  if (status === 'initialized') return { command: '/video-analyze', reason: 'project is initialized' }
  if (['analyzed', 'designed'].includes(status)) return { command: '/video-storyboard', reason: 'brief is ready' }
  const failed = scenes.filter((s) => s.status === 'failed')
  if (failed.length) return { command: `/video-scene ${failed[0].id}`, reason: `${failed.length} scene(s) failed: ${failed[0].error}` }
  const stale = scenes.filter((s) => (s.outdated || s.status === 'stale') && !s.locked)
  if (stale.length) return { command: '/video-sync', reason: `${stale.length} scene(s) changed since their last render` }
  const lockedOutdated = scenes.filter((s) => s.outdated && s.locked)
  if (lockedOutdated.length) return { command: null, reason: `locked scene(s) changed: ${lockedOutdated.map((s) => s.id).join(', ')}; ask the user` }
  const pending = scenes.filter((s) => !['rendered', 'approved'].includes(s.status))
  if (pending.length) return { command: '/video-scene all', reason: `${pending.length} scene(s) not rendered yet` }
  if (status !== 'completed') return { command: '/video-assemble', reason: 'all scenes are rendered' }
  return { command: null, reason: 'done: output/final.mp4 is up to date' }
}

/**
 * Builds { project: Map<to, Set<from>|'any'>, scene: ... } from every transition in workflow.json.
 * A transition without `from` may be entered from any status.
 */
export function allowedTransitions(workflow) {
  const allowed = { project: new Map(), scene: new Map() }
  for (const step of [...workflow.steps, ...workflow.operations]) {
    for (const action of step.actions) {
      for (const t of action.transitions ?? []) {
        const map = allowed[t.target]
        if (!t.from) map.set(t.to, 'any')
        else if (map.get(t.to) !== 'any') map.set(t.to, new Set([...(map.get(t.to) ?? []), ...t.from]))
      }
    }
  }
  return allowed
}

/** Returns an error message when `from → to` is not a transition defined in workflow.json. */
export function checkTransition(workflow, target, from, to) {
  if (from === to) return null
  const froms = allowedTransitions(workflow)[target].get(to)
  if (froms === 'any' || froms?.has(from)) return null
  const options = froms ? [...froms].join(', ') : 'nowhere'
  return `${target} status ${from} → ${to} is not allowed by workflow.json (${to} is reachable from: ${options})`
}

/**
 * workflow.json `derivedProjectStatus` (SPEC §6.1) from per-scene facts
 * ({ status, upToDate, outputMtime }, null for a missing scene.json) and the final video's mtime
 * (0 when absent). Returns null when derivation does not apply.
 */
export function deriveStatus(projectStatus, facts, finalMtime) {
  if (facts.length === 0) return null
  if (['failed', 'initialized', 'analyzed', 'designed'].includes(projectStatus)) return null
  if (facts.every((f) => f?.upToDate)) {
    const newest = Math.max(...facts.map((f) => f.outputMtime))
    return finalMtime > newest ? 'completed' : 'ready_to_assemble'
  }
  if (facts.some((f) => f && f.status !== 'draft')) return 'producing'
  return 'script_generated'
}
