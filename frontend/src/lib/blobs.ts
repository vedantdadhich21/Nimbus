// Uploaded bytes for the demo live in the browser as data URLs. They are the
// only real file content the mock adapter has, so the viewer and the grid
// thumbnails both read from here.

const STORAGE_KEY = 'nimbus.uploaded.blobs'

let cache: Map<string, string> | null = null

function load(): Map<string, string> {
  if (cache) return cache
  cache = new Map()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>
      for (const [id, url] of Object.entries(parsed)) {
        if (typeof url === 'string') cache.set(id, url)
      }
    }
  } catch {
    // Corrupt or unavailable storage — the map simply stays empty.
  }
  return cache
}

function persist() {
  if (!cache) return
  try {
    const obj: Record<string, string> = {}
    for (const [id, url] of cache) obj[id] = url
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // Quota exceeded: the in-memory cache still serves this session.
  }
}

/** The data URL for a file uploaded in this browser, if its bytes were kept. */
export function getUploadedBlobUrl(fileId: string): string | null {
  return load().get(fileId) ?? null
}

export function registerUploadedBlob(fileId: string, url: string) {
  load().set(fileId, url)
  persist()
}

export function clearUploadedBlobs() {
  load().clear()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
