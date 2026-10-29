import type {
  CompressionInfo,
  Db,
  FileItem,
  FileKind,
  Folder,
  PartInfo,
  PreviewInfo,
} from './types'
import { hex, kindForName, mimeForKind, seeded } from './format'

const DAY = 86_400_000
const HOUR = 3_600_000
const MiB = 1024 * 1024

const iso = (daysAgo: number, hoursAgo = 0) =>
  new Date(Date.now() - daysAgo * DAY - hoursAgo * HOUR).toISOString()

export const DEMO_VERSION = 8

const folder = (id: string, name: string, parentId: string | null, daysAgo: number): Folder => ({
  id,
  name,
  parentId,
  createdAt: iso(daysAgo),
})

export const SEED_FOLDERS: Folder[] = [
  folder('d-docs', 'Documents', null, 210),
  folder('d-docs-sem5', 'Semester V', 'd-docs', 96),
  folder('d-docs-papers', 'Papers', 'd-docs', 74),
  folder('d-docs-reports', 'Reports', 'd-docs', 61),
  folder('d-photos', 'Photos', null, 240),
  folder('d-photos-2026', '2026', 'd-photos', 120),
  folder('d-photos-shots', 'Screenshots', 'd-photos', 88),
  folder('d-projects', 'Projects', null, 190),
  folder('d-projects-nimbus', 'Nimbus', 'd-projects', 140),
  folder('d-recordings', 'Recordings', null, 100),
  folder('d-archive', 'Archive', null, 300),
]

interface Spec {
  name: string
  folder: string | null
  size: number
  days: number
  topics: string[]
  snippet: string
  kind?: FileKind
  starred?: boolean
  versions?: number
  deletedDaysAgo?: number
}

