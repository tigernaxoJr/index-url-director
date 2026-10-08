<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FinalPanel from './components/FinalPanel.vue'
import HomeView from './components/HomeView.vue'
import Icon from './components/Icon.vue'
import SceneBoard from './components/SceneBoard.vue'
import SceneEditor from './components/SceneEditor.vue'
import WorkflowBar from './components/WorkflowBar.vue'
import ActivityBanner from './components/ActivityBanner.vue'
import CompanionStatus from './components/CompanionStatus.vue'
import ProjectSwitcher from './components/ProjectSwitcher.vue'
import { companion, connect, takePairingFromUrl } from './lib/companion'
import type { Recent } from './lib/idb'
import { close, outdated, pickFolder, reload, restore, state, switchTo, syncTemplate, ui } from './lib/store'

const current = ref<string | null>(null)
/** The open editor has edits not saved yet. */
const dirty = ref(false)
const detail = ref<HTMLElement | null>(null)

/** The scene in the detail pane (null: the full video). Leaving unsaved edits asks first. */
const selected = computed<string | null>({
  get: () => current.value,
  set(id) {
    if (id === current.value) return
    if (dirty.value && !confirm('這個 scene 有尚未儲存的修改，要放棄嗎？')) return
    dirty.value = false
    current.value = id
    // On a narrow screen the detail pane sits below the list: bring it into view.
    if (id && !matchMedia('(min-width: 1024px)').matches) nextTick(() => detail.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  },
})

/** Leaving the project (close or switch) with unsaved edits asks first. */
function leave(question: string) {
  if (dirty.value && !confirm(question)) return false
  dirty.value = false
  return true
}
function closeProject() {
  if (leave('有尚未儲存的修改，仍要關閉專案嗎？')) close()
}
function switchProject(entry: Recent) {
  if (leave('有尚未儲存的修改，仍要切換專案嗎？')) switchTo(entry)
}
function pickProject() {
  if (leave('有尚未儲存的修改，仍要開啟其他資料夾嗎？')) pickFolder()
}

const warnUnsaved = (e: BeforeUnloadEvent) => {
  if (dirty.value) e.preventDefault()
}
onMounted(() => {
  takePairingFromUrl()
  connect(undefined, reload)
  restore()
  window.addEventListener('beforeunload', warnUnsaved)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnsaved))
// Drop the selection when that scene leaves the project.
watch(state, (st) => {
  if (current.value && !st?.scenes.some((s) => s.id === current.value)) {
    current.value = null
    dirty.value = false
  }
})
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
      <a
        href="../"
        class="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        title="返回平台總覽"
      >
        <span>←</span>
        <span>平台總覽</span>
      </a>
      <span class="text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
      <span class="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight whitespace-nowrap">
        <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white" aria-hidden="true"><Icon name="play" :size="13" /></span>
        <span :class="state ? 'hidden sm:inline' : ''">Agent Video Producer</span>
      </span>
      <template v-if="state">
        <span class="hidden text-slate-300 sm:inline dark:text-slate-700" aria-hidden="true">/</span>
        <ProjectSwitcher @switch="switchProject" @pick="pickProject" @close="closeProject" />
      </template>
      <span class="ml-auto" />
      <CompanionStatus />
    </div>
  </header>

  <main>
    <HomeView v-if="!state" />
    <div v-else class="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:py-6">
      <div v-if="outdated" class="callout bg-amber-50 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100" role="status" data-testid="template-outdated">
        <Icon name="refresh" class="mt-0.5" />
        <div class="min-w-0 flex-1">
          <p>這個專案的工具（腳本、格式定義）是舊版範本建立的，和網站目前的版本不一致（{{ outdated.paths.length }} 個檔案）。更新後網頁與 Agent 才會用同一套規則；影片內容（分鏡、旁白、素材）不會被覆蓋。</p>
          <button type="button" class="btn-primary btn-sm mt-2" :disabled="ui.saving" data-testid="template-update" @click="syncTemplate">
            <Icon name="refresh" :size="14" />更新專案工具
          </button>
        </div>
      </div>
      <div v-if="state.errors.length" class="callout bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-200" role="alert">
        <Icon name="alert" class="mt-0.5" />
        <p class="min-w-0">
          專案檔有問題，{{ outdated ? '請先按上方「更新專案工具」；仍有問題時' : '' }}請讓 Agent 執行 <code>pnpm run validate</code> 修正：
          <span v-for="e in state.errors.slice(0, 5)" :key="e" class="mt-1 block font-mono text-xs break-all">{{ e }}</span>
        </p>
      </div>
      <ActivityBanner />
      <WorkflowBar />
      <div class="grid items-start gap-4 lg:grid-cols-[minmax(320px,2fr)_3fr]">
        <div class="lg:sticky lg:top-18 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:rounded-2xl">
          <SceneBoard v-model:selected="selected" />
        </div>
        <div ref="detail" class="scroll-mt-18">
          <SceneEditor v-if="selected" :id="selected" v-model:dirty="dirty" @close="selected = null" />
          <FinalPanel v-else @select="selected = $event" />
        </div>
      </div>
    </div>
  </main>

  <div class="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
    <div
      v-if="companion.running"
      class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-700"
      role="status"
      data-testid="companion-running"
    >
      <span class="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
      <span class="min-w-0">
        <span class="block font-medium">{{ companion.running }}…</span>
        <span v-if="companion.lastLine" class="mt-1 block truncate font-mono text-xs text-slate-300">{{ companion.lastLine }}</span>
      </span>
    </div>
    <div
      v-else-if="ui.notice"
      class="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg"
      :class="{
        'bg-emerald-700 text-white': ui.notice.kind === 'ok',
        'bg-amber-400 text-slate-950': ui.notice.kind === 'warn',
        'bg-red-700 text-white': ui.notice.kind === 'error',
      }"
      role="status"
      data-testid="notice"
    >
      <Icon :name="ui.notice.kind === 'ok' ? 'check' : 'alert'" class="mt-0.5" />
      <span class="min-w-0">{{ ui.notice.text }}</span>
    </div>
  </div>
</template>
