# Documentación Técnica - Minecraft Distributed Server Launcher

## 📐 Arquitectura Detallada

### Principios de Clean Architecture Aplicados

1. **Independencia de Frameworks**: La lógica de negocio (Domain) no depende de PySide6 ni ningún framework externo
2. **Testeable**: Cada capa puede ser testeada independientemente gracias a las interfaces
3. **Independencia de UI**: Se puede cambiar PySide6 por CustomTkinter sin tocar el dominio
4. **Independencia de BD**: Se puede cambiar R2 por AWS S3 o Azure Blob sin afectar los casos de uso
5. **Independencia de Agentes Externos**: Rclone es un detalle de implementación intercambiable

### Diagrama de Flujo - Inicio del Servidor

```
Usuario presiona "Iniciar"
         ↓
MainWindow._start_server()
         ↓
Crea StartServerWorker (QThread)
         ↓
Worker.run() ejecuta StartServerUseCase
         ↓
┌─────────────────────────────────────┐
│ StartServerUseCase.execute()        │
├─────────────────────────────────────┤
│ 1. Check Lock (R2LockService)       │
│    ↓                                 │
│ 2. Acquire Lock (R2LockService)     │
│    ↓                                 │
│ 3. Sync Download (RcloneService)    │
│    ├─ Parsea progreso en tiempo real│
│    └─ Emite signals a UI             │
│    ↓                                 │
│ 4. Update server.properties          │
│    (ServerPropertiesManager)         │
│    ↓                                 │
│ 5. Start Server (ServerManager)     │
│    └─ subprocess.Popen (Java)        │
└─────────────────────────────────────┘
         ↓
Worker emite finished signal
         ↓
MainWindow actualiza UI
```

### Diagrama de Flujo - Detención del Servidor

```
Usuario presiona "Detener"
         ↓
MainWindow._stop_server()
         ↓
Crea StopServerWorker (QThread)
         ↓
Worker.run() ejecuta StopServerUseCase
         ↓
┌─────────────────────────────────────┐
│ StopServerUseCase.execute()         │
├─────────────────────────────────────┤
│ 1. Send "stop" command              │
│    (ServerManager)                   │
│    ↓                                 │
│ 2. Wait for clean shutdown          │
│    (process.wait timeout=30s)       │
│    ↓                                 │
│ 3. Sync Upload (RcloneService)      │
│    ├─ Parsea progreso               │
│    └─ Emite signals a UI             │
│    ↓                                 │
│ 4. Release Lock (R2LockService)     │
└─────────────────────────────────────┘
         ↓
Worker emite finished signal
         ↓
MainWindow actualiza UI
```

## 🔌 Inyección de Dependencias

El `DependencyContainer` es el único lugar donde se instancian las implementaciones concretas:

```python
# En DependencyContainer.__init__():
self._sync_service = RcloneService()  # Implementación concreta
self._lock_service = R2LockService(r2_config)
# ...

# Los use cases reciben interfaces (puertos):
self._start_server_use_case = StartServerUseCase(
    lock_service=self.get_lock_service(),  # Retorna ILockService
    sync_service=self.get_sync_service(),  # Retorna ISyncService
    # ...
)
```

**Ventaja**: Para testear, simplemente inyecta mocks:
```python
mock_lock = MockLockService()
use_case = StartServerUseCase(lock_service=mock_lock, ...)
```

## 🧵 Multithreading con PySide6

### Problema: Operaciones Bloqueantes
- Rclone sync puede tardar minutos
- Boto3 hace llamadas HTTP a R2
- Subprocess.Popen bloquea hasta que el servidor corre

### Solución: QThread Workers

```python
class StartServerWorker(QThread):
    progress_update = Signal(str, SyncProgress)  # Signal para UI
    finished = Signal(bool, str)
    
    def run(self):
        # Este código corre en un thread separado
        loop = asyncio.new_event_loop()
        success, message = loop.run_until_complete(
            self.use_case.execute(...)
        )
        self.finished.emit(success, message)  # Notifica a UI
```

**Conexión en MainWindow:**
```python
worker = StartServerWorker(...)
worker.progress_update.connect(self._on_progress_update)  # Slot
worker.finished.connect(self._on_start_finished)
worker.start()  # Inicia el thread
```

### Signals & Slots
- **Signals**: Eventos emitidos por el worker
- **Slots**: Métodos de la UI que responden a signals
- **Thread-safe**: Qt maneja la sincronización automáticamente

## 🔍 Parsing de Progreso de Rclone

Rclone emite output así:
```
Transferred:   	    10.5M / 100M, 10%, 2.1M/s, ETA 42s
 *                file.dat: 50% /10.5M, 2.1M/s, 5s
```

El `RcloneService._parse_progress()` usa regex para extraer:
- Bytes transferidos / total
- Porcentaje
- Velocidad (MB/s)
- ETA (segundos)
- Archivo actual

**Implementación clave:**
```python
def _parse_progress(self, line: str) -> Optional[SyncProgress]:
    bytes_pattern = r'Transferred:\s+(.+?)\s+/\s+(.+?),\s+(\d+)%'
    match = re.search(bytes_pattern, line)
    if match:
        transferred = self._parse_size(match.group(1))  # "10.5M" → bytes
        total = self._parse_size(match.group(2))
        return SyncProgress(transferred_bytes=transferred, total_bytes=total)
```

## 🔒 Sistema de Lock Distribuido

### Problema
Dos jugadores intentan iniciar el servidor simultáneamente → corrupción de archivos

