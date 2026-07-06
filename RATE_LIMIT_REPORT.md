# Wazn Express — Rate Limit Investigation (Read-Only)

**Scope:** Find why the developer's IP gets blocked from the production server during normal work, recovers after ~1 hour or after a WiFi switch, and break the cause down honestly.

**Repo state:** read-only. Only this file is added.

---

## ⚠ Premise correction

The brief framed Wazn Express as **NestJS + Next.js**. It is not.

Wazn Express is **Express.js + tRPC + React (Vite)**. There is:
- no `@nestjs/throttler`
- no `app.module.ts`
- no `@Throttle` / `@SkipThrottle` decorators
- no `APP_GUARD`

The investigation therefore looks at the *real* surface: a single `express-rate-limit` middleware mounted in two server entry files, plus client polling intervals.

The Vetsa-side root cause (`trust proxy` unset → counter is global, not per-IP) **transfers cleanly** to this stack, because `express-rate-limit`'s default key is also `req.ip`.

---

## Phase A — Every rate-limit / throttle / block surface

### A.1 The middleware file

**[server/middleware/rateLimiter.ts](server/middleware/rateLimiter.ts)** defines four limiters. Production values (the `isDev ? X : Y` ternary uses the prod number):

| Limiter             | File:line                             | Window | Prod limit | Dev limit | Key |
|---------------------|---------------------------------------|--------|------------|-----------|-----|
| `globalLimiter`     | rateLimiter.ts:7                      | 60 s   | **500**    | 10 000    | default `req.ip` |
| `authLimiter`       | rateLimiter.ts:16                     | 15 min | **10**     | 50        | default `req.ip` |
| `mutationLimiter`   | rateLimiter.ts:25                     | 60 s   | 100        | 500       | default `req.ip` |
| `fileUploadLimiter` | rateLimiter.ts:34                     | 60 s   | 30         | 100       | default `req.ip` |

None of the limiters configure `keyGenerator`, `skip`, `skipFailedRequests`, or `skipSuccessfulRequests`. Verified by `grep -i "keyGenerator\|skip:\|skipFailedRequests\|skipSuccessfulRequests" server/` → no hits other than an unrelated comment.

### A.2 Where they're mounted

```
server/_core/index.ts:63          app.use(globalLimiter);            ← dev entry
server/_core/index.ts:119         authLimiterMiddleware,             ← only on /api/trpc

server/_core/prod-entry.ts:106    app.use(globalLimiter);            ← prod entry
server/_core/prod-entry.ts:117    authLimiterMiddleware,             ← only on /api/trpc
```

So **every request to the Express app goes through `globalLimiter` first**. Health checks, `/api/trpc`, OAuth callback, `/uploads`, static assets — all of it.

`mutationLimiter` and `fileUploadLimiter` are exported but **never imported anywhere outside the file itself** (verified by `grep "mutationLimiter\|fileUploadLimiter" server/`). They are dead code today.

`authLimiterMiddleware` only fires for two procedures (`auth.customerLogin`, `auth.staffLogin`) inside `/api/trpc` — see `AUTH_LOGIN_PROCEDURES` at rateLimiter.ts:43.

### A.3 Other rate-limit / block mechanisms

**Searched and not found:**
- `express-slow-down` — not in `package.json`
- `bottleneck` — not in `package.json`
- `rate-limiter-flexible` — not in `package.json`
- Custom `*RateLimit*` / `*Throttle*` / `*Block*` middleware — none
- `IpFilterGuard` / `IpFilterMiddleware` — none

**`package.json` has only:** `"express-rate-limit": "^8.2.1"`.

### A.4 Reverse-proxy / orchestration config in this repo

Searched `find . -name "Caddyfile" -o -name "nginx*.conf" -o -name "traefik*.y*ml" -o -name "*.compose.y*ml"`:
- **No `Caddyfile`** in repo
- **No `nginx.conf`** in repo
- **No `traefik.yml`** in repo
- **No `docker-compose*.yml`** in repo
- Only [Dockerfile](Dockerfile) (image build) and [nixpacks.toml](nixpacks.toml) (Coolify build hints)

The reverse proxy lives **outside the repo** — see [docs/SERVER-INVESTIGATION-REPORT.md](docs/SERVER-INVESTIGATION-REPORT.md):
- Server runs **Coolify + Traefik** as the reverse proxy (line 17, 22, 32)
- The app container exposes port 3000 internally; Traefik forwards `:443` → container
- No fail2ban, no Cloudflare, no CrowdSec, no ModSecurity mentioned

