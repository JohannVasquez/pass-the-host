"""
Implementación del Server Manager
Gestiona el proceso del servidor Minecraft
"""
import subprocess
import threading
import logging
import psutil
from pathlib import Path
from typing import Optional, Callable
import time

from src.domain.interfaces.services import IServerManager
from src.domain.entities.server_entities import ServerConfig

logger = logging.getLogger(__name__)


class MinecraftServerManager(IServerManager):
    """Gestor del proceso del servidor Minecraft"""
    
    def __init__(self):
        self._process: Optional[subprocess.Popen] = None
        self._output_callback: Optional[Callable[[str], None]] = None
        self._output_thread: Optional[threading.Thread] = None
        self._running = False
    
    def start_server(self, config: ServerConfig) -> bool:
        """Inicia el servidor Minecraft"""
        if self.is_running():
            logger.warning("El servidor ya está en ejecución")
            return False
        
        # Verificar y limpiar procesos huérfanos
        self._kill_orphaned_servers(config.server_path)
        
        try:
            # Cambiar al directorio del servidor
            server_path = Path(config.server_path).resolve()  # Ruta absoluta
            if not server_path.exists():
                logger.error(f"Ruta del servidor no existe: {server_path}")
                return False
            
            # Resolver path de Java a absoluto
            java_path = Path(config.java_path)
            if not java_path.is_absolute():
                java_path = java_path.resolve()
            
            if not java_path.exists():
                logger.error(f"Java no encontrado en: {java_path}")
                return False
            
            # Verificar si server_jar es un batch file (para Forge moderno)
            server_file = server_path / config.server_jar
            is_batch_file = config.server_jar.endswith('.bat') or config.server_jar.endswith('.sh')
            
            if is_batch_file:
                # Ejecutar run.bat directamente (Forge moderno)
                if not server_file.exists():
                    logger.error(f"Archivo de ejecución no encontrado: {server_file}")
                    return False
                
                logger.info(f"Ejecutando Forge mediante script: {config.server_jar}")
                
                # Actualizar user_jvm_args.txt con la memoria configurada
                self._update_forge_jvm_args(server_path, config.memory_min, config.memory_max)
                
                # En Windows, ejecutar .bat con cmd.exe
                # En Unix, dar permisos de ejecución y ejecutar directamente
                if config.server_jar.endswith('.bat'):
                    command = ["cmd.exe", "/c", config.server_jar, "nogui"]
                else:
                    # Unix: dar permisos y ejecutar
                    import os
                    os.chmod(server_file, 0o755)
                    command = [f"./{config.server_jar}", "nogui"]
            else:
                # Verificar que el JAR existe
                if not server_file.exists():
                    logger.error(f"Server JAR no encontrado: {server_file}")
                    return False
                
                # Preparar comando con path absoluto de Java
                command = [
                    str(java_path),
                    f"-Xms{config.memory_min}",
                    f"-Xmx{config.memory_max}",
                    "-jar",
                    config.server_jar,  # Este es relativo al cwd
                    "nogui"
                ]
            
            logger.info(f"Iniciando servidor con comando: {' '.join(command)}")
            logger.info(f"Working directory: {server_path}")
            
            # Iniciar proceso
            self._process = subprocess.Popen(
                command,
                cwd=str(server_path),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            
            # Verificar que el proceso realmente inició
            time.sleep(0.5)
            if self._process.poll() is not None:
                # El proceso terminó inmediatamente, probablemente error
                logger.error(f"El servidor terminó inmediatamente con código {self._process.returncode}")
                return False
            
            self._running = True
            
            # Iniciar thread para leer output
            self._output_thread = threading.Thread(
                target=self._read_output,
                daemon=True
            )
            self._output_thread.start()
            
            logger.info("Servidor iniciado exitosamente")
            return True
            
        except Exception as e:
            logger.error(f"Error al iniciar servidor: {e}")
            return False
    
    def stop_server(self) -> bool:
        """Detiene el servidor de forma limpia"""
        if not self.is_running():
            logger.warning("El servidor no está en ejecución")
            return False
        
        try:
            # Intentar enviar comando stop
            command_sent = self.send_command("stop")
            
            if command_sent:
                # Esperar a que termine (máximo 30 segundos)
                logger.info("Esperando a que el servidor se detenga...")
                self._process.wait(timeout=30)
            else:
                # Si no se pudo enviar el comando, forzar cierre
                logger.warning("No se pudo enviar comando stop, terminando proceso...")
                self._process.terminate()
                time.sleep(2)
                if self._process.poll() is None:
                    logger.warning("Proceso no respondió a terminate, usando kill...")
                    self._process.kill()
                    self._process.wait(timeout=5)
            
            self._running = False
            self._process = None
            
            logger.info("Servidor detenido exitosamente")
            return True
            
        except subprocess.TimeoutExpired:
            logger.warning("Timeout al detener servidor, forzando cierre...")
            if self._process:
                self._process.terminate()
                time.sleep(2)
                if self._process.poll() is None:
                    self._process.kill()
            self._running = False
            self._process = None
            return True
        except Exception as e:
            logger.error(f"Error al detener servidor: {e}")
            # Intentar cleanup de todas formas
            if self._process:
                try:
                    self._process.kill()
                except:
                    pass
            self._running = False
            self._process = None
            return False
    
    def is_running(self) -> bool:
        """Verifica si el servidor está en ejecución"""
        if self._process is None:
            return False
        return self._process.poll() is None and self._running
    
    def send_command(self, command: str) -> bool:
        """Envía un comando al servidor"""
        if not self.is_running():
            logger.warning("No se puede enviar comando, el servidor no está en ejecución")
            return False
        
        try:
            if self._process.stdin and not self._process.stdin.closed:
                self._process.stdin.write(f"{command}\n")
                self._process.stdin.flush()
                logger.debug(f"Comando enviado: {command}")
                return True
            else:
                logger.warning("stdin del proceso está cerrado, no se puede enviar comando")
                return False
        except (BrokenPipeError, ValueError, OSError) as e:
            logger.warning(f"Pipe cerrado al enviar comando: {e}")
            return False
        except Exception as e:
            logger.error(f"Error inesperado al enviar comando: {e}")
            return False
    
    def get_output_stream(self) -> Optional[Callable[[str], None]]:
        """Obtiene el callback actual"""
        return self._output_callback
    
    def set_output_callback(self, callback: Callable[[str], None]) -> None:
        """Establece un callback para recibir el output del servidor"""
        self._output_callback = callback
    
    def _read_output(self):
        """Lee el output del servidor en un thread separado"""
        try:
            while self.is_running() and self._process and self._process.poll() is None:
                try:
                    line = self._process.stdout.readline()
                    if not line:
                        break
                    
                    line = line.strip()
                    if line:
                        logger.debug(f"Server: {line}")
                        if self._output_callback:
                            try:
                                self._output_callback(line)
                            except Exception as e:
                                logger.error(f"Error en callback de output: {e}")
                except (ValueError, OSError) as e:
                    # El stream fue cerrado
                    logger.debug(f"Stream cerrado: {e}")
                    break
        except Exception as e:
            logger.error(f"Error al leer output del servidor: {e}")
        finally:
            logger.debug("Thread de lectura de output terminado")
            self._running = False
    
    def _update_forge_jvm_args(self, server_path: Path, memory_min: str, memory_max: str):
        """
        Actualiza el archivo user_jvm_args.txt de Forge con la memoria configurada
        """
        try:
            jvm_args_file = server_path / "user_jvm_args.txt"
            
            # Leer contenido existente (si existe)
            existing_args = []
            if jvm_args_file.exists():
                with open(jvm_args_file, 'r') as f:
                    for line in f:
                        # Mantener comentarios pero remover líneas de memoria antiguas
                        if line.strip() and not line.strip().startswith('#'):
                            if not line.strip().startswith('-Xms') and not line.strip().startswith('-Xmx'):
                                existing_args.append(line.strip())
            
            # Crear nuevo contenido
            content = [
                "# Xmx and Xms set the maximum and minimum RAM usage, respectively.",
                "# Configured automatically by Pass the host",
                f"-Xms{memory_min}",
                f"-Xmx{memory_max}"
            ]
            
            # Agregar otros argumentos existentes
            if existing_args:
                content.extend(existing_args)
            
            # Escribir archivo
            with open(jvm_args_file, 'w') as f:
                f.write('\n'.join(content) + '\n')
            
            logger.info(f"Argumentos JVM de Forge actualizados: -Xms{memory_min} -Xmx{memory_max}")
            
        except Exception as e:
            logger.error(f"Error actualizando user_jvm_args.txt: {e}")
    
    def _kill_orphaned_servers(self, server_path: str):
        """
        Mata procesos Java huérfanos que puedan estar corriendo el servidor
        """
        try:
            server_path_resolved = str(Path(server_path).resolve())
            killed_count = 0
            
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cwd']):
                try:
                    # Buscar procesos Java
                    if proc.info['name'] and 'java' in proc.info['name'].lower():
                        cmdline = proc.info['cmdline']
                        cwd = proc.info['cwd']
                        
                        # Verificar si está corriendo desde nuestro directorio de servidor
                        if cmdline and cwd:
                            # Buscar "server.jar" en la línea de comandos
                            if any('server.jar' in str(arg) for arg in cmdline):
                                # Verificar que el cwd sea nuestro servidor
                                if server_path_resolved in str(cwd):
                                    logger.warning(f"Encontrado proceso huérfano Java (PID {proc.info['pid']}), terminando...")
                                    proc.terminate()
                                    proc.wait(timeout=5)
                                    killed_count += 1
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                    continue
            
            if killed_count > 0:
                logger.info(f"Terminados {killed_count} procesos huérfanos")
                time.sleep(2)  # Esperar a que los archivos se liberen
                
        except Exception as e:
            logger.warning(f"Error al verificar procesos huérfanos: {e}")
