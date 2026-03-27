package main

import "fmt"

// Simple function with return type
func greet(name string) string {
	fmt.Println("Hello, " + name)
	return "Hello, " + name
}

// Function with multiple return values
func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, fmt.Errorf("division by zero")
	}
	return a / b, nil
}

// Variadic function
func sum(numbers ...int) int {
	total := 0
	for _, n := range numbers {
		total += n
	}
	return total
}

// Function with named return values
func createUser(name string, age int) (user string, err error) {
	if name == "" {
		err = fmt.Errorf("name required")
		return
	}
	user = fmt.Sprintf("%s (age %d)", name, age)
	return
}

// Exported function
func FormatDate(year, month, day int) string {
	return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
}
