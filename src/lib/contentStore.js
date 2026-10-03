import { seedMaterialGroups, seedMaterials, seedPhotos, seedProjects } from '../data/initialContent.js'

const LEGACY_DATABASE = 'portfolio-demo-content'
const LEGACY_STORE = 'site-content'
const LEGACY_KEY = 'primary'
const MIGRATION_KEY = 'zb-server-content-migrated-v1'

export const emptyContent = {
  schemaVersion: 6,
  articles: [],
  projects: seedProjects.map(project => ({ ...project, tags: [...project.tags] })),
  photos: seedPhotos.map(photo => ({ ...photo })),
  materials: seedMaterials.map(material => ({ ...material })),
  materialGroups: seedMaterialGroups.map(group => ({ ...group })),
}

async function responseJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || '服务器请求失败')
  return payload
}

export async function loadContent() {
  return responseJson(await fetch('/api/content', { credentials: 'include' }))
}

export async function saveContent(content) {
  return responseJson(await fetch('/api/content', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...content, schemaVersion: 6 }),
  }))
}

const canvasBlob = canvas => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片压缩失败')), 'image/webp', .84)
})

async function uploadBlob(blob, filename = 'upload.webp') {
  const form = new FormData()
  form.append('file', blob, filename)
  const response = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: form })
  return (await responseJson(response)).url
}

export async function compressImage(file, maxDimension = 1800) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > 12 * 1024 * 1024) throw new Error('单张图片不能超过 12MB')
  const source = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('图片解析失败'))
      element.src = source
    })
    const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * ratio)
    canvas.height = Math.round(image.naturalHeight * ratio)
    canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height)
    return uploadBlob(await canvasBlob(canvas), `${file.name.replace(/\.[^.]+$/, '') || 'upload'}.webp`)
  } finally {
    URL.revokeObjectURL(source)
  }
}

async function readLegacyContent() {
  if (!window.indexedDB) return null
  return new Promise(resolve => {
    const request = window.indexedDB.open(LEGACY_DATABASE)
    request.onerror = () => resolve(null)
    request.onsuccess = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(LEGACY_STORE)) {
        database.close()
        resolve(null)
        return
      }
      const transaction = database.transaction(LEGACY_STORE, 'readonly')
      const getRequest = transaction.objectStore(LEGACY_STORE).get(LEGACY_KEY)
      getRequest.onsuccess = () => resolve(getRequest.result || null)
      getRequest.onerror = () => resolve(null)
      transaction.oncomplete = () => database.close()
    }
  })
}

async function migrateAsset(value, name) {
  if (!value?.startsWith?.('data:image/')) return value || ''
  const blob = await (await fetch(value)).blob()
  return uploadBlob(blob, `${name}.webp`)
}

export async function migrateLegacyContent(serverContent) {
  if (window.localStorage.getItem(MIGRATION_KEY)) return serverContent
  const legacy = await readLegacyContent()
  if (!legacy) {
    window.localStorage.setItem(MIGRATION_KEY, 'none')
    return serverContent
  }
  const ids = {
    articles: new Set(serverContent.articles.map(item => item.id)),
    projects: new Set(serverContent.projects.map(item => item.id)),
    photos: new Set(serverContent.photos.map(item => item.id)),
    materials: new Set((serverContent.materials || []).map(item => item.id)),
  }
  const articles = []
  for (const item of legacy.articles || []) {
    if (ids.articles.has(item.id)) continue
    articles.push({ ...item, cover: await migrateAsset(item.cover, `${item.id}-cover`), screenshots: await Promise.all((item.screenshots || []).map((image, index) => migrateAsset(image, `${item.id}-${index}`))) })
  }
  const projects = []
  for (const item of legacy.projects || []) {
    if (!ids.projects.has(item.id)) projects.push({ ...item, image: await migrateAsset(item.image, `${item.id}-project`) })
  }
  const photos = []
  for (const item of legacy.photos || []) {
    if (!ids.photos.has(item.id)) photos.push({ ...item, image: await migrateAsset(item.image, `${item.id}-photo`) })
  }
  const changed = articles.length || projects.length || photos.length
  const merged = { schemaVersion: 6, articles: [...articles, ...serverContent.articles], projects: [...serverContent.projects, ...projects], photos: [...photos, ...serverContent.photos], materials: serverContent.materials || [], materialGroups: serverContent.materialGroups || seedMaterialGroups }
  const result = changed ? await saveContent(merged) : serverContent
  window.localStorage.setItem(MIGRATION_KEY, changed ? 'imported' : 'none')
  return result
}

export const makeId = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
