# Pass-the-Host - AI Coding Instructions

## Project Overview

Electron-based Minecraft server manager with Cloudflare R2 cloud storage integration. Built with React, TypeScript, and Clean Architecture principles using Domain-Driven Design (DDD) with Bounded Contexts.

**Tech Stack:** Electron + React + TypeScript + InversifyJS (DI) + Material-UI + i18next + electron-vite

---

## Clean Architecture Structure

This project follows **Clean Architecture with Bounded Contexts**. Each feature is organized as an independent context with clear separation of concerns:

### Layers (Inside-Out)

1. **Domain** - Business entities, interfaces, domain events (no external dependencies)
2. **Application** - Use cases, business logic orchestration
3. **Infrastructure** - External integrations (IPC handlers, repositories, file system, rclone)
4. **Presentation** (Renderer only) - React components, UI logic
5. **Adapters** - Interface adapters (currently minimal usage)

### Dependency Rule

**Dependencies point inward only**: Infrastructure → Application → Domain

---

## Project Structure

```
src/
├── contexts/shared/              # Shared kernel across contexts
│   ├── di/                       # Global DI symbols and types
│   ├── domain/                   # Domain events infrastructure
│   │   ├── DomainEvent.ts        # Base domain event class
│   │   ├── DomainEvents.ts       # All domain event definitions
│   └── infrastructure/
│       └── event-bus/            # EventEmitter-based event bus
│
├── main/                         # Electron Main Process
│   ├── config.ts                 # Global config management
│   ├── java.ts                   # Java runtime management
│   ├── rclone.ts                 # Rclone binary management
│   ├── di/container.ts           # Main DI container initialization
│   └── contexts/                 # Main process bounded contexts
│       ├── app-configuration/
│       ├── cloud-storage/
│       ├── server-lifecycle/
│       ├── server-locking/
│       ├── server-runtime/
│       ├── session-tracking/
│       └── system-resources/
│
├── preload/                      # Electron Preload (IPC Bridge)
│   ├── index.ts                  # IPC API definitions exposed to renderer
│   └── index.d.ts                # TypeScript declarations for window API
│
└── renderer/                     # Electron Renderer Process (React App)
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── i18n/                 # i18next configuration
        ├── presentation/components/  # Shared UI components
        └── contexts/             # Renderer bounded contexts
            ├── shared/hooks/     # useDependency hook
            ├── app-configuration/
            ├── cloud-storage/
            ├── server-lifecycle/
            ├── server-locking/
            ├── server-runtime/
            ├── session-tracking/
            └── system-resources/
```

### Bounded Context Structure (Each Context Follows This Pattern)

#### Main Process Context:

```
contexts/[context-name]/
├── domain/
│   ├── entities/                 # Business entities (e.g., Server.ts, R2Config.ts)
│   │   └── index.ts              # Exports all entities
│   └── repositories/             # Repository interfaces (I*Repository.ts)
│       └── index.ts              # Exports all repository interfaces
├── application/
│   └── use-cases/                # Use case implementations
│       ├── types.ts              # TYPES symbols for DI
│       └── index.ts              # Exports all use cases
├── infrastructure/
│   ├── repositories/             # Repository implementations
│   │   └── index.ts              # Exports all repositories
│   └── ipc/                      # IPC handlers (Main ↔ Renderer communication)
│       └── [Context]IPCHandlers.ts
└── di/
    └── container.ts              # Context DI configuration
```

#### Renderer Process Context:

```
contexts/[context-name]/
├── domain/
│   ├── entities/                 # Business entities (duplicated from main if needed)
│   └── repositories/             # Repository interfaces
│       └── I*Repository.ts
├── application/
│   └── use-cases/                # Use case classes
│       └── *UseCase.ts
├── infrastructure/
│   ├── repositories/             # Repository implementations (call IPC)
│   └── services/                 # External service adapters
├── presentation/
│   └── components/               # React components for this context
├── di/
│   ├── container.ts              # Context DI configuration
│   └── index.ts                  # Export configureContext function
└── index.ts                      # Context public API
```

