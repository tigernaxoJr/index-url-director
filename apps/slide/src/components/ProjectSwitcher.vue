<script setup lang="ts">
// The header's project menu: switch this tab to another recent folder, open another folder, or
// close. Entries are links (?p=<id>), so a middle- or Ctrl-click opens that project in a new tab.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Recent } from '../lib/idb'
import { currentId, forgetRecent, recent } from '../lib/store'

defineProps<{ title: string }>()
const emit = defineEmits<{ switch: [entry: Recent]; pick: []; close: [] }>()
const open = ref(false)
const menu = ref<HTMLElement | null>(null)

const href = (r: Recent) => `?p=${encodeURIComponent(r.id)}`

function choose(e: MouseEvent, r: Recent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return // let the browser open a new tab
  e.preventDefault()
  open.value = false
  emit('switch', r)
}

function act(name: 'pick' | 'close') {
  open.value = false
  if (name === 'pick') emit('pick')
  else emit('close')
}

const outside = (e: Event) => {
  if (open.value && !menu.value?.contains(e.target as Node)) open.value = false
}
const escape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
})
</script>

<template>
  <div ref="menu" class="relative min-w-0">
    <button
      type="button"
      class="flex min-w-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
      :aria-expanded="open"
      aria-haspopup="menu"
      title="切換專案"
      data-testid="project-switcher"
      @click="open = !open"
    >
      <span class="min-w-0 truncate" data-testid="project-name">{{ title }}</span>
      <svg class="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <div
      v-if="open"
      class="absolute top-full left-0 z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900"
      role="menu"
      data-testid="project-menu"
    >
      <p class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">最近的專案</p>
      <div v-for="r in recent" :key="r.id" class="group flex items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
        <a
          :href="href(r)"
          class="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-sm"
          role="menuitem"
          :aria-current="r.id === currentId ? 'true' : undefined"
          :title="`資料夾：${r.handle.name}（Ctrl＋點選可在新分頁開啟）`"
          data-testid="recent-project"
          @click="choose($event, r)"
        >
          <span class="w-3.5 shrink-0 text-center text-indigo-600 dark:text-indigo-400" aria-hidden="true">{{ r.id === currentId ? '✓' : '' }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate" :class="r.id === currentId ? 'font-semibold' : ''">{{ r.label }}</span>
            <span v-if="r.label !== r.handle.name" class="block truncate font-mono text-xs text-slate-500 dark:text-slate-400">{{ r.handle.name }}</span>
          </span>
        </a>
        <button
          v-if="r.id !== currentId"
          type="button"
          class="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700 focus-visible:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          :title="`從清單移除「${r.label}」（檔案會留在資料夾）`"
          @click="forgetRecent(r.id)"
        >
          ✕
        </button>
      </div>
      <div class="my-1 border-t border-slate-200 dark:border-slate-800" />
      <button type="button" class="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" role="menuitem" @click="act('pick')">
        開啟其他資料夾…
      </button>
      <button type="button" class="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" role="menuitem" @click="act('close')">
        關閉專案（檔案會留在資料夾）
      </button>
    </div>
  </div>
</template>
