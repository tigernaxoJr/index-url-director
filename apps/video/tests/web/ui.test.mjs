// Web UI end-to-end (SPEC §9): builds the app, serves it under a sub-path like GitHub Pages, and
// drives it in Chromium. The project folder is an OPFS directory — a real FileSystemDirectoryHandle,
// opened through the app's test hook since the native folder picker cannot be automated.
// Fixtures are made by the Node scripts, so a scene shown as "rendered" proves the browser computes
// the same inputHash as scripts/lib/hash.mjs.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { startCompanion } from '../../template/scripts/lib/companion.mjs'
import { FAKE_TTS, fullProject, motionScene } from '../../../../packages/video-agent/tests/helpers.mjs'
import { baseProject, baseScene, makeProject } from '../template/helpers.mjs'

const require = createRequire(import.meta.url)
const repo = fileURLToPath(new URL('../../../../', import.meta.url))
const BASE = '/index-url-director'

let server
let origin
let browser
let outDir

before(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'avp-web-'))
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (!path.startsWith(`${BASE}/`)) return res.writeHead(404).end()
    let file = join(outDir, path.slice(BASE.length))
    if (path.endsWith('/')) file = join(file, 'index.html')
    try {
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.zip': 'application/zip' }[extname(file)] ?? 'application/octet-stream'
      res.writeHead(200, { 'content-type': type }).end(readFileSync(file))
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`

  process.env.SITE_URL = `${origin}${BASE}`
  const { build } = await import('vite')
  await build({ configFile: join(repo, 'apps/video/vite.config.ts'), logLevel: 'error', build: { outDir: join(outDir, 'video'), emptyOutDir: true } })
  const { build: buildApi } = await import('../../tools/build-api.mjs')
  buildApi({ siteUrl: process.env.SITE_URL, out: outDir })

  const { chromium } = await import('playwright')
  // Installed Chrome/Edge first: Playwright's bundled Chromium crashes when a page reads an OPFS
  // handle back from IndexedDB, which the recent-projects list does on every load.
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      browser = await chromium.launch({ channel })
      break
    } catch {}
  }
})

after(async () => {
  await browser?.close()
  server?.close()
  rmSync(outDir, { recursive: true, force: true })
})

/** Two rendered scenes (real mp4s, hashes written by state.mjs) and one draft. */
function fixture() {
  const project = baseProject({ status: 'script_generated' })
  project.project.name = '網頁測試專案'
  project.project.format = { aspectRatio: '16:9', width: 640, height: 360, fps: 24, targetDurationSec: 10 }
  const p = makeProject({
    project,
    scenes: [
      { id: 'scene-001', dir: 'scenes/001-hook', scene: baseScene('scene-001', { title: '開場', durationSec: 1, purpose: 'hook' }), script: '第一句旁白。\n' },
      { id: 'scene-002', dir: 'scenes/002-cta', scene: baseScene('scene-002', { title: '行動呼籲', durationSec: 1, purpose: 'cta' }), script: '立即試用。\n' },
      { id: 'scene-003', dir: 'scenes/003-extra', scene: baseScene('scene-003', { title: '補充', durationSec: 1 }) },
    ],
  })
  const ffmpeg = require('ffmpeg-static')
  for (const [id, dir] of [['scene-001', 'scenes/001-hook'], ['scene-002', 'scenes/002-cta']]) {
    writeFileSync(p.path(dir, 'assets/captions.json'), '[{"start":0,"end":1,"text":"字幕"}]\n')
    mkdirSync(p.path(dir, 'output'), { recursive: true })
    const r = spawnSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=navy:s=640x360:r=24:d=1', '-pix_fmt', 'yuv420p', p.path(dir, 'output/scene.mp4')])
    assert.equal(r.status, 0, String(r.stderr))
    for (const args of [['--status', 'assets_ready'], ['--status', 'rendering'], ['--rendered']]) {
      const s = p.run('state.mjs', [id, ...args])
      assert.equal(s.code, 0, s.stderr)
    }
  }
  return p
}

/** Opens the app with the fixture copied into OPFS; returns the page and a reader for OPFS files. */
async function openApp(t, p, hash = '') {
  if (!browser) {
    t.skip('no browser available')
    return null
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin}${BASE}/video/${hash}`)
  const files = []
  const walk = (dir) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, d.name)
      if (d.isDirectory()) walk(full)
      else files.push([relative(p.root, full).split('\\').join('/'), readFileSync(full).toString('base64')])
    }
  }
  walk(p.root)
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry('proj', { recursive: true }).catch(() => {})
    const proj = await root.getDirectoryHandle('proj', { create: true })
    for (const [path, b64] of files) {
      const parts = path.split('/')
      let dir = proj
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true })
      const w = await (await dir.getFileHandle(parts.at(-1), { create: true })).createWritable()
      await w.write(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
      await w.close()
    }
    await window.__avp.open(proj)
  }, files)
  const read = (path) =>
    page.evaluate(async (path) => {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('proj')
      const parts = path.split('/')
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part)
      return (await (await dir.getFileHandle(parts.at(-1))).getFile()).text()
    }, path)
  const writeFile = (path, text) =>
    page.evaluate(
      async ([path, text]) => {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('proj')
        const w = await (await dir.getFileHandle(path, { create: true })).createWritable()
        await w.write(text)
        await w.close()
      },
      [path, text],
    )
  t.after(() => context.close())
  return { page, read, writeFile }
}

