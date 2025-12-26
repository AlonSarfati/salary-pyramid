# Local Development Guide

## Running Without Keycloak (Auth Disabled)

For local development, you can run the Spring Boot backend without Keycloak/OIDC authentication.

### Quick Start

1. **Run with staging profile:**
   ```bash
   mvn spring-boot:run -Dspring-boot.run.profiles=staging
   ```
   
   Or set the environment variable:
   ```bash
   export SPRING_PROFILES_ACTIVE=staging
   mvn spring-boot:run
   ```

2. **The staging profile:**
   - Sets `app.security.mode=permit-all` (disables authentication)
   - Configures local PostgreSQL database connection
   - All API endpoints are accessible without authentication

### Security Modes

The application supports two security modes controlled by `app.security.mode`:

- **`permit-all`** (local development):
  - No authentication required
  - All requests are permitted
  - Stateless sessions
  - CSRF disabled

- **`oidc`** (default, production):
  - Requires OAuth2/OIDC authentication (Keycloak)
  - JWT token validation via OAuth2 Resource Server
  - AccessGateFilter enforces allowlist
  - Requires `spring.security.oauth2.resourceserver.jwt.issuer-uri` to be set

### Production Setup

For production deployments with OIDC:

1. Set `app.security.mode=oidc` (default)
2. Configure the OIDC issuer URI:
   ```properties
   spring.security.oauth2.resourceserver.jwt.issuer-uri=https://your-keycloak-domain.com/realms/your-realm
   ```
   Or via environment variable:
   ```bash
   export OIDC_ISSUER_URI=https://your-keycloak-domain.com/realms/your-realm
   ```

3. Health endpoints (`/actuator/health/**`) remain open for ALB health checks

### Configuration Files

- `application.properties`: Default configuration
- `application-staging.properties`: Staging profile (mode=permit-all, local development)
- `application-prod.properties`: Production environment (mode=oidc, requires OIDC issuer URI)

