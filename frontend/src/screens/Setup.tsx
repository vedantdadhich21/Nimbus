import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { cx } from '@/lib/format'
import { Badge, Button, Field, Label, Mark, Spinner, TextInput, Toggle, useToast } from '@/components/ui'

const STEPS = [
  { label: 'Welcome', short: 'Start' },
  { label: 'API credentials', short: 'api_id' },
  { label: 'Phone number', short: 'phone' },
  { label: 'Login code', short: 'code' },
  { label: 'Two-step password', short: '2fa' },
  { label: 'Passphrase', short: 'passphrase' },
  { label: 'Recovery code', short: 'recovery' },
  { label: 'Ready', short: 'done' },
]

export function SetupScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: setup, isLoading } = useQuery({ queryKey: ['setup'], queryFn: () => api.getSetupState() })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: () => api.getStats() })
  const [step, setStep] = useState(0)
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('+91 ')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [repeat, setRepeat] = useState('')
  const [recovery, setRecovery] = useState('')
  const [savedCode, setSavedCode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!setup || step !== 0) return
    if (setup.step > 0 && setup.step < 7) setStep(setup.step)
    // A reload on the recovery screen must land back there, not on the welcome page.
    else if (setup.step === 7 && !setup.completed && setup.recoveryCode) setStep(6)
  }, [setup, step])

  // The recovery code survives a reload because the server keeps it; local state
  // only carries the value returned during this session.
  const recoveryCode = recovery || setup?.recoveryCode || ''

  const advance = (next: number) => {
    setError(null)
    setStep(next)
  }

  const credentials = useMutation({
    mutationFn: () => api.setupCredentials(apiId, apiHash),
    onSuccess: () => advance(2),
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save the credentials.'),
  })

  const savePhone = useMutation({
    mutationFn: () => api.setupPhone(phone),
    onSuccess: () => advance(3),
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not send the code.'),
  })

  const saveCode = useMutation({
    mutationFn: () => api.setupCode(code),
    onSuccess: (res) => advance(res.needsPassword ? 4 : 5),
    onError: (err) => setError(err instanceof Error ? err.message : 'The code was not accepted.'),
  })

  const savePassword = useMutation({
    mutationFn: () => api.setupPassword(password),
    onSuccess: () => advance(5),
    onError: (err) => setError(err instanceof Error ? err.message : 'The password was not accepted.'),
  })

  const savePassphrase = useMutation({
    mutationFn: () => api.setupPassphrase(passphrase),
    onSuccess: (res) => {
      setRecovery(res.recoveryCode)
      advance(6)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not set the passphrase.'),
  })

  const skip = useMutation({
    mutationFn: () => api.skipSetup(),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Setup skipped', body: 'Signed in with the seeded demo account.' })
      navigate('/drive')
    },
  })

  const complete = useMutation({
    mutationFn: () => api.setupComplete(),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast({ title: 'Nimbus is ready', body: 'Session encrypted · index built · nothing uploaded yet.' })
      navigate('/drive')
    },
  })

  const strength = [passphrase.length >= 8, passphrase.length >= 14, /[A-Z]/.test(passphrase) && /\d/.test(passphrase), /[^A-Za-z0-9]/.test(passphrase)]
  const mockStep = step >= 1 && step <= 4

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner className="size-5" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <aside className="hidden w-[42%] max-w-[540px] flex-col justify-between border-r border-line p-8 lg:flex">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => skip.mutate()}
            disabled={skip.isPending}
            title="Skip setup and enter the demo drive"
            className="flex items-center gap-2.5 disabled:opacity-50"
          >
            <Mark size={18} />
            <span className="display text-[15px] tracking-[-0.02em]">NIMBUS</span>
          </button>
          <button
            onClick={() => skip.mutate()}
            disabled={skip.isPending}
            className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-faint transition-colors hover:text-ink disabled:opacity-50"
          >
            {skip.isPending ? 'skipping…' : 'skip setup →'}
          </button>
        </div>

        <div>
          <p className="serif text-[38px] leading-[1.05] xl:text-[46px]">
            Your files. Your keys. Your own Telegram account.
          </p>
          <ol className="mt-9 space-y-px">
            {STEPS.map((item, index) => {
              const done = index < step
              const active = index === step
              return (
                <li
                  key={item.label}
                  className={cx(
                    'flex items-center gap-3 border-l-2 py-2 pl-3',
                    active ? 'border-ink' : done ? 'border-line-strong' : 'border-transparent',
                  )}
                >
                  <span className={cx('w-6 font-mono text-[9px]', active ? 'text-ink' : 'text-faint')}>
                    {done ? <Check className="size-3" /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={cx('font-mono text-[10px] uppercase tracking-[0.14em]', active ? 'text-ink' : 'text-faint')}>
                    {item.label}
                  </span>
                  {active && <span className="ml-auto size-1.5 bg-ink" />}
                </li>
              )
            })}
          </ol>
        </div>

        <p className="max-w-xs text-[11.5px] leading-relaxed text-muted">
          Nimbus runs on your machine. It talks to Telegram over MTProto with your own API credentials, and keeps
          every filename, part id and vector in a local database you own.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[460px]">
          <div className="mb-7 flex items-center gap-2">
            <Label>
              Step {String(step + 1).padStart(2, '0')} / 08
            </Label>
            {mockStep && <Badge tone="alert">mock handshake</Badge>}
            <button
              onClick={() => skip.mutate()}
              disabled={skip.isPending}
              className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink disabled:opacity-50"
            >
              {skip.isPending ? 'skipping…' : 'skip setup'}
            </button>
          </div>

          {step === 0 && (
            <div className="rise">
              <h1 className="display text-[30px] leading-[1.05]">Turn Telegram into a drive.</h1>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                Three things happen in this wizard: Nimbus signs in to your Telegram account, derives the key that
                protects your files, and gives you a recovery code. Nothing is uploaded until you add a file.
              </p>
              <ul className="mt-6 space-y-px border border-line">
                {[
                  ['01', 'Your own api_id and api_hash', 'Free from my.telegram.org; the app identifier, not your password.'],
                  ['02', 'A phone login', 'Telegram sends the code to your Telegram app, not by SMS.'],
                  ['03', 'A passphrase', 'Argon2id turns it into a key that wraps your master key.'],
                ].map(([index, title, body]) => (
                  <li key={index} className="flex gap-3 border-b border-line p-3 last:border-b-0">
                    <span className="font-mono text-[9px] text-faint">{index}</span>
                    <div>
                      <p className="text-[12.5px]">{title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => advance(1)}>
                  Begin setup <ArrowRight className="size-3.5" />
                </Button>
                <Button onClick={() => skip.mutate()} disabled={skip.isPending} className="shrink-0">
                  Skip
                </Button>
              </div>
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                demo · no account is contacted
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="rise">
              <h1 className="display text-[26px]">Application credentials</h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                Nimbus signs in as a user account, so it needs an application identifier. Create one once at
                Telegram&apos;s developer site.
              </p>
              <a
                href="https://my.telegram.org/apps"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
              >
                my.telegram.org/apps <ExternalLink className="size-3" />
              </a>

              <div className="mt-6 space-y-4">
                <Field label="api_id" hint="Numeric, 5–10 digits." error={error}>
                  <TextInput
                    value={apiId}
                    onChange={(event) => setApiId(event.target.value)}
                    placeholder="12345678"
                    inputMode="numeric"
                    autoFocus
                  />
                </Field>
                <Field label="api_hash" hint="32 hexadecimal characters.">
                  <TextInput
                    value={apiHash}
                    onChange={(event) => setApiHash(event.target.value)}
                    placeholder="0123456789abcdef0123456789abcdef"
                    className="font-mono text-[12px]"
                  />
                </Field>
              </div>

              <div className="mt-6 flex gap-2">
                <Button onClick={() => advance(0)}>Back</Button>
                <Button variant="primary" className="flex-1" onClick={() => credentials.mutate()} disabled={credentials.isPending}>
                  {credentials.isPending ? <Spinner /> : null}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="rise">
              <h1 className="display text-[26px]">Phone number</h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                Telegram will send a login code to your Telegram app. Use the number the account is registered with,
                including the country code.
              </p>
              <div className="mt-6">
                <Field label="Phone" hint="In the demo, any 10-digit number works." error={error}>
                  <TextInput
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+91 98765 43210"
                    inputMode="tel"
                    autoFocus
                    className="font-mono"
                  />
                </Field>
              </div>
              <div className="mt-6 flex gap-2">
                <Button onClick={() => advance(1)}>Back</Button>
                <Button variant="primary" className="flex-1" onClick={() => savePhone.mutate()} disabled={savePhone.isPending}>
                  {savePhone.isPending ? <Spinner /> : null}
                  Send code
                </Button>
              </div>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                a real deployment would hit FLOOD_WAIT here; the gateway backs off automatically
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="rise">
              <h1 className="display text-[26px]">Login code</h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                Enter the five-digit code Telegram just sent to your app.
              </p>
              <div className="mt-6">
                <Field label="Code" hint="Demo: any five digits." error={error}>
                  <TextInput
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="00000"
                    inputMode="numeric"
                    autoFocus
                    className="h-12 text-center font-mono text-[20px] tracking-[0.6em]"
                  />
                </Field>
              </div>
              <div className="mt-6 flex gap-2">
                <Button onClick={() => advance(2)}>Back</Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => saveCode.mutate()}
                  disabled={saveCode.isPending || code.length < 4}
                >
                  {saveCode.isPending ? <Spinner /> : null}
                  Verify
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="rise">
              <h1 className="display text-[26px]">Two-step password</h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                This account has two-step verification enabled. Nimbus requires it: a stolen session file is far less
                useful with it in place.
              </p>
              <div className="mt-6">
                <Field label="Password" optional hint="Leave empty to skip in the demo." error={error}>
                  <TextInput
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoFocus
                  />
                </Field>
              </div>
              <div className="mt-6 flex gap-2">
                <Button
                  onClick={() => savePassword.mutate()}
                  disabled={savePassword.isPending}
                  className="flex-1"
                >
                  Skip for now
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => savePassword.mutate()}
                  disabled={savePassword.isPending || password.length === 0}
                >
                  {savePassword.isPending ? <Spinner /> : null}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="rise">
              <h1 className="display text-[26px]">Choose a passphrase</h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                This passphrase unwraps the master key that protects every file. Nobody can reset it — not Nimbus,
                not Telegram. Forgetting it is recoverable only with your recovery code.
              </p>
              <div className="mt-6 space-y-4">
                <Field label="Passphrase" hint="At least 8 characters in the demo; use a long phrase in practice." error={error}>
                  <TextInput
                    type="password"
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    autoFocus
                  />
                </Field>
                <div className="flex gap-1">
                  {strength.map((ok, index) => (
                    <span key={index} className={cx('h-[3px] flex-1', ok ? 'bg-ink' : 'bg-line')} />
                  ))}
                </div>
                <Field label="Repeat passphrase" error={repeat && repeat !== passphrase ? 'The two entries differ.' : null}>
                  <TextInput type="password" value={repeat} onChange={(event) => setRepeat(event.target.value)} />
                </Field>
              </div>
              <Button
                variant="primary"
                className="mt-6 w-full"
                onClick={() => savePassphrase.mutate()}
                disabled={savePassphrase.isPending || passphrase.length < 8 || passphrase !== repeat}
              >
                {savePassphrase.isPending ? <Spinner /> : null}
                Derive key with Argon2id
              </Button>
            </div>
          )}

          {step === 6 && (
            <div className="rise">
              <h1 className="display text-[26px]">Save your recovery code</h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                A second copy of the master key is wrapped with this code. It is shown once. Write it down and keep it
                somewhere other than this machine.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
                {recoveryCode.split('-').map((group, index) => (
                  <div key={index} className="bg-paper px-2 py-3 text-center font-mono text-[12px] tracking-[0.14em]">
                    {group}
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">nmb4-k7q2-…</span>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(recoveryCode)
                    toast({ title: 'Recovery code copied' })
                  }}
                  className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted hover:text-ink"
                >
                  <Copy className="size-3" /> copy
                </button>
              </div>

              <div className="mt-5">
                <Toggle
                  checked={savedCode}
                  onChange={setSavedCode}
                  label="I have written the code down"
                  description="Without it and the passphrase, the data cannot be decrypted — by anyone."
                />
              </div>

              <Button variant="primary" className="mt-4 w-full" disabled={!savedCode} onClick={() => advance(7)}>
                Continue
              </Button>
            </div>
          )}

          {step >= 7 && (
            <div className="rise">
              <h1 className="display text-[30px] leading-[1.05]">Ready.</h1>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                The session is encrypted, the master key is wrapped twice, and the local index is empty. Add a file
                and the pipeline runs for the first time.
              </p>
              <div className="mt-6 border border-line">
                {[
                  ['Account', 'Vedant Dadhich · @vedant_d'],
                  ['Session', 'encrypted · Argon2id'],
                  ['Master key', 'wrapped ×2 · passphrase + recovery'],
                  ['Storage', 'Saved Messages · 2 GB per file'],
                  [
                    'Index',
                    stats && stats.fileCount > 0
                      ? `${stats.fileCount} files · ${stats.partCount} parts`
                      : 'empty · 0 files',
                  ],
                ].map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between border-b border-line px-3 py-2.5 last:border-b-0">
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">{key}</span>
                    <span className="font-mono text-[10.5px]">{value}</span>
                  </div>
                ))}
              </div>
              <Button variant="primary" className="mt-5 w-full" onClick={() => complete.mutate()} disabled={complete.isPending}>
                {complete.isPending ? <Spinner /> : null}
                Enter Nimbus <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
