"""
Repositorio de configuración
Gestiona la carga y guardado de config.json
"""
import json
import logging
from pathlib import Path
from typing import Optional

from src.domain.interfaces.services import IConfigRepository
from src.domain.entities.server_entities import R2Config, ServerConfig

logger = logging.getLogger(__name__)


class JsonConfigRepository(IConfigRepository):
    """Repositorio de configuración usando archivo JSON"""
    
    def __init__(self, config_file_path: str = "./config.json"):
        """
        Args:
            config_file_path: Ruta al archivo de configuración
        """
        self.config_path = Path(config_file_path)
        self._config_cache: Optional[dict] = None
    
    def load_config(self) -> dict:
        """Carga la configuración desde el archivo"""
        try:
            if not self.config_path.exists():
                logger.warning(f"Archivo de configuración no encontrado: {self.config_path}")
                return self._get_default_config()
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self._config_cache = json.load(f)
            
            logger.info("Configuración cargada exitosamente")
            return self._config_cache
            
        except Exception as e:
            logger.error(f"Error al cargar configuración: {e}")
            return self._get_default_config()
    
    def save_config(self, config: dict) -> bool:
        """Guarda la configuración en el archivo"""
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            self._config_cache = config
            logger.info("Configuración guardada exitosamente")
            return True
            
        except Exception as e:
            logger.error(f"Error al guardar configuración: {e}")
            return False
    
    def get_r2_config(self) -> Optional[R2Config]:
        """Obtiene la configuración de R2"""
        if self._config_cache is None:
            self.load_config()
        
        try:
            # Si no hay config cache o está vacío, retornar None
            if not self._config_cache:
                return None
            
            r2_data = self._config_cache.get('r2', {})
            
            if not r2_data:
                return None
            
            config = R2Config(
                endpoint=r2_data.get('endpoint', ''),
                access_key=r2_data.get('access_key', ''),
                secret_key=r2_data.get('secret_key', ''),
                bucket_name=r2_data.get('bucket_name', ''),
                region=r2_data.get('region', 'auto')
            )
            
            if config.validate():
                return config
            
            return None
            
        except Exception as e:
            logger.error(f"Error al obtener configuración de R2: {e}")
            return None
    
    def get_server_config(self) -> Optional[ServerConfig]:
        """Obtiene la configuración del servidor"""
        if self._config_cache is None:
            self.load_config()
        
        try:
            server_data = self._config_cache.get('server', {})
            
            if not server_data:
                return None
            
            return ServerConfig(
                server_path=server_data.get('server_path', './server'),
                java_path=server_data.get('java_path', './java_runtime/bin/java.exe'),
                server_jar=server_data.get('server_jar', 'server.jar'),
                memory_min=server_data.get('memory_min', '1G'),
                memory_max=server_data.get('memory_max', '4G'),
                server_port=server_data.get('server_port', 25565)
            )
            
        except Exception as e:
            logger.error(f"Error al obtener configuración del servidor: {e}")
            return None
    
    def _get_default_config(self) -> dict:
        """Retorna configuración por defecto"""
        return {
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
