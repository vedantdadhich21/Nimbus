import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { FileItem } from '@/lib/types'
import { KIND_LABEL, bytes, daysBetween, pluralize, relTime } from '@/lib/format'
import { Badge, Button, EmptyState, Label, useToast } from '@/components/ui'
import { ConfirmDialog } from '@/components/dialogs'

export function TrashScreen() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirm, setConfirm] = useState<{ ids: string[]; forever: boolean } | null>(null)

  const { data: files = [], isLoading } = useQuery({ queryKey: ['trash'], queryFn: () => api.listTrash() })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.getSettings() })
  const retention = settings?.trashRetentionDays ?? 30

  const restore = useMutation({
    mutationFn: (ids: string[]) => api.restore(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Restored', body: 'The file is back in its folder.' })
    },
  })

  const destroy = useMutation({
    mutationFn: (ids: string[]) => api.deleteForever(ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Deleted permanently', body: 'The Telegram messages are removed after the retention job runs.' })
    },
  })

  const total = files.reduce((n, f) => n + f.size, 0)

  return (
    <div className="px-5 pt-6 pb-24 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label className="mb-2 block">Trash / retention {retention} days</Label>
          <h1 className="display text-[34px] leading-none md:text-[40px]">Trash</h1>
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
            {pluralize(files.length, 'item')} · {bytes(total)} · removed after {retention} days
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          disabled={files.length === 0}
          onClick={() => setConfirm({ ids: files.map((f) => f.id), forever: true })}
        >
          <Trash2 className="size-3.5" />
          Empty trash
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="h-40 animate-pulse border border-line bg-raised" />
        ) : files.length === 0 ? (
          <EmptyState
            title="Nothing in the trash."
            body="Deleting a file moves it here first. The Telegram messages are only removed when the retention period ends."
            icon={<Trash2 className="size-6" strokeWidth={1.2} />}
          />
        ) : (
          <div className="border border-line">
            <div className="grid h-8 grid-cols-[minmax(0,1fr)_84px_76px_128px_136px] items-center gap-3 border-b border-line bg-sunken px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              <span>Name</span>
              <span>Size</span>
              <span>Deleted</span>
              <span>Retention</span>
              <span />
            </div>
            {files.map((file: FileItem) => {
              const elapsed = file.deletedAt ? daysBetween(file.deletedAt) : 0
              const left = Math.max(0, retention - elapsed)
              return (
                <div
                  key={file.id}
                  className="grid grid-cols-[minmax(0,1fr)_84px_76px_128px_136px] items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center border border-line font-mono text-[8px] uppercase text-muted">
                      {KIND_LABEL[file.kind].slice(0, 3)}
                    </span>
                    <span className="truncate text-[12.5px]">{file.name}</span>
                    <Badge>{KIND_LABEL[file.kind]}</Badge>
                  </div>
                  <span className="font-mono text-[10px] text-muted">{bytes(file.size)}</span>
                  <span className="font-mono text-[10px] text-faint">
                    {file.deletedAt ? relTime(file.deletedAt) : '—'}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-[3px] w-12 bg-line">
                      <span
                        className={left < 7 ? 'block h-full bg-alert' : 'block h-full bg-ink'}
                        style={{ width: `${(left / retention) * 100}%` }}
                      />
                    </span>
                    <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                      {left} d left
                    </span>
                  </span>
                  <span className="flex items-center justify-end gap-1">
                    <Button size="sm" onClick={() => restore.mutate([file.id])} disabled={restore.isPending}>
                      <RotateCcw className="size-3" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirm({ ids: [file.id], forever: true })}
                      aria-label={`Delete ${file.name} permanently`}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="mt-4 max-w-2xl text-[11.5px] leading-relaxed text-faint">
        A weekly integrity job checks that every recorded part still exists in Telegram and still matches its stored
        hash. Trash, versions and encrypted index snapshots are the recovery path when something is lost.
      </p>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm && confirm.ids.length > 1 ? 'Empty the trash?' : 'Delete permanently?'}
        eyebrow={`${confirm?.ids.length ?? 0} item${(confirm?.ids.length ?? 0) === 1 ? '' : 's'}`}
        body="This cannot be undone. The local database rows are removed and the Telegram parts become unreachable from Nimbus."
        confirmLabel="Delete forever"
        danger
        onConfirm={async () => {
          await destroy.mutateAsync(confirm?.ids ?? [])
        }}
      />
    </div>
  )
}
