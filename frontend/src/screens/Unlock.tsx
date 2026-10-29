import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, KeyRound } from 'lucide-react'
import { api, IS_MOCK } from '@/lib/api'
import { useSession } from '@/lib/useSession'
import { Badge, Button, Field, Mark, Spinner, TextInput } from '@/components/ui'

export function UnlockScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [mode, setMode] = useState<'passphrase' | 'recovery'>('passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [code, setCode] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)

  const done = async () => {
    await queryClient.invalidateQueries()
    navigate('/drive')
  }

  const unlock = useMutation({
    mutationFn: () => api.unlock(passphrase),
    onSuccess: done,
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not unlock.'),
  })

  const recover = useMutation({
    mutationFn: () => api.unlockWithRecovery(code, next),
    onSuccess: done,
    onError: (err) => setError(err instanceof Error ? err.message : 'The recovery code was not accepted.'),
  })

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper p-6 text-ink">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-line" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-line" />

      <div className="relative w-full max-w-[420px] border border-line bg-paper p-7">
        <div className="flex items-center gap-2.5">
          <Mark size={16} />
          <span className="display text-[14px] tracking-[-0.02em]">NIMBUS</span>
          <Badge className="ml-auto">{IS_MOCK ? 'demo' : 'local'}</Badge>
        </div>

        <p className="serif mt-8 text-[34px] leading-[1.05]">Your files, your keys.</p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          {session?.telegram
            ? `Unlock the local index for ${session.telegram.name}. Without this passphrase the stored bytes cannot be read.`
            : 'Unlock this instance to reach the local index and the Telegram session.'}
        </p>

        {mode === 'passphrase' ? (
          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (passphrase) unlock.mutate()
            }}
          >
            <Field label="Passphrase" error={error} hint="Demo: any non-empty passphrase unlocks.">
              <TextInput
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoFocus
                className="h-11"
              />
            </Field>
            <Button variant="primary" className="mt-4 h-10 w-full" type="submit" disabled={unlock.isPending || !passphrase}>
              {unlock.isPending ? <Spinner /> : <KeyRound className="size-3.5" />}
              Unlock <ArrowRight className="size-3.5" />
            </Button>
          </form>
        ) : (
          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (code && next) recover.mutate()
            }}
          >
            <div className="space-y-4">
              <Field label="Recovery code" error={error} hint="Eight groups of four characters.">
                <TextInput
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="NMB4-K7Q2-XW9R-T3HP-…"
                  autoFocus
                  className="font-mono text-[12px]"
                />
              </Field>
              <Field label="New passphrase" hint="Replaces the forgotten one; files are not re-encrypted.">
                <TextInput type="password" value={next} onChange={(event) => setNext(event.target.value)} />
              </Field>
            </div>
            <Button
              variant="primary"
              className="mt-4 h-10 w-full"
              type="submit"
              disabled={recover.isPending || code.length < 12 || next.length < 8}
            >
              {recover.isPending ? <Spinner /> : null}
              Recover access
            </Button>
          </form>
        )}

        <button
          onClick={() => {
            setMode(mode === 'passphrase' ? 'recovery' : 'passphrase')
            setError(null)
          }}
          className="mt-4 w-full text-center font-mono text-[9px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink"
        >
          {mode === 'passphrase' ? 'use a recovery code instead' : 'back to passphrase'}
        </button>
      </div>

      <div className="relative mt-6 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
        <span className="size-1.5 bg-ink" />
        local instance · aes-256-gcm · no external ai
      </div>
    </div>
  )
}
