// Simple function with return type
function greet(name: string): string {
  console.log("Greeting: " + name);
  return `Hello, ${name}!`;
}

// Arrow function with expression body
const add = (a: number, b: number): number => a + b;

// Arrow function with block body
const multiply = (a: number, b: number): number => {
  const result = a * b;
  console.log("Result: " + result);
  return result;
};

// Async function
async function fetchData(url: string): Promise<string> {
  console.log("Fetching: " + url);
  const response = await fetch(url);
  return response.text();
}

// Function with default parameters
function createUser(name: string, age: number = 25, role: string = "user"): object {
  return { name, age, role };
}

// Exported function
export function formatDate(date: Date): string {
  return date.toISOString();
}