---

## Bounded Contexts

### 1. **app-configuration**

- Manages: App settings (language, RAM, username, R2 config)
- Key entities: `AppConfig`

### 2. **cloud-storage**

- Manages: Cloudflare R2 operations via rclone
- Key entities: `R2Config`, `ServerInfo`, `ServerLock`, `SessionMetadata`
- Key repos: `R2ServerRepository`, `RcloneRepository`, `ServerLockRepository`, `SessionRepository`

### 3. **server-lifecycle**

- Manages: Server creation, deletion, local file operations
- Key entities: `ServerConfig`
- Key repos: `ServerLifecycleRepository`

### 4. **server-locking**

- Manages: Server lock/unlock mechanism (prevent concurrent usage)
- Key entities: `ServerLock`

### 5. **server-runtime**

- Manages: Server process execution, console I/O, status
- Key entities: `ServerProcess`, `ServerRuntimeConfig`, `ServerStatus`, `LogEntry`
- Key repos: `ServerProcessRepository`

### 6. **session-tracking**

- Manages: Server usage sessions and statistics
- Key entities: `Session`

### 7. **system-resources**

- Manages: System info (RAM, network interfaces)
- Key entities: `SystemResources`, `NetworkInterface`, `RamConfig`

---

## Dependency Injection (InversifyJS)

### DI Setup Pattern

**Main Process:**

```typescript
// src/main/contexts/[context]/di/container.ts
import { Container } from "inversify";
import { TYPES } from "../application/use-cases/types";

export function configure[Context]Context(container: Container): void {
  // 1. Bind repositories
  container.bind<IRepository>(TYPES.IRepository)
    .to(RepositoryImpl)
    .inSingletonScope();

  // 2. Bind use cases (transient or singleton based on state)
  container.bind<UseCase>(TYPES.UseCase)
    .toDynamicValue(() => {
      const repo = container.get<IRepository>(TYPES.IRepository);
      return new UseCase(repo);
    })
    .inTransientScope();
}
```

**Renderer Process:**

```typescript
// src/renderer/src/contexts/[context]/di/container.ts
import { appContainer } from "@shared/di";
import { [CONTEXT]_TYPES } from "@shared/di/types";

export function configure[Context](): void {
  // Bind repositories
  appContainer.bind<IRepository>([CONTEXT]_TYPES.Repository)
    .to(RepositoryImpl)
    .inSingletonScope();

  // Bind use cases
  appContainer.bind<UseCase>([CONTEXT]_TYPES.UseCase)
    .to(UseCaseImpl)
    .inSingletonScope();
}
```

### Using Dependencies in React

```typescript
import { useDependency } from "@contexts/shared/hooks";
import { CLOUD_STORAGE_TYPES } from "@shared/di/types";

function MyComponent() {
  const downloadUseCase = useDependency<DownloadServerUseCase>(
    CLOUD_STORAGE_TYPES.DownloadServerUseCase,
  );

  const handleDownload = async () => {
    await downloadUseCase?.execute(serverId);
  };
}
```

### DI Symbol Types Location

- **Shared symbols:** `src/contexts/shared/di/types.ts`
- **Context-specific symbols:** `src/[main|renderer]/contexts/[context]/application/use-cases/types.ts`

---

## Domain Events Pattern

### Event Definition

```typescript
// src/contexts/shared/domain/DomainEvents.ts
export class ServerStartedEvent extends BaseDomainEvent {
  constructor(
    public readonly serverId: string,
    public readonly serverName: string,
  ) {
    super(serverId);
  }

  get eventName(): string {
    return "server.started";
  }
}
```

### Publishing Events

