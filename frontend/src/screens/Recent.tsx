import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { KIND_LABEL, bytes, compressionLabel, relTime } from '@/lib/format'
import { Badge, EmptyState, Label } from '@/components/ui'

export function RecentScreen() {
  const navigate = useNavigate()
  const { data: files = [], isLoading } = useQuery({ queryKey: ['recent'], queryFn: () => api.listRecent() })

  const groups = files.reduce<Record<string, typeof files>>((acc, file) => {
    const key = new Date(file.updatedAt).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    acc[key] = acc[key] ? [...acc[key], file] : [file]
    return acc
  }, {})

  return (
    <div className="px-5 pt-6 pb-24 md:px-8">
      <Label className="mb-2 block">Activity</Label>
      <h1 className="display text-[34px] leading-none md:text-[40px]">Recent</h1>
      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
        {files.length} files changed recently · newest first
      </p>

      <div className="mt-6">
        {isLoading ? (
          <div className="h-40 animate-pulse border border-line bg-raised" />
        ) : files.length === 0 ? (
          <EmptyState
            title="No activity yet."
            body="Upload a file and it will appear here, newest first."
            icon={<Clock className="size-6" strokeWidth={1.2} />}
          />
        ) : (
          Object.entries(groups).map(([day, group]) => (
            <section key={day} className="mb-7">
              <div className="mb-2 flex items-baseline gap-3">
                <h2 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">{day}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[9px] text-faint">{group.length}</span>
              </div>
              <div className="border border-line">
                {group.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => navigate(`/file/${file.id}`)}
                    className="group grid w-full grid-cols-[minmax(0,1fr)_90px_90px_34px] items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-raised"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center border border-line font-mono text-[8px] uppercase text-muted">
                        {KIND_LABEL[file.kind].slice(0, 3)}
                      </span>
                      <span className="truncate text-[12.5px]">{file.name}</span>
                      {file.compression.applied && <Badge>{compressionLabel(file.compression)}</Badge>}
                    </span>
                    <span className="text-right font-mono text-[10px] text-muted">{bytes(file.size)}</span>
                    <span className="text-right font-mono text-[9.5px] text-faint">{relTime(file.updatedAt)}</span>
                    <ArrowUpRight className="size-4 justify-self-end text-faint transition-colors group-hover:text-ink" />
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
