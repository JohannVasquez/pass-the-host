"""
Servicio para sincronizar datos de jugadores entre online/offline mode
"""
import json
import logging
import uuid
import shutil
import requests
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class PlayerDataSyncService:
    """Servicio para sincronizar datos de jugadores entre modos online/offline"""
    
    @staticmethod
    def get_offline_uuid(username: str) -> str:
        """
        Genera UUID offline basado en el username (mismo algoritmo que Minecraft)
        UUID offline = MD5("OfflinePlayer:" + username)
        """
        import hashlib
        
        # Minecraft usa MD5 hash de "OfflinePlayer:" + username
        data = f"OfflinePlayer:{username}".encode('utf-8')
        hash_digest = hashlib.md5(data).digest()
        
        # Convertir a UUID (versión 3)
        offline_uuid = uuid.UUID(bytes=hash_digest, version=3)
        return str(offline_uuid)
    
    @staticmethod
    def parse_uuid_from_filename(filename: str) -> Optional[str]:
        """Extrae UUID de un nombre de archivo (sin extensión)"""
        try:
            # Remover extensión
            uuid_str = Path(filename).stem
            # Validar que es un UUID válido
            uuid.UUID(uuid_str)
            return uuid_str
        except (ValueError, AttributeError):
            return None
    
    def get_usernames_from_cache(self, server_path: Path) -> Dict[str, str]:
        """
        Obtiene mapeo de UUID a username desde usercache.json
        Returns: {uuid: username}
        """
        cache_file = server_path / "usercache.json"
        username_map = {}
        
        if not cache_file.exists():
            logger.warning(f"usercache.json no encontrado en {server_path}")
            return username_map
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            for entry in cache_data:
                if 'uuid' in entry and 'name' in entry:
                    # UUID en cache viene con guiones
                    username_map[entry['uuid']] = entry['name']
            
            logger.info(f"Cargados {len(username_map)} usuarios desde usercache.json")
            return username_map
            
        except Exception as e:
            logger.error(f"Error al leer usercache.json: {e}")
            return username_map
    
    def get_player_uuid_mappings(self, server_path: Path) -> Dict[str, Dict[str, str]]:
        """
        Crea mapeo completo de jugadores con sus UUIDs online y offline
        Returns: {username: {'online': uuid, 'offline': uuid}}
        """
        cache_file = server_path / "usercache.json"
        player_mappings = {}
        
        if not cache_file.exists():
            logger.warning(f"usercache.json no encontrado en {server_path}")
            return player_mappings
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            # Agrupar por username
            for entry in cache_data:
                if 'uuid' in entry and 'name' in entry:
                    username = entry['name']
                    uuid_str = entry['uuid']
                    
                    # Inicializar si no existe
                    if username not in player_mappings:
                        player_mappings[username] = {'online': None, 'offline': None}
                    
                    # Calcular UUID offline esperado
                    expected_offline = self.get_offline_uuid(username)
                    
                    # Determinar si es online u offline comparando
                    if uuid_str == expected_offline:
                        player_mappings[username]['offline'] = uuid_str
                    else:
                        player_mappings[username]['online'] = uuid_str
            
            logger.info(f"Mapeados {len(player_mappings)} jugadores con sus UUIDs")
            return player_mappings
            
        except Exception as e:
            logger.error(f"Error al crear mapeo de jugadores: {e}")
            return player_mappings
    
    def get_online_uuid_from_mojang(self, username: str) -> Optional[str]:
        """
        Consulta la API de Mojang para obtener el UUID online de un jugador
        Returns: UUID con guiones o None si no existe/hay error
        """
        try:
            url = f"https://api.mojang.com/users/profiles/minecraft/{username}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                uuid_no_dashes = data.get('id')
                
                if uuid_no_dashes:
                    # Agregar guiones al UUID
                    uuid_with_dashes = f"{uuid_no_dashes[:8]}-{uuid_no_dashes[8:12]}-{uuid_no_dashes[12:16]}-{uuid_no_dashes[16:20]}-{uuid_no_dashes[20:]}"
                    logger.info(f"UUID online de {username}: {uuid_with_dashes}")
                    return uuid_with_dashes
            elif response.status_code == 404:
                logger.warning(f"Jugador {username} no existe en Mojang (no es cuenta premium)")
                return None
            else:
                logger.error(f"Error al consultar Mojang API: {response.status_code}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Error de conexión con Mojang API: {e}")
            return None
        except Exception as e:
            logger.error(f"Error al obtener UUID de Mojang: {e}")
            return None
    
    def fetch_missing_online_uuids(
        self, 
        player_mappings: Dict[str, Dict[str, str]]
    ) -> Tuple[Dict[str, Dict[str, str]], List[str]]:
        """
        Consulta la API de Mojang para jugadores que solo tienen UUID offline
        Returns: (player_mappings actualizado, lista de jugadores sin cuenta premium)
        """
        non_premium_players = []
        updated_mappings = player_mappings.copy()
        
        for username, uuids in player_mappings.items():
            # Si no tiene UUID online, intentar obtenerlo de Mojang
            if not uuids.get('online'):
                logger.info(f"Consultando UUID online para {username}...")
                online_uuid = self.get_online_uuid_from_mojang(username)
                
                if online_uuid:
                    updated_mappings[username]['online'] = online_uuid
                    logger.info(f"UUID online obtenido para {username}")
                else:
                    non_premium_players.append(username)
                    logger.warning(f"{username} no tiene cuenta premium de Minecraft")
        
        return updated_mappings, non_premium_players
    
    def sync_player_data(
        self, 
        server_path: Path,
        from_online_to_offline: bool,
        fetch_online_uuids: bool = True
    ) -> Dict[str, any]:
        """
        Sincroniza datos de jugadores al cambiar online-mode
        
        Args:
            server_path: Ruta al servidor de Minecraft
            from_online_to_offline: True si cambia de online a offline, False si es al revés
            fetch_online_uuids: Si True, consulta API de Mojang para UUIDs faltantes
        
        Returns:
            Dict con estadísticas de la sincronización
        """
        stats = {
            'total_players': 0,
            'synced_players': 0,
            'failed_players': 0,
            'files_copied': 0,
            'non_premium_players': [],
            'errors': []
        }
        
        try:
            # Obtener mapeo completo de jugadores
            player_mappings = self.get_player_uuid_mappings(server_path)
            
            if not player_mappings:
                stats['errors'].append("No se encontraron jugadores en usercache.json")
                return stats
            
            # Si vamos de offline a online, intentar obtener UUIDs online faltantes
            if not from_online_to_offline and fetch_online_uuids:
                logger.info("Consultando API de Mojang para UUIDs online faltantes...")
                player_mappings, non_premium = self.fetch_missing_online_uuids(player_mappings)
                stats['non_premium_players'] = non_premium
                
                if non_premium:
                    logger.warning(f"Jugadores sin cuenta premium: {', '.join(non_premium)}")
            
            stats['total_players'] = len(player_mappings)
            
            # Directorios de datos de jugadores
            world_path = server_path / "world"
            playerdata_dir = world_path / "playerdata"
            stats_dir = world_path / "stats"
            advancements_dir = world_path / "advancements"
            
            # Verificar que existen los directorios
            for dir_path in [playerdata_dir, stats_dir, advancements_dir]:
                if not dir_path.exists():
                    logger.warning(f"Directorio no encontrado: {dir_path}")
            
            # Procesar cada jugador
            for username, uuids in player_mappings.items():
                try:
                    if from_online_to_offline:
                        # De online a offline
                        source_uuid = uuids.get('online')
                        target_uuid = uuids.get('offline')
                        
                        if not source_uuid:
                            stats['errors'].append(f"{username}: No tiene UUID online en cache")
                            continue
                        
                        # Si no está el offline en cache, calcularlo
                        if not target_uuid:
                            target_uuid = self.get_offline_uuid(username)
                    else:
                        # De offline a online
                        source_uuid = uuids.get('offline')
                        target_uuid = uuids.get('online')
                        
                        if not source_uuid:
                            # Calcular UUID offline si no está en cache
                            source_uuid = self.get_offline_uuid(username)
                        
                        if not target_uuid:
                            stats['errors'].append(
                                f"{username}: No tiene UUID online en cache. "
                                "El jugador debe conectarse una vez en modo online primero."
                            )
                            continue
                    
                    # Remover guiones para nombres de archivo
                    source_uuid_file = source_uuid.replace('-', '')
                    target_uuid_file = target_uuid.replace('-', '')
                    
                    logger.info(f"Sincronizando {username}: {source_uuid_file} -> {target_uuid_file}")
                    
                    copied = self._copy_player_files(
                        playerdata_dir,
                        stats_dir,
                        advancements_dir,
                        source_uuid_file,
                        target_uuid_file,
                        username
                    )
                    
                    if copied > 0:
                        stats['synced_players'] += 1
                        stats['files_copied'] += copied
                    else:
                        stats['errors'].append(f"{username}: No se encontraron archivos para copiar")
                    
                except Exception as e:
                    logger.error(f"Error al sincronizar datos de {username}: {e}")
                    stats['failed_players'] += 1
                    stats['errors'].append(f"{username}: {str(e)}")
            
            logger.info(f"Sincronización completada: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Error en sincronización de jugadores: {e}")
            stats['errors'].append(f"Error general: {str(e)}")
            return stats
    
    def _copy_player_files(
        self,
        playerdata_dir: Path,
        stats_dir: Path,
        advancements_dir: Path,
        source_uuid: str,
        target_uuid: str,
        username: str
    ) -> int:
        """
        Copia archivos de un UUID a otro
        Returns: número de archivos copiados
        """
        files_copied = 0
        
        # Mapa de directorios y extensiones
        file_mappings = [
            (playerdata_dir, '.dat'),
            (stats_dir, '.json'),
            (advancements_dir, '.json')
        ]
        
        for directory, extension in file_mappings:
            if not directory.exists():
                continue
            
            source_file = directory / f"{source_uuid}{extension}"
            target_file = directory / f"{target_uuid}{extension}"
            
            if source_file.exists():
                try:
                    # Crear backup del archivo destino si existe
                    if target_file.exists():
                        backup_file = directory / f"{target_uuid}{extension}.backup"
                        shutil.copy2(target_file, backup_file)
                        logger.info(f"Backup creado: {backup_file.name}")
                    
                    # Copiar archivo
                    shutil.copy2(source_file, target_file)
                    logger.info(f"Copiado {source_file.name} -> {target_file.name}")
                    files_copied += 1
                    
                except Exception as e:
                    logger.error(f"Error al copiar {source_file.name}: {e}")
        
        if files_copied > 0:
            logger.info(f"Usuario {username}: {files_copied} archivos copiados")
        
        return files_copied
