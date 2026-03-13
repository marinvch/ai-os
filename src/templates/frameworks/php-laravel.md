## Laravel / PHP Conventions

### MVC Structure
- `app/Http/Controllers/` — thin controllers
- `app/Services/` — business logic
- `app/Models/` — Eloquent models
- `app/Http/Requests/` — Form Request validation
- `routes/api.php` — API routes, `routes/web.php` — web routes

### Validation
- Always use **Form Requests** (`php artisan make:request`) for validation
- Never validate in controllers directly
- Return JSON errors for API routes automatically with Form Requests

### Eloquent ORM
- Use Eloquent relationships (`hasMany`, `belongsTo`, etc.)
- Eager load with `with()` to prevent N+1 queries
- Scope queries by user with `where('user_id', auth()->id())`
- Use model factories for testing

### Security
- CSRF protection on all state-changing web routes (automatic in Laravel)
- Parameterized queries via Eloquent — never raw string SQL
- Secrets in `.env` file — never in config files
- Use Laravel Sanctum or Passport for API auth

### Testing
- PHPUnit + Laravel test helpers
- `RefreshDatabase` trait for DB tests
- `actingAs($user)` for authenticated tests
- HTTP tests via `$this->getJson()`, `$this->postJson()`
