import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { EventEmitter } from 'node:events';

// Configuration constants
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const BATCH_SIZE = 100;

interface Config {
  host: string;
  port: number;
  debug: boolean;
  maxConnections: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
}

interface QueryResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

type EventHandler = (event: string, data: unknown) => void;

class DatabaseConnection {
  private config: Config;
  private connected: boolean = false;
  private retryCount: number = 0;

  constructor(config: Config) {
    this.config = config;
    console.log('DatabaseConnection created with config:', config);
  }

  async connect(): Promise<void> {
    console.log(`Connecting to ${this.config.host}:${this.config.port}...`);
    try {
      this.connected = true;
      this.retryCount = 0;
      console.log('Connected successfully');
    } catch (error) {
      this.retryCount++;
      console.log(`Connection failed, retry ${this.retryCount}/${MAX_RETRIES}`);
      if (this.retryCount < MAX_RETRIES) {
        await this.connect();
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('Disconnecting...');
    this.connected = false;
    console.log('Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }
}

class UserRepository {
  private db: DatabaseConnection;
  private cache: Map<string, User> = new Map();

  constructor(db: DatabaseConnection) {
    this.db = db;
    console.log('UserRepository initialized');
  }

  async findById(id: string): Promise<User | undefined> {
    console.log(`Finding user by id: ${id}`);
    const cached = this.cache.get(id);
    if (cached) {
      console.log(`Cache hit for user ${id}`);
      return cached;
    }
    console.log(`Cache miss for user ${id}, querying database`);
    return undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    console.log(`Finding user by email: ${email}`);
    for (const user of this.cache.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async findAll(page: number = 1, pageSize: number = 20): Promise<QueryResult<User>> {
    console.log(`Fetching users page ${page}, size ${pageSize}`);
    const users = Array.from(this.cache.values());
    const start = (page - 1) * pageSize;
    const data = users.slice(start, start + pageSize);
    return {
      data,
      total: users.length,
      page,
      pageSize,
    };
  }

  async create(user: User): Promise<User> {
    console.log(`Creating user: ${user.name}`);
    this.cache.set(user.id, user);
    console.log(`User ${user.name} created successfully`);
    return user;
  }

  async update(id: string, updates: Partial<User>): Promise<User | undefined> {
    console.log(`Updating user ${id}`);
    const existing = this.cache.get(id);
    if (!existing) {
      console.log(`User ${id} not found for update`);
      return undefined;
    }
    const updated = { ...existing, ...updates };
    this.cache.set(id, updated);
    console.log(`User ${id} updated successfully`);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    console.log(`Deleting user ${id}`);
    const deleted = this.cache.delete(id);
    console.log(`User ${id} ${deleted ? 'deleted' : 'not found'}`);
    return deleted;
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

class EventBus extends EventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventLog: Array<{ event: string; timestamp: Date }> = [];

  constructor() {
    super();
    console.log('EventBus initialized');
  }

  register(event: string, handler: EventHandler): void {
    console.log(`Registering handler for event: ${event}`);
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  dispatch(event: string, data: unknown): void {
    console.log(`Dispatching event: ${event}`);
    this.eventLog.push({ event, timestamp: new Date() });
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      try {
        handler(event, data);
      } catch (error) {
        console.log(`Handler error for event ${event}:`, error);
      }
    }
  }

  getEventLog(): Array<{ event: string; timestamp: Date }> {
    return [...this.eventLog];
  }
}

function validateEmail(email: string): boolean {
  console.log(`Validating email: ${email}`);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function formatUser(user: User): string {
  console.log(`Formatting user: ${user.name}`);
  return `${user.name} <${user.email}> (${user.role})`;
}

async function loadConfig(path: string): Promise<Config> {
  console.log(`Loading config from ${path}`);
  const content = await readFile(path, 'utf-8');
  const config = JSON.parse(content) as Config;
  console.log('Config loaded:', config);
  return config;
}

async function saveConfig(path: string, config: Config): Promise<void> {
  console.log(`Saving config to ${path}`);
  const content = JSON.stringify(config, null, 2);
  await writeFile(path, content, 'utf-8');
  console.log('Config saved');
}

function processItems<T>(items: T[], batchSize: number = BATCH_SIZE): T[][] {
  console.log(`Processing ${items.length} items in batches of ${batchSize}`);
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  console.log(`Created ${batches.length} batches`);
  return batches;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delay: number = 1000,
): Promise<T> {
  console.log(`Starting operation with ${maxRetries} retries`);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      console.log(`Operation succeeded on attempt ${attempt}`);
      return result;
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
  throw new Error('Unreachable');
}

export {
  DatabaseConnection,
  UserRepository,
  EventBus,
  validateEmail,
  generateId,
  formatUser,
  loadConfig,
  saveConfig,
  processItems,
  retryOperation,
  DEFAULT_TIMEOUT,
  MAX_RETRIES,
  BATCH_SIZE,
};

export type { Config, User, QueryResult, EventHandler };