[docs/DEPLOYMENT-PLAN.md](docs/DEPLOYMENT-PLAN.md) describes an *alternative* nginx-on-host setup (sections 1.7, 6.x) that is **not the production deployment** — it's a fallback path. Production is the Coolify+Traefik path.

### A.5 IP allowlist

There **is** an `ip_whitelist` table ([server/_core/migrations.ts:135](server/_core/migrations.ts), CRUD in [server/db/settings.db.ts:552-613](server/db/settings.db.ts)) with admin endpoints in [server/routers/settings.router.ts:743-760](server/routers/settings.router.ts).

**However:** `grep "isIpWhitelisted\|getActiveWhitelistedIps" server/` shows the helper is **only called from the test file** ([server/advancedSettings.test.ts:211](server/advancedSettings.test.ts)). **No middleware consults it.** The feature is a dormant CRUD admin panel — adding a row does nothing at request time.

---

## Phase B — Math against the limit

### B.1 Polling intervals discovered (`grep "refetchInterval" client/src`)

| Component                                           | Interval | When active |
|-----------------------------------------------------|----------|-------------|
| `DashboardLayout.tsx:165` — unread message count    | **15 s** | Every dashboard page |
| `LiveChatSupport.tsx:92`  — chat poll               | **5 s**  | Live chat widget mounted |
| `LiveChatSupport.tsx:565` — chat presence           | **30 s** | Live chat widget mounted |
| `CustomerMessages.tsx:49` — chat list               | **5 s**  | Customer messages page |
| `CustomerMessages.tsx:58` — current chat            | **3 s**  | Inside an open chat |
| `PortalMessages.tsx:89`                             | **5 s**  | Portal messages page |
| `BoxDetailPanel.tsx:94`                             | **5 s**  | Delivery box detail open |
| `SystemMonitorDashboard.tsx:219,224`                | **30 s** | When auto-refresh on |

React Query global defaults ([client/src/main.tsx:52-66](client/src/main.tsx)): `staleTime: 2min`, `refetchOnWindowFocus: false`, `retry: up to 2`. So query invalidations and explicit `refetchInterval` drive most traffic; background tab focus does not.

### B.2 Per-hour requests for one developer working

Each request = 1 tick against `globalLimiter` (window 60 s, max 500/min).

