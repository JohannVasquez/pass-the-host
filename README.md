# Pass the Host 🌍

**Servidor de Minecraft compartido en la nube** - Juega con tus amigos desde cualquier computadora sin dejar el servidor encendido 24/7.

## ¿Para qué sirve?

**Pass the Host** te permite compartir un servidor de Minecraft con tus amigos de forma que **cualquiera pueda iniciarlo desde su propia computadora**. El mundo del servidor se sincroniza automáticamente en la nube (Cloudflare R2), por lo que:

✅ No necesitas dejar tu PC encendida todo el tiempo  
✅ Cualquier jugador puede ser el "host" cuando quiera jugar  
✅ El mundo se mantiene sincronizado entre todos  
✅ Solo una persona puede iniciar el servidor a la vez (sistema de "lock")  
✅ Soporta servidores Vanilla, Fabric y Forge  

### ¿Cómo funciona?

1. **Configuras** la aplicación con tus credenciales de Cloudflare R2 (almacenamiento gratuito/económico)
2. **Primera vez**: Alguien inicia el servidor y el mundo se sube a la nube
3. **Siguientes veces**: La app descarga el mundo más reciente, inicia el servidor, y cuando lo detienes, sube los cambios
4. **Sistema de turnos**: Si alguien ya tiene el servidor corriendo, la app te avisa y no deja que lo inicies

#### Nota: Recomiendo usar un VPN como RadminVPN
---

## 🚀 Instalación y Configuración

### Paso 1: Descargar la Aplicación

