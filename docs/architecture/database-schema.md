# Database Schema

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ai_api_keys JSONB -- Stores multiple AI API keys as a JSON object
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    tenant_id UUID REFERENCES tenants(id)
);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id),
    UNIQUE (name, tenant_id)
);
```