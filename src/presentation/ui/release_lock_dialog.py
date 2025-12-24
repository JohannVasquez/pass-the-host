"""
Diálogo de confirmación para liberar el lock del servidor
"""
import logging
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QLabel, QLineEdit, 
    QPushButton, QHBoxLayout
)
from PySide6.QtCore import Qt

logger = logging.getLogger(__name__)


class ReleaseLockDialog(QDialog):
    """Diálogo para confirmar la liberación del lock del servidor"""
    
    def __init__(self, bucket_name: str, parent=None):
        super().__init__(parent)
        self.bucket_name = bucket_name
        self.setWindowTitle("⚠️ Liberar Lock de Emergencia")
        self.setModal(True)
        self.setMinimumWidth(450)
        
        self._setup_ui()
    
    def _setup_ui(self):
        """Configura la interfaz del diálogo"""
        layout = QVBoxLayout(self)
        
        # Advertencia
        warning_label = QLabel(
            "<h3>⚠️ ADVERTENCIA: Acción de Emergencia</h3>"
        )
        warning_label.setStyleSheet("color: #d32f2f;")
        layout.addWidget(warning_label)
        
        # Descripción
        description = QLabel(
            "Esta acción liberará forzosamente el lock del servidor.<br><br>"
            "⚠️ Solo usa esto si:<br>"
            "• El servidor quedó bloqueado por error<br>"
            "• Estás seguro de que nadie más está usando el servidor<br>"
            "• La aplicación se cerró inesperadamente<br><br>"
            f"Para confirmar, escribe el nombre del bucket:<br><b>{self.bucket_name}</b>"
        )
        description.setTextFormat(Qt.TextFormat.RichText)
        description.setWordWrap(True)
        description.setStyleSheet("padding: 10px;")
        layout.addWidget(description)
        
        # Campo de confirmación
        self.confirmation_input = QLineEdit()
        self.confirmation_input.setPlaceholderText("Escribe el nombre del bucket aquí")
        self.confirmation_input.textChanged.connect(self._validate_input)
        layout.addWidget(self.confirmation_input)
        
        # Botones
        buttons_layout = QHBoxLayout()
        
        self.confirm_button = QPushButton("🔓 Liberar Lock")
        self.confirm_button.setEnabled(False)
        self.confirm_button.setStyleSheet("""
            QPushButton {
                background-color: #d32f2f;
                color: white;
                font-weight: bold;
                padding: 10px;
                border-radius: 5px;
            }
            QPushButton:hover:enabled {
                background-color: #b71c1c;
            }
            QPushButton:disabled {
                background-color: #cccccc;
                color: #666666;
            }
        """)
        self.confirm_button.clicked.connect(self.accept)
        buttons_layout.addWidget(self.confirm_button)
        
        cancel_button = QPushButton("Cancelar")
        cancel_button.setStyleSheet("""
            QPushButton {
                background-color: #666666;
                color: white;
                font-weight: bold;
                padding: 10px;
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: #555555;
            }
        """)
        cancel_button.clicked.connect(self.reject)
        buttons_layout.addWidget(cancel_button)
        
        layout.addLayout(buttons_layout)
    
    def _validate_input(self):
        """Valida que el texto ingresado coincida con el bucket name"""
        entered_text = self.confirmation_input.text().strip()
        self.confirm_button.setEnabled(entered_text == self.bucket_name)
