// Builds the Guide API: dist/api/* (schemas, prompts, rules, Skill and template zips
// with SHA-256 manifest). Run after the Web UI build (pnpm run build does both).
// Deployed to GitHub Pages by .github/workflows/deploy-pages.yml.
//
//   node apps/video/tools/build-api.mjs [--site-url <url>] [--out <dir>]
//
// SITE_URL resolution: --site-url → $SITE_URL → $GITHUB_REPOSITORY → git remote "origin"
// (https://<owner>.github.io/<repo>). The base path therefore always follows the repo name.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import { claudeCommands } from './lib/commands.mjs'
import { absolutizeLinks, section, stripFrontmatter } from './lib/markdown.mjs'

const videoDir = fileURLToPath(new URL('../', import.meta.url))
const root = fileURLToPath(new URL('../../../', import.meta.url))
const specsDir = join(videoDir, 'specs')
const skillDir = join(videoDir, 'skills', 'product-video')
const storySkillDir = join(videoDir, 'skills', 'story-video')
/** product-video documents shipped inside the story-video Skill too (its rendering is the same). */
const STORY_SHARED = ['rendering-guide.md']
const templateDir = join(videoDir, 'template')
const SCHEMAS = ['common.schema.json', 'project.schema.json', 'scene.schema.json', 'activity.schema.json', 'workflow.schema.json']
/** Paths never shipped in the template zip (relative, forward slashes). */
const TEMPLATE_EXCLUDE = [/(^|\/)node_modules\//, /^\.tmp\//, /^output\//, /^scenes\/[^/]+\/output\//, /(^|\/)\.video-agent\.lock$/, /(^|\/)__pycache__\//, /^\.venv\//]
/** Fixed timestamp so identical inputs give byte-identical zips (and stable hashes). */
const ZIP_MTIME = new Date(1980, 0, 1)

/** Published prompts and rules, cut from the Skill so the Skill stays the single source (SPEC §5). */
const EXTRACTS = {
  'prompts/analyze-product.md': { title: '分析產品', from: [['workflow.md', 'analyze']] },
  'prompts/analyze-style.md': { title: '分析參考影片風格', from: [['workflow.md', 'style']] },
  'prompts/storyboard.md': { title: '規劃分鏡與旁白', from: [['script-guide.md', null]] },
  'prompts/scene-script.md': { title: '撰寫單一 scene 的旁白與畫面', from: [['script-guide.md', 'narration'], ['script-guide.md', 'visual']] },
  'rules/script.md': { title: '文案規則', from: [['script-guide.md', 'narration']] },
  'rules/visual.md': {
    title: '視覺規則',
    from: [['script-guide.md', 'visual'], ['rendering-guide.md', 'visual-types'], ['rendering-guide.md', 'elements']],
  },
}

export function build({ siteUrl, out }) {
  siteUrl = siteUrl.replace(/\/+$/, '')
  const api = join(out, 'api')
  const skillUrl = `${siteUrl}/api/skills/product-video`
  const sub = (text) => text.replaceAll('{{SITE_URL}}', siteUrl)
  const write = (rel, data) => {
    const file = join(out, rel)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, data)
    return file
  }
  // Only dist/api belongs to this script; the Web UI (vite build) owns the rest of dist/.
  rmSync(api, { recursive: true, force: true })

  // Schemas and workflow
  for (const f of SCHEMAS) write(`api/schemas/${f}`, readFileSync(join(specsDir, f)))
  const workflowText = readFileSync(join(specsDir, 'workflow.json'), 'utf8')
  write('api/workflow.json', workflowText)
  const workflow = JSON.parse(workflowText)

  // Skill: individual documents and a zip rooted at product-video/
  const skillDocs = Object.fromEntries(
    readdirSync(skillDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => [f, sub(readFileSync(join(skillDir, f), 'utf8'))]),
  )
  for (const [f, text] of Object.entries(skillDocs)) write(`api/skills/product-video/${f}`, text)
  const skillZip = zip(Object.entries(skillDocs).map(([f, text]) => [`product-video/${f}`, text]))
  write('api/skills/product-video.zip', skillZip)

  // Story Skill: its own documents plus the shared product-video ones. Links into product-video
  // point at the shared copy when there is one, otherwise at the published product-video Skill.
  const storySkillUrl = `${siteUrl}/api/skills/story-video`
  const storyDocs = Object.fromEntries([
    ...readdirSync(storySkillDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => [f, linkSibling(sub(readFileSync(join(storySkillDir, f), 'utf8')), 'product-video', skillUrl, STORY_SHARED)]),
    ...STORY_SHARED.map((f) => [f, absolutizeLinks(skillDocs[f], skillUrl, f, STORY_SHARED)]),
  ])
  for (const [f, text] of Object.entries(storyDocs)) write(`api/skills/story-video/${f}`, text)
  const storySkillZip = zip(Object.entries(storyDocs).sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, text]) => [`story-video/${f}`, text]))
  write('api/skills/story-video.zip', storySkillZip)

  // Prompts and rules
  for (const [rel, { title, from }] of Object.entries(EXTRACTS)) {
    const parts = from.map(([file, anchor]) => {
      const text = anchor ? section(skillDocs[file], anchor) : stripFrontmatter(skillDocs[file])
      return absolutizeLinks(text, skillUrl, file)
    })
    const sources = [...new Set(from.map(([file, anchor]) => `${skillUrl}/${file}${anchor ? `#${anchor}` : ''}`))]
    write(`api/${rel}`, `# ${title}\n\n> 由 Skill 文件產生，請勿直接修改。來源：${sources.join('、')}\n\n${parts.join('\n\n---\n\n')}\n`)
  }

  // Agent guide: the Skill entry point for agents that do not install Skills
  const skillBody = absolutizeLinks(stripFrontmatter(skillDocs['SKILL.md']).replace(/^# .*\n+/, ''), skillUrl, 'SKILL.md')
  write('api/agent-guide.md', agentGuide(siteUrl, skillBody))
  const storyBody = absolutizeLinks(stripFrontmatter(storyDocs['SKILL.md']).replace(/^# .*\n+/, ''), storySkillUrl, 'SKILL.md')
  write('api/story-guide.md', agentGuide(siteUrl, storyBody, { skill: 'story-video', title: '故事影片', checksum: 'storySkill' }))

  // Template: repo template + synced schemas + generated command files
  const templateFiles = listFiles(templateDir)
    .map((file) => relative(templateDir, file).split('\\').join('/'))
    .filter((rel) => !TEMPLATE_EXCLUDE.some((re) => re.test(rel)))
    .map((rel) => [rel, /\.(md|mjs)$/.test(rel) ? sub(readFileSync(join(templateDir, rel), 'utf8')) : readFileSync(join(templateDir, rel))])
  templateFiles.push(...[...SCHEMAS, 'workflow.json'].map((f) => [`schemas/${f}`, readFileSync(join(specsDir, f))]))
  templateFiles.push(...claudeCommands(workflow, siteUrl).map((c) => [c.path, c.content]))
  templateFiles.sort(([a], [b]) => (a < b ? -1 : 1))
  const templateZip = zip(templateFiles)
  write('api/templates/product-video.zip', templateZip)

  const specVersion = JSON.parse(readFileSync(join(templateDir, 'video.project.json'), 'utf8')).specVersion
  const manifest = {
    name: 'product-video',
    specVersion,
    zip: { url: `${siteUrl}/api/templates/product-video.zip`, sha256: sha256(templateZip), size: templateZip.length },
    files: templateFiles.map(([path, data]) => ({ path, sha256: sha256(data), size: bytes(data).length })),
  }
  write('api/templates/product-video/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)

  const index = {
    specVersion,
    siteUrl,
    entry: `${siteUrl}/api/agent-guide.md`,
    workflow: `${siteUrl}/api/workflow.json`,
    schemas: Object.fromEntries(SCHEMAS.map((f) => [f.replace('.schema.json', ''), `${siteUrl}/api/schemas/${f}`])),
    prompts: Object.fromEntries(Object.keys(EXTRACTS).filter((k) => k.startsWith('prompts/')).map((k) => [k.slice(8, -3), `${siteUrl}/api/${k}`])),
    rules: Object.fromEntries(Object.keys(EXTRACTS).filter((k) => k.startsWith('rules/')).map((k) => [k.slice(6, -3), `${siteUrl}/api/${k}`])),
    skill: `${siteUrl}/api/skills/product-video.zip`,
    skillDocs: `${skillUrl}/SKILL.md`,
    template: `${siteUrl}/api/templates/product-video.zip`,
    templateManifest: `${siteUrl}/api/templates/product-video/manifest.json`,
    // One template and workflow serve both kinds of video (project.kind); each has its own entry and Skill.
    entries: { product: `${siteUrl}/api/agent-guide.md`, story: `${siteUrl}/api/story-guide.md` },
    skills: {
      product: { zip: `${siteUrl}/api/skills/product-video.zip`, docs: `${skillUrl}/SKILL.md` },
      story: { zip: `${siteUrl}/api/skills/story-video.zip`, docs: `${storySkillUrl}/SKILL.md` },
    },
    checksums: { skill: sha256(skillZip), storySkill: sha256(storySkillZip), template: sha256(templateZip) },
  }
  write('api/index.json', `${JSON.stringify(index, null, 2)}\n`)

  const host = new URL(siteUrl).hostname
  if (!host.endsWith('.github.io') && host !== 'localhost' && host !== '127.0.0.1') {
    write('CNAME', `${host}\n`)
  }
  write('.nojekyll', '')
  return { index, manifest }
}

function agentGuide(siteUrl, skillBody, { skill = 'product-video', title = '', checksum = 'skill' } = {}) {
  return `# Agent Video Producer — ${title ? `${title} ` : ''}Agent 指引

> 給任何能讀檔、執行指令的 Coding Agent。本文件與 ${skill} Skill 的 \`SKILL.md\` 內容相同；支援 Agent Skills 的 Agent 可改為安裝 Skill（見文末）。
> 網站只提供規則與範本，不執行任何 AI 或渲染；所有工作都在使用者的電腦上完成。

${skillBody.trim()}

## 安裝 Skill（可選）

下載 ${siteUrl}/api/skills/${skill}.zip，解壓到 Agent 的 skills 目錄（Claude Code：使用者層級 \`~/.claude/skills/\`，或專案內 \`.claude/skills/\`）。zip 的 SHA-256 在 ${siteUrl}/api/index.json 的 \`checksums.${checksum}\`。

## 資源

| 資源 | 網址 |
|---|---|
| 資源索引 | ${siteUrl}/api/index.json |
| 工作流程 | ${siteUrl}/api/workflow.json |
| 專案範本 | ${siteUrl}/api/templates/product-video.zip（雜湊：${siteUrl}/api/templates/product-video/manifest.json） |
| Skill 文件 | ${siteUrl}/api/skills/${skill}/SKILL.md |
`
}

/**
 * Rewrites links into a sibling Skill (\`](../<sibling>/file.md#x)\`): to the local copy when \`file\`
 * is in \`shared\`, otherwise to the sibling's published URL.
 */
function linkSibling(markdown, sibling, siblingUrl, shared) {
  return markdown.replace(new RegExp(`\\]\\(\\.\\./${sibling}/([^)\\s]+)\\)`, 'g'), (all, target) =>
    shared.includes(target.split('#')[0]) ? `](${target})` : `](${siblingUrl}/${target})`,
  )
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath ?? d.path, d.name))
}

const bytes = (data) => (typeof data === 'string' ? Buffer.from(data) : data)
const sha256 = (data) => createHash('sha256').update(bytes(data)).digest('hex')

function zip(entries) {
  return Buffer.from(zipSync(Object.fromEntries(entries.map(([path, data]) => [path, [new Uint8Array(bytes(data)), { mtime: ZIP_MTIME }]])), { level: 9 }))
}

export function resolveSiteUrl(flag) {
  const explicit = flag ?? process.env.SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  let repo = process.env.GITHUB_REPOSITORY
  if (!repo) {
    try {
      const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim()
      repo = /github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/.exec(remote)?.[1]
    } catch {
      // no git or no remote
    }
  }
  if (!repo) throw new Error('cannot determine the site URL; pass --site-url or set SITE_URL')
  const [owner, name] = repo.split('/')
  const host = `${owner.toLowerCase()}.github.io`
  return name.toLowerCase() === host ? `https://${host}` : `https://${host}/${name}`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = (name) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : undefined
  }
  const siteUrl = resolveSiteUrl(flag('site-url'))
  const out = resolve(root, flag('out') ?? 'dist')
  const { index, manifest } = build({ siteUrl, out })
  console.log(`built ${relative(root, out) || '.'} for ${siteUrl}`)
  console.log(`  template: ${manifest.files.length} files, sha256 ${index.checksums.template.slice(0, 12)}…`)
  console.log(`  skill:    sha256 ${index.checksums.skill.slice(0, 12)}…`)
}