```typescript
import { EventBus } from "@shared/infrastructure/event-bus";
import { ServerStartedEvent } from "@shared/domain/DomainEvents";

const eventBus = EventBus.getInstance();
eventBus.publish(new ServerStartedEvent(serverId, serverName));
```

### Subscribing to Events

```typescript
eventBus.subscribe("server.started", (event: ServerStartedEvent) => {
  console.log(`Server ${event.serverName} started`);
});
```

---

## IPC Communication Pattern

### Main Process (Handler Registration)

```typescript
// src/main/contexts/[context]/infrastructure/ipc/[Context]IPCHandlers.ts
import { ipcMain } from "electron";
import { mainContainer } from "@/main/di/container";
import { TYPES } from "../../application/use-cases/types";

export function register[Context]IPCHandlers(): void {
  ipcMain.handle("[context]:action", async (_event, param) => {
    const useCase = mainContainer.get<UseCase>(TYPES.UseCase);
    return await useCase.execute(param);
  });
}
```

### Preload (API Bridge)

```typescript
// src/preload/index.ts
const [context]API = {
  action: (param: Type): Promise<Result> =>
    ipcRenderer.invoke("[context]:action", param),

  // Event listeners
  onEvent: (callback: (data: Type) => void): (() => void) => {
    const listener = (_event: any, data: Type): void => callback(data);
    ipcRenderer.on("[context]:event", listener);
    return () => ipcRenderer.removeListener("[context]:event", listener);
  },
};

contextBridge.exposeInMainWorld("[context]", [context]API);
```

### Renderer (Repository)

```typescript
// src/renderer/src/contexts/[context]/infrastructure/repositories/[Context]Repository.ts
@injectable()
export class [Context]Repository implements I[Context]Repository {
  async action(param: Type): Promise<Result> {
    return await window.[context].action(param);
  }
}
```

---

## Creating a New Context (Step-by-Step)

### 1. Define Domain Layer

**Main Process:**

```typescript
// src/main/contexts/new-context/domain/entities/Entity.ts
export interface Entity {
  id: string;
  name: string;
}

// src/main/contexts/new-context/domain/repositories/index.ts
export interface IEntityRepository {
  findById(id: string): Promise<Entity | null>;
  save(entity: Entity): Promise<void>;
}
```

### 2. Create Use Cases

```typescript
// src/main/contexts/new-context/application/use-cases/types.ts
export const TYPES = {
  IEntityRepository: Symbol.for("IEntityRepository"),
  GetEntityUseCase: Symbol.for("GetEntityUseCase"),
};

// src/main/contexts/new-context/application/use-cases/GetEntityUseCase.ts
export class GetEntityUseCase {
  constructor(private repository: IEntityRepository) {}

  async execute(id: string): Promise<Entity | null> {
    return await this.repository.findById(id);
  }
}
```

### 3. Implement Infrastructure

```typescript
// src/main/contexts/new-context/infrastructure/repositories/EntityRepository.ts
import { injectable } from "inversify";

@injectable()
export class EntityRepository implements IEntityRepository {
  async findById(id: string): Promise<Entity | null> {
    // Implementation using fs, database, etc.
  }
}

// src/main/contexts/new-context/infrastructure/ipc/NewContextIPCHandlers.ts
export function registerNewContextIPCHandlers(): void {
  ipcMain.handle("new-context:get-entity", async (_event, id: string) => {
    const useCase = mainContainer.get<GetEntityUseCase>(TYPES.GetEntityUseCase);
    return await useCase.execute(id);
  });
}
```

### 4. Configure DI Container

```typescript
// src/main/contexts/new-context/di/container.ts
export function configureNewContextContext(container: Container): void {
  container
    .bind<IEntityRepository>(TYPES.IEntityRepository)
    .to(EntityRepository)
    .inSingletonScope();

  container
    .bind<GetEntityUseCase>(TYPES.GetEntityUseCase)
    .toDynamicValue(() => {
      const repo = container.get<IEntityRepository>(TYPES.IEntityRepository);
      return new GetEntityUseCase(repo);
    })
    .inTransientScope();
}

// src/main/di/container.ts - Add to main container initialization
import { configureNewContextContext } from "../contexts/new-context/di/container";

export function initializeMainContainer(): Container {
  // ... other contexts
  configureNewContextContext(mainContainer);
  return mainContainer;
}
```