const SPECS: Spec[] = [
  // ── root ────────────────────────────────────────────────────────────────
  {
    name: 'car-repair-invoice.pdf',
    folder: null,
    size: 218_400,
    days: 3,
    topics: ['invoice', 'car', 'repair', 'garage', 'service', 'billing', 'payment', 'receipt'],
    snippet: 'Service invoice from Sharma Auto Works for the front brake pads and wheel alignment.',
    starred: true,
  },
  {
    name: 'electricity-bill-sep.pdf',
    folder: null,
    size: 96_200,
    days: 26,
    topics: ['bill', 'electricity', 'utility', 'payment', 'invoice', 'hostel'],
    snippet: 'MPPKVVCL bill for September 2026, connection 4402-118-226.',
  },
  {
    name: 'train-ticket-3nov.pdf',
    folder: null,
    size: 74_800,
    days: 9,
    topics: ['ticket', 'train', 'travel', 'journey', 'booking', 'indore', 'bhopal'],
    snippet: 'IRCTC e-ticket, Indore to Bhopal, 3 November 2026, coach C2.',
  },
  {
    name: 'todo.txt',
    folder: null,
    size: 3_180,
    days: 1,
    topics: ['tasks', 'todo', 'checklist', 'planning'],
    snippet: 'Finish chapter 4 diagrams, send report to guide, book lab slot for demo.',
  },
  {
    name: 'attendance-tracker.xlsx',
    folder: null,
    size: 284_000,
    days: 14,
    topics: ['attendance', 'sheet', 'college', 'subjects', 'percentage'],
    snippet: 'Subject-wise attendance for semester V with the 75 percent threshold.',
  },
  {
    name: 'CGPA-calculator.xlsx',
    folder: null,
    size: 164_000,
    days: 130,
    topics: ['cgpa', 'marks', 'grades', 'result', 'sheet'],
    snippet: 'Semester-wise SGPA and running CGPA calculator.',
  },
  {
    name: 'IMG_20261012_223311.jpg',
    folder: null,
    size: 6_240_000,
    days: 17,
    topics: ['photo', 'image', 'night', 'hostel', 'friends'],
    snippet: 'Night shot from the hostel terrace after the project review.',
  },
  {
    name: 'Nimbus-Project-Report-FINAL.docx',
    folder: null,
    size: 4_410_000,
    days: 2,
    topics: ['report', 'nimbus', 'project', 'document', 'thesis', 'chapters'],
    snippet: 'Chapters 1 to 4 with the revised security hardening section.',
    starred: true,
    versions: 3,
  },

  // ── Documents ───────────────────────────────────────────────────────────
  {
    name: 'Nimbus_Report_Ch1-4.pdf',
    folder: 'd-docs',
    size: 6_310_000,
    days: 1,
    topics: ['report', 'nimbus', 'project', 'pdf', 'embedding', 'local', 'research', 'compression', 'storage'],
    snippet: 'Full draft of the report: local embeddings, problem statement, literature review, design.',
    starred: true,
    versions: 2,
  },
  {
    name: 'DBMS-Unit3-Normalization.pdf',
    folder: 'd-docs',
    size: 3_420_000,
    days: 5,
    topics: ['dbms', 'database', 'normalization', 'sql', 'notes', 'exam', 'unit'],
    snippet: 'Functional dependencies, 1NF to BCNF, decomposition and lossless joins.',
  },
  {
    name: 'Operating-Systems-Unit4.pdf',
    folder: 'd-docs',
    size: 4_120_000,
    days: 6,
    topics: ['operating systems', 'os', 'notes', 'scheduling', 'deadlock', 'memory'],
    snippet: 'CPU scheduling, deadlock avoidance and virtual memory notes.',
  },
  {
    name: 'SE-viva-questions.docx',
    folder: 'd-docs',
    size: 842_000,
    days: 12,
    topics: ['software engineering', 'viva', 'questions', 'exam', 'preparation'],
    snippet: 'Forty likely viva questions with one-line answers.',
  },
  {
    name: 'RGPV-syllabus-CSE-2026.pdf',
    folder: 'd-docs',
    size: 1_240_000,
    days: 62,
    topics: ['syllabus', 'rgpv', 'college', 'course', 'curriculum'],
    snippet: 'Official scheme and syllabus for B.Tech. Computer Engineering.',
  },
  {
    name: 'Placement-resume-final.pdf',
    folder: 'd-docs',
    size: 402_000,
    days: 21,
    topics: ['resume', 'placement', 'cv', 'career', 'internship'],
    snippet: 'One-page resume with the Nimbus project and the SI intern role.',
    starred: true,
    versions: 4,
  },

  // ── Documents / Semester V ──────────────────────────────────────────────
  {
    name: 'CN-assignment-2.pdf',
    folder: 'd-docs-sem5',
    size: 1_120_000,
    days: 8,
    topics: ['computer networks', 'assignment', 'cn', 'subnetting', 'routing'],
    snippet: 'Subnetting problems with VLSM and a short note on OSPF.',
  },
  {
    name: 'DBMS-lab-manual.pdf',
    folder: 'd-docs-sem5',
    size: 2_880_000,
    days: 18,
    topics: ['dbms', 'lab', 'manual', 'database', 'experiments', 'notes'],
    snippet: 'Twelve experiments: DDL, joins, triggers, procedures and transactions.',
  },
  {
    name: 'OS-lab-file.docx',
    folder: 'd-docs-sem5',
    size: 1_940_000,
    days: 16,
    topics: ['operating systems', 'lab', 'file', 'experiments', 'report'],
    snippet: 'Lab record with outputs for fork, threads and page replacement.',
  },
  {
    name: 'Maths-tutorial-sheet-07.pdf',
    folder: 'd-docs-sem5',
    size: 618_000,
    days: 11,
    topics: ['maths', 'tutorial', 'sheet', 'probability', 'assignment'],
    snippet: 'Sheet 7 on probability distributions and moment generating functions.',
  },
  {
    name: 'DS-unit1-notes.md',
    folder: 'd-docs-sem5',
    size: 86_400,
    days: 4,
    topics: ['data structures', 'ds', 'notes', 'linked list', 'stack', 'queue'],
    snippet: 'Arrays, linked lists, stacks and queues with complexity table.',
  },

  // ── Documents / Papers ──────────────────────────────────────────────────
  {
    name: 'attention-is-all-you-need.pdf',
    folder: 'd-docs-papers',
    size: 2_210_000,
    days: 44,
    topics: ['attention', 'transformer', 'paper', 'nlp', 'deep learning', 'embedding', 'research'],
    snippet: 'Vaswani et al., 2017. The transformer architecture built on self-attention.',
  },
  {
    name: 'sentence-bert-2019.pdf',
    folder: 'd-docs-papers',
    size: 1_640_000,
    days: 44,
    topics: ['sentence bert', 'embedding', 'paper', 'similarity', 'nlp', 'research'],
    snippet: 'Reimers and Gurevych. Siamese networks for sentence embeddings.',
  },
  {
    name: 'clip-2021.pdf',
    folder: 'd-docs-papers',
    size: 3_810_000,
    days: 41,
    topics: ['clip', 'image', 'embedding', 'paper', 'vision', 'research', 'zero shot'],
    snippet: 'Radford et al. Contrastive language-image pre-training.',
  },
  {
    name: 'televault-notes.md',
    folder: 'd-docs-papers',
    size: 24_800,
    days: 33,
    topics: ['televault', 'notes', 'compression', 'encryption', 'chunk', 'prior art'],
    snippet: 'Reading notes on TeleVault: zstd, AES-256-GCM, pinned-message index.',
  },

  // ── Documents / Reports ─────────────────────────────────────────────────
  {
    name: 'Seminar-report-draft.docx',
    folder: 'd-docs-reports',
    size: 2_640_000,
    days: 27,
    topics: ['seminar', 'report', 'draft', 'document', 'college'],
    snippet: 'Draft seminar report on privacy-preserving storage, 14 pages.',
  },
  {
    name: 'Literature-review-v2.pdf',
    folder: 'd-docs-reports',
    size: 3_180_000,
    days: 7,
    topics: ['literature review', 'report', 'research', 'papers', 'survey'],
    snippet: 'Twenty-one references with a comparison table of Telegram-based tools.',
    versions: 2,
  },
  {
    name: 'Plagiarism-receipt.pdf',
    folder: 'd-docs-reports',
    size: 128_000,
    days: 9,
    topics: ['plagiarism', 'receipt', 'report', 'similarity', 'college'],
    snippet: 'Department similarity report, 6 percent, 54 pages.',
  },
  {
    name: 'Nimbus-review-slides.pptx',
    folder: 'd-docs-reports',
    size: 8_460_000,
    days: 3,
    topics: ['slides', 'presentation', 'nimbus', 'review', 'deck', 'project'],
    snippet: 'Thirteen slides for the second review, with speaker notes.',
  },

  // ── Photos ──────────────────────────────────────────────────────────────
  {
    name: 'IMG_20260312_104233.jpg',
    folder: 'd-photos',
    size: 4_820_000,
    days: 52,
    topics: ['photo', 'image', 'campus', 'morning'],
    snippet: 'Camera upload, no caption.',
  },
  {
    name: 'IMG_20260314_181002.jpg',
    folder: 'd-photos',
    size: 5_240_000,
    days: 50,
    topics: ['photo', 'image', 'evening', 'campus'],
    snippet: 'Camera upload, no caption.',
  },
  {
    name: 'campus-main-building.jpg',
    folder: 'd-photos',
    size: 7_120_000,
    days: 74,
    topics: ['campus', 'building', 'college', 'photo', 'architecture'],
    snippet: 'Front elevation of the main building after the rain.',
  },
  {
    name: 'convocation-2026.jpg',
    folder: 'd-photos',
    size: 6_880_000,
    days: 38,
    topics: ['convocation', 'ceremony', 'college', 'photo', 'event', 'graduation'],
    snippet: 'Convocation stage, batch of 2026.',
  },

  // ── Photos / 2026 ───────────────────────────────────────────────────────
  {
    name: 'fest-group-photo.jpg',
    folder: 'd-photos-2026',
    size: 8_120_000,
    days: 19,
    topics: ['fest', 'group', 'photo', 'friends', 'event', 'campus', 'team'],
    snippet: 'The five of us after the tech-fest closing ceremony.',
    starred: true,
  },
  {
    name: 'fest-stage-01.jpg',
    folder: 'd-photos-2026',
    size: 6_420_000,
    days: 19,
    topics: ['fest', 'stage', 'photo', 'event', 'music', 'campus'],
    snippet: 'Main stage sound check, day two of the fest.',
  },
  {
    name: 'holi-2026.jpg',
    folder: 'd-photos-2026',
    size: 5_320_000,
    days: 210,
    topics: ['holi', 'festival', 'photo', 'friends', 'celebration'],
    snippet: 'Holi in the hostel courtyard.',
  },
  {
    name: 'trek-pachmarhi-01.jpg',
    folder: 'd-photos-2026',
    size: 9_140_000,
    days: 88,
    topics: ['trek', 'pachmarhi', 'trip', 'photo', 'hills', 'travel'],
    snippet: 'Ridge walk above Pachmarhi at sunrise.',
  },
  {
    name: 'trek-pachmarhi-02.jpg',
    folder: 'd-photos-2026',
    size: 8_760_000,
    days: 88,
    topics: ['trek', 'pachmarhi', 'trip', 'photo', 'waterfall', 'travel'],
    snippet: 'Bee Falls after the monsoon.',
  },

  // ── Photos / Screenshots ────────────────────────────────────────────────
  {
    name: 'Screenshot_2026-10-21_at_11.42.10.png',
    folder: 'd-photos-shots',
    size: 1_240_000,
    days: 7,
    topics: ['screenshot', 'ui', 'design', 'interface', 'draft'],
    snippet: 'Early layout of the file manager, before the monochrome pass.',
  },
  {
    name: 'Screenshot_2026-10-19_at_09.15.44.png',
    folder: 'd-photos-shots',
    size: 986_000,
    days: 9,
    topics: ['screenshot', 'terminal', 'error', 'debug'],
    snippet: 'Terminal output while debugging the upload queue.',
  },
  {
    name: 'telegram-flood-wait.png',
    folder: 'd-photos-shots',
    size: 412_000,
    days: 6,
    topics: ['screenshot', 'telegram', 'rate limit', 'flood wait', 'error'],
    snippet: 'A FLOOD_WAIT response captured during an upload test.',
  },

  // ── Projects ────────────────────────────────────────────────────────────
  {
    name: 'nimbus-design-notes.md',
    folder: 'd-projects',
    size: 42_100,
    days: 4,
    topics: ['nimbus', 'design', 'notes', 'architecture', 'chunk', 'encryption'],
    snippet: 'Decisions log: part size, block size, nonce layout, key hierarchy.',
  },
  {
    name: 'telegram-drive-source.zip',
    folder: 'd-projects',
    size: 64_200_000,
    days: 57,
    topics: ['telegram drive', 'source', 'archive', 'reference', 'code'],
    snippet: 'Reference checkout, used to study how folders map to channels.',
  },

  // ── Projects / Nimbus ───────────────────────────────────────────────────
  {
    name: 'chunker.py',
    folder: 'd-projects-nimbus',
    size: 12_480,
    days: 5,
    topics: ['code', 'python', 'chunk', 'split', 'upload', 'nimbus'],
    snippet: 'Splits a stream into storage parts and encryption blocks.',
  },
  {
    name: 'db-schema.sql',
    folder: 'd-projects-nimbus',
    size: 8_240,
    days: 5,
    topics: ['code', 'sql', 'schema', 'database', 'nimbus'],
    snippet: 'folders, files, parts, embeddings, keys and settings tables.',
  },
  {
    name: 'nimbus-figure-4-1.svg',
    folder: 'd-projects-nimbus',
    size: 318_000,
    days: 15,
    topics: ['diagram', 'architecture', 'figure', 'svg', 'nimbus'],
    snippet: 'Architecture diagram for the report. Vector source, never rendered inline.',
  },
  {
    name: 'key-hierarchy.png',
    folder: 'd-projects-nimbus',
    size: 742_000,
    days: 15,
    topics: ['diagram', 'keys', 'encryption', 'figure', 'nimbus', 'master key'],
    snippet: 'Passphrase and recovery code wrapping the master key.',
  },

  // ── Recordings ──────────────────────────────────────────────────────────
  {
    name: 'seminar-dry-run.mp4',
    folder: 'd-recordings',
    size: 241_600_000,
    days: 13,
    topics: ['recording', 'seminar', 'presentation', 'video', 'rehearsal', 'nimbus'],
    snippet: 'Full rehearsal of the ten-minute presentation, 9 min 41 s.',
  },
  {
    name: 'viva-practice-01.m4a',
    folder: 'd-recordings',
    size: 12_400_000,
    days: 22,
    topics: ['recording', 'audio', 'viva', 'practice', 'questions'],
    snippet: 'Mock viva with Saif asking the security questions.',
  },
  {
    name: 'voice-note-telegram.ogg',
    folder: 'd-recordings',
    size: 1_180_000,
    days: 30,
    topics: ['audio', 'voice', 'note', 'telegram', 'message'],
    snippet: 'Forwarded voice note about the review schedule.',
  },

  // ── Archive ─────────────────────────────────────────────────────────────
  {
    name: 'semester-4-backup.zip',
    folder: 'd-archive',
    size: 4_080_000_000,
    days: 148,
    topics: ['backup', 'archive', 'semester', 'college', 'zip', 'notes'],
    snippet: 'Everything from semester IV: notes, assignments, lab files.',
  },
  {
    name: 'phone-backup-2026.zip',
    folder: 'd-archive',
    size: 1_180_000_000,
    days: 96,
    topics: ['backup', 'phone', 'archive', 'photos', 'contacts'],
    snippet: 'Full phone backup before the screen replacement.',
  },
  {
    name: 'old-website.tar.gz',
    folder: 'd-archive',
    size: 226_800_000,
    days: 260,
    topics: ['archive', 'website', 'code', 'old', 'portfolio'],
    snippet: 'Static portfolio site, replaced in 2025.',
  },

  // ── trash ───────────────────────────────────────────────────────────────
  {
    name: 'old-resume.pdf',
    folder: 'd-docs',
    size: 318_000,
    days: 40,
    deletedDaysAgo: 4,
    topics: ['resume', 'old', 'cv', 'placement'],
    snippet: 'Superseded resume from the first placement drive.',
  },
  {
    name: 'IMG_20250101_0001.jpg',
    folder: 'd-photos',
    size: 3_240_000,
    days: 120,
    deletedDaysAgo: 2,
    topics: ['photo', 'duplicate', 'image'],
    snippet: 'Duplicate camera upload.',
  },
  {
    name: 'temp-export.zip',
    folder: 'd-archive',
    size: 42_400_000,
    days: 60,
    deletedDaysAgo: 12,
    topics: ['archive', 'temp', 'export', 'zip'],
    snippet: 'Temporary export from the old database.',
  },
]

