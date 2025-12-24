"""
Implementación del servicio Rclone
Wrapper para el binario portable de Rclone
"""
import asyncio
import subprocess
import re
import json
import os
from pathlib import Path
from typing import Optional, Callable
import logging

from src.domain.interfaces.services import ISyncService
from src.domain.entities.server_entities import SyncProgress

logger = logging.getLogger(__name__)


class RcloneService(ISyncService):
    """Implementación del servicio de sincronización usando Rclone"""
    
    def __init__(self, rclone_binary_path: str = "./rclone/rclone.exe", r2_config=None):
        """
        Args:
            rclone_binary_path: Ruta al binario de rclone.exe
            r2_config: Configuración de R2 para pasar credenciales
        """
        self.rclone_path = Path(rclone_binary_path)
        self.r2_config = r2_config
        self._process: Optional[subprocess.Popen] = None
        self.config_file = Path("rclone.conf")
        
        # Crear archivo de configuración si tenemos credenciales
        if self.r2_config:
            self._create_config_file()
    
    def _create_config_file(self):
        """Crea el archivo rclone.conf con las credenciales de R2"""
        try:
            config_content = f"""[cloudflare]
type = s3
provider = Cloudflare
access_key_id = {self.r2_config.access_key}
secret_access_key = {self.r2_config.secret_key}
endpoint = {self.r2_config.endpoint}
acl = private
"""
            with open(self.config_file, 'w') as f:
                f.write(config_content)
            
            logger.info(f"Archivo de configuración rclone.conf creado")
        except Exception as e:
            logger.error(f"Error al crear rclone.conf: {e}")
        
    def is_rclone_available(self) -> bool:
        """Verifica si el binario de rclone está disponible"""
        return self.rclone_path.exists() and self.rclone_path.is_file()
    
    async def check_remote_exists(self, remote_path: str) -> bool:
        """
        Verifica si existe contenido en el path remoto
        Usa 'rclone lsf' para listar archivos
        """
        try:
            command = [
                str(self.rclone_path),
                "lsf",
                remote_path,
                "--config", str(self.config_file),
                "--max-depth", "1"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            
            stdout, stderr = await process.communicate()
            
            # Si el comando fue exitoso y hay output, hay archivos
            if process.returncode == 0 and stdout:
                output = stdout.decode('utf-8', errors='ignore').strip()
                has_files = len(output) > 0
                logger.info(f"Check remote: {'Archivos encontrados' if has_files else 'Vacío'} en {remote_path}")
                return has_files
            
            # Si falló, asumir que está vacío o no existe
            logger.info(f"Remote path {remote_path} no existe o está vacío")
            return False
            
        except Exception as e:
            logger.error(f"Error al verificar remote: {e}")
            return False
    
    async def sync_download(
        self,
        remote_path: str,
        local_path: Path,
        progress_callback: Optional[Callable[[SyncProgress], None]] = None
    ) -> bool:
        """
        Sincroniza archivos de R2 a local (download)
        """
        return await self._sync(
            source=remote_path,
            destination=str(local_path),
            progress_callback=progress_callback,
            is_upload=False  # No excluir nada en downloads
        )
    
    async def sync_upload(
        self,
        local_path: Path,
        remote_path: str,
        progress_callback: Optional[Callable[[SyncProgress], None]] = None
    ) -> bool:
        """
        Sincroniza archivos de local a R2 (upload)
        """
        return await self._sync(
            source=str(local_path),
            destination=remote_path,
            progress_callback=progress_callback,
            is_upload=True  # Excluir archivos bloqueados en uploads
        )
    
    async def _sync(
        self,
        source: str,
        destination: str,
        progress_callback: Optional[Callable[[SyncProgress], None]] = None,
        is_upload: bool = False
    ) -> bool:
        """
        Ejecuta el comando de sincronización
        Args:
            source: Origen (puede ser local o remoto)
            destination: Destino (puede ser local o remoto)
            progress_callback: Callback para reportar progreso
            is_upload: Si True, es una subida (excluir archivos en uso). Si False, es descarga
        """
        if not self.is_rclone_available():
            logger.error(f"Rclone binary no encontrado en {self.rclone_path}")
            return False
        
        try:
            # Comando rclone con flags de progreso y config file
            command = [
                str(self.rclone_path),
                "sync",
                source,
                destination,
                "--config", str(self.config_file),  # Usar archivo de configuración
                "--progress",
                "--stats", "1s",  # Actualizar estadísticas cada segundo
                "--stats-one-line",  # Formato de una línea
                "--transfers", "4",  # 4 transferencias paralelas
                "--ignore-errors",  # Continuar si algunos archivos fallan
                "--max-backlog", "100000",  # Aumentar backlog para archivos bloqueados
                "-v"  # Verbose
            ]
            
            # Si es upload, excluir archivos que pueden estar bloqueados
            if is_upload:
                command.extend([
                    "--exclude", "logs/**",  # Excluir logs (siempre están en uso)
                    "--exclude", "*.log",
                    "--exclude", "*.log.gz",
                    "--exclude", "*.lck",  # Archivos de lock
                    "--exclude", "session.lock"
                ])
            
            logger.info(f"Ejecutando: {' '.join(command)}")
            
            # Ejecutar proceso de forma asíncrona
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            
            self._process = process
            
            # Leer output en tiempo real y guardar stderr para diagnóstico
            stderr_lines = []
            while True:
                line = await process.stderr.readline()
                if not line:
                    break
                
                line_str = line.decode('utf-8', errors='ignore').strip()
                stderr_lines.append(line_str)
                
                # Parsear progreso
                if progress_callback:
                    progress = self._parse_progress(line_str)
                    if progress:
                        progress_callback(progress)
                
                logger.debug(f"Rclone: {line_str}")
            
            # Esperar a que termine
            await process.wait()
            
            success = process.returncode == 0
            
            if success:
                logger.info("Sincronización completada exitosamente")
            else:
                # Analizar el error
                stderr_output = '\n'.join(stderr_lines)
                logger.error(f"Sincronización falló con código {process.returncode}")
                
                # Mostrar las últimas líneas de error (más relevantes)
                if stderr_lines:
                    relevant_errors = [line for line in stderr_lines if 'error' in line.lower() or 'failed' in line.lower()]
                    if relevant_errors:
                        logger.error(f"Errores detectados: {' | '.join(relevant_errors[-3:])}")
                    else:
                        logger.error(f"Últimas líneas: {' | '.join(stderr_lines[-3:])}")
                
                # Si es un error de "directory not found" en download, es tolerable en primera ejecución
                if 'directory not found' in stderr_output.lower() and 'cloudflare:' in source:
                    logger.warning("El directorio remoto no existe aún. Esto es normal en la primera ejecución.")
                    logger.info("Creando estructura local vacía...")
                    # En este caso, considerarlo como éxito para primera vez
                    success = True
            
            return success
            
        except Exception as e:
            logger.error(f"Error al ejecutar rclone: {e}")
            return False
        finally:
            self._process = None
    
    def _parse_progress(self, line: str) -> Optional[SyncProgress]:
        """
        Parsea el output de rclone para extraer información de progreso
        
        Formato esperado:
        Transferred:   	    10.5M / 100M, 10%, 2.1M/s, ETA 42s
        Transferred:            1 / 10, 10%
        
        Args:
            line: Línea de output de rclone
        Returns:
            SyncProgress o None si no se puede parsear
        """
        try:
            # Patrón para capturar progreso de bytes
            # Ejemplo: "Transferred:   	    10.5M / 100M, 10%, 2.1M/s, ETA 42s"
            bytes_pattern = r'Transferred:\s+(.+?)\s+/\s+(.+?),\s+(\d+)%(?:,\s+(.+?)/s)?(?:,\s+ETA\s+(\d+)s)?'
            bytes_match = re.search(bytes_pattern, line)
            
            if bytes_match:
                transferred_str = bytes_match.group(1).strip()
                total_str = bytes_match.group(2).strip()
                percentage = int(bytes_match.group(3))
                speed_str = bytes_match.group(4)
                eta_str = bytes_match.group(5)
                
                # Convertir a bytes
                transferred_bytes = self._parse_size(transferred_str)
                total_bytes = self._parse_size(total_str)
                
                # Parsear velocidad
                speed_mbps = 0.0
                if speed_str:
                    speed_bytes = self._parse_size(speed_str)
                    speed_mbps = speed_bytes / (1024 * 1024)  # Convertir a MB/s
                
                # ETA
                eta_seconds = int(eta_str) if eta_str else 0
                
                return SyncProgress(
                    total_bytes=total_bytes,
                    transferred_bytes=transferred_bytes,
                    speed_mbps=speed_mbps,
                    eta_seconds=eta_seconds
                )
            
            # Patrón para archivos transferidos
            # Ejemplo: "Transferred:            1 / 10, 10%"
            files_pattern = r'Transferred:\s+(\d+)\s+/\s+(\d+)'
            files_match = re.search(files_pattern, line)
            
            if files_match:
                transferred_files = int(files_match.group(1))
                total_files = int(files_match.group(2))
                
                return SyncProgress(
                    total_files=total_files,
                    transferred_files=transferred_files
                )
            
            # Archivo actual siendo transferido
            # Ejemplo: " *                           filename.dat: 50% /10.5M, 2.1M/s, 5s"
            current_file_pattern = r'\*\s+(.+?):\s+(\d+)%'
            current_match = re.search(current_file_pattern, line)
            
            if current_match:
                current_file = current_match.group(1).strip()
                return SyncProgress(current_file=current_file)
            
        except Exception as e:
            logger.debug(f"Error parseando progreso: {e}")
        
        return None
    
    def _parse_size(self, size_str: str) -> int:
        """
        Convierte string de tamaño a bytes
        Ejemplos: "10.5M", "1.2G", "500k", "100"
        """
        size_str = size_str.strip().upper()
        
        # Patrones de unidades
        units = {
            'K': 1024,
            'M': 1024 ** 2,
            'G': 1024 ** 3,
            'T': 1024 ** 4,
        }
        
        # Extraer número y unidad
        match = re.match(r'([\d.]+)([KMGT])?', size_str)
        if not match:
            return 0
        
        number = float(match.group(1))
        unit = match.group(2)
        
        if unit and unit in units:
            return int(number * units[unit])
        
        return int(number)
    
    def cancel_sync(self):
        """Cancela la sincronización actual"""
        if self._process:
            try:
                self._process.terminate()
                logger.info("Sincronización cancelada")
            except Exception as e:
                logger.error(f"Error al cancelar sincronización: {e}")
