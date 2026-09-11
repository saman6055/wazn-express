# Architecture — Wazn Express

How a shipment's data travels from the database to a customer's phone, and
where each rule lives. For setup see `LOCAL-SETUP.md`; for deploying,
`docs/REDEPLOY.md`; for the product and its flows, `docs/SYSTEM-BRAIN.md`.

## The shape

```
MySQL ─ drizzle queries (server/db/*.db.ts) ─ tRPC routers (server/routers/*)
                                                  │  superjson over /api/trpc
browser ─ httpBatchLink (client/src/main.tsx) ─ react-query cache ─ pages/components
                                                  │
live ─ /api/portal/events (SSE) ─ usePortalSSE / usePortalRealtime ─ refreshes queries
```

### Server
- **Two entries.** `server/_core/prod-entry.ts` is production (bundled to
  `dist/index.js` by `npm run build`); `server/_core/index.ts` is the dev server.
  Anything the running business needs is registered in both —
  `server/entry-parity.test.ts` lists it (health, OAuth, uploads, SSE, backup
  download, client error reports, trust proxy, rate limits, helmet, logging).
  Routes shared by both live in their own modules (`portalEventsRoute.ts`,
  `backupFileRoute.ts`, `clientErrorsRoute.ts`).
- **Procedures.** `publicProcedure` → `protectedProcedure` (signed in; the
  read-only auditor is refused every mutation here, once) → `staffProcedure`,
  `accountantProcedure`, `adminProcedure`, `superAdminProcedure`
  (`server/middleware/auth.ts`) and `customerProcedure`, which scopes every
  portal read to `ctx.customerId` (pinned by `portal-isolation.test.ts`).
- **Errors.** `server/_core/trpc.ts` formats every error. A server fault gets a
  reference (`7F3A9C21`) and one log line with the whole cause; staff see the
  cause plus the reference; customers see one sentence in their language (from
  the `x-wazn-lang` request header) plus the reference
  (`server/_core/clientError.ts`, `shared/errorMessages.ts`).
- **Accounts.** No endpoint returns an account row as-is: `withoutSecrets()` and
  `sessionAccount()` in `server/lib/accountSecrets.ts`.

### Client
- **Data.** tRPC + @tanstack/react-query v5; defaults in `client/src/main.tsx`
  (staleTime 2 min, no refetch on focus; retries only for server faults and
  dropped connections, never for a 4xx). A dropped connection becomes a
  `NetworkFault` with a sentence in the reader's language
  (`client/src/lib/networkFault.ts`).
- **Keeping screens current.** Staff mutations invalidate their queries. The
  portal hears changes live: `server/services/portalEvents.service.ts` →
  `/api/portal/events` → `client/src/hooks/usePortalSSE.ts` →
  `usePortalRealtime.ts`, which refreshes what changed; the channel reconnects
  the moment the browser comes back online.
- **Layouts and failure.** Each page renders its layout (`DashboardLayout`, or one
  of the three portal skins). A crash inside a page is caught by
  `SectionBoundary` in the layout (the shell survives, the error clears on the
  next address); outside it, by `QueryErrorBoundary` and `ErrorBoundary`. All of
  them use `buildErrorReport()` / `getErrorBoundaryStrings()` (the owner's rule:
  every failure offers "copy details") and report to `/api/client-errors`,
  which scrubs and logs (`server/lib/scrub.ts`).
- **Sign-out** empties the query cache and the person's stored lists
  (`client/src/lib/signOut.ts`); customers are never signed out by time.

## One rule, one home

| Concern | Lives in | Guarded by |
|---|---|---|
| Status colours | `client/src/lib/statusTone.ts` | `status-tone.test.ts` |
| Money, weight, CBM text | `lib/portalFormat.ts`, `lib/format.ts`, `components/ui/money.tsx` | `number-display.test.ts` |
| Dates (28/07/2026) | `lib/numericDate.ts`, `lib/portalClock.ts` | `numeric-dates.test.ts` |
| Digits 0-9 in every language | locales + the formatters above | `english-digits.test.ts` |
| Text written into print windows | `lib/html.ts` (`escapeHtml`, `openExternal`) | `print-escaping.test.ts` |
| Print triggers (no inline script) | `lib/printWindow.ts` | `print-triggers.test.ts` |
| CSV exports | `lib/csv.ts` | `csv-safety.test.ts` |
| Routes and links | `client/src/App.tsx` | `routes-and-access.test.ts` |
| Support WhatsApp number | `constants/whatsapp.ts` | `portal-audit.test.ts` |
| Business rules both sides use | `shared/*.ts` | their own tests |

## Production posture
- **Security policy:** helmet defaults, plus `frame-src` YouTube and `img-src`
  `https:`/`blob:`. `script-src 'self'` — no inline script anywhere: print
  windows are printed from the opener (`printWhenReady`), the theme bootstrap
  is `/theme-init.js`.
- **Proxies:** `trust proxy` = `TRUST_PROXY_HOPS` (default 1 — Coolify; 2 with a
  CDN in front; never `true`).
- **Caching:** `/api` no-store; `index.html` no-cache; `/assets` a year,
  immutable; `/uploads` private. Unknown `/api` paths and missing build files
  are 404s.
- **Build:** the Manus editor plugins run only under `vite serve`;
  `console.log/debug/info` are dropped from the bundle.

## Known debt
- A runtime import cycle: `server/db/batches.db.ts` ↔ `server/db/portal.db.ts`.
- Dependencies no source file uses: `add`, `pnpm`, `bcrypt` (`bcryptjs` is the one
  in use), `next-themes`, `tailwindcss-animate`, `@hookform/resolvers`,
  `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@tailwindcss/typography`,
  `postcss`, `autoprefixer`, `vazirmatn`. Remove with `pnpm remove …` (it
  rewrites the lockfile).
- Large lists render every row: Customers, Accounting (one balance request per
  row), the order dashboards. They need paging.
- `client/src/pages/Finance.tsx` and `CustomerFinance.tsx` still write print
  windows and CSVs the old way (another session owned them during the audit).
