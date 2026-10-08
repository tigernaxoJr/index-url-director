// App state: the open project folder and polling. Each tab works on one project at a time, named in
// its URL (?p=<id>), and polls only that one; the recently opened folders are shared by all tabs so
// switching takes one click.
import { computed, ref, shallowRef } from 'vue'
import type { SlideActivity, SlideProject } from '../types/protocol'
import { ensurePermission, isSupported, readText, tryFile, writeText } from './fsa'
import { forget, listRecent, remember, type Recent } from './idb'
import { parseSlides, type ParsedDeck } from './slide-parser'

/** The URL query parameter naming this tab's project. */
const PARAM = 'p'

export const dirHandle = shallowRef<FileSystemDirectoryHandle | null>(null)
export const project = ref<SlideProject | null>(null)
export const activity = ref<SlideActivity | null>(null)
export const slidesMarkdown = ref<string | null>(null)
/** slide.start.json: what the user asked for, written by the web page before the Agent builds the project. */
export const start = ref<SlideStartConfig | null>(null)
export const pdfFile = shallowRef<File | null>(null)
export const pdfUrl = ref<string | null>(null)
export const isPolling = ref(false)
export const lastSync = ref<Date | null>(null)
export const syncError = ref<string | null>(null)
/** Recently opened folders, newest first. */
export const recent = shallowRef<Recent[]>([])
/** The recent entry of the open folder. */
export const currentId = shallowRef<string | null>(null)
/** A folder named in this tab's URL that still needs the user to re-grant access (a click). */
export const remembered = shallowRef<Recent | null>(null)
/** A short message for the user, shown as a toast. */
export const notice = ref<string | null>(null)
const loaded = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

export const parsedDeck = computed<ParsedDeck>(() => {
  return parseSlides(slidesMarkdown.value || '')
})

export const hasPdf = computed(() => !!pdfFile.value)

/** The folder is open but holds neither a project nor a start request: show the setup form. */
export const needsSetup = computed(() => !!dirHandle.value && loaded.value && !project.value && !start.value)

export function notify(text: string) {
  notice.value = text
  setTimeout(() => {
    if (notice.value === text) notice.value = null
  }, 6000)
}

function setUrlProject(id: string | null) {
  const url = new URL(location.href)
  if (id) url.searchParams.set(PARAM, id)
  else url.searchParams.delete(PARAM)
  history.replaceState(history.state, '', url)
}

/** Forgets the open folder in this tab (it stays in the recent list). */
function clear() {
  stopPolling()
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }
  dirHandle.value = null
  currentId.value = null
  loaded.value = false
  project.value = null
  start.value = null
  activity.value = null
  slidesMarkdown.value = null
  pdfFile.value = null
  lastSync.value = null
  syncError.value = null
}

/** Closes the project in this tab; its files stay in the folder. */
export function resetDirectory() {
  clear()
  setUrlProject(null)
}

/**
 * Opens a project folder, or an empty one for a new project. Returns why a folder was refused; a
 * refused folder leaves the open project as it was.
 */
export async function openDirectory(handle: FileSystemDirectoryHandle): Promise<string | null> {
  try {
    if (!(await tryFile(handle, 'slide.project.json')) && !(await tryFile(handle, 'slide.start.json'))) {
      // The Agent unpacks the template here, so a new project needs an empty folder.
      const names = await folderEntries(handle)
      if (names.length) {
        return `「${handle.name}」不是空的資料夾，也不是簡報專案（找到 ${names.slice(0, 3).join('、')}${names.length > 3 ? ' 等' : ''}）。請選擇空資料夾開始新專案，或選擇既有的簡報專案資料夾。`
      }
    }
    clear()
    remembered.value = null
    dirHandle.value = handle
    await pollFiles()
    recent.value = await remember(handle, project.value?.title || start.value?.title || undefined)
    currentId.value = recent.value.find((r) => r.handle === handle)?.id ?? null
    setUrlProject(currentId.value)
    startPolling()
    return null
  } catch (err: any) {
    return err?.name === 'NotFoundError' ? `找不到資料夾「${handle.name}」，可能已被移動或刪除。` : err?.message || '無法開啟資料夾'
  }
}

/**
 * On start: reopen the project named in this tab's URL. Without one the start page lists the recent
 * folders. Permission needs a click, so a folder that lost it is only offered (remembered).
 */
export async function restore() {
  if (!isSupported()) return
  recent.value = await listRecent()
  const id = new URL(location.href).searchParams.get(PARAM)
  const entry = id ? recent.value.find((r) => r.id === id) : undefined
  if (!entry) return setUrlProject(null)
  if (await ensurePermission(entry.handle, false)) {
    const error = await openDirectory(entry.handle)
    if (error) notify(error)
  } else remembered.value = entry
}