/** Makes an OPFS folder with the given files and opens it as the project folder, as if picked in step 1. */
async function prepareFolder(page, name, files = {}) {
  await page.evaluate(
    async ([name, files]) => {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(name, { recursive: true }).catch(() => {})
      const dir = await root.getDirectoryHandle(name, { create: true })
      for (const [file, text] of Object.entries(files)) {
        const w = await (await dir.getFileHandle(file, { create: true })).createWritable()
        await w.write(text)
        await w.close()
      }
      await window.__avp.open(dir)
    },
    [name, files],
  )
}

const readOpfs = (page, path) =>
  page.evaluate(async (path) => {
    let dir = await navigator.storage.getDirectory()
    const parts = path.split('/')
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part)
    return (await (await dir.getFileHandle(parts.at(-1))).getFile()).text()
  }, path)

/** Waits until the page has mirrored the form into acme-video/video.start.json. */
async function waitForStart(page, text) {
  for (let i = 0; i < 50; i++) {
    if ((await readOpfs(page, 'acme-video/video.start.json').catch(() => '')).includes(text)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.fail(`video.start.json never contained ${text}`)
}

test('home page: prepare a folder first, then a plain-language message tells the agent to build the project there', async (t) => {
  if (!browser) return t.skip('no browser available')
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(`${origin}${BASE}/video/`)
  assert.equal(await page.getByTestId('kind-story').getAttribute('aria-checked'), 'true', 'a story is the default')
  await page.getByTestId('kind-product').click()
  assert.match(await page.getByTestId('step-run').textContent(), /請先在步驟 1 準備/, 'no message before the folder is prepared')

  await prepareFolder(page, 'not-empty', { 'notes.txt': 'x' })
  assert.match(await page.getByTestId('step-folder').getByRole('alert').textContent(), /已經有其他檔案/, 'a folder with other files is refused')
  assert.equal(await page.getByTestId('project-folder').count(), 0)

  await prepareFolder(page, 'acme-video', { '.DS_Store': '' })
  await page.getByTestId('project-folder').getByText('acme-video').waitFor()
  assert.match(await page.getByTestId('waiting').textContent(), /等 Agent 在「acme-video」建立專案/)
  assert.match(await page.getByTestId('step-run').textContent(), /請先在步驟 2 填入/, 'no message before any source')

  await page.getByPlaceholder('https://example.com').fill('https://acme.test')
  // The form is mirrored into the folder for the agent, with an id it uses to find the folder.
  await waitForStart(page, 'https://acme.test')
  const start = JSON.parse(await readOpfs(page, 'acme-video/video.start.json'))
  assert.match(start.id, /^[0-9a-f]{8}$/)
  assert.deepEqual({ ...start, updatedAt: undefined }, { id: start.id, productUrl: 'https://acme.test', requiresLogin: false, sourceCodePath: null, sourceFolder: null, description: null, updatedAt: undefined })

  const message = await page.getByTestId('launch-message').textContent()
  assert.equal(
    message,
    `請讀取 ${origin}${BASE}/api/agent-guide.md，依照裡面的步驟幫我製作產品介紹影片。\n你的工作資料夾是我在網頁上準備好的「acme-video」：裡面的 video.start.json 記有產品資訊與識別碼 ${start.id}。我開對話時沒有特別選它，請你自己找到這個資料夾、把工作目錄切換過去，所有檔案都放在那裡，不要在其他地方建立專案。\n・產品網址：https://acme.test\n我不熟悉電腦操作：需要執行的指令請直接替我執行；需要我自己動手的地方（例如安裝軟體、按允許），請一步一步用白話告訴我要點哪裡。`,
  )
  assert.match(await page.getByTestId('step-run').textContent(), /不用再選一次「acme-video」/)
  const visible = await page.locator('main').innerText()
  assert.doesNotMatch(visible, /終端機中開啟|p?npm install|cd /, 'the main path never asks for a terminal')
  assert.equal(await page.getByTestId('launch-command').isVisible(), false, 'the terminal command stays folded away')

  // A product behind a sign-in: the user ticks a box; no password field, ever.
  assert.equal(await page.getByTestId('requires-login-help').count(), 0)
  await page.getByTestId('requires-login').check()
  assert.match(await page.getByTestId('requires-login-help').textContent(), /不用在這裡填帳號密碼/)
  assert.equal(await page.locator('input[type=password]').count(), 0)
  assert.match(await page.getByTestId('launch-message').textContent(), /・這個網站要登入才看得到：請打開視窗讓我自己登入，我不會把帳號密碼告訴你\n/)
  await waitForStart(page, '"requiresLogin": true')
  await page.getByTestId('requires-login').uncheck()
  await waitForStart(page, '"requiresLogin": false')

  // Reopening the folder keeps its id, so a message already pasted still finds it.
  await page.evaluate(async () => window.__avp.open(await (await navigator.storage.getDirectory()).getDirectoryHandle('acme-video')))
  await page.getByTestId('launch-message').getByText(start.id).waitFor()

  // Once the agent writes the project, the page switches to the workbench by itself.
  const project = baseProject()
  project.project.name = '自動切換專案'
  await page.evaluate(async (text) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('acme-video')
    const w = await (await dir.getFileHandle('video.project.json', { create: true })).createWritable()
    await w.write(text)
    await w.close()
  }, JSON.stringify(project))
  await page.getByTestId('project-name').getByText('自動切換專案').waitFor({ timeout: 10_000 })
})

test('guided start: the source folder is a full path; picking a folder prefills and records hints, never credentials', async (t) => {
  if (!browser) return t.skip('no browser available')
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(`${origin}${BASE}/video/`)
  await page.getByTestId('kind-product').click()
  await prepareFolder(page, 'acme-video')
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry('acme-app', { recursive: true }).catch(() => {})
    const dir = await root.getDirectoryHandle('acme-app', { create: true })
    const put = async (d, name, text) => {
      const w = await (await d.getFileHandle(name, { create: true })).createWritable()
      await w.write(text)
      await w.close()
    }
    await put(dir, 'package.json', JSON.stringify({ name: 'acme-deploy', homepage: 'https://acme.test' }))
    await put(dir, 'README.md', '# Acme\n\n[![build](https://x/badge.svg)](https://x)\n\nAcme 讓你**一鍵部署**網站，不用設定伺服器。\n\n## 安裝\n')
    await put(await dir.getDirectoryHandle('.git', { create: true }), 'config', '[remote "origin"]\n\turl = https://bob:secret@github.com/acme/deploy.git\n')
    await dir.getDirectoryHandle('src', { create: true })
    await window.__avp.pickSource(dir)
  })
  assert.equal(await page.getByTestId('source-folder').getByText('acme-app').count(), 1)
  assert.match(await page.getByTestId('source-filled').textContent(), /說明與網址/)
  assert.match(await page.getByTestId('source-path-missing').textContent(), /不會給完整路徑/, 'explains why the path must be pasted')
  let message = await page.getByTestId('launch-message').textContent()
  assert.match(message, /・產品網址：https:\/\/acme\.test/)
  assert.match(message, /・產品原始碼在我電腦上名為「acme-app」的資料夾（請幫我找到它；找不到就問我）/)
  assert.match(message, /・產品說明：acme-deploy：Acme 讓你一鍵部署網站，不用設定伺服器。/)

  await page.getByTestId('source-path').fill('/home/me/code/other')
  assert.equal(await page.getByTestId('source-path-mismatch').count(), 1, 'warns when the path names a different folder')
  await page.getByTestId('source-path').fill('/home/me/code/acme-app')
  assert.equal(await page.getByTestId('source-path-mismatch').count(), 0)
  assert.equal(await page.getByTestId('source-path-missing').count(), 0)
  message = await page.getByTestId('launch-message').textContent()
  assert.match(message, /・產品原始碼：\/home\/me\/code\/acme-app\n/, 'the full path goes to the agent')

  await waitForStart(page, '/home/me/code/acme-app')
  const start = JSON.parse(await readOpfs(page, 'acme-video/video.start.json'))
  assert.equal(start.sourceCodePath, '/home/me/code/acme-app')
  assert.deepEqual(start.sourceFolder, { name: 'acme-app', packageName: 'acme-deploy', gitRemote: 'https://github.com/acme/deploy.git', entries: ['README.md', 'package.json', 'src'] })

  await page.reload()
  await page.getByTestId('launch-message').waitFor()
  assert.equal(await page.getByTestId('launch-message').textContent(), message, 'inputs and the prepared folder survive a reload')
})

