import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Folder as FolderIcon, HardDrive, History, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import type { FileItem, Folder } from '@/lib/types'
import { cx, stamp } from '@/lib/format'
import { Badge, Button, Field, Modal, Spinner, TextInput, useToast } from '@/components/ui'

export function PromptDialog({
  open,
  onClose,
  title,
  eyebrow,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Save',
  hint,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  label: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  hint?: string
  onSubmit: (value: string) => Promise<unknown>
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setError(null)
    }
  }, [open, initialValue])

  const mutation = useMutation({
    mutationFn: () => onSubmit(value.trim()),
    onSuccess: () => onClose(),
    onError: (err) => setError(err instanceof Error ? err.message : 'Something went wrong.'),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || value.trim().length === 0}
          >
            {mutation.isPending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label} hint={hint} error={error}>
        <TextInput
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim()) mutation.mutate()
          }}
        />
      </Field>
    </Modal>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  eyebrow,
  body,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  body: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => Promise<unknown>
}) {
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: onConfirm,
    onSuccess: () => onClose(),
    onError: (err) => setError(err instanceof Error ? err.message : 'Something went wrong.'),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] leading-relaxed text-muted">{body}</p>
      {error && <p className="mt-3 font-mono text-[10px] text-alert">{error}</p>}
    </Modal>
  )
}

export function MoveDialog({
  open,
  onClose,
  ids,
  currentFolderId,
  onDone,
}: {
  open: boolean
  onClose: () => void
  ids: string[]
  currentFolderId: string | null
  onDone: () => void
}) {
  const [target, setTarget] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.listFolders(),
    enabled: open,
  })

  useEffect(() => {
    if (open) setTarget(currentFolderId)
  }, [open, currentFolderId])

  const move = useMutation({
    mutationFn: () => api.move(ids, target),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Moved', body: `${ids.length} item${ids.length === 1 ? '' : 's'} moved.` })
      onDone()
      onClose()
    },
    onError: (err) =>
      toast({ title: 'Move failed', body: err instanceof Error ? err.message : 'Unknown error', tone: 'alert' }),
  })

  const roots = folders.filter((f) => f.parentId === null)

  const renderTree = (parentId: string | null, depth: number): React.ReactNode =>
    folders
      .filter((f) => f.parentId === parentId)
      .map((folder) => (
        <div key={folder.id}>
          <button
            onClick={() => setTarget(folder.id)}
            style={{ paddingLeft: 12 + depth * 16 }}
            className={cx(
              'flex h-8 w-full items-center gap-2 pr-3 text-left text-[12px] transition-colors',
              target === folder.id ? 'bg-ink text-paper' : 'text-muted hover:bg-raised hover:text-ink',
            )}
          >
            <FolderIcon className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span className="flex-1 truncate">{folder.name}</span>
          </button>
          {renderTree(folder.id, depth + 1)}
        </div>
      ))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to folder"
      eyebrow={`${ids.length} item${ids.length === 1 ? '' : 's'}`}
      description="Folders in Nimbus exist only in the local metadata database; Telegram receives the parts either way."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => move.mutate()} disabled={move.isPending}>
            {move.isPending ? <Spinner /> : null}
            Move here
          </Button>
        </>
      }
    >
      <div className="max-h-[320px] overflow-y-auto border border-line">
        <button
          onClick={() => setTarget(null)}
          className={cx(
            'flex h-8 w-full items-center gap-2 px-3 text-left text-[12px] transition-colors',
            target === null ? 'bg-ink text-paper' : 'text-muted hover:bg-raised hover:text-ink',
          )}
        >
          <HardDrive className="size-3.5 shrink-0" strokeWidth={1.5} />
          <span className="flex-1">My Drive (root)</span>
        </button>
        {renderTree(null, 1)}
        {roots.length === 0 && (
          <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">no folders</p>
        )}
      </div>
    </Modal>
  )
}

export function VersionsDialog({
  open,
  onClose,
  file,
}: {
  open: boolean
  onClose: () => void
  file: FileItem | null
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['versions', file?.id],
    queryFn: () => api.getVersions(file!.id),
    enabled: open && Boolean(file),
  })

  const restore = useMutation({
    mutationFn: (versionId: string) => api.restoreVersion(file!.id, versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Version restored', body: 'The selected version is current again.' })
    },
  })

  if (!file) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Version history"
      eyebrow={file.name}
      description="A new upload never overwrites an old one, so a damaged or unwanted copy can be rolled back."
      width="max-w-xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {isLoading && <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">loading…</p>}
      <div className="border border-line">
        {versions.map((version) => (
          <div
            key={version.id}
            className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
          >
            <History className="size-3.5 shrink-0 text-faint" strokeWidth={1.5} />
            <span className="font-mono text-[11px] text-ink">{version.label}</span>
            {version.current && <Badge tone="solid">current</Badge>}
            <span className="font-mono text-[10px] text-muted">{(version.size / 1024 / 1024).toFixed(1)} MB</span>
            <span className="ml-auto font-mono text-[10px] text-faint">{stamp(version.createdAt)}</span>
            <Button
              size="sm"
              disabled={version.current || restore.isPending}
              onClick={() => restore.mutate(version.id)}
              className="gap-1.5"
            >
              <RotateCcw className="size-3" strokeWidth={1.8} />
              Restore
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function Breadcrumbs({ path, onNavigate }: { path: Folder[]; onNavigate: (id: string | null) => void }) {
  return (
    <nav className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
      <button onClick={() => onNavigate(null)} className="transition-colors hover:text-ink">
        My Drive
      </button>
      {path.map((folder) => (
        <span key={folder.id} className="flex items-center gap-1.5">
          <ChevronRight className="size-3" strokeWidth={1.6} />
          <button onClick={() => onNavigate(folder.id)} className="transition-colors hover:text-ink">
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  )
}
