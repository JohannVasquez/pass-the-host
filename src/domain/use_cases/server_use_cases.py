"""
Casos de Uso - Lógica de Negocio de la Aplicación
"""
import logging
import asyncio
from pathlib import Path
from typing import Optional, Callable

from src.domain.interfaces.services import (
    ILockService,
    ISyncService,
    IServerManager,
    INetworkProvider,
    IConfigRepository,
    IServerPropertiesManager
)
from src.domain.entities.server_entities import (
    ServerLock,
    ServerConfig,
    NetworkInterface,
    SyncProgress
)

logger = logging.getLogger(__name__)


class StartServerUseCase:
    """Caso de uso para iniciar el servidor"""
    
    def __init__(
        self,
        lock_service: ILockService,
        sync_service: ISyncService,
        server_manager: IServerManager,
        config_repo: IConfigRepository,
        properties_manager: IServerPropertiesManager
    ):
        self.lock_service = lock_service
        self.sync_service = sync_service
        self.server_manager = server_manager
        self.config_repo = config_repo
        self.properties_manager = properties_manager
    
    async def execute(
        self,
        owner_name: str,
        selected_ip: str,
        progress_callback: Optional[Callable[[str, SyncProgress], None]] = None
    ) -> tuple[bool, str]:
        """
        Ejecuta el proceso de inicio del servidor
        Returns:
            (éxito, mensaje)
        """
        try:
            # Paso 1: Verificar que no esté bloqueado
            lock = await self.lock_service.check_lock()
            if lock and lock.owner_name != owner_name:
                return False, f"Servidor bloqueado por {lock.owner_name}"
            
            # Paso 2: Adquirir lock
            if progress_callback:
                progress_callback("Adquiriendo lock...", SyncProgress())
            
            if not await self.lock_service.acquire_lock(owner_name, selected_ip):
                return False, "No se pudo adquirir el lock del servidor"
            
            # Paso 3: Sincronizar archivos
            server_config = self.config_repo.get_server_config()
            if not server_config:
                await self.lock_service.release_lock()
                return False, "Configuración del servidor no encontrada"
            
            local_path = Path(server_config.server_path)
            # Crear carpeta local si no existe
            local_path.mkdir(parents=True, exist_ok=True)
            
            remote_path = f"cloudflare:{self.config_repo.get_r2_config().bucket_name}/server_files"
            
            # Verificar si hay archivos locales
            server_jar = local_path / server_config.server_jar
            has_local_files = server_jar.exists()
            
            # Verificar si hay archivos remotos (intentar listar)
            has_remote_files = await self.sync_service.check_remote_exists(remote_path)
            
            if has_local_files and not has_remote_files:
                # Primera ejecución: hay archivos locales pero bucket vacío
                # Hacer UPLOAD primero
                if progress_callback:
                    progress_callback("Primera ejecución: Subiendo archivos a R2...", SyncProgress())
                
                def upload_progress_wrapper(progress: SyncProgress):
                    if progress_callback:
                        progress_callback("Subiendo archivos iniciales...", progress)
                
                success = await self.sync_service.sync_upload(
                    local_path,
                    remote_path,
                    upload_progress_wrapper
                )
                
                if not success:
                    await self.lock_service.release_lock()
                    return False, "Error al subir archivos iniciales a R2"
                
            elif has_remote_files:
                # Hay archivos en R2, hacer DOWNLOAD (sync normal)
                if progress_callback:
                    progress_callback("Sincronizando archivos desde R2...", SyncProgress())
                
                def sync_progress_wrapper(progress: SyncProgress):
                    if progress_callback:
                        progress_callback("Descargando archivos...", progress)
                
                success = await self.sync_service.sync_download(
                    remote_path,
                    local_path,
                    sync_progress_wrapper
                )
                
                if not success:
                    await self.lock_service.release_lock()
                    return False, "Error al sincronizar archivos desde R2"
            else:
                # No hay archivos ni local ni remoto
                await self.lock_service.release_lock()
                return False, f"No hay archivos del servidor. Coloca los archivos de Minecraft (incluyendo {server_config.server_jar}) en {local_path} primero."
            
            # Verificar que server.jar exista después de sync
            if not server_jar.exists():
                await self.lock_service.release_lock()
                return False, f"No se encontró {server_config.server_jar} después de sincronizar. Verifica los archivos."
            
            # Paso 4: Verificar si es primera ejecución (no existe server.properties)
            properties_path = local_path / "server.properties"
            is_first_run = not properties_path.exists()
            
            # Log de archivos importantes después de sync
            eula_path = local_path / "eula.txt"
            logger.info(f"Estado después de sync - server.jar: {server_jar.exists()}, server.properties: {properties_path.exists()}, eula.txt: {eula_path.exists()}")
            
            if is_first_run:
                if progress_callback:
                    progress_callback("Primera ejecución: generando archivos del servidor...", SyncProgress())
                
                # Primera ejecución: iniciar servidor para que genere archivos
                logger.info("Primera ejecución detectada, iniciando servidor para generar archivos...")
                
                if not self.server_manager.start_server(server_config):
                    await self.lock_service.release_lock()
                    return False, "Error al iniciar el servidor por primera vez"
                
                # Esperar a que el servidor genere los archivos
                logger.info("Esperando 20 segundos para que el servidor genere archivos...")
                await asyncio.sleep(20)
                
                # Detener el servidor
                if progress_callback:
                    progress_callback("Deteniendo servidor temporal...", SyncProgress())
                
                logger.info("Deteniendo servidor después de generación inicial...")
                stop_result = self.server_manager.stop_server()
                if not stop_result:
                    logger.warning("No se pudo detener el servidor limpiamente, pero continuando...")
                
                # Esperar a que termine completamente
                logger.info("Esperando 3 segundos para asegurar cierre completo...")
                await asyncio.sleep(3)
                
                # Ahora debería existir server.properties
                if not properties_path.exists():
                    await self.lock_service.release_lock()
                    return False, "El servidor no generó server.properties. Revisa los logs."
                
                logger.info("Primera ejecución completada exitosamente, archivos generados")
            
            # Paso 5: Actualizar server.properties con la IP
            if not self.properties_manager.update_server_ip(properties_path, selected_ip):
                await self.lock_service.release_lock()
                return False, "Error al actualizar server.properties"
            
            # Paso 6: Iniciar servidor normalmente
            if progress_callback:
                progress_callback("Iniciando servidor...", SyncProgress())
            
            if not self.server_manager.start_server(server_config):
                await self.lock_service.release_lock()
                return False, "Error al iniciar el servidor"
            
            return True, "Servidor iniciado exitosamente"
            
        except Exception as e:
            await self.lock_service.release_lock()
            return False, f"Error: {str(e)}"