test('opened project shows scenes; browser inputHash matches the Node scripts', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const app = await openApp(t, p)
  if (!app) return
  const { page } = app
  await page.getByTestId('project-name').waitFor()
  assert.equal(await page.getByTestId('project-name').textContent(), '網頁測試專案')
  const status = (id) => page.getByTestId(`scene-${id}`).getByTestId('scene-status').textContent()
  assert.equal(await status('scene-001'), '已渲染', 'rendered, not "內容已變更": hashes agree')
  assert.equal(await status('scene-002'), '已渲染')
  assert.equal(await status('scene-003'), '草稿')
  assert.equal(await page.getByTestId('next-command').textContent(), '/video-scene all')
  assert.match(await page.getByTestId('scene-summary').textContent(), /^已完成 2\/3 · 約 \d+\.\d 秒$/)

  // Script view: every scene's narration, in playback order.
  await page.getByTestId('view-script').click()
  const script = await page.getByTestId('script-view').textContent()
  const at = ['第一句旁白。', '立即試用。', '這是一段旁白。'].map((line) => script.indexOf(line))
  assert.ok(at[0] >= 0 && at[0] < at[1] && at[1] < at[2], script)
  await page.getByTestId('script-view').getByText('立即試用。').click()
  await page.getByTestId('view-list').click()
  assert.match(await page.getByTestId('scene-scene-002').getAttribute('class'), /border-sky-500/, 'clicking a script entry selects that scene')
})