### Solución
Archivo `server.lock` en R2:
```json
{
  "owner_name": "Player1",
  "locked_at": "2025-12-23T10:30:00",
  "ip_address": "10.0.0.5"
}
```

**Flujo:**
1. Antes de iniciar, `check_lock()` verifica si existe
2. Si existe y no es nuestro, bloquear UI
3. Si no existe, `acquire_lock()` crea el archivo
4. Al detener, `release_lock()` lo elimina

**Implementación con boto3:**
```python
# Crear lock
client.put_object(
    Bucket=bucket_name,
    Key="server.lock",
    Body=json.dumps(lock_data).encode('utf-8')
)

# Verificar lock
try:
    response = client.get_object(Bucket=bucket_name, Key="server.lock")
    # Existe, leer datos
except ClientError as e:
    if e.response['Error']['Code'] == 'NoSuchKey':
        # No existe, disponible
```

## 🌐 Selección de Interfaz de Red

### Problema
Minecraft necesita la IP correcta en `server-ip=` de server.properties

### Solución
1. `NetworkProvider` usa `psutil.net_if_addrs()` para listar todas las interfaces
2. Filtra solo IPv4 activas (excluye localhost)
3. Usuario selecciona la IP de RadminVPN/Hamachi
4. `ServerPropertiesManager` escribe la IP antes de iniciar

**Código:**
```python
# Obtener interfaces
interfaces = psutil.net_if_addrs()
for name, addrs in interfaces.items():
    for addr in addrs:
        if addr.family == socket.AF_INET and addr.address != '127.0.0.1':
            # Esta es una interfaz válida
```

## 📦 Empaquetado con PyInstaller

### Comando Completo
```bash
pyinstaller --name="MinecraftServerLauncher" \
    --windowed \  # Sin consola
    --onefile \   # Un solo .exe
    --add-data "config.json;." \
    --add-data "rclone;rclone" \
    --add-data "java_runtime;java_runtime" \
    --hidden-import=PySide6 \
    --hidden-import=boto3 \
    --icon=icon.ico \
    main.py
```

### Estructura del Ejecutable
```
MinecraftServerLauncher.exe
config.json
rclone/
  └── rclone.exe
java_runtime/
  └── bin/
      └── java.exe
server/  # Creada al sincronizar
```

## 🧪 Testing (Futuro)

### Domain Layer
```python
# tests/domain/test_start_server_use_case.py
def test_start_server_acquires_lock():
    mock_lock = MockLockService()
    use_case = StartServerUseCase(lock_service=mock_lock, ...)
    
    await use_case.execute("Player1", "10.0.0.1")
    
    assert mock_lock.acquire_called_with("Player1", "10.0.0.1")
```

### Infrastructure Layer
```python
# tests/infrastructure/test_rclone_service.py
def test_parse_progress_bytes():
    service = RcloneService()
    line = "Transferred:   	    10M / 100M, 10%, 2M/s, ETA 45s"
    
    progress = service._parse_progress(line)
    
    assert progress.transferred_bytes == 10 * 1024 * 1024
    assert progress.total_bytes == 100 * 1024 * 1024
    assert progress.get_percentage() == 10.0
```

## 🔧 Configuración de Rclone

### Archivo rclone.conf (Opcional)
Si prefieres usar configuración de rclone en vez de parámetros:

```ini
[cloudflare]
type = s3
provider = Cloudflare
access_key_id = YOUR_ACCESS_KEY
secret_access_key = YOUR_SECRET_KEY
endpoint = https://YOUR-ACCOUNT-ID.r2.cloudflarestorage.com
acl = private
```

Luego en `RcloneService`, usar:
```python
command = [
    "rclone", "sync",
    "cloudflare:bucket/path",
    "local/path",
    "--config", "rclone.conf"
]
```

## 📊 Logs y Debugging

### Sistema de Logging
```python
# En container.py
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),  # Archivo
        logging.StreamHandler()          # Consola
    ]
)
```

### Niveles de Log
- **INFO**: Eventos normales (servidor iniciado, lock adquirido)
- **WARNING**: Situaciones anómalas (lock ya existe)
- **ERROR**: Errores recuperables (fallo al sincronizar)
- **DEBUG**: Información detallada (output de rclone)

### Ver Logs en Producción
```bash
# Windows
type app.log | findstr ERROR

# Linux/Mac
tail -f app.log | grep ERROR
```

## 🔐 Seguridad

### Configuración Sensible
- **NO** commitear `config.json` con credenciales reales
- Usar variables de entorno:
```python
import os
r2_config = R2Config(
    access_key=os.getenv('R2_ACCESS_KEY'),
    secret_key=os.getenv('R2_SECRET_KEY'),
    # ...
)
```

### Permisos de R2
El usuario IAM debe tener:
- `s3:GetObject` (descargar)
- `s3:PutObject` (subir)
- `s3:DeleteObject` (borrar lock)
- `s3:ListBucket` (listar archivos)

## 🚀 Mejoras Futuras

1. **Auto-actualización**: Verificar nueva versión del servidor
2. **Backups Automáticos**: Copia incremental en R2 cada X horas
3. **Whitelist Sync**: Sincronizar whitelist.json entre instancias
4. **Monitoring**: Enviar métricas (uptime, jugadores) a Discord webhook
5. **Multi-servidor**: Soportar múltiples servidores (survival, creative)
6. **Configuración GUI**: Editar config.json desde la UI
7. **Rclone Config Wizard**: Asistente para configurar R2

## 📞 Soporte

Si encuentras problemas:
1. Revisa `app.log`
2. Verifica prerequisites (Java, Rclone)
3. Valida credenciales de R2
4. Asegúrate de tener permisos en el bucket
