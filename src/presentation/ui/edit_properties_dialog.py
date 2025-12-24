"""
Diálogo para editar server.properties
"""
import logging
from pathlib import Path
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, 
    QPushButton, QMessageBox, QTextEdit, QProgressDialog
)
from PySide6.QtCore import Qt, Signal, QThread
from PySide6.QtGui import QFont

logger = logging.getLogger(__name__)


class SyncWorker(QThread):
    """Worker para sincronizar archivos a R2 en segundo plano"""
    progress = Signal(str)  # mensaje
    finished = Signal(bool, str)  # éxito, mensaje
    
    def __init__(self, sync_service, local_path: Path, remote_path: str):
        super().__init__()
        self.sync_service = sync_service
        self.local_path = local_path
        self.remote_path = remote_path
    
    def run(self):
        import asyncio
        try:
            self.progress.emit("Sincronizando con R2...")
            
            # Crear un nuevo event loop para este thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Ejecutar la sincronización
            success = loop.run_until_complete(
                self.sync_service.sync_upload(
                    self.local_path,
                    self.remote_path,
                    None  # Sin callback de progreso por simplicidad
                )
            )
            
            loop.close()
            
            if success:
                self.finished.emit(True, "Cambios guardados y sincronizados con R2")
            else:
                self.finished.emit(False, "Error al sincronizar con R2")
                
        except Exception as e:
            logger.error(f"Error en sincronización: {e}")
            self.finished.emit(False, f"Error: {str(e)}")


