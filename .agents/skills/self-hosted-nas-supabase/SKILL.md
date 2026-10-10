---
name: self-hosted-nas-supabase
description: >-
  Complete architecture, deployment, troubleshooting, and production guide for running a
  self-hosted, isolated Supabase-compatible stack (PostgreSQL 15, GoTrue Auth, PostgREST,
  Nginx Gateway, Adminer) on a home NAS (UGREEN, Synology, QNAP, TrueNAS) connected to
  Vercel/web apps via Cloudflare Tunnel with Google OAuth. Use whenever deploying, configuring,
  or troubleshooting self-hosted Supabase, NAS Docker environments, CORS issues, GoTrue migrations,
  or Cloudflare Tunnel database connections.
---

# Self-Hosted Isolated Supabase on Home NAS (UGREEN / Synology / QNAP)

This skill provides the battle-tested, end-to-end blueprint for deploying an isolated, production-ready Supabase stack on a home NAS behind a Cloudflare Tunnel, connecting seamlessly to a web application (Vercel, Vite, React, Next.js, or mobile APK) with Google OAuth.

---

## 1. Architectural Blueprint & Topology

```
+-----------------------------------------------------------------------------------+
|                                  PUBLIC INTERNET                                  |
|                                                                                   |
|  [Vercel Web App]                           [Google Cloud OAuth]                  |
|  https://my-app.vercel.app                  Redirect: .../auth/v1/callback        |
+--------------------------+---------------------------------+----------------------+
                           |                                 ^
                           v                                 |
           +-------------------------------+                 |
           |   Cloudflare Zero Trust       |                 |
           |   Tunnel (HTTPS)              |                 |
           |   https://budget-db.domain.com|                 |
           +---------------+---------------+                 |
                           |                                 |
+--------------------------v---------------------------------+----------------------+
|                     LOCAL NETWORK / HOME NAS (e.g. 10.0.0.16)                     |
|                                                                                   |
|  Port 8100 (Gateway)                                                              |
|  +-----------------------------------------------------------------------------+  |
|  | home_budget_gateway (Nginx Alpine)                                          |  |
|  | - Handles Full CORS Preflight (OPTIONS 204)                                 |  |
|  | - Route /auth/v1/*  --> home_budget_auth:9999                               |  |
|  | - Route /rest/v1/*  --> home_budget_rest:3000                               |  |
|  +--------------------+--------------------------------+-----------------------+  |
|                       |                                |                          |
|                       v                                v                          |
|  +--------------------+-------+       +----------------+------+                   |
|  | home_budget_auth (GoTrue)  |       | home_budget_rest      |                   |
|  | - Port 9999 (Internal)     |       | (PostgREST v12.2)     |                   |
|  | - Social OAuth & JWTs      |       | - Port 3000 (Internal)|                   |
|  +--------------------+-------+       +----------------+------+                   |
|                       |                                |                          |
|                       +---------------+----------------+                          |
|                                       |                                           |
|                                       v                                           |
|                       +---------------+-----------------------+                   |
|                       | home_budget_db (PostgreSQL 15)        |                   |
|                       | - Port 5432 (Internal)                |                   |
|                       | - Schemas: public, auth               |                   |
|                       | - search_path: auth, public           |                   |
|                       | - Volume: home_budget_data_v1         |                   |
|                       +---------------------------------------+                   |
|                                       ^                                           |
|  Port 8088 (Local Web UI)             |                                           |
|  +------------------------------------+-----------------------+                   |
|  | home_budget_adminer (Web Database Management Console)      |                   |
|  +------------------------------------------------------------+                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Docker Compose Production Template (`docker-compose.yml`)

Save this file on the NAS (or in Docker Manager / Portainer):

```yaml
version: '3.8'

