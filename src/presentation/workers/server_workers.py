"""
Workers para ejecutar tareas en segundo plano
Evita bloquear la UI
"""
from PySide6.QtCore import QThread, Signal
from typing import Callable, Optional

from src.domain.entities.server_entities import SyncProgress


class StartServerWorker(QThread):
    """Worker para iniciar el servidor en segundo plano"""
    
    # Señales
    progress_update = Signal(str, SyncProgress)  # (mensaje, progreso)
    finished = Signal(bool, str)  # (éxito, mensaje)
    
    def __init__(
        self,
        start_server_use_case,
        owner_name: str,
        selected_ip: str
    ):
        super().__init__()
        self.use_case = start_server_use_case
        self.owner_name = owner_name
        self.selected_ip = selected_ip
    
    def run(self):
        """Ejecuta el caso de uso"""
        import asyncio
        
        def progress_callback(message: str, progress: SyncProgress):
            self.progress_update.emit(message, progress)
        
        # Crear event loop para asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            success, message = loop.run_until_complete(
                self.use_case.execute(
                    self.owner_name,
                    self.selected_ip,
                    progress_callback
                )
            )
            self.finished.emit(success, message)
        finally:
            loop.close()


class StopServerWorker(QThread):
    """Worker para detener el servidor en segundo plano"""
    
    # Señales
    progress_update = Signal(str, SyncProgress)
    finished = Signal(bool, str)
    
    def __init__(self, stop_server_use_case):
        super().__init__()
        self.use_case = stop_server_use_case
    
    def run(self):
        """Ejecuta el caso de uso"""
        import asyncio
        
        def progress_callback(message: str, progress: SyncProgress):
            self.progress_update.emit(message, progress)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            success, message = loop.run_until_complete(
                self.use_case.execute(progress_callback)
            )
            self.finished.emit(success, message)
        finally:
            loop.close()


class CheckStatusWorker(QThread):
    """Worker para verificar el estado del servidor"""
    
    # Señales
    finished = Signal(bool, object)  # (disponible, lock_info)
    
    def __init__(self, check_status_use_case):
        super().__init__()
        self.use_case = check_status_use_case
    
    def run(self):
        """Ejecuta el caso de uso"""
        import asyncio
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            available, lock_info = loop.run_until_complete(
                self.use_case.execute()
            )
            self.finished.emit(available, lock_info)
        finally:
            loop.close()
