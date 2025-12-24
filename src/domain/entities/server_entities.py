"""
Entidades del Dominio
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from enum import Enum


class ServerType(Enum):
    """Tipos de servidor Minecraft soportados"""
    VANILLA = "vanilla"
    FABRIC = "fabric"
    FORGE = "forge"
    
    @staticmethod
    def from_string(value: str) -> 'ServerType':
        """Convierte un string a ServerType"""
        value_lower = value.lower()
        if value_lower == "fabric":
            return ServerType.FABRIC
        elif value_lower == "forge":
            return ServerType.FORGE
        return ServerType.VANILLA
    
    def __str__(self) -> str:
        return self.value.capitalize()


@dataclass
class ServerLock:
    """Representa el estado del lock del servidor"""
    owner_name: str
    locked_at: datetime
    ip_address: Optional[str] = None
    
    def is_locked(self) -> bool:
        """Verifica si el servidor está bloqueado"""
        return self.owner_name is not None


@dataclass
class ServerConfig:
    """Configuración del servidor Minecraft"""
    server_path: str
    java_path: str
    server_jar: str
    memory_min: str = "1G"
    memory_max: str = "4G"
    server_port: int = 25565
    server_type: ServerType = ServerType.VANILLA
    
    def get_java_command(self) -> list[str]:
        """Retorna el comando para ejecutar el servidor"""
        return [
            self.java_path,
            f"-Xms{self.memory_min}",
            f"-Xmx{self.memory_max}",
            "-jar",
            self.server_jar,
            "nogui"
        ]
    
    def get_server_type_display(self) -> str:
        """Retorna el nombre del tipo de servidor para mostrar"""
        return str(self.server_type)


@dataclass
class NetworkInterface:
    """Representa una interfaz de red disponible"""
    name: str
    ip_address: str
    description: str
    is_active: bool = True
    
    def __str__(self) -> str:
        return f"{self.name} ({self.ip_address})"


@dataclass
class SyncProgress:
    """Estado del progreso de sincronización"""
    total_files: int = 0
    transferred_files: int = 0
    total_bytes: int = 0
    transferred_bytes: int = 0
    current_file: str = ""
    speed_mbps: float = 0.0
    eta_seconds: int = 0
    
    def get_percentage(self) -> float:
        """Calcula el porcentaje completado"""
        if self.total_bytes == 0:
            return 0.0
        return (self.transferred_bytes / self.total_bytes) * 100
    
    def is_complete(self) -> bool:
        """Verifica si la sincronización está completa"""
        return self.transferred_bytes >= self.total_bytes and self.total_bytes > 0


@dataclass
class R2Config:
    """Configuración de Cloudflare R2"""
    endpoint: str
    access_key: str
    secret_key: str
    bucket_name: str
    region: str = "auto"
    
    def validate(self) -> bool:
        """Valida que todos los campos necesarios estén presentes"""
        return all([
            self.endpoint,
            self.access_key,
            self.secret_key,
            self.bucket_name
        ])
