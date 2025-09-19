# REST API Spec

```yaml
openapi: 3.0.0
info:
  title: Multi-Stage Keyword Optimization Tool API
  version: 1.0.0
  description: API for managing keyword research projects, users, and data.
servers:
  - url: /api/v1
    description: Production server
paths:
  /tenants:
    post:
      summary: Create a new tenant
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        '201':
          description: Tenant created successfully
  /projects:
    post:
      summary: Create a new project
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                domain:
                  type: string
      responses:
        '201':
          description: Project created successfully
```