### 5. Register IPC Handlers

```typescript
// src/main/index.ts
import { registerNewContextIPCHandlers } from "./contexts/new-context/infrastructure/ipc";

app.whenReady().then(() => {
  registerNewContextIPCHandlers();
  // ... other handlers
});
```

### 6. Add Preload API

```typescript
// src/preload/index.ts
const newContextAPI = {
  getEntity: (id: string): Promise<Entity | null> =>
    ipcRenderer.invoke("new-context:get-entity", id),
};

// Add to contextBridge
contextBridge.exposeInMainWorld("newContext", newContextAPI);

// src/preload/index.d.ts
declare global {
  interface Window {
    newContext: {
      getEntity: (id: string) => Promise<Entity | null>;
    };
  }
}
```

### 7. Create Renderer Context

**Add DI symbols:**

```typescript
// src/contexts/shared/di/types.ts
export const NEW_CONTEXT_TYPES = {
  EntityRepository: Symbol.for("EntityRepository"),
  GetEntityUseCase: Symbol.for("GetEntityUseCase"),
};
```

**Create renderer structure:**

```typescript
// src/renderer/src/contexts/new-context/domain/entities/Entity.ts
export interface Entity {
  id: string;
  name: string;
}

// src/renderer/src/contexts/new-context/domain/repositories/IEntityRepository.ts
export interface IEntityRepository {
  getEntity(id: string): Promise<Entity | null>;
}

// src/renderer/src/contexts/new-context/infrastructure/repositories/EntityRepository.ts
@injectable()
export class EntityRepository implements IEntityRepository {
  async getEntity(id: string): Promise<Entity | null> {
    return await window.newContext.getEntity(id);
  }
}

// src/renderer/src/contexts/new-context/application/use-cases/GetEntityUseCase.ts
@injectable()
export class GetEntityUseCase {
  constructor(
    @inject(NEW_CONTEXT_TYPES.EntityRepository)
    private repository: IEntityRepository,
  ) {}

  async execute(id: string): Promise<Entity | null> {
    return await this.repository.getEntity(id);
  }
}

// src/renderer/src/contexts/new-context/di/container.ts
export function configureNewContext(): void {
  appContainer
    .bind<IEntityRepository>(NEW_CONTEXT_TYPES.EntityRepository)
    .to(EntityRepository)
    .inSingletonScope();

  appContainer
    .bind<GetEntityUseCase>(NEW_CONTEXT_TYPES.GetEntityUseCase)
    .to(GetEntityUseCase)
    .inSingletonScope();
}

// src/renderer/src/contexts/shared/hooks/useDependency.ts - Add to initialization
import { configureNewContext } from "@new-context/di";

const initContainer = (): void => {
  // ... other contexts
  configureNewContext();
};
```

### 8. Create React Component

```typescript
// src/renderer/src/contexts/new-context/presentation/components/EntityViewer.tsx
import { useDependency } from "@contexts/shared/hooks";
import { NEW_CONTEXT_TYPES } from "@shared/di/types";

export function EntityViewer() {
  const getEntity = useDependency<GetEntityUseCase>(
    NEW_CONTEXT_TYPES.GetEntityUseCase
  );

  const handleLoad = async () => {
    const entity = await getEntity?.execute("123");
    console.log(entity);
  };

  return <button onClick={handleLoad}>Load Entity</button>;
}
```

