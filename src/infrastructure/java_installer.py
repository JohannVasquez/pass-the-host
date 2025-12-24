"""
Instalador automático de Java JRE
Detecta la versión necesaria y descarga Java si no está disponible
"""
import logging
import zipfile
import shutil
import requests
import re
import subprocess
from pathlib import Path
from typing import Tuple, Optional, Callable

logger = logging.getLogger(__name__)


class JavaInstaller:
    """Maneja la detección y descarga automática de Java JRE"""
    
    def __init__(self, java_runtime_dir: Path = None):
        """
        Args:
            java_runtime_dir: Directorio donde instalar Java (default: ./java_runtime)
        """
        self.java_runtime_dir = java_runtime_dir or Path('./java_runtime')
        self.java_exe = self.java_runtime_dir / 'bin' / 'java.exe'
    
    def is_installed(self) -> bool:
        """Verifica si Java está instalado"""
        return self.java_exe.exists()
    
    def get_installed_version(self) -> Optional[int]:
        """
        Obtiene la versión de Java instalada
        Returns: Versión mayor (ej: 21) o None si no está instalado
        """
        if not self.is_installed():
            return None
        
        try:
            result = subprocess.run(
                [str(self.java_exe), '-version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # Java imprime la versión en stderr
            version_output = result.stderr
            
            # Buscar versión (formato: "openjdk version "21.0.1" o "1.8.0_xxx")
            match = re.search(r'version "(\d+)\.(\d+)', version_output)
            if match:
                major = int(match.group(1))
                # Si es 1.x (Java 8), el major real es el segundo número
                if major == 1:
                    return int(match.group(2))
                return major
            
            return None
            
        except Exception as e:
            logger.error(f"Error al obtener versión de Java: {e}")
            return None
    
    def detect_required_version_from_server(self, server_path: Path) -> int:
        """
        Detecta la versión de Java requerida analizando archivos del servidor
        
        Args:
            server_path: Ruta al directorio del servidor
        
        Returns: Versión de Java requerida (17, 21, etc.)
        """
        # Buscar version.json de Minecraft (Vanilla/Fabric)
        version_json = server_path / "version.json"
        if version_json.exists():
            try:
                import json
                with open(version_json, 'r') as f:
                    data = json.load(f)
                
                # Buscar javaVersion
                java_version = data.get('javaVersion', {}).get('majorVersion')
                if java_version:
                    logger.info(f"Versión de Java detectada desde version.json: {java_version}")
                    return int(java_version)
            except Exception as e:
                logger.warning(f"Error al leer version.json: {e}")
        
        # Buscar run.bat de Forge
        run_bat = server_path / "run.bat"
        if run_bat.exists():
            try:
                content = run_bat.read_text(encoding='utf-8', errors='ignore')
                
                # Forge 1.20.1+ requiere Java 17+
                if 'forge-1.20' in content or 'forge-1.21' in content:
                    logger.info("Servidor Forge 1.20+ detectado, requiere Java 17+")
                    return 17
                elif 'forge-1.19' in content:
                    return 17
                elif 'forge-1.18' in content:
                    return 17
                else:
                    return 17  # Por defecto para Forge moderno
                    
            except Exception as e:
                logger.warning(f"Error al leer run.bat: {e}")
        
        # Buscar fabric-server-launch.jar (Fabric)
        fabric_jar = server_path / "fabric-server-launch.jar"
        if fabric_jar.exists():
            logger.info("Servidor Fabric detectado, requiere Java 17+")
            return 17
        
        # Default: Java 21 para Minecraft 1.21+
        logger.info("No se pudo detectar versión específica, usando Java 21 por defecto")
        return 21
    
    def download_and_install(
        self, 
        version: int,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Tuple[bool, str]:
        """
        Descarga e instala Java JRE
        
        Args:
            version: Versión de Java a instalar (17, 21, etc.)
            progress_callback: Función opcional (progreso_porcentaje, mensaje)
        
        Returns: (éxito, mensaje)
        """
        def report_progress(percentage: int, message: str):
            if progress_callback:
                progress_callback(percentage, message)
            logger.info(f"{message} ({percentage}%)")
        
        try:
            report_progress(0, f"Iniciando descarga de Java {version} JRE...")
            
            # Detectar OS y arquitectura
            import platform
            os_type = 'windows'  # Solo Windows por ahora
            arch = 'x64' if platform.machine().endswith('64') else 'x86'
            
            # URL de Adoptium (Eclipse Temurin)
            api_url = f"https://api.adoptium.net/v3/binary/latest/{version}/ga/{os_type}/{arch}/jre/hotspot/normal/eclipse"
            
            report_progress(5, "Conectando con servidor de descarga...")
            
            # Descargar ZIP
            response = requests.get(api_url, stream=True, timeout=120, allow_redirects=True)
            
            if response.status_code != 200:
                return False, f"No se pudo descargar Java {version} (HTTP {response.status_code})"
            
            # Guardar temporalmente
            zip_path = Path(f"./java_{version}_jre.zip")
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            report_progress(10, f"Descargando Java {version} JRE...")
            
            with open(zip_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            # Progreso de 10% a 70%
                            progress = 10 + int((downloaded / total_size) * 60)
                            report_progress(progress, f"Descargando: {downloaded // (1024*1024)} MB / {total_size // (1024*1024)} MB")
            
            report_progress(70, "Descarga completada, extrayendo archivos...")
            
            # Extraer ZIP
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Extraer todo a temporal
                temp_extract = Path('./temp_java_extract')
                temp_extract.mkdir(exist_ok=True)
                
                report_progress(75, "Extrayendo archivos...")
                zip_ref.extractall(temp_extract)
                
                # Buscar la carpeta jdk/jre dentro del ZIP
                jre_folders = list(temp_extract.glob('*jre*'))
                if not jre_folders:
                    jre_folders = list(temp_extract.glob('jdk*'))
                
                if not jre_folders:
                    raise Exception("No se encontró carpeta JRE en el archivo descargado")
                
                source_folder = jre_folders[0]
                
                # Si ya existe java_runtime, hacer backup
                if self.java_runtime_dir.exists():
                    backup_dir = Path('./java_runtime.backup')
                    if backup_dir.exists():
                        shutil.rmtree(backup_dir)
                    shutil.move(str(self.java_runtime_dir), str(backup_dir))
                    report_progress(80, "Backup de Java anterior creado")
                
                # Mover a java_runtime
                report_progress(85, "Instalando Java...")
                shutil.move(str(source_folder), str(self.java_runtime_dir))
                
                # Limpiar temporal
                shutil.rmtree(temp_extract)
            
            report_progress(95, "Limpiando archivos temporales...")
            
            # Eliminar ZIP
            zip_path.unlink()
            
            report_progress(100, f"Java {version} JRE instalado correctamente")
            logger.info(f"Java {version} instalado en {self.java_runtime_dir}")
            return True, f"Java {version} instalado correctamente"
            
        except requests.RequestException as e:
            error_msg = f"Error al descargar Java: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except zipfile.BadZipFile as e:
            error_msg = f"Archivo ZIP corrupto: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
            
        except Exception as e:
            error_msg = f"Error al instalar Java: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    def ensure_compatible_version(
        self, 
        server_path: Path,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> Tuple[bool, str]:
        """
        Verifica que Java esté instalado con la versión correcta para el servidor
        Si no está o la versión es incorrecta, la descarga
        
        Args:
            server_path: Ruta al servidor de Minecraft
            progress_callback: Función opcional para reportar progreso
        
        Returns: (éxito, mensaje)
        """
        # Detectar versión requerida
        required_version = self.detect_required_version_from_server(server_path)
        logger.info(f"Versión de Java requerida: {required_version}")
        
        # Verificar versión instalada
        installed_version = self.get_installed_version()
        
        if installed_version:
            logger.info(f"Versión de Java instalada: {installed_version}")
            
            # Verificar si es compatible
            if installed_version >= required_version:
                logger.info("Versión de Java compatible")
                return True, f"Java {installed_version} ya está instalado"
            else:
                logger.warning(f"Java {installed_version} es incompatible, se requiere {required_version}+")
        
        # Instalar versión requerida
        logger.info(f"Instalando Java {required_version}...")
        return self.download_and_install(required_version, progress_callback)