const POLICY_NOTE: Record<string, string> = {
  text: 'Plain text — high redundancy, zstd level 3.',
  code: 'Source code — high redundancy, zstd level 3.',
  pdf: 'Sampled 64 KiB, compressed because the saving exceeded 5%.',
  document: 'Office package — sampled, compressed when it pays off.',
  sheet: 'Office package — sampled, compressed when it pays off.',
  slide: 'Office package — sampled, compressed when it pays off.',
  image: 'JPEG/PNG is already compressed — stored as is.',
  video: 'Already compressed — stored as is.',
  audio: 'Already compressed — stored as is.',
  archive: 'Already compressed — stored as is.',
  other: 'Unknown type — sample test said no gain.',
}

function compressionFor(name: string, kind: FileKind, size: number): CompressionInfo {
  const rand = seeded(`c-${name}`)
  const skip = ['image', 'video', 'audio', 'archive', 'other'].includes(kind)
  if (skip) {
    return {
      applied: false,
      originalSize: size,
      storedSize: size,
      ratio: 1 + rand() * 0.012,
      policy: 'skip',
      note: POLICY_NOTE[kind],
    }
  }
  if (['pdf', 'document', 'sheet', 'slide'].includes(kind)) {
    const applied = rand() > 0.35
    const ratio = applied ? 1.15 + rand() * 0.7 : 1.004
    return {
      applied,
      originalSize: size,
      storedSize: Math.round(applied ? size / ratio : size),
      ratio,
      policy: 'sampled',
      note: applied
        ? 'Sampled 64 KiB, compressed because the saving exceeded 5%.'
        : 'Sampled 64 KiB; saving was under 5%, stored as is.',
    }
  }
  const ratio = 2.6 + rand() * 2.4
  return {
    applied: true,
    originalSize: size,
    storedSize: Math.round(size / ratio),
    ratio,
    policy: 'compress',
    note: POLICY_NOTE[kind] ?? POLICY_NOTE.other,
  }
}