test('recent projects: each tab names its project in the URL; switching and reopening take one click', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const app = await openApp(t, p)
  if (!app) return
  const { page } = app
  await page.getByTestId('project-name').waitFor()
  const projUrl = page.url()
  assert.match(projUrl, /[?&]p=/)

  await prepareFolder(page, 'other')
  await page.getByTestId('project-folder').waitFor()
  const otherUrl = page.url()
  assert.notEqual(otherUrl, projUrl)

  // A reload (or a bookmark) reopens the project its URL names.
  await page.goto(projUrl)
  assert.equal(await page.getByTestId('project-name').textContent(), '網頁測試專案')

  // The header menu lists both folders; picking one switches this tab.
  await page.getByTestId('project-switcher').click()
  const entries = page.getByTestId('project-menu').getByTestId('recent-project')
  assert.equal(await entries.count(), 2)
  await entries.filter({ hasText: 'other' }).click()
  assert.match(await page.getByTestId('project-folder').textContent(), /other/)
  assert.equal(page.url(), otherUrl)

  // Two tabs work on different projects at once.
  const second = await page.context().newPage()
  await second.goto(projUrl)
  await second.getByTestId('project-name').waitFor()
  assert.match(await page.getByTestId('project-folder').textContent(), /other/)

  // Without a project in the URL, the home page offers the recent folders.
  await page.goto(`${origin}${BASE}/video/`)
  const recent = page.getByTestId('recent-projects').getByTestId('recent-project')
  assert.equal(await recent.count(), 2)
  await recent.filter({ hasText: '網頁測試專案' }).click()
  await page.getByTestId('project-name').waitFor()
  assert.equal(page.url(), projUrl)
})

