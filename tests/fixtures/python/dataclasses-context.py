from dataclasses import dataclass, field
from contextlib import contextmanager


@dataclass
class Point:
    x: float
    y: float

    def distance_to(self, other: "Point") -> float:
        print("Calculating distance")
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5


@dataclass
class Config:
    debug: bool = False
    verbose: bool = False
    max_retries: int = 3
    tags: list[str] = field(default_factory=list)

    def is_production(self) -> bool:
        return not self.debug


@contextmanager
def managed_resource(name: str):
    print("Acquiring: " + name)
    resource = {"name": name, "active": True}
    try:
        yield resource
    finally:
        resource["active"] = False
        print("Released: " + name)


@contextmanager
def timer(label: str):
    print("Start: " + label)
    try:
        yield
    finally:
        print("End: " + label)


class ResourcePool:
    def __init__(self, size: int):
        self.size = size
        self.resources: list[str] = []

    def __enter__(self):
        for i in range(self.size):
            print("Creating resource " + str(i))
            self.resources.append(f"resource-{i}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        for r in self.resources:
            print("Closing " + r)
        self.resources.clear()
        return False
