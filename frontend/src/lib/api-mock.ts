import type {
  Db,
  FileItem,
  FileVersion,
  Folder,
  IntegrityReport,
  Listing,
  NimbusApi,
  SearchHit,
  SearchResponse,
  Session,
  Settings,
  SetupState,
  SortKey,
  StorageStats,
  UploadInput,
} from './types'
import { DEMO_VERSION, SEED_FOLDERS, createDb } from './seed'
import { hex, kindForName, mimeForKind, uid } from './format'

const STORAGE_KEY = `nimbus.db.v${DEMO_VERSION}`
const MiB = 1024 * 1024

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.version === DEMO_VERSION) return parsed
    }
  } catch {
    // corrupted storage — fall through to a fresh demo database
  }
  const fresh = createDb()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  return fresh
}

let db: Db = loadDb()

function migratePreviews() {
  let changed = false
  for (const file of db.files) {
    if (file.preview.kind === 'none') {
      if (file.kind === 'pdf') {
        const lower = file.name.toLowerCase()
        const src = lower.includes('dbms')
          ? '/demo/dbms-unit3.pdf'
          : lower.includes('operating') || lower.includes('os')
            ? '/demo/os-unit4.pdf'
            : lower.includes('resume')
              ? '/demo/resume.pdf'
              : lower.includes('syllabus')
                ? '/demo/syllabus.pdf'
                : '/demo/research-note.pdf'
        file.preview = { kind: 'pdf', src }
        changed = true
      } else if (file.kind === 'video') {
        file.preview = { kind: 'video', src: '/demo/lecture-clip.mp4' }
        changed = true
      } else if (file.kind === 'audio') {
        file.preview = { kind: 'audio', src: '/demo/voice-memo.wav' }
        changed = true
      } else if (file.kind === 'image') {
        file.preview = { kind: 'image' }
        changed = true
      } else if (file.kind === 'text' || file.kind === 'code') {
        file.preview = {
          kind: 'text',
          text: `# ${file.name}\n\n${file.snippet || 'Stored file preview.'}\n`,
        }
        changed = true
      }
    }
  }
  if (changed) persist()
}

migratePreviews()

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const latency = (min = 90, max = 260) => wait(min + Math.random() * (max - min))
const now = () => new Date().toISOString()

function liveFiles() {
  return db.files.filter((f) => !f.deletedAt)
}

function descendants(folderId: string): Set<string> {
  const out = new Set<string>([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const f of db.folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id)
        changed = true
      }
    }
  }
  return out
}

function pathOf(folderId: string | null): Folder[] {
  const path: Folder[] = []
  let current = folderId ? db.folders.find((f) => f.id === folderId) : undefined
  let guard = 0
  while (current && guard < 20) {
    path.unshift(current)
    current = current.parentId ? db.folders.find((f) => f.id === current?.parentId) : undefined
    guard += 1
  }
  return path
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function sortFiles(files: FileItem[], sort: SortKey): FileItem[] {
  const copy = [...files]
  copy.sort((a, b) => {
    if (sort === 'size') return b.size - a.size
    if (sort === 'modified') return b.updatedAt.localeCompare(a.updatedAt)
    if (sort === 'kind') return a.kind.localeCompare(b.kind) || collator.compare(a.name, b.name)
    return collator.compare(a.name, b.name)
  })
  return copy
}

// ── semantic scoring ──────────────────────────────────────────────────────
// The demo uses a hand-written topic index and a small synonym table. It is
// NOT an embedding model: it exists so the search screen can be reviewed
// before the local AI service is built. Replace with /api/search later.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'from', 'for', 'about', 'with', 'and', 'or', 'my', 'me', 'in', 'on',
  'at', 'to', 'is', 'are', 'was', 'were', 'that', 'this', 'it', 'its', 'find', 'show', 'please',
  'last', 'all', 'some', 'any', 'by', 'as', 'file', 'files',
])