test('editing a rendered scene marks it stale, re-derives the project, and shows the sync banner', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const app = await openApp(t, p)
  if (!app) return
  const { page, read } = app
  await page.getByTestId('scene-scene-001').getByRole('button', { name: /開場/ }).click()
  await page.getByTestId('script-input').fill('改過的第一句。')
  await page.getByTestId('save').click()
  await page.getByTestId('stale-banner').waitFor()

  assert.equal(await read('scenes/001-hook/script.md'), '改過的第一句。\n')
  const scene = JSON.parse(await read('scenes/001-hook/scene.json'))
  assert.equal(scene.status, 'stale')
  assert.equal(scene.updatedBy, 'user')
  assert.ok(scene.render, 'render record is kept for comparison')
  const project = JSON.parse(await read('video.project.json'))
  assert.equal(project.status, 'producing')
  assert.equal(await page.getByTestId('next-command').textContent(), '/video-sync')
})

test('approve and reorder follow the UI write rules', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const app = await openApp(t, p)
  if (!app) return
  const { page, read } = app
  await page.getByTestId('scene-scene-002').getByRole('button', { name: /行動呼籲/ }).click()
  await page.getByTestId('approve').click()
  await page.getByTestId('notice').filter({ hasText: '已核准' }).waitFor()
  assert.equal(JSON.parse(await read('scenes/002-cta/scene.json')).status, 'approved')

  await page.getByRole('button', { name: '下移 scene-001' }).click()
  await page.getByTestId('notice').filter({ hasText: '順序' }).waitFor()
  const order = JSON.parse(await read('video.project.json')).scenes.map((s) => s.id)
  assert.deepEqual(order, ['scene-002', 'scene-001', 'scene-003'])
})

test('writes wait while an agent holds the lock', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const app = await openApp(t, p)
  if (!app) return
  const { page, read, writeFile } = app
  await writeFile('.video-agent.lock', JSON.stringify({ writer: 'agent', pid: 1, at: new Date().toISOString() }))
  await page.getByTestId('scene-scene-003').getByRole('button', { name: /補充/ }).click()
  await page.getByTestId('script-input').fill('不會被寫入。')
  await page.getByTestId('save').click()
  await page.getByTestId('notice').filter({ hasText: 'Agent 正在寫入' }).waitFor()
  assert.equal(await read('scenes/003-extra/script.md'), '這是一段旁白。\n')
})

test('the pairing link connects the Companion; "立即重新產生" rebuilds the scene without a terminal', async (t) => {
  if (!browser) return t.skip('no browser available')
  Object.assign(process.env, FAKE_TTS)
  const p = fullProject({ scenes: [{ id: 'scene-001', dir: 'scenes/001-hook', scene: motionScene('scene-001', { title: '開場' }) }] })
  t.after(p.cleanup)
  const c = await startCompanion({ projectDir: p.root, port: 0, site: `${origin}${BASE}`, log: () => {} })
  t.after(() => c.close())

  const app = await openApp(t, p, `#pair=${c.port}:${c.token}`)
  const { page } = app
  await page.getByTestId('companion-status').getByText('本機助手已連線').waitFor()
  assert.equal(await page.evaluate(() => location.hash), '', 'the token is removed from the address bar')

  await page.getByTestId('scene-scene-001').getByRole('button', { name: /開場/ }).click()
  await page.getByTestId('rebuild').click()
  await page.getByTestId('notice').filter({ hasText: '重新產生 scene-001：完成' }).waitFor({ timeout: 120_000 })
  const scene = JSON.parse(readFileSync(p.path('scenes/001-hook/scene.json'), 'utf8'))
  assert.equal(scene.status, 'rendered')
  assert.equal(scene.updatedBy, 'companion')
})

