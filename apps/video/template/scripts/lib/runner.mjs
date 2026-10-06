// Runs this project's scripts as child processes, and the deterministic part of build_scene built
// on them. Shared by the Companion (scripts/companion.mjs) and the video-agent MCP server, which
// imports it from the project so its behaviour always matches the project's template version.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_FILE, UsageError } from './project.mjs'

/**
 * Runs `node scripts/<script>.mjs ...args` in the project. Resolves { code, stdout, stderr };
 * `onLine` receives output lines as they arrive (for progress in the Web UI).
 */
export function runScript(root, script, args = [], { onLine, env } = {}) {
  const file = join(root, 'scripts', `${script}.mjs`)
  if (!existsSync(file)) return Promise.resolve({ code: 1, stdout: '', stderr: `scripts/${script}.mjs not found in the project` })
  return runProcess(process.execPath, [file, ...args], { cwd: root, onLine, env })
}

export function runProcess(command, args, { cwd, onLine, env } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true })
    let stdout = ''
    let stderr = ''
    const lines = (stream, sink) => {
      let buf = ''
      stream.on('data', (d) => {
        const text = String(d)
        sink(text)
        buf += text
        const parts = buf.split(/\r?\n/)
        buf = parts.pop()
        for (const line of parts) onLine?.(line)
      })
      stream.on('end', () => buf && onLine?.(buf))
    }
    lines(child.stdout, (t) => (stdout += t))
    lines(child.stderr, (t) => (stderr += t))
    child.on('error', (err) => resolvePromise({ code: 1, stdout, stderr: `${stderr}${err.message}` }))
    child.on('close', (code) => resolvePromise({ code: code ?? 1, stdout, stderr }))
  })
}

/** `pnpm run status --json`: validation result plus per-scene report and the suggested next step. */
export async function status(root) {
  const r = await runScript(root, 'validate', ['--report', '--json'])
  try {
    return JSON.parse(r.stdout)
  } catch {
    throw new UsageError(r.stderr.trim() || 'validate produced no report')
  }
}

const firstLine = (text) => text.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? 'failed'

/**
 * The deterministic part of build_scene (workflow.json): tts → capture → manim → assets_ready → rendering →
 * render:scene → rendered. Stops at the first failure and records it with `state --failed`.
 * Used by the Companion's "redo now" and the MCP `render_scene` tool. Returns { ok, log }.
 */
export async function buildScene(root, id, { by, onLine } = {}) {
  const log = []
  const step = async (label, script, args) => {
    onLine?.(`▶ ${label}`)
    const r = await runScript(root, script, args, { onLine })
    log.push({ step: label, code: r.code, output: `${r.stdout}${r.stderr}`.trim() })
    return r
  }
  const fail = async (errorStep, r) => {
    await runScript(root, 'state', [id, '--failed', errorStep, firstLine(r.stderr || r.stdout), '--by', by])
    return { ok: false, log }
  }

  const report = await status(root)
  const scene = report.report?.scenes.find((s) => s.id === id)
  if (!scene) throw new UsageError(`scene ${id} is not listed in ${PROJECT_FILE}`)
  if (scene.locked) throw new UsageError(`scene ${id} is locked; unlock it first`)

  if (['script_generated', 'ready_to_assemble', 'completed'].includes(report.report.project.status)) {
    await step('project producing', 'state', ['project', '--status', 'producing', '--by', by])
  }
  // Rendered/approved scenes must pass through stale before assets_ready (workflow transitions);
  // a scene left in `rendering` by an interrupted run is recorded as failed first.
  if (['rendered', 'approved'].includes(scene.status)) {
    await step('mark stale', 'state', [id, '--status', 'stale', '--by', by])
  } else if (scene.status === 'rendering') {
    await step('recover', 'state', [id, '--failed', 'render', 'previous render was interrupted', '--by', by])
  }
  let r = await step('tts', 'tts', [id])
  if (r.code) return fail('tts', r)
  r = await step('capture', 'capture', [id])
  if (r.code) return fail('capture', r)
  r = await step('manim', 'manim', [id])
  if (r.code) return fail('manim', r)
  r = await step('assets ready', 'state', [id, '--status', 'assets_ready', '--by', by])
  if (r.code) return fail('other', r)
  r = await step('rendering', 'state', [id, '--status', 'rendering', '--by', by])
  if (r.code) return fail('other', r)
  r = await step('render', 'render-scene', [id])
  if (r.code) return fail('render', r)
  r = await step('rendered', 'state', [id, '--rendered', '--by', by])
  if (r.code) return fail('render', r)
  return { ok: true, log }
}

/** assemble + mark the project completed. */
export async function assembleVideo(root, { by, onLine } = {}) {
  const r = await runScript(root, 'assemble', [], { onLine })
  if (r.code) return { ok: false, output: `${r.stdout}${r.stderr}`.trim() }
  const s = await runScript(root, 'state', ['project', '--status', 'completed', '--by', by])
  return { ok: s.code === 0, output: `${r.stdout}${r.stderr}${s.stdout}${s.stderr}`.trim() }
}