export const DEMO_VIDEO = '/demo/lecture-clip.mp4'
export const DEMO_AUDIO = '/demo/voice-memo.wav'

/** The demo ships one sample PDF per subject; pick it by filename. */
export function demoPdfFor(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('dbms')) return '/demo/dbms-unit3.pdf'
  if (lower.includes('operating') || lower.includes('os')) return '/demo/os-unit4.pdf'
  if (lower.includes('resume')) return '/demo/resume.pdf'
  if (lower.includes('syllabus')) return '/demo/syllabus.pdf'
  return '/demo/research-note.pdf'
}

/** Bundled sample photographs so seeded images open as real pictures. */
export function demoImageFor(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower.includes('fest-group')) return '/demo/photos/fest-group-photo.jpg'
  if (lower.includes('fest-stage')) return '/demo/photos/fest-stage-01.jpg'
  if (lower.includes('convocation')) return '/demo/photos/convocation-2026.jpg'
  if (lower.includes('holi')) return '/demo/photos/holi-2026.jpg'
  if (lower.includes('trek-pachmarhi-02')) return '/demo/photos/trek-pachmarhi-02.jpg'
  if (lower.includes('trek-pachmarhi')) return '/demo/photos/trek-pachmarhi-01.jpg'
  if (lower.includes('campus-main')) return '/demo/photos/campus-main-building.jpg'
  if (lower.includes('key-hierarchy')) return '/demo/photos/key-hierarchy.png'
  if (lower.includes('flood-wait')) return '/demo/photos/telegram-flood-wait.png'
  if (lower.includes('screenshot') && lower.includes('11.42')) {
    return '/demo/photos/Screenshot_2026-10-21_at_11.42.10.png'
  }
  if (lower.includes('screenshot')) return '/demo/photos/Screenshot_2026-10-19_at_09.15.44.png'
  if (lower.includes('20260312')) return '/demo/photos/IMG_20260312_104233.jpg'
  if (lower.includes('20260314')) return '/demo/photos/IMG_20260314_181002.jpg'
  if (lower.includes('20261012')) return '/demo/photos/IMG_20261012_223311.jpg'
  if (lower.includes('20250101')) return '/demo/photos/IMG_20250101_0001.jpg'
  return null
}

