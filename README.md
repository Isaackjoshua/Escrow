# Escrow255 — Secure Escrow Payment Platform for East Africa

A production-ready escrow payment web application built for the Tanzanian and East African market, launching in Dar es Salaam. Funds are securely held until the customer confirms delivery, with full dispute resolution, milestone-based payments, and mobile money integration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Quick Start (Docker)](#quick-start-docker)
4. [Manual Setup](#manual-setup)
5. [Environment Variables](#environment-variables)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [Core Transaction Flow](#core-transaction-flow)
9. [Test Credentials](#test-credentials)
10. [Deployment](#deployment)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Client Browser                      │
│              Next.js 14 (App Router) + Tailwind          │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼──────────────────────────────┐
│                   Express.js API                         │
│         Auth · Transactions · Disputes · Payments        │
├───────────────┬───────────────────────┬─────────────────┤
│  PostgreSQL   │        Redis           │   AWS S3        │
│  (Prisma ORM) │  (Sessions / OTP)     │  (Evidence)     │
├───────────────┴───────────────────────┴─────────────────┤
│  Africa's Talking SMS API   │   Selcom Mobile Money API  │
└────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Atomic transactions**: All fund state changes use Prisma `$transaction()` to prevent partial updates
- **OTP gates**: Every financial action (deposit, release, delivery) requires SMS OTP verification
- **Ring-fenced escrow**: Funds marked `HELD` are logically isolated — no payout until confirmed
- **Immutable audit log**: Every state change is written to `audit_logs` with actor, IP, and metadata
- **Inspection window**: Configurable countdown (default 48h) before auto-release

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Cache/Sessions | Redis 7 |
| Authentication | JWT (access + refresh), bcrypt, SMS OTP |
| Payments | Selcom API (M-Pesa, Tigo Pesa, Airtel Money) |
| SMS | Africa's Talking |
| File Storage | AWS S3 |
| Containerization | Docker, Docker Compose |

---

## Quick Start (Docker)

```bash
# 1. Clone and enter project
git clone <repo-url> && cd Escrow255

# 2. Copy environment file and fill in your API keys
cp .env.example .env

# 3. Start all services
docker compose up -d

# 4. Run database migrations
docker compose exec backend npx prisma migrate dev

# 5. Seed test data
docker compose exec backend npm run db:seed

# 6. Open the app
open http://localhost:3000
```

The stack will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **Prisma Studio**: `docker compose exec backend npm run db:studio` → http://localhost:5555

---

## Manual Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7

### Backend

```bash
cd backend
npm install
cp ../.env.example .env   # fill in values

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed database
npm run db:seed

# Start dev server
npm run dev        # runs on :4000
```

### Frontend

```bash
cd frontend
npm install

# Start dev server
npm run dev        # runs on :3000
```

---

## Environment Variables

See [.env.example](./.env.example) for the full list. Critical variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | 64+ char secret for access tokens |
| `JWT_REFRESH_SECRET` | 64+ char secret for refresh tokens |
| `AFRICAS_TALKING_API_KEY` | Africa's Talking API key |
| `AFRICAS_TALKING_USERNAME` | `sandbox` for testing |
| `SELCOM_API_KEY` | Selcom API key |
| `SELCOM_API_SECRET` | Selcom API secret |
| `SELCOM_VENDOR_ID` | Selcom vendor ID |
| `AWS_ACCESS_KEY_ID` | AWS credentials for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for S3 |
| `AWS_S3_BUCKET` | S3 bucket name for uploads |

---

## Database Schema

### Tables

| Table | Purpose |
|---|---|
| `users` | All users (customers, merchants, admins) with KYC status |
| `transactions` | Core escrow transactions with status machine |
| `milestones` | Milestone-based sub-transactions |
| `disputes` | Dispute cases with evidence URLs |
| `deliveries` | Delivery tracking and OTP confirmation |
| `ratings` | Post-transaction ratings (1–5 stars) |
| `notifications` | In-app notification center |
| `audit_logs` | Immutable audit trail of all fund movements |

### Transaction Status Machine

```
PENDING → [deposit + OTP] → HELD
HELD → [customer release + OTP] → RELEASED
HELD → [dispute raised] → DISPUTED
DISPUTED → [admin resolves] → RELEASED | REFUNDED
PENDING → [customer cancel] → CANCELLED
```

---

## API Documentation

All endpoints are prefixed with `/api`. Authentication via `Authorization: Bearer <token>`.

### Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register with phone, password, role |
| POST | `/verify-registration` | Verify registration OTP |
| POST | `/login` | Login with phone + password (sends OTP) |
| POST | `/verify-otp` | Verify login OTP → receive JWT |
| POST | `/refresh-token` | Get new access token |
| POST | `/logout` | Blacklist current token |
| GET | `/me` | Get current user profile |

### Transactions — `/api/transactions`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Create new escrow transaction |
| GET | `/` | List transactions (paginated) |
| GET | `/:id` | Get transaction details |
| POST | `/:id/deposit` | Initiate deposit (sends OTP) |
| POST | `/:id/deposit/verify` | Verify deposit OTP → Selcom payment |
| POST | `/:id/confirm-delivery` | Confirm delivery with OTP |
| POST | `/:id/release` | Release funds to merchant (OTP required) |
| POST | `/:id/cancel` | Cancel PENDING transaction |

### Milestones — `/api`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/transactions/:id/milestones` | Create milestones for transaction |
| GET | `/transactions/:id/milestones` | List milestones |
| POST | `/milestones/:milestoneId/request-otp` | Request OTP to confirm milestone |
| POST | `/milestones/:milestoneId/confirm` | Confirm milestone with OTP |

### Disputes — `/api`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/transactions/:id/dispute` | Raise dispute |
| POST | `/disputes/:id/evidence` | Upload evidence files (multipart) |
| GET | `/disputes` | List disputes for current user |
| POST | `/disputes/:id/resolve` | Resolve dispute (admin only) |

### Deliveries — `/api`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/transactions/:id/delivery` | Log delivery + generate OTP |
| POST | `/transactions/:id/delivery/verify-otp` | Verify delivery OTP |

### Ratings — `/api/ratings`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Submit rating for completed transaction |
| GET | `/user/:userId` | Get all ratings for a user |

### Payments — `/api/payments`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/webhook` | Selcom webhook handler |
| GET | `/:transactionId/status` | Get payment status |

### Admin — `/api/admin`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` | Platform analytics dashboard |
| GET | `/disputes` | Dispute queue (fast-track prioritized) |
| GET | `/users` | User management with search/filter |
| PATCH | `/users/:userId/kyc` | Approve or reject KYC |
| PATCH | `/users/:userId/toggle-status` | Suspend or activate user |
| POST | `/transactions/:transactionId/release` | Admin manual release/refund |

### Notifications — `/api/notifications`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List notifications (paginated) |
| GET | `/unread-count` | Get unread notification count |
| PATCH | `/:id/read` | Mark notification(s) as read |

---

## Core Transaction Flow

```
1. Customer initiates transaction
   → Enters merchant phone, amount, agreement description
   → Both parties receive SMS notification

2. Customer deposits funds
   → Customer requests deposit → OTP sent to phone
   → Customer enters OTP → Selcom payment initiated
   → Selcom webhook fires → funds move to HELD status
   → Merchant notified via SMS

3. Merchant delivers
   → Merchant logs delivery → OTP sent to customer's phone
   → Courier/merchant enters OTP to confirm handover
   → Inspection window countdown begins (default 48h)

4. Customer confirms
   → Customer reviews and confirms → requests release OTP
   → Enters OTP → funds disbursed to merchant via Selcom
   → Both parties rate each other (1–5 stars)

5. Dispute path
   → Either party raises dispute during inspection window
   → Both upload evidence to S3
   → Admin reviews and resolves within 5–7 days (24h fast-track)
   → Admin releases to merchant, refunds customer, or splits
```

---

## Test Credentials

After running `npm run db:seed`:

| Role | Phone | Password |
|---|---|---|
| Admin | +255700000001 | Admin@1234 |
| Merchant 1 (Electronics) | +255712000001 | Merchant@1234 |
| Merchant 2 (Fashion) | +255712000002 | Merchant@1234 |
| Customer 1 (KYC approved) | +255754000001 | Customer@1234 |
| Customer 2 (KYC pending) | +255754000002 | Customer@1234 |

Pre-seeded transactions cover every status: `PENDING`, `HELD` (with milestones), `DISPUTED`, `RELEASED`, `CANCELLED`.

---

## Deployment

### AWS EC2 / Google Cloud

```bash
# Build and push images
docker compose build
docker tag escrow255-backend:latest <ecr-url>/escrow255-backend:latest
docker tag escrow255-frontend:latest <ecr-url>/escrow255-frontend:latest
docker push <ecr-url>/escrow255-backend:latest
docker push <ecr-url>/escrow255-frontend:latest

# On server
docker compose -f docker-compose.yml up -d
```

### SSL / HTTPS

Use Nginx as reverse proxy with Let's Encrypt:
- Frontend: `escrow255.co.tz` → `:3000`
- API: `api.escrow255.co.tz` → `:4000`

### Environment for production

Set `NODE_ENV=production` and ensure:
- Strong `JWT_SECRET` (≥ 64 chars, random)
- Real Africa's Talking credentials (not sandbox)
- Selcom production API endpoints
- S3 bucket with appropriate IAM policy
- Redis with `requirepass` set

---

## Security Notes

- All fund state transitions use database transactions (atomic)
- OTP required for: login, fund deposit, fund release, delivery confirmation
- JWT access tokens expire in 15 minutes; refresh tokens in 7 days
- Blacklisted tokens stored in Redis until natural expiry
- Rate limiting: 10 auth requests / 15 min, 5 payment requests / minute
- All uploaded files validated for type and size before S3 upload
- Selcom webhook signature verified via HMAC-SHA256
- Input validated with Zod on every endpoint

---

*Built for Tanzania 🇹🇿 — Escrow255, Dar es Salaam*
