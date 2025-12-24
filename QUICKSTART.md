# 🚀 Quick Start Guide - Minecraft Distributed Server Launcher

## ⚡ Instalación Rápida (5 minutos)

### Paso 1: Python y Dependencias
```bash
# Verificar Python 3.10+
python --version

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt
```

### Paso 2: Descargar Binarios Necesarios

#### Rclone
1. Ir a https://rclone.org/downloads/
2. Descargar la versión para Windows (rclone-v1.xx.x-windows-amd64.zip)
3. Extraer y crear carpeta: `rclone/rclone.exe` en la raíz del proyecto

```
Pass the host/
└── rclone/
    └── rclone.exe  ← Colocar aquí
```

#### Java Runtime (Portable)
1. Ir a https://adoptium.net/ o https://www.azul.com/downloads/
2. Descargar JRE portable (sin instalador)
3. Extraer en: `java_runtime/`

```
Pass the host/
└── java_runtime/
    └── bin/
        └── java.exe  ← Debe existir aquí
```

### Paso 3: Configurar Cloudflare R2

#### Crear Bucket
1. Ir a https://dash.cloudflare.com/
2. R2 → Create Bucket → Nombre: `minecraft-server`

#### Generar Credenciales
1. R2 → Manage R2 API Tokens → Create API Token
2. Permisos: Admin Read & Write
3. Copiar:
   - Access Key ID
   - Secret Access Key
   - Endpoint (formato: `https://ACCOUNT_ID.r2.cloudflarestorage.com`)

#### Editar config.json
```json
{
  "r2": {
    "endpoint": "https://TU_ACCOUNT_ID.r2.cloudflarestorage.com",
    "access_key": "TU_ACCESS_KEY_AQUI",
    "secret_key": "TU_SECRET_KEY_AQUI",
    "bucket_name": "minecraft-server",
    "region": "auto"
  },
  "server": {
    "server_path": "./server",
    "java_path": "./java_runtime/bin/java.exe",
    "server_jar": "server.jar",
    "memory_min": "2G",
    "memory_max": "4G",
    "server_port": 25565
  },
  "app": {
    "owner_name": "TU_NOMBRE_AQUI",
    "auto_sync_interval": 300
  }
}
```

### Paso 4: Preparar Servidor Minecraft

#### Si ya tienes archivos del servidor:
```bash
# Copiar tu carpeta de servidor a ./server/
# Debe contener: server.jar, server.properties, world/, etc.
```

#### Si empiezas desde cero:
1. Descargar server.jar de https://www.minecraft.net/download/server
2. Crear carpeta `server/`
3. Colocar server.jar ahí
4. Ejecutar una vez manualmente para generar archivos

```bash
cd server
java -Xmx1G -Xms1G -jar server.jar nogui
# Editar eula.txt → eula=true
# Ejecutar de nuevo hasta que genere todos los archivos
```

### Paso 5: ¡Ejecutar!
```bash
python main.py
```

---

## ✅ Checklist de Verificación

Antes de ejecutar, verifica que existan:
- [ ] `config.json` con credenciales válidas
- [ ] `rclone/rclone.exe`
- [ ] `java_runtime/bin/java.exe`
- [ ] `server/server.jar`
- [ ] `server/server.properties`
- [ ] Bucket de R2 creado y accesible

---

## 🐛 Solución de Problemas Comunes

### Error: "java_runtime no encontrada"
```bash
# Verificar que la ruta sea correcta
ls java_runtime/bin/java.exe  # Linux/Mac
dir java_runtime\bin\java.exe  # Windows

# Si no existe, descarga JRE portable y colócalo ahí
```

### Error: "rclone.exe no encontrado"
```bash
# Verificar que exista
ls rclone/rclone.exe

# Descargar de https://rclone.org/downloads/
# Extraer y colocar en rclone/rclone.exe
```

### Error: "Configuración de R2 inválida"
```json
// Verifica en config.json:
{
  "r2": {
    "endpoint": "https://XXXXX.r2.cloudflarestorage.com",  // ← Debe tener HTTPS
    "access_key": "...",  // ← No debe estar vacío
    "secret_key": "...",  // ← No debe estar vacío
    "bucket_name": "minecraft-server"  // ← Debe coincidir con tu bucket
  }
}
```

