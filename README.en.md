# Codex WebUI

A web frontend for [OpenAI Codex CLI](https://github.com/openai/codex). It brings the CLI experience into the browser with multi-thread concurrency, a file manager, a shared terminal, and plugin management.

The backend (NestJS) talks to `codex app-server` over stdio JSON-RPC and pushes real-time events to a React frontend via Socket.IO.

[简体中文](./README.md)

![Main UI](./images/main-en.png)

## Features

**Chat & Threads** — Run multiple threads concurrently, grouped by workspace. Archive, fork, rollback, rename. Markdown + Shiki highlighting, `@` file mentions, image paste, steer/stop running turns.

**Approval Flow** — In-page cards for command execution and file change approvals. Security policy switching. Multi-device CAS conflict prevention.

**File Management** — Tree browser with drag-and-drop, Monaco code viewer, Git diff split view, upload/download/rename/copy/move.

![File Management](./images/sidebar-file-en.png)

**Terminal** — Multi-tab shared terminal (node-pty + xterm.js) with reconnect and headless VT replay.

![Terminal](./images/sidebar-terminal-en.png)

**Integrations & Plugins**

![Integrations](./images/side-integration-en.png)

**Other** — JWT + API Key auth, plugin/MCP server management, dark/light theme, i18n (en/zh-CN), responsive layout, Docker deployment.

## Tech Stack

```
Browser
  React 19 · Vite 8 · TanStack (Router + Query + Virtual)
  Zustand · Socket.IO Client · Monaco Editor · xterm.js
  Tailwind CSS 4 · shadcn/ui · Framer Motion · dnd-kit
     ↕  REST + WebSocket
Server
  NestJS 11 · Fastify 5 · Socket.IO · node-pty
  SQLite (better-sqlite3 + Drizzle ORM) · Pino
     ↕  stdio JSON-RPC
  codex app-server (child process)
```

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- [Codex CLI](https://github.com/openai/codex) installed and available in PATH

### Local Development

```bash
git clone https://github.com/your-username/codex-webui.git
cd codex-webui
pnpm install

cp .env.example .env
# Edit .env — at minimum set WEBUI_API_KEY

# Start the backend (default port 8172)
pnpm start:dev

# In another terminal, start the frontend (port 5173, proxies to backend)
cd web && pnpm dev
```

Open `http://localhost:5173`.

### Docker

```bash
echo "WEBUI_API_KEY=your-secret-key" > .env
echo "OPENAI_API_KEY=sk-xxx" >> .env
docker compose up -d
```

The app runs at `http://localhost:8172`.

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `WEBUI_API_KEY` | Yes | — | Login key; also used to derive JWT signing secret |
| `PORT` | No | `8172` | Backend listen port |
| `CODEX_BIN` | No | `codex` | Path to codex CLI binary |
| `CODEX_HOME` | No | `~/.codex` | Codex home directory |
| `WORKSPACE_ROOTS` | No | — | Comma-separated allowed directories |
| `LOG_LEVEL` | No | `info` / `debug` | Pino log level |
| `WEBUI_DB_PATH` | No | `CODEX_HOME/codex-webui.sqlite` | SQLite database path |
| `WEBUI_UPLOAD_MAX_BYTES` | No | `104857600` | Max upload file size (default 100MB) |
| `DEFAULT_TERMINAL_CWD` | No | — | Default terminal cwd; fail-fast if invalid |
| `WEBUI_TERMINAL_MAX_SESSIONS` | No | `10` | Max concurrent terminal sessions (1-50) |
| `WEBUI_TERMINAL_GRACE_MS` | No | `45000` | Grace period before killing detached terminals (10s-300s) |
| `WEBUI_TERMINAL_SCROLLBACK` | No | `5000` | Terminal scrollback buffer lines (100-50000) |

## Project Structure

```
├── src/                  # NestJS backend
│   ├── codex/            # Process manager, JSON-RPC client
│   ├── threads/          # Thread CRUD, WebSocket gateway
│   ├── files/            # File ops, path security
│   ├── terminal/         # Multi-tab terminal (node-pty)
│   ├── auth/             # JWT + API Key auth
│   ├── database/         # SQLite + Drizzle ORM
│   └── ...               # Other modules
├── web/                  # React frontend
│   └── src/
│       ├── routes/       # TanStack Router pages
│       ├── components/   # UI components
│       ├── stores/       # Zustand state management
│       ├── hooks/        # Custom hooks
│       └── generated/    # Hey API SDK (auto-generated)
├── Dockerfile
└── docker-compose.yml
```

## Commands

```bash
pnpm start:dev          # Backend dev server
pnpm build              # Compile backend
pnpm test               # Run tests
pnpm lint               # ESLint
pnpm db:generate        # Generate DB migration
pnpm db:migrate         # Run migrations
cd web && pnpm dev      # Frontend dev server
cd web && pnpm build    # Build frontend (outputs to public/)
```
