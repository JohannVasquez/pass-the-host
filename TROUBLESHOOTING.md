# Guía de Resolución de Problemas

## Error: "Failed to load properties from file: server.properties"

### Descripción del Problema

Al iniciar el servidor por primera vez después de descargar los archivos, puedes ver este error en los logs:

```
[ServerMain/ERROR]: Failed to load properties from file: server.properties
java.nio.file.NoSuchFileException: server.properties
```

### ¿Es esto un problema?

**NO, este error es NORMAL y ESPERADO** en la primera ejecución del servidor Minecraft.

### ¿Por qué ocurre?

El servidor de Minecraft intenta cargar el archivo `server.properties` al iniciar. Si no existe:

1. Muestra este error en los logs
2. **Continúa normalmente** y genera el archivo automáticamente
3. Crea `server.properties` con valores por defecto
4. El servidor inicia correctamente

### ¿Cómo verificar que todo está bien?

Después del error, deberías ver estos mensajes en el log:

```
[ServerMain/INFO]: Loading properties
[Server thread/INFO]: Starting minecraft server version X.X.X
[Server thread/INFO]: Starting Minecraft server on *:25565
[Server thread/INFO]: Done (X.XXXs)! For help, type "help"
```

Si ves `Done (X.XXXs)!`, **el servidor inició correctamente**.

### ¿Cuándo SÍ es un problema?

Solo es un problema si:

- El servidor **NO muestra** el mensaje `Done (X.XXXs)!`
- El proceso termina inmediatamente
- No se crea el archivo `server.properties` después de la primera ejecución

### Solución Automática de la Aplicación

La aplicación "Pass the host" maneja esto automáticamente:

1. **Primera ejecución detectada**: Si no existe `server.properties` después de descargar
2. **Inicia el servidor temporalmente**: Para que genere los archivos
3. **Espera 20 segundos**: Para permitir la generación de archivos
4. **Detiene el servidor**: Cierra el servidor temporal
5. **Actualiza la configuración**: Modifica `server.properties` con tu IP
6. **Inicia normalmente**: Arranca el servidor con la configuración correcta

### Otros Archivos que se Generan Automáticamente

En la primera ejecución, el servidor también genera:

- `eula.txt` - Aceptación del EULA de Minecraft
- `banned-ips.json`
- `banned-players.json`
- `ops.json`
- `whitelist.json`
- `usercache.json`
- Carpeta `world/` - El mundo del servidor
- Carpeta `logs/` - Archivos de log

### Mejoras Implementadas

Se han implementado las siguientes mejoras para manejar mejor este escenario:

1. **Exclusión de archivos bloqueados**: Durante el upload, se excluyen logs y archivos en uso
2. **Mejor logging**: Mensajes más claros sobre el estado de los archivos
3. **Verificación post-sync**: Comprueba que los archivos críticos existan
4. **Manejo de primera ejecución**: Detecta y maneja automáticamente la primera vez

### ¿Necesitas Ayuda?

Si después de leer esto sigues teniendo problemas:

1. Revisa los logs completos en `server/logs/latest.log`
2. Verifica que el archivo `server.properties` se haya creado en `server/`
3. Asegúrate de que el servidor muestre `Done (X.XXXs)!` en los logs
4. Verifica que el archivo `eula.txt` exista y contenga `eula=true`

## Otros Problemas Comunes

### El servidor no inicia

**Posibles causas:**

1. **EULA no aceptado**: Verifica que `eula.txt` contenga `eula=true`
2. **Puerto ocupado**: Otro proceso está usando el puerto 25565
3. **Memoria insuficiente**: La configuración de memoria es muy alta para tu sistema
4. **Java no encontrado**: La ruta de Java en la configuración es incorrecta

### Archivos no se sincronizan

**Verifica:**

1. Configuración de R2 correcta en `config.json`
2. Credenciales válidas (access_key, secret_key)
3. El bucket existe y es accesible
4. Hay conexión a internet

### Errores de lock

Si ves errores sobre el lock del servidor:

1. Usa la opción "Release Lock" en la interfaz
2. Verifica que el archivo de lock en R2 no esté corrupto
3. Asegúrate de que solo una instancia esté ejecutándose

---

**Última actualización**: Diciembre 2025
