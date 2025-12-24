# Admin Pages Explanation

## System-Level Pages (SYSTEM_ADMIN only)

### 1. **Manage Tenants** (`/admin/tenants`)
**What it does:** Manages tenant entities themselves
- Create new tenant objects (tenantId, name, status, currency)
- Edit existing tenant properties
- Deactivate tenants (soft delete)
- **This is about the tenant objects, not their settings**

**Database:** `tenant` table

**Use case:** When you need to create a new tenant organization or deactivate an existing one.

---

### 2. **System Access** (`/admin/global-users`)
**What it does:** Grants system-level access to users
- Add users to the system allowlist (`access_allowlist` table)
- Grant roles: SYSTEM_ADMIN, SYSTEM_ANALYST, SYSTEM_VIEWER
- Set access mode: SINGLE_TENANT or MULTI_TENANT
- Specify which tenants they can access (or all tenants)
- Enable/disable system access

**Database:** `access_allowlist` and `allowlist_tenants` tables

**Use case:** When you need to grant initial system access to a user. These users can access multiple or all tenants based on their role and mode.

---

## Tenant-Level Pages (TENANT_ADMIN or SYSTEM_ADMIN)

### 3. **Team Members** (`/admin/users`)
**What it does:** Manages users who are members of a specific tenant
- Invite users to join this tenant
- Assign tenant roles: TENANT_ADMIN, TENANT_EDITOR, TENANT_VIEWER
- Manage user status (ACTIVE, DISABLED, REMOVED)
- View pending invitations
- **This is scoped to the currently selected tenant**

**Database:** `tenant_users` and `tenant_invites` tables

**Use case:** When you need to add team members to a specific tenant or manage their permissions within that tenant.

---

### 4. **Tenant Configuration** (`/admin/tenant`)
**What it does:** Configures settings for a specific tenant
- Tenant profile (name, timezone)
- Currency & locale settings
- Rounding preferences
- Export formats (CSV, XLSX, PDF)
- Data retention settings
- Security settings (SSO requirements, allowed email domains, session timeout)
- **This is scoped to the currently selected tenant**

**Database:** `tenant_settings` table

**Use case:** When you need to configure how a tenant operates (what currency they use, export formats, security policies, etc.).

---

## Key Differences Summary

| Page | Scope | What It Manages | Database Table |
|------|-------|----------------|----------------|
| **Manage Tenants** | System-wide | Tenant entities (create/edit/deactivate) | `tenant` |
| **System Access** | System-wide | System-level user access (all tenants) | `access_allowlist` |
| **Team Members** | Per-tenant | Tenant-specific user memberships | `tenant_users` |
| **Tenant Configuration** | Per-tenant | Tenant settings and preferences | `tenant_settings` |

## User Flow Example

1. **System Admin creates a tenant:**
   - Go to "Manage Tenants" → Create new tenant (e.g., "Acme Corp")

2. **System Admin grants system access:**
   - Go to "System Access" → Add user with SYSTEM_ADMIN role
   - This user can now access all tenants

3. **Tenant Admin adds team members:**
   - Select "Acme Corp" tenant
   - Go to "Team Members" → Invite users
   - These users become members of "Acme Corp" tenant

4. **Tenant Admin configures tenant:**
   - Select "Acme Corp" tenant
   - Go to "Tenant Configuration" → Set currency to USD, timezone to EST, etc.

