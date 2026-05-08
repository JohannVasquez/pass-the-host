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

## Tech stack

- Electron
- React
- TypeScript
- Material UI
- Inversify
- i18next
- rclone (S3-compatible synchronization)
