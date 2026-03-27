package main

import (
	"fmt"
	"sync"
)

// Goroutine with channel
func producer(ch chan<- int, count int) {
	for i := 0; i < count; i++ {
		fmt.Println("Producing:", i)
		ch <- i
	}
	close(ch)
}

func consumer(ch <-chan int, done chan<- bool) {
	for val := range ch {
		fmt.Println("Consuming:", val)
	}
	done <- true
}

// Select statement with multiple channels
func multiplex(ch1, ch2 <-chan string) string {
	select {
	case msg := <-ch1:
		return "ch1: " + msg
	case msg := <-ch2:
		return "ch2: " + msg
	}
}

// WaitGroup pattern
func processItems(items []string) {
	var wg sync.WaitGroup
	for _, item := range items {
		wg.Add(1)
		go func(s string) {
			defer wg.Done()
			fmt.Println("Processing: " + s)
		}(item)
	}
	wg.Wait()
}

// Mutex-protected counter
type SafeCounter struct {
	mu sync.Mutex
	v  map[string]int
}

func (c *SafeCounter) Inc(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.v[key]++
}

func (c *SafeCounter) Value(key string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.v[key]
}
