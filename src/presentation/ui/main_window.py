"""
Ventana principal de la aplicación
"""
import sys
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QComboBox, QProgressBar,
    QTextEdit, QGroupBox, QSystemTrayIcon, QMenu, QMessageBox, QLineEdit
)
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QIcon, QAction
import logging
from pathlib import Path

from src.presentation.di.container import DependencyContainer
from src.presentation.ui.config_dialog import ConfigDialog
from src.presentation.ui.release_lock_dialog import ReleaseLockDialog
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
        
        # Configurar ventana
        self.setWindowTitle("Minecraft Distributed Server Launcher")
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
        
        # Timer para actualización periódica
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self._check_server_status)
        self.status_timer.start(30000)  # Cada 30 segundos
    
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
        
        # === Sección de Logs ===
        logs_group = QGroupBox("Logs del Servidor")
        logs_layout = QVBoxLayout()
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(200)
        logs_layout.addWidget(self.log_text)
        
        logs_group.setLayout(logs_layout)
        main_layout.addWidget(logs_group)
        
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
        """Callback para output del servidor"""
        self.log_text.append(line)
    
    def _log(self, message: str):
        """Agrega un mensaje al log"""
        self.log_text.append(message)
        logger.info(message)
    
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
    
    def closeEvent(self, event):
        """Override para manejar cierre"""
        if self.container.get_server_manager().is_running():
            # Minimizar en vez de cerrar si el servidor está corriendo
            event.ignore()
            self.showMinimized()
        else:
            event.accept()
