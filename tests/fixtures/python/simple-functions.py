# Simple function with positional args
def greet(name):
    print("Hello, " + name)
    return "Hello, " + name


# Function with keyword arguments and defaults
def create_user(name, age=25, role="user"):
    return {"name": name, "age": age, "role": role}


# Function with *args and **kwargs
def log_message(*args, **kwargs):
    for arg in args:
        print(arg)
    for key, value in kwargs.items():
        print(f"{key}={value}")


# Function with type annotations
def add(a: int, b: int) -> int:
    return a + b


# Async function
async def fetch_data(url: str) -> str:
    print("Fetching: " + url)
    return ""
