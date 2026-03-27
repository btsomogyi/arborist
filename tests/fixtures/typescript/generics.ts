// Generic function
function identity<T>(value: T): T {
  console.log("Identity called");
  return value;
}

// Generic with constraint
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Generic interface
interface Repository<T> {
  find(id: string): T | undefined;
  findAll(): T[];
  save(item: T): void;
  delete(id: string): boolean;
}

// Generic class
class Collection<T> {
  private items: T[] = [];

  add(item: T): void {
    console.log("Adding item");
    this.items.push(item);
  }

  get(index: number): T | undefined {
    return this.items[index];
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  map<U>(transform: (item: T) => U): U[] {
    return this.items.map(transform);
  }

  get size(): number {
    return this.items.length;
  }
}

// Utility type usage
type Readonly<T> = { readonly [P in keyof T]: T[P] };

interface User {
  name: string;
  email: string;
  age: number;
}

type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type UserName = Pick<User, "name" | "email">;

export { identity, getProperty, Repository, Collection, User };
