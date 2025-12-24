"""
Instalador automático de Rclone
Descarga e instala rclone.exe si no está disponible
"""
import logging
import zipfile
import shutil
import requests
from pathlib import Path
from typing import Tuple, Optional, Callable

logger = logging.getLogger(__name__)


class RcloneInstaller:
    """Maneja la descarga e instalación automática de Rclone"""
    
    # URL de descarga de rclone para Windows (AMD64)
    RCLONE_DOWNLOAD_URL = "https://downloads.rclone.org/rclone-current-windows-amd64.zip"
    
    def __init__(self, install_dir: Path = None):
        """
        Args:
            install_dir: Directorio donde instalar rclone (default: ./rclone)
        """
        self.install_dir = install_dir or Path('./rclone')
        self.rclone_exe = self.install_dir / 'rclone.exe'
    
    def is_installed(self) -> bool:
        """Verifica si rclone.exe ya está instalado"""
        return self.rclone_exe.exists()
    
    def install(self, progress_callback: Optional[Callable[[int, str], None]] = None) -> Tuple[bool, str]:
        """
        Descarga e instala rclone automáticamente
        
        Args:
            progress_callback: Función opcional (progreso_porcentaje, mensaje) para reportar progreso
        
        Returns: (éxito, mensaje)
        """
        def report_progress(percentage: int, message: str):
            if progress_callback:
                progress_callback(percentage, message)
            logger.info(f"{message} ({percentage}%)")
        
        try:
            report_progress(0, "Iniciando descarga de Rclone...")
            
            # Crear directorio si no existe
            self.install_dir.mkdir(parents=True, exist_ok=True)
            
            # Descargar archivo ZIP
            zip_path = self.install_dir / 'rclone-windows-amd64.zip'
            
            report_progress(5, f"Conectando con {self.RCLONE_DOWNLOAD_URL}")
            response = requests.get(self.RCLONE_DOWNLOAD_URL, stream=True, timeout=60)
            response.raise_for_status()
            
            # Guardar archivo con barra de progreso
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            report_progress(10, "Descargando Rclone...")
            
            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            # Progreso de 10% a 80%
                            progress = 10 + int((downloaded / total_size) * 70)
                            report_progress(progress, f"Descargando: {downloaded // 1024} KB / {total_size // 1024} KB")
            
            report_progress(80, "Descarga completada, extrayendo archivos...")
            
            # Extraer ZIP
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Buscar rclone.exe dentro del ZIP
                rclone_files = [f for f in zip_ref.namelist() if f.endswith('rclone.exe')]
                
                if not rclone_files:
                    raise Exception("No se encontró rclone.exe en el archivo descargado")
                
                # Extraer rclone.exe
                rclone_in_zip = rclone_files[0]
                report_progress(85, f"Extrayendo {rclone_in_zip}...")
                
                # Extraer a temporal
                zip_ref.extract(rclone_in_zip, self.install_dir)
                
                # Mover al directorio raíz
                extracted_path = self.install_dir / rclone_in_zip
                shutil.move(str(extracted_path), str(self.rclone_exe))
                
                # Limpiar directorio temporal
                parent_dir = extracted_path.parent
                if parent_dir != self.install_dir and parent_dir.exists():
                    shutil.rmtree(parent_dir)
            
            report_progress(95, "Limpiando archivos temporales...")
            
            # Eliminar ZIP
            zip_path.unlink()
            
            report_progress(100, "Rclone instalado correctamente")
            logger.info(f"Rclone instalado en {self.rclone_exe}")
            return True, "Rclone instalado correctamente"
            
        except requests.RequestException as e:
            error_msg = f"Error al descargar Rclone: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except zipfile.BadZipFile as e:
            error_msg = f"Archivo ZIP corrupto: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except Exception as e:
            error_msg = f"Error al instalar Rclone: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def ensure_installed(self, progress_callback: Optional[Callable[[int, str], None]] = None) -> Tuple[bool, str]:
        """
        Verifica si rclone está instalado y lo descarga si no lo está
        
        Args:
            progress_callback: Función opcional (progreso_porcentaje, mensaje) para reportar progreso
        
        Returns: (éxito, mensaje)
        """
        if self.is_installed():
            logger.info("Rclone ya está instalado")
            if progress_callback:
                progress_callback(100, "Rclone ya está instalado")
            return True, "Rclone disponible"
        
        logger.info("Rclone no encontrado, iniciando instalación...")
        if progress_callback:
            progress_callback(0, "Rclone no encontrado, iniciando instalación...")
        return self.install(progress_callback)
