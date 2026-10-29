import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock,
  Folder,
  HardDrive,
  Lock,
  Menu as MenuIcon,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { api, IS_MOCK } from '@/lib/api'
import { bytes, cx, num } from '@/lib/format'
import { useSession } from '@/lib/useSession'
import { useUploads } from '@/lib/uploads'
import { Badge, Button, IconButton, Kbd, Label, Mark, StatusDot } from '@/components/ui'
import { UploadDock } from '@/components/UploadDock'

const NAV = [
  { to: '/drive', label: 'Drive', icon: HardDrive },
  { to: '/recent', label: 'Recent', icon: Clock },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/trash', label: 'Trash', icon: Trash2 },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session } = useSession()
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.getStats() })
  const { data: root } = useQuery({ queryKey: ['listing', 'root'], queryFn: () => api.listFolder(null) })
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const lock = useMutation({
    mutationFn: () => api.lock(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate('/unlock')
    },
  })

  const saved = stats ? bytes(stats.savedBytes) : '—'

  return (
    <aside className="flex h-full w-full flex-col bg-paper">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Mark size={17} className="text-ink" />
        <div className="min-w-0">
          <p className="display text-[15px] leading-none tracking-[-0.02em]">NIMBUS</p>
          <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-faint">
            self-hosted · v0.1.0
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-px border-b border-line p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  'group flex h-9 items-center gap-2.5 px-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors',
                  isActive ? 'bg-ink text-paper' : 'text-muted hover:bg-raised hover:text-ink',
                )
              }
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.6} />
              <span className="flex-1">{label}</span>
              {label === 'Trash' && stats && stats.trashCount > 0 && (
                <span className="font-mono text-[9px] opacity-70">{stats.trashCount}</span>
              )}
              {label === 'Drive' && stats && (
                <span className="font-mono text-[9px] opacity-50">{stats.fileCount}</span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="px-4 pt-4 pb-2">
          <Label>Folders</Label>
        </div>
        <div className="flex flex-col px-2 pb-4">
          {(root?.folders ?? []).map((folder) => (
            <Link
              key={folder.id}
              to={`/drive/${folder.id}`}
              onClick={onNavigate}
              className="group flex h-8 items-center gap-2.5 px-2.5 text-[12px] text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Folder className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span className="flex-1 truncate">{folder.name}</span>
              <span className="font-mono text-[9px] text-faint group-hover:text-muted">
                {folder.itemCount ?? 0}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-line">
        <div className="px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Stored</Label>
            <span className="font-mono text-[10px] text-ink">{stats ? bytes(stats.usedBytes) : '—'}</span>
          </div>
          <div className="flex h-[3px] gap-px overflow-hidden bg-line">
            <div className="h-full w-full bg-ink" />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
            <span>{stats ? num(stats.partCount) : 0} parts</span>
            <span>{saved} saved</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center border border-line bg-raised font-mono text-[10px]">
            {session?.telegram?.name?.slice(0, 1) ?? 'V'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] leading-tight text-ink">
              {session?.telegram?.name ?? 'Not connected'}
            </p>
            <p className="truncate font-mono text-[9px] tracking-[0.06em] text-faint">
              {session?.telegram ? `@${session.telegram.username} · premium` : 'setup required'}
            </p>
          </div>
          <IconButton label="Lock Nimbus" onClick={() => lock.mutate()} className="size-7">
            <Lock className="size-3.5" strokeWidth={1.5} />
          </IconButton>
          <Link
            to="/settings"
            onClick={onNavigate}
            aria-label="Settings"
            className="inline-flex size-7 items-center justify-center text-muted transition-colors hover:text-ink"
          >
            <Settings className="size-3.5" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </aside>
  )
}

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { addFiles } = useUploads()
  const { counts } = useUploads()

  const folderMatch = location.pathname.match(/^\/drive\/([^/]+)/)
  const folderId = folderMatch ? folderMatch[1] : null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const section =
    location.pathname === '/drive' || location.pathname.startsWith('/drive/')
      ? 'My Drive'
      : location.pathname === '/recent'
        ? 'Recent'
        : location.pathname === '/search'
          ? 'Search'
          : location.pathname === '/trash'
            ? 'Trash'
            : location.pathname === '/settings'
              ? 'Settings'
              : location.pathname.startsWith('/file/')
                ? 'Preview'
                : 'Nimbus'

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
      <button
        onClick={onOpenMenu}
        className="inline-flex size-8 items-center justify-center border border-line text-muted lg:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon className="size-4" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint sm:flex">
        <span>Nimbus</span>
        <span>/</span>
        <span className="truncate text-ink">{section}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
          }}
          className="group relative hidden h-8 w-[260px] items-center border border-line focus-within:border-line-strong md:flex"
        >
          <Search className="ml-2.5 size-3.5 shrink-0 text-faint" strokeWidth={1.6} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by meaning…"
            aria-label="Search files"
            className="h-full w-full bg-transparent px-2 pr-14 text-[12px] outline-none placeholder:text-faint"
          />
          <span className="absolute right-2 flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </form>

        <Link
          to="/search"
          aria-label="Search"
          className="inline-flex size-8 items-center justify-center border border-line text-muted md:hidden"
        >
          <Search className="size-4" />
        </Link>

        {counts.active > 0 && (
          <Badge tone="line" className="hidden sm:inline-flex">
            <StatusDot pulse /> {counts.active} uploading
          </Badge>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="h-8"
        >
          <Upload className="size-3.5" strokeWidth={2} />
          Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length) addFiles(files, folderId)
            event.target.value = ''
          }}
        />
      </div>
    </header>
  )
}

function StatusBar() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.getStats() })
  const { data: session } = useSession()

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-sunken px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 bg-ink" />
        {IS_MOCK ? 'mock adapter' : 'api'}
      </span>
      <span className="hidden text-line-strong sm:inline">/</span>
      <span className="hidden sm:inline">demo data</span>
      <span className="ml-auto hidden md:inline">
        {session?.telegram ? 'telegram · session encrypted' : 'no telegram session'}
      </span>
      <span className="ml-auto md:ml-0">{stats ? `${num(stats.fileCount)} files · ${num(stats.partCount)} parts` : '—'}</span>
      <span className="hidden lg:inline">aes-256-gcm</span>
    </footer>
  )
}

export function Shell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink">
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[248px] shrink-0 border-r border-line lg:block">
          <Sidebar />
        </div>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-[268px] border-r border-line bg-paper">
              <div className="absolute top-3 right-3 z-10">
                <IconButton label="Close navigation" onClick={() => setMenuOpen(false)}>
                  <X className="size-4" />
                </IconButton>
              </div>
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenMenu={() => setMenuOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <StatusBar />
      <UploadDock />
    </div>
  )
}
