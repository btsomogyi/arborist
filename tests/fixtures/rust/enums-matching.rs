use std::fmt;

// Simple enum
#[derive(Debug)]
enum Color {
    Red,
    Green,
    Blue,
    Custom(u8, u8, u8),
}

impl fmt::Display for Color {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Color::Red => write!(f, "red"),
            Color::Green => write!(f, "green"),
            Color::Blue => write!(f, "blue"),
            Color::Custom(r, g, b) => write!(f, "#{:02x}{:02x}{:02x}", r, g, b),
        }
    }
}

// Enum with data variants
#[derive(Debug)]
enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Triangle { base: f64, height: f64 },
}

impl Shape {
    fn area(&self) -> f64 {
        match self {
            Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
            Shape::Rectangle { width, height } => width * height,
            Shape::Triangle { base, height } => 0.5 * base * height,
        }
    }

    fn describe(&self) -> String {
        match self {
            Shape::Circle { radius } => format!("Circle with radius {}", radius),
            Shape::Rectangle { width, height } => {
                println!("Describing rectangle");
                format!("Rectangle {}x{}", width, height)
            }
            Shape::Triangle { base, height } => format!("Triangle base={} height={}", base, height),
        }
    }
}

// Result and Option handling
fn find_item(items: &[&str], target: &str) -> Option<usize> {
    for (i, item) in items.iter().enumerate() {
        if *item == target {
            return Some(i);
        }
    }
    None
}

fn process_item(items: &[&str], target: &str) -> Result<String, String> {
    match find_item(items, target) {
        Some(idx) => Ok(format!("Found '{}' at index {}", target, idx)),
        None => Err(format!("'{}' not found", target)),
    }
}
