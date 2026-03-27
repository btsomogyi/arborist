package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"sync"
	"time"
)

// Configuration constants
const (
	DefaultTimeout = 5000
	MaxRetries     = 3
	BatchSize      = 100
)

// logMsg is a simple logging wrapper for benchmark testing.
func logMsg(args ...interface{}) {
	fmt.Println(args...)
}

// Config holds application configuration.
type Config struct {
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Debug          bool   `json:"debug"`
	MaxConnections int    `json:"max_connections"`
}

// User represents a user entity.
type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

// QueryResult holds paginated query results.
type QueryResult struct {
	Data     []User `json:"data"`
	Total    int    `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// EventHandler is a function type for handling events.
type EventHandler func(event string, data interface{})

// DatabaseConnection manages database connections.
type DatabaseConnection struct {
	config     Config
	connected  bool
	retryCount int
	mu         sync.Mutex
}

// NewDatabaseConnection creates a new database connection.
func NewDatabaseConnection(config Config) *DatabaseConnection {
	logMsg("DatabaseConnection created with config:", config)
	return &DatabaseConnection{config: config}
}

// Connect establishes the database connection.
func (db *DatabaseConnection) Connect() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	fmt.Printf("Connecting to %s:%d...\n", db.config.Host, db.config.Port)
	db.connected = true
	db.retryCount = 0
	logMsg("Connected successfully")
	return nil
}

// Disconnect closes the database connection.
func (db *DatabaseConnection) Disconnect() error {
	db.mu.Lock()
	defer db.mu.Unlock()
	logMsg("Disconnecting...")
	db.connected = false
	logMsg("Disconnected")
	return nil
}

// IsConnected returns the connection status.
func (db *DatabaseConnection) IsConnected() bool {
	db.mu.Lock()
	defer db.mu.Unlock()
	return db.connected
}

// UserRepository provides user data access.
type UserRepository struct {
	db    *DatabaseConnection
	cache map[string]*User
	mu    sync.RWMutex
}

// NewUserRepository creates a new user repository.
func NewUserRepository(db *DatabaseConnection) *UserRepository {
	logMsg("UserRepository initialized")
	return &UserRepository{
		db:    db,
		cache: make(map[string]*User),
	}
}

// FindByID retrieves a user by ID.
func (r *UserRepository) FindByID(id string) (*User, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	fmt.Printf("Finding user by id: %s\n", id)
	user, ok := r.cache[id]
	if ok {
		fmt.Printf("Cache hit for user %s\n", id)
	} else {
		fmt.Printf("Cache miss for user %s, querying database\n", id)
	}
	return user, ok
}

// FindByEmail retrieves a user by email.
func (r *UserRepository) FindByEmail(email string) (*User, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	fmt.Printf("Finding user by email: %s\n", email)
	for _, user := range r.cache {
		if user.Email == email {
			return user, true
		}
	}
	return nil, false
}

// FindAll returns paginated users.
func (r *UserRepository) FindAll(page, pageSize int) QueryResult {
	r.mu.RLock()
	defer r.mu.RUnlock()
	fmt.Printf("Fetching users page %d, size %d\n", page, pageSize)
	users := make([]User, 0, len(r.cache))
	for _, u := range r.cache {
		users = append(users, *u)
	}
	start := (page - 1) * pageSize
	end := start + pageSize
	if end > len(users) {
		end = len(users)
	}
	if start > len(users) {
		start = len(users)
	}
	return QueryResult{
		Data:     users[start:end],
		Total:    len(users),
		Page:     page,
		PageSize: pageSize,
	}
}

// Create adds a new user.
func (r *UserRepository) Create(user *User) *User {
	r.mu.Lock()
	defer r.mu.Unlock()
	fmt.Printf("Creating user: %s\n", user.Name)
	r.cache[user.ID] = user
	fmt.Printf("User %s created successfully\n", user.Name)
	return user
}

// Update modifies an existing user.
func (r *UserRepository) Update(id string, name string, email string) (*User, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fmt.Printf("Updating user %s\n", id)
	user, ok := r.cache[id]
	if !ok {
		fmt.Printf("User %s not found for update\n", id)
		return nil, false
	}
	if name != "" {
		user.Name = name
	}
	if email != "" {
		user.Email = email
	}
	fmt.Printf("User %s updated successfully\n", id)
	return user, true
}

// Delete removes a user.
func (r *UserRepository) Delete(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	fmt.Printf("Deleting user %s\n", id)
	_, ok := r.cache[id]
	if ok {
		delete(r.cache, id)
		fmt.Printf("User %s deleted\n", id)
	} else {
		fmt.Printf("User %s not found\n", id)
	}
	return ok
}

// GetCacheSize returns the number of cached users.
func (r *UserRepository) GetCacheSize() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.cache)
}

// EventBus provides pub/sub event handling.
type EventBus struct {
	handlers map[string][]EventHandler
	eventLog []EventEntry
	mu       sync.RWMutex
}

// EventEntry records a dispatched event.
type EventEntry struct {
	Event     string    `json:"event"`
	Timestamp time.Time `json:"timestamp"`
}

// NewEventBus creates a new event bus.
func NewEventBus() *EventBus {
	logMsg("EventBus initialized")
	return &EventBus{
		handlers: make(map[string][]EventHandler),
	}
}

// Register adds a handler for an event.
func (eb *EventBus) Register(event string, handler EventHandler) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	fmt.Printf("Registering handler for event: %s\n", event)
	eb.handlers[event] = append(eb.handlers[event], handler)
}

// Dispatch triggers all handlers for an event.
func (eb *EventBus) Dispatch(event string, data interface{}) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	fmt.Printf("Dispatching event: %s\n", event)
	eb.eventLog = append(eb.eventLog, EventEntry{Event: event, Timestamp: time.Now()})
	for _, handler := range eb.handlers[event] {
		handler(event, data)
	}
}

// ValidateEmail checks if an email address is valid.
func ValidateEmail(email string) bool {
	fmt.Printf("Validating email: %s\n", email)
	return len(email) > 3 && containsChar(email, '@') && containsChar(email, '.')
}

func containsChar(s string, c byte) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return true
		}
	}
	return false
}

// GenerateID creates a random identifier.
func GenerateID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 15)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

// FormatUser returns a formatted string for a user.
func FormatUser(user *User) string {
	fmt.Printf("Formatting user: %s\n", user.Name)
	return fmt.Sprintf("%s <%s> (%s)", user.Name, user.Email, user.Role)
}

// LoadConfig reads configuration from a JSON file.
func LoadConfig(path string) (*Config, error) {
	fmt.Printf("Loading config from %s\n", path)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read config: %w", err)
	}
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("cannot parse config: %w", err)
	}
	logMsg("Config loaded:", config)
	return &config, nil
}

// SaveConfig writes configuration to a JSON file.
func SaveConfig(path string, config *Config) error {
	logMsg("Saving config to", path)
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("cannot marshal config: %w", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("cannot write config: %w", err)
	}
	logMsg("Config saved")
	return nil
}

// ProcessItems splits items into batches.
func ProcessItems(items []interface{}, batchSize int) [][]interface{} {
	fmt.Printf("Processing %d items in batches of %d\n", len(items), batchSize)
	var batches [][]interface{}
	for i := 0; i < len(items); i += batchSize {
		end := i + batchSize
		if end > len(items) {
			end = len(items)
		}
		batches = append(batches, items[i:end])
	}
	fmt.Printf("Created %d batches\n", len(batches))
	return batches
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	config := Config{
		Host:           "localhost",
		Port:           5432,
		Debug:          true,
		MaxConnections: 10,
	}
	db := NewDatabaseConnection(config)
	if err := db.Connect(); err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer db.Disconnect()

	repo := NewUserRepository(db)
	bus := NewEventBus()

	user := &User{
		ID:        GenerateID(),
		Name:      "Alice",
		Email:     "alice@example.com",
		Role:      "admin",
		CreatedAt: time.Now(),
	}
	repo.Create(user)
	bus.Dispatch("user.created", user)
	fmt.Println(FormatUser(user))
}
