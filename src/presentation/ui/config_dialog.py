"""
Diálogo de configuración de Cloudflare R2
"""
import json
import logging
from pathlib import Path
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QFormLayout, QLineEdit, 
    QPushButton, QMessageBox, QLabel
)
from PySide6.QtCore import Qt

logger = logging.getLogger(__name__)


class ConfigDialog(QDialog):
    """Diálogo para configurar las credenciales de R2 y otros ajustes"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Configuración de Cloudflare R2")
        self.setModal(True)
        self.setMinimumWidth(500)
        
        self._setup_ui()
        self._load_existing_config()
    
    def _setup_ui(self):
        """Configura la interfaz del diálogo"""
        layout = QVBoxLayout(self)
        
        # Título y descripción
        title = QLabel("<h2>Configuración de Cloudflare R2</h2>")
        description = QLabel(
            "Ingresa tus credenciales de Cloudflare R2 para sincronizar "
            "el servidor entre múltiples dispositivos."
        )
        description.setWordWrap(True)
        layout.addWidget(title)
        layout.addWidget(description)
        layout.addSpacing(10)
        
        # Formulario de configuración R2
        form_layout = QFormLayout()
        
        # Campos R2
        self.endpoint_input = QLineEdit()
        self.endpoint_input.setPlaceholderText("https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com")
        form_layout.addRow("Endpoint:", self.endpoint_input)
        
        self.access_key_input = QLineEdit()
        self.access_key_input.setPlaceholderText("Tu R2 Access Key")
        form_layout.addRow("Access Key:", self.access_key_input)
        
        self.secret_key_input = QLineEdit()
        self.secret_key_input.setPlaceholderText("Tu R2 Secret Key")
        self.secret_key_input.setEchoMode(QLineEdit.Password)
        form_layout.addRow("Secret Key:", self.secret_key_input)
        
        self.bucket_name_input = QLineEdit()
        self.bucket_name_input.setPlaceholderText("nombre-del-bucket")
        form_layout.addRow("Bucket Name:", self.bucket_name_input)
        
        layout.addLayout(form_layout)
        layout.addSpacing(10)
        
        # Formulario de configuración del servidor
        server_form = QFormLayout()
        
        self.owner_name_input = QLineEdit()
        self.owner_name_input.setPlaceholderText("Tu nombre")
        server_form.addRow("Nombre del dueño:", self.owner_name_input)
        
        # Tipo de servidor
        self.server_type_combo = QComboBox()
        self.server_type_combo.addItems(["Vanilla", "Fabric", "Forge"])
        self.server_type_combo.setToolTip(
            "Vanilla: Servidor oficial de Minecraft sin mods\n"
            "Fabric: Servidor modded con Fabric Loader\n"
            "Forge: Servidor modded con Forge Mod Loader"
        )
        server_form.addRow("Tipo de servidor:", self.server_type_combo)
        
        self.memory_min_input = QLineEdit()
        self.memory_min_input.setPlaceholderText("1G")
        self.memory_min_input.setText("1G")
        server_form.addRow("Memoria mínima:", self.memory_min_input)
        
        self.memory_max_input = QLineEdit()
        self.memory_max_input.setPlaceholderText("4G")
        self.memory_max_input.setText("4G")
        server_form.addRow("Memoria máxima:", self.memory_max_input)
        
        layout.addLayout(server_form)
        layout.addSpacing(20)
        
        # Botones
        self.save_button = QPushButton("Guardar Configuración")
        self.save_button.clicked.connect(self._save_config)
        
        cancel_button = QPushButton("Cancelar")
        cancel_button.clicked.connect(self.reject)
        
        buttons_layout = QVBoxLayout()
        buttons_layout.addWidget(self.save_button)
        buttons_layout.addWidget(cancel_button)
        layout.addLayout(buttons_layout)
    
    def _load_existing_config(self):
        """Carga configuración existente si está disponible"""
        config_path = Path("config.json")
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                # Cargar valores R2
                r2_config = config.get('r2', {})
                self.endpoint_input.setText(r2_config.get('endpoint', ''))
                self.access_key_input.setText(r2_config.get('access_key', ''))
                self.secret_key_input.setText(r2_config.get('secret_key', ''))
                self.bucket_name_input.setText(r2_config.get('bucket_name', ''))
                
                # Cargar valores de app
                app_config = config.get('app', {})
                self.owner_name_input.setText(app_config.get('owner_name', ''))
                
                # Cargar valores de servidor
                server_config = config.get('server', {})
                self.memory_min_input.setText(server_config.get('memory_min', '1G'))
                self.memory_max_input.setText(server_config.get('memory_max', '4G'))
                
                # Cargar tipo de servidor
                server_type = server_config.get('server_type', 'vanilla').lower()
                if server_type == 'fabric':
                    self.server_type_combo.setCurrentText('Fabric')
                elif server_type == 'forge':
                    self.server_type_combo.setCurrentText('Forge')
                else:
                    self.server_type_combo.setCurrentText('Vanilla')
                
            except Exception as e:
                logger.warning(f"Error al cargar configuración existente: {e}")
    
    def _save_config(self):
        """Guarda la configuración en config.json"""
        # Validar campos requeridos
        if not self.endpoint_input.text().strip():
            QMessageBox.warning(self, "Error", "El endpoint es requerido")
            return
        
        if not self.access_key_input.text().strip():
            QMessageBox.warning(self, "Error", "El access key es requerido")
            return
        
        if not self.secret_key_input.text().strip():
            QMessageBox.warning(self, "Error", "El secret key es requerido")
            return
        
        if not self.bucket_name_input.text().strip():
            QMessageBox.warning(self, "Error", "El nombre del bucket es requerido")
            return
        
        if not self.owner_name_input.text().strip():
            QMessageBox.warning(self, "Error", "El nombre del dueño es requerido")
            return
        
        # Crear estructura de configuración
        config = {
            "r2": {
                "endpoint": self.endpoint_input.text().strip(),
                "access_key": self.access_key_input.text().strip(),
                "secret_key": self.secret_key_input.text().strip(),
                "bucket_name": self.bucket_name_input.text().strip(),
                "region": "auto"
            },
            "server": {
                "server_path": "./server",
                "java_path": "./java_runtime/bin/java.exe",
                "server_jar": "server.jar",
                "server_type": self.server_type_combo.currentText().lower(),
                "memory_min": self.memory_min_input.text().strip() or "1G",
                "memory_max": self.memory_max_input.text().strip() or "4G",
                "server_port": 25565
            },
            "app": {
                "owner_name": self.owner_name_input.text().strip(),
                "auto_sync_interval": 300
            }
        }
        
        try:
            # Guardar archivo config.json
            with open('config.json', 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)
            
            logger.info("Configuración guardada exitosamente")
            QMessageBox.information(
                self, 
                "Éxito", 
                "Configuración guardada correctamente.\n"
                "La aplicación se reiniciará para aplicar los cambios."
            )
            self.accept()
            
        except Exception as e:
            logger.error(f"Error al guardar configuración: {e}")
            QMessageBox.critical(
                self,
                "Error",
                f"No se pudo guardar la configuración:\n{str(e)}"
            )
