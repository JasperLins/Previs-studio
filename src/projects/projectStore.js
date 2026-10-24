// ===== S8 项目库存储层：纯函数（可测）+ IndexedDB 薄封装（Promise 化、连接缓存）=====
// App.jsx 只经接缝调用；IndexedDB 不可用时所有封装 reject，由调用方降级（R1.4），不在本模块内重试。

const DB_NAME = 'monoform-projects'
const DB_VERSION = 1
const STORE_NAME = 'projects'
const DEFAULT_PROJECT_NAME = '未命名场景'

export const fallbackProjectId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const createProjectId = () => {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  } catch { /* 非安全上下文等场景走回退形态 */ }
  return fallbackProjectId()
}

// 条目元信息从工程 JSON 派生：name=settings.name（0..40）、镜头数、封面=首个非空缩略图
export const makeEntryFromProject = (id, data, now) => {
  const shots = Array.isArray(data?.shots) ? data.shots : []
  const coverShot = shots.find(shot => typeof shot?.thumbnail === 'string' && shot.thumbnail)
  return {
    id,
    name: String(data?.settings?.name || DEFAULT_PROJECT_NAME).trim().slice(0, 40) || DEFAULT_PROJECT_NAME,
    createdAt: now,
    updatedAt: now,
    shotCount: shots.length,
    cover: coverShot ? coverShot.thumbnail : '',
    data: data || {},
  }
}

export const uniqueProjectName = (existingNames, desired) => {
  const used = new Set((Array.isArray(existingNames) ? existingNames : []).map(name => String(name || '').trim().toLocaleLowerCase()))
  const base = String(desired || DEFAULT_PROJECT_NAME).trim().slice(0, 40) || DEFAULT_PROJECT_NAME
  if (!used.has(base.toLocaleLowerCase())) return base
  for (let copy = 2; copy <= 99; copy += 1) {
    const suffix = ` ${copy}`
    const candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`
    if (!used.has(candidate.toLocaleLowerCase())) return candidate
  }
  return `${base.slice(0, 31)} ${createProjectId().slice(0, 8)}`
}

// 列表时间列：刚刚 / N 分钟前 / 今天 HH:mm / MM-DD HH:mm；非法时间返回空串
export const relativeTime = (now, updated) => {
  const nowMs = Number(now)
  const updatedMs = Number(updated)
  if (!Number.isFinite(nowMs) || !Number.isFinite(updatedMs) || updatedMs > nowMs) return ''
  const diffSeconds = Math.floor((nowMs - updatedMs) / 1000)
  if (diffSeconds < 60) return '刚刚'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`
  const date = new Date(updatedMs)
  const nowDate = new Date(nowMs)
  const pad = value => String(value).padStart(2, '0')
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const sameDay = date.getFullYear() === nowDate.getFullYear() && date.getMonth() === nowDate.getMonth() && date.getDate() === nowDate.getDate()
  return sameDay ? clock : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock}`
}

let dbPromise = null

export const openStore = () => {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    let request
    try {
      if (typeof indexedDB === 'undefined') throw new Error('indexeddb unavailable')
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      reject(error)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(request.error || new Error('indexeddb open failed'))
  })
  return dbPromise
}

const withStore = (mode, run) => openStore().then(db => new Promise((resolve, reject) => {
  let request
  try {
    const tx = db.transaction(STORE_NAME, mode)
    request = run(tx.objectStore(STORE_NAME))
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'))
    tx.oncomplete = () => resolve(request?.result)
  } catch (error) {
    reject(error)
  }
}))

export const listEntries = () => withStore('readonly', store => store.getAll())
  .then(entries => (Array.isArray(entries) ? entries : []).sort((a, b) => (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0)))

export const getEntry = id => withStore('readonly', store => store.get(id))

export const putEntry = entry => withStore('readwrite', store => store.put(entry))

export const deleteEntry = id => withStore('readwrite', store => store.delete(id))
