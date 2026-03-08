# Pinpoint 311 — Complete Setup Guide

> **Estimated time:** 15–30 minutes for a basic deployment, 45–60 minutes for a fully configured production system.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Get the Code](#2-get-the-code)
3. [Configure Environment Variables](#3-configure-environment-variables)
4. [Start the System](#4-start-the-system)
5. [Get Bootstrap Access](#5-get-bootstrap-access)
6. [Configure Auth0 (SSO)](#6-configure-auth0-sso)
7. [Configure Google Maps](#7-configure-google-maps)
8. [Configure Google Cloud (AI Features)](#8-configure-google-cloud-ai-features)
9. [Set Up Email Notifications](#9-set-up-email-notifications)
10. [Set Up SMS (Optional)](#10-set-up-sms-optional)
11. [Upload Municipality Boundaries](#11-upload-municipality-boundaries)
12. [Configure Services & Departments](#12-configure-services--departments)
13. [Customize Branding](#13-customize-branding)
14. [Configure Legal Documents](#14-configure-legal-documents)
15. [Set Up a Custom Domain (Production)](#15-set-up-a-custom-domain-production)
16. [Enable Automatic Updates (Optional)](#16-enable-automatic-updates-optional)
17. [Enable Google Secret Manager (Optional)](#17-enable-google-secret-manager-optional)
18. [Add Staff Users](#18-add-staff-users)
19. [Go Live Checklist](#19-go-live-checklist)
20. [Ongoing Maintenance](#20-ongoing-maintenance)
21. [Troubleshooting](#21-troubleshooting)

---

## 1. Prerequisites

Before you begin, make sure you have the following:

### Required

| Requirement | Why | How to Get It |
|---|---|---|
| **A server or VM** | Runs the Pinpoint 311 stack | Any cloud provider (AWS, GCP, Azure, DigitalOcean, Linode) or an on-premise server. **Minimum:** 1 vCPU, 1 GB RAM. A free-tier VM works fine. |
| **Docker & Docker Compose** | Containerized deployment | [Install Docker](https://docs.docker.com/get-docker/). Docker Compose is included with modern Docker Desktop. On Linux, install the `docker-compose-plugin`. |
| **Git** | Clone the repository | Pre-installed on most servers. If not: `sudo apt install git` (Ubuntu/Debian) or `brew install git` (macOS). |

### Recommended (for full features)

| Requirement | Why | How to Get It |
|---|---|---|
| **Google Cloud Project** | Maps, Vertex AI (Gemini), Translate, and optional Secret Manager | [Create a project](https://console.cloud.google.com/projectcreate) in Google Cloud Console. |
| **Auth0 Account** | Staff & admin authentication (SSO, MFA, passkeys) | [Sign up free](https://auth0.com/signup) — the free tier supports up to 7,500 active users. |
| **Custom Domain** | Production URL like `311.yourtown.gov` | Purchase from any registrar, or use a subdomain of your municipality's existing domain. |
| **SMTP Email Server** | Send confirmation & status emails to residents | Your municipality may already have one, or use a service like Gmail SMTP, SendGrid, or Amazon SES. |

---

## 2. Get the Code

Open a terminal on your server and clone the repository:

```bash
git clone https://github.com/Pinpoint-311/Pinpoint-311.git
cd Pinpoint-311
```

That's it — the entire codebase is now on your server.

---

## 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Now open `.env` in your editor and configure each variable:

```bash
nano .env
# or: vim .env, code .env, etc.
```

### Required Variables

| Variable | What to Set | Example |
|---|---|---|
| `DOMAIN` | Your production domain (or `localhost` for testing) | `311.yourtown.gov` |
| `ADMIN_EMAIL` | Admin contact email | `admin@yourtown.gov` |
| `DB_PASSWORD` | **Set a strong, unique password.** This is your PostgreSQL database password. | `xK9#mP2$vL5nQ8wR` |
| `SECRET_KEY` | Encryption key for secrets. **Generate a unique one.** | See below |
| `INITIAL_ADMIN_EMAIL` | Email for the bootstrap admin account | `admin@yourtown.gov` |

**Generate your SECRET_KEY:**

```bash
openssl rand -base64 32
```

Copy the output and paste it as your `SECRET_KEY` value.

### Optional Variables (configure later via Admin Console)

| Variable | What It Does | Default |
|---|---|---|
| `DB_USER` | PostgreSQL username | `township` |
| `DB_NAME` | PostgreSQL database name | `township_db` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `REDIS_PORT` | Redis cache port | `6379` |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID (for AI features) | (empty) |
| `GOOGLE_VERTEX_LOCATION` | GCP region for Vertex AI | `us-central1` |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | (empty) |
| `FRONTEND_PORT` | Frontend dev port (dev mode only) | `5173` |

> **💡 Tip:** Most API keys (Maps, AI, SMS) can be configured later through the Admin Console's **Setup & Integration** page. You only *need* `DB_PASSWORD`, `SECRET_KEY`, and `DOMAIN` to start.

---

## 4. Start the System

### Option A: Production Deployment (Recommended)

Uses prebuilt Docker images from GitHub Container Registry — fastest option:

```bash
# Pull the latest images
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Start everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Option B: Development Deployment

Builds containers locally from source — slower, but useful if you're modifying the code:

```bash
docker compose up --build -d
```

### Verify Everything is Running

```bash
docker compose ps
```

You should see containers for:
- **backend** (FastAPI API server)
- **frontend** (React app)
- **db** (PostgreSQL + PostGIS)
- **redis** (Cache)
- **caddy** (HTTPS reverse proxy — production only)
- **celery_worker** (Background tasks)
- **celery_beat** (Scheduled tasks)

All containers should show `Up` status.

### Access Points

| Portal | URL (Production via Caddy) | URL (Development) |
|---|---|---|
| Resident Portal | `http://localhost/` | `http://localhost:5173/` |
| Staff Dashboard | `http://localhost/staff` | `http://localhost:5173/staff` |
| Admin Console | `http://localhost/admin` | `http://localhost:5173/admin` |
| Research Lab | `http://localhost/research` | `http://localhost:5173/research` |
| API Docs | `http://localhost/api/docs` | `http://localhost:8000/docs` |

---

## 5. Get Bootstrap Access

Before Auth0 is configured, you need bootstrap access to reach the Admin Console. Run this command:

```bash
curl -X POST http://localhost/api/auth/bootstrap
```

> **In development mode**, use `http://localhost:8000/api/auth/bootstrap` instead.

This returns a **magic link**. Click it (or paste it in your browser) — it logs you directly into the Admin Console with full admin privileges.

> **⚠️ Important:** Bootstrap access is temporary. It will be automatically disabled once you configure Auth0 in the next step. This is a security feature.

---

## 6. Configure Auth0 (SSO)

Auth0 provides secure, zero-password authentication for all staff. Here's how to set it up:

### Step 1: Create an Auth0 Application

1. Log into [Auth0 Dashboard](https://manage.auth0.com/)
2. Go to **Applications → Create Application**
3. Choose **Regular Web Application**
4. Name it something like "Pinpoint 311 - [Your Town]"

### Step 2: Configure Auth0 Settings

In your new application's **Settings** tab:

| Setting | Value |
|---|---|
| **Allowed Callback URLs** | `https://311.yourtown.gov/api/auth/callback` (replace with your domain) |
| **Allowed Logout URLs** | `https://311.yourtown.gov/staff` |
| **Allowed Web Origins** | `https://311.yourtown.gov` |

> For local testing, add `http://localhost/api/auth/callback`, `http://localhost/staff`, and `http://localhost` as additional values (comma-separated).

### Step 3: Copy Your Credentials

From the Auth0 application **Settings** tab, note:
- **Domain** (e.g., `your-tenant.us.auth0.com`)
- **Client ID**
- **Client Secret**

### Step 4: Enter Credentials in Admin Console

1. In Pinpoint 311's Admin Console, go to **Setup & Integration**
2. Find the **Auth0 SSO** section
3. Enter your Auth0 Domain, Client ID, and Client Secret
4. Click **Save**

The system encrypts and stores these credentials securely. **Bootstrap access is now automatically disabled** — all future logins will use Auth0 SSO.

### Step 5: Enable MFA (Recommended)

Back in Auth0 Dashboard:
1. Go to **Security → Multi-Factor Authentication**
2. Enable your preferred methods (TOTP, passkeys, push notifications)
3. Set the policy to **Always** for maximum security

---

## 7. Configure Google Maps

Google Maps powers the location picker, request map, and address autocomplete.

### Step 1: Create a Google Maps API Key

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → API Key**
3. Click **Restrict Key** and enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API

### Step 2: Enter in Admin Console

1. In the Admin Console, go to **Setup & Integration**
2. Find **Google Maps** section
3. Paste your API key
4. Click **Save**

> **💡 Tip:** Restrict your API key to your domain(s) under **Application restrictions → HTTP referrers** to prevent unauthorized usage.

---

## 8. Configure Google Cloud (AI Features)

Pinpoint 311 uses Google Vertex AI (Gemini 3.0 Flash) for intelligent features like photo analysis, request triage, priority scoring, and the AI Analytics Advisor.

### Step 1: Enable APIs

In the [Google Cloud Console](https://console.cloud.google.com/), enable:
- **Vertex AI API**
- **Cloud Translation API** (for 109-language support)

### Step 2: Create a Service Account

1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Name: `pinpoint-311-backend`
4. Grant these roles:
   - `Vertex AI User`
   - `Cloud Translation API User`
5. Click **Create Key → JSON**
6. Download the JSON key file

### Step 3: Upload to Admin Console

1. In the Admin Console, go to **Setup & Integration**
2. Find the **Google Cloud / Vertex AI** section
3. Enter your **Google Cloud Project ID**
4. Upload the **Service Account JSON key**
5. Click **Save**

The key is encrypted with Fernet (AES-128-CBC) and stored securely in the database.

> **💡 Tip:** The Vertex AI region defaults to `us-central1`. If your data residency requires a different region, update `GOOGLE_VERTEX_LOCATION` in your `.env` file.

---

## 9. Set Up Email Notifications

Email is used to send residents confirmation, status updates, and resolution notifications.

### In Admin Console → Setup & Integration:

Enter your SMTP credentials:

| Field | Example |
|---|---|
| SMTP Host | `smtp.gmail.com` or your mail server |
| SMTP Port | `587` (TLS) or `465` (SSL) |
| SMTP Username | `311@yourtown.gov` |
| SMTP Password | Your email password or app-specific password |
| From Address | `311@yourtown.gov` |
| From Name | `YourTown 311` |

> **Gmail users:** You'll need to create an [App Password](https://support.google.com/accounts/answer/185833) since Gmail blocks less-secure app access.

The system automatically injects your township's logo, colors, and fonts into every email via the branding engine.

---

## 10. Set Up SMS (Optional)

SMS sends text alerts to staff and residents with status updates and tracking links.

### Twilio Setup

1. Create a [Twilio account](https://www.twilio.com/try-twilio)
2. Get a phone number with SMS capability
3. Note your **Account SID**, **Auth Token**, and **Phone Number**

### In Admin Console → Setup & Integration:

Enter your Twilio credentials:
- Account SID
- Auth Token
- From Phone Number

> **💡 Tip:** Pinpoint 311 also supports a **generic HTTP adapter** for any SMS gateway. Check the API docs if you use a non-Twilio provider.

---

## 11. Upload Municipality Boundaries

Boundary files define the valid service area. Requests dropped outside the boundary are automatically rejected.

### Step 1: Get Your Boundary File

Your municipality likely has a GeoJSON boundary file. Sources:
- Your GIS department
- [Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)
- [OpenStreetMap](https://overpass-turbo.eu/) — search for your municipality
- [geojson.io](https://geojson.io/) — draw a boundary manually

The file must be in **GeoJSON format** (`.geojson` or `.json`).

### Step 2: Upload in Admin Console

1. Go to **Admin Console → Setup & Integration**
2. Find the **Municipality Boundaries** section
3. Upload your GeoJSON file
4. The map will preview the boundary — verify it looks correct
5. Click **Save**

### Optional: Upload Asset Layers

If you have GeoJSON files for municipal infrastructure (parks, hydrants, storm drains, streetlights, etc.), you can upload them as **custom map layers**:

1. Go to **Admin Console → Map Layers**
2. Upload each GeoJSON file
3. These assets will appear on the staff map and can be selected by residents during submission

---

## 12. Configure Services & Departments

Services are the categories residents choose when reporting an issue (e.g., "Pothole", "Streetlight Outage", "Animal Control").

### In Admin Console:

1. Go to **Services** section
2. For each service category, configure:

| Setting | Description |
|---|---|
| **Name** | What residents see (e.g., "Pothole") |
| **Icon** | Choose from 100+ built-in icons |
| **Department** | Which department handles this (e.g., "Public Works") |
| **Routing Type** | Township Handled, Third-Party Handoff, or Road-Based |
| **Custom Questions** | Follow-up questions specific to this service |

### Routing Types Explained

- **Township Handled:** Routes to your internal staff (most services)
- **Third-Party Handoff:** Shows a custom message directing residents to call an external agency (e.g., "This road is maintained by the State DOT. Please call 555-0199.")
- **Road-Based Logic:** Different handling based on street name (e.g., "Main St" → County, "Elm St" → Local)

### Adding Departments

1. Go to **Departments** section
2. Add departments (e.g., Public Works, Police, Parks & Rec, Code Enforcement)
3. Assign staff members to each department

---

## 13. Customize Branding

Make Pinpoint 311 look like your municipality.

### In Admin Console → Branding:

| Setting | Description |
|---|---|
| **Municipality Name** | Displayed in headers, emails, and the portal |
| **Logo** | Upload your municipality's logo (appears in nav, emails, portal) |
| **Primary Color** | Your brand color (used for buttons, accents) |
| **Secondary Color** | Supporting brand color |
| **Font** | Choose a font family for the entire system |

These settings are automatically applied to:
- The Resident Portal
- All email notifications (confirmation, updates, resolution)
- SMS messages
- The Staff Dashboard header

---

## 14. Configure Legal Documents

Pinpoint 311 ships with sensible defaults for all legal pages, but you should customize them for your municipality.

### In Admin Console → Branding → Legal Documents:

| Document | What to Customize |
|---|---|
| **Privacy Policy** | Data collection, usage, retention, and resident rights. Update with your municipality's specific practices. |
| **Terms of Service** | Acceptable use, response time expectations, liability. Includes a prominent non-emergency disclaimer (911 for emergencies). |
| **Accessibility Statement** | WCAG 2.1 AA commitment, Section 508 compliance, alternative submission methods (phone, email, in-person). |

All documents support **Markdown formatting** for easy editing.

> The non-emergency disclaimer is also enforced at the system level with a one-time acknowledgment modal and persistent warning banner.

---

## 15. Set Up a Custom Domain (Production)

Caddy (the built-in reverse proxy) automatically provisions HTTPS via Let's Encrypt.

### Step 1: Point Your Domain

Create a DNS record pointing your domain to your server's IP:

| Record Type | Name | Value |
|---|---|---|
| A | `311.yourtown.gov` | `YOUR_SERVER_IP` |

### Step 2: Update Your .env

```bash
DOMAIN=311.yourtown.gov
```

### Step 3: Restart Caddy

```bash
docker compose restart caddy
```

Caddy will automatically:
- Request an SSL certificate from Let's Encrypt
- Configure HTTPS
- Redirect HTTP → HTTPS

> **💡 Tip:** You may also need to update your Auth0 callback URLs (Step 6) to use the new domain.

---

## 16. Enable Automatic Updates (Optional)

Watchtower automatically pulls updated Docker images and restarts containers. It runs daily at 3 AM.

### Enable:

```bash
docker compose up -d watchtower
```

### Disable (for manual control):

```bash
docker compose stop watchtower
```

### Check Status:

```bash
docker compose ps watchtower
```

> **💡 Tip:** The core system works perfectly without Watchtower. Use it for hands-off security updates, or disable it if you prefer reviewing changes before deploying them.

---

## 17. Enable Google Secret Manager (Optional)

For enterprise-grade secret storage, migrate your API keys from the database to Google Secret Manager.

### In Admin Console → Setup & Integration:

1. Make sure your GCP service account has the **Secret Manager Admin** role
2. Enter your Google Cloud Project ID (if not already set)
3. Click **Enable Secret Manager**
4. All secrets (Auth0, Maps, SMTP, etc.) will be automatically migrated

> **⚠️ Note:** Two "bootstrap keys" always remain in the local database — `GCP_SERVICE_ACCOUNT_JSON` and `GOOGLE_CLOUD_PROJECT` — because they're needed to access Secret Manager itself.

---

## 18. Add Staff Users

Once Auth0 is configured, you can invite staff.

### In Admin Console → Staff Management:

1. Add users with their Auth0 email address
2. Assign a **role**:

| Role | Access |
|---|---|
| **Staff** | View, manage, and resolve requests in their assigned department |
| **Admin** | Full access to Admin Console, services configuration, branding, and user management |
| **Researcher** | Access to the Research Suite for privacy-preserved analytics exports |

3. Assign to a **department**
4. Staff log in via Auth0 SSO — no passwords to set or manage

> Staff members can toggle their own notification preferences (Email/SMS) from their profile.

---

## 19. Go Live Checklist

Before sharing the Resident Portal URL with your community, verify:

| ✓ | Item |
|---|---|
| ☐ | `.env` has secure `DB_PASSWORD` and `SECRET_KEY` (not the defaults) |
| ☐ | Auth0 is configured and bootstrap access is disabled |
| ☐ | Google Maps API key is set (location picker works) |
| ☐ | Municipality boundary GeoJSON is uploaded |
| ☐ | At least one service category is configured |
| ☐ | At least one department with staff members exists |
| ☐ | SMTP email is configured (test by submitting a request) |
| ☐ | Branding (logo, name, colors) is set |
| ☐ | Legal documents (Privacy Policy, ToS, Accessibility) are reviewed |
| ☐ | Custom domain is set up with HTTPS |
| ☐ | Non-emergency disclaimer modal appears on first visit |
| ☐ | Submit a test request and verify the full lifecycle: confirmation email → staff sees request → resolve → closure email |

---

## 20. Ongoing Maintenance

### Database Backups

Schedule regular PostgreSQL backups:

```bash
# Manual backup
docker compose exec db pg_dump -U township township_db > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T db psql -U township township_db < backup_20250101.sql
```

> **💡 Tip:** Set up a cron job to automate daily backups.

### Updating the System

**With Watchtower enabled:** Updates happen automatically at 3 AM daily.

**Manual update:**

```bash
# Pull latest images
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Restart with new images
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**From the Admin Console:** Use the **Pull Updates** button to trigger a rebuild from GitHub.

### Database Migrations

If an update includes database schema changes, run migrations:

```bash
docker compose exec backend alembic upgrade head
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f celery_worker
```

### Record Retention

The system automatically handles record retention via a daily Celery Beat task. The retention period is based on your configured state:

| State | Period |
|---|---|
| Texas | 10 years |
| New Jersey, Pennsylvania, Wisconsin | 7 years |
| New York, Michigan, Washington, Connecticut | 6 years |
| California, Florida, most states | 5 years (default) |
| Georgia, Massachusetts | 3 years |

Configure your state in **Admin Console → Settings**. Records can be placed on **legal hold** to prevent automatic archival.

---

## 21. Troubleshooting

### Container won't start

```bash
# View logs for the failing container
docker compose logs backend

# Restart all services
docker compose restart

# Nuclear option: rebuild everything
docker compose down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Can't access the site

- **Check if containers are running:** `docker compose ps`
- **Check Caddy logs:** `docker compose logs caddy`
- **Firewall:** Make sure ports 80 and 443 are open
- **DNS:** Verify your domain points to the correct IP: `dig 311.yourtown.gov`

### Bootstrap endpoint doesn't work

The bootstrap endpoint is disabled after Auth0 is configured. If you're locked out:

```bash
# Connect to the database
docker compose exec db psql -U township township_db

# Check if Auth0 is configured
SELECT * FROM system_secrets WHERE key LIKE 'AUTH0%';
```

### Database issues

```bash
# Check database status
docker compose exec db pg_isready

# Run pending migrations
docker compose exec backend alembic upgrade head

# Check current migration state
docker compose exec backend alembic current
```

### Email not sending

1. Check Celery worker logs: `docker compose logs celery_worker`
2. Verify SMTP credentials in **Admin Console → Setup & Integration**
3. Test with a simple submission and watch the worker logs
4. If using Gmail, ensure you're using an [App Password](https://support.google.com/accounts/answer/185833)

---

## Resource Requirements

The entire Pinpoint 311 stack uses **less memory than a single Chrome tab**:

| Component | Memory |
|---|---|
| Backend (FastAPI) | ~50 MB |
| Frontend (React) | ~30 MB |
| PostgreSQL + PostGIS | ~40 MB |
| Redis | ~10 MB |
| Caddy | ~15 MB |
| Celery Worker + Beat | ~40 MB |
| **Total** | **~185 MB** |

**Cost estimate:** $5–10/month on any cloud provider, or free on most free-tier VMs.

---

## Need Help?

- 📖 [Full README](https://github.com/Pinpoint-311/Pinpoint-311)
- 📋 [Compliance & Security Details](https://github.com/Pinpoint-311/Pinpoint-311/blob/main/COMPLIANCE.md)
- 🐛 [Report an Issue](https://github.com/Pinpoint-311/Pinpoint-311/issues)
- ❤️ [Donate](https://hcb.hackclub.com/pinpoint-311) (tax-deductible via Hack Foundation, EIN: 81-2908499)
