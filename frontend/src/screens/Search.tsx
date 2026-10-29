import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Search as SearchIcon, Sparkles } from 'lucide-react'
import { api, IS_MOCK } from '@/lib/api'
import type { FileItem } from '@/lib/types'
import { KIND_LABEL, bytes, cx, pluralize, relTime } from '@/lib/format'
import { Badge, Button, EmptyState, Label, Progress, Tabs } from '@/components/ui'
import { Thumb } from '@/components/Thumb'

type Scope = 'all' | 'documents' | 'images' | 'media'

const SUGGESTIONS = [
  'the invoice from the car repair',
  'photos from the fest',
  'notes about normalization',
  'the paper about attention',
  'backup of last semester',
]

export function SearchScreen() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const query = params.get('q') ?? ''
  const [draft, setDraft] = useState(query)
  const [scope, setScope] = useState<Scope>('all')
  const [folderId, setFolderId] = useState<string>('')

  useEffect(() => {
    setDraft(query)
  }, [query])

  const { data: folders = [] } = useQuery({ queryKey: ['folders'], queryFn: () => api.listFolders() })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, scope, folderId],
    queryFn: () => api.search(query, scope, folderId || null),
    enabled: query.trim().length > 0,
  })

  const hits = data?.hits ?? []

  // Facet counts describe the whole result set, so they must not shrink to the
  // scope you are currently looking at — otherwise the only way back is lost.
  const { data: unscoped } = useQuery({
    queryKey: ['search-facets', query, folderId],
    queryFn: () => api.search(query, 'all', folderId || null),
    enabled: query.trim().length > 0 && scope !== 'all',
  })
  const facetHits = scope === 'all' ? hits : (unscoped?.hits ?? hits)

  const documents = facetHits.filter((h) => ['pdf', 'document', 'sheet', 'slide', 'text', 'code'].includes(h.file.kind)).length
  const images = facetHits.filter((h) => h.file.kind === 'image').length
  const media = facetHits.filter((h) => ['video', 'audio'].includes(h.file.kind)).length

  const submit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const open = (file: FileItem) => navigate(`/file/${file.id}`)

  return (
    <div className="px-5 pt-6 pb-24 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label className="mb-2 block">Search / hybrid</Label>
          <h1 className="serif max-w-3xl text-[34px] leading-[1.05] text-ink md:text-[44px]">
            {query ? `“${query}”` : 'Find a file by what is inside it.'}
          </h1>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit(draft)
          }}
          className="flex h-10 w-full max-w-[360px] items-center border border-line focus-within:border-ink"
        >
          <SearchIcon className="ml-3 size-4 shrink-0 text-faint" strokeWidth={1.6} />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe the file…"
            aria-label="Search query"
            className="h-full w-full bg-transparent px-2.5 text-[13px] outline-none"
          />
          <Button variant="primary" size="sm" type="submit" className="mr-1 h-8">
            Search
          </Button>
        </form>
      </div>

      {query && (
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          <span className="text-ink">{hits.length} results</span>
          <span className="text-line-strong">/</span>
          <span>{data?.tookMs ?? 0} ms</span>
          <span className="text-line-strong">/</span>
          <span>{data?.encodedMs ?? 0} ms encode</span>
          <span className="text-line-strong">/</span>
          <span>all-minilm-l6-v2 · 384-d</span>
          <span className="text-line-strong">/</span>
          <span>cosine · brute force</span>
          {IS_MOCK && (
            <>
              <span className="text-line-strong">/</span>
              <span className="text-alert">simulated scoring</span>
            </>
          )}
        </div>
      )}

      {query && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Tabs
            value={scope}
            onChange={setScope}
            items={[
              { id: 'all', label: 'All', count: facetHits.length },
              { id: 'documents', label: 'Documents', count: documents },
              { id: 'images', label: 'Images', count: images },
              { id: 'media', label: 'Media', count: media },
            ]}
          />
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            aria-label="Limit to folder"
            className="h-8 border border-line bg-transparent px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted outline-none focus:border-line-strong"
          >
            <option value="">All folders</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <span className="ml-auto flex items-center gap-2">
            <Badge tone="line">
              <Sparkles className="size-2.5" /> local model
            </Badge>
            <Badge tone="line">telegram not contacted</Badge>
          </span>
        </div>
      )}

      <div className="mt-5">
        {!query ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="border-t border-line">
                {SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => submit(suggestion)}
                    className="group flex w-full items-center gap-4 border-b border-line py-4 text-left transition-colors hover:bg-raised"
                  >
                    <span className="w-8 font-mono text-[10px] text-faint">{String(index + 1).padStart(2, '0')}</span>
                    <span className="flex-1 text-[13.5px] text-ink">{suggestion}</span>
                    <ArrowUpRight className="size-4 text-faint transition-colors group-hover:text-ink" />
                  </button>
                ))}
              </div>
              <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                {IS_MOCK
                  ? 'demo scoring uses a hand-written topic index, not an embedding model'
                  : 'queries are encoded locally; nothing is sent to a third party'}
              </p>
            </div>

            <aside className="border border-line p-4">
              <Label className="mb-3 block">How a query is answered</Label>
              <ol className="space-y-3">
                {[
                  ['01', 'Encode', 'The same local model that indexed the file turns the query into a vector.'],
                  ['02', 'Compare', 'Cosine similarity against every stored vector; filename score blended in.'],
                  ['03', 'Fetch', 'Only when you open a result does the backend fetch parts from Telegram.'],
                ].map(([index, title, body]) => (
                  <li key={index} className="flex gap-3">
                    <span className="font-mono text-[10px] text-faint">{index}</span>
                    <div>
                      <p className="text-[12px] text-ink">{title}</p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 border-t border-line pt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-faint">
                Text · all-MiniLM-L6-v2 (384-d)
                <br />
                Images · CLIP ViT-B/32 (512-d)
                <br />
                Vectors stay in the local database
              </div>
            </aside>
          </div>
        ) : isLoading ? (
          <div className="space-y-px border border-line bg-line">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 bg-paper p-4">
                <div className="size-12 animate-pulse bg-raised" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-1/3 animate-pulse bg-line" />
                  <div className="h-2 w-2/3 animate-pulse bg-line" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState title="The search service did not answer." body="In the real deployment this is the local AI service; check that it is running." />
        ) : hits.length === 0 ? (
          <EmptyState
            title="Nothing matched that meaning."
            body="Try fewer words, or a different scope. Files without extractable text — archives, for example — are found by name only."
            action={<Button onClick={() => setScope('all')}>Search all types</Button>}
          />
        ) : (
          <div className="border border-line">
            <div className="grid grid-cols-[36px_minmax(0,1fr)_150px] items-center gap-4 border-b border-line bg-sunken px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              <span>#</span>
              <span>File and matched passage</span>
              <span>Semantic / name</span>
            </div>
            {hits.map((hit, index) => (
              <button
                key={hit.file.id}
                onClick={() => open(hit.file)}
                className={cx(
                  'group grid w-full grid-cols-[36px_minmax(0,1fr)_150px] items-center gap-4 border-b border-line px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-raised',
                )}
              >
                <span className="font-mono text-[10px] text-faint">{String(index + 1).padStart(2, '0')}</span>

                <span className="flex min-w-0 items-center gap-3">
                  <span className="hidden size-11 shrink-0 items-center justify-center overflow-hidden border border-line sm:flex">
                    {hit.file.kind === 'image' ? (
                      <Thumb file={hit.file} />
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                        {KIND_LABEL[hit.file.kind].slice(0, 3)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] text-ink">{hit.file.name}</span>
                      <Badge>{KIND_LABEL[hit.file.kind]}</Badge>
                      {hit.file.starred && <Badge tone="solid">starred</Badge>}
                    </span>
                    {hit.passage && (
                      <span className="mt-1 block truncate font-mono text-[10.5px] text-muted">{hit.passage}</span>
                    )}
                    <span className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                      <span>{bytes(hit.file.size)}</span>
                      <span className="text-line-strong">/</span>
                      <span>{relTime(hit.file.updatedAt)}</span>
                      <span className="text-line-strong">/</span>
                      <span>{pluralize(hit.file.parts.length, 'part')}</span>
                    </span>
                  </span>
                </span>

                <span className="hidden flex-col gap-1.5 md:flex">
                  <span className="flex items-center gap-2">
                    <span className="w-8 font-mono text-[8.5px] uppercase tracking-[0.1em] text-faint">sem</span>
                    <Progress value={hit.semantic} className="flex-1" />
                    <span className="w-6 text-right font-mono text-[9px] text-muted">
                      {Math.round(hit.semantic * 100)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-8 font-mono text-[8.5px] uppercase tracking-[0.1em] text-faint">name</span>
                    <Progress value={hit.nameScore} className="flex-1" />
                    <span className="w-6 text-right font-mono text-[9px] text-muted">
                      {Math.round(hit.nameScore * 100)}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[9px] uppercase tracking-[0.1em] text-ink">
                    {Math.round(hit.score * 100)}% match
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
