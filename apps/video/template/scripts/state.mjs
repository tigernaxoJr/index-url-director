// The only writer of video.project.json and existing scene.json files (SPEC §7.3, §10.2).
//
//   pnpm run state <project|scene-id> --status <status>
//   pnpm run state <scene-id> --rendered
//   pnpm run state <scene-id> --failed <step> "<message>" [--hint "<hint>"]
//   pnpm run state <project|scene-id> --patch-file <file>     (RFC 6902 JSON Patch)
//   pnpm run state <project|scene-id> --patch '<json>'
// options: --by agent|user|companion|mcp (default agent), --force (skip transition check)
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import jsonpatch from 'fast-json-patch'
import { parseArgs, run } from './lib/cli.mjs'
import { withLock, writeJsonAtomic } from './lib/io.mjs'
import { computeInputHash } from './lib/hash.mjs'
import { probeDuration } from './lib/media.mjs'
import { DEFAULTS, PROJECT_FILE, UsageError, findRoot, findSceneRef, readJson, sceneFile } from './lib/project.mjs'
import { loadSchemas } from './lib/schema.mjs'
import { checkTransition, deriveProjectStatus } from './lib/status.mjs'
import { assertValid, validateProject } from './lib/validate.mjs'

const WRITERS = ['agent', 'user', 'companion', 'mcp']
const ERROR_STEPS = ['tts', 'capture', 'manim', 'render', 'validate', 'other']

run((argv) => {
  const { positional, flags } = parseArgs(argv, { status: 1, failed: 2, hint: 1, 'patch-file': 1, patch: 1, by: 1 })
  const [target] = positional
  if (!target || positional.length > 1) throw new UsageError('usage: state <project|scene-id> <operation> [--by writer] [--force]')
  const ops = ['status', 'rendered', 'failed', 'patch-file', 'patch'].filter((op) => flags[op] !== undefined)
  if (ops.length !== 1) throw new UsageError('specify exactly one of --status, --rendered, --failed, --patch-file, --patch')
  const by = flags.by ?? 'agent'
  if (!WRITERS.includes(by)) throw new UsageError(`--by must be one of ${WRITERS.join(', ')}`)

  const root = findRoot()
  withLock(root, by, () => {
    const { workflow } = loadSchemas(root)
    const projectPath = join(root, PROJECT_FILE)
    const project = readJson(projectPath)
    const isProject = target === 'project'
    const ref = isProject ? null : findSceneRef(project, target)
    const file = isProject ? projectPath : sceneFile(root, ref)
    if (!existsSync(file)) throw new UsageError(`${file} does not exist; create new scene.json files directly, then register them`)
    const before = readJson(file)
    const doc = jsonpatch.deepClone(before)
    const kind = isProject ? 'project' : 'scene'
    const now = new Date().toISOString()

    const setStatus = (to) => {
      const problem = checkTransition(workflow, kind, doc.status, to)
      if (problem && !flags.force) throw new UsageError(`${problem}; pass --force only if the user asked for it`)
      if (!isProject && doc.status === 'failed' && to !== 'failed') doc.error = null
      doc.status = to
    }

    if (flags.status) {
      setStatus(flags.status)
    } else if (flags.rendered) {
      if (isProject) throw new UsageError('--rendered applies to scenes only')
      setStatus('rendered')
      const outputFile = doc.render?.outputFile ?? DEFAULTS.outputFile
      const output = join(root, ref.dir, outputFile)
      if (!existsSync(output)) throw new UsageError(`${ref.dir}/${outputFile} does not exist; render the scene first`)
      doc.render = {
        inputHash: computeInputHash(root, project, ref, doc),
        outputFile,
        renderedAt: now,
        actualDurationSec: readableDuration(output, `${ref.dir}/${outputFile}`),
      }
      doc.attempts = 0
      doc.error = null
    } else if (flags.failed) {
      if (isProject) throw new UsageError('--failed applies to scenes only; use --status failed for the project')
      const [step, message] = flags.failed
      if (!ERROR_STEPS.includes(step)) throw new UsageError(`step must be one of ${ERROR_STEPS.join(', ')}`)
      setStatus('failed')
      doc.error = { step, message, at: now, ...(flags.hint ? { hint: flags.hint } : {}) }
      doc.attempts = (doc.attempts ?? 0) + 1
    } else {
      const patch = flags.patch ? parseJson(flags.patch, '--patch') : parseJson(readFileSync(flags['patch-file'], 'utf8'), flags['patch-file'])
      if (!Array.isArray(patch)) throw new UsageError('a JSON Patch must be an array of operations')
      const patchError = jsonpatch.validate(patch, doc)
      if (patchError) throw new UsageError(`invalid patch: ${patchError.message.split('\n')[0]}`)
      const patched = jsonpatch.applyPatch(doc, patch, false, false).newDocument
      if (patched.status !== before.status) {
        const problem = checkTransition(workflow, kind, before.status, patched.status)
        if (problem && !flags.force) throw new UsageError(`${problem}; pass --force only if the user asked for it`)
      }
      Object.keys(doc).forEach((k) => delete doc[k])
      Object.assign(doc, patched)
    }
    doc.updatedAt = now
    doc.updatedBy = by

    // Validate the whole project with the pending write applied; nothing is written on failure.
    const overrides = new Map([[file, doc]])
    const result = validateProject(root, overrides)
    assertValid(result)

    // A revised storyboard (scenes added, removed or reordered) re-derives the project status. The
    // final video no longer matches the scene list, so it is at most ready_to_assemble.
    if (isProject && doc.status === before.status && JSON.stringify(doc.scenes) !== JSON.stringify(before.scenes)) {
      const derived = deriveProjectStatus(root, result.project, result.inspected)
      if (derived) doc.status = derived === 'completed' ? 'ready_to_assemble' : derived
    }

    const changes = [[file, doc, `${target}: ${before.status} → ${doc.status}`]]
    if (!isProject) {
      const current = result.project
      const derived = deriveProjectStatus(root, current, result.inspected)
      if (derived && derived !== current.status) {
        changes.push([projectPath, { ...current, status: derived, updatedAt: now, updatedBy: by }, `project: ${current.status} → ${derived}`])
      }
    }
    for (const [path, data] of changes) writeJsonAtomic(path, data)
    for (const [, , summary] of changes) console.log(summary)
    for (const w of result.warnings) console.warn(`warning: ${w}`)
  })
})

/** Output duration in seconds; an unreadable file means the render is broken and must not be recorded. */
function readableDuration(file, label) {
  try {
    return Math.round(probeDuration(file) * 1000) / 1000
  } catch (err) {
    throw new UsageError(`${label} is not a readable video; render the scene again (${err.message.split('\n')[0]})`)
  }
}

function parseJson(text, source) {
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new UsageError(`${source} is not valid JSON: ${err.message}`)
  }
}
