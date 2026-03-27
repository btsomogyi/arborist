// Ownership and borrowing
fn take_ownership(s: String) -> String {
    println!("Got: {}", s);
    s
}

fn borrow_string(s: &str) -> usize {
    println!("Borrowed: {}", s);
    s.len()
}

fn mutable_borrow(s: &mut String) {
    s.push_str(" world");
    println!("Modified: {}", s);
}

// Lifetime annotations
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}

// Struct with lifetime
struct Excerpt<'a> {
    text: &'a str,
}

impl<'a> Excerpt<'a> {
    fn level(&self) -> i32 {
        3
    }

    fn announce(&self, announcement: &str) -> &str {
        println!("Attention: {}", announcement);
        self.text
    }
}

// Iterator pattern
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[0..i];
        }
    }
    &s[..]
}

// Closure examples
fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y
}

fn apply_twice<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 {
    f(f(x))
}