---

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start development server
pnpm build                # Build for production
pnpm build:win            # Build Windows installer
pnpm lint                 # Run ESLint
pnpm format               # Format code with Prettier
pnpm typecheck            # Type check all code
```

---

## Key Conventions

### File Naming

- **Entities:** PascalCase (e.g., `ServerConfig.ts`)
- **Repositories:** `I*Repository.ts` (interface), `*Repository.ts` (implementation)
- **Use Cases:** `*UseCase.ts`
- **IPC Handlers:** `*IPCHandlers.ts`
- **Components:** PascalCase (e.g., `ServerConsole.tsx`)

### Imports Organization

1. External libraries
2. Electron modules
3. Internal absolute imports (via aliases)
4. Relative imports

### Path Aliases (from electron.vite.config.ts)

```typescript
@renderer → src/renderer/src
@shared → src/contexts/shared
@contexts → src/renderer/src/contexts
@server-lifecycle → src/renderer/src/contexts/server-lifecycle
@server-runtime → src/renderer/src/contexts/server-runtime
@cloud-storage → src/renderer/src/contexts/cloud-storage
@server-locking → src/renderer/src/contexts/server-locking
@session-tracking → src/renderer/src/contexts/session-tracking
@system-resources → src/renderer/src/contexts/system-resources
@app-configuration → src/renderer/src/contexts/app-configuration
```

### TypeScript Configuration

- **Main Process:** `tsconfig.node.json`
- **Renderer Process:** `tsconfig.web.json`
- Use `"reflect-metadata"` import in DI files
- Decorators enabled for InversifyJS

---

## External Dependencies

### Rclone Integration

- Binary managed by `src/main/rclone.ts`
- Installed to `userData/rclone/`
- Used for Cloudflare R2 operations (list, download, upload, sync)
- See `R2ServerRepository` for command patterns

### Java Runtime Management

- Managed by `src/main/java.ts`
- Used for running Minecraft servers
- Automatically downloads AdoptOpenJDK if missing

### Configuration Persistence

- Config stored in `app.getPath("userData")/config.json`
- Managed by `src/main/config.ts`
- Structure: `{ r2: {...}, server: {...}, app: {...} }`

---

## Testing & Debugging

- Electron DevTools: Built into dev mode (`pnpm dev`)
- Main process logs: Use `console.log` (appears in terminal)
- Renderer logs: Use `console.log` (appears in DevTools console)
- IPC debugging: Add logs in handlers and preload bridge

---

## Important Notes

1. **Always follow Clean Architecture layers** - No domain dependencies on infrastructure
2. **Use InversifyJS for all dependency injection** - Avoid manual instantiation
3. **IPC naming convention:** `context:action` (e.g., `server-runtime:start`)
4. **Domain events for cross-context communication** - Use EventBus instead of direct coupling
5. **Shared kernel only for truly shared concepts** - Most code belongs in specific contexts
6. **Each context is independently deployable** - Minimize cross-context dependencies
7. **Repository pattern for all external I/O** - File system, IPC, external APIs
8. **Use cases are single responsibility** - One use case = one business operation

---

## Common Patterns in This Codebase

### Async Process with Progress Updates

```typescript
// Main Process - Spawn process and emit progress events
const process = spawn(command, args);
process.stdout.on("data", (data) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send("context:progress", data.toString());
});

// Preload - Bridge progress events
onProgress: (callback: (msg: string) => void): (() => void) => {
  const listener = (_event: any, msg: string): void => callback(msg);
  ipcRenderer.on("context:progress", listener);
  return () => ipcRenderer.removeListener("context:progress", listener);
};

// Renderer - Subscribe in useEffect
useEffect(() => {
  const cleanup = window.context.onProgress((msg) => {
    console.log(msg);
  });
  return cleanup;
}, []);
```

### Config-based Operations

Most operations require `R2Config` or `ServerConfig` - load from `window.config.loadConfig()` first.

### Error Handling

- Use try-catch in use cases
- Return `boolean` for success/failure or throw errors
- Log errors with context: `console.error("[Context]", error)`
