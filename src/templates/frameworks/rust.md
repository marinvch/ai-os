## Rust Conventions

### Project Structure
- `src/main.rs` or `src/lib.rs` as entry point
- Modules in `src/` as files or folders with `mod.rs`
- Integration tests in `tests/`
- Benchmarks in `benches/`

### Error Handling
- Use `anyhow` for application errors, `thiserror` for library errors
- Prefer `?` operator over explicit `match` for error propagation
- Never use `unwrap()` in production code — use `expect("reason")` at minimum
- Return `Result<T, E>` from all fallible functions

### Ownership & Lifetimes
- Prefer owned types over references in public APIs when feasible
- Use `Arc<T>` for shared ownership, `Rc<T>` only in single-threaded contexts
- `Clone` derive is fine for small types; avoid cloning large data in hot paths

### Async (if applicable)
- Use `tokio` as the async runtime
- `async fn` returns `impl Future` — annotate with `#[tokio::main]`
- Use `tokio::spawn` for background tasks, `tokio::join!` for concurrent awaits

### Code Style
- `rustfmt` on all files (via `cargo fmt`)
- `clippy` warnings must pass (`cargo clippy -- -D warnings`)
- `derive` macros preferred: `Debug`, `Clone`, `PartialEq`, `serde::Serialize/Deserialize`

### Testing
- Unit tests in same file with `#[cfg(test)]` module
- Integration tests in `tests/` directory
- Use `pretty_assertions` for readable test output
