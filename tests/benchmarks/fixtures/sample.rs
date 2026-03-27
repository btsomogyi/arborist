use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};

// Configuration constants
const DEFAULT_TIMEOUT: u64 = 5000;
const MAX_RETRIES: u32 = 3;
const BATCH_SIZE: usize = 100;

#[derive(Debug, Clone)]
struct Config {
    host: String,
    port: u16,
    debug: bool,
    max_connections: u32,
}

#[derive(Debug, Clone)]
struct User {
    id: String,
    name: String,
    email: String,
    role: String,
    created_at: Instant,
}

#[derive(Debug)]
struct QueryResult {
    data: Vec<User>,
    total: usize,
    page: usize,
    page_size: usize,
}

type EventHandler = Box<dyn Fn(&str, &dyn fmt::Debug) + Send + Sync>;

struct DatabaseConnection {
    config: Config,
    connected: bool,
    retry_count: u32,
}

impl DatabaseConnection {
    fn new(config: Config) -> Self {
        println!("DatabaseConnection created with config: {:?}", config);
        Self {
            config,
            connected: false,
            retry_count: 0,
        }
    }

    fn connect(&mut self) -> Result<(), String> {
        println!("Connecting to {}:{}...", self.config.host, self.config.port);
        self.connected = true;
        self.retry_count = 0;
        println!("Connected successfully");
        Ok(())
    }

    fn disconnect(&mut self) {
        println!("Disconnecting...");
        self.connected = false;
        println!("Disconnected");
    }

    fn is_connected(&self) -> bool {
        self.connected
    }
}

struct UserRepository {
    db: Arc<Mutex<DatabaseConnection>>,
    cache: RwLock<HashMap<String, User>>,
}

impl UserRepository {
    fn new(db: Arc<Mutex<DatabaseConnection>>) -> Self {
        println!("UserRepository initialized");
        Self {
            db,
            cache: RwLock::new(HashMap::new()),
        }
    }

    fn find_by_id(&self, id: &str) -> Option<User> {
        println!("Finding user by id: {}", id);
        let cache = self.cache.read().unwrap();
        let result = cache.get(id).cloned();
        if result.is_some() {
            println!("Cache hit for user {}", id);
        } else {
            println!("Cache miss for user {}, querying database", id);
        }
        result
    }

    fn find_by_email(&self, email: &str) -> Option<User> {
        println!("Finding user by email: {}", email);
        let cache = self.cache.read().unwrap();
        cache.values().find(|u| u.email == email).cloned()
    }

    fn find_all(&self, page: usize, page_size: usize) -> QueryResult {
        println!("Fetching users page {}, size {}", page, page_size);
        let cache = self.cache.read().unwrap();
        let users: Vec<User> = cache.values().cloned().collect();
        let start = (page - 1) * page_size;
        let end = (start + page_size).min(users.len());
        let start = start.min(users.len());
        QueryResult {
            data: users[start..end].to_vec(),
            total: users.len(),
            page,
            page_size,
        }
    }

    fn create(&self, user: User) -> User {
        println!("Creating user: {}", user.name);
        let mut cache = self.cache.write().unwrap();
        cache.insert(user.id.clone(), user.clone());
        println!("User {} created successfully", user.name);
        user
    }

    fn update(&self, id: &str, name: Option<&str>, email: Option<&str>) -> Option<User> {
        println!("Updating user {}", id);
        let mut cache = self.cache.write().unwrap();
        let user = cache.get_mut(id);
        match user {
            Some(u) => {
                if let Some(n) = name {
                    u.name = n.to_string();
                }
                if let Some(e) = email {
                    u.email = e.to_string();
                }
                println!("User {} updated successfully", id);
                Some(u.clone())
            }
            None => {
                println!("User {} not found for update", id);
                None
            }
        }
    }

    fn delete(&self, id: &str) -> bool {
        println!("Deleting user {}", id);
        let mut cache = self.cache.write().unwrap();
        let removed = cache.remove(id).is_some();
        if removed {
            println!("User {} deleted", id);
        } else {
            println!("User {} not found", id);
        }
        removed
    }

    fn get_cache_size(&self) -> usize {
        self.cache.read().unwrap().len()
    }
}

