import type { CompressionInfo, FileKind } from './types'

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ')

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function bytes(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : digits)} ${units[i]}`
}

export function num(n: number): string {
  return n.toLocaleString('en-IN')
}

export function relTime(iso: string, now = Date.now()): string {
  const then = new Date(iso)
  const diff = Math.max(0, now - then.getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`

  // Calendar days, not 24-hour blocks: a file from 21:00 yesterday is
  // "yesterday" even at 00:30 today.
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.round((startOf(new Date(now)) - startOf(then)) / 86_400_000)
  if (dayDiff === 0) return `${Math.floor(min / 60)} h ago`
  if (dayDiff === 1) return 'yesterday'
  if (dayDiff < 30) return `${dayDiff} d ago`
  return shortDate(iso)
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function stamp(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export function daysBetween(a: string, b = new Date().toISOString()): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export function ext(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

export const KIND_LABEL: Record<FileKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  text: 'Text',
  code: 'Code',
  archive: 'Archive',
  document: 'Document',
  sheet: 'Sheet',
  slide: 'Slides',
  other: 'File',
}

export function kindForName(name: string): FileKind {
  const e = ext(name)
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'avif', 'bmp', 'svg'].includes(e)) return 'image'
  if (['mp4', 'mkv', 'mov', 'webm', 'avi'].includes(e)) return 'video'
  if (['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'].includes(e)) return 'audio'
  if (e === 'pdf') return 'pdf'
  if (['txt', 'md', 'log', 'csv', 'rtf'].includes(e)) return 'text'
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'c', 'cpp', 'h', 'java', 'sql', 'json', 'sh', 'yml', 'yaml', 'css', 'html'].includes(e)) return 'code'
  if (['zip', '7z', 'gz', 'tar', 'rar', 'iso'].includes(e)) return 'archive'
  if (['doc', 'docx', 'odt'].includes(e)) return 'document'
  if (['xls', 'xlsx', 'ods'].includes(e)) return 'sheet'
  if (['ppt', 'pptx', 'odp', 'key'].includes(e)) return 'slide'
  return 'other'
}

export function mimeForKind(kind: FileKind): string {
  const map: Record<FileKind, string> = {
    image: 'image/jpeg',
    video: 'video/mp4',
    audio: 'audio/mpeg',
    pdf: 'application/pdf',
    text: 'text/plain',
    code: 'text/plain',
    archive: 'application/zip',
    document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    slide: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    other: 'application/octet-stream',
  }
  return map[kind]
}

export function compressionLabel(c: CompressionInfo): string {
  if (!c.applied || c.ratio === null) return 'not compressed'
  return `${Math.round((1 - 1 / c.ratio) * 100)}% smaller`
}

export function ratioValue(c: CompressionInfo): number {
  return c.ratio ?? 1
}

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

/** Deterministic pseudo-random numbers from a string, so thumbnails are stable. */
export function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hex(seed: string, length = 32): string {
  const rand = seeded(seed)
  let out = ''
  while (out.length < length) out += Math.floor(rand() * 16).toString(16)
  return out.slice(0, length)
}

export function pluralize(n: number, word: string): string {
  return `${num(n)} ${word}${n === 1 ? '' : 's'}`
}
