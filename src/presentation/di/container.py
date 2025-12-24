"""
Contenedor de Inyección de Dependencias
Inicializa y provee todas las dependencias de la aplicación
"""
import logging
from pathlib import Path

from src.domain.interfaces.services import (
    ILockService,
    ISyncService,
    IServerManager,
    INetworkProvider,
    IConfigRepository,
    IServerPropertiesManager
)
from src.domain.use_cases.server_use_cases import (
    StartServerUseCase,
    StopServerUseCase,
    CheckServerStatusUseCase,
    GetNetworkInterfacesUseCase
)
from src.infrastructure.r2_lock_service import R2LockService
from src.infrastructure.rclone_service import RcloneService
from src.infrastructure.rclone_installer import RcloneInstaller
from src.infrastructure.server_manager import MinecraftServerManager
from src.infrastructure.network_provider import NetworkProvider
from src.data.config_repository import JsonConfigRepository
from src.data.properties_manager import ServerPropertiesManager

logger = logging.getLogger(__name__)


class DependencyContainer:
    """Contenedor de dependencias de la aplicación"""
    
    def __init__(self):
        # Inicializar logging
        self._setup_logging()
        
        # Verificar/instalar Rclone si no está disponible
        self._ensure_rclone_installed()
        
        # Cargar configuración (puede no existir en primera ejecución)
        self._config_repository = JsonConfigRepository()
        try:
            config = self._config_repository.load_config()
            config_loaded = True
        except FileNotFoundError:
            logger.warning("Archivo config.json no encontrado. Se requiere configuración.")
            config = {}
            config_loaded = False
        
        # Verificar configuración R2
        r2_config = self._config_repository.get_r2_config() if config_loaded else None
        if not r2_config or not r2_config.validate():
            logger.warning("Configuración de R2 inválida o incompleta")
        
        # Inicializar servicios de infraestructura
        self._lock_service = R2LockService(r2_config) if r2_config and r2_config.validate() else None
        self._sync_service = RcloneService(r2_config=r2_config) if r2_config else None
        self._server_manager = MinecraftServerManager()
        self._network_provider = NetworkProvider()
        self._properties_manager = ServerPropertiesManager()
        
        # Inicializar casos de uso
        self._start_server_use_case = None
        self._stop_server_use_case = None
        self._check_status_use_case = None
        self._get_network_interfaces_use_case = None
    
    def _ensure_rclone_installed(self):
        """Verifica e instala Rclone si no está disponible"""
        try:
            installer = RcloneInstaller()
            if not installer.is_installed():
                logger.info("Rclone no encontrado, descargando automáticamente...")
                success, message = installer.install()
                if success:
                    logger.info("✅ Rclone instalado correctamente")
                else:
                    logger.error(f"❌ Error al instalar Rclone: {message}")
            else:
                logger.info("✅ Rclone ya está instalado")
        except Exception as e:
            logger.error(f"Error al verificar/instalar Rclone: {e}")
    
    def _setup_logging(self):
        """Configura el sistema de logging"""
        # Configurar encoding UTF-8 para soportar emojis
        file_handler = logging.FileHandler('app.log', encoding='utf-8')
        console_handler = logging.StreamHandler()
        
        # Formato
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        # Configurar root logger
        logging.basicConfig(
            level=logging.INFO,
            handlers=[file_handler, console_handler]
        )
    
    # Getters para servicios
    
    def get_lock_service(self) -> ILockService:
        """Obtiene el servicio de lock"""
        if self._lock_service is None:
            raise RuntimeError("Lock service no inicializado. Verifica la configuración de R2.")
        return self._lock_service
    
    def get_sync_service(self) -> ISyncService:
        """Obtiene el servicio de sincronización"""
        if self._sync_service is None:
            raise RuntimeError("Sync service no inicializado. Verifica la configuración de R2.")
        return self._sync_service
    
    def get_server_manager(self) -> IServerManager:
        """Obtiene el gestor del servidor"""
        return self._server_manager
    
    def get_network_provider(self) -> INetworkProvider:
        """Obtiene el proveedor de red"""
        return self._network_provider
    
    def get_config_repository(self) -> IConfigRepository:
        """Obtiene el repositorio de configuración"""
        return self._config_repository
    
    def get_properties_manager(self) -> IServerPropertiesManager:
        """Obtiene el gestor de properties"""
        return self._properties_manager
    
    # Getters para casos de uso
    
    def get_start_server_use_case(self) -> StartServerUseCase:
        """Obtiene el caso de uso de iniciar servidor"""
        if self._start_server_use_case is None:
            self._start_server_use_case = StartServerUseCase(
                lock_service=self.get_lock_service(),
                sync_service=self.get_sync_service(),
                server_manager=self.get_server_manager(),
                config_repo=self.get_config_repository(),
                properties_manager=self.get_properties_manager()
            )
        return self._start_server_use_case
    
    def get_stop_server_use_case(self) -> StopServerUseCase:
        """Obtiene el caso de uso de detener servidor"""
        if self._stop_server_use_case is None:
            self._stop_server_use_case = StopServerUseCase(
                lock_service=self.get_lock_service(),
                sync_service=self.get_sync_service(),
                server_manager=self.get_server_manager(),
                config_repo=self.get_config_repository()
            )
        return self._stop_server_use_case
    
    def get_check_status_use_case(self) -> CheckServerStatusUseCase:
        """Obtiene el caso de uso de verificar estado"""
        if self._check_status_use_case is None:
            self._check_status_use_case = CheckServerStatusUseCase(
                lock_service=self.get_lock_service()
            )
        return self._check_status_use_case
    
    def get_network_interfaces_use_case(self) -> GetNetworkInterfacesUseCase:
        """Obtiene el caso de uso de obtener interfaces de red"""
        if self._get_network_interfaces_use_case is None:
            self._get_network_interfaces_use_case = GetNetworkInterfacesUseCase(
                network_provider=self.get_network_provider()
            )
        return self._get_network_interfaces_use_case
    
    def verify_prerequisites(self) -> tuple[bool, list[str]]:
        """
        Verifica que se cumplan los prerequisitos
        Returns:
            (válido, lista_de_errores)
        """
        errors = []
        
        # Verificar que existe config.json
        if not Path('config.json').exists():
            errors.append("❌ Archivo config.json no encontrado. Configura R2 primero.")
            return False, errors
        
        # Verificar Java Runtime
        config = self._config_repository.load_config()
        java_path = Path(config.get('server', {}).get('java_path', './java_runtime/bin/java.exe'))
        
        if not java_path.parent.parent.exists():
            errors.append("❌ Carpeta 'java_runtime' no encontrada junto al ejecutable")
        elif not java_path.exists():
            errors.append("❌ Ejecutable de Java no encontrado en java_runtime")
        
        # Verificar Rclone
        rclone_path = Path('./rclone/rclone.exe')
        if not rclone_path.exists():
            # Intentar instalarlo automáticamente
            logger.info("Rclone no encontrado, intentando instalar...")
            try:
                installer = RcloneInstaller()
                success, message = installer.install()
                if not success:
                    errors.append(f"❌ Error al instalar Rclone: {message}")
            except Exception as e:
                errors.append(f"❌ Error al instalar Rclone: {str(e)}")
        
        # Verificar configuración R2
        r2_config = self._config_repository.get_r2_config()
        if not r2_config or not r2_config.validate():
            errors.append("❌ Configuración de R2 inválida o incompleta en config.json")
        
        return len(errors) == 0, errors
