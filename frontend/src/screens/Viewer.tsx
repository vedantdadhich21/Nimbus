import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileWarning,
  Maximize2,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { FileItem } from '@/lib/types'
import { KIND_LABEL, bytes, compressionLabel, cx, num, relTime, stamp } from '@/lib/format'
import { Badge, Button, EmptyState, IconButton, Label, Spinner, useToast } from '@/components/ui'
import { Thumb } from '@/components/Thumb'

function SpecRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="spec-row">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">{label}</span>
      <span className={cx('text-right text-[11.5px] text-ink', mono && 'font-mono text-[10.5px]')}>{value}</span>
    </div>
  )
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

/** pdf.js needs its worker; Vite's ?worker import bundles it correctly. */
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const { default: PdfWorker } = await import('@/lib/pdf-worker?worker')
      pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
      return pdfjs
    })()
  }
  return pdfjsPromise
}

function PdfPreview({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const renderRef = useRef<RenderTask | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState(false)
  // Zoom is a multiplier of the fit-width scale: 1 means exactly fit.
  const [zoom, setZoom] = useState(1)
  const [scalePct, setScalePct] = useState<number | null>(null)
  const [frameWidth, setFrameWidth] = useState(0)

  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    ;(async () => {
      try {
        const pdfjs = await loadPdfjs()
        loaded = await pdfjs.getDocument({ url: src }).promise
        if (cancelled) return void loaded.destroy()
        setDoc(loaded)
      } catch (err) {
        const detail = err as { name?: string; message?: string; details?: string }
        console.error('[nimbus] pdf preview failed', detail?.name, detail?.message, detail?.details)
        if (!cancelled) setError(detail?.details || detail?.message || 'The PDF could not be parsed.')
      }
    })()
    return () => {
      cancelled = true
      renderRef.current?.cancel()
      void loaded?.destroy()
      setDoc(null)
      setPage(1)
      setRendered(false)
    }
  }, [src])

  // Measure the available width so "fit" is a real fit, not a fixed page size.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width))
    observer.observe(frame)
    setFrameWidth(frame.clientWidth)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!doc) return
    let cancelled = false
    setRendered(false)
    ;(async () => {
      const pdfPage = await doc.getPage(page)
      if (cancelled) return
      const base = pdfPage.getViewport({ scale: 1 })
      const available = Math.max(240, (frameWidth || 620) - 2)
      const fitScale = available / base.width
      const scale = Math.min(fitScale * zoom, Math.max(fitScale * 4, 1))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = pdfPage.getViewport({ scale: scale * dpr })
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context || cancelled) return

      renderRef.current?.cancel()
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${Math.floor(base.width * scale)}px`
      canvas.style.height = `${Math.floor(base.height * scale)}px`

      const task = pdfPage.render({ canvasContext: context, viewport })
      renderRef.current = task
      try {
        await task.promise
        if (!cancelled) {
          setScalePct(Math.round(scale * 100))
          setRendered(true)
        }
      } catch (err) {
        const name = (err as { name?: string }).name
        if (name !== 'RenderingCancelledException') {
          console.error('[nimbus] pdf page render failed', err)
          if (!cancelled) setError((err as { message?: string }).message || 'This page could not be drawn.')
        }
      }
    })()
    return () => {
      cancelled = true
      renderRef.current?.cancel()
    }
  }, [doc, page, zoom, frameWidth])

  useEffect(() => {
    const total = doc?.numPages ?? 0
    if (!total) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        setPage((current) => Math.min(total, current + 1))
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        setPage((current) => Math.max(1, current - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc])

  if (error) {
    return <EmptyState title="This PDF would not open." body={error} icon={<FileWarning className="size-6" />} />
  }

  const step = (delta: number) => setZoom((current) => Math.min(4, Math.max(0.5, current + delta)))

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
          pdf.js · rendered locally · {zoom === 1 ? 'fit width' : `${scalePct ?? 100}%`}
        </span>
        <div className="flex items-center gap-2">
          {doc && (
            <div className="flex items-center gap-2 border border-line px-1.5 py-1">
              <IconButton label="Previous page" className="size-6" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="size-3.5" />
              </IconButton>
              <span className="min-w-[72px] text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                page {page} / {doc.numPages}
              </span>
              <IconButton
                label="Next page"
                className="size-6"
                disabled={page >= doc.numPages}
                onClick={() => setPage((p) => Math.min(doc.numPages, p + 1))}
              >
                <ChevronRight className="size-3.5" />
              </IconButton>
            </div>
          )}
          <div className="flex items-center gap-1 border border-line px-1 py-1">
            <IconButton label="Zoom out" className="size-6" onClick={() => step(-0.25)}>
              <Minus className="size-3.5" />
            </IconButton>
            <IconButton label="Zoom to fit" className="size-6" onClick={() => setZoom(1)}>
              <Maximize2 className="size-3.5" />
            </IconButton>
            <IconButton label="Zoom in" className="size-6" onClick={() => step(0.25)}>
              <Plus className="size-3.5" />
            </IconButton>
          </div>
        </div>
      </div>

      <div ref={frameRef} className="min-h-0 w-full flex-1 overflow-auto">
        <div className="relative mx-auto w-max border border-line bg-white">
          {(!doc || !rendered) && (
            <div className="absolute inset-0 grid place-items-center">
              <Spinner className="size-5 text-muted" />
            </div>
          )}
          <canvas ref={canvasRef} className={cx('block', !rendered && 'opacity-0')} />
          {!doc && <div className="h-[420px] w-[320px]" />}
        </div>
      </div>
    </div>
  )
}

function TextPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="min-h-0 w-full flex-1 overflow-auto border border-line bg-paper">
      <div className="flex min-w-max">
        <div className="shrink-0 border-r border-line bg-sunken px-3 py-4 text-right font-mono text-[10px] leading-[1.7] text-faint select-none">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <pre className="px-4 py-4 font-mono text-[11.5px] leading-[1.7] whitespace-pre text-ink">{text}</pre>
      </div>
    </div>
  )
}

function pickDemoPdf(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('dbms')) return '/demo/dbms-unit3.pdf'
  if (lower.includes('operating') || lower.includes('os')) return '/demo/os-unit4.pdf'
  if (lower.includes('resume')) return '/demo/resume.pdf'
  if (lower.includes('syllabus')) return '/demo/syllabus.pdf'
  return '/demo/research-note.pdf'
}

function Body({ file }: { file: FileItem }) {
  const preview = file.preview.kind === 'none' && file.kind === 'pdf'
    ? { kind: 'pdf' as const, src: pickDemoPdf(file.name) }
    : file.preview.kind === 'none' && file.kind === 'video'
      ? { kind: 'video' as const, src: '/demo/lecture-clip.mp4' }
      : file.preview.kind === 'none' && file.kind === 'audio'
        ? { kind: 'audio' as const, src: '/demo/voice-memo.wav' }
        : file.preview.kind === 'none' && file.kind === 'image'
          ? { kind: 'image' as const }
          : file.preview

  if (preview.kind === 'pdf' && preview.src) return <PdfPreview src={preview.src} />

  if (preview.kind === 'image') {
    return (
      <div className="m-auto w-full max-w-[720px]">
        <div className="flex aspect-[4/3] items-center justify-center border border-line">
          <Thumb file={file} detail />
        </div>
        <p className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
          <span>fit · no download required</span>
          <span>{file.mime}</span>
        </p>
      </div>
    )
  }

  if (preview.kind === 'video' && preview.src) {
    return (
      <div className="m-auto w-full max-w-[820px]">
        <video
          controls
          preload="metadata"
          className="w-full border border-line bg-black"
          src={preview.src}
          poster=""
        />
        <p className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
          <span>http range · 1 mib blocks · seek without full download</span>
          <span>h.264</span>
        </p>
      </div>
    )
  }

  if (preview.kind === 'audio' && preview.src) {
    return (
      <div className="m-auto w-full max-w-[520px] border border-line p-4">
        <div className="mb-4 aspect-[16/7] border border-line">
          <Thumb file={file} />
        </div>
        <audio controls className="w-full" src={preview.src} />
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
          streamed from local cache · waveform generated
        </p>
      </div>
    )
  }

  if (preview.kind === 'text' && preview.text) return <TextPreview text={preview.text} />

  return (
    <div className="m-auto">
    <EmptyState
      title="No inline preview."
      body={
        file.name.toLowerCase().endsWith('.svg')
          ? 'SVG and HTML are never rendered inline: they can carry script. The file is served as a download with content-type sniffing disabled.'
          : 'This format is stored and verifiable, but Nimbus has no safe inline viewer for it. Previewing parses untrusted bytes, so only a small set of types is decoded — in an isolated container in the real deployment.'
      }
      icon={<FileWarning className="size-7" strokeWidth={1.2} />}
      action={<Button variant="primary">Download original</Button>}
    />
    </div>
  )
}

export function ViewerScreen() {
  const { fileId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: file, isLoading } = useQuery({
    queryKey: ['file', fileId],
    queryFn: () => api.getFile(fileId!),
    enabled: Boolean(fileId),
  })

  const { data: siblings } = useQuery({
    queryKey: ['siblings', file?.folderId ?? 'root'],
    queryFn: () => api.listFolder(file?.folderId ?? null),
    enabled: Boolean(file),
  })

  const { data: versions = [] } = useQuery({
    queryKey: ['versions', file?.id],
    queryFn: () => api.getVersions(file!.id),
    enabled: Boolean(file),
  })

  const restore = useMutation({
    mutationFn: (versionId: string) => api.restoreVersion(file!.id, versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Version restored' })
    },
  })

  const index = siblings?.files.findIndex((f) => f.id === file?.id) ?? -1
  const prev = index > 0 ? siblings?.files[index - 1] : undefined
  const next = index >= 0 ? siblings?.files[index + 1] : undefined

  const paged = file?.preview.kind === 'pdf'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate(-1)
      // Inside a document the arrows belong to the document, not to file paging.
      if (paged) return
      if (event.key === 'ArrowLeft' && prev) navigate(`/file/${prev.id}`)
      if (event.key === 'ArrowRight' && next) navigate(`/file/${next.id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, prev, next, paged])

  if (isLoading || !file) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-ink">{file.name}</p>
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
            <span>{KIND_LABEL[file.kind]}</span>
            <span className="text-line-strong">/</span>
            <span>{bytes(file.size)}</span>
            <span className="text-line-strong">/</span>
            <span>{index >= 0 ? `${index + 1} of ${siblings?.files.length ?? 1}` : '1 of 1'}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton label="Previous file" disabled={!prev} onClick={() => prev && navigate(`/file/${prev.id}`)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <IconButton label="Next file" disabled={!next} onClick={() => next && navigate(`/file/${next.id}`)}>
            <ChevronRight className="size-4" />
          </IconButton>
          <Button
            size="sm"
            onClick={() =>
              toast({
                title: 'Download',
                body: 'The mock adapter has no byte stream; the range-capable route is documented in docs/API_CONTRACT.md.',
              })
            }
          >
            <Download className="size-3.5" />
            Download
          </Button>
          <IconButton label="Close preview" onClick={() => navigate(-1)}>
            <X className="size-4" />
          </IconButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-h-0 flex-1 flex-col overflow-auto bg-sunken p-5">
          <Body file={file} />
        </section>

        <aside className="hidden w-[330px] shrink-0 overflow-y-auto border-l border-line bg-paper md:block">
          <div className="border-b border-line px-4 py-3">
            <Label className="mb-1 block">File</Label>
            <p className="flex flex-wrap items-center gap-1.5">
              <Badge tone="solid">encrypted</Badge>
              {file.compression.applied ? <Badge>zstd · {compressionLabel(file.compression)}</Badge> : <Badge>not compressed</Badge>}
              {file.starred && <Badge>starred</Badge>}
            </p>
          </div>

          <div className="px-4 py-2">
            <SpecRow label="Size" value={bytes(file.size)} />
            <SpecRow label="Stored" value={bytes(file.compression.storedSize)} />
            <SpecRow label="Parts" value={`${file.parts.length} × 100 MiB`} />
            <SpecRow label="Blocks" value={num(Math.ceil(file.size / file.blockSize))} />
            <SpecRow label="Block size" value="1 MiB" />
            <SpecRow label="Uploaded" value={stamp(file.createdAt)} />
            <SpecRow label="Modified" value={relTime(file.updatedAt)} />
            <div className="spec-row">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">SHA-256</span>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(file.hash)
                  toast({ title: 'Hash copied' })
                }}
                className="flex items-center gap-1.5 font-mono text-[10px] text-ink hover:underline"
              >
                {file.hash.slice(0, 12)}… <Copy className="size-3" />
              </button>
            </div>
          </div>

          <div className="px-4 py-3">
            <Label className="mb-1 block">Telegram</Label>
            <SpecRow label="Chat" value={file.telegram.chat} mono={false} />
            <SpecRow label="First message" value={`#${file.telegram.firstMessageId}`} />
            <SpecRow
              label="Part ids"
              value={
                file.parts
                  .slice(0, 3)
                  .map((p) => `#${p.messageId}`)
                  .join(' ') + (file.parts.length > 3 ? ` +${file.parts.length - 3}` : '')
              }
            />
            <SpecRow label="Nonce" value="position + prefix" />
          </div>

          <div className="px-4 py-3">
            <Label className="mb-1 block">Intelligence</Label>
            {file.embedding ? (
              <>
                <SpecRow label="Model" value={file.embedding.model} />
                <SpecRow label="Vector" value={`${file.embedding.dim}-d`} />
                <SpecRow label="Passages" value={String(file.embedding.passages)} />
              </>
            ) : (
              <p className="py-2 text-[11.5px] leading-relaxed text-muted">
                No embedding: this type has no extractable text and is not an image. It is found by name and folder.
              </p>
            )}
          </div>

          <div className="px-4 py-3">
            <Label className="mb-1 block">Versions</Label>
            {versions.map((version) => (
              <div key={version.id} className="flex items-center gap-2 border-b border-line py-1.5 last:border-b-0">
                <span className="font-mono text-[10px] text-ink">{version.label}</span>
                {version.current ? (
                  <Badge tone="solid">current</Badge>
                ) : (
                  <button
                    onClick={() => restore.mutate(version.id)}
                    className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted hover:text-ink"
                  >
                    restore
                  </button>
                )}
                <span className="ml-auto font-mono text-[9px] text-faint">{relTime(version.createdAt)}</span>
              </div>
            ))}
            {versions.length <= 1 && (
              <p className="py-1 text-[11.5px] text-muted">Only one version. New uploads never overwrite.</p>
            )}
          </div>

          <div className="border-t border-line px-4 py-3">
            <Label className="mb-1 block">Pipeline</Label>
            <p className="text-[11px] leading-relaxed text-muted">{file.compression.note}</p>
            <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-faint">
              decrypt → verify tag → decompress → stream
              <br />
              seeking maps bytes to blocks
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