1. Ve a la sección **[Releases](https://github.com/JohannVasquez/pass-the-host/releases)** del repositorio
2. Descarga el archivo **`PassTheHost.exe`** de la última versión
3. Colócalo en una carpeta dedicada (ej: `C:\PassTheHost\`)

> ⚠️ **Importante**: La aplicación descargará automáticamente Java Runtime y Rclone al primer uso

### Paso 2: Crear Cuenta en Cloudflare R2

Cloudflare R2 es un servicio de almacenamiento en la nube con **10 GB gratis al mes** (más que suficiente para mundos de Minecraft).

1. **Crea una cuenta**: [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Activa R2**: En el panel, ve a `R2 Object Storage` y activa el servicio
3. **Crea un Bucket**:
   - Nombre: `minecraft-server` (o el que prefieras)
   - Región: Automática
4. **Genera las claves de acceso**:
   - Ve a `R2 > Manage R2 API Tokens`
   - Click en "Create API Token"
   - Permisos: **Read & Write**
   - Guarda el **Access Key ID** y **Secret Access Key**

**Cómo obtener el endpoint:**
- En tu bucket de R2, copia la URL del endpoint
- Formato: `https://YOUR-ACCOUNT-ID.r2.cloudflarestorage.com`

### Paso 3: Configurar la Aplicación

1. **Ejecuta** `Pass the host!.exe`
2. La primera vez, se abrirá automáticamente la ventana de configuración
3. **Completa los datos**:
   - **R2 Endpoint**: `https://tu-cuenta.r2.cloudflarestorage.com`
   - **Access Key**: Tu Access Key ID de R2
   - **Secret Key**: Tu Secret Access Key de R2
   - **Bucket Name**: El nombre de tu bucket (ej: `minecraft-server`)
   - **Server JAR**: `server.jar` (o el nombre de tu servidor Fabric/Forge)
   - **Memoria**: Ajusta según tu PC (mínimo 1G, máximo 4G recomendado)

4. **Guarda la configuración**

> 💡 **Nota**: La aplicación instalará automáticamente Java Runtime y Rclone en el primer inicio

### Paso 4: Preparar el Servidor de Minecraft

#### Opción A: Servidor Vanilla (sin mods)

1. Abre la app y haz click en **▶️ Iniciar Servidor**
2. La app descargará automáticamente el archivo `server.jar` en la carpeta `server/` si no existe
3. La primera vez creará `eula.txt` y se detendrá
4. Ve a `server/eula.txt` y cambia `eula=false` a `eula=true`
5. Vuelve a iniciar el servidor

#### Opción B: Servidor con Mods (Fabric/Forge)

1. Desde la app, selecciona el tipo de servidor (Fabric/Forge) en la configuración
2. La app descargará e instalará automáticamente el servidor Fabric o Forge en la carpeta `server/`
3. Coloca tus mods en `server/mods/`
4. Inicia el servidor desde la app

---

## 🎮 Cómo Usarlo

### Ejecutar la Aplicación

Simplemente **abre** `PassTheHost.exe`

La primera vez:
- Descargará e instalará automáticamente **Java Runtime** (~100 MB)
- Descargará e instalará automáticamente **Rclone** (~20 MB)
- Te pedirá configurar las credenciales de R2

### Interfaz de Usuario

La aplicación tiene los siguientes botones principales:

1. **🔑 Configurar R2**:
   - Abre la ventana para ingresar o modificar las credenciales de Cloudflare R2 y la configuración básica de la app.

2. **🔓 Liberar Lock**:
   - Libera manualmente el bloqueo del servidor en la nube si quedó atascado (por ejemplo, tras un cierre inesperado).

3. **▶️ Iniciar Servidor**:
   - Descarga el mundo más reciente desde R2
   - Verifica el lock y la configuración
   - Permite elegir la IP de red
   - Inicia el servidor de Minecraft

4. **⏹️ Detener Servidor**:
   - Detiene el servidor de forma segura
   - Sube los cambios del mundo a R2
   - Libera el lock para que otros puedan iniciar

5. **⚙️ Editar server.properties**:
   - Permite editar el archivo `server.properties` desde la app
   - Cambia nombre, dificultad, modo de juego, etc. fácilmente

6. **🌍 Subir Nuevo Mundo**:
   - Reemplaza el mundo actual con uno nuevo desde un archivo .zip
   - Útil para cambiar de mundo o restaurar backups

### Sistema de Logs

La ventana muestra en tiempo real:
- Estado del servidor (iniciando, corriendo, deteniendo)
- Progreso de sincronización con R2
- Output del servidor de Minecraft
- Errores o advertencias

---

## 📦 Generar Ejecutable (Para Desarrolladores)

Si quieres compilar el ejecutable tú mismo desde el código fuente:

### Requisitos

- Python 3.10 o superior
- Git

### Pasos

```bash
# Clonar el repositorio
git clone https://github.com/JohannVasquez/pass-the-host.git
cd "pass-the-host"

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Compilar el ejecutable
.\build.ps1
```

El ejecutable se generará en `dist\PassTheHost.exe`

---

## 🤝 Compartir con Amigos

Para que tus amigos puedan jugar:

1. **Comparte el ejecutable**: Envíales `PassTheHost.exe` desde [Releases](https://github.com/JohannVasquez/pass-the-host/releases)
2. **Comparte las credenciales de R2**: Todos necesitan las mismas credenciales (endpoint, access key, secret key, bucket)
   - ⚠️ **Advertencia:** Las credenciales de Cloudflare R2 permiten acceso total al bucket. **Solo compártelas con personas de absoluta confianza**. No las publiques ni las compartas en foros o redes públicas.
3. **Mismo servidor JAR**: Asegúrate de que todos usen la misma versión del servidor y los mismos mods

> 💡 **Recomendación**: Crea un canal de Discord/WhatsApp para coordinar quién va a iniciar el servidor

---

## ⚙️ Características

- ✅ **Sincronización Automática**: El mundo se sincroniza al iniciar y detener el servidor
- ✅ **Lock Distribuido**: Evita que dos personas inicien el servidor al mismo tiempo
- ✅ **Selección de IP**: Elige qué interfaz de red usar (LAN, VPN, etc.)
- ✅ **Soporte para Mods**: Compatible con Vanilla, Fabric y Forge
- ✅ **Logs en Vivo**: Ve el output del servidor en tiempo real
- ✅ **Editor Integrado**: Modifica `server.properties` sin salir de la app
- ✅ **Carga de Mundos**: Sube nuevos mundos desde archivos .zip
- ✅ **System Tray**: Minimiza a la bandeja del sistema

---

## 🛠️ Arquitectura Técnica

El proyecto sigue **Clean Architecture** con separación de capas:

- **Domain**: Lógica de negocio pura (entidades, casos de uso, interfaces)
- **Data**: Repositorios de configuración
- **Infrastructure**: Servicios externos (R2, Rclone, Java, Red)
- **Presentation**: UI con PySide6 (Qt)

Más detalles técnicos en [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 📝 Licencia

MIT

---


## 🤲 Contribución

¿Quieres contribuir al repositorio? ¡Dios te acompañe! Este proyecto se hizo a puro *vibe coding*.

---

## 🙏 Créditos

Desarrollado para facilitar el juego de Minecraft entre amigos sin necesidad de servidores dedicados o hosting comercial.