test('the page reconnects by itself when the Companion restarts', async (t) => {
  if (!browser) return t.skip('no browser available')
  // --persist-token keeps the pairing valid across restarts; point it at a throwaway home.
  const home = process.env.HOME
  process.env.HOME = mkdtempSync(join(tmpdir(), 'avp-home-'))
  t.after(() => {
    rmSync(process.env.HOME, { recursive: true, force: true })
    process.env.HOME = home
  })
  const p = fixture()
  t.after(() => p.cleanup())
  const start = (port) => startCompanion({ projectDir: p.root, port, persistToken: true, site: `${origin}${BASE}`, log: () => {} })
  let c = await start(0)
  t.after(() => c.close())

  const app = await openApp(t, p, `#pair=${c.port}:${c.token}`)
  const { page } = app
  const status = page.getByTestId('companion-status')
  await status.getByText('本機助手已連線').waitFor()

  await c.close()
  await status.getByText('本機助手已連線').waitFor({ state: 'detached' })
  c = await start(c.port)
  await status.getByText('本機助手已連線').waitFor({ timeout: 15_000 })
})

const activityJson = (fields) => JSON.stringify({ waitingForUser: false, step: null, scene: null, updatedAt: new Date().toISOString(), ...fields })

test('activity: before the project exists, the page shows what the agent is waiting for', async (t) => {
  if (!browser) return t.skip('no browser available')
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(`${origin}${BASE}/video/`)
  await prepareFolder(page, 'acme-video', { 'video.activity.json': activityJson({ message: '要不要使用線上語音？請在對話中回答', waitingForUser: true, step: 'init' }) })
  await page.getByTestId('project-folder').getByText('acme-video').waitFor()
  const banner = page.getByTestId('step-review').getByTestId('activity')
  assert.equal(await banner.getAttribute('data-state'), 'waiting', 'a folder holding only the start and activity files is accepted')
  assert.match(await banner.textContent(), /Agent 在等你回覆：要不要使用線上語音？請在對話中回答/)
  assert.match(await banner.textContent(), /回到 Agent 的對話/)
})

test('activity: the workbench shows current work, marks the scene, and fades an old message', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const app = await openApp(t, p)
  if (!app) return
  const { page, writeFile } = app
  await page.getByTestId('scene-scene-001').waitFor()
  assert.equal(await page.getByTestId('activity').count(), 0, 'nothing shown without an activity file')

  await writeFile('video.activity.json', activityJson({ message: '正在錄第 2 段的畫面', step: 'build_scene', scene: 'scene-002' }))
  await page.locator('[data-testid="activity"][data-state="working"]').getByText('正在錄第 2 段的畫面').waitFor({ timeout: 10_000 })
  assert.equal(await page.getByTestId('scene-scene-002').getByTestId('scene-working').count(), 1)
  assert.equal(await page.getByTestId('scene-scene-001').getByTestId('scene-working').count(), 0)

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  await writeFile('video.activity.json', activityJson({ message: '正在錄第 3 段的畫面', scene: 'scene-003', updatedAt: hourAgo }))
  await page.locator('[data-testid="activity"][data-state="idle"]', { hasText: '最後的動態（1 小時前）：正在錄第 3 段的畫面' }).waitFor({ timeout: 10_000 })
  assert.equal(await page.getByTestId('scene-working').count(), 0, 'an agent that went quiet is not shown as working')

  await writeFile('video.activity.json', '{ "message": ')
  await page.getByTestId('activity').waitFor({ state: 'detached', timeout: 10_000 })
})

