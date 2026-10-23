# Pass the host

Desktop application to manage Minecraft servers with S3 cloud synchronization.

Pass the host was born from a painful need: in a group of friends, running the server should not depend on a single person.

The idea is simple:

- The world and server files are synced to the cloud (S3-compatible storage).
- Any member with the app configured can download the latest state, start the server, and upload changes afterward.
- A lock system prevents two people from starting or overwriting the same server at the same time.

The only thing left is connecting to a VPN and share your IP with your friends.

## Architecture

The project is built with Electron + React + TypeScript, with separation by contexts and use cases.

- `src/main`: Electron main process. Orchestrates use cases, integrates system services, cloud sync, and IPC handlers.
- `src/preload`: secure bridge (`contextBridge`) between `main` and `renderer`.
- `src/renderer`: React UI, presentation components, and frontend use cases.
- `src/contexts/shared`: shared pieces across contexts (event bus, logger, errors, and domain types).

At a functional level, it uses context-based modules (server runtime, cloud storage, app configuration, system resources, server lifecycle), with dependency injection via Inversify.

## Current status

The application currently includes:

- Minecraft server start/stop management.
- Console to send commands and view process logs.
- Server synchronization with S3-compatible storage (for example Cloudflare R2, MinIO, AWS S3, and other compatible providers).
- Distributed lock control to prevent conflicts between users.
- Session creation and tracking (usage/playtime statistics).
- RAM, network, username, language, and server parameter configuration.
- Java runtime download/management based on Minecraft version.

## How to run the project

### 1) Install dependencies

```bash
pnpm install
```

### 2) Run in development

```bash
pnpm dev
```

### 3) Build

```bash
# Windows
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## Local S3 environment (optional with MinIO)

The repository includes support for running MinIO locally with Docker.

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start services:

```bash
docker compose up -d
```

This automatically creates a test bucket (`MINIO_BUCKET_NAME`) to validate synchronization flows.

## Testing/automating the app with Claude Code (MCP)

The project is configured to be driven from Claude Code using [`electron-test-mcp`](https://github.com/lazy-dinosaur/electron-test-mcp), an MCP server that controls an Electron app over the Chrome DevTools Protocol (CDP) via Playwright.

The server is already registered for this project (local scope, see `claude mcp list`):

```bash
claude mcp add electron-test-mcp -- npx -y electron-test-mcp
```

### Option A: attach to a running dev instance (recommended)

1. Start the app in dev mode with remote debugging enabled:

   ```bash
   pnpm dev:debug
   ```

   This runs `electron-vite dev --remoteDebuggingPort 9222`, which opens a CDP endpoint on port `9222` for the Electron process.

2. From Claude Code, connect the MCP to that instance:

   ```
   connect({ port: 9222 })
   ```

3. Drive the app with the MCP tools (`click`, `fill`, `screenshot`, `snapshot`, `evaluate`, `evaluateMain`, etc.) and close the session with `disconnect()` when done.

### Option B: let the MCP launch the app itself

Instead of running `pnpm dev:debug` manually, you can have the MCP spawn a fresh Electron instance directly:

```
launch({ path: "." })
```

(adjust `path` to the built `main` entry, e.g. `./out/main/index.js`, if you want to test a production build instead of the dev server).

### Example test flow

A minimal smoke test to confirm the wiring works, from Claude Code after running `pnpm dev:debug`:

```
connect({ port: 9222 })
snapshot()                          # inspect the accessibility tree of the main window
screenshot()                        # visually confirm the main screen rendered
click({ selector: "text=Servers" }) # navigate within the renderer UI
fill({ selector: "#username", value: "test-user" })
evaluate({ script: "document.title" })              # runs in the renderer (DevTools context)
evaluateMain({ script: "app.getVersion()" })          # runs in the Electron main process
screenshot()                        # capture the resulting state
disconnect()
```

Adjust selectors to match the actual UI (e.g. the username configuration screen, server list, etc.).

## Tech stack

- Electron
- React
- TypeScript
- Material UI
- Inversify
- i18next
- rclone (S3-compatible synchronization)
