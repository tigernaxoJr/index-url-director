// Web UI end-to-end: builds Slide Studio, serves it under a sub-path like GitHub Pages, and drives it
// in Chromium. Project folders are OPFS directories — real FileSystemDirectoryHandles — opened
// through the app's test hook since the native folder picker cannot be automated.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'

const repo = fileURLToPath(new URL('../../../../', import.meta.url))
const BASE = '/slide-web-test'

let server
let origin
let browser
let outDir

before(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'slide-web-'))
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (!path.startsWith(`${BASE}/`)) return res.writeHead(404).end()
    let file = join(outDir, path.slice(BASE.length))
    if (path.endsWith('/')) file = join(file, 'index.html')
    try {
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[extname(file)] ?? 'application/octet-stream'
      res.writeHead(200, { 'content-type': type }).end(readFileSync(file))
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`

  process.env.SITE_URL = `${origin}${BASE}`
  const { build } = await import('vite')
  await build({ configFile: join(repo, 'apps/slide/vite.config.ts'), logLevel: 'error', build: { outDir: join(outDir, 'slide'), emptyOutDir: true } })

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
  if (outDir) rmSync(outDir, { recursive: true, force: true })
})

/** Makes an OPFS folder with the given files and opens it through the test hook; returns the refusal, if any. */
const openFolder = (page, name, files = {}) =>
  page.evaluate(
    async ([name, files]) => {
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(name, { recursive: true }).catch(() => {})
      const dir = await root.getDirectoryHandle(name, { create: true })
      for (const [file, text] of Object.entries(files)) {
        const w = await (await dir.getFileHandle(file, { create: true })).createWritable()
        await w.write(text)
        await w.close()
      }
      return window.__slide.open(dir)
    },
    [name, files],
  )

test('recent projects: each tab names its project in the URL; switching and reopening take one click', async (t) => {
  if (!browser) return t.skip('no browser available')
  const context = await browser.newContext()
  t.after(() => context.close())
  const page = await context.newPage()
  const home = `${origin}${BASE}/slide/`
  await page.goto(home)

  const project = JSON.parse(readFileSync(join(repo, 'apps/slide/template/slide.project.json'), 'utf8'))
  project.title = '季度回顧簡報'
  assert.equal(await openFolder(page, 'deck', { 'slide.project.json': JSON.stringify(project), 'slides.md': '# 第一頁\n' }), null)
  assert.equal(await page.getByTestId('project-name').textContent(), '季度回顧簡報')
  const deckUrl = page.url()
  assert.match(deckUrl, /[?&]p=/)

  assert.equal(await openFolder(page, 'empty'), null)
  await page.getByText('初始化簡報專案').waitFor()
  const emptyUrl = page.url()
  assert.notEqual(emptyUrl, deckUrl)

  // A folder with other files is refused and the open one stays.
  assert.match(await openFolder(page, 'other', { 'notes.txt': 'x' }), /不是空的資料夾/)
  assert.equal(page.url(), emptyUrl)

  // A reload (or a bookmark) reopens the project its URL names.
  await page.goto(deckUrl)
  await page.getByTestId('project-name').getByText('季度回顧簡報').waitFor()

  // The header menu lists both folders; picking one switches this tab.
  await page.getByTestId('project-switcher').click()
  const entries = page.getByTestId('project-menu').getByTestId('recent-project')
  assert.equal(await entries.count(), 2)
  await entries.filter({ hasText: 'empty' }).click()
  await page.waitForURL(emptyUrl)
  await page.getByText('初始化簡報專案').waitFor()

  // Two tabs work on different projects at once.
  const second = await context.newPage()
  await second.goto(deckUrl)
  await second.getByTestId('project-name').getByText('季度回顧簡報').waitFor()
  assert.equal(await page.getByText('初始化簡報專案').count(), 1)

  // Without a project in the URL, the start page offers the recent folders.
  await page.goto(home)
  const recent = page.getByTestId('recent-projects').getByTestId('recent-project')
  assert.equal(await recent.count(), 2)
  await recent.filter({ hasText: '季度回顧簡報' }).click()
  await page.waitForURL(deckUrl)
  await page.getByTestId('project-name').getByText('季度回顧簡報').waitFor()
})
