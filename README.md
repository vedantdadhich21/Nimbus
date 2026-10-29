# Nimbus

**Self-hosted cloud storage powered by Telegram.**

Nimbus turns your Telegram account into an encrypted, unlimited personal drive. Files are split into parts, compressed with Zstandard where it helps, encrypted with AES-256-GCM, and uploaded as Telegram messages — all behind a clean, modern UI you host yourself.

> **Status:** v0.1.0 — fully functional frontend demo with a mock adapter. The FastAPI backend is in progress.

---

## ✨ Features

- **Unlimited storage** — backs onto Telegram's free, unlimited media storage
- **End-to-end encryption** — AES-256-GCM with a passphrase-derived key (Argon2id)
- **Smart compression** — Zstandard for text and uncompressed media; skips already-compressed files
- **File chunking** — large files are split into configurable parts (default 100 MiB)
- **Hybrid search** — semantic + name-based search across your entire library
- **File versioning** — track and restore previous versions of any file
- **Folder organisation** — nested folders, drag-and-move, batch operations
- **Trash with retention** — soft-delete with configurable auto-purge (default 30 days)
- **Integrity checks** — periodic verification that every part still exists in Telegram
- **Dark & light themes** — monochrome design, keyboard-friendly
- **Recovery code** — one-time code that can unwrap the master key if you forget your passphrase
- **Responsive** — works on desktop, tablet, and mobile

---

## 🛠 Tech Stack

| Layer      | Technology                                                    |
| ---------- | ------------------------------------------------------------- |
| Framework  | React 19 + TypeScript 7                                       |
| Routing    | React Router v7                                               |
| Data       | TanStack React Query                                          |
| Styling    | Tailwind CSS v4                                               |
| Bundler    | Vite 8                                                        |
| Icons      | Lucide React                                                  |
| Encryption | AES-256-GCM (design) with Argon2id key derivation             |
| Compression| Zstandard (zstd level 3)                                      |
| Backend    | FastAPI (planned) — mock adapter ships with the frontend demo |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **npm** (comes with Node)

### Install & Run

```bash
# Clone the repo
git clone git@github.com:vedantdadhich21/Nimbus.git
cd Nimbus/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at **http://127.0.0.1:5180**.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📂 Project Structure

```
Nimbus/
└── frontend/
    ├── public/              # Static assets & demo files
    ├── src/
    │   ├── components/      # Reusable UI components
    │   │   ├── Shell.tsx        # App shell — sidebar, topbar, status bar
    │   │   ├── FileBrowser.tsx  # Grid/list file browser
    │   │   ├── ContextMenu.tsx  # Right-click context menu
    │   │   ├── UploadDock.tsx   # Upload progress dock
    │   │   ├── ui.tsx           # Design-system primitives
    │   │   └── dialogs.tsx      # Confirmation & modal dialogs
    │   ├── screens/         # Route-level pages
    │   │   ├── Drive.tsx        # Main file browser
    │   │   ├── Recent.tsx       # Recently modified files
    │   │   ├── Search.tsx       # Hybrid search
    │   │   ├── Trash.tsx        # Soft-deleted files
    │   │   ├── Settings.tsx     # Instance settings & stats
    │   │   ├── Viewer.tsx       # File preview (PDF, images, video, audio, text)
    │   │   ├── Setup.tsx        # First-run setup wizard
    │   │   └── Unlock.tsx       # Passphrase unlock screen
    │   ├── lib/             # Core logic & utilities
    │   │   ├── api.ts           # API adapter entrypoint
    │   │   ├── api-mock.ts      # In-browser mock adapter (localStorage)
    │   │   ├── api-http.ts      # HTTP adapter skeleton (FastAPI)
    │   │   ├── types.ts         # Full TypeScript API contract
    │   │   ├── uploads.tsx      # Upload queue & progress tracking
    │   │   ├── seed.ts          # Demo data generator
    │   │   ├── theme.tsx        # Dark/light theme provider
    │   │   └── format.ts        # Byte, number & date formatters
    │   ├── App.tsx          # Route definitions & auth guards
    │   └── main.tsx         # React entry point
    ├── vite.config.ts
    ├── tsconfig.json
    └── package.json
```

---

## 🔐 Security Model

```
Passphrase  ──▶  Argon2id  ──▶  Wrapping Key  ──▶  unwraps Master Key
                                                         │
                                   ┌─────────────────────┘
                                   ▼
                           AES-256-GCM per block
                           (1 MiB default blocks)
```

- The **passphrase** never leaves the client
- A one-time **recovery code** wraps a second copy of the master key
- The **Telegram session** is stored encrypted — it's equivalent to being signed in on another device
- Two-step verification is enforced during setup

---

## 🗺 Roadmap

- [ ] FastAPI backend with real Telegram upload/download
- [ ] Semantic embedding pipeline (text + image)
- [ ] File deduplication via content hashing
- [ ] Shared folders & link sharing
- [ ] Mobile-native app (React Native or Flutter)
- [ ] Webhook notifications for upload completion

---

## 📄 License

This project is for personal and educational use. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with ☁️ by <a href="https://github.com/vedantdadhich21">vedantdadhich21</a></sub>
</p>
