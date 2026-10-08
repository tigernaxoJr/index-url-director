// Keeps recently opened project folder handles in IndexedDB, so the next visit only needs the user
// to re-grant permission instead of picking the folder again. Each tab picks one of them on its own
// (see store.ts); this list is shared by all tabs.

const DB = 'slide-studio'
const STORE = 'handles'
const KEY = 'recent'
const MAX = 12

export interface Recent {
  id: string
  handle: FileSystemDirectoryHandle
  /** The deck title once the folder holds a project or start request; the folder name until then. */
  label: string
  opened: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

async function save(list: Recent[]) {
  try {
    await run('readwrite', (s) => s.put(list, KEY))
  } catch {
    // Private windows may refuse IndexedDB; the app still works for this visit.
  }
}

/** Recently opened folders, newest first. */
export async function listRecent(): Promise<Recent[]> {
  try {
    return ((await run('readonly', (s) => s.get(KEY))) as Recent[] | undefined) ?? []
  } catch {
    return []
  }
}

async function addTo(list: Recent[], handle: FileSystemDirectoryHandle, label?: string): Promise<Recent[]> {
  let found: Recent | undefined
  for (const r of list) if (await r.handle.isSameEntry(handle)) found = r
  const entry: Recent = { id: found?.id ?? crypto.randomUUID(), handle, label: label ?? found?.label ?? handle.name, opened: Date.now() }
  const next = [entry, ...list.filter((r) => r !== found)].slice(0, MAX)
  await save(next)
  return next
}

/** Puts the folder first in the list (the same folder keeps its id); returns the new list. */
export async function remember(handle: FileSystemDirectoryHandle, label?: string): Promise<Recent[]> {
  return addTo(await listRecent(), handle, label)
}

export async function forget(id: string): Promise<Recent[]> {
  const next = (await listRecent()).filter((r) => r.id !== id)
  await save(next)
  return next
}