function previewFor(name: string, kind: FileKind, snippet: string): PreviewInfo {
  // The demo ships a small sample asset per previewable type, so every file of
  // that type opens a real viewer instead of an empty state. PDFs and images
  // follow their filename so a document does not preview as an unrelated one.
  if (kind === 'pdf') return { kind: 'pdf', src: demoPdfFor(name) }
  if (kind === 'video') return { kind: 'video', src: DEMO_VIDEO }
  if (kind === 'audio') return { kind: 'audio', src: DEMO_AUDIO }
  if (kind === 'image' && !name.endsWith('.svg')) {
    const src = demoImageFor(name)
    return src ? { kind: 'image', src } : { kind: 'image' }
  }
  if (kind === 'text' || kind === 'code') {
    return {
      kind: 'text',
      text: `${name.endsWith('.md') ? '# ' : kind === 'code' ? '// ' : ''}${name}\n\n${snippet}\n\nGenerated demo content. In a real deployment the file is fetched from Telegram in 1 MiB blocks, decrypted and decompressed on the user's own server before it reaches the browser.\n\nparts        ${Math.max(1, Math.ceil(1024 / 100))}\nblocks       1\ncipher       AES-256-GCM\npolicy       ${kind === 'code' ? 'zstd, level 3' : 'zstd, level 3'}\n`,
    }
  }
  return { kind: 'none' }
}