### Error: "NoSuchBucket"
- Verifica que el bucket exista en tu dashboard de Cloudflare R2
- Asegúrate de que el nombre sea exacto (case-sensitive)

### Error: "Access Denied"
- Verifica que las credenciales sean correctas
- Asegúrate de que el token tenga permisos de lectura/escritura

### Error: "ModuleNotFoundError: No module named 'PySide6'"
```bash
# Reinstalar dependencias
pip install -r requirements.txt

# O instalar manualmente
pip install PySide6 psutil boto3
```

---

## 📖 Uso Básico

### Primera Vez (Host Inicial)
1. Abrir la aplicación
2. Verificar estado: Debe decir "✅ SERVIDOR DISPONIBLE"
3. Seleccionar interfaz de red (tu IP de Hamachi/RadminVPN)
4. Clic en "▶️ INICIAR SERVIDOR"
5. Esperar sincronización (primera vez puede tardar)
6. ¡Listo! El servidor está corriendo

### Como Jugador (Tomar Control)
1. Abrir la aplicación
2. Si alguien más lo está usando, verás "🔴 SERVIDOR EN USO"
3. Cuando esté disponible, seleccionar tu IP
4. Clic en "▶️ INICIAR SERVIDOR"
5. El servidor sincronizará automáticamente

### Detener el Servidor
1. Clic en "⏹️ DETENER SERVIDOR"
2. Esperar a que sincronice los cambios a R2
3. El lock se liberará automáticamente

### Minimizar a Bandeja
1. Clic en minimizar mientras el servidor corre
2. La app se ocultará en system tray (junto al reloj)
3. Doble clic en el ícono para restaurar

---

## 🎮 Flujo Típico de Juego

**Jugador 1 (Día 1):**
```
1. Inicia app → Servidor disponible ✅
2. Selecciona IP de Hamachi
3. Inicia servidor → Descarga archivos de R2
4. Juega Minecraft
5. Detiene servidor → Sube archivos a R2
```

**Jugador 2 (Día 2):**
```
1. Inicia app → Servidor disponible ✅
2. Selecciona su IP de Hamachi
3. Inicia servidor → Descarga archivos actualizados de R2
4. Juega con el progreso del Jugador 1
5. Detiene servidor → Sube sus cambios a R2
```

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE
- **NUNCA** commitear `config.json` con credenciales reales a GitHub
- Agregar `config.json` a `.gitignore` (ya incluido)
- Usar variables de entorno en producción:

```python
import os
r2_config = R2Config(
    access_key=os.getenv('R2_ACCESS_KEY', 'default_key'),
    secret_key=os.getenv('R2_SECRET_KEY', 'default_secret'),
    # ...
)
```

### Permisos Recomendados de R2
```
Scope: All buckets o solo minecraft-server
Permissions:
  ✅ Object Read
  ✅ Object Write
  ✅ Object Delete (para borrar lock)
  ✅ Bucket Read (listar archivos)
```

---

## 📊 Monitoreo

### Ver Logs en Tiempo Real
```bash
# Windows
type app.log

# Linux/Mac
tail -f app.log
```

### Ver Solo Errores
```bash
# Windows
type app.log | findstr ERROR

# Linux/Mac
grep ERROR app.log
```

---

## 🚀 Generar Ejecutable (Opcional)

Para distribuir a tus amigos sin que instalen Python:

```bash
# Instalar PyInstaller
pip install pyinstaller

# Generar ejecutable
pyinstaller --name="MinecraftServerLauncher" ^
    --windowed ^
    --onefile ^
    --add-data "config.json;." ^
    --icon=icon.ico ^
    main.py

# El .exe estará en dist/MinecraftServerLauncher.exe
```

**Distribuir:**
```
MinecraftServerLauncher.exe
config.json (SIN credenciales, cada usuario pone las suyas)
rclone/rclone.exe
java_runtime/
```

---

## 🆘 Ayuda Adicional

**Documentación:**
- [README.md](README.md) - Visión general
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detalles técnicos
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Estructura del código

**Logs:**
- `app.log` - Historial completo de eventos

**Configuración:**
- `config.json` - Todas las configuraciones

---

✨ **¡Listo para jugar Minecraft sin pagar hosting!**