struct EventBus {
    handlers: HashMap<String, Vec<EventHandler>>,
    event_log: Vec<(String, Instant)>,
}

impl EventBus {
    fn new() -> Self {
        println!("EventBus initialized");
        Self {
            handlers: HashMap::new(),
            event_log: Vec::new(),
        }
    }

    fn register(&mut self, event: &str, handler: EventHandler) {
        println!("Registering handler for event: {}", event);
        self.handlers
            .entry(event.to_string())
            .or_default()
            .push(handler);
    }

    fn dispatch(&mut self, event: &str, data: &dyn fmt::Debug) {
        println!("Dispatching event: {}", event);
        self.event_log.push((event.to_string(), Instant::now()));
        if let Some(handlers) = self.handlers.get(event) {
            for handler in handlers {
                handler(event, data);
            }
        }
    }
}

fn validate_email(email: &str) -> bool {
    println!("Validating email: {}", email);
    email.contains('@') && email.contains('.') && email.len() > 3
}

fn generate_id() -> String {
    use std::time::SystemTime;
    let duration = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap();
    format!("{:x}", duration.as_nanos())[..15].to_string()
}

fn format_user(user: &User) -> String {
    println!("Formatting user: {}", user.name);
    format!("{} <{}> ({})", user.name, user.email, user.role)
}

fn load_config(path: &str) -> Result<Config, String> {
    println!("Loading config from {}", path);
    let content = fs::read_to_string(path).map_err(|e| format!("cannot read config: {}", e))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("cannot parse config: {}", e))?;
    let config = Config {
        host: parsed["host"].as_str().unwrap_or("localhost").to_string(),
        port: parsed["port"].as_u64().unwrap_or(8080) as u16,
        debug: parsed["debug"].as_bool().unwrap_or(false),
        max_connections: parsed["max_connections"].as_u64().unwrap_or(10) as u32,
    };
    println!("Config loaded: {:?}", config);
    Ok(config)
}

fn save_config(path: &str, config: &Config) -> Result<(), String> {
    println!("Saving config to {}", path);
    let json = format!(
        r#"{{"host":"{}","port":{},"debug":{},"max_connections":{}}}"#,
        config.host, config.port, config.debug, config.max_connections
    );
    fs::write(path, json).map_err(|e| format!("cannot write config: {}", e))?;
    println!("Config saved");
    Ok(())
}

fn process_items<T: Clone>(items: &[T], batch_size: usize) -> Vec<Vec<T>> {
    println!(
        "Processing {} items in batches of {}",
        items.len(),
        batch_size
    );
    let batches: Vec<Vec<T>> = items.chunks(batch_size).map(|c| c.to_vec()).collect();
    println!("Created {} batches", batches.len());
    batches
}

fn retry_operation<F, T, E>(operation: F, max_retries: u32, delay_ms: u64) -> Result<T, E>
where
    F: Fn() -> Result<T, E>,
    E: fmt::Display,
{
    println!("Starting operation with {} retries", max_retries);
    for attempt in 1..=max_retries {
        match operation() {
            Ok(result) => {
                println!("Operation succeeded on attempt {}", attempt);
                return Ok(result);
            }
            Err(e) => {
                println!("Attempt {} failed: {}", attempt, e);
                if attempt == max_retries {
                    return Err(e);
                }
                std::thread::sleep(Duration::from_millis(delay_ms * attempt as u64));
            }
        }
    }
    unreachable!()
}

fn main() {
    let config = Config {
        host: "localhost".to_string(),
        port: 5432,
        debug: true,
        max_connections: 10,
    };

    let db = Arc::new(Mutex::new(DatabaseConnection::new(config)));
    db.lock().unwrap().connect().unwrap();

    let repo = UserRepository::new(db.clone());
    let mut bus = EventBus::new();

    let user = User {
        id: generate_id(),
        name: "Alice".to_string(),
        email: "alice@example.com".to_string(),
        role: "admin".to_string(),
        created_at: Instant::now(),
    };

    repo.create(user.clone());
    bus.dispatch("user.created", &user.name);
    println!("{}", format_user(&user));
}
