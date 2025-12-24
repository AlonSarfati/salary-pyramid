# Admin Key Setup

## Do You Have an Admin Key?

**No, you don't have one set yet.** The admin key is configured via the `LIRA_ADMIN_KEY` environment variable.

## How to Set the Admin Key

### Option 1: Environment Variable (Recommended)

Set the environment variable before starting the application:

**Windows (PowerShell):**
```powershell
$env:LIRA_ADMIN_KEY="your-secret-admin-key-here"
```

**Windows (CMD):**
```cmd
set LIRA_ADMIN_KEY=your-secret-admin-key-here
```

**Linux/Mac:**
```bash
export LIRA_ADMIN_KEY="your-secret-admin-key-here"
```

### Option 2: Application Properties

Add to `api/src/main/resources/application-staging.properties` or `application-prod.properties`:

```properties
lira.admin.key=your-secret-admin-key-here
```

**⚠️ Security Warning:** Don't commit the actual key to version control! Use environment variables in production.

## Generate a Strong Admin Key

Use a strong random string. Here are some options:

**Using PowerShell (Windows):**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Using OpenSSL (Linux/Mac):**
```bash
openssl rand -hex 32
```

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Create Your First Allowlist Entry

Once you have the admin key set, create an allowlist entry for yourself:

**Windows CMD (single line):**
```cmd
curl -X POST http://localhost:8080/api/admin/allowlist -H "Content-Type: application/json" -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here" -d "{\"email\": \"your.email@company.com\", \"mode\": \"MULTI_TENANT\", \"role\": \"ADMIN\", \"notes\": \"Initial admin user\", \"tenantIds\": [\"default\"]}"
```

**PowerShell (single line):**
```powershell
curl -X POST http://localhost:8080/api/admin/allowlist -H "Content-Type: application/json" -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here" -d '{\"email\": \"your.email@company.com\", \"mode\": \"MULTI_TENANT\", \"role\": \"ADMIN\", \"notes\": \"Initial admin user\", \"tenantIds\": [\"default\"]}'
```

**Linux/Mac (single line):**
```bash
curl -X POST http://localhost:8080/api/admin/allowlist -H "Content-Type: application/json" -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here" -d '{"email": "your.email@company.com", "mode": "MULTI_TENANT", "role": "ADMIN", "notes": "Initial admin user", "tenantIds": ["default"]}'
```

Replace:
- `your-secret-admin-key-here` with your actual admin key (from `application-staging.properties`)
- `your.email@company.com` with your email address

## Verify It Works

Check that your entry was created:

**Windows CMD:**
```cmd
curl http://localhost:8080/api/admin/allowlist -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here"
```

**PowerShell/Linux/Mac:**
```bash
curl http://localhost:8080/api/admin/allowlist -H "X-LIRA-ADMIN-KEY: your-secret-admin-key-here"
```

You should see your allowlist entry in the response.

## Next Steps

1. **Set up OIDC** (if not already done):
   - Configure `OIDC_ISSUER_URI` environment variable
   - Set up your OIDC provider (Keycloak, Auth0, Okta, etc.)

2. **Login via OIDC** in your frontend
   - The frontend will call `/api/auth/me` with your JWT token
   - If your email matches the allowlist entry, you'll be granted access

3. **The allowlist entry will be bound** to your `(issuer, subject)` on first successful login

