use std::fmt;
use std::num::ParseIntError;

// Custom error type
#[derive(Debug)]
enum AppError {
    NotFound(String),
    ParseError(ParseIntError),
    Custom(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::NotFound(item) => write!(f, "not found: {}", item),
            AppError::ParseError(e) => write!(f, "parse error: {}", e),
            AppError::Custom(msg) => write!(f, "error: {}", msg),
        }
    }
}

impl From<ParseIntError> for AppError {
    fn from(err: ParseIntError) -> Self {
        AppError::ParseError(err)
    }
}

// Using the ? operator
fn parse_and_double(s: &str) -> Result<i32, AppError> {
    let n: i32 = s.parse()?;
    Ok(n * 2)
}

fn find_user(id: u32) -> Result<String, AppError> {
    if id == 0 {
        return Err(AppError::NotFound("user".to_string()));
    }
    println!("Found user {}", id);
    Ok(format!("user-{}", id))
}

// Chaining Results
fn process_request(input: &str) -> Result<String, AppError> {
    let id = parse_and_double(input)?;
    let user = find_user(id as u32)?;
    println!("Processing: {}", user);
    Ok(format!("Processed: {}", user))
}
