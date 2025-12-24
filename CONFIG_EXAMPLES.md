# Ejemplos de Configuración por Tipo de Servidor

## Servidor Vanilla (Oficial)

```json
{
  "r2": {
    "endpoint": "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com",
    "access_key": "YOUR_R2_ACCESS_KEY",
    "secret_key": "YOUR_R2_SECRET_KEY",
    "bucket_name": "minecraft-vanilla-server",
    "region": "auto"
  },
  "server": {
    "server_path": "./server",
    "java_path": "./java_runtime/bin/java.exe",
    "server_jar": "server.jar",
    "server_type": "vanilla",
    "memory_min": "2G",
    "memory_max": "4G",
    "server_port": 25565
  },
  "app": {
    "owner_name": "YourName",
    "auto_sync_interval": 300
  }
}
```

**Características:**
- Servidor oficial de Minecraft
- Sin soporte para mods
- Mejor rendimiento
- `server_jar`: Siempre `server.jar`

---

## Servidor Fabric (Modded Ligero)

```json
{
  "r2": {
    "endpoint": "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com",
    "access_key": "YOUR_R2_ACCESS_KEY",
    "secret_key": "YOUR_R2_SECRET_KEY",
    "bucket_name": "minecraft-fabric-server",
    "region": "auto"
  },
  "server": {
    "server_path": "./server",
    "java_path": "./java_runtime/bin/java.exe",
    "server_jar": "fabric-server-launch.jar",
    "server_type": "fabric",
    "memory_min": "2G",
    "memory_max": "6G",
    "server_port": 25565
  },
  "app": {
    "owner_name": "YourName",
    "auto_sync_interval": 300
  }
}
```

**Características:**
- Soporte para mods Fabric
- Excelente rendimiento
- API moderna
- `server_jar`: `fabric-server-launch.jar`
- **Memoria recomendada**: 4-6GB para servidores con mods

**Estructura de carpetas:**
```
server/
├── fabric-server-launch.jar
├── server.properties
├── eula.txt
├── mods/                    # Coloca los mods aquí
│   ├── fabric-api.jar
│   ├── lithium.jar
│   └── phosphor.jar
└── config/                  # Configuración de mods
```

---

## Servidor Forge (Modded Tradicional)

```json
{
  "r2": {
    "endpoint": "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com",
    "access_key": "YOUR_R2_ACCESS_KEY",
    "secret_key": "YOUR_R2_SECRET_KEY",
    "bucket_name": "minecraft-forge-server",
    "region": "auto"
  },
  "server": {
    "server_path": "./server",
    "java_path": "./java_runtime/bin/java.exe",
    "server_jar": "forge-1.21.4-54.0.25-shim.jar",
    "server_type": "forge",
    "memory_min": "3G",
    "memory_max": "8G",
    "server_port": 25565
  },
  "app": {
    "owner_name": "YourName",
    "auto_sync_interval": 300
  }
}
```

**Características:**
- Soporte para mods Forge
- Mayor biblioteca de mods disponibles
- Compatible con modpacks
- `server_jar`: Variable según versión (puede ser `forge-*-shim.jar` o `forge-*-universal.jar`)
- **Memoria recomendada**: 6-8GB para servidores con muchos mods

**Estructura de carpetas:**
```
server/
├── forge-installer.jar       # Instalador (opcional después de instalación)
├── forge-*-shim.jar         # Ejecutable del servidor
├── libraries/               # Librerías de Forge (auto-generado)
├── server.properties
├── eula.txt
├── mods/                    # Coloca los mods aquí
│   ├── jei.jar
│   ├── biomesoplenty.jar
│   └── create.jar
└── config/                  # Configuración de mods
```

---

## Notas Importantes

### Memoria Asignada

La memoria necesaria depende de:
- **Vanilla**: 2-4GB suficiente
- **Fabric con pocos mods**: 4-6GB
- **Fabric con muchos mods**: 6-8GB
- **Forge con pocos mods**: 4-6GB
- **Forge con modpacks grandes**: 8-12GB

### Server JAR

El nombre del archivo JAR varía:

- **Vanilla**: Siempre `server.jar`
- **Fabric**: Siempre `fabric-server-launch.jar`
- **Forge**: Depende de la versión
  - Versiones modernas: `forge-{version}-shim.jar`
  - Versiones antiguas: `forge-{version}-universal.jar`
  - Puedes encontrarlo después de ejecutar el instalador

### Sincronización con R2

**Importante**: La carpeta `mods/` se sincroniza automáticamente con R2.

Esto significa:
- ✅ Todos los jugadores tendrán los mismos mods
- ✅ Los mods se sincronizan entre dispositivos
- ✅ Backups automáticos de los mods en la nube
- ⚠️ La sincronización puede tardar si tienes muchos mods grandes

### Compatibilidad

**CRÍTICO**: Fabric y Forge NO son compatibles entre sí.

- Los mods de Fabric solo funcionan en servidores Fabric
- Los mods de Forge solo funcionan en servidores Forge
- No puedes mezclar mods de diferentes loaders

---

## Cambiar de Tipo

Si quieres cambiar el tipo de servidor:

1. **Hacer backup** de tu mundo actual
2. **Detener el servidor**
3. **Cambiar configuración** en el diálogo de configuración
4. **Descargar nuevo JAR** según el tipo deseado
5. **Actualizar** `config.json` con el nuevo `server_jar` y `server_type`
6. **Copiar mods** compatibles con el nuevo loader
7. **Iniciar servidor**

**Nota**: El mundo es compatible entre tipos, pero los items de mods se perderán si cambias de loader.

---

## Ejemplos de Uso

### Servidor Vanilla para Amigos
```json
"memory_min": "2G",
"memory_max": "4G",
"server_type": "vanilla"
```

### Servidor Fabric con Optimización
```json
"memory_min": "3G",
"memory_max": "6G",
"server_type": "fabric"
```
**Mods recomendados**: Lithium, Phosphor, FerriteCore, Fabric API

### Servidor Forge con Modpack Grande
```json
"memory_min": "4G",
"memory_max": "10G",
"server_type": "forge"
```
**Nota**: Modpacks como "All The Mods" o "FTB" requieren mucha RAM

---

Para más información, consulta [MODDED_SERVERS.md](MODDED_SERVERS.md)