services:
  # ---------------------------------------------------------------------------
  # 1. PostgreSQL 15 - Isolated Database
  # ---------------------------------------------------------------------------
  home_budget_db:
    image: postgres:15-alpine
    container_name: home_budget_db
    restart: always
    environment:
      POSTGRES_DB: home_budget
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: YourSecurePassword2026!
    volumes:
      - home_budget_data_v1:/var/lib/postgresql/data
    networks:
      - home_budget_net

  # ---------------------------------------------------------------------------
  # 2. Database Initializer (Extensions, Schemas & search_path Fix)
  # ---------------------------------------------------------------------------
  home_budget_init:
    image: postgres:15-alpine
    container_name: home_budget_init
    restart: "no"
    depends_on:
      - home_budget_db
    networks:
      - home_budget_net
    entrypoint: >
      sh -c "until pg_isready -h home_budget_db -U postgres; do sleep 1; done;
      PGPASSWORD=YourSecurePassword2026! psql -h home_budget_db -U postgres -d home_budget -c '
      CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
      CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
      CREATE SCHEMA IF NOT EXISTS auth;
      ALTER DATABASE home_budget SET search_path TO auth, public;
      ALTER ROLE postgres SET search_path TO auth, public;
      ';"

  # ---------------------------------------------------------------------------
  # 3. PostgREST v12 - REST API Engine
  # ---------------------------------------------------------------------------
  home_budget_rest:
    image: postgrest/postgrest:v12.2.0
    container_name: home_budget_rest
    restart: always
    depends_on:
      - home_budget_db
    environment:
      PGRST_DB_URI: "postgres://postgres:YourSecurePassword2026!@home_budget_db:5432/home_budget"
      PGRST_DB_SCHEMA: "public"
      PGRST_DB_ANON_ROLE: "postgres"
      PGRST_JWT_SECRET: "YourAtLeast32CharsLongJWTSecretKeyHere2026!!"
      PGRST_SERVER_CORS_ALLOWED_ORIGINS: "*"
    networks:
      - home_budget_net

  # ---------------------------------------------------------------------------
  # 4. Supabase GoTrue Auth (v2.132.3 LTS) - Authentication & Social OAuth
  # ---------------------------------------------------------------------------
  home_budget_auth:
    image: supabase/gotrue:v2.132.3
    container_name: home_budget_auth
    restart: always
    depends_on:
      - home_budget_db
      - home_budget_init
    environment:
      GOTRUE_API_HOST: "0.0.0.0"
      GOTRUE_API_PORT: "9999"
      API_EXTERNAL_URL: "https://budget-db.yourdomain.com/auth/v1"
      GOTRUE_API_EXTERNAL_URL: "https://budget-db.yourdomain.com/auth/v1"
      GOTRUE_DB_DRIVER: "postgres"
      GOTRUE_DB_DATABASE_URL: "postgres://postgres:YourSecurePassword2026!@home_budget_db:5432/home_budget?sslmode=disable"
      DATABASE_URL: "postgres://postgres:YourSecurePassword2026!@home_budget_db:5432/home_budget?sslmode=disable"
      GOTRUE_SITE_URL: "https://your-app.vercel.app"
      GOTRUE_URI_ALLOW_LIST: "https://your-app.vercel.app,https://your-app.vercel.app/*,http://localhost:5173,http://localhost:5173/*"
      GOTRUE_ADDITIONAL_REDIRECT_URLS: "https://your-app.vercel.app,https://your-app.vercel.app/*,http://localhost:5173,http://localhost:5173/*"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_SECRET: "YourAtLeast32CharsLongJWTSecretKeyHere2026!!"
      GOTRUE_JWT_EXP: "3600"
      GOTRUE_JWT_AUD: "authenticated"
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated"
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
      GOTRUE_EXTERNAL_GOOGLE_SECRET: "YOUR_GOOGLE_CLIENT_SECRET"
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: "https://budget-db.yourdomain.com/auth/v1/callback"
    networks:
      - home_budget_net

  # ---------------------------------------------------------------------------
  # 5. Nginx Gateway - Robust Reverse Proxy with Full CORS Preflight & Health Check
  # ---------------------------------------------------------------------------
  home_budget_gateway:
    image: nginx:alpine
    container_name: home_budget_gateway
    restart: always
    ports:
      - "8100:80"
    depends_on:
      - home_budget_rest
      - home_budget_auth
    command: >
      sh -c "echo 'server { listen 80; client_max_body_size 50M; resolver 127.0.0.11 ipv6=off valid=5s; location ~ ^/auth/v1/(.*)\$$ { if (\$$request_method = \"OPTIONS\") { add_header \"Access-Control-Allow-Origin\" \"*\" always; add_header \"Access-Control-Allow-Methods\" \"GET, POST, PUT, PATCH, DELETE, OPTIONS\" always; add_header \"Access-Control-Allow-Headers\" \"*\" always; return 204; } set \$$upstream_auth http://home_budget_auth:9999; proxy_pass \$$upstream_auth/\$$1\$$is_args\$$args; proxy_set_header Host \$$host; proxy_set_header X-Real-IP \$$remote_addr; proxy_set_header X-Forwarded-Proto https; } location ~ ^/rest/v1/(.*)\$$ { if (\$$request_method = \"OPTIONS\") { add_header \"Access-Control-Allow-Origin\" \"*\" always; add_header \"Access-Control-Allow-Methods\" \"GET, POST, PUT, PATCH, DELETE, OPTIONS\" always; add_header \"Access-Control-Allow-Headers\" \"*\" always; return 204; } add_header \"Access-Control-Allow-Origin\" \"*\" always; add_header \"Access-Control-Allow-Methods\" \"GET, POST, PUT, PATCH, DELETE, OPTIONS\" always; add_header \"Access-Control-Allow-Headers\" \"*\" always; add_header \"Access-Control-Expose-Headers\" \"*\" always; set \$$upstream_rest http://home_budget_rest:3000; proxy_pass \$$upstream_rest/\$$1\$$is_args\$$args; proxy_set_header Host \$$host; proxy_set_header X-Real-IP \$$remote_addr; proxy_set_header X-Forwarded-Proto https; } location /health { return 200 OK; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
    networks:
      - home_budget_net

  # ---------------------------------------------------------------------------
  # 6. Adminer Web DB Manager - Web UI on Local LAN Port 8088
  # ---------------------------------------------------------------------------
  home_budget_adminer:
    image: adminer:latest
    container_name: home_budget_adminer
    restart: always
    ports:
      - "8088:8080"
    depends_on:
      - home_budget_db
    networks:
      - home_budget_net