class StopServerUseCase:
    """Caso de uso para detener el servidor"""
    
    def __init__(
        self,
        lock_service: ILockService,
        sync_service: ISyncService,
        server_manager: IServerManager,
        config_repo: IConfigRepository
    ):
        self.lock_service = lock_service
        self.sync_service = sync_service
        self.server_manager = server_manager
        self.config_repo = config_repo
    
    async def execute(
        self,
        progress_callback: Optional[Callable[[str, SyncProgress], None]] = None
    ) -> tuple[bool, str]:
        """
        Ejecuta el proceso de detención del servidor
        Returns:
            (éxito, mensaje)
        """
        try:
            # Paso 1: Detener servidor
            if progress_callback:
                progress_callback("Deteniendo servidor...", SyncProgress())
            
            if not self.server_manager.stop_server():
                return False, "Error al detener el servidor"
            
            # Paso 2: Sincronizar archivos (upload)
            if progress_callback:
                progress_callback("Sincronizando archivos a R2...", SyncProgress())
            
            server_config = self.config_repo.get_server_config()
            if not server_config:
                return False, "Configuración del servidor no encontrada"
            
            local_path = Path(server_config.server_path)
            remote_path = f"cloudflare:{self.config_repo.get_r2_config().bucket_name}/server_files"
            
            def sync_progress_wrapper(progress: SyncProgress):
                if progress_callback:
                    progress_callback("Subiendo archivos...", progress)
            
            success = await self.sync_service.sync_upload(
                local_path,
                remote_path,
                sync_progress_wrapper
            )
            
            if not success:
                return False, "Error al sincronizar archivos a R2"
            
            # Paso 3: Liberar lock
            if progress_callback:
                progress_callback("Liberando lock...", SyncProgress())
            
            if not await self.lock_service.release_lock():
                return False, "Error al liberar el lock"
            
            return True, "Servidor detenido exitosamente"
            
        except Exception as e:
            return False, f"Error: {str(e)}"


class CheckServerStatusUseCase:
    """Caso de uso para verificar el estado del servidor"""
    
    def __init__(self, lock_service: ILockService):
        self.lock_service = lock_service
    
    async def execute(self) -> tuple[bool, Optional[ServerLock]]:
        """
        Verifica el estado del servidor
        Returns:
            (está_disponible, información_del_lock)
        """
        lock = await self.lock_service.check_lock()
        return lock is None, lock


class GetNetworkInterfacesUseCase:
    """Caso de uso para obtener interfaces de red"""
    
    def __init__(self, network_provider: INetworkProvider):
        self.network_provider = network_provider
    
    def execute(self) -> list[NetworkInterface]:
        """Obtiene todas las interfaces de red disponibles"""
        return self.network_provider.get_network_interfaces()