/** Opens a recent folder in this tab (a click, so the browser may ask for permission). Returns an error, if any. */
export async function switchTo(entry: Recent): Promise<string | null> {
  if (entry.id === currentId.value) return null
  try {
    if (!(await ensurePermission(entry.handle, true))) return `沒有取得「${entry.handle.name}」的存取權限。`
  } catch (err: any) {
    return err?.message || '無法取得資料夾權限'
  }
  return openDirectory(entry.handle)
}

/** Lets the user pick a folder and opens it. Returns why it was refused (null when opened or cancelled). */
export async function pickFolder(): Promise<string | null> {
  let handle: FileSystemDirectoryHandle
  try {
    handle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'slide-project' })
  } catch (err: any) {
    return err?.name === 'AbortError' ? null : err?.message || '無法開啟目錄'
  }
  return openDirectory(handle)
}

/** Removes a folder from the recent list; its files stay where they are. */
export async function forgetRecent(id: string) {
  recent.value = await forget(id)
  if (remembered.value?.id === id) remembered.value = null
  if (currentId.value === id) resetDirectory()
}

export async function pollFiles() {
  const root = dirHandle.value
  if (!root) return

  try {
    const json = async <T>(path: string) => {
      try {
        return JSON.parse(await readText(root, path)) as T
      } catch {
        return null // not yet created
      }
    }
    const nextProject = await json<SlideProject>('slide.project.json')
    // slide.start.json is missing when the folder was not prepared by this page.
    const nextStart = await json<SlideStartConfig>('slide.start.json')
    const nextActivity = await json<SlideActivity>('slide.activity.json')
    let markdown: string | null = null
    try {
      markdown = await readText(root, 'slides.md')
    } catch {}
    let pdf: File | null = pdfFile.value
    try {
      pdf = await tryFile(root, 'output/slides.pdf')
    } catch {
      // Ignore PDF read error: keep the last one
    }

    // Switched to another folder meanwhile: these results belong to the old one.
    if (dirHandle.value !== root) return

    // A file that fails to parse mid-write keeps the last good copy.
    if (nextProject) project.value = nextProject
    if (nextStart) start.value = nextStart
    if (nextActivity) activity.value = nextActivity
    slidesMarkdown.value = markdown
    if (pdf && (!pdfFile.value || pdf.lastModified !== pdfFile.value.lastModified)) {
      if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
      pdfFile.value = pdf
      pdfUrl.value = URL.createObjectURL(pdf)
    } else if (!pdf && pdfFile.value) {
      if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
      pdfFile.value = null
      pdfUrl.value = null
    }

    lastSync.value = new Date()
    loaded.value = true
    syncError.value = null

    // The Agent wrote or renamed the deck: show its title in the recent list.
    const title = project.value?.title || start.value?.title
    const entry = recent.value.find((r) => r.id === currentId.value)
    if (title && entry && entry.label !== title) recent.value = await remember(root, title)
  } catch (err: any) {
    if (dirHandle.value === root) syncError.value = err.message || '讀取本機檔案失敗'
  }
}

export function startPolling(intervalMs = 2500) {
  stopPolling()
  isPolling.value = true
  pollTimer = setInterval(() => {
    if (!document.hidden) pollFiles()
  }, intervalMs)
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  isPolling.value = false
}

// Coming back to the tab: check right away instead of waiting for the next tick.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && pollTimer) pollFiles()
})

export interface SlideStartConfig {
  title: string
  description?: string
  audience?: string
  pagesCount?: number
  theme?: string
  aspectRatio?: string
  notes?: string
  createdAt?: string
}

/** Names in the folder, ignoring hidden entries (.git, .DS_Store, ...). */
export async function folderEntries(handle: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []
  for await (const name of (handle as any).keys() as AsyncIterable<string>) if (!name.startsWith('.')) names.push(name)
  return names
}

/**
 * Writes slide.start.json (the user's request) and a first activity. The Agent unpacks the template and
 * writes slide.project.json from it; the page never writes the project file, so the template's copy is
 * not overwritten and the project stays valid against the schema.
 */
export async function initializeProject(config: SlideStartConfig) {
  const root = dirHandle.value
  if (!root) throw new Error('No directory selected')

  const startData: SlideStartConfig = { ...config, createdAt: new Date().toISOString() }
  await writeText(root, 'slide.start.json', JSON.stringify(startData, null, 2) + '\n')
  start.value = startData

  const starterActivity: SlideActivity = {
    message: '資料夾已準備好，等待 Agent 讀取 slide.start.json 開始製作',
    step: 'init',
    currentSlide: null,
    totalSlides: config.pagesCount ?? null,
    waitingForUser: false,
    updatedAt: new Date().toISOString(),
  }
  await writeText(root, 'slide.activity.json', JSON.stringify(starterActivity, null, 2) + '\n')
  activity.value = starterActivity

  await pollFiles()
}

// Test hook: lets automated tests open an OPFS directory without the native folder picker.
declare global {
  interface Window {
    __slide?: { open(handle: FileSystemDirectoryHandle): Promise<string | null> }
  }
}
window.__slide = { open: openDirectory }
