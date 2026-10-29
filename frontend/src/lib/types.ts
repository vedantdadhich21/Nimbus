// The frontend's API contract. The mock adapter in lib/api-mock.ts implements
// this interface; lib/api-http.ts is the skeleton for the FastAPI backend.
// Keep docs/API_CONTRACT.md in sync with this file.

export type FileKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'code'
  | 'archive'
  | 'document'
  | 'sheet'
  | 'slide'
  | 'other'

export type Theme = 'dark' | 'light'
export type SortKey = 'name' | 'modified' | 'size' | 'kind'
export type ViewMode = 'grid' | 'list'

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  itemCount?: number
}

export interface PartInfo {
  index: number
  size: number
  messageId: number
  hash: string
}

export interface CompressionInfo {
  applied: boolean
  originalSize: number
  storedSize: number
  ratio: number | null
  policy: 'compress' | 'skip' | 'sampled'
  note: string
}

export interface EmbeddingInfo {
  kind: 'text' | 'image'
  model: string
  dim: number
  passages: number
}

export interface FileVersion {
  id: string
  label: string
  size: number
  createdAt: string
  current: boolean
}

export interface PreviewInfo {
  kind: 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'none'
  src?: string
  text?: string
}

export interface FileItem {
  id: string
  name: string
  kind: FileKind
  mime: string
  size: number
  folderId: string | null
  createdAt: string
  updatedAt: string
  compression: CompressionInfo
  encrypted: boolean
  partSize: number
  blockSize: number
  parts: PartInfo[]
  hash: string
  telegram: { chat: string; chatId: string; firstMessageId: number }
  embedding: EmbeddingInfo | null
  versions: FileVersion[]
  starred: boolean
  deletedAt: string | null
  preview: PreviewInfo
  thumbSeed: string
  topics: string[]
  snippet: string
}

export interface SearchHit {
  file: FileItem
  score: number
  semantic: number
  nameScore: number
  passage: string | null
}

export interface SearchResponse {
  hits: SearchHit[]
  tookMs: number
  mode: 'hybrid' | 'name'
  encodedMs: number
}

export interface TelegramAccount {
  name: string
  username: string
  phone: string
  premium: boolean
  dc: string
  sessionCreatedAt: string
}

export interface Session {
  state: 'needs_setup' | 'locked' | 'unlocked'
  telegram: TelegramAccount | null
  version: string
  passphraseChangedAt: string | null
}

export interface SetupState {
  step: number
  apiId: string
  apiHash: string
  phone: string
  needsPassword: boolean
  passphraseSet: boolean
  recoveryCode: string | null
  completed: boolean
}

export interface Listing {
  folder: Folder | null
  path: Folder[]
  folders: Folder[]
  files: FileItem[]
}

export interface StorageStats {
  usedBytes: number
  originalBytes: number
  savedBytes: number
  fileCount: number
  folderCount: number
  partCount: number
  blockCount: number
  trashCount: number
  byKind: { kind: FileKind; bytes: number; files: number }[]
  telegram: { chat: string; messages: number; perFileLimit: number }
}

export interface IntegrityReport {
  checkedAt: string
  partsChecked: number
  partsOk: number
  partsFailed: number
  blocksChecked: number
  durationMs: number
  running: boolean
}

export interface Settings {
  partSizeMiB: number
  blockSizeMiB: number
  compressionThresholdPct: number
  trashRetentionDays: number
  autoCompress: boolean
  scanOnUpload: boolean
}

export type UploadStage =
  | 'queued'
  | 'detect'
  | 'embed'
  | 'compress'
  | 'chunk'
  | 'encrypt'
  | 'upload'
  | 'done'

export interface UploadPart {
  index: number
  size: number
  uploaded: number
  status: 'pending' | 'active' | 'done'
}

export interface UploadTask {
  id: string
  name: string
  kind: FileKind
  size: number
  folderId: string | null
  stage: UploadStage
  stageProgress: number
  parts: UploadPart[]
  status: 'queued' | 'running' | 'paused' | 'waiting' | 'error' | 'done' | 'cancelled'
  speedBps: number
  note: string | null
  waitSeconds: number | null
  createdAt: number
  compressionRatio: number | null
  fileId: string | null
  /** Set at creation for demo tasks that should hit a Telegram flood-wait. */
  floodPending?: boolean
}

export interface UploadInput {
  name: string
  size: number
  folderId: string | null
  kind: FileKind
  compressionRatio: number | null
}

export interface Db {
  version: number
  session: Session
  setup: SetupState
  folders: Folder[]
  files: FileItem[]
  settings: Settings
  integrity: IntegrityReport
}

export interface NimbusApi {
  getSession(): Promise<Session>
  setupCredentials(apiId: string, apiHash: string): Promise<SetupState>
  setupPhone(phone: string): Promise<SetupState>
  setupCode(code: string): Promise<{ needsPassword: boolean; step: number }>
  setupPassword(password: string): Promise<SetupState>
  setupPassphrase(passphrase: string): Promise<{ recoveryCode: string }>
  setupComplete(): Promise<Session>
  /** Demo affordance: finish setup with the seeded account and skip the wizard. */
  skipSetup(): Promise<Session>
  unlock(passphrase: string): Promise<Session>
  unlockWithRecovery(code: string, newPassphrase: string): Promise<Session>
  lock(): Promise<Session>
  signOut(): Promise<Session>

  getSetupState(): Promise<SetupState>
  listFolder(folderId: string | null, sort?: SortKey): Promise<Listing>
  listFolders(): Promise<Folder[]>
  listRecent(): Promise<FileItem[]>
  getFile(id: string): Promise<FileItem>
  createFolder(name: string, parentId: string | null): Promise<Folder>
  rename(id: string, name: string): Promise<void>
  move(ids: string[], targetFolderId: string | null): Promise<void>
  trash(ids: string[]): Promise<void>
  listTrash(): Promise<FileItem[]>
  restore(ids: string[]): Promise<void>
  deleteForever(ids: string[]): Promise<void>
  toggleStar(id: string): Promise<void>
  getVersions(id: string): Promise<FileVersion[]>
  restoreVersion(id: string, versionId: string): Promise<void>

  search(query: string, scope: 'all' | 'documents' | 'images' | 'media', folderId: string | null): Promise<SearchResponse>
  getStats(): Promise<StorageStats>
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  getIntegrity(): Promise<IntegrityReport>
  runIntegrityCheck(): Promise<IntegrityReport>
  changePassphrase(current: string, next: string): Promise<void>
  revealRecoveryCode(): Promise<string>

  createFileFromUpload(input: UploadInput): Promise<FileItem>
  resetDemo(): Promise<void>
}
