use std::fmt;

// Trait definition
trait Speaker {
    fn speak(&self) -> String;
    fn name(&self) -> &str;
}

// Struct with fields
struct Animal {
    name: String,
    sound: String,
}

impl Animal {
    fn new(name: &str, sound: &str) -> Self {
        Animal {
            name: name.to_string(),
            sound: sound.to_string(),
        }
    }
}

impl Speaker for Animal {
    fn speak(&self) -> String {
        println!("{} says {}", self.name, self.sound);
        self.sound.clone()
    }

    fn name(&self) -> &str {
        &self.name
    }
}

impl fmt::Display for Animal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({})", self.name, self.sound)
    }
}

// Struct with derived traits
#[derive(Debug, Clone, PartialEq)]
struct Dog {
    name: String,
    breed: String,
}

impl Dog {
    fn new(name: &str, breed: &str) -> Self {
        Dog {
            name: name.to_string(),
            breed: breed.to_string(),
        }
    }

    fn fetch(&self, item: &str) -> String {
        format!("{} fetches {}", self.name, item)
    }
}

impl Speaker for Dog {
    fn speak(&self) -> String {
        println!("{} the {} barks", self.name, self.breed);
        String::from("Woof!")
    }

    fn name(&self) -> &str {
        &self.name
    }
}
