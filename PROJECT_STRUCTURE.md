# Estructura del Proyecto - Minecraft Distributed Server Launcher

```
Pass the host/
│
├── main.py                          # Punto de entrada
├── config.json                      # Configuración de la aplicación
├── requirements.txt                 # Dependencias Python
├── README.md                        # Documentación general
├── ARCHITECTURE.md                  # Documentación técnica
├── .gitignore                       # Archivos a ignorar
│
├── src/                             # Código fuente
│   ├── __init__.py
│   │
│   ├── domain/                      # 🎯 CAPA DE DOMINIO (Business Logic)
│   │   ├── __init__.py
│   │   │
│   │   ├── entities/                # Modelos de dominio (POPOs)
│   │   │   ├── __init__.py
│   │   │   └── server_entities.py   # ServerLock, ServerConfig, NetworkInterface, etc.
│   │   │
│   │   ├── interfaces/              # Contratos/Puertos (ABC)
│   │   │   ├── __init__.py
│   │   │   └── services.py          # ILockService, ISyncService, IServerManager, etc.
│   │   │
│   │   └── use_cases/               # Casos de uso (Application Business Rules)
│   │       ├── __init__.py
│   │       └── server_use_cases.py  # StartServerUseCase, StopServerUseCase, etc.
│   │
│   ├── data/                        # 💾 CAPA DE DATOS (Repositorios)
│   │   ├── __init__.py
│   │   ├── config_repository.py     # JsonConfigRepository (implementa IConfigRepository)
│   │   └── properties_manager.py    # ServerPropertiesManager (implementa IServerPropertiesManager)
│   │
│   ├── infrastructure/              # 🔌 CAPA DE INFRAESTRUCTURA (Servicios Externos)
│   │   ├── __init__.py
│   │   ├── rclone_service.py        # RcloneService (implementa ISyncService)
│   │   ├── r2_lock_service.py       # R2LockService (implementa ILockService)
│   │   ├── server_manager.py        # MinecraftServerManager (implementa IServerManager)
│   │   └── network_provider.py      # NetworkProvider (implementa INetworkProvider)
│   │
│   └── presentation/                # 🖥️ CAPA DE PRESENTACIÓN (UI + Controllers)
│       ├── __init__.py
│       │
│       ├── ui/                      # Interfaz gráfica (PySide6)
│       │   ├── __init__.py
│       │   └── main_window.py       # MainWindow (QMainWindow)
│       │
│       ├── workers/                 # QThreads para tareas asíncronas
│       │   ├── __init__.py
│       │   └── server_workers.py    # StartServerWorker, StopServerWorker, etc.
│       │
│       └── di/                      # Dependency Injection
│           ├── __init__.py
│           └── container.py         # DependencyContainer
│
├── rclone/                          # Binario de Rclone (no trackeado)
│   └── rclone.exe
│
├── java_runtime/                    # Java Runtime portable (no trackeado)
│   └── bin/
│       └── java.exe
│
├── server/                          # Archivos del servidor Minecraft (generado)
│   ├── server.jar
│   ├── server.properties
│   ├── world/
│   └── ...
│
└── dist/                            # Build output de PyInstaller
    └── MinecraftServerLauncher.exe
```

## 📂 Descripción de Carpetas

### `src/domain/` - Núcleo de la Aplicación
- **Regla de Oro**: NO DEBE DEPENDER DE NINGUNA OTRA CAPA
- Contiene toda la lógica de negocio
- Solo usa tipos primitivos y sus propias entidades
- Definiciones de interfaces (puertos) que otras capas implementan

#### `entities/`
Modelos de datos puros (dataclasses):
- `ServerLock`: Estado del lock del servidor
- `ServerConfig`: Configuración de Java y servidor
- `NetworkInterface`: Información de red
- `SyncProgress`: Estado de sincronización
- `R2Config`: Credenciales de Cloudflare R2

#### `interfaces/`
Contratos (Abstract Base Classes):
- Define QUÉ hace cada servicio, no CÓMO
- Permite testing con mocks
- Permite cambiar implementaciones sin tocar la lógica

