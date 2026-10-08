<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { tryFile, writeText } from '../lib/fsa'
import { START_FILE, api, launchCommand, launchMessage, newFolderId, startJson, type SourceHints, type VideoKind } from '../lib/site'
import { baseName, pathHelp, platform, readSourceFolder } from '../lib/source'
import { activity, forgetRecent, pickFolder, reconnect, recent, root, switchTo, ui } from '../lib/store'
import ActivityBanner from './ActivityBanner.vue'
import CopyButton from './CopyButton.vue'
import Icon, { type IconName } from './Icon.vue'

const STORAGE_KEY = 'avp-start'
const os = platform()

interface Start {
  kind: VideoKind
  story: string
  audience: string
  productUrl: string
  requiresLogin: boolean
  sourceFolder: string
  sourceHints: SourceHints | null
  sourceCodePath: string
  description: string
}
const form = reactive<Start>({ kind: 'story', story: '', audience: '', productUrl: '', requiresLogin: false, sourceFolder: '', sourceHints: null, sourceCodePath: '', description: '' })
try {
  Object.assign(form, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
} catch {}
watch(form, () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
  } catch {}
})

/** The prepared project folder; the agent will build the project in it. */
const folder = computed(() => (ui.waiting && root.value ? root.value.name : null))

/** The id the agent matches to find the folder; kept from an existing start file so a message already pasted stays valid. */
const folderId = ref<string | null>(null)
watch(
  folder,
  async () => {
    folderId.value = null
    const dir = root.value
    if (!folder.value || !dir) return
    let id: unknown
    try {
      id = JSON.parse((await (await tryFile(dir, START_FILE))?.text()) ?? '{}').id
    } catch {}
    if (root.value === dir) folderId.value = typeof id === 'string' && id ? id : newFolderId()
  },
  { immediate: true },
)
const prepared = computed(() => (folder.value && folderId.value ? { name: folder.value, id: folderId.value } : null))
const needsFolder = computed(() => ui.supported && !prepared.value)

// Keep the start file in the prepared folder in step with the form, so the agent reads what the user sees.
let pending: ReturnType<typeof setTimeout> | undefined
watch(
  [() => ({ ...form }), prepared],
  () => {
    clearTimeout(pending)
    const dir = root.value
    const at = prepared.value
    if (!at || !dir) return
    pending = setTimeout(() => writeText(dir, START_FILE, startJson(form, at.id)).catch((err) => (ui.error = (err as Error).message)), 300)
  },
  { immediate: true },
)

const filledFrom = ref<string | null>(null)
const isStory = computed(() => form.kind === 'story')
const hasSource = computed(() =>
  isStory.value ? Boolean(form.story.trim()) : Boolean(form.productUrl.trim() || form.sourceFolder.trim() || form.sourceCodePath.trim() || form.description.trim()),
)
const KINDS: { kind: VideoKind; title: string; hint: string; icon: IconName }[] = [
  { kind: 'story', title: '把故事做成動畫', hint: '畫出角色與場景，旁白和角色各有聲音', icon: 'sparkles' },
  { kind: 'product', title: '產品介紹影片', hint: '錄下產品畫面，配上旁白與字幕', icon: 'film' },
]
/** Title and intro per kind. Both are laid out in the same grid cell, so switching never moves what is below. */
const INTRO: Record<VideoKind, { title: string; text: string }> = {
  story: {
    title: '把故事做成動畫影片',
    text: '準備一個資料夾、寫下你的故事（只有一個點子也可以），再把產生的一段話貼給 Agent（例如 Claude）。它會陪你把故事補完整、畫角色、配聲音、做成動畫，這個網頁同步顯示進度。',
  },
  product: {
    title: '做產品介紹影片',
    text: '準備一個資料夾、填產品資訊，再把產生的一段話貼給 Agent（例如 Claude）。它會寫旁白、錄畫面、合成影片，這個網頁同步顯示進度。',
  },
}
/** The step the user should do now: 1 folder, 2 product or story, 3 paste the message. */
const current = computed(() => (needsFolder.value ? 1 : !hasSource.value ? 2 : 3))
const message = computed(() => launchMessage(form, prepared.value))
const command = computed(() => launchCommand(form, prepared.value))
const canPick = typeof window.showDirectoryPicker === 'function'
const pathMismatch = computed(() => {
  const typed = baseName(form.sourceCodePath.trim())
  return Boolean(form.sourceFolder && typed && typed.toLowerCase() !== form.sourceFolder.toLowerCase())
})

