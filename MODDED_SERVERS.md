# Servidores con Mods - Guía Completa

## 🎮 Tipos de Servidor Soportados

La aplicación ahora soporta tres tipos de servidores de Minecraft:

### 1. **Vanilla** (Servidor Oficial)
- Servidor oficial de Minecraft sin modificaciones
- Sin soporte para mods
- Mejor rendimiento y estabilidad
- Compatible con clientes vanilla de Minecraft
- **Usar cuando**: Quieras jugar Minecraft puro sin mods

### 2. **Fabric** (Servidor Modded Moderno)
- Servidor modded ligero y rápido
- Usa Fabric Loader para cargar mods
- Excelente rendimiento
- API moderna y fácil de usar
- Gran selección de mods de optimización
- **Usar cuando**: Quieras mods modernos con buen rendimiento

### 3. **Forge** (Servidor Modded Tradicional)
- Servidor modded tradicional
- Usa Forge Mod Loader
- La mayor biblioteca de mods disponibles
- Soporte para mods complejos y modpacks
- **Usar cuando**: Quieras usar modpacks populares o mods específicos de Forge

## 🚀 Crear un Servidor con Mods

### Desde la Interfaz Gráfica

1. **Abrir Diálogo de Creación**
   - Si no tienes un servidor, verás un botón "Crear Nuevo Servidor"
   - O usa el menú: `Archivo > Crear Servidor`

2. **Seleccionar Tipo de Servidor**
   - **Vanilla**: Servidor sin mods
   - **Fabric**: Servidor modded ligero
   - **Forge**: Servidor modded tradicional

3. **Elegir Versión de Minecraft**
   - Selecciona la versión que deseas (1.21.4, 1.20.1, etc.)
   - La aplicación descargará automáticamente el mod loader correspondiente

4. **Confirmar Java**
   - La aplicación detecta si tienes Java instalado
   - Si necesitas una versión diferente, la descargará automáticamente

5. **Crear**
   - Haz clic en "🚀 Crear Servidor"
   - Espera mientras se descargan los archivos necesarios
   - ¡Listo!

## 📦 Instalando Mods

### Para Servidores Fabric

