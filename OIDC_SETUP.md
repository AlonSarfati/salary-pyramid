# OIDC Authentication Setup Guide

This document describes how to set up and use the OIDC-based authentication system with closed-by-default access control.

## Overview

The system implements a **closed-by-default** access model where:
- Authentication is handled via OIDC (OpenID Connect)
- Authorization is fully controlled by admin-managed allowlist in the database
- Successful OIDC login does NOT grant access unless explicitly allowlisted
- Identity is keyed by `(issuer, subject)` pair, not email
- Email is used only for initial matching before binding

## Required Environment Variables

### OIDC Configuration

```bash
# Required: OIDC issuer URI
# Example for Keycloak: https://your-keycloak.com/realms/your-realm
# Example for Auth0: https://your-tenant.auth0.com/
OIDC_ISSUER_URI=https://your-oidc-provider.com/realms/your-realm
```

### Admin Key

```bash
# Required: Secret key for admin allowlist management endpoints
# Set this to a strong random string
LIRA_ADMIN_KEY=your-secret-admin-key-here
```

### Database Configuration

The system uses the existing PostgreSQL database. Ensure your database connection is configured in `application.properties` or environment variables.

## Database Schema

The system creates three tables:

1. **user_identity**: Stores OIDC identity information
   - `(issuer, subject)` is the unique identity key
   - Tracks email, display name, and last login time

2. **access_allowlist**: Admin-managed list of approved users
   - Can be matched by email (before binding) or `(issuer, subject)` (after binding)
   - Stores role, mode (SINGLE_TENANT/MULTI_TENANT), and status

3. **allowlist_tenants**: Maps allowlist entries to allowed tenant IDs

## How It Works

### First-Time Login Flow

1. User authenticates via OIDC and receives a JWT token
2. Frontend calls `/api/auth/me` with the JWT token
3. Backend extracts `(issuer, subject, email)` from JWT
4. System looks for allowlist entry by `(issuer, subject)` - not found
5. System looks for allowlist entry by `email` where `status=ACTIVE` - found
6. System **binds** the allowlist entry by setting `issuer` and `subject` on the allowlist row
7. System creates/updates `user_identity` record
8. User context is populated with role, mode, and allowed tenant IDs
9. Future logins will match by `(issuer, subject)` directly

### Subsequent Login Flow

1. User authenticates via OIDC
2. System finds allowlist entry by `(issuer, subject)` (already bound)
3. System updates `last_login_at` and populates user context
4. Access granted

### Access Denial

If user is not in allowlist:
- Returns `403 Forbidden` with JSON: `{"error": "ACCESS_DENIED", "message": "Your account is not approved yet."}`

If user is disabled:
- Returns `403 Forbidden` with JSON: `{"error": "ACCOUNT_DISABLED", "message": "Your account has been disabled."}`

## Admin API Usage

All admin endpoints require the `X-LIRA-ADMIN-KEY` header.

### Create Allowlist Entry

```bash
curl -X POST http://localhost:8080/api/admin/allowlist \
  -H "Content-Type: application/json" \
  -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here" \
  -d '{
    "email": "user@example.com",
    "mode": "SINGLE_TENANT",
    "role": "ANALYST",
    "notes": "Initial setup",
    "tenantIds": ["default"]
  }'
```

**Response:**
```json
{
  "id": "uuid-here",
  "email": "user@example.com",
  "status": "ACTIVE",
  "mode": "SINGLE_TENANT",
  "role": "ANALYST",
  "tenantIds": ["default"]
}
```

### List All Allowlist Entries

```bash
curl http://localhost:8080/api/admin/allowlist \
  -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here"
```

### Disable User

```bash
curl -X POST http://localhost:8080/api/admin/allowlist/{id}/disable \
  -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here"
```

### Enable User

```bash
curl -X POST http://localhost:8080/api/admin/allowlist/{id}/enable \
  -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here"
```

### Update Allowed Tenants

```bash
curl -X POST http://localhost:8080/api/admin/allowlist/{id}/tenants \
  -H "Content-Type: application/json" \
  -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here" \
  -d '{
    "tenantIds": ["default", "tenant2"]
  }'
```

## User Roles

- **ADMIN**: Full administrative access (future use)
- **ANALYST**: Can create/edit rules and run simulations
- **VIEWER**: Read-only access

## User Modes

- **SINGLE_TENANT**: User can only access one tenant (first tenant in `tenantIds` list)
- **MULTI_TENANT**: User can access all tenants in `tenantIds` list

## Frontend Integration

After OIDC login, the frontend should:

1. Call `GET /api/auth/me` with the JWT token in `Authorization: Bearer <token>` header
2. If response is `403` with `ACCESS_DENIED`, show "Not approved" screen
3. If response is `200`, extract:
   - `userIdentity`: User info (issuer, subject, email, displayName)
   - `role`: User role
   - `mode`: SINGLE_TENANT or MULTI_TENANT
   - `allowedTenantIds`: List of accessible tenant IDs
   - `primaryTenantId`: If SINGLE_TENANT mode, the single tenant ID

Example response:
```json
{
  "userIdentity": {
    "issuer": "https://keycloak.example.com/realms/myrealm",
    "subject": "user-uuid-123",
    "email": "user@example.com",
    "displayName": "John Doe"
  },
  "role": "ANALYST",
  "mode": "SINGLE_TENANT",
  "allowedTenantIds": ["default"],
  "primaryTenantId": "default"
}
```

## Testing Locally

### 1. Set Environment Variables

```bash
export OIDC_ISSUER_URI=https://your-oidc-provider.com/realms/your-realm
export LIRA_ADMIN_KEY=test-admin-key-123
```

### 2. Start the Application

The application will automatically:
- Run Flyway migrations (creates auth tables)
- Configure OIDC resource server
- Enable access gate filter

### 3. Create First Allowlist Entry

```bash
curl -X POST http://localhost:8080/api/admin/allowlist \
  -H "Content-Type: application/json" \
  -H "X-LIRA-ADMIN-KEY: test-admin-key-123" \
  -d '{
    "email": "admin@example.com",
    "mode": "MULTI_TENANT",
    "role": "ADMIN",
    "notes": "Initial admin user",
    "tenantIds": ["default"]
  }'
```

### 4. Test Authentication

1. Authenticate via your OIDC provider
2. Get JWT token
3. Call `/api/auth/me`:
   ```bash
   curl http://localhost:8080/api/auth/me \
     -H "Authorization: Bearer <your-jwt-token>"
   ```

## Security Notes

- The admin key should be a strong random string (at least 32 characters)
- Store the admin key securely (environment variable, secrets manager)
- The admin key protection is temporary - will be replaced with role-based admin access once users exist
- All `/api/**` endpoints (except `/api/auth/me` and `/api/actuator/**`) require authentication AND allowlist approval
- JWT tokens are validated against the OIDC issuer's public keys

## Troubleshooting

### "Authentication required" error

- Check that JWT token is being sent in `Authorization: Bearer <token>` header
- Verify `OIDC_ISSUER_URI` is correctly configured
- Check that OIDC provider is accessible from the application

### "Your account is not approved yet" error

- User needs to be added to allowlist via admin API
- Check that email matches exactly (case-sensitive)
- Verify allowlist entry has `status=ACTIVE`

### "Invalid token: missing issuer or subject"

- JWT token is malformed or from wrong issuer
- Verify token contains `iss` and `sub` claims

### Admin endpoints return 401

- Check `X-LIRA-ADMIN-KEY` header is present
- Verify `LIRA_ADMIN_KEY` environment variable matches the header value

