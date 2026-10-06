// `video-agent mcp`: stdio MCP server (SPEC §10). Guide resources and prompts wrap the site's static
// API; project tools wrap the project's pnpm scripts, writing JSON only through state.mjs (--by mcp).
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { guideText, unpackTemplate } from '../core/guide.mjs'
import { AgentError, PROJECT_FILE, assembleVideo, buildScene, findProject, patch, runScript, status } from '../core/project.mjs'

const BY = 'mcp'
const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] })
const failure = (message) => ({ content: [{ type: 'text', text: message }], isError: true })

/** Wraps a tool handler: AgentError and script failures become MCP tool errors, not crashes. */
const tool = (fn) => async (args) => {
  try {
    return await fn(args)
  } catch (err) {
    return failure(err instanceof AgentError ? err.message : String(err?.stack ?? err))
  }
}

const scriptResult = (r) => (r.code === 0 ? text(`${r.stdout}${r.stderr}`.trim() || 'ok') : failure(`${r.stdout}${r.stderr}`.trim() || `exit ${r.code}`))

export function createServer({ projectDir = process.cwd() } = {}) {
  const server = new McpServer({ name: 'video-agent', version: '1.0.0' })
  const rootOf = (project) => findProject(project ? resolve(projectDir, project) : projectDir)
  const projectArg = z.string().optional().describe('Project directory (defaults to the directory the server was started in).')
  const jsonPatch = z.array(z.record(z.any())).describe('RFC 6902 JSON Patch operations, e.g. [{"op":"replace","path":"/title","value":"…"}].')

  // Guide resources (static site content)
  const resources = [
    ['guide', 'video://guide', 'agent-guide.md', 'text/markdown', 'Agent guide: how to run the whole workflow (product videos)'],
    ['story-guide', 'video://guide/story', 'story-guide.md', 'text/markdown', 'Agent guide for story videos (project.kind "story"): story, cast and SVG animation'],
    ['story-design', 'video://guide/story/design', 'skills/story-video/design-guide.md', 'text/markdown', 'Story videos: art style, character rigs, voices and motion modules'],
    ['workflow', 'video://workflow', 'workflow.json', 'application/json', 'Workflow steps, gates, transitions (SPEC §6)'],
    ['schema-common', 'video://schemas/common', 'schemas/common.schema.json', 'application/json', 'Shared JSON Schema definitions'],
    ['schema-project', 'video://schemas/project', 'schemas/project.schema.json', 'application/json', 'video.project.json schema'],
    ['schema-scene', 'video://schemas/scene', 'schemas/scene.schema.json', 'application/json', 'scene.json schema'],
    ['rules-script', 'video://rules/script', 'rules/script.md', 'text/markdown', 'Narration writing rules'],
    ['rules-visual', 'video://rules/visual', 'rules/visual.md', 'text/markdown', 'Visual rules for scenes and overlay elements'],
    ['template', 'video://templates/product-introduction', 'templates/product-video/manifest.json', 'application/json', 'Project template manifest (files and SHA-256)'],
  ]
  for (const [name, uri, path, mimeType, description] of resources) {
    server.registerResource(name, uri, { description, mimeType }, async () => ({ contents: [{ uri, mimeType, text: await guideText(path) }] }))
  }
  server.registerResource('project', 'video://project/current', { description: 'Current project status report (pnpm run status --json)', mimeType: 'application/json' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await status(rootOf()), null, 2) }],
  }))

  // Prompts (generated from the Skill; see apps/video/tools/build-api.mjs)
  const prompts = [
    ['analyze', 'prompts/analyze-product.md', 'Analyze the product and write brief/product-brief.md'],
    ['analyze-style', 'prompts/analyze-style.md', 'Analyze a reference video and write brief/style.json'],
    ['storyboard', 'prompts/storyboard.md', 'Plan scenes and narration from the brief'],
  ]
  for (const [name, path, description] of prompts) {
    server.registerPrompt(name, { description }, async () => ({ messages: [{ role: 'user', content: { type: 'text', text: await guideText(path) } }] }))
  }
  server.registerPrompt(
    'scene-script',
    { description: 'Write or revise the narration and visual of one scene', argsSchema: { id: z.string().describe('scene id') } },
    async ({ id }) => ({
      messages: [{ role: 'user', content: { type: 'text', text: `目標 scene：${id}\n\n${await guideText('prompts/scene-script.md')}` } }],
    }),
  )

  // Project tools
  server.registerTool(
    'project_status',
    { description: 'Status of every scene, whether it is outdated, and the suggested next step.', inputSchema: { project: projectArg } },
    tool(async ({ project }) => text(await status(rootOf(project)))),
  )
  server.registerTool(
    'validate_project',
    { description: 'Validate all project JSON and paths (pnpm run validate).', inputSchema: { project: projectArg } },
    tool(async ({ project }) => scriptResult(await runScript(rootOf(project), 'validate'))),
  )
  server.registerTool(
    'create_project',
    {
      description:
        'Create a new video project from the site template (checksum-verified) in an empty directory and fill in its identity and sources. ' +
        'kind "product" (default) needs productUrl, sourceCodePath or description; kind "story" needs story (full text, outline or idea; see video://guide/story). ' +
        'Afterwards: run pnpm install there, and record the onlineTtsConsent gate with update_project after asking the user.',
      inputSchema: {
        directory: z.string().describe('New or empty directory for the project'),
        name: z.string().min(1),
        kind: z.enum(['product', 'story']).optional().describe('product (default): product introduction; story: turn a story into an SVG animation'),
        story: z.string().optional().describe('kind story: the story, an outline or just an idea, as the user gave it'),
        productUrl: z.string().url().optional(),
        requiresLogin: z.boolean().optional().describe('productUrl needs signing in: before capture, run pnpm run login so the user signs in in a window (gate productLogin); never ask for the password'),
        sourceCodePath: z.string().optional(),
        description: z.string().optional(),
        language: z.string().optional().describe('BCP 47 tag, default zh-TW'),
      },
    },
    tool(async ({ directory, name, kind = 'product', story, productUrl, requiresLogin, sourceCodePath, description, language }) => {
      if (kind === 'story' && !story && !description) throw new AgentError('a story project needs story (or description)')
      if (kind === 'product' && !productUrl && !sourceCodePath && !description) throw new AgentError('give at least one of productUrl, sourceCodePath, description')
      const dir = resolve(projectDir, directory)
      const manifest = await unpackTemplate(dir)
      const file = join(dir, PROJECT_FILE)
      const doc = JSON.parse(readFileSync(file, 'utf8'))
      doc.project.id = randomUUID()
      doc.project.name = name
      if (kind === 'story') {
        doc.project.kind = 'story'
        // Every story scene is a custom animation, so there is nothing to ask scene by scene.
        doc.project.customMotion = 'allow'
        doc.project.sources = { story: story ?? null, description: description ?? null }
      } else {
        doc.project.sources = { ...doc.project.sources, productUrl: productUrl ?? null, ...(productUrl && requiresLogin ? { requiresLogin: true } : {}), sourceCodePath: sourceCodePath ?? null, description: description ?? null }
      }
      if (language) doc.project.language = language
      doc.updatedAt = new Date().toISOString()
      doc.updatedBy = BY
      // A brand-new project has no other writers, so this one direct write is allowed (SPEC §7.3).
      writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`)
      const next = kind === 'story' ? 'develop the story (/video-story, video://guide/story)' : 'analyze (prompt "analyze")'
      return text({ directory: dir, specVersion: manifest.specVersion, files: manifest.files.length, next: ['pnpm install', 'record gates with update_project', next] })
    }),
  )
  server.registerTool(
    'create_scene',
    {
      description: 'Create a new scene (scene.json + script.md) and append it to the project scene order. The scene must be valid against video://schemas/scene.',
      inputSchema: {
        project: projectArg,
        dir: z.string().regex(/^scenes\/\d{3}-[a-z0-9-]+$/).describe('e.g. scenes/004-feature-deploy'),
        scene: z.record(z.any()).describe('scene.json content (status "draft")'),
        script: z.string().describe('Narration for script.md'),
      },
    },
    tool(async ({ project, dir, scene, script }) => {
      const root = rootOf(project)
      const sceneDir = join(root, dir)
      if (existsSync(sceneDir)) throw new AgentError(`${dir} already exists`)
      mkdirSync(join(sceneDir, 'assets'), { recursive: true })
      writeFileSync(join(sceneDir, 'scene.json'), `${JSON.stringify({ $schema: '../../schemas/scene.schema.json', ...scene }, null, 2)}\n`)
      writeFileSync(join(sceneDir, 'script.md'), script.endsWith('\n') ? script : `${script}\n`)
      const r = await patch(root, 'project', [{ op: 'add', path: '/scenes/-', value: { id: scene.id, dir } }], BY)
      // Registration failed (e.g. invalid scene): remove only what this call just created.
      if (r.code) rmSync(sceneDir, { recursive: true, force: true })
      return scriptResult(r)
    }),
  )
  server.registerTool(
    'update_scene',
    { description: 'Change a scene with a JSON Patch (validated, lock-protected, status changes checked against the workflow).', inputSchema: { project: projectArg, id: z.string(), patch: jsonPatch } },
    tool(async ({ project, id, patch: ops }) => scriptResult(await patch(rootOf(project), id, ops, BY))),
  )
  server.registerTool(
    'update_project',
    { description: 'Change video.project.json with a JSON Patch, e.g. record the TTS consent gate (/project/tts/consent) or status.', inputSchema: { project: projectArg, patch: jsonPatch } },
    tool(async ({ project, patch: ops }) => scriptResult(await patch(rootOf(project), 'project', ops, BY))),
  )
  server.registerTool(
    'render_scene',
    {
      description: 'Produce one scene end to end: narration (tts), capture, manim, render, and record its state. Failures are recorded on the scene. Respects the onlineTtsConsent gate.',
      inputSchema: { project: projectArg, id: z.string() },
    },
    tool(async ({ project, id }) => {
      const result = await buildScene(rootOf(project), id, { by: BY })
      return result.ok ? text(result.log) : { ...text(result.log), isError: true }
    }),
  )
  server.registerTool(
    'assemble_video',
    { description: 'Join all scenes into output/final.mp4 (+ final.srt) and mark the project completed.', inputSchema: { project: projectArg } },
    tool(async ({ project }) => {
      const result = await assembleVideo(rootOf(project), { by: BY })
      return result.ok ? text(result.output) : failure(result.output)
    }),
  )
  return server
}

export async function runMcp(options) {
  const server = createServer(options)
  await server.connect(new StdioServerTransport())
}
