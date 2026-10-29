import { ArrowUpRight, Check, Folder, Lock, MoreHorizontal, Star } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import type { FileItem, Folder as FolderType, ViewMode } from '@/lib/types'
import { KIND_LABEL, bytes, compressionLabel, cx, num, relTime } from '@/lib/format'
import { Thumb } from '@/components/Thumb'

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cx(
        'flex size-4 items-center justify-center border transition-colors',
        checked ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-paper/70 text-transparent',
      )}
    >
      <Check className="size-3" strokeWidth={2.5} />
    </span>
  )
}

interface BrowserProps {
  files: FileItem[]
  folders?: FolderType[]
  view: ViewMode
  selected: Set<string>
  onToggle: (id: string) => void
  onOpenFile: (file: FileItem) => void
  onOpenFolder?: (folder: FolderType) => void
  onMenu: (event: MouseEvent, target: { kind: 'file' | 'folder'; id: string }) => void
  emptyState?: ReactNode
}

export function FileBrowser({
  files,
  folders = [],
  view,
  selected,
  onToggle,
  onOpenFile,
  onOpenFolder,
  onMenu,
  emptyState,
}: BrowserProps) {
  if (files.length === 0 && folders.length === 0 && emptyState) return <>{emptyState}</>

  if (view === 'list') {
    return (
      <div className="border border-line">
        <div className="grid h-8 grid-cols-[28px_minmax(0,1fr)_96px_84px_60px_112px_34px] items-center gap-2 border-b border-line bg-sunken px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
          <span />
          <span>Name</span>
          <span>Type</span>
          <span className="text-right">Size</span>
          <span className="text-right">Parts</span>
          <span className="text-right">Modified</span>
          <span />
        </div>

        {folders.map((folder) => (
          <div
            key={folder.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenFolder?.(folder)}
            onContextMenu={(event) => {
              event.preventDefault()
              onMenu(event, { kind: 'folder', id: folder.id })
            }}
            className="group grid h-11 cursor-default grid-cols-[28px_minmax(0,1fr)_96px_84px_60px_112px_34px] items-center gap-2 border-b border-line px-3 transition-colors last:border-b-0 hover:bg-raised"
          >
            <span />
            <span className="flex min-w-0 items-center gap-2">
              <Folder className="size-3.5 shrink-0 text-muted" strokeWidth={1.5} />
              <span className="truncate text-[12.5px]">{folder.name}</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              {folder.itemCount ?? 0} items
            </span>
            <span className="text-right font-mono text-[10px] text-faint">—</span>
            <span className="text-right font-mono text-[10px] text-faint">—</span>
            <span className="text-right font-mono text-[10px] text-faint">folder</span>
            <button
              aria-label="Folder actions"
              onClick={(event) => {
                event.stopPropagation()
                onMenu(event, { kind: 'folder', id: folder.id })
              }}
              className="inline-flex size-7 items-center justify-center text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
        ))}

        {files.map((file) => {
          const isSelected = selected.has(file.id)
          return (
            <div
              key={file.id}
              role="button"
              tabIndex={0}
              onClick={() => onToggle(file.id)}
              onDoubleClick={() => onOpenFile(file)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpenFile(file)
                if (event.key === ' ') {
                  event.preventDefault()
                  onToggle(file.id)
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                onMenu(event, { kind: 'file', id: file.id })
              }}
              className={cx(
                'group grid h-11 cursor-default grid-cols-[28px_minmax(0,1fr)_96px_84px_60px_112px_34px] items-center gap-2 border-b border-line px-3 transition-colors last:border-b-0',
                isSelected ? 'bg-raised' : 'hover:bg-raised',
              )}
            >
              <span className={cx('transition-opacity', isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                <CheckBox checked={isSelected} />
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center border border-line font-mono text-[8px] uppercase text-muted">
                  {KIND_LABEL[file.kind].slice(0, 3)}
                </span>
                <span className="truncate text-[12.5px]">{file.name}</span>
                {file.starred && <Star className="size-3 shrink-0 fill-ink text-ink" strokeWidth={0} />}
                {file.encrypted && <Lock className="size-3 shrink-0 text-faint" strokeWidth={1.6} />}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {KIND_LABEL[file.kind]}
              </span>
              <span className="text-right font-mono text-[10.5px] tabular-nums text-muted">{bytes(file.size)}</span>
              <span className="text-right font-mono text-[10.5px] tabular-nums text-faint">{file.parts.length}</span>
              <span className="text-right font-mono text-[10px] text-faint">{relTime(file.updatedAt)}</span>
              <button
                aria-label="File actions"
                onClick={(event) => {
                  event.stopPropagation()
                  onMenu(event, { kind: 'file', id: file.id })
                }}
                className="inline-flex size-7 items-center justify-center text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(186px,1fr))] border-t border-l border-line">
      {folders.map((folder) => (
        <div
          key={folder.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpenFolder?.(folder)}
          onKeyDown={(event) => event.key === 'Enter' && onOpenFolder?.(folder)}
          onContextMenu={(event) => {
            event.preventDefault()
            onMenu(event, { kind: 'folder', id: folder.id })
          }}
          className="group relative flex cursor-default flex-col border-r border-b border-line bg-paper transition-colors hover:bg-raised"
        >
          <div className="relative flex aspect-[4/3] items-center justify-center border-b border-line">
            <Folder className="size-12 text-muted" strokeWidth={0.8} />
          </div>
          <div className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] leading-tight">{folder.name}</p>
              <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                {folder.itemCount ?? 0} items
              </p>
            </div>
          </div>
        </div>
      ))}

      {files.map((file) => {
        const isSelected = selected.has(file.id)
        return (
          <div
            key={file.id}
            role="button"
            tabIndex={0}
            onClick={() => onToggle(file.id)}
            onDoubleClick={() => onOpenFile(file)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpenFile(file)
              if (event.key === ' ') {
                event.preventDefault()
                onToggle(file.id)
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              onMenu(event, { kind: 'file', id: file.id })
            }}
            className={cx(
              'group relative flex cursor-default flex-col border-r border-b border-line transition-colors',
              isSelected ? 'bg-raised outline outline-1 -outline-offset-1 outline-ink' : 'bg-paper hover:bg-raised',
            )}
          >
            <div className="relative aspect-[4/3] overflow-hidden border-b border-line">
              <Thumb file={file} />
              <div
                className={cx(
                  'absolute top-2 left-2 transition-opacity',
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <CheckBox checked={isSelected} />
              </div>
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  aria-label="Open preview"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenFile(file)
                  }}
                  className="inline-flex size-7 items-center justify-center border border-line bg-paper text-ink hover:bg-ink hover:text-paper"
                >
                  <ArrowUpRight className="size-3.5" />
                </button>
                <button
                  aria-label="File actions"
                  onClick={(event) => {
                    event.stopPropagation()
                    onMenu(event, { kind: 'file', id: file.id })
                  }}
                  className="inline-flex size-7 items-center justify-center border border-line bg-paper text-ink hover:bg-ink hover:text-paper"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </div>
              <div className="absolute right-2 bottom-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                {file.starred && <Star className="size-3 fill-ink text-ink" strokeWidth={0} />}
                {file.encrypted && <Lock className="size-2.5" strokeWidth={2} />}
              </div>
            </div>

            <div className="p-3">
              <p className="truncate text-[12.5px] leading-tight">{file.name}</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                <span>{bytes(file.size)}</span>
                <span className="text-line-strong">/</span>
                <span>{relTime(file.updatedAt)}</span>
              </p>
              {file.compression.applied && (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  zstd · {compressionLabel(file.compression)}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SelectionSummary({ count }: { count: number }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
      {num(count)} selected
    </span>
  )
}
