## Ruby on Rails Conventions

### MVC Structure
- Thin controllers, fat models (or service objects for complex logic)
- Service objects in `app/services/` for non-trivial business logic
- Form objects in `app/forms/` for complex form handling
- Presenters/decorators in `app/decorators/`

### ActiveRecord
- Validate in models — `validates :email, presence: true, uniqueness: true`
- Use scopes for reusable query logic
- Eager load with `includes()` to prevent N+1
- Database constraints + model validations (defense in depth)

### Security
- `strong_parameters` — always whitelist params with `permit()`
- CSRF protection enabled by default — never disable
- Brakeman for security scanning
- Credentials in `config/credentials.yml.enc` or environment variables

### API (Rails API mode)
- `respond_to :json` in API controllers
- Serializers via ActiveModel::Serializer or jsonapi-serializer
- Pagination with Kaminari or Pagy
- JWT or Devise Token Auth for API authentication

### Testing
- RSpec with FactoryBot
- `let` / `let!` for test data, `subject` for the object under test
- Shoulda Matchers for model validations
- VCR / WebMock for external HTTP calls
