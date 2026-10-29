import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  FlaskConical,
  FolderInput,
  FolderPlus,
  HardDrive,
  History,
  LayoutGrid,
  List,
  Pencil,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { FileItem, Folder, SortKey, ViewMode } from '@/lib/types'
import { bytes, cx, num, pluralize } from '@/lib/format'
import { useUploads } from '@/lib/uploads'
import { Badge, Button, EmptyState, IconButton, Label, useToast } from '@/components/ui'
import { FileBrowser } from '@/components/FileBrowser'
import { ContextMenu, type MenuItem } from '@/components/ContextMenu'
import { Breadcrumbs, ConfirmDialog, MoveDialog, PromptDialog, VersionsDialog } from '@/components/dialogs'

type MenuTarget = { x: number; y: number; kind: 'file' | 'folder'; id: string }

export function DriveScreen() {
  const { folderId } = useParams()
  const fid = folderId ?? null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { addFiles, addSynthetic } = useUploads()

  const [sort, setSort] = useState<SortKey>('name')
  const [view, setView] = useState<ViewMode>('grid')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileItem | Folder | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [versionsFor, setVersionsFor] = useState<FileItem | null>(null)
  const [trashIds, setTrashIds] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listing', fid, sort],
    queryFn: () => api.listFolder(fid, sort),
  })

  useEffect(() => {
    setSelected(new Set())
  }, [fid])

  const invalidate = () => queryClient.invalidateQueries()

  const createFolder = useMutation({
    mutationFn: (name: string) => api.createFolder(name, fid),
    onSuccess: async (folder) => {
      await invalidate()
      toast({ title: 'Folder created', body: `${folder.name} · metadata only, nothing sent to Telegram.` })
    },
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.rename(id, name),
    onSuccess: async () => {
      await invalidate()
      toast({ title: 'Renamed' })
    },
  })

  const trash = useMutation({
    mutationFn: (ids: string[]) => api.trash(ids),
    onSuccess: async () => {
      await invalidate()
      toast({
        title: 'Moved to trash',
        body: 'Retained for 30 days; the Telegram messages are removed after that.',
      })
    },
  })

  const star = useMutation({
    mutationFn: (id: string) => api.toggleStar(id),
    onSuccess: invalidate,
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(new Set())
      if ((event.key === 'Delete' || event.key === 'Backspace') && selected.size > 0) {
        const active = document.activeElement?.tagName
        if (active === 'INPUT' || active === 'TEXTAREA') return
        setTrashIds([...selected])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openMenu = (event: MouseEvent, target: { kind: 'file' | 'folder'; id: string }) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, ...target })
  }

  const openFolder = (folder: Folder) => navigate(`/drive/${folder.id}`)

  const totalBytes = (data?.files ?? []).reduce((n, f) => n + f.size, 0)
  const partCount = (data?.files ?? []).reduce((n, f) => n + f.parts.length, 0)
  const title = data?.folder?.name ?? 'My Drive'

  const download = (file: FileItem) =>
    toast({
      title: `Download ${file.name}`,
      body: 'The mock adapter has no byte stream. The range-capable download route is described in docs/API_CONTRACT.md.',
    })

  const menuItems = (): MenuItem[] => {
    if (!menu) return []
    const file = data?.files.find((f) => f.id === menu.id)
    const folder = data?.folders.find((f) => f.id === menu.id)
    const items: MenuItem[] = []

    if (menu.kind === 'folder' && folder) {
      items.push({ label: 'Open', icon: <HardDrive className="size-3.5" />, onSelect: () => openFolder(folder) })
    }
    if (menu.kind === 'file' && file) {
      items.push({ label: 'Preview', icon: <HardDrive className="size-3.5" />, onSelect: () => navigate(`/file/${file.id}`) })
      items.push({ label: 'Download', icon: <Download className="size-3.5" />, onSelect: () => download(file) })
    }

    items.push({
      label: 'Rename',
      icon: <Pencil className="size-3.5" />,
      separatorBefore: true,
      onSelect: () => setRenameTarget(menu.kind === 'file' ? (file ?? null) : (folder ?? null)),
    })
    items.push({
      label: 'Move to…',
      icon: <FolderInput className="size-3.5" />,
      onSelect: () => {
        setSelected(new Set([menu.id]))
        setMoveOpen(true)
      },
    })

    if (menu.kind === 'file' && file) {
      if (file.versions.length > 1) {
        items.push({
          label: `Versions (${file.versions.length})`,
          icon: <History className="size-3.5" />,
          onSelect: () => setVersionsFor(file),
        })
      }
      items.push({
        label: file.starred ? 'Remove star' : 'Star',
        icon: <Star className="size-3.5" />,
        onSelect: () => star.mutate(file.id),
      })
    }

    items.push({
      label: 'Move to trash',
      icon: <Trash2 className="size-3.5" />,
      danger: true,
      separatorBefore: true,
      onSelect: () => setTrashIds([menu.id]),
    })

    return items
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length) addFiles(files, fid)
  }

  return (
    <div
      className="relative min-h-full"
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          dragDepth.current += 1
          setDragging(true)
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1
        if (dragDepth.current <= 0) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-paper/90">
          <div className="hatch absolute inset-4 border border-ink" />
          <div className="relative border border-ink bg-paper px-10 py-8 text-center">
            <p className="serif text-[34px] leading-none">Drop to encrypt and upload</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              detect · compress · chunk · aes-256-gcm · mtproto
            </p>
          </div>
        </div>
      )}

      <div className="px-5 pt-6 pb-24 md:px-8">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs path={data?.path ?? []} onNavigate={(id) => navigate(id ? `/drive/${id}` : '/drive')} />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setNewFolderOpen(true)}>
              <FolderPlus className="size-3.5" strokeWidth={1.8} />
              New folder
            </Button>
            <Button size="sm" variant="primary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" strokeWidth={2} />
              Upload
            </Button>
            <IconButton
              label="Simulate an upload (demo)"
              onClick={() => addSynthetic(fid)}
              className="border border-line"
            >
              <FlaskConical className="size-3.5" strokeWidth={1.6} />
            </IconButton>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.length) addFiles(files, fid)
                event.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[34px] leading-none md:text-[40px]">{title}</h1>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
              <span>{pluralize(data?.files.length ?? 0, 'file')}</span>
              <span className="text-line-strong">/</span>
              <span>{pluralize(data?.folders.length ?? 0, 'folder')}</span>
              <span className="text-line-strong">/</span>
              <span>{bytes(totalBytes)}</span>
              <span className="text-line-strong">/</span>
              <span>{num(partCount)} parts</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label="Sort by"
              className="h-8 border border-line bg-transparent px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted outline-none focus:border-line-strong"
            >
              <option value="name">Name</option>
              <option value="modified">Modified</option>
              <option value="size">Size</option>
              <option value="kind">Type</option>
            </select>
            <div className="flex border border-line">
              <button
                aria-label="Grid view"
                onClick={() => setView('grid')}
                className={cx('flex size-8 items-center justify-center', view === 'grid' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}
              >
                <LayoutGrid className="size-3.5" strokeWidth={1.7} />
              </button>
              <button
                aria-label="List view"
                onClick={() => setView('list')}
                className={cx('flex size-8 items-center justify-center border-l border-line', view === 'list' ? 'bg-ink text-paper' : 'text-muted hover:text-ink')}
              >
                <List className="size-3.5" strokeWidth={1.7} />
              </button>
            </div>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border border-ink bg-raised px-3 py-2">
            <Label className="text-ink">{selected.size} selected</Label>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const file = data?.files.find((f) => f.id === [...selected][0])
                  if (file) download(file)
                }}
              >
                <Download className="size-3.5" />
                Download
              </Button>
              <Button size="sm" onClick={() => setMoveOpen(true)}>
                <FolderInput className="size-3.5" />
                Move
              </Button>
              <Button size="sm" variant="danger" onClick={() => setTrashIds([...selected])}>
                <Trash2 className="size-3.5" />
                Trash
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted hover:text-ink"
              >
                clear
              </button>
            </div>
          </div>
        )}

        <div className="mt-5">
          {isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(186px,1fr))] border-t border-l border-line">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="border-r border-b border-line bg-paper">
                  <div className="aspect-[4/3] animate-pulse border-b border-line bg-raised" />
                  <div className="space-y-2 p-3">
                    <div className="h-2 w-3/4 animate-pulse bg-line" />
                    <div className="h-2 w-1/3 animate-pulse bg-line" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              title="That folder is not here."
              body="It may have been moved or removed. The local database is the only record of the Telegram parts."
              action={<Button onClick={() => navigate('/drive')}>Back to My Drive</Button>}
            />
          ) : (
            <FileBrowser
              files={data?.files ?? []}
              folders={data?.folders ?? []}
              view={view}
              selected={selected}
              onToggle={toggle}
              onOpenFile={(file) => navigate(`/file/${file.id}`)}
              onOpenFolder={openFolder}
              onMenu={openMenu}
              emptyState={
                <EmptyState
                  title="An empty folder, for now."
                  body="Drop files anywhere on this page, or upload from the button above. Every file is compressed only if it helps, chunked, then encrypted before it leaves this server."
                  action={
                    <div className="flex items-center gap-2">
                      <Button variant="primary" onClick={() => fileRef.current?.click()}>
                        <Upload className="size-3.5" /> Upload files
                      </Button>
                      <Button onClick={() => addSynthetic(fid)}>Simulate a 218 MB upload</Button>
                    </div>
                  }
                />
              }
            />
          )}
        </div>

        {!isLoading && (data?.files.length ?? 0) > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              double-click to open · ⌘-click to select · delete to trash
            </span>
            <div className="flex items-center gap-2">
              <Badge>aes-256-gcm</Badge>
              <Badge>zstd selective</Badge>
              <Badge>1 mib blocks</Badge>
            </div>
          </div>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}

      <PromptDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="New folder"
        eyebrow="metadata only"
        label="Folder name"
        placeholder="Semester VI"
        confirmLabel="Create"
        hint="Folders live in the local database. Telegram has no concept of a folder."
        onSubmit={(name) => createFolder.mutateAsync(name)}
      />

      <PromptDialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename"
        eyebrow={renameTarget ? ('mime' in renameTarget ? 'file' : 'folder') : undefined}
        label="New name"
        initialValue={renameTarget?.name ?? ''}
        confirmLabel="Rename"
        onSubmit={(name) => rename.mutateAsync({ id: renameTarget!.id, name })}
      />

      <MoveDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        ids={[...selected]}
        currentFolderId={fid}
        onDone={() => setSelected(new Set())}
      />

      <VersionsDialog open={versionsFor !== null} onClose={() => setVersionsFor(null)} file={versionsFor} />

      <ConfirmDialog
        open={trashIds !== null}
        onClose={() => setTrashIds(null)}
        title="Move to trash?"
        eyebrow={`${trashIds?.length ?? 0} item${(trashIds?.length ?? 0) === 1 ? '' : 's'}`}
        body="Files move to the trash and are kept for 30 days before the Telegram messages are removed. Nothing is deleted permanently from this dialog."
        confirmLabel="Move to trash"
        danger
        onConfirm={async () => {
          await trash.mutateAsync(trashIds ?? [])
          setSelected(new Set())
        }}
      />

    </div>
  )
}
