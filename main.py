"""
Pass the host! Launcher
Entry point de la aplicación
"""
import sys
from pathlib import Path
from PySide6.QtWidgets import QApplication

from src.presentation.ui.main_window import MainWindow
from src.presentation.di.container import DependencyContainer


def main():
    """Punto de entrada principal de la aplicación"""
    app = QApplication(sys.argv)
    app.setApplicationName("Pass the host!")
    app.setOrganizationName("Johannsonmanson")
    
    # Inicializar contenedor de dependencias
    container = DependencyContainer()
    
    # Crear y mostrar ventana principal
    window = MainWindow(container)
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
