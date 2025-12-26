"""
Ventana principal de la aplicación
"""
import sys
import os
import shutil
import tempfile
import zipfile
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QComboBox, QProgressBar,
    QTextEdit, QGroupBox, QSystemTrayIcon, QMenu, QMessageBox, QLineEdit, QFileDialog
)
from PySide6.QtCore import Qt, QTimer, QThread, Signal
from PySide6.QtGui import QIcon, QAction
import logging
import threading
from pathlib import Path

from src.presentation.di.container import DependencyContainer
from src.presentation.ui.config_dialog import ConfigDialog
from src.presentation.ui.release_lock_dialog import ReleaseLockDialog
from src.presentation.ui.create_server_dialog import CreateServerDialog
from src.presentation.ui.edit_properties_dialog import EditPropertiesDialog
from src.presentation.workers.server_workers import (
    StartServerWorker,
    StopServerWorker,
    CheckStatusWorker
)
from src.domain.entities.server_entities import SyncProgress

logger = logging.getLogger(__name__)


class MainWindow(QMainWindow):
    """Ventana principal de la aplicación"""
    
    def __init__(self, container: DependencyContainer):
        super().__init__()
        self.container = container
        self.current_worker = None
        self.status_check_worker = None  # Worker para verificación de estado
        
        # Buffer para logs del servidor (prevenir crash por muchos mensajes)
        self._log_buffer = []
        self._log_buffer_lock = threading.Lock()
        self._max_buffer_size = 50  # Máximo de mensajes en buffer
        
        # Configurar ventana
        self.setWindowTitle("Pass the host!")
        self.setMinimumSize(800, 600)
        
        # Verificar si existe configuración
        self._config_exists = Path('config.json').exists()
        
        # Verificar prerequisitos antes de crear UI (para saber el estado)
        valid, errors = self.container.verify_prerequisites()
        self._prerequisites_ok = valid
        self._prerequisite_errors = errors if not valid else []
        
        # Inicializar UI (ya tenemos _prerequisites_ok definido)
        self._init_ui()
        
        # Configurar system tray
        self._init_system_tray()
        
        # Mostrar errores de prerequisitos si existen (ahora la UI ya está creada)
        if not valid:
            self._show_prerequisite_errors(errors)
        
        # Verificar estado inicial
        if self._prerequisites_ok and self._config_exists:
            self._check_server_status()
        
        # Timer para actualización periódica de estado
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self._check_server_status)
        self.status_timer.start(30000)  # Cada 30 segundos
        
        # Timer para procesar buffer de logs (prevenir crash por muchos mensajes)
        self.log_buffer_timer = QTimer()
        self.log_buffer_timer.timeout.connect(self._flush_log_buffer)
        self.log_buffer_timer.start(100)  # Cada 100ms procesar buffer
    
    def _init_ui(self):
        """Inicializa la interfaz de usuario"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        
        # === Sección de Estado ===
        status_group = QGroupBox("Estado del Servidor")
        status_layout = QVBoxLayout()
        
        self.status_label = QLabel("🔄 Verificando...")
        self.status_label.setStyleSheet("font-size: 16px; font-weight: bold; padding: 10px;")
        status_layout.addWidget(self.status_label)
        
        self.status_detail_label = QLabel("")
        status_layout.addWidget(self.status_detail_label)
        
        status_group.setLayout(status_layout)
        main_layout.addWidget(status_group)
        
        # === Verificar si existe servidor ===
        self._check_server_exists()
        
        # === Botón de Configuración ===
        config_button_layout = QHBoxLayout()
        self.config_button = QPushButton("⚙️ Configurar R2")
        self.config_button.setMinimumHeight(40)
        self.config_button.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #0b7dda;
            }
        """)
        self.config_button.clicked.connect(self._open_config_dialog)
        config_button_layout.addWidget(self.config_button)
        
        self.release_lock_button = QPushButton("🔓 Liberar Lock (Emergencia)")
        self.release_lock_button.setMinimumHeight(40)
        self.release_lock_button.setStyleSheet("""
            QPushButton {
                background-color: #f44336;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #d32f2f;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.release_lock_button.clicked.connect(self._release_lock_emergency)
        self.release_lock_button.setEnabled(self._config_exists)
        config_button_layout.addWidget(self.release_lock_button)
        
        main_layout.addLayout(config_button_layout)
        
        # Mostrar advertencia si no hay configuración
        if not self._config_exists:
            warning_label = QLabel("⚠️ No hay configuración. Haz clic en 'Configurar R2' para comenzar.")
            warning_label.setStyleSheet("""
                QLabel {
                    background-color: #fff3cd;
                    color: #856404;
                    padding: 10px;
                    border-radius: 5px;
                    font-weight: bold;
                }
            """)
            main_layout.addWidget(warning_label)
        
        # === Sección de Configuración de Red ===
        network_group = QGroupBox("Configuración de Red")
        network_layout = QHBoxLayout()
        
        network_layout.addWidget(QLabel("Interfaz de Red:"))
        
        self.network_combo = QComboBox()
        self.network_combo.setMinimumWidth(300)
        network_layout.addWidget(self.network_combo, 1)
        
        self.refresh_network_btn = QPushButton("🔄 Actualizar")
        self.refresh_network_btn.clicked.connect(self._load_network_interfaces)
        network_layout.addWidget(self.refresh_network_btn)
        
        network_group.setLayout(network_layout)
        main_layout.addWidget(network_group)
        
        # Cargar interfaces de red
        self._load_network_interfaces()
        
        # === Sección de Configuración de Memoria ===
        memory_group = QGroupBox("Configuración de Memoria")
        memory_layout = QHBoxLayout()
        
        memory_layout.addWidget(QLabel("RAM Mínima:"))
        self.memory_min_input = QLineEdit()
        self.memory_min_input.setPlaceholderText("1G")
        self.memory_min_input.setMaximumWidth(100)
        self.memory_min_input.editingFinished.connect(lambda: self._auto_save_memory('min'))
        memory_layout.addWidget(self.memory_min_input)
        
        memory_layout.addWidget(QLabel("RAM Máxima:"))
        self.memory_max_input = QLineEdit()
        self.memory_max_input.setPlaceholderText("4G")
        self.memory_max_input.setMaximumWidth(100)
        self.memory_max_input.editingFinished.connect(lambda: self._auto_save_memory('max'))
        memory_layout.addWidget(self.memory_max_input)
        
        memory_layout.addStretch()
        
        memory_group.setLayout(memory_layout)
        main_layout.addWidget(memory_group)
        
        # Cargar valores de memoria actuales
        self._load_memory_config()
        
        # === Sección de Progreso ===
        progress_group = QGroupBox("Progreso")
        progress_layout = QVBoxLayout()
        
        self.progress_label = QLabel("Listo")
        progress_layout.addWidget(self.progress_label)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        progress_layout.addWidget(self.progress_bar)
        
        self.progress_detail_label = QLabel("")
        self.progress_detail_label.setVisible(False)
        progress_layout.addWidget(self.progress_detail_label)
        
        progress_group.setLayout(progress_layout)
        main_layout.addWidget(progress_group)
        
        # === Sección de Controles ===
        controls_layout = QHBoxLayout()
        
        self.start_button = QPushButton("▶️ INICIAR SERVIDOR")
        self.start_button.setMinimumHeight(50)
        self.start_button.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-size: 16px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.start_button.clicked.connect(self._start_server)
        self.start_button.setEnabled(self._prerequisites_ok and self._config_exists)
        controls_layout.addWidget(self.start_button)
        
        self.stop_button = QPushButton("⏹️ DETENER SERVIDOR")
        self.stop_button.setMinimumHeight(50)
        self.stop_button.setStyleSheet("""
            QPushButton {
                background-color: #f44336;
                color: white;
                font-size: 16px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #da190b;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.stop_button.clicked.connect(self._stop_server)
        self.stop_button.setEnabled(False)
        controls_layout.addWidget(self.stop_button)
        
        main_layout.addLayout(controls_layout)
        
        # === Botón de Editar Propiedades ===
        edit_props_layout = QHBoxLayout()
        
        self.edit_properties_btn = QPushButton("⚙️ Editar server.properties")
        self.edit_properties_btn.setMinimumHeight(40)
        self.edit_properties_btn.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #0b7dda;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.edit_properties_btn.clicked.connect(self._edit_properties)
        self.edit_properties_btn.setEnabled(self._config_exists)
        edit_props_layout.addWidget(self.edit_properties_btn)
        
        # Botón para subir mundo
        self.upload_world_btn = QPushButton("🌍 Subir Nuevo Mundo")
        self.upload_world_btn.setMinimumHeight(40)
        self.upload_world_btn.setStyleSheet("""
            QPushButton {
                background-color: #FF9800;
                color: white;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #F57C00;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.upload_world_btn.clicked.connect(self._upload_world)
        self.upload_world_btn.setEnabled(self._config_exists)
        edit_props_layout.addWidget(self.upload_world_btn)
        
        main_layout.addLayout(edit_props_layout)
        
        # === Sección de Logs ===
        logs_group = QGroupBox("Logs del Servidor")
        logs_layout = QVBoxLayout()
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(200)
        self.log_text.document().setMaximumBlockCount(500)  # Limitar a 500 líneas
        logs_layout.addWidget(self.log_text)
        
        logs_group.setLayout(logs_layout)
        main_layout.addWidget(logs_group)
        
        # === Sección de Consola de Comandos ===
        console_group = QGroupBox("Consola del Servidor")
        console_layout = QVBoxLayout()
        
        # Input de comando
        command_input_layout = QHBoxLayout()
        
        self.command_input = QLineEdit()
        self.command_input.setPlaceholderText("Escribe un comando del servidor (ej: say Hola, list, stop, help)...")
        self.command_input.setEnabled(False)  # Deshabilitado hasta que el servidor inicie
        self.command_input.returnPressed.connect(self._send_server_command)
        command_input_layout.addWidget(self.command_input)
        
        self.send_command_btn = QPushButton("📤 Enviar")
        self.send_command_btn.setEnabled(False)
        self.send_command_btn.setMinimumHeight(35)
        self.send_command_btn.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #0b7dda;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.send_command_btn.clicked.connect(self._send_server_command)
        command_input_layout.addWidget(self.send_command_btn)
        
        console_layout.addLayout(command_input_layout)
        
        # Botones rápidos de comandos comunes
        quick_commands_layout = QHBoxLayout()
        quick_commands_label = QLabel("Comandos rápidos:")
        quick_commands_label.setStyleSheet("font-weight: bold; color: #666;")
        quick_commands_layout.addWidget(quick_commands_label)
        
        # Botones de comandos comunes
        common_commands = [
            ("👥 List", "list"),
            ("💬 Say", "say "),
            ("🌙 Time Night", "time set night"),
            ("☀️ Time Day", "time set day"),
            ("☀️ Weather Clear", "weather clear"),
            ("🎮 Gamemode", "gamemode survival @a")
        ]
        
        for label, command in common_commands:
            btn = QPushButton(label)
            btn.setEnabled(False)
            btn.setProperty("command", command)
            btn.clicked.connect(lambda checked, cmd=command: self._quick_command(cmd))
            btn.setStyleSheet("""
                QPushButton {
                    background-color: #f0f0f0;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    padding: 5px 10px;
                }
                QPushButton:hover {
                    background-color: #e0e0e0;
                }
                QPushButton:disabled {
                    background-color: #f9f9f9;
                    color: #ccc;
                }
            """)
            quick_commands_layout.addWidget(btn)
            
            # Guardar referencia para habilitar/deshabilitar
            if not hasattr(self, 'quick_command_buttons'):
                self.quick_command_buttons = []
            self.quick_command_buttons.append(btn)
        
        quick_commands_layout.addStretch()
        console_layout.addLayout(quick_commands_layout)
        
        console_group.setLayout(console_layout)
        main_layout.addWidget(console_group)
        
        # Conectar output del servidor
        self.container.get_server_manager().set_output_callback(self._on_server_output)
    
    def _load_memory_config(self):
        """Carga la configuración de memoria desde config.json"""
        if not self._config_exists:
            self.memory_min_input.setText("1G")
            self.memory_max_input.setText("4G")
            return
        
        try:
            config = self.container.get_config_repository().load_config()
            server_config = config.get('server', {})
            
            memory_min = server_config.get('memory_min', '1G')
            memory_max = server_config.get('memory_max', '4G')
            
            self.memory_min_input.setText(memory_min)
            self.memory_max_input.setText(memory_max)
            
        except Exception as e:
            logger.error(f"Error al cargar configuración de memoria: {e}")
            self.memory_min_input.setText("1G")
            self.memory_max_input.setText("4G")
    
    def _auto_save_memory(self, field_type: str):
        """Guarda automáticamente la configuración de memoria cuando se detecta un valor válido"""
        if not self._config_exists:
            return
        
        # Obtener el valor del campo que cambió
        if field_type == 'min':
            value = self.memory_min_input.text().strip()
        else:
            value = self.memory_max_input.text().strip()
        
        # Validar formato
        if not value:
            return
        
        # Validar que termine en G o M
        if not value[-1].upper() in ['G', 'M']:
            return
        
        # Validar que el resto sean números
        try:
            int(value[:-1])
        except ValueError:
            return
        
        # Si llegamos aquí, el formato es válido, guardar
        try:
            config = self.container.get_config_repository().load_config()
            
            if 'server' not in config:
                config['server'] = {}
            
            # Actualizar el valor correspondiente
            if field_type == 'min':
                config['server']['memory_min'] = value
            else:
                config['server']['memory_max'] = value
            
            # Guardar configuración
            if self.container.get_config_repository().save_config(config):
                field_name = "mínima" if field_type == 'min' else "máxima"
                self._log(f"💾 RAM {field_name} actualizada: {value}")
            
        except Exception as e:
            logger.error(f"Error al guardar configuración de memoria: {e}")
    
    def _init_system_tray(self):
        """Inicializa el system tray"""
        self.tray_icon = QSystemTrayIcon(self)
        # self.tray_icon.setIcon(QIcon("icon.png"))  # Agregar icono
        
        # Menú del tray
        tray_menu = QMenu()
        
        restore_action = QAction("Restaurar", self)
        restore_action.triggered.connect(self.showNormal)
        tray_menu.addAction(restore_action)
        
        tray_menu.addSeparator()
        
        quit_action = QAction("Salir", self)
        quit_action.triggered.connect(self._quit_application)
        tray_menu.addAction(quit_action)
        
        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.activated.connect(self._tray_icon_activated)
        
        # No mostrar todavía, solo cuando se minimice
        # self.tray_icon.show()
    
    def _check_server_exists(self):
        """Verifica si existe un servidor (local o en R2)"""
        from pathlib import Path
        import asyncio
        
        # Verificar servidor local - buscar cualquier tipo de servidor
        server_dir = Path("./server")
        has_local_server = False
        
        if server_dir.exists():
            # Buscar archivos indicadores de servidor
            server_files = [
                server_dir / "server.jar",              # Vanilla
                server_dir / "fabric-server-launch.jar", # Fabric
                server_dir / "run.bat",                  # Forge moderno
                server_dir / "run.sh",                   # Forge moderno (Unix)
            ]
            
            # También buscar cualquier forge-*.jar
            forge_jars = list(server_dir.glob("forge-*.jar"))
            
            has_local_server = any(f.exists() for f in server_files) or len(forge_jars) > 0
            
            if has_local_server:
                logger.info("Servidor local detectado")
        
        # Si no hay servidor local y hay config, verificar R2
        has_remote_server = False
        if not has_local_server and self._config_exists:
            try:
                # Obtener configuración de R2 para construir la ruta correcta
                config_repo = self.container.get_config_repository()
                r2_config = config_repo.get_r2_config()
                
                if r2_config:
                    # Construir la ruta remota correcta
                    remote_path = f"cloudflare:{r2_config.bucket_name}/server_files"
                    
                    # Verificar si hay archivos en R2 (ejecutar corutina correctamente)
                    sync_service = self.container.get_sync_service()
                    loop = asyncio.get_event_loop()
                    has_remote_server = loop.run_until_complete(
                        sync_service.check_remote_exists(remote_path)
                    )
                    
                    if has_remote_server:
                        logger.info("Servidor remoto detectado en R2")
            except Exception as e:
                logger.warning(f"No se pudo verificar servidor remoto: {e}")
        
        # Si no hay servidor en ningún lado, mostrar botón de crear
        if not has_local_server and not has_remote_server:
            self._show_create_server_option()
    
    def _show_create_server_option(self):
        """Muestra la opción de crear un servidor nuevo o descargar desde R2"""
        # Buscar el status_group y agregar botón
        create_info = QLabel(
            "⚠️ No se detectó ningún servidor.\n"
            "Puedes crear uno nuevo o descargar uno existente desde R2."
        )
        create_info.setStyleSheet("""
            QLabel {
                background-color: #fff3cd;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                font-weight: bold;
            }
        """)
        create_info.setWordWrap(True)
        
        # Layout para botones
        buttons_layout = QHBoxLayout()
        
        create_button = QPushButton("🎮 Crear Nuevo Servidor")
        create_button.setMinimumHeight(50)
        create_button.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-size: 16px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        create_button.clicked.connect(self._open_create_server_dialog)
        create_button.setEnabled(self._config_exists)  # Solo habilitado si hay config
        buttons_layout.addWidget(create_button)
        
        download_button = QPushButton("☁️ Descargar desde R2")
        download_button.setMinimumHeight(50)
        download_button.setStyleSheet("""
            QPushButton {
                background-color: #2196F3;
                color: white;
                font-size: 16px;
                font-weight: bold;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #0b7dda;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        download_button.clicked.connect(self._download_server_from_r2)
        download_button.setEnabled(self._config_exists)  # Solo habilitado si hay config
        buttons_layout.addWidget(download_button)
        
        # Crear widget contenedor para los botones
        buttons_widget = QWidget()
        buttons_widget.setLayout(buttons_layout)
        
        # Mensaje adicional si no hay config
        if not self._config_exists:
            config_hint = QLabel(
                "💡 Configura R2 primero usando el botón '⚙️ Configurar R2' de arriba."
            )
            config_hint.setStyleSheet("""
                QLabel {
                    background-color: #e3f2fd;
                    color: #1976d2;
                    padding: 10px;
                    border-radius: 5px;
                    font-style: italic;
                }
            """)
            config_hint.setWordWrap(True)
        
        # Insertar después del status group
        layout = self.centralWidget().layout()
        layout.insertWidget(2, create_info)
        layout.insertWidget(3, buttons_widget)
        
        if not self._config_exists:
            layout.insertWidget(4, config_hint)
    
    def _open_create_server_dialog(self):
        """Abre el diálogo para crear un nuevo servidor"""
        if not self._config_exists:
            QMessageBox.warning(
                self,
                "Configuración requerida",
                "Debes configurar R2 primero antes de crear un servidor.\n\n"
                "Haz clic en '⚙️ Configurar R2' para empezar."
            )
            return
        
        dialog = CreateServerDialog(self)
        if dialog.exec():
            # Servidor creado, recargar UI
            self._log("✅ Servidor creado exitosamente")
            QMessageBox.information(
                self,
                "Reinicio necesario",
                "El servidor ha sido creado. Por favor reinicia la aplicación."
            )
            self._quit_application()
    
    def _download_server_from_r2(self):
        """Descarga el servidor existente desde R2"""
        if not self._config_exists:
            QMessageBox.warning(
                self,
                "Configuración requerida",
                "Debes configurar R2 primero.\n\n"
                "Haz clic en '⚙️ Configurar R2' para empezar."
            )
            return
        
        try:
            # Confirmar descarga
            reply = QMessageBox.question(
                self,
                "Descargar desde R2",
                "¿Deseas descargar el servidor existente desde R2?\n\n"
                "Esto puede tardar varios minutos dependiendo del tamaño.\n"
                "También se instalará Java automáticamente si es necesario.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            
            if reply != QMessageBox.StandardButton.Yes:
                return
            
            # Obtener configuración
            config_repo = self.container.get_config_repository()
            r2_config = config_repo.get_r2_config()
            
            if not r2_config or not r2_config.validate():
                QMessageBox.warning(
                    self,
                    "Configuración inválida",
                    "La configuración de R2 es inválida. Por favor reconfigura."
                )
                return
            
            # Crear directorio del servidor
            from pathlib import Path
            server_path = Path("./server")
            server_path.mkdir(parents=True, exist_ok=True)
            
            # Mostrar progreso
            from PySide6.QtWidgets import QProgressDialog
            progress = QProgressDialog(
                "Descargando servidor desde R2...",
                "Cancelar",
                0, 0,
                self
            )
            progress.setWindowModality(Qt.WindowModality.WindowModal)
            progress.setMinimumDuration(0)
            progress.setCancelButton(None)
            progress.show()
            
            # Descargar
            import asyncio
            sync_service = self.container.get_sync_service()
            remote_path = f"cloudflare:{r2_config.bucket_name}/server_files"
            
            loop = asyncio.get_event_loop()
            success = loop.run_until_complete(
                sync_service.sync_download(
                    remote_path,
                    server_path,
                    None  # Sin callback de progreso
                )
            )
            
            if not success:
                progress.close()
                QMessageBox.critical(
                    self,
                    "Error",
                    "No se pudo descargar el servidor desde R2.\n"
                    "Verifica la configuración y la conexión."
                )
                return
            
            progress.setLabelText("Verificando Java...")
            
            # Verificar e instalar Java si es necesario
            from src.infrastructure.java_installer import JavaInstaller
            java_installer = JavaInstaller()
            
            def java_progress(percentage, message):
                progress.setLabelText(message)
                from PySide6.QtWidgets import QApplication
                QApplication.processEvents()
            
            java_success, java_message = java_installer.ensure_compatible_version(
                server_path,
                progress_callback=java_progress
            )
            
            progress.close()
            
            if java_success:
                QMessageBox.information(
                    self,
                    "Descarga completada",
                    f"El servidor se descargó correctamente.\n\n"
                    f"Java: {java_message}\n\n"
                    f"Por favor reinicia la aplicación."
                )
                self._quit_application()
            else:
                QMessageBox.warning(
                    self,
                    "Advertencia",
                    f"El servidor se descargó pero hubo un problema con Java:\n{java_message}\n\n"
                    f"Puedes instalar Java manualmente.\n\n"
                    f"Reinicia la aplicación para continuar."
                )
                self._quit_application()
                
        except Exception as e:
            logger.error(f"Error al descargar servidor: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"Error al descargar servidor:\n{str(e)}"
            )
    
    def _load_network_interfaces(self):
        """Carga las interfaces de red disponibles"""
        try:
            use_case = self.container.get_network_interfaces_use_case()
            interfaces = use_case.execute()
            
            self.network_combo.clear()
            
            for iface in interfaces:
                self.network_combo.addItem(str(iface), iface.ip_address)
            
            if not interfaces:
                self.network_combo.addItem("No hay interfaces disponibles", "")
            
        except Exception as e:
            logger.error(f"Error al cargar interfaces de red: {e}")
            self.network_combo.addItem("Error al cargar interfaces", "")
    
    def _check_server_status(self):
        """Verifica el estado del servidor"""
        if not self._prerequisites_ok:
            return
        
        # Si ya hay un worker verificando, no crear otro
        if self.status_check_worker is not None and self.status_check_worker.isRunning():
            return
        
        self.status_check_worker = CheckStatusWorker(self.container.get_check_status_use_case())
        self.status_check_worker.finished.connect(self._on_status_checked)
        self.status_check_worker.finished.connect(self._cleanup_status_worker)
        self.status_check_worker.start()
    
    def _cleanup_status_worker(self):
        """Limpia el worker de verificación de estado"""
        if self.status_check_worker is not None:
            self.status_check_worker.wait(100)  # Esperar máximo 100ms
            self.status_check_worker = None
    
    def _on_status_checked(self, available: bool, lock_info):
        """Callback cuando se verifica el estado"""
        if available:
            self.status_label.setText("✅ SERVIDOR DISPONIBLE")
            self.status_label.setStyleSheet(
                "font-size: 16px; font-weight: bold; padding: 10px; color: green;"
            )
            self.status_detail_label.setText("El servidor está disponible para usar")
            
            # Habilitar inicio solo si no estamos ejecutando
            is_running = self.container.get_server_manager().is_running()
            self.start_button.setEnabled(not is_running)
            self.stop_button.setEnabled(is_running)
        else:
            owner = lock_info.owner_name if lock_info else "Desconocido"
            self.status_label.setText(f"🔴 SERVIDOR EN USO")
            self.status_label.setStyleSheet(
                "font-size: 16px; font-weight: bold; padding: 10px; color: red;"
            )
            self.status_detail_label.setText(f"Servidor bloqueado por: {owner}")
            
            # Deshabilitar inicio si no somos nosotros
            config = self.container.get_config_repository().load_config()
            our_name = config.get('app', {}).get('owner_name', 'Player1')
            
            if owner == our_name:
                # Somos nosotros, permitir detener
                self.start_button.setEnabled(False)
                self.stop_button.setEnabled(True)
            else:
                # Es otro, bloquear todo
                self.start_button.setEnabled(False)
                self.stop_button.setEnabled(False)
    
    def _start_server(self):
        """Inicia el servidor"""
        if self.current_worker is not None:
            return
        
        # Obtener configuración
        config = self.container.get_config_repository().load_config()
        owner_name = config.get('app', {}).get('owner_name', 'Player1')
        
        # Obtener IP seleccionada
        selected_ip = self.network_combo.currentData()
        if not selected_ip:
            self._log("❌ Debe seleccionar una interfaz de red válida")
            return
        
        # Deshabilitar controles
        self.start_button.setEnabled(False)
        self.network_combo.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.progress_detail_label.setVisible(True)
        
        # Crear worker
        self.current_worker = StartServerWorker(
            self.container.get_start_server_use_case(),
            owner_name,
            selected_ip
        )
        self.current_worker.progress_update.connect(self._on_progress_update)
        self.current_worker.finished.connect(self._on_start_finished)
        self.current_worker.start()
        
        self._log("🚀 Iniciando servidor...")
    
    def _stop_server(self):
        """Detiene el servidor"""
        if self.current_worker is not None:
            return
        
        # Deshabilitar controles
        self.stop_button.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.progress_detail_label.setVisible(True)
        
        # Crear worker
        self.current_worker = StopServerWorker(
            self.container.get_stop_server_use_case()
        )
        self.current_worker.progress_update.connect(self._on_progress_update)
        self.current_worker.finished.connect(self._on_stop_finished)
        self.current_worker.start()
        
        self._log("⏹️ Deteniendo servidor...")
    
    def _on_progress_update(self, message: str, progress: SyncProgress):
        """Callback de actualización de progreso"""
        self.progress_label.setText(message)
        
        percentage = progress.get_percentage()
        self.progress_bar.setValue(int(percentage))
        
        if progress.current_file:
            detail = f"Archivo: {progress.current_file}"
        elif progress.speed_mbps > 0:
            detail = f"Velocidad: {progress.speed_mbps:.2f} MB/s | ETA: {progress.eta_seconds}s"
        elif progress.transferred_files > 0:
            detail = f"Archivos: {progress.transferred_files}/{progress.total_files}"
        else:
            detail = ""
        
        self.progress_detail_label.setText(detail)
    
    def _on_start_finished(self, success: bool, message: str):
        """Callback cuando termina el inicio"""
        # Esperar a que el worker termine antes de limpiar
        if self.current_worker is not None:
            self.current_worker.wait(100)
            self.current_worker = None
        
        if success:
            self._log(f"✅ {message}")
            self.stop_button.setEnabled(True)
            self.start_button.setEnabled(False)
            
            # Habilitar consola de comandos
            self.command_input.setEnabled(True)
            self.send_command_btn.setEnabled(True)
            if hasattr(self, 'quick_command_buttons'):
                for btn in self.quick_command_buttons:
                    btn.setEnabled(True)
        else:
            self._log(f"❌ {message}")
            self.start_button.setEnabled(True)
            self.network_combo.setEnabled(True)
        
        self.progress_bar.setVisible(False)
        self.progress_detail_label.setVisible(False)
        self.progress_label.setText("Listo")
        
        self._check_server_status()
    
    def _on_stop_finished(self, success: bool, message: str):
        """Callback cuando termina la detención"""
        # Esperar a que el worker termine antes de limpiar
        if self.current_worker is not None:
            self.current_worker.wait(100)
            self.current_worker = None
        
        if success:
            self._log(f"✅ {message}")
            
            # Deshabilitar consola de comandos
            self.command_input.setEnabled(False)
            self.send_command_btn.setEnabled(False)
            if hasattr(self, 'quick_command_buttons'):
                for btn in self.quick_command_buttons:
                    btn.setEnabled(False)
            self._log(f"✅ {message}")
            self.start_button.setEnabled(True)
            self.stop_button.setEnabled(False)
            self.network_combo.setEnabled(True)
        else:
            self._log(f"❌ {message}")
            self.stop_button.setEnabled(True)
        
        self.progress_bar.setVisible(False)
        self.progress_detail_label.setVisible(False)
        self.progress_label.setText("Listo")
        
        self._check_server_status()
    
    def _on_server_output(self, line: str):
        """Callback para output del servidor (llamado desde thread del servidor)"""
        # No actualizar UI directamente desde otro thread, usar buffer
        with self._log_buffer_lock:
            self._log_buffer.append(line)
            # Si el buffer está muy lleno, eliminar mensajes antiguos
            if len(self._log_buffer) > self._max_buffer_size:
                self._log_buffer = self._log_buffer[-self._max_buffer_size:]
    
    def _send_server_command(self):
        """Envía un comando al servidor desde el input"""
        command = self.command_input.text().strip()
        
        if not command:
            return
        
        # Enviar comando
        server_manager = self.container.get_server_manager()
        if server_manager.send_command(command):
            self._log(f">>> {command}")
            self.command_input.clear()
        else:
            self._log(f"❌ No se pudo enviar el comando: {command}")
    
    def _quick_command(self, command: str):
        """Ejecuta un comando rápido o lo pone en el input"""
        if command.endswith(" "):
            # Si el comando termina en espacio, ponerlo en el input para que el usuario complete
            self.command_input.setText(command)
            self.command_input.setFocus()
        else:
            # Si es un comando completo, ejecutarlo directamente
            server_manager = self.container.get_server_manager()
            if server_manager.send_command(command):
                self._log(f">>> {command}")
            else:
                self._log(f"❌ No se pudo enviar el comando: {command}")
    
    def _log(self, message: str):
        """Agrega un mensaje al log"""
        self.log_text.append(message)
        logger.info(message)
    
    def _flush_log_buffer(self):
        """Procesa el buffer de logs y actualiza la UI (llamado desde timer de UI)"""
        with self._log_buffer_lock:
            if not self._log_buffer:
                return
            
            # Copiar y limpiar buffer
            messages = self._log_buffer[:]
            self._log_buffer.clear()
        
        # Actualizar UI con todos los mensajes en un solo batch
        if messages:
            # Usar setUpdatesEnabled para optimizar múltiples actualizaciones
            self.log_text.setUpdatesEnabled(False)
            try:
                for message in messages:
                    self.log_text.append(message)
            finally:
                self.log_text.setUpdatesEnabled(True)
    
    def _show_prerequisite_errors(self, errors: list[str]):
        """Muestra errores de prerequisitos"""
        self.status_label.setText("⚠️ ERROR DE CONFIGURACIÓN")
        self.status_label.setStyleSheet(
            "font-size: 16px; font-weight: bold; padding: 10px; color: red;"
        )
        self.status_detail_label.setText("\n".join(errors))
    
    def _tray_icon_activated(self, reason):
        """Callback cuando se activa el icono del tray"""
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self.showNormal()
            self.activateWindow()
    
    def changeEvent(self, event):
        """Override para manejar minimización"""
        if event.type() == event.Type.WindowStateChange:
            if self.isMinimized():
                # Minimizar al tray
                event.ignore()
                self.hide()
                self.tray_icon.show()
                self.tray_icon.showMessage(
                    "Minecraft Server Launcher",
                    "La aplicación sigue ejecutándose en segundo plano",
                    QSystemTrayIcon.MessageIcon.Information,
                    2000
                )
        super().changeEvent(event)
    
    def _quit_application(self):
        """Cierra la aplicación"""
        # Detener timer de verificación de estado
        if hasattr(self, 'status_timer'):
            self.status_timer.stop()
        
        # Esperar a que los workers terminen
        if self.status_check_worker is not None and self.status_check_worker.isRunning():
            self.status_check_worker.wait(1000)
        
        if self.current_worker is not None and self.current_worker.isRunning():
            self.current_worker.wait(1000)
        
        # Verificar si el servidor está corriendo
        if self.container.get_server_manager().is_running():
            self._log("⚠️ El servidor sigue en ejecución. Deteniéndolo antes de salir...")
            self._stop_server()
            # Esperar a que termine
            # Detener timer y esperar workers
            if hasattr(self, 'status_timer'):
                self.status_timer.stop()
            
            if self.status_check_worker is not None and self.status_check_worker.isRunning():
                self.status_check_worker.wait(1000)
            
            if self.current_worker is not None and self.current_worker.isRunning():
                self.current_worker.wait(1000)
            
            QTimer.singleShot(2000, sys.exit)
        else:
            sys.exit()
    
    def _open_config_dialog(self):
        """Abre el diálogo de configuración"""
        dialog = ConfigDialog(self)
        if dialog.exec():
            # Configuración guardada, reiniciar la aplicación
            QMessageBox.information(
                self,
                "Reinicio necesario",
                "Por favor reinicia la aplicación para aplicar los cambios."
            )
            self._quit_application()
    
    def _edit_properties(self):
        """Abre el diálogo para editar server.properties"""
        try:
            dialog = EditPropertiesDialog(self.container, self)
            dialog.exec()
        except Exception as e:
            logger.error(f"Error al abrir diálogo de propiedades: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"No se pudo abrir el editor de propiedades:\n{str(e)}"
            )
    
    def _release_lock_emergency(self):
        """Abre el diálogo de confirmación para liberar el lock de emergencia"""
        try:
            # Obtener el bucket name de la configuración
            config = self.container.get_config_repository().load_config()
            r2_config = config.get('r2', {})
            bucket_name = r2_config.get('bucket_name', '')
            
            if not bucket_name:
                QMessageBox.warning(
                    self,
                    "Error",
                    "No se pudo obtener el nombre del bucket desde la configuración."
                )
                return
            
            # Mostrar diálogo de confirmación
            dialog = ReleaseLockDialog(bucket_name, self)
            if dialog.exec():
                # Usuario confirmó, liberar el lock
                try:
                    lock_service = self.container.get_lock_service()
                    
                    # Intentar liberar el lock (es async, usar asyncio)
                    import asyncio
                    loop = asyncio.get_event_loop()
                    success = loop.run_until_complete(lock_service.release_lock())
                    
                    if success:
                        QMessageBox.information(
                            self,
                            "Lock Liberado",
                            "El lock del servidor ha sido liberado exitosamente.\n\n"
                            "Ahora puedes intentar iniciar el servidor nuevamente."
                        )
                        self._log("🔓 Lock liberado manualmente (emergencia)")
                        
                        # Actualizar estado del servidor
                        self._check_server_status()
                    else:
                        QMessageBox.information(
                            self,
                            "Sin Lock",
                            "No había ningún lock activo en el servidor.\n\n"
                            "El servidor ya está disponible para usar."
                        )
                        self._log("ℹ️ No había lock para liberar")
                        
                except Exception as e:
                    logger.error(f"Error al liberar lock: {e}")
                    QMessageBox.critical(
                        self,
                        "Error",
                        f"Error al liberar el lock:\n{str(e)}"
                    )
                    
        except Exception as e:
            logger.error(f"Error al preparar liberación de lock: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"Error al cargar configuración:\n{str(e)}"
            )
    
    def _upload_world(self):
        """Permite seleccionar y subir un mundo en formato .rar o .zip"""
        try:
            # Verificar que el servidor no esté corriendo
            server_manager = self.container.get_server_manager()
            if server_manager.is_running():
                QMessageBox.warning(
                    self,
                    "Servidor en ejecución",
                    "Debe detener el servidor antes de subir un nuevo mundo."
                )
                return
            
            # Abrir diálogo para seleccionar archivo
            file_path, _ = QFileDialog.getOpenFileName(
                self,
                "Seleccionar archivo de mundo",
                "",
                "Archivos ZIP (*.zip);;Todos los archivos (*.*)"
            )
            
            if not file_path:
                return  # Usuario canceló
            
            # Confirmar la acción
            result = QMessageBox.question(
                self,
                "Confirmar subida de mundo",
                f"¿Desea reemplazar el mundo actual con:\n{Path(file_path).name}?\n\n"
                "ADVERTENCIA: El mundo actual será eliminado y no se puede recuperar.",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            
            if result != QMessageBox.Yes:
                return
            
            # Deshabilitar botones durante la operación
            self.upload_world_btn.setEnabled(False)
            self.edit_properties_btn.setEnabled(False)
            self.start_button.setEnabled(False)
            self.stop_button.setEnabled(False)
            self.config_button.setEnabled(False)
            
            self._log("🌍 Iniciando subida de mundo...")
            
            # Limpiar worker anterior si existe
            if hasattr(self, 'upload_world_worker') and self.upload_world_worker:
                try:
                    self.upload_world_worker.finished.disconnect()
                    self.upload_world_worker.error.disconnect()
                    self.upload_world_worker.progress.disconnect()
                except:
                    pass
            
            # Crear worker para subir el mundo
            worker = UploadWorldWorker(file_path, self.container)
            worker.progress.connect(lambda msg: self._log(f"   {msg}"))
            worker.finished.connect(self._on_upload_world_finished)
            worker.error.connect(self._on_upload_world_error)
            
            self.upload_world_worker = worker
            worker.start()
            
        except Exception as e:
            logger.error(f"Error al subir mundo: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"Error al subir mundo:\n{str(e)}"
            )
    
    def _on_upload_world_finished(self):
        """Callback cuando termina la subida del mundo"""
        # Rehabilitar botones
        self.upload_world_btn.setEnabled(True)
        self.edit_properties_btn.setEnabled(True)
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(True)
        self.config_button.setEnabled(True)
        
        self._log("✅ Mundo subido exitosamente a R2")
        
        # Limpiar worker correctamente
        if self.upload_world_worker:
            self.upload_world_worker.wait()  # Esperar a que el thread termine
            self.upload_world_worker.deleteLater()
            self.upload_world_worker = None
        
        QMessageBox.information(
            self,
            "Mundo subido",
            "El mundo se ha subido exitosamente a R2.\n\n"
            "El servidor está listo para iniciar con el nuevo mundo."
        )
    
    def _on_upload_world_error(self, error: str):
        """Callback cuando hay un error al subir el mundo"""
        # Rehabilitar botones
        self.upload_world_btn.setEnabled(True)
        self.edit_properties_btn.setEnabled(True)
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(True)
        self.config_button.setEnabled(True)
        
        self._log(f"❌ Error al subir mundo: {error}")
        
        # Limpiar worker correctamente
        if self.upload_world_worker:
            self.upload_world_worker.wait()  # Esperar a que el thread termine
            self.upload_world_worker.deleteLater()
            self.upload_world_worker = None
        
        QMessageBox.critical(
            self,
            "Error",
            f"Error al subir el mundo:\n{error}"
        )
        self._log(f"❌ Error al subir mundo: {error}")
        self.upload_world_worker = None
    
    def closeEvent(self, event):
        """Override para manejar cierre"""
        if self.container.get_server_manager().is_running():
            # Minimizar en vez de cerrar si el servidor está corriendo
            event.ignore()
            self.showMinimized()
        else:
            event.accept()


class UploadWorldWorker(QThread):
    """Worker para subir un mundo al servidor"""
    progress = Signal(str)
    finished = Signal()
    error = Signal(str)
    
    def __init__(self, file_path: str, container: DependencyContainer):
        super().__init__()
        self.file_path = file_path
        self.container = container
    
    def run(self):
        """Ejecuta la subida del mundo"""
        finished_emitted = False
        try:
            file_path = Path(self.file_path)
            server_path = Path("./server")
            world_path = server_path / "world"
            
            # 1. Extraer el archivo a un directorio temporal
            self.progress.emit("Extrayendo archivo comprimido...")
            temp_dir = Path(tempfile.mkdtemp())
            
            try:
                if file_path.suffix.lower() != '.zip':
                    self.error.emit(
                        "Solo se soportan archivos .zip\n\n"
                        "Por favor, comprime tu mundo en formato ZIP."
                    )
                    return
                
                # Extraer archivo ZIP
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                
                # 2. Buscar la carpeta 'world' en el archivo extraído
                self.progress.emit("Buscando carpeta world...")
                world_folder = None
                
                # Buscar recursivamente la carpeta world
                for root, dirs, files in os.walk(temp_dir):
                    if 'world' in dirs:
                        world_folder = Path(root) / 'world'
                        break
                
                # Si no se encontró una carpeta world, verificar si el contenido del zip ES el mundo
                if not world_folder:
                    # Verificar si hay archivos característicos de un mundo de Minecraft
                    has_level_dat = (temp_dir / "level.dat").exists()
                    has_region = (temp_dir / "region").exists()
                    
                    if has_level_dat and has_region:
                        # El contenido del archivo ES el mundo directamente
                        world_folder = temp_dir
                    else:
                        self.error.emit(
                            "No se encontró una carpeta 'world' válida en el archivo.\n\n"
                            "El archivo debe contener:\n"
                            "- Una carpeta llamada 'world', o\n"
                            "- Los archivos del mundo directamente (level.dat, region/, etc.)"
                        )
                        return
                
                # 3. Eliminar el mundo actual
                self.progress.emit("Eliminando mundo actual...")
                if world_path.exists():
                    shutil.rmtree(world_path)
                
                # 4. Copiar el nuevo mundo
                self.progress.emit("Copiando nuevo mundo...")
                shutil.copytree(world_folder, world_path)
                
                # 5. Sincronizar con R2
                self.progress.emit("Sincronizando con R2...")
                config_repo = self.container.get_config_repository()
                r2_config = config_repo.get_r2_config()
                
                if r2_config:
                    sync_service = self.container.get_sync_service()
                    
                    # Construir remote_path usando la configuración R2
                    remote_name = "cloudflare"  # Nombre del remote en rclone.conf
                    remote_path = f"{remote_name}:{r2_config.bucket_name}/server_files"
                    
                    # sync_upload es async, ejecutarlo con asyncio sin progress_callback
                    # (el callback puede causar deadlocks en threads)
                    import asyncio
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        success = loop.run_until_complete(
                            sync_service.sync_upload(
                                local_path=server_path,
                                remote_path=remote_path,
                                progress_callback=None
                            )
                        )
                        if not success:
                            self.error.emit("Error al sincronizar con R2")
                            return
                    finally:
                        loop.close()
                
                self.progress.emit("¡Completado!")
                self.finished.emit()
                finished_emitted = True
                
            finally:
                # Limpiar directorio temporal
                if temp_dir.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)
                
        except Exception as e:
            logger.error(f"Error en UploadWorldWorker: {e}", exc_info=True)
            if not finished_emitted:
                self.error.emit(str(e))
