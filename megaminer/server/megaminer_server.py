#!/usr/bin/env python3
"""
Mega Miner NG - Persistent Hosted Multiplayer Server
=====================================================
A WebSocket-based dedicated server for Mega Miner NG that provides:
  - Account system (register/login with hashed passwords)
  - Persistent world storage (autosave)
  - Room/channel management
  - Map state synchronization for late-joining players
  - Full admin/gamemaster controls
  - Chat, trade, explosion, and tile update relay
"""

import asyncio
import json
import os
import sys
import time
import hashlib
import secrets
import uuid
import signal
import argparse
from datetime import datetime, timezone

try:
    import websockets
except ImportError:
    print("ERROR: websockets library not found. Install with: pip install websockets")
    sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

DEFAULT_CONFIG = {
    "server": {
        "host": "0.0.0.0",
        "port": 8765,
        "max_players_per_room": 50,
        "heartbeat_timeout": 15,
        "autosave_interval": 60,
        "log_level": "info"
    },
    "game": {
        "map_width": 1000,
        "map_height": 2000,
        "tile_size": 32,
        "speed_normal": 1.75,
        "speed_drill": 0.75,
        "fuel_consumption": 0.125,
        "max_fuel": 100,
        "max_hull": 100,
        "max_cargo": 50
    },
    "accounts": {
        "allow_registration": True,
        "min_username_length": 3,
        "max_username_length": 16,
        "min_password_length": 4
    },
    "paths": {
        "data_directory": "server_data",
        "worlds_directory": "server_data/worlds",
        "accounts_file": "server_data/accounts.json"
    }
}


def load_config(config_path="server_config.json"):
    """Load config from file or create default."""
    config = DEFAULT_CONFIG.copy()
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                user_config = json.load(f)
            # Deep merge
            for section, values in user_config.items():
                if section in config:
                    config[section].update(values)
                else:
                    config[section] = values
        except Exception as e:
            print(f"Warning: Could not load config: {e}")
    else:
        # Write default config
        try:
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=4)
            print(f"Created default config: {config_path}")
        except Exception as e:
            print(f"Warning: Could not write default config: {e}")
    return config


# ============================================================================
# DATA STORAGE
# ============================================================================

class AccountManager:
    """Handles user accounts with hashed passwords."""

    def __init__(self, accounts_path):
        self.accounts_path = accounts_path
        self.accounts = {}  # username -> { password_hash, salt, created_at, last_login, banned }
        self.sessions = {}  # token -> username
        self._ensure_directory()
        self._load()

    def _ensure_directory(self):
        directory = os.path.dirname(self.accounts_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)

    def _load(self):
        if os.path.exists(self.accounts_path):
            try:
                with open(self.accounts_path, 'r') as f:
                    self.accounts = json.load(f)
                print(f"Loaded {len(self.accounts)} accounts from {self.accounts_path}")
            except Exception as e:
                print(f"Warning: Could not load accounts: {e}")

    def _save(self):
        try:
            self._ensure_directory()
            with open(self.accounts_path, 'w') as f:
                json.dump(self.accounts, f, indent=2)
        except Exception as e:
            print(f"Error saving accounts: {e}")

    def _hash_password(self, password, salt=None):
        if salt is None:
            salt = secrets.token_hex(16)
        # Use SHA-256 with salt
        h = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
        return h, salt

    def register(self, username, password):
        """Register a new account. Returns (success, message)."""
        username = username.strip()
        if len(username) < DEFAULT_CONFIG['accounts']['min_username_length']:
            return False, f"Username must be at least {DEFAULT_CONFIG['accounts']['min_username_length']} characters"
        if len(username) > DEFAULT_CONFIG['accounts']['max_username_length']:
            return False, f"Username must be at most {DEFAULT_CONFIG['accounts']['max_username_length']} characters"
        if len(password) < DEFAULT_CONFIG['accounts']['min_password_length']:
            return False, f"Password must be at least {DEFAULT_CONFIG['accounts']['min_password_length']} characters"
        if username.lower() in [a.lower() for a in self.accounts]:
            return False, "Username already taken"
        if not username.isalnum() and '_' not in username:
            return False, "Username can only contain letters, numbers, and underscores"

        pw_hash, salt = self._hash_password(password)
        self.accounts[username] = {
            "password_hash": pw_hash,
            "salt": salt,
            "created_at": time.time(),
            "last_login": None,
            "banned": False
        }
        self._save()
        return True, "Account created successfully"

    def login(self, username, password):
        """Login and return a session token. Returns (success, message, token)."""
        username = username.strip()
        account = self.accounts.get(username)
        if not account:
            return False, "Invalid username or password", None
        if account.get("banned"):
            return False, "This account has been banned", None

        pw_hash, _ = self._hash_password(password, account["salt"])
        if pw_hash != account["password_hash"]:
            return False, "Invalid username or password", None

        token = secrets.token_hex(32)
        self.sessions[token] = username
        account["last_login"] = time.time()
        self._save()
        return True, "Login successful", token

    def validate_session(self, token):
        """Validate a session token. Returns username or None."""
        return self.sessions.get(token)

    def logout(self, token):
        """Remove a session token."""
        self.sessions.pop(token, None)

    def is_banned(self, username):
        account = self.accounts.get(username)
        return account and account.get("banned", False)

    def ban_user(self, username):
        account = self.accounts.get(username)
        if account:
            account["banned"] = True
            self._save()
            return True
        return False

    def unban_user(self, username):
        account = self.accounts.get(username)
        if account:
            account["banned"] = False
            self._save()
            return True
        return False


