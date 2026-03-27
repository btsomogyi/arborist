from typing import Optional, Union, TypeVar, Generic, Protocol


T = TypeVar("T")


class Comparable(Protocol):
    def __lt__(self, other: "Comparable") -> bool: ...


def find_max(items: list[int]) -> Optional[int]:
    if not items:
        return None
    result = items[0]
    for item in items[1:]:
        if item > result:
            result = item
    print("Max: " + str(result))
    return result


def parse_value(raw: Union[str, int, float]) -> str:
    print("Parsing: " + str(raw))
    return str(raw)


class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []

    def push(self, item: T) -> None:
        print("Pushing item")
        self._items.append(item)

    def pop(self) -> Optional[T]:
        if not self._items:
            return None
        return self._items.pop()

    def peek(self) -> Optional[T]:
        if not self._items:
            return None
        return self._items[-1]

    @property
    def size(self) -> int:
        return len(self._items)


def process_items(items: list[str], transformer: Optional[callable] = None) -> list[str]:
    results = []
    for item in items:
        if transformer is not None:
            item = transformer(item)
        print("Item: " + item)
        results.append(item)
    return results