function partsFor(size: number, index: number): PartInfo[] {
  const partSize = 100 * MiB
  const count = Math.max(1, Math.ceil(size / partSize))
  const first = 10420 + index * 37
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    size: i === count - 1 ? size - partSize * (count - 1) : partSize,
    messageId: first + i,
    hash: hex(`part-${index}-${i}`, 16),
  }))
}

export function buildFile(spec: Spec, index: number): FileItem {
  const kind = spec.kind ?? kindForName(spec.name)
  const compression = compressionFor(spec.name, kind, spec.size)
  const parts = partsFor(compression.storedSize, index)
  const created = iso(spec.days)
  const versionCount = spec.versions ?? 0
  const versions = Array.from({ length: versionCount + 1 }, (_, i) => ({
    id: `v-${index}-${i}`,
    label: `v${i + 1}`,
    size: Math.round(spec.size * (i === versionCount ? 1 : 0.82 + i * 0.06)),
    createdAt: iso(spec.days + (versionCount - i) * 3),
    current: i === versionCount,
  }))

  const embedding =
    kind === 'image'
      ? { kind: 'image' as const, model: 'CLIP ViT-B/32', dim: 512, passages: 1 }
      : ['text', 'code', 'pdf', 'document', 'sheet', 'slide'].includes(kind)
        ? {
            kind: 'text' as const,
            model: 'all-MiniLM-L6-v2',
            dim: 384,
            passages: Math.max(1, Math.min(12, Math.ceil(spec.size / 40_000))),
          }
        : null

  return {
    id: `f-${String(index).padStart(3, '0')}`,
    name: spec.name,
    kind,
    mime: mimeForKind(kind),
    size: spec.size,
    folderId: spec.folder,
    createdAt: created,
    updatedAt: iso(spec.days, 3),
    compression,
    encrypted: true,
    partSize: 100 * MiB,
    blockSize: MiB,
    parts,
    hash: hex(`file-${spec.name}`, 40),
    telegram: { chat: 'Saved Messages', chatId: 'self', firstMessageId: parts[0].messageId },
    embedding,
    versions,
    starred: Boolean(spec.starred),
    deletedAt: spec.deletedDaysAgo != null ? iso(spec.deletedDaysAgo) : null,
    preview: previewFor(spec.name, kind, spec.snippet),
    thumbSeed: `${spec.name}-${index}`,
    topics: spec.topics,
    snippet: spec.snippet,
  }
}

