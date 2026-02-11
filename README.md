# Wazn Express – Cargo Management System

**وەزن ئێکسپرێس – سیستەمی بەڕێوەبردنی بار**

A full-stack cargo and logistics management system for tracking packages, customers, invoices, and operations. Supports bilingual (English / Kurdish) UI and runs as a single deployable app.

---

## Description

- **English:** Wazn Express is a cargo management system for logistics companies. It handles package registration, tracking, customer accounts, invoicing, finance, and reporting with a React frontend and type-safe tRPC API.
- **کوردی:** وەزن ئێکسپرێس سیستەمێکی بەڕێوەبردنی بارە بۆ کۆمپانیاکانی لۆژستیک. تۆمارکردن و شوێنکەوتنی پاکێج، هەژمارەکانی کڕیار، فاکتور، دارایی و ڕاپۆرتەکان لەگەڵ ناوەڕۆکی React و APIی tRPCی type-safe پشتیوانی دەکات.

---

## Tech stack

- **Frontend:** React, TypeScript, Vite
- **API:** tRPC
- **ORM / DB:** Drizzle ORM, MySQL
- **UI:** Radix UI, Tailwind CSS

---

## Setup

### Install

```bash
pnpm install
```

### Run (development)

```bash
pnpm dev
```

Starts the API server and Vite dev server (client served with hot reload).

### Build (production)

```bash
pnpm build
```

Then run the server:

```bash
pnpm start
```

---

## Environment variables

Copy `.env.example` to `.env` and set values. Never commit `.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string (e.g. `mysql://user:password@host:3306/database`) |
| `JWT_SECRET` | Yes | Secret for signing JWT and session cookies (long random string) |
| `MIGRATION_SECRET` | Yes | Secret for one-time migration endpoint `POST /api/run-migration` |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (e.g. `http://localhost:5173`) |
| `S3_BUCKET` | No | S3 bucket for uploads (omit to disable) |
| `RESEND_API_KEY` | No | Resend API key for email (omit to disable) |
| `RESEND_FROM_EMAIL` | No | From address for emails |
| `VITE_APP_ID`, `OAUTH_SERVER_URL`, etc. | No | Optional OAuth/Forge if used |

---

## Project structure

```
wazn-express/
├── client/                 # React (Vite) frontend
│   ├── index.html
│   └── src/
│       ├── _core/          # Auth hooks, etc.
│       ├── components/     # Shared UI components
│       ├── contexts/      # Language, theme, offline
│       ├── hooks/         # Data & UI hooks
│       ├── lib/            # trpc client, utils, storage
│       ├── App.tsx
│       └── main.tsx
├── server/                 # Node API (tRPC, Express)
│   ├── _core/              # App entry, context, health, router
│   ├── db/                 # Drizzle connection & schema
│   ├── routers/            # tRPC routers
│   └── utils/              # Logger, etc.
├── shared/                 # Shared types and constants
├── drizzle/                # SQL migrations (Drizzle)
├── .env.example            # Env template
├── drizzle.config.ts
├── vite.config.ts
├── package.json
└── README.md
```

---

## License

MIT
