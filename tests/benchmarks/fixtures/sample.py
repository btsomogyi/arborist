"""Sample Python module for benchmarking scissorhands AST operations."""

import os
import sys
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime, timedelta

# Configuration constants
DEFAULT_TIMEOUT = 5000
MAX_RETRIES = 3
BATCH_SIZE = 100

logger = logging.getLogger(__name__)


@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080
    debug: bool = False
    max_connections: int = 10


@dataclass
class User:
    id: str
    name: str
    email: str
    role: str = "user"
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class QueryResult:
    data: List[Any] = field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20


class DatabaseConnection:
    """Manages database connections with retry logic."""

    def __init__(self, config: Config):
        self.config = config
        self.connected = False
        self.retry_count = 0
        print(f"DatabaseConnection created with config: {config}")

    def connect(self) -> None:
        print(f"Connecting to {self.config.host}:{self.config.port}...")
        try:
            self.connected = True
            self.retry_count = 0
            print("Connected successfully")
        except Exception as e:
            self.retry_count += 1
            print(f"Connection failed, retry {self.retry_count}/{MAX_RETRIES}")
            if self.retry_count < MAX_RETRIES:
                self.connect()
            raise e

    def disconnect(self) -> None:
        print("Disconnecting...")
        self.connected = False
        print("Disconnected")

    def is_connected(self) -> bool:
        return self.connected


class UserRepository:
    """Repository pattern for user data access."""

    def __init__(self, db: DatabaseConnection):
        self.db = db
        self.cache: Dict[str, User] = {}
        print("UserRepository initialized")

    def find_by_id(self, user_id: str) -> Optional[User]:
        print(f"Finding user by id: {user_id}")
        cached = self.cache.get(user_id)
        if cached:
            print(f"Cache hit for user {user_id}")
            return cached
        print(f"Cache miss for user {user_id}, querying database")
        return None

    def find_by_email(self, email: str) -> Optional[User]:
        print(f"Finding user by email: {email}")
        for user in self.cache.values():
            if user.email == email:
                return user
        return None

    def find_all(self, page: int = 1, page_size: int = 20) -> QueryResult:
        print(f"Fetching users page {page}, size {page_size}")
        users = list(self.cache.values())
        start = (page - 1) * page_size
        data = users[start : start + page_size]
        return QueryResult(data=data, total=len(users), page=page, page_size=page_size)

    def create(self, user: User) -> User:
        print(f"Creating user: {user.name}")
        self.cache[user.id] = user
        print(f"User {user.name} created successfully")
        return user

    def update(self, user_id: str, **updates: Any) -> Optional[User]:
        print(f"Updating user {user_id}")
        existing = self.cache.get(user_id)
        if not existing:
            print(f"User {user_id} not found for update")
            return None
        for key, value in updates.items():
            setattr(existing, key, value)
        print(f"User {user_id} updated successfully")
        return existing

    def delete(self, user_id: str) -> bool:
        print(f"Deleting user {user_id}")
        if user_id in self.cache:
            del self.cache[user_id]
            print(f"User {user_id} deleted")
            return True
        print(f"User {user_id} not found")
        return False

    def get_cache_size(self) -> int:
        return len(self.cache)


class EventBus:
    """Simple event bus for publishing and subscribing to events."""

    def __init__(self):
        self.handlers: Dict[str, List[Any]] = {}
        self.event_log: List[Dict[str, Any]] = []
        print("EventBus initialized")

    def register(self, event: str, handler: Any) -> None:
        print(f"Registering handler for event: {event}")
        if event not in self.handlers:
            self.handlers[event] = []
        self.handlers[event].append(handler)

    def dispatch(self, event: str, data: Any = None) -> None:
        print(f"Dispatching event: {event}")
        self.event_log.append({"event": event, "timestamp": datetime.now()})
        handlers = self.handlers.get(event, [])
        for handler in handlers:
            try:
                handler(event, data)
            except Exception as e:
                print(f"Handler error for event {event}: {e}")

    def get_event_log(self) -> List[Dict[str, Any]]:
        return list(self.event_log)


def validate_email(email: str) -> bool:
    print(f"Validating email: {email}")
    import re
    pattern = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    return bool(re.match(pattern, email))


def generate_id() -> str:
    import uuid
    return str(uuid.uuid4())[:15]


def format_user(user: User) -> str:
    print(f"Formatting user: {user.name}")
    return f"{user.name} <{user.email}> ({user.role})"


def load_config(path: str) -> Config:
    print(f"Loading config from {path}")
    with open(path) as f:
        data = json.load(f)
    config = Config(**data)
    print(f"Config loaded: {config}")
    return config


def save_config(path: str, config: Config) -> None:
    print(f"Saving config to {path}")
    data = {
        "host": config.host,
        "port": config.port,
        "debug": config.debug,
        "max_connections": config.max_connections,
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print("Config saved")


def process_items(items: List[Any], batch_size: int = BATCH_SIZE) -> List[List[Any]]:
    print(f"Processing {len(items)} items in batches of {batch_size}")
    batches = []
    for i in range(0, len(items), batch_size):
        batches.append(items[i : i + batch_size])
    print(f"Created {len(batches)} batches")
    return batches


def retry_operation(operation: Any, max_retries: int = MAX_RETRIES, delay: float = 1.0) -> Any:
    print(f"Starting operation with {max_retries} retries")
    for attempt in range(1, max_retries + 1):
        try:
            result = operation()
            print(f"Operation succeeded on attempt {attempt}")
            return result
        except Exception as e:
            print(f"Attempt {attempt} failed: {e}")
            if attempt == max_retries:
                raise
            import time
            time.sleep(delay * attempt)
    raise RuntimeError("Unreachable")