test('unsaved edits: switching scenes asks first; the full video is a list entry', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const app = await openApp(t, p)
  if (!app) return
  const { page } = app
  await page.getByTestId('scene-scene-001').getByRole('button', { name: /開場/ }).click()
  await page.getByTestId('script-input').fill('還沒存的修改。')

  page.once('dialog', (d) => d.dismiss())
  await page.getByTestId('scene-scene-002').getByRole('button', { name: /行動呼籲/ }).click()
  assert.equal(await page.getByTestId('editor-scene-001').count(), 1, 'cancelling keeps the editor and the edit')
  assert.equal(await page.getByTestId('script-input').inputValue(), '還沒存的修改。')

  page.once('dialog', (d) => d.accept())
  await page.getByTestId('final-entry').click()
  await page.getByTestId('final-outdated').waitFor()
  assert.equal(await page.getByTestId('editor-scene-001').count(), 0)

  // Outdated scenes listed under the full video open their editor.
  await page.getByTestId('final-outdated').getByRole('button', { name: /補充/ }).click()
  await page.getByTestId('editor-scene-003').waitFor()
})

test('a project from an older template: one click updates its tools and drops retired fields', async (t) => {
  const p = fixture()
  t.after(() => p.cleanup())
  const project = p.read('video.project.json')
  Object.assign(project.project, { renderer: 'remotion', rendererLicense: 'free' })
  p.write('video.project.json', project)
  const app = await openApp(t, p)
  if (!app) return
  const { page, read } = app
  await page.getByTestId('template-outdated').waitFor()
  assert.match(await page.getByRole('alert').textContent(), /unknown field "renderer"/)

  await page.getByTestId('template-update').click()
  await page.getByTestId('template-outdated').waitFor({ state: 'detached' })
  const updated = JSON.parse(await read('video.project.json'))
  assert.equal(updated.project.renderer, undefined)
  assert.equal(updated.project.rendererLicense, undefined)
  assert.equal(updated.updatedBy, 'user')
  assert.equal(updated.project.name, '網頁測試專案', 'video content is kept')
  assert.match(await read('scripts/validate.mjs'), /validate/, 'template files are written')
  assert.equal(await page.getByRole('alert').count(), 0, 'the project is valid again')
  assert.equal(await page.getByTestId('scene-scene-001').getByTestId('scene-status').textContent(), '已渲染')
})

test('home page, story: pick "把故事做成動畫", write the story, and the message points the agent at the story guide', async (t) => {
  if (!browser) return t.skip('no browser available')
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  await page.goto(`${origin}${BASE}/video/`)
  const below = async () => (await page.getByTestId('video-kind').boundingBox()).y
  const y = await below()
  await page.getByTestId('kind-product').click()
  assert.equal(await below(), y, 'switching kinds does not move the page')
  await page.getByTestId('kind-story').click()
  assert.equal(await page.getByTestId('kind-story').getAttribute('aria-checked'), 'true')
  assert.equal(await page.getByPlaceholder('https://example.com').count(), 0, 'no product fields for a story')

  await prepareFolder(page, 'acme-video', {})
  await page.getByTestId('project-folder').getByText('acme-video').waitFor()
  assert.match(await page.getByTestId('step-run').textContent(), /請先在步驟 2 寫下你的故事/)
  await page.getByTestId('story-text').fill('一隻小狐狸以為月亮掉進了池塘。\n牠想把月亮撈起來。')
  await page.getByTestId('story-audience').fill('4–7 歲的小朋友')
  await waitForStart(page, '4–7 歲的小朋友')
  const start = JSON.parse(await readOpfs(page, 'acme-video/video.start.json'))
  assert.deepEqual({ ...start, updatedAt: undefined }, { id: start.id, kind: 'story', story: '一隻小狐狸以為月亮掉進了池塘。\n牠想把月亮撈起來。', audience: '4–7 歲的小朋友', updatedAt: undefined })

  const message = await page.getByTestId('launch-message').textContent()
  assert.match(message, new RegExp(`^請讀取 ${origin}${BASE}/api/story-guide\\.md，依照裡面的步驟幫我把故事做成動畫影片。\n`))
  assert.match(message, /記有故事內容與識別碼/)
  assert.match(message, /・故事：一隻小狐狸以為月亮掉進了池塘。\n牠想把月亮撈起來。\n・觀看對象：4–7 歲的小朋友\n/)
  assert.match(await page.getByTestId('launch-command').textContent(), /故事：一隻小狐狸以為月亮掉進了池塘。 牠想把月亮撈起來。/, 'the shell line has no line breaks')

  // The choice is remembered, and switching back restores the product form.
  await page.reload()
  assert.equal(await page.getByTestId('kind-story').getAttribute('aria-checked'), 'true')
  await page.getByTestId('kind-product').click()
  await page.getByPlaceholder('https://example.com').waitFor()
})

