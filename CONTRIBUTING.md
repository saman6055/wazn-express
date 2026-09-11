# Contributing to Wazn Express

Short rules that keep the system in one piece. Most are enforced by a test, and
the test's comment says why. Architecture: `docs/ARCHITECTURE.md`.

## The three checks
Run all three, and read each exit code before committing:

```bash
npx tsc --noEmit
npx vitest run client/src shared server/<files you touched>
npm run build
```

A pipe hides a failure: `npx vitest run … | tail` always "passes". Run each
check to a file, keep its own exit code, commit only when all are 0.
Known red before any change: `server/batch-shipment-info.test.ts` and
`server/batchStatusHistory.test.ts`; DB-dependent suites skip without a database.
The dev server needs the database; when it is unreachable, these checks are the
verification — say so, and check the live site after the redeploy.

## Commits and deploys
- One concern per commit. The subject says what the user sees; the body says
  why and what was checked.
- Push to `main`. Coolify does **not** auto-deploy: press Redeploy, then confirm
  the new build by its content, not its asset hash.

## Where things go
- `client/src/pages` — one file per route (registered in `App.tsx`);
  `pages/portal` — the customer portal, in three skins (classic, `modern/`, `skin3/`).
- `client/src/components` — shared UI; `components/ui` — shadcn primitives
  (`data-slot`); `components/portal` — portal pieces.
- `client/src/lib` — pure helpers; `hooks` — data hooks; `contexts` — providers;
  `constants` — fixed data (terms, guide, contact channels).
- `server/routers` — tRPC routers; `server/db` — drizzle queries;
  `server/services` — side effects (PDF, push, SSE, backups);
  `server/_core` — entries, context, tRPC setup; `server/lib` — pure helpers.
- `shared` — rules both sides must agree on (charge policy, phone, lockout, errors).

## Adding a screen
1. **Server:** the narrowest procedure that works; `customerProcedure` for
   anything a customer reads. Return allow-listed fields — never a whole account
   row.
2. **Route:** a page under `pages/`, a `<Route>` in `App.tsx`, a sidebar entry and
   a `PATH_TO_MODULE` mapping in `usePermissions`, so it can be granted and
   refused.
3. **Text:** all four languages (ku, ar, en, zh) in the locale files, or
   `pickLang` with all four. Kurdish is Sorani (`ckb`), never `ku` in `Intl`.
4. **Numbers:** only through the shared formatters — digits 0-9 in every
   language, `dir="ltr"` for codes, phones and amounts inside RTL text.
5. **Colours:** statuses from `statusTone`; semantic green/amber/red for
   done/waiting/problem.
6. **Print and export:** values through `escapeHtml`, printed with
   `printWhenReady` from the opener; exports through `lib/csv.ts`.
7. **Failure:** a query that can fail shows an error state with a retry
   (`PortalErrorState` in the portal) — never an empty "no records".
8. **Server runtime:** anything the server needs at runtime is registered in
   both entries (see `entry-parity.test.ts`).
9. **A test for any rule you add.** If it reads source, make a missing marker
   fail, not pass silently.

## Style
- Logical properties (`ms`/`me`, `ps`/`pe`, `start`/`end`): Kurdish and Arabic
  are right-to-left.
- Fields are 16px on phones (`text-base md:text-sm`); touch targets come from the
  shared `Button` sizes.
- Comments say why, in plain words, next to the code they explain.
