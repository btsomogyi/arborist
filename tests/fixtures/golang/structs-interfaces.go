package main

import "fmt"

// Interface definition
type Speaker interface {
	Speak() string
	Name() string
}

// Struct with methods
type Animal struct {
	name  string
	sound string
}

func NewAnimal(name, sound string) *Animal {
	return &Animal{name: name, sound: sound}
}

func (a *Animal) Speak() string {
	fmt.Println(a.name + " says " + a.sound)
	return a.sound
}

func (a *Animal) Name() string {
	return a.name
}

// Embedded struct
type Dog struct {
	Animal
	breed string
}

func NewDog(name, breed string) *Dog {
	return &Dog{
		Animal: Animal{name: name, sound: "Woof"},
		breed:  breed,
	}
}

func (d *Dog) Speak() string {
	fmt.Println(d.name + " the " + d.breed + " barks")
	return "Woof!"
}

func (d *Dog) Fetch(item string) string {
	return d.name + " fetches " + item
}
