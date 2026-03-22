// Default import
import EventEmitter from "events";

// Named imports
import { readFile, writeFile } from "fs/promises";

// Namespace import
import * as path from "path";

// Named import with alias
import { Buffer as NodeBuffer } from "buffer";

// Side-effect import
import "reflect-metadata";

// Type-only import
import type { Stats } from "fs";

// Named export
export function helper(): void {
  // no-op
}

// Named export with value
export const MAX_SIZE = 1024;

// Export type
export type Config = {
  debug: boolean;
  verbose: boolean;
};

// Export interface
export interface Logger {
  info(msg: string): void;
  error(msg: string): void;
}

// Default export
export default class Application {
  constructor(private config: Config) {}
}

// Re-export
export { EventEmitter } from "events";
