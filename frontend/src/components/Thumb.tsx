import { KIND_LABEL, cx, seeded } from '@/lib/format'
import type { FileItem } from '@/lib/types'

/**
 * Deterministic monochrome artwork per file, so the contact sheet looks like a
 * real library without shipping stock imagery. In production these would be
 * server-generated thumbnails; the layout does not change.
 */
export function Thumb({ file, className, detail = false }: { file: FileItem; className?: string; detail?: boolean }) {
  const rand = seeded(file.thumbSeed)
  const type = KIND_LABEL[file.kind].toUpperCase()

  // A tonal composition rather than abstract shapes: a photograph has a horizon,
  // a light source and subject mass, and it reads at 96px where shapes do not.
  const photo = () => {
    const horizon = 118 + rand() * 58
    const sunX = 48 + rand() * 224
    const sunY = 40 + rand() * (horizon - 78)
    const sunR = 9 + rand() * 15

    // Smooth crests, not sawteeth: quadratic segments read as terrain.
    const ridge = (baseline: number, amplitude: number) => {
      const points: string[] = ['M0 240', `L0 ${baseline}`]
      let x = 0
      while (x < 320) {
        const stepW = 44 + rand() * 56
        const peak = baseline - amplitude * (0.3 + rand() * 0.7)
        points.push(`Q${x + stepW / 2} ${peak} ${x + stepW} ${baseline - amplitude * rand() * 0.3}`)
        x += stepW
      }
      points.push('L320 240 Z')
      return points.join(' ')
    }

    const towers = Array.from({ length: 3 + Math.floor(rand() * 3) }, (_, i) => {
      const w = 18 + rand() * 46
      const h = 18 + rand() * 58
      const x = 16 + i * (296 / 4) + rand() * 18
      return <rect key={i} x={x} y={240 - h} width={w} height={h} fill="#1d1d1c" opacity={0.72 + rand() * 0.24} />
    })

    return (
      <>
        <defs>
          {/* Fixed greys: a photograph keeps its own tonal range in either theme. */}
          <linearGradient id={`sky-${file.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cfccc4" />
            <stop offset="0.55" stopColor="#8e8c86" />
            <stop offset="1" stopColor="#6c6b66" />
          </linearGradient>
          <radialGradient id={`light-${file.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fffdf6" stopOpacity="0.75" />
            <stop offset="0.4" stopColor="#fffdf6" stopOpacity="0.2" />
            <stop offset="1" stopColor="#fffdf6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`vignette-${file.id}`} cx="50%" cy="42%" r="76%">
            <stop offset="0.5" stopColor="#121316" stopOpacity="0" />
            <stop offset="1" stopColor="#121316" stopOpacity="0.6" />
          </radialGradient>
          {detail && (
            <filter id={`grain-${file.id}`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          )}
        </defs>

        <rect width="320" height="240" fill={`url(#sky-${file.id})`} />
        <circle cx={sunX} cy={sunY} r={sunR * 2.6} fill={`url(#light-${file.id})`} />
        <circle cx={sunX} cy={sunY} r={sunR} fill="#fbf9f2" />

        {rand() > 0.42 && <path d={ridge(horizon, 40 + rand() * 30)} fill="#5a5955" opacity={0.9} />}
        <path d={ridge(horizon + 20, 18 + rand() * 26)} fill="#3f3e3b" />

        <rect y={horizon + 30} width="320" height={240 - horizon - 30} fill="#33322f" />
        {towers}

        <rect width="320" height="240" fill={`url(#vignette-${file.id})`} />
        {detail && (
          <rect width="320" height="240" filter={`url(#grain-${file.id})`} opacity="0.11" className="mix-blend-overlay" />
        )}
      </>
    )
  }

  const body = () => {
    if (file.kind === 'image') return photo()

    // A video thumbnail is a frame of the footage, so it reuses the photograph
    // treatment and only adds the play affordance and a timecode strip.
    if (file.kind === 'video') {
      return (
        <>
          {photo()}
          <rect width="320" height="240" fill="#121316" opacity="0.28" />
          <g transform="translate(160 112)">
            <circle r="25" fill="#f2f1ee" opacity="0.94" />
            <path d="M-5 -10 L12 0 L-5 10 Z" fill="#121316" />
          </g>
          <rect x="0" y="212" width="320" height="28" fill="#121316" opacity="0.72" />
          <text x="12" y="230" fill="#f2f1ee" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.4" opacity="0.85">
            MP4 · RANGE · 1 MIB BLOCKS
          </text>
        </>
      )
    }

    if (file.kind === 'audio') {
      const bars = Array.from({ length: 44 }, (_, i) => {
        const height = 14 + rand() * 96
        return (
          <rect
            key={i}
            x={16 + i * 6.6}
            y={120 - height / 2}
            width="2"
            height={height}
            className="fill-ink"
            opacity={0.35 + rand() * 0.5}
          />
        )
      })
      return (
        <>
          {bars}
          <line x1="16" y1="120" x2="304" y2="120" className="stroke-ink" strokeOpacity={0.18} />
          <text x="16" y="42" className="fill-muted" fontSize="9" fontFamily="var(--font-mono)" letterSpacing="1.4">
            AUDIO
          </text>
        </>
      )
    }

    if (file.kind === 'archive') {
      return (
        <>
          <defs>
            <pattern id={`hatch-${file.id}`} width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" className="stroke-ink" strokeOpacity={0.18} />
            </pattern>
          </defs>
          <rect width="320" height="240" fill={`url(#hatch-${file.id})`} />
          <rect x="118" y="46" width="84" height="148" className="fill-paper" opacity={0.9} />
          <rect x="118" y="46" width="84" height="148" className="fill-none stroke-ink" strokeOpacity={0.35} />
          <line x1="160" y1="46" x2="160" y2="194" className="stroke-ink" strokeOpacity={0.3} strokeDasharray="3 4" />
        </>
      )
    }

    // documents, sheets, slides, code, text, other → a technical "paper" card
    return (
      <>
        <rect x="46" y="26" width="228" height="188" className="fill-paper" opacity={0.85} />
        <rect x="46" y="26" width="228" height="188" className="fill-none stroke-ink" strokeOpacity={0.28} />
        {Array.from({ length: 7 }, (_, i) => (
          <rect
            key={i}
            x="62"
            y={48 + i * 13}
            width={i === 6 ? 80 : 120 + rand() * 70}
            height="2"
            className="fill-ink"
            opacity={i === 0 ? 0.55 : 0.18}
          />
        ))}
        <text x="62" y="192" className="fill-ink" fontSize="30" fontFamily="var(--font-mono)" letterSpacing="-1">
          {type}
        </text>
      </>
    )
  }

  return (
    <svg
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMid slice"
      className={cx('block h-full w-full', className)}
      role="img"
      aria-label={`${file.name} preview`}
    >
      <rect width="320" height="240" className="fill-sunken" />
      {body()}
      {[
        [8, 8],
        [312, 8],
        [8, 232],
        [312, 232],
      ].map(([x, y], i) => (
        <g key={i} className="stroke-ink" strokeOpacity={0.3}>
          <line x1={x - 4} y1={y} x2={x + 4} y2={y} />
          <line x1={x} y1={y - 4} x2={x} y2={y + 4} />
        </g>
      ))}
    </svg>
  )
}
