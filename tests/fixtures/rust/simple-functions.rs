// Simple function with return type
fn greet(name: &str) -> String {
    println!("Hello, {}", name);
    format!("Hello, {}!", name)
}

// Function with multiple parameters
fn add(a: i32, b: i32) -> i32 {
    a + b
}

// Function with Result return type
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("division by zero".to_string())
    } else {
        Ok(a / b)
    }
}

// Generic function
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in &list[1..] {
        if item > largest {
            largest = item;
        }
    }
    largest
}

// Async function
async fn fetch_data(url: &str) -> Result<String, Box<dyn std::error::Error>> {
    println!("Fetching: {}", url);
    Ok(String::from("response"))
}

// Public function
pub fn format_date(year: u32, month: u32, day: u32) -> String {
    format!("{:04}-{:02}-{:02}", year, month, day)
}