networks:
  home_budget_net:
    driver: bridge

volumes:
  home_budget_data_v1:
```

---

## 3. The 6 Critical Pitfalls & Exact Solutions

### Pitfall 1: GoTrue Migration Crash (`operator does not exist: uuid = text`)
- **Symptom**: `home_budget_auth` repeatedly restarts with code 1. Logs show:
  `ERROR: operator does not exist: uuid = text (SQLSTATE 42883) in 20221208132122_backfill_email_last_sign_in_at.up.sql`
- **Cause**: GoTrue v2.132.3 includes a legacy 2022 migration comparing `id = user_id::text`. PostgreSQL 15 does not have an implicit cast operator between `uuid` and `text`.
- **Solution**: Execute the following in Adminer (or Postgres) once:
  ```sql
  CREATE OR REPLACE FUNCTION pg_catalog.uuid_eq_text(uuid, text) RETURNS boolean AS $$ SELECT $1::text = $2; $$ LANGUAGE sql IMMUTABLE;
  DROP OPERATOR IF EXISTS pg_catalog.= (uuid, text);
  CREATE OPERATOR pg_catalog.= (LEFTARG = uuid, RIGHTARG = text, PROCEDURE = pg_catalog.uuid_eq_text, COMMUTATOR = =, NEGATOR = <>, MERGES, HASHES);

  CREATE OR REPLACE FUNCTION pg_catalog.text_eq_uuid(text, uuid) RETURNS boolean AS $$ SELECT $1 = $2::text; $$ LANGUAGE sql IMMUTABLE;
  DROP OPERATOR IF EXISTS pg_catalog.= (text, uuid);
  CREATE OPERATOR pg_catalog.= (LEFTARG = text, RIGHTARG = uuid, PROCEDURE = pg_catalog.text_eq_uuid, COMMUTATOR = =, NEGATOR = <>, MERGES, HASHES);

  INSERT INTO auth.schema_migrations (version) VALUES ('20221208132122') ON CONFLICT (version) DO NOTHING;
  ```

---

### Pitfall 2: GoTrue OAuth Callback Crash (`relation "identities" does not exist`)
- **Symptom**: Google OAuth succeeds on Google, but user returns to sign-in screen without logging in. Database log shows:
  `ERROR: relation "identities" does not exist at character 210`
  `STATEMENT: SELECT identities.created_at ... FROM identities AS identities WHERE provider_id = $1`
- **Cause**: The table is in schema `auth.identities`. GoTrue issues unqualified queries (`FROM identities`). PostgreSQL defaults `search_path` to `public`.
- **Solution**: Run in Adminer or `home_budget_init`:
  ```sql
  ALTER DATABASE home_budget SET search_path TO auth, public;
  ALTER ROLE postgres SET search_path TO auth, public;
  ```

---

### Pitfall 3: Browser CORS Preflight Failure (Silent Kick Back to Login Screen)
- **Symptom**: User logs in with Google, browser returns to app URL `#access_token=...`, but page reverts to Login Landing hero without errors. In Browser Console (F12):
  `Access to fetch at '.../rest/v1/profiles' from origin 'https://...' has been blocked by CORS policy: Response to preflight request doesn't pass access control check`
