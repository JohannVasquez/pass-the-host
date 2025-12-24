# Minecraft Distributed Server Launcher

Aplicación de escritorio para lanzar servidores Minecraft distribuidos usando Cloudflare R2 como almacenamiento sincronizado.

## 📋 Requisitos Previos

1. **Python 3.10 o superior**
2. **Java Runtime** (portable) en la carpeta `java_runtime/` junto al ejecutable
3. **Rclone** (binario) en la carpeta `rclone/rclone.exe`
4. **Cuenta de Cloudflare R2** con bucket configurado

## 🏗️ Arquitectura

Este proyecto sigue **Clean Architecture** estricta con las siguientes capas:

```
src/
├── domain/              # Lógica de Negocio Pura
│   ├── entities/        # Modelos de dominio
│   ├── interfaces/      # Contratos (Puertos)
│   └── use_cases/       # Casos de uso
├── data/                # Implementaciones de Repositorios
├── infrastructure/      # Servicios Externos (R2, Rclone, Java)
└── presentation/        # UI y Controladores
    ├── ui/              # Ventanas PySide6
    ├── workers/         # Threads para tareas async
    └── di/              # Inyección de Dependencias
```

### Flujo de Dependencias
```
Presentation → Domain ← Data/Infrastructure
```

## 🚀 Instalación

### 1. Clonar el repositorio
```bash
git clone <repo-url>
cd "Pass the host"
```

### 2. Crear entorno virtual
```bash
python -m venv venv
venv\Scripts\activate  # Windows
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Configurar la aplicación

Edita `config.json`:

```json
{
  "r2": {
    "endpoint": "https://YOUR-ACCOUNT-ID.r2.cloudflarestorage.com",
    "access_key": "YOUR_ACCESS_KEY",
    "secret_key": "YOUR_SECRET_KEY",
    "bucket_name": "minecraft-server",
    "region": "auto"
  },
  "server": {
    "server_path": "./server",
    "java_path": "./java_runtime/bin/java.exe",
    "server_jar": "server.jar",
    "memory_min": "1G",
    "memory_max": "4G",
    "server_port": 25565
  },
  "app": {
    "owner_name": "Player1",
    "auto_sync_interval": 300
  }
}
```

### 5. Preparar archivos necesarios

- **Java Runtime**: Descargar Java portable y colocar en `java_runtime/`
- **Rclone**: Descargar de [rclone.org](https://rclone.org/downloads/) y colocar en `rclone/rclone.exe`
- **Servidor Minecraft**: Colocar archivos del servidor en la carpeta especificada en `server_path`

## 🎮 Uso

### Ejecutar en modo desarrollo
```bash
python main.py
```

## 📦 Generar Ejecutable

### Método 1: Script automático (Recomendado)
```powershell
.\build.ps1
```

Este script:
- ✅ Verifica el entorno virtual
- ✅ Instala PyInstaller si no está
- ✅ Limpia builds anteriores
- ✅ Compila la aplicación
- ✅ Muestra información del ejecutable generado

### Método 2: Manual con PyInstaller
```powershell
pyinstaller build_exe.spec
```

### Resultado
El ejecutable se genera en `dist\PassTheHost.exe`

**⚠️ Importante:**
- El ejecutable **NO incluye** `java_runtime/`, `rclone/` ni `server/`
- `rclone` se descarga automáticamente al primer uso
- `java_runtime` debe estar en la misma carpeta que el .exe
- `server/` se crea cuando configuras el servidor

### Distribución
Para distribuir tu aplicación:
1. Copia `PassTheHost.exe` desde `dist/`
2. Incluye `config.example.json`
3. Incluye la carpeta `java_runtime/` (si quieres que esté preinstalada)
4. Los usuarios necesitarán configurar R2 en el primer uso

## 📚 Componentes Principales

### Domain Layer

#### Entidades
- `ServerLock`: Estado del lock del servidor
- `ServerConfig`: Configuración del servidor
- `NetworkInterface`: Interfaz de red
- `SyncProgress`: Progreso de sincronización
- `R2Config`: Configuración de Cloudflare R2

#### Interfaces (Puertos)
- `ILockService`: Gestión del lock
- `ISyncService`: Sincronización con R2
- `IServerManager`: Gestión del proceso del servidor
- `INetworkProvider`: Información de red
- `IConfigRepository`: Gestión de configuración
- `IServerPropertiesManager`: Edición de server.properties

#### Casos de Uso
- `StartServerUseCase`: Inicia el servidor (lock → sync → config → run)
- `StopServerUseCase`: Detiene el servidor (stop → sync → unlock)
- `CheckServerStatusUseCase`: Verifica disponibilidad
- `GetNetworkInterfacesUseCase`: Obtiene interfaces de red

### Infrastructure Layer

- `RcloneService`: Wrapper del binario rclone.exe con parsing de progreso
- `R2LockService`: Gestión de locks usando boto3 (S3-compatible)
- `MinecraftServerManager`: Control del proceso Java del servidor
- `NetworkProvider`: Detección de interfaces usando psutil

### Presentation Layer

- `MainWindow`: Ventana principal con PySide6
- `StartServerWorker`: Thread para inicio sin bloquear UI
- `StopServerWorker`: Thread para detención
- `CheckStatusWorker`: Thread para verificación de estado
- `DependencyContainer`: Inyección de dependencias

## 🔧 Características

✅ **Verificación de Prerequisites**: Valida Java Runtime y Rclone al inicio  
✅ **Lock Distribuido**: Previene ejecución simultánea usando R2  
✅ **Sincronización Multihilo**: Descarga/sube archivos con progreso en tiempo real  
✅ **Selección de Red**: Dropdown para elegir IP (VPN, LAN, etc.)  
✅ **Soporte para Mods**: Servidores Vanilla, Fabric y Forge  
✅ **System Tray**: Minimización a bandeja del sistema  
✅ **Logs en Vivo**: Visualización del output del servidor  
✅ **No Bloqueante**: Toda la lógica pesada corre en threads separados  

## 🎮 Servidores con Mods

La aplicación ahora soporta tres tipos de servidores:

- **Vanilla**: Servidor oficial sin mods
- **Fabric**: Servidor modded ligero y moderno
- **Forge**: Servidor modded tradicional

Para más información sobre cómo usar servidores con mods, consulta la [Guía de Servidores Modded](MODDED_SERVERS.md).  

## � Resolución de Problemas

Si encuentras errores al iniciar el servidor, consulta la [Guía de Resolución de Problemas](TROUBLESHOOTING.md).

**Problemas comunes:**
- Error `NoSuchFileException: server.properties` - Normal en primera ejecución
- El servidor no inicia - Revisa EULA y configuración de Java
- Problemas de sincronización - Verifica credenciales de R2

Para más detalles, ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## �📝 Licencia

MIT

## 👥 Contribuidores

Tu equipo de desarrollo
