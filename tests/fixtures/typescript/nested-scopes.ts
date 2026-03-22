// Outer function with nested inner function and shadowed variables
function outer(value: number): () => number {
  const count = value;
  console.log("outer count: " + count);

  function inner(): number {
    const count = 42; // shadowed
    console.log("inner count: " + count);
    return count;
  }

  return inner;
}

// Closure over shared variable
function makeCounter(): { increment: () => number; getCount: () => number } {
  let count = 0;

  function increment(): number {
    count++;
    return count;
  }

  function getCount(): number {
    return count;
  }

  return { increment, getCount };
}

// Deeply nested scopes
function processItems(items: string[]): string[] {
  const result: string[] = [];

  for (const item of items) {
    const processed = item.trim();
    if (processed.length > 0) {
      const upper = processed.toUpperCase();
      result.push(upper);
    }
  }

  return result;
}