export const SEED_FILES: FileItem[] = SPECS.map(buildFile)

const totalParts = SEED_FILES.filter((f) => !f.deletedAt).reduce((n, f) => n + f.parts.length, 0)
const totalBlocks = SEED_FILES.filter((f) => !f.deletedAt).reduce(
  (n, f) => n + Math.ceil(f.size / f.blockSize),
  0,
)

export function createDb(): Db {
  return {
    version: DEMO_VERSION,
    session: {
      state: 'needs_setup',
      telegram: null,
      version: '0.1.0 · frontend demo',
      passphraseChangedAt: null,
    },
    setup: {
      step: 0,
      apiId: '',
      apiHash: '',
      phone: '',
      needsPassword: false,
      passphraseSet: false,
      recoveryCode: null,
      completed: false,
    },
    folders: SEED_FOLDERS,
    files: SEED_FILES,
    settings: {
      partSizeMiB: 100,
      blockSizeMiB: 1,
      compressionThresholdPct: 5,
      trashRetentionDays: 30,
      autoCompress: true,
      scanOnUpload: false,
    },
    integrity: {
      checkedAt: iso(2),
      partsChecked: totalParts,
      partsOk: totalParts,
      partsFailed: 0,
      blocksChecked: totalBlocks,
      durationMs: 4_180,
      running: false,
    },
  }
}