const SYNONYMS: Record<string, string[]> = {
  invoice: ['bill', 'billing', 'receipt', 'payment', 'garage', 'repair'],
  bill: ['invoice', 'receipt', 'payment', 'utility'],
  photo: ['image', 'picture', 'shot', 'camera'],
  image: ['photo', 'picture'],
  picture: ['photo', 'image'],
  backup: ['archive', 'zip', 'snapshot', 'dump'],
  archive: ['backup', 'zip'],
  report: ['document', 'doc', 'draft', 'thesis', 'chapters'],
  document: ['report', 'doc', 'pdf'],
  paper: ['research', 'pdf', 'publication'],
  notes: ['note', 'study', 'material', 'class'],
  note: ['notes', 'study'],
  fest: ['event', 'festival', 'ceremony', 'stage', 'campus'],
  trip: ['travel', 'trek', 'journey', 'tour'],
  ticket: ['travel', 'booking', 'journey', 'train'],
  resume: ['cv', 'career', 'placement'],
  marks: ['grades', 'result', 'cgpa', 'sgpa'],
  recording: ['video', 'audio', 'rehearsal', 'seminar'],
  encryption: ['crypto', 'aes', 'keys', 'cipher'],
  key: ['keys', 'encryption', 'master'],
  search: ['semantic', 'embedding', 'query'],
  semantic: ['embedding', 'search', 'vector'],
  compression: ['zstd', 'compress', 'ratio'],
  diagram: ['figure', 'svg', 'architecture', 'chart'],
  slides: ['presentation', 'deck', 'pptx'],
  screenshot: ['screen', 'capture', 'ui'],
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(query: string): string[] {
  return normalize(query)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function expand(token: string): string[] {
  const base = token.replace(/s$/, '')
  const out = new Set<string>([token, base])
  for (const [key, values] of Object.entries(SYNONYMS)) {
    const keyBase = key.replace(/s$/, '')
    if (key === token || keyBase === base) values.forEach((v) => out.add(v))
    if (values.includes(token) || values.includes(base)) out.add(key)
  }
  return [...out]
}

function scopeMatches(kind: FileItem['kind'], scope: 'all' | 'documents' | 'images' | 'media') {
  if (scope === 'all') return true
  if (scope === 'images') return kind === 'image'
  if (scope === 'media') return kind === 'video' || kind === 'audio'
  return ['pdf', 'document', 'sheet', 'slide', 'text', 'code'].includes(kind)
}

function runSearch(
  query: string,
  scope: 'all' | 'documents' | 'images' | 'media',
  folderId: string | null,
): SearchResponse {
  const started = performance.now()
  const tokens = tokenize(query)
  if (tokens.length === 0) {
    return { hits: [], tookMs: 0, mode: 'hybrid', encodedMs: 0 }
  }
  const allowedFolders = folderId ? descendants(folderId) : null
  const hits: SearchHit[] = []
  const corpus = liveFiles()

  // Rare terms carry more signal than common ones: without this every file that
  // mentions "paper" ties with a file that actually matches the query.
  const documentFrequency = new Map<string, number>()
  for (const file of corpus) {
    const haystack = `${normalize(file.name)} ${normalize(file.topics.join(' '))} ${normalize(file.snippet)}`
    for (const token of tokens) {
      if (expand(token).some((variant) => haystack.includes(variant))) {
        documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
      }
    }
  }
  const weightOf = (token: string) =>
    Math.log(1 + corpus.length / (1 + (documentFrequency.get(token) ?? 0)))
  const totalWeight = tokens.reduce((sum, token) => sum + weightOf(token), 0) || 1

  for (const file of corpus) {
    if (!scopeMatches(file.kind, scope)) continue
    if (allowedFolders && (!file.folderId || !allowedFolders.has(file.folderId))) continue

    const name = normalize(file.name)
    const topics = normalize(file.topics.join(' '))
    const snippet = normalize(file.snippet)

    let nameWeight = 0
    let semanticWeight = 0
    const matched: string[] = []

    for (const token of tokens) {
      const variants = expand(token)
      const weight = weightOf(token)
      const inName = variants.some((v) => name.includes(v))
      const inTopics = variants.some((v) => topics.includes(v))
      const inSnippet = variants.some((v) => snippet.includes(v))
      if (inName) nameWeight += weight
      if (inTopics) semanticWeight += weight
      else if (inSnippet) semanticWeight += 0.7 * weight
      if (inName || inTopics || inSnippet) matched.push(token)
    }

    const nameScore = Math.min(1, nameWeight / totalWeight)
    const semantic = Math.min(1, semanticWeight / totalWeight)
    let score = 0.62 * semantic + 0.38 * nameScore
    if (tokens.length === 1 && name.includes(tokens[0])) score += 0.06
    if (file.starred && matched.length > 0) score += 0.01
    score = Math.min(0.99, score)

    // A single weak token is enough for one-word queries, but a multi-word
    // query should match at least half of its terms to appear at all.
    if (tokens.length > 1 && matched.length / tokens.length < 0.5) continue
    if (score < 0.08) continue
    hits.push({
      file,
      score,
      semantic,
      nameScore,
      passage: matched.length > 0 ? file.snippet : null,
    })
  }

  hits.sort((a, b) => b.score - a.score || collator.compare(a.file.name, b.file.name))
  const tookMs = Math.max(18, Math.round(performance.now() - started + 62 + Math.random() * 48))
  return {
    hits: hits.slice(0, 40),
    tookMs,
    mode: 'hybrid',
    encodedMs: 9 + Math.round(Math.random() * 14),
  }
}

function stats(): StorageStats {
  const files = liveFiles()
  const used = files.reduce((n, f) => n + f.compression.storedSize, 0)
  const original = files.reduce((n, f) => n + f.size, 0)
  const byKindMap = new Map<FileItem['kind'], { bytes: number; files: number }>()
  for (const f of files) {
    const entry = byKindMap.get(f.kind) ?? { bytes: 0, files: 0 }
    entry.bytes += f.compression.storedSize
    entry.files += 1
    byKindMap.set(f.kind, entry)
  }
  return {
    usedBytes: used,
    originalBytes: original,
    savedBytes: Math.max(0, original - used),
    fileCount: files.length,
    folderCount: db.folders.length,
    partCount: files.reduce((n, f) => n + f.parts.length, 0),
    blockCount: files.reduce((n, f) => n + Math.ceil(f.size / f.blockSize), 0),
    trashCount: db.files.filter((f) => f.deletedAt).length,
    byKind: [...byKindMap.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.bytes - a.bytes),
    telegram: { chat: 'Saved Messages', messages: files.reduce((n, f) => n + f.parts.length, 0), perFileLimit: 2 * 1024 * MiB },
  }
}

function previewForUpload(name: string, kind: FileItem['kind']): FileItem['preview'] {
  if (kind === 'pdf') {
    const lower = name.toLowerCase()
    const src = lower.includes('dbms')
      ? '/demo/dbms-unit3.pdf'
      : lower.includes('operating')
        ? '/demo/os-unit4.pdf'
        : lower.includes('resume')
          ? '/demo/resume.pdf'
          : lower.includes('syllabus')
            ? '/demo/syllabus.pdf'
            : '/demo/research-note.pdf'
    return { kind: 'pdf', src }
  }
  if (kind === 'video') return { kind: 'video', src: '/demo/lecture-clip.mp4' }
  if (kind === 'audio') return { kind: 'audio', src: '/demo/voice-memo.wav' }
  if (kind === 'image') return { kind: 'image' }
  if (kind === 'text' || kind === 'code') {
    return {
      kind: 'text',
      text: `# ${name}\n\nUploaded in this demo session.\n\nIn a real deployment the file is fetched from Telegram in 1 MiB blocks, decrypted and decompressed on the user's own server before it reaches the browser.\n\nparts        1\nblocks       1\ncipher       AES-256-GCM\npolicy       zstd\n`,
    }
  }
  return { kind: 'none' }
}

function buildUploadedFile(input: UploadInput): FileItem {
  const index = db.files.length + 1
  const kind = input.kind ?? kindForName(input.name)
  const ratio = input.compressionRatio
  const applied = ratio != null && ratio > 1.02
  const storedSize = applied && ratio ? Math.round(input.size / ratio) : input.size
  const partCount = Math.max(1, Math.ceil(storedSize / (100 * MiB)))
  const firstMessage = 20000 + index * 41
  const tags: Record<string, string[]> = {
    image: ['photo', 'image', 'upload'],
    video: ['video', 'recording', 'upload'],
    audio: ['audio', 'recording', 'upload'],
    pdf: ['document', 'pdf', 'upload'],
    document: ['document', 'upload'],
    sheet: ['sheet', 'data', 'upload'],
    slide: ['slides', 'presentation', 'upload'],
    text: ['text', 'notes', 'upload'],
    code: ['code', 'source', 'upload'],
    archive: ['archive', 'backup', 'upload'],
    other: ['upload'],
  }
  return {
    id: `f-up-${Date.now().toString(36)}`,
    name: input.name,
    kind,
    mime: mimeForKind(kind),
    size: input.size,
    folderId: input.folderId,
    createdAt: now(),
    updatedAt: now(),
    compression: {
      applied,
      originalSize: input.size,
      storedSize,
      ratio: ratio ?? 1,
      policy: applied ? 'sampled' : 'skip',
      note: applied
        ? 'Sample test predicted a saving above the 5% threshold.'
        : 'Sample test predicted less than 5% saving; stored as is.',
    },
    encrypted: true,
    partSize: 100 * MiB,
    blockSize: MiB,
    parts: Array.from({ length: partCount }, (_, i) => ({
      index: i,
      size: i === partCount - 1 ? storedSize - 100 * MiB * (partCount - 1) : 100 * MiB,
      messageId: firstMessage + i,
      hash: hex(`up-${input.name}-${i}`, 16),
    })),
    hash: hex(`upload-hash-${input.name}`, 40),
    telegram: { chat: 'Saved Messages', chatId: 'self', firstMessageId: firstMessage },
    embedding: ['text', 'code', 'pdf', 'document', 'sheet', 'slide'].includes(kind)
      ? { kind: 'text', model: 'all-MiniLM-L6-v2', dim: 384, passages: Math.max(1, Math.ceil(input.size / 40_000)) }
      : kind === 'image'
        ? { kind: 'image', model: 'CLIP ViT-B/32', dim: 512, passages: 1 }
        : null,
    versions: [
      { id: uid('v'), label: 'v1', size: input.size, createdAt: now(), current: true },
    ],
    starred: false,
    deletedAt: null,
    preview: previewForUpload(input.name, kind),
    thumbSeed: `${input.name}-${index}`,
    topics: tags[kind] ?? ['upload'],
    snippet: 'Uploaded in this demo session.',
  }
}

export const mockApi: NimbusApi = {
  async getSession(): Promise<Session> {
    await latency(60, 160)
    return db.session
  },

  async getSetupState(): Promise<SetupState> {
    await latency(40, 100)
    return db.setup
  },

  async setupCredentials(apiId: string, apiHash: string): Promise<SetupState> {
    await latency(320, 620)
    if (!/^\d{5,10}$/.test(apiId.trim())) throw new Error('api_id must be 5–10 digits, from my.telegram.org.')
    if (apiHash.trim().length < 20) throw new Error('api_hash looks too short. Copy the 32-character hash.')
    db.setup = { ...db.setup, apiId: apiId.trim(), apiHash: apiHash.trim(), step: 2 }
    persist()
    return db.setup
  },

  async setupPhone(phone: string): Promise<SetupState> {
    await latency(360, 700)
    if (phone.replace(/\D/g, '').length < 10) throw new Error('Enter the phone number with its country code.')
    db.setup = { ...db.setup, phone: phone.trim(), step: 3 }
    persist()
    return db.setup
  },

  async setupCode(code: string) {
    await latency(340, 700)
    if (!/^\d{4,6}$/.test(code.trim())) throw new Error('The login code is 5 digits.')
    db.setup = { ...db.setup, needsPassword: true, step: 4 }
    persist()
    return { needsPassword: true, step: 4 }
  },

  async setupPassword(_password: string): Promise<SetupState> {
    await latency(300, 560)
    db.setup = { ...db.setup, step: 5 }
    persist()
    return db.setup
  },

  async setupPassphrase(passphrase: string) {
    await latency(420, 780)
    if (passphrase.length < 8) throw new Error('Use at least 8 characters.')
    const groups = ['NMB4', 'K7Q2', 'XW9R', 'T3HP', 'L6ZD', 'M8VC', 'B2YN', 'J5SA']
    db.setup = { ...db.setup, passphraseSet: true, recoveryCode: groups.join('-'), step: 6 }
    persist()
    return { recoveryCode: groups.join('-') }
  },

  async setupComplete(): Promise<Session> {
    await latency(500, 900)
    db.session = {
      state: 'unlocked',
      telegram: {
        name: 'Vedant Dadhich',
        username: 'vedant_d',
        phone: db.setup.phone || '+91 98•••• ••42',
        premium: true,
        dc: 'DC4 · Amsterdam',
        sessionCreatedAt: now(),
      },
      version: '0.1.0 · frontend demo',
      passphraseChangedAt: now(),
    }
    db.setup = { ...db.setup, completed: true, step: 7 }
    persist()
    return db.session
  },

  async skipSetup(): Promise<Session> {
    await latency(120, 260)
    db.session = {
      state: 'unlocked',
      telegram: {
        name: 'Vedant Dadhich',
        username: 'vedant_d',
        phone: '+91 98•••• ••42',
        premium: true,
        dc: 'DC4 · Amsterdam',
        sessionCreatedAt: now(),
      },
      version: '0.1.0 · frontend demo',
      passphraseChangedAt: now(),
    }
    db.setup = { ...db.setup, completed: true, passphraseSet: true, step: 7 }
    persist()
    return db.session
  },

  async unlock(_passphrase: string): Promise<Session> {
    await latency(260, 520)
    db.session = { ...db.session, state: 'unlocked' }
    persist()
    return db.session
  },

  async unlockWithRecovery(code: string, _newPassphrase: string): Promise<Session> {
    await latency(420, 780)
    if (code.replace(/[^a-zA-Z0-9]/g, '').length < 12) {
      throw new Error('That recovery code is not complete. It has eight groups of four characters.')
    }
    db.session = { ...db.session, state: 'unlocked', passphraseChangedAt: now() }
    persist()
    return db.session
  },

  async lock(): Promise<Session> {
    await latency(80, 160)
    db.session = { ...db.session, state: 'locked' }
    persist()
    return db.session
  },

  async signOut(): Promise<Session> {
    await latency(300, 600)
    db.session = { state: 'needs_setup', telegram: null, version: '0.1.0 · frontend demo', passphraseChangedAt: null }
    db.setup = { step: 0, apiId: '', apiHash: '', phone: '', needsPassword: false, passphraseSet: false, recoveryCode: null, completed: false }
    persist()
    return db.session
  },

  async listFolder(folderId: string | null, sort: SortKey = 'name'): Promise<Listing> {
    await latency()
    const folder = folderId ? db.folders.find((f) => f.id === folderId) ?? null : null
    if (folderId && !folder) throw new Error('Folder not found')
    return {
      folder,
      path: pathOf(folderId),
      folders: db.folders
        .filter((f) => f.parentId === folderId)
        .map((f) => ({
          ...f,
          itemCount:
            liveFiles().filter((x) => x.folderId === f.id).length +
            db.folders.filter((x) => x.parentId === f.id).length,
        }))
        .sort((a, b) => collator.compare(a.name, b.name)),
      files: sortFiles(
        liveFiles().filter((f) => f.folderId === folderId),
        sort,
      ),
    }
  },

  async listFolders(): Promise<Folder[]> {
    await latency(50, 120)
    return db.folders
      .map((f) => ({ ...f, itemCount: db.folders.filter((x) => x.parentId === f.id).length }))
      .sort((a, b) => collator.compare(a.name, b.name))
  },

  async listRecent(): Promise<FileItem[]> {
    await latency()
    return [...liveFiles()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 32)
  },

  async getFile(id: string): Promise<FileItem> {
    await latency(60, 140)
    const file = db.files.find((f) => f.id === id)
    if (!file) throw new Error('File not found')
    return file
  },

  async createFolder(name: string, parentId: string | null): Promise<Folder> {
    await latency(140, 300)
    const folder: Folder = { id: uid('d'), name: name.trim(), parentId, createdAt: now() }
    if (!folder.name) throw new Error('Folder name cannot be empty.')
    db.folders = [...db.folders, folder]
    persist()
    return folder
  },

  async rename(id: string, name: string): Promise<void> {
    await latency(120, 260)
    const clean = name.trim()
    if (!clean) throw new Error('Name cannot be empty.')
    db.folders = db.folders.map((f) => (f.id === id ? { ...f, name: clean } : f))
    db.files = db.files.map((f) => (f.id === id ? { ...f, name: clean, updatedAt: now() } : f))
    persist()
  },

  async move(ids: string[], targetFolderId: string | null): Promise<void> {
    await latency(160, 320)
    for (const id of ids) {
      const folder = db.folders.find((f) => f.id === id)
      if (folder) {
        if (targetFolderId && descendants(id).has(targetFolderId)) {
          throw new Error('A folder cannot be moved inside itself.')
        }
        db.folders = db.folders.map((f) => (f.id === id ? { ...f, parentId: targetFolderId } : f))
      }
    }
    db.files = db.files.map((f) =>
      ids.includes(f.id) ? { ...f, folderId: targetFolderId, updatedAt: now() } : f,
    )
    persist()
  },

  async trash(ids: string[]): Promise<void> {
    await latency(160, 340)
    const stamp = now()
    const folderIds = new Set<string>()
    for (const id of ids) {
      if (db.folders.some((f) => f.id === id)) descendants(id).forEach((d) => folderIds.add(d))
    }
    db.files = db.files.map((f) =>
      ids.includes(f.id) || (f.folderId && folderIds.has(f.folderId))
        ? { ...f, deletedAt: stamp, folderId: folderIds.has(f.folderId ?? '') ? null : f.folderId }
        : f,
    )
    if (folderIds.size > 0) {
      db.folders = db.folders.filter((f) => !folderIds.has(f.id) || f.parentId === null)
    }
    persist()
  },

  async listTrash(): Promise<FileItem[]> {
    await latency()
    return db.files
      .filter((f) => f.deletedAt)
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  },

  async restore(ids: string[]): Promise<void> {
    await latency(140, 300)
    db.files = db.files.map((f) => (ids.includes(f.id) ? { ...f, deletedAt: null } : f))
    persist()
  },

  async deleteForever(ids: string[]): Promise<void> {
    await latency(200, 420)
    db.files = db.files.filter((f) => !ids.includes(f.id))
    persist()
  },

  async toggleStar(id: string): Promise<void> {
    await latency(70, 160)
    db.files = db.files.map((f) => (f.id === id ? { ...f, starred: !f.starred } : f))
    persist()
  },

  async getVersions(id: string): Promise<FileVersion[]> {
    await latency(60, 140)
    const file = db.files.find((f) => f.id === id)
    if (!file) throw new Error('File not found')
    return [...file.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async restoreVersion(id: string, versionId: string): Promise<void> {
    await latency(300, 600)
    db.files = db.files.map((f) =>
      f.id === id
        ? { ...f, updatedAt: now(), versions: f.versions.map((v) => ({ ...v, current: v.id === versionId })) }
        : f,
    )
    persist()
  },

  async search(query: string, scope: 'all' | 'documents' | 'images' | 'media', folderId: string | null): Promise<SearchResponse> {
    await latency(150, 320)
    return runSearch(query, scope, folderId)
  },

  async getStats(): Promise<StorageStats> {
    await latency(60, 160)
    return stats()
  },

  async getSettings(): Promise<Settings> {
    await latency(50, 120)
    return db.settings
  },

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    await latency(120, 240)
    db.settings = { ...db.settings, ...patch }
    persist()
    return db.settings
  },

  async getIntegrity(): Promise<IntegrityReport> {
    await latency(50, 120)
    return db.integrity
  },

  async runIntegrityCheck(): Promise<IntegrityReport> {
    db.integrity = { ...db.integrity, running: true }
    persist()
    await wait(1_700)
    const s = stats()
    db.integrity = {
      checkedAt: now(),
      partsChecked: s.partCount,
      partsOk: s.partCount,
      partsFailed: 0,
      blocksChecked: s.blockCount,
      durationMs: 3_900 + Math.round(Math.random() * 1_400),
      running: false,
    }
    persist()
    return db.integrity
  },

  async changePassphrase(_current: string, next: string): Promise<void> {
    await latency(500, 900)
    if (next.length < 8) throw new Error('Use at least 8 characters.')
    db.session = { ...db.session, passphraseChangedAt: now() }
    persist()
  },

  async revealRecoveryCode(): Promise<string> {
    await latency(160, 300)
    return db.setup.recoveryCode ?? 'NMB4-K7Q2-XW9R-T3HP-L6ZD-M8VC-B2YN-J5SA'
  },

  async createFileFromUpload(input: UploadInput): Promise<FileItem> {
    await latency(120, 240)
    const file = buildUploadedFile(input)
    db.files = [...db.files, file]
    persist()
    return file
  },

  async resetDemo(): Promise<void> {
    await wait(260)
    db = createDb()
    db.folders = SEED_FOLDERS
    persist()
  },
}
