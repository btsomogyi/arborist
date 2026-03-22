# Simple decorator
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print("Before call")
        result = func(*args, **kwargs)
        print("After call")
        return result
    return wrapper


# Decorator with arguments
def repeat(n):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for _ in range(n):
                func(*args, **kwargs)
        return wrapper
    return decorator


@my_decorator
def say_hello(name):
    print("Hello, " + name)


@repeat(3)
def greet(name):
    print("Hi, " + name)


class Service:
    @staticmethod
    def create():
        return Service()

    @classmethod
    def from_config(cls, config):
        return cls()

    @property
    def status(self):
        return "active"
