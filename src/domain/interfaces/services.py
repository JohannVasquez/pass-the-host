"""
Interfaces del Dominio (Puertos)
Contratos que deben implementar las capas externas
"""
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Callable

from src.domain.entities.server_entities import (
    ServerLock,
    ServerConfig,
    NetworkInterface,
    SyncProgress,
    R2Config
)


class ILockService(ABC):
    """Servicio para gestionar el lock del servidor en R2"""
    
    @abstractmethod
    async def check_lock(self) -> Optional[ServerLock]:
        """
        Verifica si existe un lock activo
        Returns:
            ServerLock si existe, None si está disponible
        """
        pass
    
    @abstractmethod
    async def acquire_lock(self, owner_name: str, ip_address: str) -> bool:
        """
        Intenta adquirir el lock del servidor
        Returns:
            True si se adquirió exitosamente, False si falló
        """
        pass
    
    @abstractmethod
    async def release_lock(self) -> bool:
        """
        Libera el lock del servidor
        Returns:
            True si se liberó exitosamente
        """
        pass


class ISyncService(ABC):
    """Servicio para sincronización de archivos con R2 usando Rclone"""
    
    @abstractmethod
    async def sync_download(
        self,
        remote_path: str,
        local_path: Path,
        progress_callback: Optional[Callable[[SyncProgress], None]] = None
    ) -> bool:
        """
        Sincroniza archivos de R2 a local (download)
        Args:
            remote_path: Ruta en R2 (ej. "cloudflare:bucket/server_files")
            local_path: Ruta local de destino
            progress_callback: Función que recibe actualizaciones de progreso
        Returns:
            True si fue exitoso
        """
        pass
    
    @abstractmethod
    async def sync_upload(
        self,
        local_path: Path,
        remote_path: str,
        progress_callback: Optional[Callable[[SyncProgress], None]] = None
    ) -> bool:
        """
        Sincroniza archivos de local a R2 (upload)
        Args:
            local_path: Ruta local de origen
            remote_path: Ruta en R2 de destino
            progress_callback: Función que recibe actualizaciones de progreso
        Returns:
            True si fue exitoso
        """
        pass
    
    @abstractmethod
    def is_rclone_available(self) -> bool:
        """Verifica si el binario de rclone está disponible"""
        pass
    
    @abstractmethod
    async def check_remote_exists(self, remote_path: str) -> bool:
        """
        Verifica si existe contenido en el path remoto
        Args:
            remote_path: Ruta en R2 (ej. "cloudflare:bucket/path")
        Returns:
            True si hay archivos en el path remoto
        """
        pass


class IServerManager(ABC):
    """Servicio para gestionar el proceso del servidor Minecraft"""
    
    @abstractmethod
    def start_server(self, config: ServerConfig) -> bool:
        """
        Inicia el servidor Minecraft
        Returns:
            True si se inició exitosamente
        """
        pass
    
    @abstractmethod
    def stop_server(self) -> bool:
        """
        Detiene el servidor Minecraft de forma limpia
        Returns:
            True si se detuvo exitosamente
        """
        pass
    
    @abstractmethod
    def is_running(self) -> bool:
        """Verifica si el servidor está en ejecución"""
        pass
    
    @abstractmethod
    def send_command(self, command: str) -> bool:
        """
        Envía un comando al servidor
        Args:
            command: Comando a enviar (ej. "stop", "list")
        Returns:
            True si se envió exitosamente
        """
        pass
    
    @abstractmethod
    def get_output_stream(self) -> Optional[Callable[[str], None]]:
        """
        Obtiene un callback para recibir el output del servidor
        Returns:
            Función de callback o None
        """
        pass
    
    @abstractmethod
    def set_output_callback(self, callback: Callable[[str], None]) -> None:
        """Establece un callback para recibir el output del servidor"""
        pass


class INetworkProvider(ABC):
    """Proveedor de información de red"""
    
    @abstractmethod
    def get_network_interfaces(self) -> list[NetworkInterface]:
        """
        Obtiene todas las interfaces de red disponibles
        Returns:
            Lista de interfaces de red
        """
        pass
    
    @abstractmethod
    def get_default_interface(self) -> Optional[NetworkInterface]:
        """
        Obtiene la interfaz de red predeterminada
        Returns:
            Interfaz predeterminada o None
        """
        pass


class IConfigRepository(ABC):
    """Repositorio para gestionar la configuración de la aplicación"""
    
    @abstractmethod
    def load_config(self) -> dict:
        """
        Carga la configuración desde el archivo
        Returns:
            Diccionario con la configuración
        """
        pass
    
    @abstractmethod
    def save_config(self, config: dict) -> bool:
        """
        Guarda la configuración en el archivo
        Args:
            config: Diccionario con la configuración
        Returns:
            True si se guardó exitosamente
        """
        pass
    
    @abstractmethod
    def get_r2_config(self) -> Optional[R2Config]:
        """
        Obtiene la configuración de R2
        Returns:
            Configuración de R2 o None si no existe
        """
        pass
    
    @abstractmethod
    def get_server_config(self) -> Optional[ServerConfig]:
        """
        Obtiene la configuración del servidor
        Returns:
            Configuración del servidor o None si no existe
        """
        pass


class IServerPropertiesManager(ABC):
    """Gestor para modificar el archivo server.properties"""
    
    @abstractmethod
    def update_server_ip(self, properties_path: Path, ip_address: str) -> bool:
        """
        Actualiza la IP del servidor en server.properties
        Args:
            properties_path: Ruta al archivo server.properties
            ip_address: Nueva IP a configurar
        Returns:
            True si se actualizó exitosamente
        """
        pass
    
    @abstractmethod
    def read_property(self, properties_path: Path, key: str) -> Optional[str]:
        """
        Lee una propiedad del archivo
        Args:
            properties_path: Ruta al archivo
            key: Clave a leer
        Returns:
            Valor de la propiedad o None
        """
        pass
