# ImpactHub — Real-World Civic Action & Social Impact Platform

[![Platform Test Suite](https://img.shields.io/badge/Production%20Tests-27%2F27%20PASSED-059669.svg)](#-production-readiness-test-suite)
[![Node.js](https://img.shields.io/badge/Node.js-v20-339933.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-black.svg)](https://expressjs.com)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.x-2D3748.svg)](https://www.prisma.io)
[![Role Isolation](https://img.shields.io/badge/Role%20Isolation-Strict%20Server--Enforced-blue.svg)](#-strict-role-isolation)

ImpactHub is a production-grade, full-stack civic action platform connecting non-profit organizations (NGOs), active volunteers, and philanthropic donors. Built with vanilla HTML5/CSS3/JavaScript on the frontend and an Express/Prisma REST API on the backend, ImpactHub provides real authentication, strict role isolation, per-account scoped data, Section 80G tax receipts, digital volunteer QR passes, and administrative oversight.

The application is served at **`http://localhost:5000`** with an empty, clean database (0 seeded users).

---

## 🏗 System Architecture & Security Model

```mermaid
graph TD
    Client["Browser Frontend (Vanilla HTML5 / Modern CSS / JS)<br/>Public Pages | Role Dashboards | Modal Flows"]
    APIClient["API Client (js/api.js)<br/>Token & Cookie Auth | CSRF Token | Warning Banner"]
    
    subgraph Express_Server ["ImpactHub Backend (Express 5.x @ Port 5000)"]
        SecurityMW["Security Headers (Helmet) | CORS Allowlist<br/>Anti-Abuse Rate Limiters (15-min Lockout)"]
        AuthMiddleware["Cookie & Bearer JWT Middleware<br/>Access Token (15m) + Rotating Refresh Token (30d)"]
        RBAC["Strict RBAC Middleware (requireRole, requireVerifiedEmail)<br/>401/403 Enforcement | No Cross-Role Leaks"]
        Validators["Zod Validation Layer<br/>Email Format | Case-Insensitive Trimming | Password Policy"]
        
        subgraph REST_Routers ["REST API v1 (/api/v1)"]
            AuthRouter["/auth (Signup, Login, Verify, Reset, Refresh, Logout)"]
            MeRouter["/me (Per-Account Scoped Volunteer, Donor & NGO Dashboards)"]
            CampaignsRouter["/campaigns (Discovery, Category Filters, NGO Post)"]
            DrivesRouter["/drives (Capacity Check, QR Passes, Ground Check-In)"]
            DonationsRouter["/donations (Razorpay / Simulator, Section 80G PDF)"]
            RewardsRouter["/rewards (Leaderboards, Tier Status, Badges)"]
            NgosRouter["/ngos (Verification Status, Attendance, CSV Export)"]
            AdminRouter["/admin (Allow-Listed Owner, NGO Queue, Audit Logs)"]
        end
        
        RewardsEngine["Rewards Engine (rewards.config.js)<br/>Anti-Abuse Caps | Reversals on Cancellation / No-Show"]
        PaymentGateway["Payment Gateway Adapter<br/>Razorpay Test Mode / Server Simulator"]
        PDFGen["PDFKit Generator<br/>Section 80G Tax Receipts & Volunteer Service Certificates"]
        Mailbox["Transactional Email Dispatcher<br/>SMTP Relay / In-App Dev Mailbox (/dev-mailbox)"]
    end
    
    subgraph Persistence ["Persistence Layer"]
        Prisma["Prisma ORM (v6.x)"]
        Database[("SQLite (dev.db) / PostgreSQL (Production)<br/>14 Normalized Models + Strict Foreign Keys")]
    end

    Client --> APIClient
    APIClient -->|HTTPOnly Cookies + CSRF Header| SecurityMW
    SecurityMW --> AuthMiddleware --> RBAC --> Validators --> REST_Routers
    REST_Routers --> MeRouter
    REST_Routers --> RewardsEngine
    REST_Routers --> PaymentGateway
    REST_Routers --> PDFGen
    REST_Routers --> Mailbox
    REST_Routers --> Prisma --> Database
```

---

## 📁 Project Directory Structure

ImpactHub follows a clean, professional architecture separating frontend assets, backend server modules, database models, CLI maintenance utilities, and test suites:

```text
HopeConnect/
├── public/                 # Frontend client static files (served by Express)
│   ├── index.html          # Public home landing page
│   ├── auth.html           # Authentication portal (Sign In / Sign Up)
│   ├── campaigns.html      # Civic campaigns discovery
│   ├── volunteer.html      # Volunteer opportunities & ground check-ins
│   ├── ngos.html           # Verified non-profit directory
│   ├── dashboard.html      # Dynamic role dashboard (Admin, Volunteer, Donor, NGO)
│   ├── leaderboard.html    # Civic leaderboard & impact rankings
│   ├── rewards.html        # Badges & volunteer certificates
│   ├── about.html          # Mission & organization story
│   ├── contact.html        # Contact & support intake
│   ├── terms.html          # Terms of service
│   ├── privacy.html        # Privacy policy
│   ├── 401.html, 403.html, 404.html, 500.html # Branded error pages
│   ├── css/                # Stylesheets (style.css, responsive.css)
│   ├── js/                 # Browser JavaScript (app.js, api.js, dashboard.js, etc.)
│   └── assets/             # Brand SVGs and images
│
├── server/                 # Backend Node/Express application layer
│   ├── auth.js             # JWT & cookie session manager
│   ├── mailbox.js          # In-app dev email sink & dispatcher
│   ├── paymentGateway.js   # Razorpay adapter & test simulator
│   ├── pdfGenerator.js     # Section 80G tax receipt & certificate builder
│   ├── rewardsEngine.js    # Point allocation & badge evaluator
│   ├── validators.js       # Zod input schemas
│   └── routes/             # REST API v1 endpoint controllers
│       ├── admin.js        # Admin telemetry, NGO queue, audit logs & leaderboard
│       ├── auth.js         # Authentication, verification & session management
│       ├── campaigns.js    # Campaign discovery & creation
│       ├── donations.js    # Donation flows & 80G receipts
│       ├── drives.js       # Volunteer drives & QR attendance
│       ├── me.js           # Account-scoped profile & dashboard data
│       ├── ngos.js         # NGO verification & directory
│       ├── notifications.js# Alert dispatches
│       ├── reports.js      # Platform issue reports
│       ├── rewards.js      # Badges & leaderboards
│       └── stats.js        # Platform aggregate metrics
│
├── prisma/                 # Database schema & migrations
│   ├── schema.prisma       # Prisma data model definition (14 entities)
│   ├── dev.db              # SQLite development database
│   ├── migrations/         # Database migration history
│   └── seed.js             # Initial database seeder
│
├── scripts/                # Administrative & operational CLI tools
│   ├── admin_create.js     # CLI tool to provision admin accounts
│   ├── admin_reset_password.js # CLI tool to reset admin passwords
│   ├── admin_unlock.js     # CLI tool to unlock rate-limited accounts
│   ├── db_backup.js        # Database snapshot & backup generator
│   ├── doctor.js           # Environment & platform health check
│   └── reset_clean_db.js   # Clean database reset utility
│
├── tests/                  # Automated test & audit suites
│   ├── test_production_readiness.js # 27-point production test suite (`npm test`)
│   ├── test_admin_path_e2e.js       # Admin path & durability suite (`npm run test:admin`)
│   ├── test_platform.js             # Platform integrity suite (`npm run test:platform`)
│   ├── test_e2e.js                  # Headless end-to-end suite (`npm run test:e2e`)
│   └── run_full_audit.js            # Platform compliance audit (`npm run audit`)
│
├── backups/                # Local database backup archives
├── screenshots/            # Automated test & verification captures
├── server.js               # Express application entrypoint
├── rewards.config.js       # Centralized reward points & badge definitions
├── package.json            # NPM dependencies & operational scripts
├── Dockerfile              # Multi-stage production container
└── docker-compose.yml      # Local orchestration with PostgreSQL 16
```

## 🔒 Key Production Safeguards Implemented

1. **Strict Role Isolation (Zero Persona Switching):**
   - The demo "Switch Persona" bar and all persona-switching controls have been completely removed.
   - Every account possesses strictly **one role** (`volunteer`, `donor`, or `ngo`). If a user desires another role, they register a separate account with a unique email.
   - Enforced server-side on every `/api/v1/*` endpoint and page route: unauthorized role access immediately returns `403 Forbidden` (API) or a styled `403.html` page.
   - `/dashboard` renders **exclusively** the view corresponding to `req.user.role`. Attempting to access another role's dashboard view or data returns 403.

2. **Admin Restricted to Owner Allow-List (`ADMIN_EMAILS`):**
   - Only emails explicitly listed in `ADMIN_EMAILS` in `.env` can hold the `admin` role.
   - Public registration never allows selecting Admin. When an allow-listed owner email registers normally via `/auth` and verifies their email, the server promotes them to `admin`.
   - Tampered requests attempting `role=admin` are rejected with `400 Bad Request`.
   - Every admin request re-verifies that `req.user.role === 'admin'`, the email is in `ADMIN_EMAILS`, and the email is verified.
   - **Sensitive Admin Action Protection:** Admin verification or rejection of an NGO requires re-entering the admin account password. Every action is recorded in the immutable `AuditLog` table.

3. **Real Registration & Authentication:**
   - Single `/auth` page featuring **Sign In** and **Sign Up** tabs.
   - **Zod Validation:** Email format, case-insensitive trimming, password policy (minimum 8 characters with at least one letter and one number), strength meter, show/hide toggle, and clear inline errors.
   - **Anti-Enumeration Generic Errors:** Failed sign-in returns `"Invalid email or password."` to prevent user enumeration.
   - **Brute-Force Lockout:** 5 consecutive failed sign-in attempts lock the account for 15 minutes (`AccountLocked`).
   - **Signed Expiring Tokens:** Email verification links (24h) and password reset links (30m) use cryptographically random single-use tokens.
   - **Dev Mailbox (`/dev-mailbox`):** In development mode (`NODE_ENV=development`), verification links and password resets are captured in an in-memory dev mailbox with a clearable UI.
   - **Session Lifecycles:** 15-minute access token + 30-day rotating refresh token in `HttpOnly, SameSite=Lax` cookies. Silent token refresh across page reloads and browser restarts when "Remember Me" is checked.
   - **Logout:** Explicitly revokes refresh tokens on the server and clears all cookies. Settings modal includes a `"Log out of all devices"` option.

4. **Port 5000 Server Enforcement:**
   - Pages must always be served via the Express server at `http://localhost:5000`.
   - `js/api.js` automatically renders a fixed top warning banner if loaded via `file://` or an unsupported port (e.g., Live Server port 5500).

5. **Per-Account Data Scoping (`/api/v1/me/*`):**
   - Dashboards load data using the authenticated session ID (`req.user.id`), never from client-supplied IDs.
   - Cross-account tests confirm that Account A cannot view or modify Account B's registrations, donations, or campaigns.

6. **Donations & Anti-Fraud Trust Rules:**
   - Donations require an authenticated, email-verified donor account.
   - NGO organizers are strictly prohibited from donating to their own campaigns (`403 Forbidden`).
   - Reward points are only credited upon verified ground attendance or confirmed payment signature. Reversals occur if attendance is corrected or payments refunded.

---

## ⚡ Quick Start

### 1. Start the Server
```bash
# In the HopeConnect root directory:
npm install
npm start
```
The server will start listening at **`http://localhost:5000`**.

### 2. Reset to Clean State (Empty Database)
To reset the database to an empty, clean state (0 users, system badges only):
```bash
node scripts/reset_clean_db.js
```

### 3. Run the Automated Production Readiness Test Suite
To execute all 27 automated tests:
```bash
node test_production_readiness.js
```

---

## 📋 Step-by-Step Instructions

Follow these steps to set up the platform from scratch with real accounts:

### Step 1: Create the Owner Admin Account
1. Open `.env` and verify your owner email is listed in `ADMIN_EMAILS` (e.g., `ADMIN_EMAILS="owner@impacthub.org,admin@impacthub.org"`).
2. Open **`http://localhost:5000/auth?tab=signup`** in your browser.
3. Fill in:
   - **Full Name:** Platform Owner
   - **Email:** `admin@impacthub.org` (must match your `ADMIN_EMAILS` entry)
   - **Password:** `OwnerPass123` (min 8 chars, 1 letter, 1 number)
   - **City:** National HQ
   - Check the **Terms of Service & Privacy Policy** consent checkbox.
   - Click **Create My Account**.
4. Open the Dev Mailbox at **`http://localhost:5000/dev-mailbox`**.
5. Click the **Verify Email Address** button in the welcome email.
6. The account is verified and automatically promoted to **ADMIN**.
7. Navigate to **`http://localhost:5000/dashboard`** to access the Admin Panel (NGO Verification Queue, User Management, Content Moderation, Platform Telemetry, and Audit Log).

### Step 2: Register a Volunteer Account
1. Open **`http://localhost:5000/auth?tab=signup`**.
2. Select the **Volunteer** role card.
3. Enter your details:
   - **Full Name:** Maya Deshmukh
   - **Email:** `maya.volunteer@example.org`
   - **Password:** `Volunteer@2026`
   - **City:** Pune, Maharashtra
   - Check Terms consent and click **Create My Account**.
4. You will be redirected to `/dashboard` with an **"Email Verification Required"** banner.
5. In `/dev-mailbox`, click the verification link.
6. Return to `/dashboard`: the verification banner is cleared.
7. Browse to **`http://localhost:5000/drives`**, join a volunteer drive, and view your digital QR pass and attendance status.

### Step 3: Register a Donor Account
1. Open **`http://localhost:5000/auth?tab=signup`**.
2. Select the **Donor** role card.
3. Enter your details:
   - **Full Name:** Rohan Varma
   - **Email:** `rohan.donor@example.org`
   - **Password:** `DonorSecure2026`
   - **City:** Mumbai
   - Check Terms consent and click **Create My Account**.
4. Verify the email via `/dev-mailbox`.
5. Browse to **`http://localhost:5000/campaigns`**, support a campaign, and download your official Section 80G PDF tax receipt from your Donor Dashboard.

### Step 4: Register an NGO Account
1. Open **`http://localhost:5000/auth?tab=signup`**.
2. Select the **NGO** role card.
3. Enter your details:
   - **Full Name:** Dr. Kavita Sharma
   - **Email:** `kavita@pune-wildlife.org`
   - **Password:** `NgoSecure@2026`
   - **City:** Pune, Maharashtra
4. Complete the required NGO credentials:
   - **Organization Name:** Pune Wildlife Conservation Society
   - **Registration Number:** MAH/PUN/2026/0891
   - **Website:** `https://pune-wildlife.example.org`
   - **Primary Cause:** Environment & Conservation
   - Check Terms consent and click **Create My Account**.
5. Verify the email via `/dev-mailbox`.
6. Navigate to `/dashboard`: your NGO Dashboard displays **Verification Status: PENDING**. You can draft campaigns but cannot publish live initiatives until reviewed by the administrator.

### Step 5: Verify the NGO from the Admin Panel
1. Sign in to your Admin account (`admin@impacthub.org`) at **`http://localhost:5000/auth`**.
2. Navigate to **`http://localhost:5000/dashboard`**.
3. Under the **NGO Verification Queue** tab, locate **Pune Wildlife Conservation Society** (Status: `PENDING`).
4. Review their registration number and website.
5. Click **Verify NGO**.
6. A security modal prompts for admin re-authentication: enter your Admin password (`OwnerPass123`) and click **Confirm**.
7. The NGO is instantly marked **VERIFIED**. An approval email is dispatched to the NGO (viewable in `/dev-mailbox`), and the action is recorded in the Audit Trail.
8. The NGO can now publish live fundraising campaigns and schedule volunteer drives.

---

## 🧪 Production Readiness Test Suite

Run the full automated test suite anytime:
```bash
node test_production_readiness.js
```

### Verified Test Results (27/27 PASS — 100%):
```text
======================================================
🚀 RUNNING IMPACTHUB PRODUCTION READINESS TEST SUITE
======================================================

--- Group 1: Registration Validation & Password Policy ---
  ✅ PASS: 1.1 Rejects malformed email address
  ✅ PASS: 1.2 Rejects short password (<8 chars)
  ✅ PASS: 1.3 Rejects password without numbers
  ✅ PASS: 1.4 Disallows selecting Admin role during registration
  ✅ PASS: 1.5 Successfully registers volunteer account with hashed password
  ✅ PASS: 1.6 Prevents duplicate email registration (case-insensitive, trimmed)

--- Group 2: Email Verification Flow ---
  ✅ PASS: 2.1 Dev mailbox captures signed verification link in development
  ✅ PASS: 2.2 Unverified volunteer is blocked from joining drives
  ✅ PASS: 2.3 Resend verification email enforces rate-limit cooldown
  ✅ PASS: 2.4 Email verification succeeds with signed token
  ✅ PASS: 2.5 Email verification tokens are single-use (replay rejected)

--- Group 3: Authentication, Lockout & Sessions ---
  ✅ PASS: 3.1 Returns generic error on bad credentials (anti-enumeration)
  ✅ PASS: 3.2 Locks account temporarily (15 mins) after 5 consecutive failed attempts
  ✅ PASS: 3.3 Successfully registered Donor and NGO accounts
  ✅ PASS: 3.4 Successful login with Remember Me sets 30-day httpOnly refresh cookie

--- Group 4: Strict Role Isolation ---
  ✅ PASS: 4.1 Unauthenticated access to protected routes returns 401
  ✅ PASS: 4.2 Donor role forbidden (403) from accessing volunteer data
  ✅ PASS: 4.3 Volunteer role forbidden (403) from accessing NGO dashboard data
  ✅ PASS: 4.4 Non-admin users strictly forbidden (403) from Admin overview

--- Group 5: Admin Restriction & Allow-list Validation ---
  ✅ PASS: 5.1 Allowlisted email signs up normally through /auth
  ✅ PASS: 5.2 Allowlisted verified email is recognized as ADMIN role
  ✅ PASS: 5.3 Admin overview telemetry accessible by authenticated owner admin
  ✅ PASS: 5.4 Sensitive admin action rejects invalid admin password confirmation
  ✅ PASS: 5.5 Sensitive admin action executes with verified admin password and logs audit trail

--- Group 6: Cross-Account Data Isolation ---
  ✅ PASS: 6.1 Separate accounts of the same role fetch exclusively their own scoped data

--- Group 7: Donations & Anti-Fraud Rules ---
  ✅ PASS: 7.1 Signed-in verified donor successfully creates donation order
  ✅ PASS: 7.2 Prevents NGO owners from donating to their own campaigns for points/rewards

======================================================
🏁 TEST SUITE COMPLETE: 27/27 PASSED (0 FAILED)
======================================================
```

---

## 📸 Automated Browser Walkthrough & Screenshots

An autonomous browser walkthrough test (`walkthrough_production.js`) runs with Google Chrome via `puppeteer-core` to verify the UI and role isolation. High-resolution screenshots are generated and saved in both `./screenshots/` and the system artifact folder:

| Screenshot | File | Description |
|---|---|---|
| **Home Page** | `screenshot_01_home.png` | Live counters, zero demo placeholders, role CTAs |
| **Unified Auth** | `screenshot_06_auth.png` | Clean Sign In & Sign Up tabs, password meter, no demo pills |
| **Volunteer Dashboard** | `screenshot_07_dashboard_volunteer.png` | Per-account QR passes, hours, certificates. Zero persona switcher bar |
| **Donor Dashboard** | `screenshot_08_dashboard_donor.png` | Per-account donation ledger, Section 80G tax receipts |
| **NGO Dashboard** | `screenshot_09_dashboard_ngo.png` | Real NGO profile, verification status badge, participant rosters |
| **Admin Panel** | `screenshot_10_dashboard_admin.png` | NGO Verification Queue, User Moderation, Audit Log |
| **Campaigns Directory** | `screenshot_02_campaigns.png` | Real-time category filtering and live progress indicators |
| **Volunteer Drives** | `screenshot_04_volunteer_drives.png` | Drive directory with capacity tracker and join modal |
| **Leaderboard** | `screenshot_11_leaderboard_rewards.png` | Gamified public rankings and badge showcases |

---

## 🛠️ Owner Recovery Tools & Diagnostics (CLI)

ImpactHub provides local-only CLI owner recovery scripts. These tools interact directly with Prisma ORM and are **never exposed over HTTP**. By security policy, all recovery tools refuse to execute if `NODE_ENV=production` unless the `--force` flag is explicitly provided.

### 1. `npm run admin:create`
Reads the first entry from `ADMIN_EMAILS` (or an explicit `--email`), prompts for a secure password with hidden terminal input, validates the password policy, and creates or updates that user as a verified **ADMIN**.
```bash
# Interactive terminal prompt (hidden input, never logged)
npm run admin:create

# Or specify email & password directly
npm run admin:create -- --email you@domain.com --password YourSecurePass123!

# In production
npm run admin:create -- --email you@domain.com --password YourSecurePass123! --force
```

### 2. `npm run admin:reset-password`
Resets the password for any user account, clears any active account lockouts, resets failed attempt counters, and revokes all active refresh-token sessions across all devices.
```bash
npm run admin:reset-password -- --email you@domain.com
npm run admin:reset-password -- --email you@domain.com --password NewPassword123!
```

### 3. `npm run admin:unlock`
Clears account lockout and resets failed login attempt counters back to 0.
```bash
npm run admin:unlock -- --email you@domain.com
```

### 4. `npm run doctor`
Performs an automated pre-flight diagnostic across the environment, database, migrations, secrets, admin allow-list, and mail service, printing a PASS/FAIL table with actionable hints:
```bash
npm run doctor
```

```text
+--------------------------+--------+----------------------------------------------------+------------------------------------------------+
| Check                    | Status | Details                                            | Fix Hint                                       |
+--------------------------+--------+----------------------------------------------------+------------------------------------------------+
| .env Configuration       | ✅ PASS | File present and readable                          | None                                           |
| Database Connectivity    | ✅ PASS | SQLite connection active                           | None                                           |
| Prisma Migrations        | ✅ PASS | 1 migration(s) recorded in _prisma_migrations      | None                                           |
| Admin Allow-List         | ⚠️ WARN | 2 email(s): [admin@impacthub.org, owner@impacthub. | Replace placeholder emails with real owner add |
| Admin Account Exists     | ✅ PASS | Verified admin account active: admin@impacthub.org | None                                           |
| JWT & Cookie Secrets     | ✅ PASS | All secrets configured (>= 32 chars)               | None                                           |
| SMTP Service             | ✅ PASS | Dev Mailbox active (/dev-mailbox). Local SMTP port | In production, provide public SMTP host (e.g.  |
+--------------------------+--------+----------------------------------------------------+------------------------------------------------+
🎉 Diagnostic finished: All critical checks PASSED!
```

---

## 💾 Database Durability, Migrations & PostgreSQL Support

### 1. Stable SQLite Storage
- SQLite path is normalized to an absolute location (`path.resolve(__dirname, 'prisma/dev.db')`).
- Server logs the exact file path at startup, ensuring the database is never created in different folders regardless of where the node process is spawned.

### 2. Full PostgreSQL 16 Support
ImpactHub is designed to seamlessly transition to PostgreSQL 16 without schema changes:
1. Start the bundled PostgreSQL 16 container:
   ```bash
   docker compose up -d postgres
   ```
2. Update `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql://impactuser:impactpassword@localhost:5432/impacthub?schema=public"
   ```
3. Update `provider` in `prisma/schema.prisma` to `"postgresql"`.
4. Deploy migrations:
   ```bash
   npm run migrate
   ```

### 3. Database Backups & Restore
Create a timestamped database backup in `/backups` (automatically git-ignored):
```bash
npm run db:backup
```
- **Backup Destination:** `backups/backup_<ISO_TIMESTAMP>.db` (or SQL dump for PostgreSQL)
- **Restoration (SQLite):**
  1. Stop the ImpactHub server process.
  2. Copy the backup file over `prisma/dev.db`:
     ```bash
     cp backups/backup_2026-10-22T08-23-18-314Z.db prisma/dev.db
     ```
  3. Start the server (`npm start`).
- **Restoration (PostgreSQL):**
  ```bash
  psql "postgresql://impactuser:impactpassword@localhost:5432/impacthub" < backups/postgres_dump.sql
  ```

### 4. Token Hashing at Rest & Durability Architecture
- **Passwords:** Hashed with bcrypt cost 12.
- **Refresh Tokens:** Stored as one-way SHA-256 hashes (`tokenHash`), recording `userAgent`, `ipAddress`, `expiresAt`, and `revokedAt`.
- **Email Verification & Password Reset Tokens:** Hashed at rest with SHA-256 (`emailVerificationTokenHash`, `passwordResetTokenHash`).
- **Dev Mailbox Persistence:** Dispatched emails are saved to the `DispatchedEmail` database table so verification links survive server restarts.
- **Multi-Step Writes:** User signup + profile creation and donation confirmations + points award are wrapped in database transactions (`prisma.$transaction`).
- **Background Cleanup:** Daily job automatically purges expired refresh tokens and revoked sessions.

---

## 📝 Engineering Assumptions & Invariants

1. **Admin Promotion Rule:** A user whose normalized email (trimmed, lowercase) is in `ADMIN_EMAILS` and whose email is verified is granted `ADMIN`. This is evaluated dynamically upon email verification, on every login, on token refresh, and during authenticated profile requests. Changing `ADMIN_EMAILS` and restarting immediately updates access.
2. **Admin Demotion Rule:** If an allow-listed email is removed from `ADMIN_EMAILS`, the user is demoted back to their original `baseRole` (`volunteer`, `donor`, or `ngo`) at the next request.
3. **Account Lockout:** 5 consecutive failed sign-in attempts lock the account for 15 minutes. The lockout is persisted in the database (`User.lockedUntil`), resets on successful sign-in, and clears on password reset or via `npm run admin:unlock`.
4. **Anti-Enumeration Invariant:** Invalid sign-in credentials always return generic `"Invalid email or password."`. Only when valid credentials match an unverified account does the server return `"Please verify your email first"` with a resend option.
5. **Session Durability:** Sessions use rotating refresh tokens hashed in the database. Restarting the server does not log users out.

