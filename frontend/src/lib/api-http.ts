import type {
  FileItem,
  FileVersion,
  Folder,
  IntegrityReport,
  Listing,
  NimbusApi,
  SearchResponse,
  Session,
  Settings,
  SetupState,
  SortKey,
  StorageStats,
  UploadInput,
} from './types'

// Skeleton adapter for the FastAPI backend described in docs/API_CONTRACT.md.
// It mirrors the mock exactly; it has NOT been exercised against a live server.
// Enable with VITE_API_MODE=http once backend routes exist.

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })

const del = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) })

export const httpApi: NimbusApi = {
  getSession: () => request<Session>('/session'),
  getSetupState: () => request<SetupState>('/setup'),
  setupCredentials: (apiId, apiHash) => post<SetupState>('/setup/telegram/credentials', { apiId, apiHash }),
  setupPhone: (phone) => post<SetupState>('/setup/telegram/phone', { phone }),
  setupCode: (code) => post<{ needsPassword: boolean; step: number }>('/setup/telegram/code', { code }),
  setupPassword: (password) => post<SetupState>('/setup/telegram/password', { password }),
  setupPassphrase: (passphrase) => post<{ recoveryCode: string }>('/setup/passphrase', { passphrase }),
  setupComplete: () => post<Session>('/setup/complete'),
  skipSetup: () => post<Session>('/setup/skip'),
  unlock: (passphrase) => post<Session>('/unlock', { passphrase }),
  unlockWithRecovery: (code, newPassphrase) => post<Session>('/unlock/recovery', { code, newPassphrase }),
  lock: () => post<Session>('/lock'),
  signOut: () => post<Session>('/signout'),

  listFolder: (folderId: string | null, sort: SortKey = 'name') =>
    request<Listing>(`/folders/${folderId ?? 'root'}?sort=${sort}`),
  listFolders: () => request<Folder[]>('/folders'),
  listRecent: () => request<FileItem[]>('/recent'),
  getFile: (id) => request<FileItem>(`/files/${id}`),
  createFolder: (name, parentId) => post<Folder>('/folders', { name, parentId }),
  rename: (id, name) => patch<void>(`/nodes/${id}`, { name }),
  move: (ids, targetFolderId) => post<void>('/nodes/move', { ids, targetFolderId }),
  trash: (ids) => post<void>('/nodes/trash', { ids }),
  listTrash: () => request<FileItem[]>('/trash'),
  restore: (ids) => post<void>('/trash/restore', { ids }),
  deleteForever: (ids) => del<void>('/trash', { ids }),
  toggleStar: (id) => post<void>(`/files/${id}/star`),
  getVersions: (id) => request<FileVersion[]>(`/files/${id}/versions`),
  restoreVersion: (id, versionId) => post<void>(`/files/${id}/versions/${versionId}/restore`),

  search: (query, scope, folderId) =>
    request<SearchResponse>(
      `/search?q=${encodeURIComponent(query)}&scope=${scope}${folderId ? `&folderId=${folderId}` : ''}`,
    ),
  getStats: () => request<StorageStats>('/stats'),
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (patchBody) => patch<Settings>('/settings', patchBody),
  getIntegrity: () => request<IntegrityReport>('/integrity'),
  runIntegrityCheck: () => post<IntegrityReport>('/integrity/run'),
  changePassphrase: (current, next) => post<void>('/security/passphrase', { current, next }),
  revealRecoveryCode: () => request<{ code: string }>('/security/recovery').then((r) => r.code),

  createFileFromUpload: (input: UploadInput) => post<FileItem>('/uploads/commit', input),
  resetDemo: () => post<void>('/demo/reset'),
}
