"""
Diálogo para crear un nuevo servidor de Minecraft
"""
import logging
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
    QPushButton, QComboBox, QMessageBox, QProgressBar, QTextEdit
)
from PySide6.QtCore import Qt, Signal, QThread
import requests

logger = logging.getLogger(__name__)


class DownloadWorker(QThread):
    """Worker para descargar archivos en segundo plano"""
    progress = Signal(int, str)  # porcentaje, mensaje
    finished = Signal(bool, str)  # éxito, mensaje
    
    def __init__(self, download_type: str, version: str, java_version: str = None):
        super().__init__()
        self.download_type = download_type
        self.version = version
        self.java_version = java_version
        self.cancelled = False
    
    def run(self):
        try:
            if self.download_type == "minecraft":
                self._download_minecraft()
            elif self.download_type == "java":
                self._download_java()
            elif self.download_type == "both":
                self._download_both()
        except Exception as e:
            logger.error(f"Error en descarga: {e}")
            self.finished.emit(False, str(e))
    
    def _download_minecraft(self, emit_finished=True):
        """Descarga el servidor de Minecraft"""
        from pathlib import Path
        import os
        
        self.progress.emit(10, "Obteniendo información del servidor...")
        
        # Obtener URL del servidor según versión
        server_url = self._get_minecraft_server_url(self.version)
        if not server_url:
            if emit_finished:
                self.finished.emit(False, f"No se encontró la versión {self.version}")
            return False
        
        # Crear directorio server si no existe
        server_dir = Path("./server")
        server_dir.mkdir(exist_ok=True)
        
        self.progress.emit(20, "Descargando servidor de Minecraft...")
        
        # Descargar servidor
        response = requests.get(server_url, stream=True)
        total_size = int(response.headers.get('content-length', 0))
        
        server_jar = server_dir / "server.jar"
        downloaded = 0
        
        with open(server_jar, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if self.cancelled:
                    return False
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = int((downloaded / total_size) * 60) + 20
                    self.progress.emit(percent, f"Descargando... {downloaded // 1024 // 1024}MB")
        
        self.progress.emit(80, "Aceptando EULA...")
        
        # Crear eula.txt
        eula_file = server_dir / "eula.txt"
        with open(eula_file, 'w') as f:
            f.write("eula=true\n")
        
        self.progress.emit(100, "Servidor descargado exitosamente")
        if emit_finished:
            self.finished.emit(True, "Servidor de Minecraft instalado correctamente")
        return True
    
    def _download_java(self, emit_finished=True):
        """Descarga Java JRE desde Adoptium"""
        from pathlib import Path
        import zipfile
        import shutil
        import platform
        
        self.progress.emit(10, "Obteniendo información de Java...")
        
        # Determinar arquitectura y OS
        arch = "x64" if platform.machine().endswith('64') else "x86"
        os_type = "windows"
        
        # Obtener URL de descarga de Adoptium
        api_url = f"https://api.adoptium.net/v3/binary/latest/{self.java_version}/ga/{os_type}/{arch}/jre/hotspot/normal/eclipse"
        
        self.progress.emit(20, f"Descargando Java {self.java_version} JRE...")
        
        response = requests.get(api_url, stream=True, allow_redirects=True)
        if response.status_code != 200:
            if emit_finished:
                self.finished.emit(False, f"No se pudo descargar Java {self.java_version}")
            return False
        
        total_size = int(response.headers.get('content-length', 0))
        
        # Descargar a archivo temporal
        temp_zip = Path("./java_temp.zip")
        downloaded = 0
        
        with open(temp_zip, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if self.cancelled:
                    return False
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0:
                    percent = int((downloaded / total_size) * 60) + 20
                    self.progress.emit(percent, f"Descargando Java... {downloaded // 1024 // 1024}MB")
        
        self.progress.emit(80, "Extrayendo Java...")
        
        # Extraer ZIP
        java_dir = Path("./java_runtime")
        if java_dir.exists():
            shutil.rmtree(java_dir)
        
        with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
            zip_ref.extractall(".")
        
        # Buscar la carpeta extraída y renombrarla
        for item in Path(".").iterdir():
            if item.is_dir() and item.name.startswith("jdk"):
                shutil.move(str(item), str(java_dir))
                break
        
        # Limpiar archivo temporal
        temp_zip.unlink()
        
        self.progress.emit(50, "Java instalado exitosamente")
        if emit_finished:
            self.finished.emit(True, f"Java {self.java_version} JRE instalado correctamente")
        return True
    
    def _download_both(self):
        """Descarga tanto Java como Minecraft"""
        # Primero Java (sin emitir finished)
        java_success = self._download_java(emit_finished=False)
        if self.cancelled or not java_success:
            if not self.cancelled:
                self.finished.emit(False, "Error al descargar Java")
            return
        
        self.progress.emit(50, "Java instalado, iniciando descarga de Minecraft...")
        
        # Luego Minecraft (sin emitir finished)
        mc_success = self._download_minecraft(emit_finished=False)
        if self.cancelled or not mc_success:
            if not self.cancelled:
                self.finished.emit(False, "Error al descargar Minecraft")
            return
        
        # Ambos exitosos
        self.progress.emit(100, "Instalación completa")
        self.finished.emit(True, f"Java {self.java_version} y Minecraft instalados correctamente")
    
    def _get_minecraft_server_url(self, version: str) -> str:
        """Obtiene la URL de descarga del servidor de Minecraft"""
        # URLs conocidas para versiones populares
        version_urls = {
            "1.21.4": "https://piston-data.mojang.com/v1/objects/4707d00eb834b446575d89a61a11b5d548d8c001/server.jar",
            "1.21.3": "https://piston-data.mojang.com/v1/objects/45810d238246d90e811d896f87b14695b7fb6839/server.jar",
            "1.21.1": "https://piston-data.mojang.com/v1/objects/59353fb40c36d304f2035d51e7d6e6baa98dc05c/server.jar",
            "1.21": "https://piston-data.mojang.com/v1/objects/450698d1863ab5180c25d7c804ef0fe6369dd1ba/server.jar",
            "1.20.6": "https://piston-data.mojang.com/v1/objects/145ff0858209bcfc164859ba735d4199aafa1eea/server.jar",
            "1.20.4": "https://piston-data.mojang.com/v1/objects/8dd1a28015f51b1803213892b50b7b4fc76e594d/server.jar",
            "1.20.1": "https://piston-data.mojang.com/v1/objects/84194a2f286ef7c14ed7ce0090dba59902951553/server.jar",
            "1.19.4": "https://piston-data.mojang.com/v1/objects/8f3112a1049751cc472ec13e397eade5336ca7ae/server.jar",
        }
        
        return version_urls.get(version, "")
    
    def cancel(self):
        """Cancela la descarga"""
        self.cancelled = True


class CreateServerDialog(QDialog):
    """Diálogo para crear un nuevo servidor de Minecraft"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Crear Nuevo Servidor de Minecraft")
        self.setModal(True)
        self.setMinimumWidth(600)
        self.setMinimumHeight(400)
        
        self.download_worker = None
        self.installed_java_version = None
        self._detect_installed_java()
        self._setup_ui()
    
    def _detect_installed_java(self):
        """Detecta la versión de Java instalada"""
        from pathlib import Path
        import subprocess
        
        java_path = Path("./java_runtime/bin/java.exe")
        if java_path.exists():
            try:
                # Ejecutar java -version
                result = subprocess.run(
                    [str(java_path), "-version"],
                    capture_output=True,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
                )
                
                # Parsear versión del output
                version_output = result.stderr  # java -version imprime en stderr
                
                # Buscar número de versión (ej: "21.0.5" o "1.8.0")
                import re
                match = re.search(r'version "(\d+)\.(\d+)', version_output)
                if match:
                    major = int(match.group(1))
                    # Java 8 se reporta como "1.8", Java 9+ como "9", "11", "17", etc.
                    if major == 1:
                        self.installed_java_version = int(match.group(2))
                    else:
                        self.installed_java_version = major
                    
                    logger.info(f"Java {self.installed_java_version} detectado")
            except Exception as e:
                logger.warning(f"No se pudo detectar versión de Java: {e}")
    
    def _setup_ui(self):
        """Configura la interfaz del diálogo"""
        layout = QVBoxLayout(self)
        
        # Título
        title = QLabel("<h2>🎮 Crear Nuevo Servidor</h2>")
        layout.addWidget(title)
        
        # Nombre del servidor
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("Nombre del servidor:"))
        self.server_name_input = QLineEdit()
        self.server_name_input.setPlaceholderText("Mi Servidor de Minecraft")
        name_layout.addWidget(self.server_name_input)
        layout.addLayout(name_layout)
        
        # Versión de Minecraft
        version_layout = QHBoxLayout()
        version_layout.addWidget(QLabel("Versión de Minecraft:"))
        self.version_combo = QComboBox()
        self.version_combo.addItems([
            "1.21.4",
            "1.21.3",
            "1.21.1",
            "1.21",
            "1.20.6",
            "1.20.4",
            "1.20.1",
            "1.19.4"
        ])
        self.version_combo.currentTextChanged.connect(self._update_java_version)
        version_layout.addWidget(self.version_combo)
        layout.addLayout(version_layout)
        
        # Versión de Java
        java_layout = QHBoxLayout()
        java_layout.addWidget(QLabel("Versión de Java:"))
        self.java_version_label = QLabel("Java 21")
        self.java_version_label.setStyleSheet("font-weight: bold;")
        java_layout.addWidget(self.java_version_label)
        java_layout.addStretch()
        layout.addLayout(java_layout)
        
        # Advertencia de compatibilidad de Java
        self.java_warning_label = QLabel("")
        self.java_warning_label.setVisible(False)
        self.java_warning_label.setWordWrap(True)
        self.java_warning_label.setStyleSheet("""
            QLabel {
                background-color: #fff3cd;
                color: #856404;
                padding: 10px;
                border-radius: 5px;
                font-weight: bold;
            }
        """)
        layout.addWidget(self.java_warning_label)
        
        # Información
        info_label = QLabel(
            "Se descargará el servidor de Minecraft y Java JRE automáticamente.\n"
            "Este proceso puede tardar varios minutos dependiendo de tu conexión."
        )
        info_label.setWordWrap(True)
        info_label.setStyleSheet("color: #666; padding: 10px;")
        layout.addWidget(info_label)
        
        # Barra de progreso
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        # Label de estado
        self.status_label = QLabel("")
        self.status_label.setVisible(False)
        layout.addWidget(self.status_label)
        
        # Log de progreso
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(150)
        self.log_text.setVisible(False)
        layout.addWidget(self.log_text)
        
        layout.addStretch()
        
        # Botones
        buttons_layout = QHBoxLayout()
        
        self.create_button = QPushButton("🚀 Crear Servidor")
        self.create_button.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-weight: bold;
                padding: 10px 20px;
                border-radius: 5px;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.create_button.clicked.connect(self._start_creation)
        buttons_layout.addWidget(self.create_button)
        
        self.cancel_button = QPushButton("Cancelar")
        self.cancel_button.clicked.connect(self.reject)
        buttons_layout.addWidget(self.cancel_button)
        
        layout.addLayout(buttons_layout)
        
        # Actualizar versión de Java inicial
        self._update_java_version(self.version_combo.currentText())
    
    def _is_java_compatible(self, required_java: int) -> bool:
        """Verifica si la versión de Java instalada es compatible con la requerida"""
        if self.installed_java_version is None:
            return True  # No hay Java instalado, se descargará
        
        # Reglas de compatibilidad:
        # - Minecraft 1.21+ requiere Java 21 exactamente (o superior)
        # - Minecraft 1.18-1.20.6 requiere Java 17+ (no funciona bien con Java 21+)
        # - Minecraft 1.17 requiere Java 16+
        # - Minecraft 1.16 y anteriores requieren Java 8
        
        if required_java == 21:
            # Java 21 necesita versión exacta o superior
            return self.installed_java_version >= 21
        elif required_java == 17:
            # Java 17 funciona con 17-20, pero no con 21+
            return 17 <= self.installed_java_version <= 20
        elif required_java == 16:
            # Java 16 funciona con 16-17
            return 16 <= self.installed_java_version <= 17
        elif required_java == 8:
            # Java 8 necesita exactamente 8
            return self.installed_java_version == 8
        
        return False
    
    def _update_java_version(self, minecraft_version: str):
        """Actualiza la versión de Java requerida según la versión de Minecraft"""
        version_parts = minecraft_version.split('.')
        major = int(version_parts[1]) if len(version_parts) > 1 else 0
        
        if major >= 21:
            java_version = "Java 21"
            self.java_version = "21"
            required_java = 21
        elif major >= 18:
            java_version = "Java 17"
            self.java_version = "17"
            required_java = 17
        elif major >= 17:
            java_version = "Java 16"
            self.java_version = "16"
            required_java = 16
        else:
            java_version = "Java 8"
            self.java_version = "8"
            required_java = 8
        
        self.java_version_label.setText(java_version)
        
        # Verificar compatibilidad con Java instalado
        if self.installed_java_version is not None:
            is_compatible = self._is_java_compatible(required_java)
            
            if not is_compatible:
                # Mostrar advertencia
                self.java_warning_label.setText(
                    f"⚠️ Tienes Java {self.installed_java_version} instalado, pero Minecraft {minecraft_version} "
                    f"requiere Java {required_java}.\n"
                    f"Se descargará e instalará Java {required_java} automáticamente."
                )
                self.java_warning_label.setVisible(True)
            else:
                # Java compatible, ocultar advertencia
                self.java_warning_label.setVisible(False)
        else:
            # No hay Java instalado
            self.java_warning_label.setText(
                f"ℹ️ No se detectó Java instalado. Se descargará Java {required_java} automáticamente."
            )
            self.java_warning_label.setVisible(True)
    
    def _start_creation(self):
        """Inicia el proceso de creación del servidor"""
        server_name = self.server_name_input.text().strip()
        if not server_name:
            QMessageBox.warning(self, "Error", "Debes ingresar un nombre para el servidor")
            return
        
        # Deshabilitar controles
        self.create_button.setEnabled(False)
        self.server_name_input.setEnabled(False)
        self.version_combo.setEnabled(False)
        
        # Mostrar progreso
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.status_label.setVisible(True)
        self.log_text.setVisible(True)
        
        # Iniciar descarga
        minecraft_version = self.version_combo.currentText()
        
        # Determinar si necesitamos descargar Java
        version_parts = minecraft_version.split('.')
        major = int(version_parts[1]) if len(version_parts) > 1 else 0
        
        if major >= 21:
            required_java = 21
        elif major >= 18:
            required_java = 17
        elif major >= 17:
            required_java = 16
        else:
            required_java = 8
        
        # Decidir qué descargar
        need_java = (self.installed_java_version is None or 
                     not self._is_java_compatible(required_java))
        
        download_type = "both" if need_java else "minecraft"
        
        self.download_worker = DownloadWorker(download_type, minecraft_version, self.java_version)
        self.download_worker.progress.connect(self._on_progress)
        self.download_worker.finished.connect(self._on_finished)
        self.download_worker.start()
        
        self._log(f"Iniciando creación del servidor '{server_name}'...")
        self._log(f"Versión de Minecraft: {minecraft_version}")
        self._log(f"Versión de Java requerida: {self.java_version}")
        if need_java:
            self._log(f"Se descargará Java {self.java_version}")
        else:
            self._log(f"Usando Java {self.installed_java_version} instalado")
    
    def _on_progress(self, percent: int, message: str):
        """Actualiza el progreso"""
        self.progress_bar.setValue(percent)
        self.status_label.setText(message)
        self._log(message)
    
    def _on_finished(self, success: bool, message: str):
        """Callback cuando termina la descarga"""
        self._log(message)
        
        if success:
            QMessageBox.information(
                self,
                "Servidor Creado",
                f"El servidor ha sido creado exitosamente.\n\n"
                f"Ahora puedes iniciar el servidor desde la ventana principal."
            )
            self.accept()
        else:
            QMessageBox.critical(
                self,
                "Error",
                f"No se pudo crear el servidor:\n{message}"
            )
            self.create_button.setEnabled(True)
            self.server_name_input.setEnabled(True)
            self.version_combo.setEnabled(True)
    
    def _log(self, message: str):
        """Agrega un mensaje al log"""
        self.log_text.append(message)
        # Auto-scroll al final
        cursor = self.log_text.textCursor()
        cursor.movePosition(cursor.MoveOperation.End)
        self.log_text.setTextCursor(cursor)
    
    def closeEvent(self, event):
        """Override para manejar cierre"""
        if self.download_worker and self.download_worker.isRunning():
            reply = QMessageBox.question(
                self,
                "Cancelar descarga",
                "Hay una descarga en progreso. ¿Deseas cancelarla?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            
            if reply == QMessageBox.StandardButton.Yes:
                self.download_worker.cancel()
                self.download_worker.wait(2000)
                event.accept()
            else:
                event.ignore()
        else:
            event.accept()