- **Cause**: PostgREST does not handle `OPTIONS` preflight requests on table endpoints or returns 404 without CORS headers.
- **Solution**: The Nginx Gateway MUST intercept `if ($request_method = "OPTIONS")` on both `/auth/v1/` and `/rest/v1/` and return `204 No Content` with:
  `Access-Control-Allow-Origin: *`
  `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
  `Access-Control-Allow-Headers: *`

---

### Pitfall 4: Nginx Crashing on Startup with `host not found in upstream`
- **Symptom**: Nginx restarts continuously, Cloudflare returns `502 Bad Gateway`. Logs:
  `[emerg] host not found in upstream "home_budget_auth"`
- **Cause**: Nginx starts faster than GoTrue/PostgREST. By default, Nginx resolves upstream hosts at startup. If the container isn't ready yet, Nginx exits.
- **Solution**: Use Docker's internal DNS resolver and dynamic variable proxy:
  ```nginx
  resolver 127.0.0.11 ipv6=off valid=5s;
  set $upstream_auth http://home_budget_auth:9999;
  proxy_pass $upstream_auth/$1$is_args$args;
  ```

---

### Pitfall 5: Hardcoded Frontend Fallback Mock Data
- **Symptom**: User deletes all rows in the PostgreSQL database, but the UI still displays sample data (e.g. portfolio `₪ 326,000`, sample transactions).
- **Cause**: In dashboard/ledger services, checks like `if (records.length === 0)` fallback to mock data arrays instead of checking `isDemoMode`.
- **Solution**: In frontend services, enforce:
  ```typescript
  if (records.length === 0 && isDemoMode) {
    records = mockData;
  }
  ```

---

### Pitfall 6: GitHub Push Protection on Google OAuth Secrets
- **Symptom**: `git push` fails with:
  `remote: error: GH013: Repository rule violations found for refs/heads/main ... Push cannot contain secrets`
- **Cause**: Google OAuth Client Secret `GOCSPX-...` was committed to a tracked file in git.
- **Solution**:
  1. Add `nas-setup/` and `.env.local` to `.gitignore`.
  2. In tracked repository files, replace secrets with `YOUR_GOOGLE_CLIENT_SECRET`.

---

## 4. End-to-End Setup Checklist (Step-by-Step)

### Step 1: Cloudflare Tunnel
- In Cloudflare Zero Trust ➔ Networks ➔ Tunnels:
  - Add Public Hostname: `budget-db.yourdomain.com` ➔ Service: `HTTP://10.0.0.16:8100`.

### Step 2: Google Cloud Console
- In APIs & Services ➔ Credentials ➔ OAuth 2.0 Client ID:
  - Authorized JavaScript origins: `https://your-app.vercel.app`, `http://localhost:5173`.
  - Authorized redirect URIs: `https://budget-db.yourdomain.com/auth/v1/callback`.

### Step 3: Deploy NAS Compose Stack
- Create the project in NAS Docker using the Compose YAML above.

### Step 4: Run Initial Schema & Migration Fixes in Adminer
- Open `http://10.0.0.16:8088`.
- Login: System: `PostgreSQL`, Server: `home_budget_db`, User: `postgres`, DB: `home_budget`.
- Open **SQL Command**, execute the operators fix and application schema (`schema.sql`).

### Step 5: Configure Frontend Environment Variables (Vercel)
- Set:
  - `VITE_SUPABASE_URL=https://budget-db.yourdomain.com`
  - `VITE_SUPABASE_ANON_KEY=<your-jwt-anon-token>`
- Trigger **Redeploy** on Vercel.

---

## 5. Quick Verification Commands

From any terminal with internet access:
```bash
# 1. Gateway Health Check
curl -i https://budget-db.yourdomain.com/health
# Expected: HTTP 200 OK

# 2. GoTrue Auth Health Check
curl -i https://budget-db.yourdomain.com/auth/v1/health
# Expected: HTTP 200 OK with {"version":"","name":"GoTrue",...}

# 3. CORS Preflight Test
curl -i -X OPTIONS https://budget-db.yourdomain.com/rest/v1/profiles -H "Origin: https://your-app.vercel.app" -H "Access-Control-Request-Method: GET"
# Expected: HTTP 204 No Content with access-control-allow-origin: *

# 4. Google OAuth Redirect Test
curl -i -s "https://budget-db.yourdomain.com/auth/v1/authorize?provider=google&redirect_to=https://your-app.vercel.app"
# Expected: HTTP 302 Found redirecting to accounts.google.com with your Client ID
```