test('story project: story steps, cast hint, and the browser hash covers shared art and character voices', async (t) => {
  const project = baseProject({ status: 'script_generated' })
  Object.assign(project.project, {
    name: '小狐狸找月亮',
    kind: 'story',
    sources: { story: '小狐狸以為月亮掉進了池塘。' },
    format: { aspectRatio: '16:9', width: 640, height: 360, fps: 24 },
    cast: [
      { id: 'fox', name: '小狐狸', voice: 'zh-TW-HsiaoYuNeural', art: '@/assets/cast/fox/' },
      { id: 'owl', name: '貓頭鷹', voice: 'zh-TW-YunJheNeural' },
    ],
  })
  const scene = baseScene('scene-001', {
    title: '池塘',
    purpose: 'conflict',
    durationSec: 1,
    visual: { type: 'motion-graphic', description: '池塘邊', motion: { file: 'assets/motion.js', uses: ['@/assets/cast/fox/'] } },
  })
  const p = makeProject({ project, scenes: [{ id: 'scene-001', dir: 'scenes/001-pond', scene, script: '夜深了。\n【小狐狸】月亮掉進水裡了！\n' }] })
  t.after(() => p.cleanup())
  p.write('scenes/001-pond/assets/motion.js', 'export default async () => () => {}\n')
  p.write('assets/cast/fox/fox.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"/>\n')
  p.write('scenes/001-pond/assets/captions.json', '[]\n')
  mkdirSync(p.path('scenes/001-pond/output'), { recursive: true })
  const r = spawnSync(require('ffmpeg-static'), ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=navy:s=640x360:r=24:d=1', '-pix_fmt', 'yuv420p', p.path('scenes/001-pond/output/scene.mp4')])
  assert.equal(r.status, 0, String(r.stderr))
  for (const args of [['--status', 'assets_ready'], ['--status', 'rendering'], ['--rendered']]) {
    const s = p.run('state.mjs', ['scene-001', ...args])
    assert.equal(s.code, 0, s.stderr)
  }

  const app = await openApp(t, p)
  if (!app) return
  const { page } = app
  await page.getByTestId('project-name').waitFor()
  const status = () => page.getByTestId('scene-scene-001').getByTestId('scene-status').textContent()
  assert.equal(await status(), '已渲染', 'the browser hashes motion.uses folders and speaking voices like Node')
  const bar = await page.getByRole('list', { name: '工作流程' }).textContent()
  assert.match(bar, /整理故事.*美術與角色.*分鏡與對白/)
  assert.doesNotMatch(bar, /分析產品/)

  await page.getByTestId('scene-scene-001').getByRole('button', { name: /池塘/ }).click()
  assert.match(await page.getByTestId('cast-hint').textContent(), /【小狐狸】、【貓頭鷹】/)

  // Redrawing the fox makes the scene outdated without anyone touching scene.json.
  await page.evaluate(async () => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('proj')
    for (const part of ['assets', 'cast', 'fox']) dir = await dir.getDirectoryHandle(part)
    const w = await (await dir.getFileHandle('fox.svg')).createWritable()
    await w.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"/>\n')
    await w.close()
  })
  for (let i = 0; i < 100 && (await status()) !== '內容已變更'; i++) await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(await status(), '內容已變更')
})
