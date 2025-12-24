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


def ensure_java_before_startup(app: QApplication) -> bool:
    """
    Verifica e instala Java si es necesario antes de iniciar la app
    Muestra diálogo de progreso al usuario
    
    Returns: True si está disponible o se instaló, False si falló críticamente
    """
    from pathlib import Path
    from src.infrastructure.java_installer import JavaInstaller
    import json
    
    # Verificar si existe config.json
    config_path = Path('config.json')
    if not config_path.exists():
        return True  # No hay config aún, se configurará después
    
    try:
        # Leer configuración
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        java_path = Path(config.get('server', {}).get('java_path', './java_runtime/bin/java.exe'))
        server_path = Path(config.get('server', {}).get('server_path', './server'))
        
        # Si Java ya existe, no hacer nada
        if java_path.exists():
            return True
        
        # Si no hay servidor, no instalar Java aún
        if not server_path.exists():
            return True
        
        # Crear diálogo de progreso
        progress = QProgressDialog(
            "Instalando Java...\nEsto puede tardar unos minutos.",
            "Cancelar",
            0, 100,
            None
        )
        progress.setWindowTitle("Instalando Java Runtime")
        progress.setWindowModality(Qt.WindowModality.ApplicationModal)
        progress.setMinimumDuration(0)
        progress.setCancelButton(None)
        progress.show()
        
        # Callback de progreso
        def update_progress(percentage: int, message: str):
            progress.setValue(percentage)
            progress.setLabelText(f"{message}")
            app.processEvents()
        
        # Instalar Java
        java_installer = JavaInstaller()
        success, message = java_installer.ensure_compatible_version(
            server_path,
            progress_callback=update_progress
        )
        
        progress.close()
        
        if not success:
            QMessageBox.warning(
                None,
                "Error al instalar Java",
                f"No se pudo instalar Java automáticamente:\n{message}\n\n"
                f"La aplicación continuará, pero deberás instalar Java manualmente."
            )
            # Permitir continuar aunque falle
            return True
        else:
            QMessageBox.information(
                None,
                "Java Instalado",
                f"{message}\n\nLa aplicación se iniciará ahora."
            )
        
        return True
        
    except Exception as e:
        QMessageBox.warning(
            None,
            "Error",
            f"Error al verificar Java:\n{str(e)}\n\nLa aplicación continuará."
        )
        return True


def main():
    """Punto de entrada principal de la aplicación"""
    app = QApplication(sys.argv)
    app.setApplicationName("Pass the host!")
    app.setOrganizationName("Johannsonmanson")
    
    # Verificar/instalar Rclone antes de continuar
    if not ensure_rclone_before_startup(app):
        return 1
    
    # Verificar/instalar Java si es necesario
    ensure_java_before_startup(app)
    
    # Inicializar contenedor de dependencias
    container = DependencyContainer()
    
    # Crear y mostrar ventana principal
    window = MainWindow(container)
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