async function useSource(dir: FileSystemDirectoryHandle) {
  const info = await readSourceFolder(dir)
  form.sourceFolder = info.folder
  form.sourceHints = info.hints
  if (pathMismatch.value) form.sourceCodePath = ''
  const from: string[] = []
  if (!form.description.trim() && info.description) {
    form.description = info.name ? `${info.name}：${info.description}` : info.description
    from.push('說明')
  }
  if (!form.productUrl.trim() && info.homepage) {
    form.productUrl = info.homepage
    from.push('網址')
  }
  filledFrom.value = from.length ? `已從 package.json / README 帶入${from.join('與')}，可再修改。` : null
}

async function pickSource() {
  try {
    await useSource(await window.showDirectoryPicker!({ mode: 'read', id: 'product-source' }))
  } catch (err) {
    if ((err as DOMException).name !== 'AbortError') ui.error = (err as Error).message
  }
}

function clearSource() {
  form.sourceFolder = ''
  form.sourceHints = null
  filledFrom.value = null
}

onMounted(() => {
  if (window.__avp) window.__avp.pickSource = useSource // test hook: the native picker cannot be automated
})

const links = [
  ['Agent 指引', api('agent-guide.md')],
  ['故事影片 Agent 指引', api('story-guide.md')],
  ['資源索引', api('index.json')],
  ['工作流程', api('workflow.json')],
  ['Skill', api('skills/product-video.zip')],
  ['故事影片 Skill', api('skills/story-video.zip')],
  ['專案範本', api('templates/product-video.zip')],
]
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:pt-14">
    <div class="text-center">
      <h1 class="text-2xl font-bold tracking-tight text-balance sm:text-4xl">
        讓 Agent 在你的電腦上<br />
        <span class="grid">
          <span v-for="k in KINDS" :key="k.kind" class="col-start-1 row-start-1" :class="form.kind === k.kind ? '' : 'invisible'" :aria-hidden="form.kind !== k.kind">{{ INTRO[k.kind].title }}</span>
        </span>
      </h1>
      <div class="mx-auto mt-3 grid max-w-xl text-pretty text-slate-600 dark:text-slate-400" data-testid="intro">
        <p v-for="k in KINDS" :key="k.kind" class="col-start-1 row-start-1" :class="form.kind === k.kind ? '' : 'invisible'" :aria-hidden="form.kind !== k.kind">{{ INTRO[k.kind].text }}</p>
      </div>
      <div class="mx-auto mt-6 grid max-w-xl grid-cols-2 gap-2" role="radiogroup" aria-label="影片類型" data-testid="video-kind">
        <button
          v-for="k in KINDS"
          :key="k.kind"
          type="button"
          role="radio"
          :aria-checked="form.kind === k.kind"
          class="flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-center transition"
          :class="form.kind === k.kind ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/30 dark:bg-sky-950/40' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'"
          :data-testid="`kind-${k.kind}`"
          @click="form.kind = k.kind"
        >
          <span class="flex items-center gap-1.5 text-sm font-semibold"><Icon :name="k.icon" :size="16" class="text-sky-600" />{{ k.title }}</span>
          <span class="text-xs text-slate-500 dark:text-slate-400">{{ k.hint }}</span>
        </button>
      </div>
      <ul class="mt-5 flex flex-wrap justify-center gap-2 text-xs text-slate-600 sm:text-sm dark:text-slate-300">
        <li class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-900"><Icon name="sparkles" :size="14" class="text-sky-600" />不需要會寫程式或打指令</li>
        <li class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-900"><Icon name="shield" :size="14" class="text-emerald-600" />檔案都留在你的電腦，不會上傳</li>
        <li class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-900"><Icon name="film" :size="14" class="text-violet-600" />網頁上預覽、修改每一段</li>
      </ul>
    </div>

    <ol class="mt-10">
      <!-- 1. Project folder -->
      <li class="relative pb-6 pl-12" data-testid="step-folder">
        <span class="absolute top-9 bottom-0 left-4 w-0.5 -translate-x-1/2" :class="folder || !ui.supported ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'" aria-hidden="true" />
        <span class="step-no absolute top-0 left-0" :class="folder ? 'step-done' : current === 1 ? 'step-current' : ''">
          <Icon v-if="folder" name="check" :size="16" /><template v-else>1</template>
        </span>
        <div class="card p-5" :class="current === 1 ? 'ring-2 ring-sky-500/40' : ''">
          <h2 class="font-semibold">準備放影片的資料夾</h2>
          <div v-if="!ui.supported" class="callout mt-3 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            <Icon name="alert" class="mt-0.5" />
            <p>這個瀏覽器不能存取電腦上的資料夾，可以跳過這一步：Agent 會自己在它的工作資料夾裡建立影片專案。想在網頁上看進度、修改旁白，請改用電腦版 Chrome 或 Edge 開啟本頁。</p>
          </div>
          <div v-else-if="folder" class="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/30" data-testid="project-folder">
            <Icon name="folder" class="text-emerald-600 dark:text-emerald-400" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ folder }}</span>
            <button type="button" class="btn-ghost btn-sm" :disabled="ui.loading" @click="pickFolder">更換</button>
          </div>
          <template v-else>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">影片專案的所有檔案都會放在這裡。建議新建一個空資料夾，例如「acme-video」。</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button v-if="ui.remembered" type="button" class="btn-primary" :disabled="ui.loading" @click="reconnect"><Icon name="folder" />繼續使用「{{ ui.remembered.label }}」</button>
              <button type="button" :class="ui.remembered || recent.length ? 'btn-secondary' : 'btn-primary'" :disabled="ui.loading" data-testid="pick-folder" @click="pickFolder">
                <Icon name="folder" />{{ ui.loading ? '載入中…' : '選擇或建立資料夾…' }}
              </button>
            </div>
            <div v-if="recent.length" class="mt-4" data-testid="recent-projects">
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">或繼續最近的專案</p>
              <ul class="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                <li v-for="r in recent.filter((r) => r.id !== ui.remembered?.id).slice(0, 6)" :key="r.id" class="flex items-center gap-1 pr-1">
                  <button type="button" class="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm hover:text-sky-700 dark:hover:text-sky-400" :disabled="ui.loading" data-testid="recent-project" @click="switchTo(r)">
                    <Icon name="folder" :size="14" class="shrink-0 text-slate-400" />
                    <span class="min-w-0 flex-1 truncate font-medium">{{ r.label }}</span>
                    <span v-if="r.label !== r.handle.name" class="hidden max-w-40 truncate text-xs text-slate-500 sm:inline dark:text-slate-400">{{ r.handle.name }}</span>
                  </button>
                  <button type="button" class="icon-btn h-7 w-7 shrink-0" :title="`從清單移除「${r.label}」（檔案會留在資料夾）`" @click="forgetRecent(r.id)"><Icon name="x" :size="14" /></button>
                </li>
              </ul>
            </div>
            <details class="mt-3 text-sm text-slate-600 dark:text-slate-400">
              <summary class="cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-200">第一次用？看看怎麼建立資料夾</summary>
              <ol class="mt-2 list-inside list-decimal space-y-1 pl-1">
                <li>按上面的按鈕，會跳出選擇資料夾的視窗。</li>
                <li>到你想放影片的地方（例如「文件」），按「新增資料夾」，取個名字（例如 acme-video）。</li>
                <li>選這個新資料夾，按「選取資料夾」；瀏覽器詢問存取權限時按「允許」或「編輯檔案」。</li>
              </ol>
            </details>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">已經有做到一半的影片專案？選它的資料夾就能直接繼續編輯。</p>
          </template>
          <p v-if="ui.error" class="callout mt-3 bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300" role="alert"><Icon name="alert" class="mt-0.5" />{{ ui.error }}</p>
        </div>
      </li>

      <!-- 2. Product or story -->
      <li class="relative pb-6 pl-12" data-testid="step-product">
        <span class="absolute top-9 bottom-0 left-4 w-0.5 -translate-x-1/2" :class="hasSource ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'" aria-hidden="true" />
        <span class="step-no absolute top-0 left-0" :class="hasSource ? 'step-done' : current === 2 ? 'step-current' : ''">
          <Icon v-if="hasSource" name="check" :size="16" /><template v-else>2</template>
        </span>
        <div class="card p-5" :class="current === 2 ? 'ring-2 ring-sky-500/40' : ''">
          <template v-if="isStory">
            <h2 class="font-semibold">告訴 Agent 你的故事</h2>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">貼上整篇故事、寫個大綱，或只寫一個點子都可以；不完整的地方，Agent 會一題一題問你。</p>
            <div class="mt-5 space-y-5">
              <label class="block">
                <span class="label">故事</span>
                <textarea
                  v-model="form.story"
                  rows="7"
                  placeholder="例如：一隻小狐狸以為月亮掉進了池塘，想盡辦法要把它撈起來……"
                  class="field"
                  data-testid="story-text"
                />
              </label>
              <label class="block">
                <span class="label">給誰看 <span class="font-normal text-slate-500">（選填）</span></span>
                <input v-model.trim="form.audience" type="text" placeholder="例如：4–7 歲的小朋友、社群上的大人" class="field" data-testid="story-audience" />
              </label>
            </div>
          </template>
          <template v-else>
          <h2 class="font-semibold">告訴 Agent 產品是什麼</h2>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">至少填一項；給得越多，影片越準確。</p>
          <div class="mt-5 space-y-5">
            <div>
              <label class="block">
                <span class="label">產品網址</span>
                <input v-model.trim="form.productUrl" type="url" placeholder="https://example.com" class="field" />
              </label>
              <div v-if="form.productUrl" class="mt-2">
                <label class="flex items-start gap-2 text-sm">
                  <input v-model="form.requiresLogin" type="checkbox" class="mt-0.5 h-4 w-4 accent-sky-600" data-testid="requires-login" />
                  <span>這個網站要登入才看得到</span>
                </label>
                <p v-if="form.requiresLogin" class="callout mt-2 bg-slate-50 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" data-testid="requires-login-help">
                  <Icon name="shield" :size="14" class="mt-0.5 text-emerald-600" />
                  <span>不用在這裡填帳號密碼。錄影前，Agent 會打開一個瀏覽器視窗，請你像平常一樣登入，登入完關掉視窗就好；帳號密碼只在那個視窗輸入，Agent 看不到。建議用展示用的帳號，因為錄影會拍到登入後畫面上的內容。</span>
                </p>
              </div>
            </div>

            <div>
              <label for="source-path" class="label">產品原始碼資料夾 <span class="font-normal text-slate-500">（選填）</span></label>
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <input
                  id="source-path"
                  v-model.trim="form.sourceCodePath"
                  type="text"
                  :placeholder="os === 'windows' ? '例如 C:\\code\\my-product' : '例如 /Users/me/code/my-product'"
                  class="field mt-0 w-full min-w-0 sm:w-auto sm:flex-1"
                  data-testid="source-path"
                />
                <button v-if="canPick" type="button" class="btn-secondary" data-testid="pick-source" @click="pickSource"><Icon name="folder" />選擇資料夾…</button>
              </div>
              <p class="hint">如果這個產品是你們自己開發的，填它的程式資料夾能讓影片更準確。Agent 只會讀取，不會修改。取得完整路徑：{{ pathHelp(os) }}</p>
              <div v-if="form.sourceFolder" class="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700" data-testid="source-folder">
                <Icon name="folder" class="text-slate-500" />
                <span class="min-w-0 flex-1 truncate text-sm">已讀取「<span class="font-medium">{{ form.sourceFolder }}</span>」</span>
                <button type="button" class="btn-ghost btn-sm" @click="clearSource">移除</button>
              </div>
              <p v-if="form.sourceFolder && !form.sourceCodePath" class="mt-1.5 text-xs text-amber-700 dark:text-amber-400" data-testid="source-path-missing">
                瀏覽器為了安全，只告訴網頁資料夾的名稱，不會給完整路徑。請照上面的方法把路徑貼進輸入框；沒填的話，Agent 會依名稱「{{ form.sourceFolder }}」在你的電腦上尋找並跟你確認。
              </p>
              <p v-if="pathMismatch" class="mt-1.5 text-xs text-amber-700 dark:text-amber-400" data-testid="source-path-mismatch">
                路徑最後的資料夾名稱和選擇的「{{ form.sourceFolder }}」不一樣，請確認填的是同一個資料夾。
              </p>
              <p v-if="filledFrom" class="mt-1.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400" data-testid="source-filled"><Icon name="check" :size="12" />{{ filledFrom }}</p>
            </div>

            <label class="block">
              <span class="label">產品說明 <span class="font-normal text-slate-500">（選填）</span></span>
              <textarea v-model="form.description" rows="3" placeholder="一兩句話：產品做什麼、給誰用" class="field" />
            </label>
          </div>
          </template>
        </div>
      </li>

      <!-- 3. Agent -->
      <li class="relative pb-6 pl-12" data-testid="step-run">
        <span class="absolute top-9 bottom-0 left-4 w-0.5 -translate-x-1/2 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
        <span class="step-no absolute top-0 left-0" :class="current === 3 ? 'step-current' : ''">3</span>
        <div class="card p-5" :class="current === 3 ? 'ring-2 ring-sky-500/40' : 'opacity-80'">
          <h2 class="font-semibold">打開 Agent，貼上這段話</h2>
          <p v-if="needsFolder" class="mt-2 text-sm text-slate-500 dark:text-slate-400">請先在步驟 1 準備放影片的資料夾。</p>
          <p v-else-if="!hasSource" class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ isStory ? '請先在步驟 2 寫下你的故事或點子。' : '請先在步驟 2 填入產品網址、原始碼資料夾或一句說明。' }}</p>
          <template v-else>
            <ol class="mt-3 space-y-2.5 text-sm">
              <li class="flex gap-2.5">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">a</span>
                <span>打開 Agent。還沒有的話，到 <a href="https://claude.ai/download" target="_blank" rel="noopener" class="link">claude.ai/download</a> 下載 Claude 桌面版，安裝後登入，切到上方的「Code」。其他 Coding Agent 也可以，只要它能讀網址、在你的電腦上工作。</span>
              </li>
              <li class="flex gap-2.5">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">b</span>
                <span v-if="folder">開一個新的對話。不用再選一次「{{ folder }}」：要你選資料夾時，用它預設的或隨便選一個（例如「文件」）都可以，下面這段話會告訴 Agent 去「{{ folder }}」工作。</span>
                <span v-else>開一個新的對話。它會請你選一個資料夾：選你想存放影片的地方，例如「文件」。</span>
              </li>
              <li class="flex gap-2.5">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">c</span>
                <span>按「複製這段話」，到 Agent 的對話框貼上（<span class="kbd">{{ os === 'mac' ? '⌘+V' : 'Ctrl+V' }}</span>），再按送出。</span>
              </li>
            </ol>

            <div class="mt-4 overflow-hidden rounded-xl border border-sky-200 dark:border-sky-900">
              <div class="flex items-center justify-between gap-2 border-b border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-900 dark:bg-sky-950/50">
                <span class="flex items-center gap-1.5 text-sm font-medium text-sky-900 dark:text-sky-200"><Icon name="message" :size="14" />要貼給 Agent 的話</span>
                <CopyButton :text="message" label="複製這段話" primary />
              </div>
              <pre class="max-h-64 overflow-auto bg-white p-3.5 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap dark:bg-slate-950" data-testid="launch-message">{{ message }}</pre>
            </div>

            <div class="mt-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
              <p class="font-medium">接下來 Agent 會：</p>
              <ul class="mt-2 grid gap-1.5 text-slate-700 sm:grid-cols-2 dark:text-slate-300">
                <li class="flex gap-2"><Icon name="check" :size="14" class="mt-0.5 text-emerald-600" /><span v-if="folder">在「{{ folder }}」裡建立影片專案</span><span v-else>在你選的資料夾裡建立影片專案，並告訴你它在哪裡</span></li>
                <li class="flex gap-2"><Icon name="check" :size="14" class="mt-0.5 text-emerald-600" />電腦缺少需要的工具時，告訴你怎麼安裝，或在你同意後替你處理</li>
                <template v-if="isStory">
                  <li class="flex gap-2"><Icon name="check" :size="14" class="mt-0.5 text-emerald-600" />問你幾個問題：給誰看、喜歡的畫風、能否使用線上語音服務</li>
                  <li class="flex gap-2"><Icon name="check" :size="14" class="mt-0.5 text-emerald-600" />和你一起把故事補完整，畫出角色、挑好聲音，每一步都請你確認</li>
                </template>
                <template v-else>
                  <li class="flex gap-2"><Icon name="check" :size="14" class="mt-0.5 text-emerald-600" />問你幾個問題：影片語言與長度、旁白能否使用線上語音服務</li>
                  <li class="flex gap-2"><Icon name="check" :size="14" class="mt-0.5 text-emerald-600" />分析產品、寫分鏡；每完成一段就停下來請你確認</li>
                </template>
              </ul>
              <p class="mt-3 text-slate-600 dark:text-slate-400">在對話中直接回答它就好。看不懂它的問題時，可以回它「請用更簡單的方式說明」。</p>
            </div>

            <details class="mt-3 text-sm text-slate-500 dark:text-slate-400">
              <summary class="cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200">習慣使用終端機？</summary>
              <p v-if="folder" class="mt-2">在「{{ folder }}」資料夾開啟終端機，執行：</p>
              <p v-else class="mt-2">在想存放影片專案的資料夾開啟終端機，執行：</p>
              <div class="mt-1 flex items-start gap-2">
                <pre class="min-w-0 flex-1 overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-xs break-all whitespace-pre-wrap dark:bg-slate-800" data-testid="launch-command">{{ command }}</pre>
                <CopyButton :text="command" />
              </div>
            </details>
          </template>
        </div>
      </li>

      <!-- 4. Progress -->
      <li v-if="ui.supported" class="relative pl-12" data-testid="step-review">
        <span class="step-no absolute top-0 left-0">4</span>
        <div class="card p-5" :class="current === 3 && folder ? '' : 'opacity-80'">
          <h2 class="font-semibold">在這裡看進度、修改</h2>
          <div v-if="folder && activity" class="mt-3"><ActivityBanner /></div>
          <p v-else-if="folder" class="mt-2 flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400" role="status" data-testid="waiting">
            <span class="relative mt-1.5 flex h-2 w-2 shrink-0" aria-hidden="true">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            <span>等 Agent 在「{{ folder }}」建立專案。建好後這個頁面會自動切換，你可以看到進度、修改旁白、預覽每一段影片。</span>
          </p>
          <p v-else class="mt-1 text-sm text-slate-600 dark:text-slate-400">完成步驟 1 後，Agent 一建好專案，這個頁面就會自動顯示進度。</p>
        </div>
      </li>
    </ol>

    <details class="mt-10 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
      <summary class="cursor-pointer font-medium select-none">進階：Guide API 與本機助手</summary>
      <p class="mt-3">Agent 讀取的規則與範本都是靜態檔案：</p>
      <ul class="mt-2 space-y-1.5">
        <li v-for="[label, url] in links" :key="url" class="flex gap-2">
          <Icon name="link" :size="14" class="mt-0.5 text-slate-400" />
          <span>{{ label }}：<a :href="url" class="link break-all">{{ url }}</a></span>
        </li>
      </ul>
      <p class="mt-3">想直接在網頁上按鈕重做影片，可以請 Agent「在影片專案啟動 video-agent 本機助手並給我配對連結」，再點那個連結。</p>
    </details>
  </div>
</template>
