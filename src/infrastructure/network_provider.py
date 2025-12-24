"""
Implementación del Network Provider
Obtiene información de interfaces de red
"""
import socket
import logging
from typing import Optional
import psutil

from src.domain.interfaces.services import INetworkProvider
from src.domain.entities.server_entities import NetworkInterface

logger = logging.getLogger(__name__)


class NetworkProvider(INetworkProvider):
    """Proveedor de información de red usando psutil"""
    
    def get_network_interfaces(self) -> list[NetworkInterface]:
        """Obtiene todas las interfaces de red disponibles"""
        interfaces = []
        
        try:
            # Obtener todas las interfaces de red
            addrs = psutil.net_if_addrs()
            stats = psutil.net_if_stats()
            
            for interface_name, addr_list in addrs.items():
                for addr in addr_list:
                    # Solo IPv4
                    if addr.family == socket.AF_INET:
                        # Verificar si está activa
                        is_active = interface_name in stats and stats[interface_name].isup
                        
                        # Filtrar localhost
                        if addr.address != '127.0.0.1':
                            interfaces.append(NetworkInterface(
                                name=interface_name,
                                ip_address=addr.address,
                                description=f"{interface_name} - {addr.address}",
                                is_active=is_active
                            ))
            
            logger.info(f"Se encontraron {len(interfaces)} interfaces de red")
            return interfaces
            
        except Exception as e:
            logger.error(f"Error al obtener interfaces de red: {e}")
            return []
    
    def get_default_interface(self) -> Optional[NetworkInterface]:
        """Obtiene la interfaz de red predeterminada"""
        interfaces = self.get_network_interfaces()
        
        # Filtrar solo interfaces activas
        active_interfaces = [iface for iface in interfaces if iface.is_active]
        
        if not active_interfaces:
            return None
        
        # Preferir interfaces que no sean virtuales (Hamachi, RadminVPN suelen tener "hamachi", "radmin" en el nombre)
        vpn_keywords = ['hamachi', 'radmin', 'vpn', 'virtual', 'tap', 'tun']
        physical_interfaces = [
            iface for iface in active_interfaces
            if not any(keyword in iface.name.lower() for keyword in vpn_keywords)
        ]
        
        # Si hay interfaces físicas, usar la primera
        if physical_interfaces:
            return physical_interfaces[0]
        
        # Si no, usar la primera activa
        return active_interfaces[0]
