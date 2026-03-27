package main

import (
	"errors"
	"fmt"
)

// Custom error type
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation error: %s - %s", e.Field, e.Message)
}

// Sentinel errors
var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
)

// Error wrapping
func findUser(id int) (string, error) {
	if id <= 0 {
		return "", fmt.Errorf("findUser: %w", ErrNotFound)
	}
	return fmt.Sprintf("user-%d", id), nil
}

// Error checking with errors.Is
func processRequest(id int) error {
	_, err := findUser(id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			fmt.Println("User not found, creating default")
			return nil
		}
		return fmt.Errorf("processRequest: %w", err)
	}
	return nil
}

// Defer and recover
func safeDivide(a, b int) (result int, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered: %v", r)
		}
	}()
	return a / b, nil
}
