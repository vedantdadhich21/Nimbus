import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { FileItem, FileKind, UploadStage, UploadTask } from './types'
import { api } from './api'
import { clamp, kindForName, uid } from './format'
import { useToast } from '@/components/ui'
import { registerUploadedBlob } from './blobs'
import { getDb, saveDb } from './api-mock'

const TICK = 150
const MiB = 1024 * 1024

export const STAGES: { id: Exclude<UploadStage, 'queued' | 'done'>; label: string; hint: string }[] = [
  { id: 'detect', label: 'Detect', hint: 'Extension and magic bytes' },
  { id: 'embed', label: 'Embed', hint: 'Local text / image embedding' },
  { id: 'compress', label: 'Compress', hint: 'zstd, only if it pays off' },
  { id: 'chunk', label: 'Chunk', hint: 'Storage parts and 1 MiB blocks' },
  { id: 'encrypt', label: 'Encrypt', hint: 'AES-256-GCM, nonce per block' },
  { id: 'upload', label: 'Upload', hint: 'MTProto, queued with back-off' },
]

const ORDER = STAGES.map((s) => s.id)

const committed = new Set<string>()

function ratioForKind(kind: FileKind): number | null {
  if (kind === 'text' || kind === 'code') return 3.4
  if (kind === 'pdf' || kind === 'document' || kind === 'sheet' || kind === 'slide') return 1.32
  return 1
}

const taskFiles = new Map<string, File>()

function makeTask(
  name: string,
  size: number,
  folderId: string | null,
  flood: boolean,
  file?: File,
): UploadTask {
  const kind = kindForName(name)
  const partCount = Math.max(1, Math.min(60, Math.ceil(size / (100 * MiB))))
  const per = Math.max(1, Math.round(size / partCount))
  const id = uid('u')
  if (file) taskFiles.set(id, file)
  return {
    id,
    name,
    kind,
    size,
    folderId,
    stage: 'detect',
    stageProgress: 0,
    parts: Array.from({ length: partCount }, (_, i) => ({
      index: i,
      size: per,
      uploaded: 0,
      status: 'pending',
    })),
    status: 'running',
    speedBps: 0,
    note: null,
    waitSeconds: null,
    createdAt: Date.now(),
    compressionRatio: ratioForKind(kind),
    fileId: null,
    floodPending: flood,
  }
}

function stageDuration(task: UploadTask, stage: UploadStage): number {
  switch (stage) {
    case 'detect':
      return 620
    case 'embed':
      return task.kind === 'archive' ? 420 : 1_150
    case 'compress':
      return (task.compressionRatio ?? 1) > 1.05 ? 980 : 320
    case 'chunk':
      return 520
    case 'encrypt':
      return 900
    case 'upload':
      return clamp((task.size / 7_000_000) * 1_000, 2_400, 8_000)
    default:
      return 300
  }
}

function advanceTask(task: UploadTask, dt: number): UploadTask {
  if (task.status === 'paused' || task.status === 'error' || task.status === 'done' || task.status === 'cancelled') {
    return task
  }

  if (task.status === 'waiting') {
    const left = (task.waitSeconds ?? 0) - dt / 1000
    if (left > 0) return { ...task, waitSeconds: left, speedBps: 0 }
    return {
      ...task,
      status: 'running',
      waitSeconds: null,
      note: 'resumed after flood-wait',
      speedBps: 0,
    }
  }

  const index = ORDER.indexOf(task.stage as (typeof ORDER)[number])
  if (index === -1) return task

  const stage = ORDER[index]
  const duration = stageDuration(task, stage)
  let progress = task.stageProgress + dt / duration
  let stageIndex = index
  let status: UploadTask['status'] = task.status

  if (progress >= 1) {
    if (stage === 'upload') {
      return {
        ...task,
        stage: 'done',
        stageProgress: 1,
        status: 'done',
        speedBps: 0,
        note: null,
        parts: task.parts.map((p) => ({ ...p, uploaded: p.size, status: 'done' })),
      }
    }
    stageIndex = index + 1
    progress = 0
  }

  const nextStage = ORDER[stageIndex]

  if (nextStage === 'upload' && stage === 'encrypt' && task.floodPending) {
    return {
      ...task,
      stage: 'upload',
      stageProgress: 0,
      status: 'waiting',
      waitSeconds: 6,
      floodPending: false,
      note: 'Telegram asked us to wait 6 s (FLOOD_WAIT_6)',
      speedBps: 0,
    }
  }

  const parts =
    nextStage === 'upload'
      ? task.parts.map((p) => {
          const share = (p.index + 1) / task.parts.length
          const donePart = progress >= share
          const active = !donePart && progress > p.index / task.parts.length
          return {
            ...p,
            uploaded: donePart ? p.size : active ? Math.round((progress * task.parts.length - p.index) * p.size) : 0,
            status: (donePart ? 'done' : active ? 'active' : 'pending') as 'done' | 'active' | 'pending',
          }
        })
      : task.parts

  const speed =
    nextStage === 'upload'
      ? Math.round((task.size / stageDuration(task, 'upload')) * 1000)
      : 0

  return {
    ...task,
    stage: nextStage,
    stageProgress: clamp(progress, 0, 1),
    status,
    parts,
    speedBps: status === 'running' ? speed : 0,
    note: status === 'running' && stage === 'upload' ? null : task.note,
  }
}

