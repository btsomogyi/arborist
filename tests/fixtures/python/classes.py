# Base class with __init__, methods, properties
class Animal:
    count = 0

    def __init__(self, name, sound):
        self.name = name
        self.sound = sound
        Animal.count += 1

    def speak(self):
        print(f"{self.name} says {self.sound}")
        return self.sound

    @classmethod
    def get_count(cls):
        return cls.count

    @staticmethod
    def is_animal(obj):
        return isinstance(obj, Animal)

    @property
    def display_name(self):
        return self.name.upper()


# Inherited class
class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, "Woof")
        self.breed = breed

    def speak(self):
        print(f"{self.name} the {self.breed} barks")
        return "Woof!"

    def fetch(self, item):
        return f"{self.name} fetches {item}"