#### `use_cases/`
Casos de uso (orquestación de lógica):
- `StartServerUseCase`: Orquesta lock → sync → config → start
- `StopServerUseCase`: Orquesta stop → sync → unlock
- Cada caso de uso resuelve un problema de negocio completo

### `src/data/` - Acceso a Datos
- Implementa repositorios para persistencia
- `config_repository.py`: Lee/escribe config.json
- `properties_manager.py`: Modifica server.properties

### `src/infrastructure/` - Servicios Externos
- Implementa las interfaces del dominio
- Cada clase depende de una herramienta externa:
  - `rclone_service.py` → Rclone binary
  - `r2_lock_service.py` → Boto3 (AWS SDK)
  - `server_manager.py` → subprocess (Java)
  - `network_provider.py` → psutil

### `src/presentation/` - UI y Controladores
- Única capa que conoce Qt/PySide6
- `ui/main_window.py`: Ventana principal con widgets
- `workers/server_workers.py`: QThreads para no bloquear UI
- `di/container.py`: Fabrica e inyecta todas las dependencias

## 🔄 Flujo de Dependencias

```
┌───────────────────┐
│   Presentation    │ ← Usuario interactúa aquí
└─────────┬─────────┘
          │ Llama a
          ↓
┌───────────────────┐
│   Domain          │ ← Lógica de negocio (Use Cases)
│   (Use Cases)     │
└─────────┬─────────┘
          │ Usa interfaces (puertos)
          ↓
┌───────────────────────────────────┐
│  Infrastructure    │    Data      │ ← Implementaciones concretas
│  (Servicios)       │    (Repos)   │
└───────────────────────────────────┘
          │
          ↓
    Herramientas externas
    (Rclone, R2, Java)
```

**Regla Fundamental**: Las flechas apuntan HACIA ADENTRO
- Presentation depende de Domain
- Infrastructure depende de Domain (implementa interfaces)
- Domain NO depende de nadie

## 🎯 Ventajas de Esta Arquitectura

1. **Testeable**: Puedes testear casos de uso con mocks de servicios
2. **Flexible**: Cambiar PySide6 por Tkinter solo afecta `presentation/`
3. **Mantenible**: Cada capa tiene una responsabilidad clara
4. **Escalable**: Agregar features nuevos es sistemático
5. **Portable**: El dominio funciona en CLI, GUI, o API

## 📝 Convenciones de Nombres

- **Interfaces**: Prefijo `I` (ILockService, ISyncService)
- **Implementaciones**: Nombre descriptivo (RcloneService, R2LockService)
- **Casos de Uso**: Sufijo `UseCase` (StartServerUseCase)
- **Workers**: Sufijo `Worker` (StartServerWorker)
- **Entidades**: Sin prefijos (ServerLock, ServerConfig)

## 🚀 Cómo Agregar una Nueva Feature

Ejemplo: Agregar backup automático cada hora

### 1. Domain Layer
```python
# src/domain/interfaces/services.py
class IBackupService(ABC):
    @abstractmethod
    async def create_backup(self, name: str) -> bool:
        pass

# src/domain/use_cases/backup_use_cases.py
class CreateBackupUseCase:
    def __init__(self, backup_service: IBackupService):
        self.backup_service = backup_service
```

### 2. Infrastructure Layer
```python
# src/infrastructure/backup_service.py
class R2BackupService(IBackupService):
    async def create_backup(self, name: str) -> bool:
        # Implementación con rclone
        pass
```

### 3. Presentation Layer
```python
# src/presentation/workers/backup_workers.py
class CreateBackupWorker(QThread):
    # Similar a StartServerWorker
    pass

# src/presentation/ui/main_window.py
# Agregar botón "Crear Backup" que use el worker
```

### 4. Dependency Injection
```python
# src/presentation/di/container.py
def get_backup_service(self) -> IBackupService:
    if self._backup_service is None:
        self._backup_service = R2BackupService(...)
    return self._backup_service
```

## 📚 Recursos Adicionales

- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [PySide6 Documentation](https://doc.qt.io/qtforpython-6/)
- [Rclone Documentation](https://rclone.org/docs/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