class WorldManager:
    """Handles persistent world data with autosaving."""

    def __init__(self, worlds_directory):
        self.worlds_directory = worlds_directory
        self.worlds = {}  # room_id -> { map, discovered, player_data, metadata }
        self._ensure_directory()

    def _ensure_directory(self):
        os.makedirs(self.worlds_directory, exist_ok=True)

    def _world_path(self, room_id):
        safe_name = "".join(c if c.isalnum() or c in '_-' else '_' for c in room_id)
        return os.path.join(self.worlds_directory, f"world_{safe_name}.json")

    def load_world(self, room_id):
        """Load a world from disk, or create a new one."""
        if room_id in self.worlds:
            return self.worlds[room_id]

        path = self._world_path(room_id)
        if os.path.exists(path):
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                self.worlds[room_id] = data
                print(f"Loaded world '{room_id}' ({len(data.get('map', []))} rows)")
                return data
            except Exception as e:
                print(f"Error loading world '{room_id}': {e}")

        # Create new world
        world = {
            "room_id": room_id,
            "created_at": time.time(),
            "last_save": time.time(),
            "map": [],
            "discovered": [],
            "player_data": {},  # username -> { money, drillTier, maxHull, maxFuel, etc }
            "banned_ids": [],
            "procedural_seed": abs(hash(room_id)) % (2**31)
        }
        self.worlds[room_id] = world
        self._generate_terrain(world)
        return world

    def _generate_terrain(self, world):
        """Generate procedural terrain matching the client's algorithm."""
        mw = DEFAULT_CONFIG['game']['map_width']
        mh = DEFAULT_CONFIG['game']['map_height']
        seed = world['procedural_seed']

        world['map'] = []
        world['discovered'] = []

        for y in range(mh):
            row = []
            disc_row = []
            for x in range(mw):
                if y < 5:
                    row.append(0)  # EMPTY
                    disc_row.append(1)
                elif y == 5:
                    row.append(2)  # GRASS
                    disc_row.append(1)
                elif y == mh - 1:
                    row.append(99)  # BEDROCK
                    disc_row.append(0)
                else:
                    tile = self._procedural_tile(x, y, seed)
                    row.append(tile)
                    disc_row.append(0)
            world['map'].append(row)
            world['discovered'].append(disc_row)

    def _procedural_tile(self, x, y, seed):
        """Match the client's getProceduralTile algorithm."""
        if y < 5:
            return 0  # EMPTY
        if y == 5:
            return 2  # GRASS
        if y >= DEFAULT_CONFIG['game']['map_height'] - 1:
            return 99  # BEDROCK

        # Determine base type
        if y > 300:
            base = 5  # DEEP_SLATE
        elif y > 100:
            base = 4  # HARD_STONE
        elif y > 30:
            base = 3  # STONE
        else:
            base = 1  # DIRT

        # Seeded random
        r = abs((hash((x * 12.9898 + y * 78.233 + seed)) % 10000) / 10000.0)

        if r > 0.985:
            ore_roll = abs((hash((x * 12.9898 + (y + 10000) * 78.233 + seed)) % 10000) / 10000.0)
            if y > 400 and ore_roll < 0.2:
                return 11  # RUBY
            elif y > 250 and ore_roll < 0.6:
                return 10  # EMERALD
            elif y > 150:
                return 9  # DIAMOND
        if r > 0.9999:
            return 67  # RICK
        if r > 0.96 and y > 100:
            return 8  # GOLD
        if r > 0.94 and y > 50:
            return 7  # IRON
        if r > 0.94:
            return 6  # COAL

        return base

    def save_world(self, room_id):
        """Save a world to disk."""
        world = self.worlds.get(room_id)
        if not world:
            return
        world['last_save'] = time.time()
        path = self._world_path(room_id)
        try:
            self._ensure_directory()
            with open(path, 'w') as f:
                json.dump(world, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving world '{room_id}': {e}")
            return False

    def update_tile(self, room_id, x, y, value):
        """Update a single tile in the map."""
        world = self.worlds.get(room_id)
        if not world:
            return False
        if y < 0 or y >= len(world['map']):
            return False
        if x < 0 or x >= len(world['map'][y]):
            return False
        world['map'][y][x] = value
        if y < len(world['discovered']) and x < len(world['discovered'][y]):
            world['discovered'][y][x] = 1
        return True

    def apply_diff(self, room_id, diffs):
        """Apply a batch of tile updates. diffs is a list of [x, y, value]."""
        world = self.worlds.get(room_id)
        if not world:
            return []
        failed = []
        for x, y, val in diffs:
            if 0 <= y < len(world['map']) and 0 <= x < len(world['map'][y]):
                world['map'][y][x] = val
                if y < len(world['discovered']) and x < len(world['discovered'][y]):
                    world['discovered'][y][x] = 1
            else:
                failed.append((x, y, val))
        return failed

    def get_area_diff(self, room_id, bx, by, bw, bh):
        """Get differences from base procedural for a region."""
        world = self.worlds.get(room_id)
        if not world:
            return []
        diffs = []
        seed = world['procedural_seed']
        for y in range(max(0, by), min(DEFAULT_CONFIG['game']['map_height'], by + bh)):
            for x in range(max(0, bx), min(DEFAULT_CONFIG['game']['map_width'], bx + bw)):
                if y < len(world['map']) and x < len(world['map'][y]):
                    current = world['map'][y][x]
                    base = self._procedural_tile(x, y, seed)
                    if current != base:
                        diffs.append([x, y, current])
        return diffs

    def save_all(self):
        """Save all loaded worlds."""
        for room_id in list(self.worlds.keys()):
            self.save_world(room_id)


# ============================================================================
# ROOM / CHANNEL MANAGER
# ============================================================================

class Room:
    """A game room containing connected players and world state."""

    def __init__(self, room_id, world_manager):
        self.room_id = room_id
        self.world = world_manager.load_world(room_id)
        self.world_manager = world_manager
        self.players = {}  # username -> PlayerState
        self.admin = None  # username of admin
        self.last_activity = time.time()
        self.next_autosave = time.time() + DEFAULT_CONFIG['server']['autosave_interval']

    @property
    def player_count(self):
        return len(self.players)


class PlayerState:
    """Represents a connected player's state."""

    def __init__(self, websocket, username, account_token=None):
        self.websocket = websocket
        self.username = username
        self.account_token = account_token
        self.player_id = str(uuid.uuid4())
        self.joined_at = time.time()
        self.last_heartbeat = time.time()

        # Game state - matches localPlayer on client
        self.grid_x = DEFAULT_CONFIG['game']['map_width'] // 2
        self.grid_y = 4
        self.x = self.grid_x * DEFAULT_CONFIG['game']['tile_size']
        self.y = self.grid_y * DEFAULT_CONFIG['game']['tile_size']
        self.fuel = DEFAULT_CONFIG['game']['max_fuel']
        self.max_fuel = DEFAULT_CONFIG['game']['max_fuel']
        self.hull = DEFAULT_CONFIG['game']['max_hull']
        self.max_hull = DEFAULT_CONFIG['game']['max_hull']
        self.cargo = 0
        self.max_cargo = DEFAULT_CONFIG['game']['max_cargo']
        self.money = 0
        self.rotation = 0
        self.is_drilling = False
        self.drill_tier = 0
        self.heat_resist = 0
        self.xray_range = 3
        self.multi_mine = 0
        self.inventory = {}
        self.color = '#3498db'
        self.selected_block = 20  # CASING
        self.stats = {"blocksMined": {}, "totalMined": 0, "startTime": time.time()}
        self.teleporters = []
        self.blueprints = []
        self.achievements = {}

    def to_dict(self):
        return {
            "id": self.player_id,
            "username": self.username,
            "color": self.color,
            "joinedAt": int(self.joined_at * 1000),
            "lastSeen": int(self.last_heartbeat * 1000)
        }

    def to_move_packet(self):
        return {
            "type": "move",
            "id": self.player_id,
            "username": self.username,
            "col": self.color,
            "joinedAt": int(self.joined_at * 1000),
            "sx": self.x,
            "sy": self.y,
            "tx": self.grid_x * DEFAULT_CONFIG['game']['tile_size'],
            "ty": self.grid_y * DEFAULT_CONFIG['game']['tile_size'],
            "gx": self.grid_x,
            "gy": self.grid_y,
            "r": self.rotation,
            "drill": self.is_drilling,
            "isAdmin": False  # Set by room
        }


# ============================================================================
# SERVER CLASS
# ============================================================================

class MegaMinerServer:
    """Main WebSocket server for Mega Miner NG."""

    def __init__(self, config_path="server_config.json"):
        self.config = load_config(config_path)
        self.accounts = AccountManager(self.config['paths']['accounts_file'])
        self.worlds = WorldManager(self.config['paths']['worlds_directory'])
        self.rooms = {}  # room_id -> Room
        self.player_rooms = {}  # username -> room_id
        self.shutdown_flag = False

    async def start(self):
        """Start the WebSocket server."""
        host = self.config['server']['host']
        port = self.config['server']['port']

        print(f"""
╔══════════════════════════════════════════════════════╗
║           Mega Miner NG - Dedicated Server           ║
╠══════════════════════════════════════════════════════╣
║  Version: 1.0.0                                      ║
║  WebSocket: ws://{host}:{port}                       ║
║  Max Players/Room: {self.config['server']['max_players_per_room']}                      ║
║  Autosave Interval: {self.config['server']['autosave_interval']}s                       ║
║  Data Directory: {self.config['paths']['data_directory']}/              ║
╚══════════════════════════════════════════════════════╝
        """)

        # Set up signal handlers for graceful shutdown
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                asyncio.get_event_loop().add_signal_handler(
                    sig, lambda: asyncio.create_task(self.shutdown())
                )
            except NotImplementedError:
                # Windows doesn't support add_signal_handler
                pass

        # Start autosave loop
        asyncio.create_task(self._autosave_loop())

        # Start the WebSocket server
        async with websockets.serve(
            self.handle_connection,
            host,
            port,
            ping_interval=20,
            ping_timeout=10,
            max_size=10 * 1024 * 1024  # 10MB max message
        ):
            print(f"Server listening on ws://{host}:{port}")
            await asyncio.Future()  # Run forever

    async def shutdown(self):
        """Graceful shutdown."""
        if self.shutdown_flag:
            return
        self.shutdown_flag = True
        print("\nShutting down...")

        # Save all worlds
        print("Saving worlds...")
        self.worlds.save_all()

        # Notify all players
        for room in self.rooms.values():
            for username, player in list(room.players.items()):
                try:
                    await self.send_to(player.websocket, {
                        "type": "server_shutdown",
                        "message": "Server is shutting down"
                    })
                    await player.websocket.close()
                except Exception:
                    pass

        print("Shutdown complete.")
        sys.exit(0)

    async def _autosave_loop(self):
        """Periodic autosave of worlds."""
        while not self.shutdown_flag:
            await asyncio.sleep(self.config['server']['autosave_interval'])
            self.worlds.save_all()
            saved = len(self.worlds.worlds)
            if saved > 0:
                print(f"[Autosave] Saved {saved} world(s)")

    async def send_to(self, websocket, data):
        """Send JSON data to a websocket."""
        if websocket.open:
            try:
                await websocket.send(json.dumps(data))
            except Exception:
                pass

    async def broadcast_to_room(self, room_id, data, exclude=None):
        """Send data to all players in a room."""
        room = self.rooms.get(room_id)
        if not room:
            return
        message = json.dumps(data)
        tasks = []
        for username, player in room.players.items():
            if username == exclude:
                continue
            if player.websocket.open:
                tasks.append(self.send_to(player.websocket, data))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_players(self, room_id):
        """Broadcast player list to all players in a room."""
        room = self.rooms.get(room_id)
        if not room:
            return
        # Send join packet for each existing player to new players
        # (This is handled during the join flow)

    # ========================================================================
    # CONNECTION HANDLER
    # ========================================================================

    async def handle_connection(self, websocket):
        """Handle a new WebSocket connection."""
        remote = websocket.remote_address
        print(f"[Connect] New connection from {remote}")

        # Temporary state until authenticated
        player = None
        room_id = None
        username = None

        try:
            async for raw_message in websocket:
                try:
                    message = json.loads(raw_message)
                except json.JSONDecodeError:
                    continue

                # Handle different message types
                msg_type = message.get("type")

                if msg_type == "register":
                    response = self.handle_register(message)
                    await self.send_to(websocket, response)

                elif msg_type == "login":
                    response = self.handle_login(message)
                    await self.send_to(websocket, response)
                    if response.get("success"):
                        # Player is now authenticated, wait for join
                        pass

                elif msg_type == "join":
                    # Player joins a room
                    result = await self.handle_join(websocket, message, remote)
                    if result:
                        player, room_id, username = result
                    else:
                        # Join failed, send error and close
                        await self.send_to(websocket, {
                            "type": "error",
                            "message": "Failed to join room"
                        })
                        break

                elif msg_type == "ping":
                    await self.send_to(websocket, {"type": "pong"})

                elif player is not None:
                    # Game messages - require being in a room
                    await self.handle_game_message(player, room_id, message)

                else:
                    await self.send_to(websocket, {
                        "type": "error",
                        "message": "Not authenticated. Please login or register first."
                    })

        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[Error] Connection error from {remote}: {e}")
        finally:
            # Cleanup on disconnect
            if username and room_id:
                await self.handle_disconnect(username, room_id)

    # ========================================================================
    # ACCOUNT HANDLING
    # ========================================================================

    def handle_register(self, message):
        username = message.get("username", "").strip()
        password = message.get("password", "")

        if not self.config['accounts']['allow_registration']:
            return {"type": "register_result", "success": False, "message": "Registration is disabled"}

        success, msg = self.accounts.register(username, password)
        return {"type": "register_result", "success": success, "message": msg}

    def handle_login(self, message):
        username = message.get("username", "").strip()
        password = message.get("password", "")

        success, msg, token = self.accounts.login(username, password)
        return {
            "type": "login_result",
            "success": success,
            "message": msg,
            "token": token,
            "username": username if success else None
        }

    # ========================================================================
    # ROOM JOINING
    # ========================================================================

    async def handle_join(self, websocket, message, remote):
        """Handle a player joining a room."""
        username = message.get("username", "").strip()
        token = message.get("token", "")
        room_id = message.get("room", "public")
        color = message.get("color", "#3498db")
        player_data = message.get("playerData", {})

        # Validate session token
        if token:
            validated_user = self.accounts.validate_session(token)
            if validated_user != username:
                await self.send_to(websocket, {
                    "type": "join_result",
                    "success": False,
                    "message": "Invalid session token"
                })
                return None
        else:
            # Guest mode: check if username is available, prepend 'Guest_'
            if not username:
                username = f"Guest_{secrets.token_hex(3)[:6]}"

        # Check for banned accounts
        if self.accounts.is_banned(username):
            await self.send_to(websocket, {
                "type": "join_result",
                "success": False,
                "message": "This account has been banned"
            })
            return None

        # Check if already connected
        if username in self.player_rooms:
            old_room_id = self.player_rooms[username]
            old_room = self.rooms.get(old_room_id)
            if old_room and username in old_room.players:
                # Replace old connection
                old_player = old_room.players[username]
                try:
                    await old_player.websocket.close()
                except Exception:
                    pass
                del old_room.players[username]
                print(f"[Reconnect] {username} reconnecting")

        # Get or create room
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(room_id, self.worlds)
            print(f"[Room] Created room '{room_id}'")

        room = self.rooms[room_id]

        # Check max players
        if len(room.players) >= self.config['server']['max_players_per_room']:
            await self.send_to(websocket, {
                "type": "join_result",
                "success": False,
                "message": "Room is full"
            })
            return None

        # Check if username is taken in this room
        if username in room.players and room.players[username].websocket.open:
            await self.send_to(websocket, {
                "type": "join_result",
                "success": False,
                "message": "Username already taken in this room"
            })
            return None

        # Create player state
        player = PlayerState(websocket, username, token)
        player.color = color

        # Restore persistent player data if available
        if username in room.world.get("player_data", {}):
            saved = room.world["player_data"][username]
            player.money = saved.get("money", 0)
            player.drill_tier = saved.get("drillTier", 0)
            player.max_hull = saved.get("maxHull", DEFAULT_CONFIG['game']['max_hull'])
            player.hull = player.max_hull
            player.max_fuel = saved.get("maxFuel", DEFAULT_CONFIG['game']['max_fuel'])
            player.fuel = player.max_fuel
            player.max_cargo = saved.get("maxCargo", DEFAULT_CONFIG['game']['max_cargo'])
            player.heat_resist = saved.get("heatResist", 0)
            player.xray_range = saved.get("xrayRange", 3)
            player.multi_mine = saved.get("multiMine", 0)
            player.color = saved.get("vehColor", color)
            player.teleporters = saved.get("teleporters", [])
            player.blueprints = saved.get("blueprints", [])
            player.achievements = saved.get("achievements", {})
            print(f"[Restore] Restored data for {username}")

        # Persist client player data (inventory, stats, etc)
        if player_data:
            player.inventory = player_data.get("inventory", {})
            player.money = player_data.get("money", player.money)
            player.stats = player_data.get("stats", player.stats)
            player.achievements = player_data.get("achievements", player.achievements)

        # Determine admin
        if room.admin is None:
            room.admin = username
            player.player_id = username  # Admin gets a stable ID

        # Add to room
        room.players[username] = player
        self.player_rooms[username] = room_id
        room.last_activity = time.time()

        print(f"[Join] {username} joined room '{room_id}' (Players: {room.player_count})")

        # Send join result
        world = room.world
        await self.send_to(websocket, {
            "type": "join_result",
            "success": True,
            "message": f"Joined room '{room_id}'",
            "room": room_id,
            "username": username,
            "playerId": player.player_id,
            "isAdmin": username == room.admin,
            "players": [p.to_dict() for p in room.players.values()],
            "bannedIds": world.get("banned_ids", [])
        })

        # Send full map to joining player
        await self.send_map(websocket, room_id)

        # Notify other players
        await self.broadcast_to_room(room_id, {
            "type": "join",
            "id": player.player_id,
            "username": username,
            "color": player.color,
            "joinedAt": int(player.joined_at * 1000)
        }, exclude=username)

        # Send host heartbeat if admin
        if username == room.admin:
            await self.send_to(websocket, {
                "type": "host_heartbeat",
                "id": username
            })

        return player, room_id, username

    async def send_map(self, websocket, room_id):
        """Send the full world map as binary diffs."""
        room = self.rooms.get(room_id)
        if not room:
            return
        world = room.world
        seed = world['procedural_seed']
        diffs = []

        for y in range(len(world['map'])):
            row = world['map'][y]
            for x in range(len(row)):
                base = self.worlds._procedural_tile(x, y, seed)
                current = row[x]
                if current != base:
                    diffs.append([x, y, current])

            # Send in chunks
            if len(diffs) >= 5000:
                await self.send_to(websocket, {
                    "type": "map_data",
                    "diffs": diffs,
                    "more": True
                })
                diffs = []
                await asyncio.sleep(0.01)  # Yield to event loop

        # Send remaining
        await self.send_to(websocket, {
            "type": "map_data",
            "diffs": diffs,
            "more": False,
            "worldTime": int(time.time() * 1000)
        })

    # ========================================================================
    # GAME MESSAGE HANDLING
    # ========================================================================

    async def handle_game_message(self, player, room_id, message):
        """Handle game-related messages from an authenticated player."""
        msg_type = message.get("type")

        if msg_type == "move":
            await self.handle_move(player, room_id, message)

        elif msg_type == "heartbeat":
            player.last_heartbeat = time.time()
            # Also relay as host heartbeat if admin
            room = self.rooms.get(room_id)
            if room and player.username == room.admin:
                await self.broadcast_to_room(room_id, {
                    "type": "host_heartbeat",
                    "id": player.username
                })

        elif msg_type == "chat":
            await self.handle_chat(player, room_id, message)

        elif msg_type == "tile_update":
            await self.handle_tile_update(player, room_id, message)

        elif msg_type == "aoe_mine":
            await self.handle_aoe_mine(player, room_id, message)

        elif msg_type == "explode":
            await self.handle_explode(player, room_id, message)

        elif msg_type == "fuel_transfer":
            await self.handle_fuel_transfer(player, room_id, message)

        elif msg_type == "trade":
            await self.handle_trade(player, room_id, message)

        elif msg_type == "death":
            await self.broadcast_to_room(room_id, {
                "type": "death",
                "id": player.player_id,
                "name": player.username
            })

        elif msg_type == "map_query":
            await self.handle_map_query(player, room_id, message)

        elif msg_type == "view_req":
            await self.handle_view_req(player, room_id, message)

        elif msg_type == "admin_action":
            await self.handle_admin_action(player, room_id, message)

        elif msg_type == "save_player_data":
            await self.handle_save_player_data(player, room_id, message)

        elif msg_type == "audio_tag":
            await self.broadcast_to_room(room_id, {
                "type": "soundbite",
                "tag": message.get("tag", ""),
                "id": player.player_id
            }, exclude=player.username)

        elif msg_type == "claim_host":
            room = self.rooms.get(room_id)
            if room:
                room.admin = player.username
                await self.broadcast_to_room(room_id, {
                    "type": "claim_host",
                    "id": player.username
                })

        elif msg_type == "promote_host":
            await self.handle_promote_host(player, room_id, message)

        else:
            # Unknown message types - just log
            pass

    # ========================================================================
    # SPECIFIC MESSAGE HANDLERS
    # ========================================================================

    async def handle_move(self, player, room_id, message):
        """Handle player movement updates."""
        player.last_heartbeat = time.time()
        player.x = message.get("sx", player.x)
        player.y = message.get("sy", player.y)
        player.grid_x = message.get("gx", player.grid_x)
        player.grid_y = message.get("gy", player.grid_y)
        player.rotation = message.get("r", player.rotation)
        player.is_drilling = message.get("drill", player.is_drilling)
        player.color = message.get("col", player.color)

        room = self.rooms.get(room_id)
        is_admin = room and player.username == room.admin

        await self.broadcast_to_room(room_id, {
            "type": "move",
            "id": player.player_id,
            "sx": player.x,
            "sy": player.y,
            "tx": message.get("tx"),
            "ty": message.get("ty"),
            "gx": player.grid_x,
            "gy": player.grid_y,
            "r": player.rotation,
            "col": player.color,
            "drill": player.is_drilling,
            "username": player.username,
            "joinedAt": int(player.joined_at * 1000),
            "isAdmin": is_admin
        }, exclude=player.username)

    async def handle_chat(self, player, room_id, message):
        """Handle chat messages."""
        msg_text = message.get("msg", "")
        await self.broadcast_to_room(room_id, {
            "type": "chat",
            "id": player.player_id,
            "name": player.username,
            "msg": msg_text
        })

    async def handle_tile_update(self, player, room_id, message):
        """Handle single tile update."""
        x = message.get("x")
        y = message.get("y")
        val = message.get("val")
        if x is not None and y is not None and val is not None:
            self.worlds.update_tile(room_id, x, y, val)
            await self.broadcast_to_room(room_id, {
                "type": "tile",
                "x": x,
                "y": y,
                "val": val
            }, exclude=player.username)

    async def handle_aoe_mine(self, player, room_id, message):
        """Handle AOE mining updates."""
        await self.broadcast_to_room(room_id, {
            "type": "aoe_mine",
            "id": player.player_id,
            "x": message.get("x"),
            "y": message.get("y"),
            "r": message.get("r", 0),
            "t": message.get("t", 0)
        }, exclude=player.username)

    async def handle_explode(self, player, room_id, message):
        """Handle explosion events."""
        await self.broadcast_to_room(room_id, {
            "type": "explode",
            "id": player.player_id,
            "x": message.get("x"),
            "y": message.get("y"),
            "r": message.get("r", 3),
            "t": message.get("t", 2000)
        }, exclude=player.username)

    async def handle_fuel_transfer(self, player, room_id, message):
        """Handle fuel transfers between players."""
        target_username = message.get("to")
        amount = message.get("amt", 0)
        room = self.rooms.get(room_id)
        if room and target_username in room.players:
            target_player = room.players[target_username]
            await self.send_to(target_player.websocket, {
                "type": "fuel",
                "to": target_player.player_id,
                "from": player.username,
                "amt": amount
            })

    async def handle_trade(self, player, room_id, message):
        """Handle resource trading between players."""
        target_username = message.get("to")
        resource = message.get("res", "fuel")
        amount = message.get("amt", 0)
        room = self.rooms.get(room_id)
        if room and target_username in room.players:
            target_player = room.players[target_username]
            await self.send_to(target_player.websocket, {
                "type": "trade",
                "to": target_player.player_id,
                "from": player.username,
                "res": resource,
                "amt": amount
            })

    async def handle_map_query(self, player, room_id, message):
        """Handle map sync requests from clients."""
        room = self.rooms.get(room_id)
        if not room:
            return
        # Only admin responds to map queries
        if player.username != room.admin:
            return

        requester_name = message.get("from")
        if requester_name and requester_name in room.players:
            requester = room.players[requester_name]
            # Send area diff for full map
            diffs = self.worlds.get_area_diff(room_id, 0, 0,
                                              DEFAULT_CONFIG['game']['map_width'],
                                              DEFAULT_CONFIG['game']['map_height'])
            # Send in chunks
            chunk_size = 5000
            for i in range(0, len(diffs), chunk_size):
                chunk = diffs[i:i + chunk_size]
                await self.send_to(requester.websocket, {
                    "type": "map_data",
                    "diffs": chunk,
                    "more": i + chunk_size < len(diffs)
                })
                await asyncio.sleep(0.01)

    async def handle_view_req(self, player, room_id, message):
        """Handle viewport sync requests."""
        room = self.rooms.get(room_id)
        if not room:
            return
        if player.username != room.admin:
            return

        requester_name = message.get("id")
        bx = message.get("x", 0)
        by = message.get("y", 0)
        bw = message.get("w", 50)
        bh = message.get("h", 40)

        if requester_name and requester_name in room.players:
            requester = room.players[requester_name]
            diffs = self.worlds.get_area_diff(room_id, bx, by, bw, bh)
            if diffs:
                await self.send_to(requester.websocket, {
                    "type": "map_data",
                    "diffs": diffs,
                    "more": False
                })

    async def handle_admin_action(self, player, room_id, message):
        """Handle admin actions: kick, ban, etc."""
        room = self.rooms.get(room_id)
        if not room or player.username != room.admin:
            return

        action = message.get("action")
        target_username = message.get("target")

        if action == "kick":
            if target_username in room.players:
                target = room.players[target_username]
                await self.send_to(target.websocket, {
                    "type": "kick",
                    "target": target.player_id
                })
                await target.websocket.close()
                del room.players[target_username]
                self.player_rooms.pop(target_username, None)
                await self.broadcast_to_room(room_id, {
                    "type": "system_msg",
                    "message": f"{target_username} was kicked"
                })

        elif action == "ban":
            if target_username in room.players:
                target = room.players[target_username]
                world = room.world
                if target.player_id not in world.get("banned_ids", []):
                    world.setdefault("banned_ids", []).append(target.player_id)
                await self.send_to(target.websocket, {
                    "type": "kick",
                    "target": target.player_id
                })
                await target.websocket.close()
                del room.players[target_username]
                self.player_rooms.pop(target_username, None)

        elif action == "transfer_admin":
            if target_username in room.players:
                room.admin = target_username
                await self.broadcast_to_room(room_id, {
                    "type": "promote_host",
                    "target": target_username
                })

    async def handle_save_player_data(self, player, room_id, message):
        """Save player progression data to the world."""
        room = self.rooms.get(room_id)
        if not room:
            return

        data = message.get("data", {})
        if player.username not in room.world.setdefault("player_data", {}):
            room.world["player_data"][player.username] = {}

        room.world["player_data"][player.username].update(data)
        # Also save to disk periodically
        self.worlds.save_world(room_id)

    async def handle_promote_host(self, player, room_id, message):
        """Handle admin promotion requests."""
        room = self.rooms.get(room_id)
        if not room or player.username != room.admin:
            return

        target_username = message.get("target")
        if target_username and target_username in room.players:
            room.admin = target_username
            await self.broadcast_to_room(room_id, {
                "type": "promote_host",
                "target": target_username
            })

    # ========================================================================
    # DISCONNECT HANDLING
    # ========================================================================

    async def handle_disconnect(self, username, room_id):
        """Handle player disconnection."""
        room = self.rooms.get(room_id)
        if not room:
            self.player_rooms.pop(username, None)
            return

        # Remove player from room
        if username in room.players:
            del room.players[username]
            self.player_rooms.pop(username, None)
            print(f"[Disconnect] {username} left room '{room_id}' (Players: {room.player_count})")

            # Broadcast leave
            await self.broadcast_to_room(room_id, {
                "type": "leave",
                "id": username,
                "username": username
            })

            # If admin left, assign new admin
            if username == room.admin and room.player_count > 0:
                # Find the next admin by join order
                oldest = None
                for p in room.players.values():
                    if oldest is None or p.joined_at < oldest.joined_at:
                        oldest = p
                if oldest:
                    room.admin = oldest.username
                    await self.broadcast_to_room(room_id, {
                        "type": "claim_host",
                        "id": oldest.username
                    })
                    print(f"[Admin] {oldest.username} is new admin of '{room_id}'")

            # Clean up empty rooms
            if room.player_count == 0:
                print(f"[Room] Room '{room_id}' is now empty, saving...")
                self.worlds.save_world(room_id)
                # Keep room for a while in case someone rejoins
                # Cleanup after 5 minutes
                asyncio.create_task(self._cleanup_empty_room(room_id))

    async def _cleanup_empty_room(self, room_id):
        """Remove empty rooms after a timeout."""
        await asyncio.sleep(300)  # 5 minutes
        room = self.rooms.get(room_id)
        if room and room.player_count == 0:
            del self.rooms[room_id]
            print(f"[Room] Room '{room_id}' cleaned up")


# ============================================================================
# ENTRY POINT
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Mega Miner NG Dedicated Server")
    parser.add_argument("-c", "--config", default="server_config.json",
                        help="Path to configuration file")
    parser.add_argument("-p", "--port", type=int, default=None,
                        help="Port to listen on (overrides config)")
    parser.add_argument("--host", default=None,
                        help="Host to listen on (overrides config)")
    args = parser.parse_args()

    server = MegaMinerServer(args.config)

    # Override from command line
    if args.host:
        server.config['server']['host'] = args.host
    if args.port:
        server.config['server']['port'] = args.port

    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        asyncio.run(server.shutdown())


if __name__ == "__main__":
    main()