## Go Module Conventions

### Project Layout (Standard Go Layout)
- `cmd/` — main packages (entry points)
- `internal/` — private application code
- `pkg/` — reusable library code (if exported)
- `api/` — API definitions (protobuf, OpenAPI)
- `docs/` — documentation

### Code Style
- `gofmt` / `goimports` on all files — no exceptions
- Follow [Effective Go](https://go.dev/doc/effective_go) idioms
- Short variable names for small scopes, descriptive for package-level
- No global mutable state outside `main`

### Error Handling
- **Always** check and handle errors — no `_` discard of error values
- Wrap errors with context: `fmt.Errorf("loading config: %w", err)`
- Define sentinel errors with `errors.New` or custom types
- Return errors up, don't log and return (pick one)

### Concurrency
- Use `context.Context` for cancellation/timeouts — pass as first arg
- Prefer channels over shared memory for goroutine communication
- Use `sync.WaitGroup` or `errgroup` for goroutine orchestration
- Always close channels from the sender, not the receiver

### Testing
- Table-driven tests preferred (`t.Run` subtests)
- `testify` for assertions if already a dependency
- Interface mocks with `mockery` or hand-rolled
- Integration tests in `_test` packages

### Modules
- All imports use full module path
- Use `go mod tidy` before committing
- Pin external dependencies in `go.sum`