1. **Descargar Mods**
   - Ve a [Modrinth](https://modrinth.com/) o [CurseForge](https://www.curseforge.com/minecraft/mc-mods)
   - Filtra por "Fabric" y tu versión de Minecraft
   - Descarga los archivos `.jar` de los mods

2. **Instalar Mods**
   - Crea una carpeta `mods` dentro de `server/`
   - Copia los archivos `.jar` de los mods en `server/mods/`
   - Reinicia el servidor

3. **Mods Recomendados para Fabric**
   - **Lithium**: Optimización de rendimiento
   - **Phosphor**: Optimización de iluminación
   - **FerriteCore**: Reducción de uso de memoria
   - **Fabric API**: Requerido por muchos mods

### Para Servidores Forge

1. **Descargar Mods**
   - Ve a [CurseForge](https://www.curseforge.com/minecraft/mc-mods)
   - Filtra por "Forge" y tu versión de Minecraft
   - Descarga los archivos `.jar` de los mods

2. **Instalar Mods**
   - La carpeta `mods` se crea automáticamente en `server/`
   - Copia los archivos `.jar` de los mods en `server/mods/`
   - Reinicia el servidor

3. **Mods Recomendados para Forge**
   - **Optifine**: Optimización gráfica (opcional)
   - **JEI (Just Enough Items)**: Recetas y crafteo
   - **Biomes O' Plenty**: Nuevos biomas
   - **Create**: Maquinaria y automatización

## ⚙️ Configuración

### Cambiar Tipo de Servidor Existente

Si ya tienes un servidor y quieres cambiar el tipo:

1. **Abrir Configuración**
   - Ve a `Configuración > Ajustes de R2 y Servidor`

2. **Seleccionar Nuevo Tipo**
   - Elige el tipo de servidor deseado (Vanilla, Fabric, Forge)
   - Guarda la configuración

3. **Reemplazar el JAR**
   - Elimina el `server.jar` actual en la carpeta `server/`
   - Descarga el nuevo JAR según el tipo:
     - **Vanilla**: `server.jar` oficial de Minecraft
     - **Fabric**: `fabric-server-launch.jar` de [Fabric](https://fabricmc.net/use/server/)
     - **Forge**: `forge-installer.jar` de [Forge](https://files.minecraftforge.net/)

4. **Actualizar Config**
   - Edita `config.json` y cambia `server_jar` al nombre correcto
   - Cambia `server_type` a "vanilla", "fabric" o "forge"

### Archivo config.json

```json
{
  "server": {
    "server_path": "./server",
    "java_path": "./java_runtime/bin/java.exe",
    "server_jar": "fabric-server-launch.jar",
    "server_type": "fabric",
    "memory_min": "2G",
    "memory_max": "6G",
    "server_port": 25565
  }
}
```

## 🔧 Solución de Problemas

### Forge no inicia después de instalación

**Problema**: El servidor Forge no arranca después de descargar

**Solución**:
1. Revisa `server/logs/latest.log` para errores específicos
2. Asegúrate de que tienes la versión correcta de Java
3. Forge puede requerir más memoria: aumenta `memory_max` a 6G o más
4. Verifica que aceptaste el EULA en `server/eula.txt`
5. **Importante**: La instalación de Forge puede tardar varios minutos, ten paciencia
6. Si el instalador falló, intenta instalarlo manualmente:
   ```powershell
   cd server
   java -jar forge-installer.jar --installServer
   ```

### Error al instalar Forge

**Problema**: Aparece "Error al instalar Forge" durante la creación

**Causa común**: 
- Java no encontrado o versión incorrecta
- Timeout durante la instalación
- Problemas de permisos

**Solución**:
1. Verifica que Java esté instalado: `java -version`
2. Asegúrate de tener permisos de escritura en la carpeta `server/`
3. Intenta instalar manualmente:
   ```powershell
   cd server
   # Windows
   .\java_runtime\bin\java.exe -jar forge-installer.jar --installServer
   ```
4. Revisa los logs de la aplicación para más detalles
5. Si tienes antivirus, puede estar bloqueando la instalación - agrégalo a excepciones

### Forge instalado pero no encuentra el JAR

**Problema**: "No se encontró el servidor Forge después de la instalación"

**Solución**:
1. Verifica que la instalación completó:
   - Debe existir `run.bat` o `run.sh`
   - Debe existir carpeta `libraries/`
   - Debe existir algún archivo `.jar` con "forge" en el nombre
2. Busca manualmente el JAR correcto:
   - Puede ser `forge-*-shim.jar`
   - O estar en `libraries/net/minecraftforge/forge/*/`
3. Actualiza `config.json` manualmente con el nombre correcto del JAR
4. Si usas Forge moderno (1.17+), configura `server_jar: "run.bat"` en lugar de un JAR

### Mods no se cargan

**Problema**: Los mods no aparecen en el servidor

**Solución**:
1. Verifica que los mods estén en la carpeta `server/mods/`
2. Asegúrate de que los mods son para la versión correcta de Minecraft
3. Verifica que los mods son para el mod loader correcto (Fabric o Forge)
4. Revisa los logs en `server/logs/latest.log` para errores de carga

### Incompatibilidad entre mods

**Problema**: El servidor crashea con múltiples mods

**Solución**:
1. Agrega mods uno por uno para identificar el conflicto
2. Revisa las dependencias de cada mod (algunos requieren librerías)
3. Asegúrate de que todos los mods son compatibles entre sí
4. Lee los logs detalladamente - indican qué mod causa el problema

### Cliente no puede conectarse al servidor modded

**Problema**: Los jugadores no pueden unirse

**Solución**:
1. Los clientes DEBEN tener los mismos mods que el servidor
2. Las versiones de los mods deben coincidir exactamente
3. Fabric y Forge NO son compatibles entre sí
4. Algunos mods son solo server-side (no necesitan instalarse en el cliente)

## 📋 Checklist Pre-Lanzamiento

Antes de iniciar tu servidor modded, verifica:

- [ ] Tipo de servidor seleccionado (Vanilla/Fabric/Forge)
- [ ] Versión de Minecraft correcta
- [ ] Java compatible instalado
- [ ] Mods copiados a la carpeta `server/mods/`
- [ ] Mods compatibles con la versión de Minecraft
- [ ] Mods del tipo correcto (Fabric o Forge)
- [ ] EULA aceptado (`eula=true` en `eula.txt`)
- [ ] Memoria suficiente asignada (mínimo 2G, recomendado 4-6G)
- [ ] Clientes tienen los mismos mods instalados

## 📚 Recursos Útiles

### Descarga de Mods
- [Modrinth](https://modrinth.com/) - Plataforma moderna de mods
- [CurseForge](https://www.curseforge.com/minecraft/mc-mods) - La biblioteca más grande

### Mod Loaders
- [Fabric](https://fabricmc.net/) - Documentación y descargas de Fabric
- [Forge](https://files.minecraftforge.net/) - Descargas de Forge

### Instalación en Cliente
- [MultiMC](https://multimc.org/) - Launcher con soporte para mods
- [Prism Launcher](https://prismlauncher.org/) - Fork de MultiMC mejorado
- [ATLauncher](https://atlauncher.com/) - Launcher con modpacks

## 💡 Consejos y Mejores Prácticas

1. **Empieza con pocos mods**: Agrega mods gradualmente para detectar problemas
2. **Lee las descripciones**: Cada mod indica sus requisitos y compatibilidad
3. **Backups regulares**: Guarda copias antes de agregar nuevos mods
4. **Optimización**: Usa mods de rendimiento como Lithium o Optifine
5. **Documentación**: Mantén una lista de los mods instalados y sus versiones
6. **Pruebas**: Prueba el servidor localmente antes de compartirlo
7. **Memoria**: Servidores modded necesitan más RAM (4-8GB recomendado)

## 🆘 Soporte

Si encuentras problemas:

1. Revisa [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para problemas comunes
2. Revisa los logs en `server/logs/latest.log`
3. Verifica la compatibilidad de versiones
4. Busca en los issues de GitHub del mod específico
5. Consulta la documentación oficial de Fabric o Forge

---

**Última actualización**: Diciembre 2025
