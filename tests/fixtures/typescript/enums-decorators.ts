// String enum
enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Pending = "PENDING",
  Archived = "ARCHIVED",
}

// Numeric enum
enum Priority {
  Low,
  Medium,
  High,
  Critical,
}

// Const enum
const enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}

// Using enums
function getStatusLabel(status: Status): string {
  console.log("Getting label for: " + status);
  switch (status) {
    case Status.Active:
      return "Active";
    case Status.Inactive:
      return "Inactive";
    case Status.Pending:
      return "Pending";
    case Status.Archived:
      return "Archived";
  }
}

// Type guards
interface Circle {
  kind: "circle";
  radius: number;
}

interface Square {
  kind: "square";
  size: number;
}

type Shape = Circle | Square;

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      console.log("Calculating circle area");
      return Math.PI * shape.radius ** 2;
    case "square":
      console.log("Calculating square area");
      return shape.size ** 2;
  }
}

// Class with access modifiers
class Service {
  private static instance: Service;
  private readonly name: string;

  private constructor(name: string) {
    this.name = name;
    console.log("Service created: " + name);
  }

  static getInstance(name: string): Service {
    if (!Service.instance) {
      Service.instance = new Service(name);
    }
    return Service.instance;
  }

  getName(): string {
    return this.name;
  }
}

export { Status, Priority, getStatusLabel, Shape, area, Service };