**Developer with admin dashboard idle (one tab):**
- DashboardLayout unread poll: 60 / 15 = **4/min** = **240/hr**
- The dashboard view itself fires several queries on load + on tab navigation (~10–30 reqs)
- Per-page queries on revisit (within `staleTime` they're cached, beyond it they refetch)

**Developer doing real work (clicks, navigates, mutates):**
- Dashboard tab continues at ~4/min just for unread count
- Each navigation triggers a small burst (5–15 queries per page)
- Mutations (creating an order, updating status, etc.) are 1 request each plus invalidations
- **Realistic total: 200–500 req/hour from one tab.**

**Two tabs (admin panel + POS / portal):**
- The unread-count poll alone fires **twice** = 8/min = **480/hr**
- LiveChatSupport, if mounted, adds **12/min** = **720/hr** at the 5-sec interval (× number of tabs that mount it)
- Plus normal interactive load.

**One staff + one customer + one developer all working at the same time:**
- Each can independently consume the global budget — but see Phase C, that's where it all collapses.

### B.3 Comparison to the `globalLimiter` ceiling

`globalLimiter` is **500 requests per minute per IP** in production.

Per-minute, that is generous. Per-hour the equivalent is **30 000 — IF the budget is per-IP**.

The hourly symptom you describe ("blocked, comes back after ~1 hour or new WiFi") does **not** match a 60-second sliding window. A 60-sec window resets within seconds, not an hour. So either:

1. The `Retry-After` header is sending the user's browser into a longer back-off (unlikely to last 1 hour), or
2. **The limit is being hit *globally*, not per-IP — see Phase C.** The "1 hour" is a coincidence of when the *aggregated* traffic from all users finally drops below 500/min for long enough that the user's current tab can break through.

Either way, the apparent "1-hour or new-WiFi recovery" pattern is the same shape Vetsa had, and points to the same diagnosis.

---

## Phase C — Trust-proxy verdict

> Is `app.set('trust proxy', ...)` configured anywhere? **NO.**

Evidence (read-only greps):

```
$ grep -nE "trust\s*proxy|trustProxy|app\.set\(|expressApp\.set\(" server/
   (no matches)
```

Both server entries:
- [server/_core/index.ts](server/_core/index.ts) (dev) — creates `const app = express()` at line 34, never calls `app.set(...)`
- [server/_core/prod-entry.ts](server/_core/prod-entry.ts) (prod) — creates `const app = express()` at line 77, never calls `app.set(...)`

> Is a custom `keyGenerator` on any limiter? **NO.**

Verified at [server/middleware/rateLimiter.ts:7-40](server/middleware/rateLimiter.ts) — every `rateLimit({...})` call passes only `windowMs`, `max`, `standardHeaders`, `legacyHeaders`, `message`. `keyGenerator` defaults to `req.ip`.

> What does `req.ip` evaluate to in production?

In production the path is:

```
client (real IP)
   ↓
Traefik (Coolify proxy container)
   ↓ X-Forwarded-For: <real-IP>
Express app container (req.socket.remoteAddress = Traefik's container IP)
```

Without `app.set('trust proxy', ...)`, Express ignores `X-Forwarded-For` entirely and `req.ip` returns `req.socket.remoteAddress`. That value is **the Traefik container's IP — the same address for every user, every request.**

`express-rate-limit` keys by `req.ip` by default ([source: docs/express-rate-limit](https://express-rate-limit.mintlify.app/reference/configuration#keygenerator)). So **every request from every user — admin, staff, customers, developer, healthchecks — is bucketed into one shared 500-req/min counter**.

### Verdict

> **Same root cause as Vetsa: trust-proxy is unset, so the rate limit is effectively global, not per-IP.**

This is a **P0 finding**.

The 1-hour/new-WiFi "recovery" is not the rate limiter's TTL — it's that traffic patterns from *other* users dipped enough for the global counter to drop below 500/min long enough for your refresh to land. New WiFi changes nothing for the server (since the server already saw all users as one IP); what likely changes is *time elapsed* between attempts. The correlation with WiFi-switch is coincidence.

---

## Phase D — Side-by-side comparison

| Finding | Vetsa | Wazn Express |
|---|---|---|
| Throttler library | `@nestjs/throttler` | `express-rate-limit` |
| Global APP_GUARD? | Yes | Yes (`app.use(globalLimiter)` at [prod-entry.ts:106](server/_core/prod-entry.ts)) |
| short / medium / long limits | 10 / sec, 100 / min, 1000 / hr | 500 / min global; 10 / 15 min auth |
| `app.set('trust proxy')` set? | **NO** | **NO** ([prod-entry.ts](server/_core/prod-entry.ts) — never called) |
| Custom `getTracker` / `keyGenerator`? | NO | NO ([rateLimiter.ts:7-40](server/middleware/rateLimiter.ts)) |
| Effective per-IP rate limit? | NO (global) | **NO (global)** |
| Auto-polling intervals (sec) | 15 s POS, 30 s rec | 15 s dashboard unread, 5 s chat, 3 s active chat, 30 s monitor |
| Estimated req/hr idle (one tab) | ~850 | ~250–500 |
| Estimated req/hr active (multi-tab) | 1200–1500 | 500–1500 |
| Reverse proxy in front | Caddy | Traefik (Coolify) |
| Caddy/Traefik rate-limit? | None | None in repo / no evidence in [SERVER-INVESTIGATION-REPORT.md](docs/SERVER-INVESTIGATION-REPORT.md) |
| Other rate-limit libs? | None | None |
| Fail2ban / Cloudflare? | None | None |
| Dormant IP allowlist table? | n/a | Yes ([ip_whitelist](server/_core/migrations.ts)), but **no middleware reads it** |
| **Same root cause as Vetsa?** | (baseline) | **YES** — trust-proxy missing, global counter |

---

## Phase E — Candidate fixes (do not apply)

Listed in order from least invasive to most. Numbers are approximate.

### Option 1 — Raise `globalLimiter` `max` (band-aid)

**What:** change `max: isDev ? 10000 : 500` → e.g. `max: isDev ? 10000 : 5000` at [rateLimiter.ts:9](server/middleware/rateLimiter.ts).
**Pros:** one-character fix; gets you unblocked today.
**Cons:** does not solve the real bug (counter still global). 5 000/min sounds high but on a busy day with many polling tabs it will still hit it eventually. Also weakens DDoS protection slightly.
**Risk:** Low.
**Verdict:** **Don't unless you need a same-day band-aid.** Doesn't address the root cause.

### Option 2 — Whitelist trusted IPs / SUPER_ADMIN bypass

**What:** the dormant `ip_whitelist` table already exists. Wire it up — either as a `keyGenerator` that returns a stable token for whitelisted IPs (so they share a higher budget), or as a `skip:` predicate that exempts them entirely. Or skip the limiter for authenticated `super_admin` sessions.
**Pros:** dev/owner unblocked even if global counter fills.
**Cons:** still doesn't fix the underlying global-counter issue for ordinary users. Whitelist needs upkeep. Without trust-proxy fixed, the IP you whitelist is *still* Traefik's container IP — so this only works in combination with Option 3, or as a session-based skip rather than IP-based.
**Risk:** Medium.
**Verdict:** **Consider** as a complement to Option 3, not a replacement.

### Option 3 — Fix `app.set('trust proxy', ...)`  ← **RECOMMENDED**

**What:** in [server/_core/prod-entry.ts](server/_core/prod-entry.ts) (and [index.ts](server/_core/index.ts) for dev parity), call `app.set('trust proxy', N)` where `N` is the number of proxy hops between client and app. With Coolify+Traefik directly in front, that's typically `1`. Verify by inspecting the `X-Forwarded-For` chain in a request log after deploy — `req.ip` should resolve to the actual client public IP, not `172.x.x.x`.
**Pros:** the root-cause fix. Suddenly each public IP gets its own 500/min budget. Fixes the problem for everyone, not just the developer. No other behavior changes meaningfully — `req.ip` becoming the real client IP is what most code expects anyway.
**Cons:** if `N` is set wrong (e.g. you set `true` on a setup where the user can spoof X-Forwarded-For directly), users could spoof their IP to evade the limit. With Coolify+Traefik that risk is low because the public entry is Traefik, which controls the header.
**Risk:** Low–Medium. The change itself is one line; the risk is picking the wrong hop count.
**Verdict:** **Recommend.** This is the equivalent of the fix you applied to Vetsa.

### Option 4 — Per-route limits instead of one global

**What:** remove `app.use(globalLimiter)`, mount tighter limiters per-route (`mutationLimiter` on POSTs, `fileUploadLimiter` on uploads, leave reads unlimited or with a generous cap). The existing limiters in [rateLimiter.ts](server/middleware/rateLimiter.ts) are already defined for this — they're just not wired up.
**Pros:** more honest threat model. Reads are cheap and high-volume; tight limits there are mostly hostile to your own users. Mutations and uploads are the parts that matter.
**Cons:** moderate refactor, especially across tRPC where individual procedures aren't separate Express routes — you'd need a tRPC middleware variant. Easy to miss endpoints during the transition.
**Risk:** Medium–High.
**Verdict:** **Consider after Option 3.** The current structure already exists; just plug it in.

### Option 5 — Redis-backed limiter store

**What:** replace `express-rate-limit`'s in-memory store with a Redis store, so counters survive container restarts and are shared across multiple replicas.
**Pros:** correct in a multi-replica deploy. Container restart no longer "resets the limit" silently.
**Cons:** the production deploy is single-replica today (one app container behind Traefik), so this is solving a problem you don't have yet. Adds a Redis dependency and one more failure mode (counter unavailable → fallback decisions to make).
**Risk:** Medium.
**Verdict:** **Don't unless you scale to multi-instance.**

---

## Recommended fix sequence

1. **Apply Option 3 first.** That alone almost certainly resolves the symptom.
2. After verifying real client IPs show up in logs, **leave Option 1's number where it is**. 500/min/IP is plenty.
3. If the developer still wants explicit insurance, layer Option 2 on top — wire `ip_whitelist` into a `skip:` predicate.
4. Option 4 is a longer-term cleanup, not urgent.
5. Option 5: defer.

---

## 5-line summary

1. **The rate limit is set at:** [server/middleware/rateLimiter.ts:7-13](server/middleware/rateLimiter.ts) (`globalLimiter`, 500 req/min in production), mounted at [server/_core/prod-entry.ts:106](server/_core/prod-entry.ts).
2. **Same root cause as Vetsa? YES.** `app.set('trust proxy', ...)` is never called in either server entry, and no `keyGenerator` is defined — so the limiter buckets all users into one counter via Traefik's container IP.
3. **Estimated req/hour for typical work:** 250–1500 from one developer's tabs, but the relevant comparison is the *global* aggregate from all users feeding into the same shared 500/min budget, which is easy to saturate.
4. **Top recommended fix:** call `app.set('trust proxy', 1)` in [prod-entry.ts](server/_core/prod-entry.ts) (and dev's [index.ts](server/_core/index.ts) for parity), then redeploy. One line, root cause solved.
5. **Different from Vetsa:** Wazn ships an `ip_whitelist` table + admin CRUD that **no middleware actually reads** — useful as the basis for Option 2 once trust-proxy is fixed; until then, adding a row does nothing at request time.
