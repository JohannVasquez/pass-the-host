"""
Gestor de server.properties
"""
import logging
from pathlib import Path
from typing import Optional

from src.domain.interfaces.services import IServerPropertiesManager

logger = logging.getLogger(__name__)


class ServerPropertiesManager(IServerPropertiesManager):
    """Gestor para modificar el archivo server.properties"""
    
    def update_server_ip(self, properties_path: Path, ip_address: str) -> bool:
        """Actualiza la IP del servidor en server.properties"""
        try:
            if not properties_path.exists():
                logger.info(f"Archivo server.properties no encontrado: {properties_path}")
                logger.info("Esto es NORMAL en la primera ejecución - el servidor lo creará automáticamente")
                logger.info("El servidor Minecraft generará server.properties con valores por defecto")
                # No es un error, el servidor creará el archivo en la primera ejecución
                return True
            
            # Leer archivo
            with open(properties_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Actualizar la línea server-ip
            updated = False
            for i, line in enumerate(lines):
                if line.strip().startswith('server-ip='):
                    lines[i] = f'server-ip={ip_address}\n'
                    updated = True
                    break
            
            # Si no existe, agregar
            if not updated:
                lines.append(f'server-ip={ip_address}\n')
            
            # Escribir archivo
            with open(properties_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            
            logger.info(f"Server IP actualizada a {ip_address}")
            return True
            
        except Exception as e:
            logger.error(f"Error al actualizar server.properties: {e}")
            return False
    
    def read_property(self, properties_path: Path, key: str) -> Optional[str]:
        """Lee una propiedad del archivo"""
        try:
            if not properties_path.exists():
                return None
            
            with open(properties_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith(f'{key}='):
                        return line.split('=', 1)[1]
            
            return None
            
        except Exception as e:
            logger.error(f"Error al leer propiedad: {e}")
            return None
