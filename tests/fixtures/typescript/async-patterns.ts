// Async function with error handling
async function fetchJSON<T>(url: string): Promise<T> {
  console.log("Fetching: " + url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }
  return response.json();
}

// Promise chain
function processData(input: string): Promise<string> {
  return Promise.resolve(input)
    .then((data) => {
      console.log("Step 1: " + data);
      return data.toUpperCase();
    })
    .then((data) => {
      console.log("Step 2: " + data);
      return data.trim();
    });
}

// Async generator
async function* paginate<T>(
  fetcher: (page: number) => Promise<T[]>,
  maxPages: number = 10
): AsyncGenerator<T[], void, unknown> {
  for (let page = 0; page < maxPages; page++) {
    const items = await fetcher(page);
    if (items.length === 0) break;
    console.log("Page " + page);
    yield items;
  }
}

// Retry pattern
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log("Retry " + (i + 1));
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

// Concurrent execution
async function processAll(urls: string[]): Promise<string[]> {
  const results = await Promise.all(
    urls.map((url) => fetchJSON<string>(url))
  );
  console.log("All done: " + results.length);
  return results;
}

export { fetchJSON, processData, paginate, withRetry, processAll };
