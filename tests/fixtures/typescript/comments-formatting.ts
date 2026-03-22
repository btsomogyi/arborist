// Line comment at the top

/**
 * JSDoc block comment for documented function.
 * @param name - The user's name
 * @returns A greeting string
 */
function documented(name: string): string {
  return "Hello, " + name; // inline comment
}

/* Multi-line
   block comment
   spanning several lines */
const value = 42;

	// Tab-indented comment
	const tabIndented = "tabs";

const   spacey   =   "extra    spaces";

// Blank lines below



// After blank lines

function withTrailingWhitespace(): void {
  const x = 1;
  console.log(x);
}

export { documented, value, tabIndented, spacey, withTrailingWhitespace };