class EditPropertiesDialog(QDialog):
    """Diálogo para editar server.properties"""
    
    def __init__(self, container, parent=None):
        super().__init__(parent)
        self.container = container
        self.properties_path = None
        self.sync_worker = None
        
        self.setWindowTitle("Editar server.properties")
        self.setModal(True)
        self.setMinimumWidth(700)
        self.setMinimumHeight(600)
        
        self._setup_ui()
        self._load_properties()
    
    def _setup_ui(self):
        """Configura la interfaz del diálogo"""
        layout = QVBoxLayout(self)
        
        # Título
        title = QLabel("<h2>⚙️ Editar Propiedades del Servidor</h2>")
        layout.addWidget(title)
        
        # Información
        info = QLabel(
            "Edita las propiedades del servidor de Minecraft.\n"
            "Los cambios se guardarán automáticamente y se sincronizarán con R2."
        )
        info.setWordWrap(True)
        info.setStyleSheet("color: #666; padding: 5px;")
        layout.addWidget(info)
        
        # Editor de texto
        self.text_edit = QTextEdit()
        font = QFont("Consolas", 10)
        self.text_edit.setFont(font)
        self.text_edit.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        layout.addWidget(self.text_edit)
        
        # Botones de propiedades comunes
        common_layout = QHBoxLayout()
        common_label = QLabel("Propiedades comunes:")
        common_label.setStyleSheet("font-weight: bold;")
        common_layout.addWidget(common_label)
        
        # Botones rápidos
        self.add_motd_btn = QPushButton("MOTD")
        self.add_motd_btn.setToolTip("Agregar mensaje del día")
        self.add_motd_btn.clicked.connect(lambda: self._show_property_help("motd"))
        common_layout.addWidget(self.add_motd_btn)
        
        self.add_maxplayers_btn = QPushButton("Max Players")
        self.add_maxplayers_btn.setToolTip("Máximo de jugadores")
        self.add_maxplayers_btn.clicked.connect(lambda: self._show_property_help("max-players"))
        common_layout.addWidget(self.add_maxplayers_btn)
        
        self.add_difficulty_btn = QPushButton("Difficulty")
        self.add_difficulty_btn.setToolTip("Dificultad del juego")
        self.add_difficulty_btn.clicked.connect(lambda: self._show_property_help("difficulty"))
        common_layout.addWidget(self.add_difficulty_btn)
        
        self.add_gamemode_btn = QPushButton("Game Mode")
        self.add_gamemode_btn.setToolTip("Modo de juego")
        self.add_gamemode_btn.clicked.connect(lambda: self._show_property_help("gamemode"))
        common_layout.addWidget(self.add_gamemode_btn)
        
        common_layout.addStretch()
        layout.addLayout(common_layout)
        
        # Botones de acción
        buttons_layout = QHBoxLayout()
        
        self.save_button = QPushButton("💾 Guardar y Sincronizar")
        self.save_button.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-weight: bold;
                padding: 10px 20px;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        self.save_button.clicked.connect(self._save_properties)
        buttons_layout.addWidget(self.save_button)
        
        self.cancel_button = QPushButton("Cancelar")
        self.cancel_button.clicked.connect(self.reject)
        buttons_layout.addWidget(self.cancel_button)
        
        layout.addLayout(buttons_layout)
    
    def _load_properties(self):
        """Carga el archivo server.properties"""
        try:
            # Obtener configuración del servidor
            config_repo = self.container.get_config_repository()
            server_config = config_repo.get_server_config()
            
            if not server_config:
                QMessageBox.warning(
                    self,
                    "Error",
                    "No se pudo cargar la configuración del servidor"
                )
                self.reject()
                return
            
            # Construir ruta al archivo properties
            self.properties_path = Path(server_config.server_path) / "server.properties"
            
            if not self.properties_path.exists():
                # Crear archivo con propiedades por defecto
                default_content = self._get_default_properties()
                self.text_edit.setPlainText(default_content)
                QMessageBox.information(
                    self,
                    "Archivo no encontrado",
                    "El archivo server.properties no existe. Se creará uno nuevo al guardar."
                )
            else:
                # Leer archivo existente
                with open(self.properties_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                self.text_edit.setPlainText(content)
                
            logger.info(f"Propiedades cargadas desde: {self.properties_path}")
            
        except Exception as e:
            logger.error(f"Error al cargar properties: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"No se pudo cargar el archivo:\n{str(e)}"
            )
            self.reject()
    
    def _save_properties(self):
        """Guarda los cambios y sincroniza con R2"""
        try:
            # Guardar archivo localmente
            content = self.text_edit.toPlainText()
            
            # Asegurar que el directorio existe
            self.properties_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.properties_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logger.info(f"Propiedades guardadas en: {self.properties_path}")
            
            # Iniciar sincronización con R2
            self._sync_to_r2()
            
        except Exception as e:
            logger.error(f"Error al guardar properties: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"No se pudo guardar el archivo:\n{str(e)}"
            )
    
    def _sync_to_r2(self):
        """Sincroniza el servidor con R2"""
        try:
            # Obtener servicios y configuración
            config_repo = self.container.get_config_repository()
            server_config = config_repo.get_server_config()
            r2_config = config_repo.get_r2_config()
            sync_service = self.container.get_sync_service()
            
            if not r2_config:
                QMessageBox.warning(
                    self,
                    "Advertencia",
                    "No hay configuración de R2. Los cambios solo se guardaron localmente."
                )
                self.accept()
                return
            
            # Mostrar diálogo de progreso
            self.progress_dialog = QProgressDialog(
                "Sincronizando con R2...",
                "Cancelar",
                0, 0,
                self
            )
            self.progress_dialog.setWindowModality(Qt.WindowModality.WindowModal)
            self.progress_dialog.setMinimumDuration(0)
            self.progress_dialog.setCancelButton(None)  # No permitir cancelar
            self.progress_dialog.show()
            
            # Crear worker para sincronizar
            local_path = Path(server_config.server_path)
            remote_path = f"cloudflare:{r2_config.bucket_name}/server_files"
            
            self.sync_worker = SyncWorker(sync_service, local_path, remote_path)
            self.sync_worker.progress.connect(self._on_sync_progress)
            self.sync_worker.finished.connect(self._on_sync_finished)
            self.sync_worker.start()
            
        except Exception as e:
            logger.error(f"Error al iniciar sincronización: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"No se pudo sincronizar:\n{str(e)}"
            )
    
    def _on_sync_progress(self, message: str):
        """Actualiza el progreso de sincronización"""
        if hasattr(self, 'progress_dialog'):
            self.progress_dialog.setLabelText(message)
    
    def _on_sync_finished(self, success: bool, message: str):
        """Callback cuando termina la sincronización"""
        if hasattr(self, 'progress_dialog'):
            self.progress_dialog.close()
        
        if success:
            QMessageBox.information(
                self,
                "Éxito",
                message
            )
            self.accept()
        else:
            QMessageBox.warning(
                self,
                "Advertencia",
                f"{message}\n\nLos cambios se guardaron localmente pero no se sincronizaron con R2."
            )
            self.accept()
    
    def _show_property_help(self, property_name: str):
        """Muestra ayuda sobre una propiedad específica"""
        help_text = {
            "motd": "motd=Mi Servidor de Minecraft\n(Mensaje que se muestra en la lista de servidores)",
            "max-players": "max-players=20\n(Número máximo de jugadores simultáneos)",
            "difficulty": "difficulty=normal\n(Opciones: peaceful, easy, normal, hard)",
            "gamemode": "gamemode=survival\n(Opciones: survival, creative, adventure, spectator)"
        }
        
        QMessageBox.information(
            self,
            f"Propiedad: {property_name}",
            help_text.get(property_name, "Propiedad no encontrada")
        )
    
    def _get_default_properties(self) -> str:
        """Retorna propiedades por defecto"""
        return """#Minecraft server properties
#Generated by Pass the host
enable-jmx-monitoring=false
rcon.port=25575
level-seed=
gamemode=survival
enable-command-block=false
enable-query=false
generator-settings={}
enforce-secure-profile=true
level-name=world
motd=A Minecraft Server
query.port=25565
pvp=true
generate-structures=true
max-chained-neighbor-updates=1000000
difficulty=easy
network-compression-threshold=256
max-tick-time=60000
require-resource-pack=false
use-native-transport=true
max-players=20
online-mode=true
enable-status=true
allow-flight=false
broadcast-rcon-to-ops=true
view-distance=10
server-ip=
resource-pack-prompt=
allow-nether=true
server-port=25565
enable-rcon=false
sync-chunk-writes=true
op-permission-level=4
prevent-proxy-connections=false
hide-online-players=false
resource-pack=
entity-broadcast-range-percentage=100
simulation-distance=10
rcon.password=
player-idle-timeout=0
debug=false
force-gamemode=false
rate-limit=0
hardcore=false
white-list=false
broadcast-console-to-ops=true
spawn-npcs=true
spawn-animals=true
function-permission-level=2
level-type=minecraft\:normal
text-filtering-config=
spawn-monsters=true
enforce-whitelist=false
spawn-protection=16
resource-pack-sha1=
max-world-size=29999984
"""
