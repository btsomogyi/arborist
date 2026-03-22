// Base class with constructor, methods, and properties
class Animal {
  private name: string;
  protected sound: string;
  public static count: number = 0;

  constructor(name: string, sound: string) {
    this.name = name;
    this.sound = sound;
    Animal.count++;
  }

  getName(): string {
    return this.name;
  }

  speak(): string {
    console.log(`${this.name} says ${this.sound}`);
    return this.sound;
  }

  static getCount(): number {
    return Animal.count;
  }
}

// Extended class
class Dog extends Animal {
  private breed: string;

  constructor(name: string, breed: string) {
    super(name, "Woof");
    this.breed = breed;
  }

  speak(): string {
    console.log(`${this.getName()} the ${this.breed} barks`);
    return "Woof!";
  }

  fetch(item: string): string {
    return `${this.getName()} fetches ${item}`;
  }
}

export { Animal, Dog };
