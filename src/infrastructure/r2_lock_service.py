"""
Implementación del Lock Service usando R2
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional
import boto3
from botocore.exceptions import ClientError

from src.domain.interfaces.services import ILockService
from src.domain.entities.server_entities import ServerLock, R2Config

logger = logging.getLogger(__name__)


class R2LockService(ILockService):
    """Implementación del servicio de lock usando Cloudflare R2"""
    
    LOCK_FILE_NAME = "server.lock"
    
    def __init__(self, r2_config: R2Config):
        """
        Args:
            r2_config: Configuración de Cloudflare R2
        """
        self.config = r2_config
        self._s3_client = None
    
    def _get_client(self):
        """Obtiene el cliente S3 (lazy initialization)"""
        if self._s3_client is None:
            self._s3_client = boto3.client(
                's3',
                endpoint_url=self.config.endpoint,
                aws_access_key_id=self.config.access_key,
                aws_secret_access_key=self.config.secret_key,
                region_name=self.config.region
            )
        return self._s3_client
    
    async def check_lock(self) -> Optional[ServerLock]:
        """Verifica si existe un lock activo"""
        try:
            loop = asyncio.get_event_loop()
            client = self._get_client()
            
            # Intentar descargar el archivo lock
            response = await loop.run_in_executor(
                None,
                lambda: client.get_object(
                    Bucket=self.config.bucket_name,
                    Key=self.LOCK_FILE_NAME
                )
            )
            
            # Parsear contenido
            content = response['Body'].read().decode('utf-8')
            data = json.loads(content)
            
            return ServerLock(
                owner_name=data.get('owner_name', 'Unknown'),
                locked_at=datetime.fromisoformat(data.get('locked_at')),
                ip_address=data.get('ip_address')
            )
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'NoSuchKey' or error_code == '404':
                # El archivo no existe, el servidor está disponible
                return None
            logger.error(f"Error al verificar lock: {e}")
            return None
        except Exception as e:
            logger.error(f"Error inesperado al verificar lock: {e}")
            return None
    
    async def acquire_lock(self, owner_name: str, ip_address: str) -> bool:
        """Intenta adquirir el lock del servidor"""
        try:
            # Primero verificar que no esté bloqueado
            existing_lock = await self.check_lock()
            if existing_lock and existing_lock.owner_name != owner_name:
                logger.warning(f"Servidor ya bloqueado por {existing_lock.owner_name}")
                return False
            
            # Crear datos del lock
            lock_data = {
                'owner_name': owner_name,
                'locked_at': datetime.now().isoformat(),
                'ip_address': ip_address
            }
            
            loop = asyncio.get_event_loop()
            client = self._get_client()
            
            # Subir archivo lock
            await loop.run_in_executor(
                None,
                lambda: client.put_object(
                    Bucket=self.config.bucket_name,
                    Key=self.LOCK_FILE_NAME,
                    Body=json.dumps(lock_data, indent=2).encode('utf-8'),
                    ContentType='application/json'
                )
            )
            
            logger.info(f"Lock adquirido por {owner_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error al adquirir lock: {e}")
            return False
    
    async def release_lock(self) -> bool:
        """Libera el lock del servidor"""
        try:
            # Primero verificar si existe el lock
            existing_lock = await self.check_lock()
            if not existing_lock:
                logger.warning("No hay lock para liberar")
                return False
            
            loop = asyncio.get_event_loop()
            client = self._get_client()
            
            # Eliminar archivo lock
            await loop.run_in_executor(
                None,
                lambda: client.delete_object(
                    Bucket=self.config.bucket_name,
                    Key=self.LOCK_FILE_NAME
                )
            )
            
            logger.info("Lock liberado")
            return True
            
        except Exception as e:
            logger.error(f"Error al liberar lock: {e}")
            return False
