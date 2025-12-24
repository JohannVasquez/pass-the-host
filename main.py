"""
Pass the host! Launcher
Entry point de la aplicación
"""
import sys
from pathlib import Path
from PySide6.QtWidgets import QApplication, QProgressDialog, QMessageBox
from PySide6.QtCore import Qt

from src.presentation.ui.main_window import MainWindow
from src.presentation.di.container import DependencyContainer
from src.infrastructure.rclone_installer import RcloneInstaller


def ensure_rclone_before_startup(app: QApplication) -> bool:
    """
    Verifica e instala Rclone antes de iniciar la app
    Muestra diálogo de progreso al usuario
    
    Returns: True si está disponible, False si falló
    """
    installer = RcloneInstaller()
    
    if installer.is_installed():
        return True
    
    # Crear diálogo de progreso
    progress = QProgressDialog(
        "Descargando Rclone...\nEsto solo se hace la primera vez.",
        "Cancelar",
        0, 100,
        None
    )
    progress.setWindowTitle("Instalando componentes")
    progress.setWindowModality(Qt.WindowModality.ApplicationModal)
    progress.setMinimumDuration(0)
    progress.setCancelButton(None)  # No permitir cancelar
    progress.show()
    
    # Callback de progreso
    def update_progress(percentage: int, message: str):
        progress.setValue(percentage)
        progress.setLabelText(f"{message}\n\nEsto solo se hace la primera vez.")
        app.processEvents()  # Procesar eventos para actualizar UI
    
    # Instalar con callback
    success, message = installer.install(progress_callback=update_progress)
    
    progress.close()
    
    if not success:
        QMessageBox.critical(
            None,
            "Error al instalar Rclone",
            f"No se pudo descargar Rclone:\n{message}\n\n"
            f"La aplicación no puede continuar sin este componente."
        )
        return False
    
    return True


def main():
    """Punto de entrada principal de la aplicación"""
    app = QApplication(sys.argv)
    app.setApplicationName("Pass the host!")
    app.setOrganizationName("Johannsonmanson")
    
    # Verificar/instalar Rclone antes de continuar
    if not ensure_rclone_before_startup(app):
        return 1
    
    # Inicializar contenedor de dependencias
    container = DependencyContainer()
    
    # Crear y mostrar ventana principal
    window = MainWindow(container)
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
