import { ChevronDown, ChevronUp, Pause, Play, RotateCw, X } from 'lucide-react'
import { bytes, cx } from '@/lib/format'
import { STAGES, taskProgress, useUploads } from '@/lib/uploads'
import type { UploadTask } from '@/lib/types'
import { Badge, IconButton, Progress } from '@/components/ui'

function statusLine(task: UploadTask): string {
  if (task.status === 'waiting') return task.note ?? 'waiting for Telegram'
  if (task.status === 'paused') return 'paused'
  if (task.status === 'error') return task.note ?? 'failed'
  if (task.status === 'done') return 'stored and verified'
  const stage = STAGES.find((s) => s.id === task.stage)
  return stage ? stage.hint : 'queued'
}

function TaskRow({ task }: { task: UploadTask }) {
  const { pause, resume, cancel, retry } = useUploads()
  const progress = taskProgress(task)
  const doneParts = task.parts.filter((p) => p.status === 'done').length
  const remaining = Math.max(0, task.size * (1 - progress))
  const eta = task.speedBps > 0 ? Math.ceil(remaining / task.speedBps) : null

  return (
    <div className="border-b border-line px-3 py-2.5 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <p className="min-w-0 flex-1 truncate text-[12px] text-ink">{task.name}</p>
        <span className="font-mono text-[10px] text-faint">{bytes(task.size)}</span>
      </div>

      <div className="mt-2 flex gap-1">
        {STAGES.map((stage) => {
          const index = STAGES.findIndex((s) => s.id === stage.id)
          const current = STAGES.findIndex((s) => s.id === task.stage)
          const done = task.status === 'done' || index < current
          const active = index === current && task.status !== 'done'
          return (
            <span
              key={stage.id}
              title={`${stage.label} — ${stage.hint}`}
              className={cx('h-[3px] flex-1', done ? 'bg-ink' : active ? 'bg-line-strong' : 'bg-line')}
            />
          )
        })}
      </div>

      <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em]">
        <span className={cx(task.status === 'waiting' ? 'text-alert' : 'text-muted')}>
          {task.status === 'done' ? 'done' : task.stage}
          {task.status !== 'done' ? ` · ${Math.round(progress * 100)}%` : ''}
        </span>
        <span className="text-faint">
          {task.speedBps > 0 ? `${bytes(task.speedBps)}/s` : '—'}
          {eta != null ? ` · ${eta}s` : ''}
        </span>
      </div>

      <Progress value={progress} className="mt-1.5" />

      <div className="mt-2 flex items-center gap-2">
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {task.parts.slice(0, 14).map((part) => (
            <span
              key={part.index}
              className={cx(
                'h-2 w-1',
                part.status === 'done' ? 'bg-ink' : part.status === 'active' ? 'bg-line-strong' : 'bg-line',
              )}
            />
          ))}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
          {doneParts}/{task.parts.length} parts
        </span>
        <span className="ml-auto flex items-center gap-1">
          {task.status === 'running' && (
            <IconButton label="Pause upload" className="size-6" onClick={() => pause(task.id)}>
              <Pause className="size-3" />
            </IconButton>
          )}
          {task.status === 'paused' && (
            <IconButton label="Resume upload" className="size-6" onClick={() => resume(task.id)}>
              <Play className="size-3" />
            </IconButton>
          )}
          {task.status === 'error' && (
            <IconButton label="Retry upload" className="size-6" onClick={() => retry(task.id)}>
              <RotateCw className="size-3" />
            </IconButton>
          )}
          {task.status !== 'done' && (
            <IconButton label="Cancel upload" className="size-6" onClick={() => cancel(task.id)}>
              <X className="size-3" />
            </IconButton>
          )}
        </span>
      </div>

      <p
        className={cx(
          'mt-1.5 font-mono text-[9px] tracking-[0.04em]',
          task.status === 'waiting' ? 'text-alert' : 'text-faint',
        )}
      >
        {statusLine(task)}
      </p>
    </div>
  )
}

export function UploadDock() {
  const { tasks, counts, collapsed, setCollapsed, clearDone } = useUploads()
  if (tasks.length === 0) return null

  const overall =
    tasks.reduce((sum, task) => sum + taskProgress(task), 0) / Math.max(1, tasks.length)

  return (
    <div className="fixed right-4 bottom-8 z-30 w-[min(404px,calc(100vw-2rem))] border border-line bg-paper shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex h-9 w-full items-center gap-2 border-b border-line bg-sunken px-3 text-left"
      >
        <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-ink">
          Transfer queue
        </span>
        <Badge tone={counts.active > 0 ? 'solid' : 'line'}>
          {counts.active > 0 ? `${counts.active} active` : `${counts.done} done`}
        </Badge>
        <span className="ml-auto font-mono text-[9px] text-faint">{Math.round(overall * 100)}%</span>
        <span className="text-muted">
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </button>

      {!collapsed && (
        <>
          <div className="max-h-[300px] overflow-y-auto">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
              mock pipeline · 1 mib blocks
            </span>
            <button
              onClick={clearDone}
              disabled={counts.done === 0}
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink disabled:opacity-30"
            >
              clear finished
            </button>
          </div>
        </>
      )}
    </div>
  )
}