export function taskProgress(task: UploadTask): number {
  if (task.status === 'done') return 1
  const index = ORDER.indexOf(task.stage as (typeof ORDER)[number])
  if (index === -1) return 0
  return clamp((index + task.stageProgress) / ORDER.length, 0, 1)
}

interface UploadQueueValue {
  tasks: UploadTask[]
  addFiles: (files: File[], folderId: string | null) => void
  addSynthetic: (folderId: string | null) => void
  pause: (id: string) => void
  resume: (id: string) => void
  cancel: (id: string) => void
  retry: (id: string) => void
  clearDone: () => void
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  counts: { active: number; done: number; total: number }
}

/**
 * Keep the real bytes of an uploaded file available for previewing. A File
 * cannot be persisted, so images, video, PDFs and audio are read into data
 * URLs in the shared blob store; text and code are small enough to stay
 * inline. The stored record only names the preview type, never the bytes.
 */
function storeUploadedContent(file: FileItem, original: File, done: () => void) {
  const finish = (preview: FileItem['preview']) => {
    file.preview = preview
    const db = getDb()
    const stored = db.files.find((item) => item.id === file.id)
    if (stored) stored.preview = preview
    saveDb(db)
    done()
  }

  if (file.kind === 'text' || file.kind === 'code') {
    const reader = new FileReader()
    reader.onload = () => finish({ kind: 'text', text: reader.result as string })
    reader.readAsText(original)
    return
  }

  const kind = file.kind
  if (kind !== 'image' && kind !== 'video' && kind !== 'pdf' && kind !== 'audio') {
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const url = reader.result as string
    registerUploadedBlob(file.id, url)
    // The viewer and thumbnails read the URL from the blob store, so the
    // record only needs to carry the type.
    finish({ kind })
  }
  reader.readAsDataURL(original)
}

const UploadContext = createContext<UploadQueueValue | null>(null)

export function UploadProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const created = useRef(0)
  const queryClient = useQueryClient()
  const toast = useToast()

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTasks((prev) => prev.map((task) => advanceTask(task, TICK)))
    }, TICK)
    return () => window.clearInterval(timer)
  }, [])

  const commit = useCallback(
    async (task: UploadTask) => {
      try {
        const file = await api.createFileFromUpload({
          name: task.name,
          size: task.size,
          folderId: task.folderId,
          kind: task.kind,
          compressionRatio: task.compressionRatio,
        })
        const original = taskFiles.get(task.id)
        if (original) {
          storeUploadedContent(file, original, () => {
            void queryClient.invalidateQueries()
          })
        }
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, fileId: file.id } : t)))
        await queryClient.invalidateQueries()
        toast({
          title: 'Stored on Telegram',
          body: `${file.parts.length} part${file.parts.length === 1 ? '' : 's'} · AES-256-GCM · hash verified`,
        })
      } catch (error) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: 'error', note: error instanceof Error ? error.message : 'upload failed' }
              : t,
          ),
        )
      }
    },
    [queryClient, toast],
  )

  useEffect(() => {
    for (const task of tasks) {
      if (task.status === 'done' && !committed.has(task.id)) {
        committed.add(task.id)
        void commit(task)
      }
    }
  }, [tasks, commit])

  const addFiles = useCallback((files: File[], folderId: string | null) => {
    if (files.length === 0) return
    const next = files.map((file) => {
      created.current += 1
      return makeTask(file.name, file.size || 1_240_000, folderId, created.current % 3 === 0, file)
    })
    setTasks((prev) => [...next, ...prev])
    setCollapsed(false)
  }, [])

  const addSynthetic = useCallback(
    (folderId: string | null) => {
      created.current += 1
      const name = `seminar-recording-${String(created.current).padStart(2, '0')}.mp4`
      setTasks((prev) => [makeTask(name, 218 * MiB, folderId, created.current % 3 === 0), ...prev])
      setCollapsed(false)
    },
    [],
  )

  const pause = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'paused', note: 'paused by user' } : t)))
  }, [])

  const resume = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'running', note: null } : t)))
  }, [])

  const cancel = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'cancelled', note: 'cancelled', speedBps: 0 } : t)),
    )
  }, [])

  const retry = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: 'running', stage: 'upload', stageProgress: 0, note: 'retrying the failed parts', waitSeconds: null }
          : t,
      ),
    )
  }, [])

  const clearDone = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'done' && t.status !== 'cancelled'))
  }, [])

  const counts = useMemo(() => {
    const active = tasks.filter((t) => ['running', 'waiting', 'queued', 'paused'].includes(t.status)).length
    const done = tasks.filter((t) => t.status === 'done').length
    return { active, done, total: tasks.length }
  }, [tasks])

  const value = useMemo(
    () => ({ tasks, addFiles, addSynthetic, pause, resume, cancel, retry, clearDone, collapsed, setCollapsed, counts }),
    [tasks, addFiles, addSynthetic, pause, resume, cancel, retry, clearDone, collapsed, counts],
  )

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}

export function useUploads(): UploadQueueValue {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUploads must be used inside UploadProvider')
  return ctx
}
