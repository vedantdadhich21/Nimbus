import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Eye, LogOut, Moon, RefreshCcw, ShieldCheck, Sun } from 'lucide-react'
import { api, API_MODE, IS_MOCK } from '@/lib/api'
import { useTheme } from '@/lib/theme'
import { KIND_LABEL, bytes, num, pluralize, stamp } from '@/lib/format'
import {
  Badge,
  Button,
  Field,
  Label,
  Modal,
  SectionHeader,
  Spinner,
  StackedBar,
  TextInput,
  Toggle,
  useToast,
} from '@/components/ui'
import { ConfirmDialog } from '@/components/dialogs'

const POLICY = [
  { category: 'Plain text and code', examples: 'TXT, CSV, JSON, LOG, source', policy: 'Compress', reason: 'High redundancy' },
  { category: 'Uncompressed media', examples: 'BMP, WAV, raw', policy: 'Compress', reason: 'Little built-in compression' },
  { category: 'Office and PDF', examples: 'DOCX, XLSX, PDF', policy: 'Sample, then decide', reason: 'Often already compressed' },
  { category: 'Compressed images', examples: 'JPEG, PNG, WebP', policy: 'Skip', reason: '≈1% saving measured' },
  { category: 'Audio and video', examples: 'MP3, AAC, MP4, MKV', policy: 'Skip', reason: 'Already compressed' },
  { category: 'Archives', examples: 'ZIP, 7Z, GZ', policy: 'Skip', reason: 'Already compressed' },
]

function Section({
  index,
  title,
  description,
  children,
  action,
}: {
  index: string
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="border-t border-line py-7 first:border-t-0 first:pt-0">
      <SectionHeader index={index} title={title} description={description} action={action} />
      <div className="mt-5">{children}</div>
    </section>
  )
}

function PassphraseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setCurrent('')
      setNext('')
      setConfirm('')
      setError(null)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => api.changePassphrase(current, next),
    onSuccess: () => {
      toast({ title: 'Passphrase changed', body: 'Only the master key was re-wrapped; no file was re-encrypted.' })
      onClose()
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not change the passphrase.'),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change passphrase"
      eyebrow="key management"
      description="The new passphrase derives a wrapping key with Argon2id. Only the master key is re-wrapped; existing files are untouched."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={mutation.isPending || next.length < 8 || next !== confirm}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner /> : null}
            Change
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Current passphrase">
          <TextInput type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoFocus />
        </Field>
        <Field label="New passphrase" hint="At least 8 characters in this demo.">
          <TextInput type="password" value={next} onChange={(event) => setNext(event.target.value)} />
        </Field>
        <Field label="Repeat new passphrase" error={confirm && next !== confirm ? 'The two entries differ.' : error}>
          <TextInput type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function RecoveryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const { data, isLoading } = useQuery({
    queryKey: ['recovery-code'],
    queryFn: () => api.revealRecoveryCode(),
    enabled: open,
    staleTime: Infinity,
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recovery code"
      eyebrow="shown again for this demo"
      description="In a real deployment this is shown once at setup and never stored in readable form. Anyone with this code can unwrap the master key."
      footer={
        <Button
          variant="primary"
          onClick={() => {
            if (data) void navigator.clipboard?.writeText(data)
            toast({ title: 'Copied to clipboard' })
          }}
        >
          <Copy className="size-3.5" /> Copy code
        </Button>
      }
    >
      {isLoading || !data ? (
        <Spinner className="size-4" />
      ) : (
        <div className="grid grid-cols-4 gap-px border border-line bg-line">
          {data.split('-').map((group, index) => (
            <div key={index} className="bg-paper px-3 py-2.5 text-center font-mono text-[12px] tracking-[0.12em]">
              {group}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export function SettingsScreen() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  const [passphraseOpen, setPassphraseOpen] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: () => api.getSession() })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.getSettings() })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.getStats() })
  const { data: integrity } = useQuery({ queryKey: ['integrity'], queryFn: () => api.getIntegrity() })

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof api.updateSettings>[0]) => api.updateSettings(patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const runIntegrity = useMutation({
    mutationFn: () => api.runIntegrityCheck(),
    onSuccess: async (report) => {
      await queryClient.invalidateQueries({ queryKey: ['integrity'] })
      toast({
        title: 'Integrity check finished',
        body: `${num(report.partsChecked)} parts verified in ${(report.durationMs / 1000).toFixed(1)} s.`,
      })
    },
  })

  const signOut = useMutation({
    mutationFn: () => api.signOut(),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Signed out of Telegram', body: 'Local files remain in this demo database.' })
    },
  })

  const reset = useMutation({
    mutationFn: () => api.resetDemo(),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Demo data reset' })
    },
  })

  const savedPct =
    stats && stats.originalBytes > 0 ? Math.round((stats.savedBytes / stats.originalBytes) * 100) : 0

  return (
    <div className="px-5 pt-6 pb-24 md:px-8">
      <Label className="mb-2 block">Instance</Label>
      <h1 className="display text-[34px] leading-none md:text-[40px]">Settings</h1>
      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
        {session?.version ?? 'nimbus'} · {API_MODE} adapter · one telegram account per instance
      </p>

      <div className="mx-auto mt-8 max-w-3xl">
        <Section index="01" title="Telegram account" description="The session file is equivalent to being signed in on another device, so it is stored encrypted.">
          <div className="border border-line">
            {[
              ['Account', session?.telegram?.name ?? 'not connected'],
              ['Username', session?.telegram ? `@${session.telegram.username}` : '—'],
              ['Phone', session?.telegram?.phone ?? '—'],
              ['Data centre', session?.telegram?.dc ?? '—'],
              ['Session created', session?.telegram ? stamp(session.telegram.sessionCreatedAt) : '—'],
            ].map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-b border-line px-3 py-2.5 last:border-b-0">
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">{key}</span>
                <span className="font-mono text-[11px] text-ink">{value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-line bg-sunken px-3 py-2.5">
              <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                <ShieldCheck className="size-3.5" /> session encrypted
              </span>
              <Button size="sm" variant="danger" onClick={() => setSignOutOpen(true)}>
                <LogOut className="size-3" />
                Sign out
              </Button>
            </div>
          </div>
        </Section>

        <Section index="02" title="Security" description="Passphrase, recovery code and two-step verification. Nimbus cannot reset a forgotten passphrase on your behalf.">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2.5">
              <div>
                <p className="text-[12.5px]">Passphrase</p>
                <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                  changed {session?.passphraseChangedAt ? stamp(session.passphraseChangedAt) : 'at setup'} · argon2id
                </p>
              </div>
              <Button size="sm" onClick={() => setPassphraseOpen(true)}>
                Change
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border border-line px-3 py-2.5">
              <div>
                <p className="flex items-center gap-2 text-[12.5px]">
                  Recovery code <Badge tone="solid">shown once</Badge>
                </p>
                <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-faint">
                  8 groups · wraps a second copy of the master key
                </p>
              </div>
              <Button size="sm" onClick={() => setRecoveryOpen(true)}>
                <Eye className="size-3" />
                View
              </Button>
            </div>

            <Toggle
              checked
              disabled
              onChange={() => {}}
              label="Telegram two-step verification required"
              description="Enforced during setup in the real deployment; the stored session is useless without it."
            />
          </div>
        </Section>

        <Section index="03" title="Storage" description="Numbers come from the local metadata database, not from Telegram.">
          <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
            {[
              ['Stored', stats ? bytes(stats.usedBytes) : '—'],
              ['Original', stats ? bytes(stats.originalBytes) : '—'],
              ['Saved', `${savedPct}%`],
              ['Parts', stats ? num(stats.partCount) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="bg-paper p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">{label}</p>
                <p className="display mt-1.5 text-[20px]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <Label>By file type</Label>
              <span className="font-mono text-[9px] text-faint">
                {stats ? pluralize(stats.fileCount, 'file') : '—'} · {stats ? num(stats.blockCount) : '—'} blocks
              </span>
            </div>
            <StackedBar segments={(stats?.byKind ?? []).slice(0, 6).map((k) => ({ value: k.bytes, label: KIND_LABEL[k.kind] }))} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {(stats?.byKind ?? []).slice(0, 6).map((k, index) => (
                <span key={k.kind} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                  <span className="size-2 bg-ink" style={{ opacity: 1 - index * 0.14 }} />
                  {KIND_LABEL[k.kind]} · {bytes(k.bytes)}
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section index="04" title="Compression policy" description="Zstandard is applied only where it pays. Already-compressed media is stored byte for byte.">
          <div className="border border-line">
            <div className="grid grid-cols-[1.1fr_1.2fr_1fr_1fr] gap-3 border-b border-line bg-sunken px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
              <span>Category</span>
              <span>Examples</span>
              <span>Policy</span>
              <span>Reason</span>
            </div>
            {POLICY.map((row) => (
              <div key={row.category} className="grid grid-cols-[1.1fr_1.2fr_1fr_1fr] gap-3 border-b border-line px-3 py-2 text-[11.5px] last:border-b-0">
                <span className="text-ink">{row.category}</span>
                <span className="font-mono text-[10px] text-muted">{row.examples}</span>
                <span className={row.policy === 'Skip' ? 'text-muted' : 'text-ink'}>{row.policy}</span>
                <span className="text-[10.5px] text-faint">{row.reason}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>threshold {settings?.compressionThresholdPct ?? 5}%</Badge>
            <Badge>zstd level 3</Badge>
            <Badge>sample 64 kib</Badge>
          </div>
          <div className="mt-3">
            <Toggle
              checked={settings?.autoCompress ?? true}
              onChange={(next) => update.mutate({ autoCompress: next })}
              label="Apply the policy automatically"
              description="When off, every file is stored as-is and you decide per upload."
            />
          </div>
        </Section>

        <Section
          index="05"
          title="Integrity"
          description="Every block carries a GCM tag and every part a hash. The periodic job confirms the parts still exist in Telegram."
          action={
            <Button size="sm" onClick={() => runIntegrity.mutate()} disabled={runIntegrity.isPending || integrity?.running}>
              {runIntegrity.isPending || integrity?.running ? <Spinner /> : <RefreshCcw className="size-3.5" />}
              Run check
            </Button>
          }
        >
          <div className="border border-line">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">Last check</span>
              <span className="font-mono text-[11px]">{integrity ? stamp(integrity.checkedAt) : '—'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">Parts verified</span>
              <span className="font-mono text-[11px]">
                {integrity ? `${num(integrity.partsOk)} / ${num(integrity.partsChecked)}` : '—'}{' '}
                <Badge tone={integrity && integrity.partsFailed > 0 ? 'alert' : 'line'}>
                  {integrity && integrity.partsFailed > 0 ? `${integrity.partsFailed} missing` : 'all present'}
                </Badge>
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">Blocks checked</span>
              <span className="font-mono text-[11px]">{integrity ? num(integrity.blocksChecked) : '—'}</span>
            </div>
          </div>
          {runIntegrity.isPending && (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
              walking every part · this is a simulated check
            </p>
          )}
        </Section>

        <Section index="06" title="Design parameters" description="Fixed for the demo. The real build exposes them in the first-run wizard.">
          <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
            {[
              ['Storage part', `${settings?.partSizeMiB ?? 100} MiB`],
              ['Encryption block', `${settings?.blockSizeMiB ?? 1} MiB`],
              ['Trash retention', `${settings?.trashRetentionDays ?? 30} d`],
              ['Skip threshold', `${settings?.compressionThresholdPct ?? 5} %`],
            ].map(([label, value]) => (
              <div key={label} className="bg-paper p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">{label}</p>
                <p className="mt-1 font-mono text-[12px]">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Toggle
              checked={settings?.scanOnUpload ?? false}
              onChange={(next) => update.mutate({ scanOnUpload: next })}
              label="Scan uploads with a local antivirus"
              description="Optional ClamAV pass before encryption. No external service is involved."
            />
          </div>
        </Section>

        <Section index="07" title="Appearance" description="Monochrome by design: two themes, no accent colours beyond the alert state.">
          <div className="grid grid-cols-2 gap-px border border-line bg-line sm:max-w-sm">
            {([
              ['dark', 'Dark', Moon],
              ['light', 'Light', Sun],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={
                  theme === id
                    ? 'flex items-center justify-center gap-2 bg-ink px-3 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-paper'
                    : 'flex items-center justify-center gap-2 bg-paper px-3 py-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted hover:text-ink'
                }
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section index="08" title="Demo" description="This build runs on a mock adapter: files, parts and Telegram ids are generated and kept in localStorage.">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={IS_MOCK ? 'alert' : 'line'}>{IS_MOCK ? 'mock data' : 'live api'}</Badge>
            <Badge>no bytes leave the browser</Badge>
            <Button size="sm" variant="danger" onClick={() => setResetOpen(true)}>
              Reset demo data
            </Button>
          </div>
        </Section>
      </div>

      <PassphraseDialog open={passphraseOpen} onClose={() => setPassphraseOpen(false)} />
      <RecoveryDialog open={recoveryOpen} onClose={() => setRecoveryOpen(false)} />

      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out of Telegram?"
        eyebrow="session"
        body="The encrypted session is discarded and the setup wizard runs again. Uploaded bytes stay in Telegram, but the local index is what makes them readable."
        confirmLabel="Sign out"
        danger
        onConfirm={async () => {
          await signOut.mutateAsync()
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo data?"
        eyebrow="local storage"
        body="Restores the seeded library, the setup state and the settings. The theme preference is kept."
        confirmLabel="Reset"
        danger
        onConfirm={async () => {
          await reset.mutateAsync()
        }}
      />
    </div>
  )
}
