import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * The two server entry points must agree on what the app actually does.
 *
 * `_core/index.ts` runs in development, `_core/prod-entry.ts` is what the
 * Dockerfile builds and what customers hit. Anything wired into one and
 * forgotten in the other works perfectly on the developer's machine and is
 * simply absent in production — with no error, because nothing is broken, it
 * just never runs.
 *
 * Two of those have already been found this way:
 *
 *   - The /uploads route. Photos taken at the China warehouse uploaded fine
 *     and their URLs were saved, but fetching one returned index.html with a
 *     200, so the image silently rendered as nothing.
 *   - The scheduled push campaign poller. Campaigns sat in the table and their
 *     send time passed in silence.
 *
 * Both were invisible until a person noticed something missing weeks later.
 * This test makes the third one fail in CI instead.
 */

const DEV = fs.readFileSync(path.resolve(__dirname, '_core/index.ts'), 'utf8');
const PROD = fs.readFileSync(path.resolve(__dirname, '_core/prod-entry.ts'), 'utf8');

/**
 * Background work and routes that must exist in both. Deliberately not the
 * whole file: the entries legitimately differ on how they build and migrate
 * (vite middleware in dev, autoMigrate in prod). What must not differ is
 * anything the running business depends on.
 */
const MUST_BE_IN_BOTH: { name: string; token: string; why: string }[] = [
  { name: 'health checks', token: 'registerHealthRoutes', why: 'load balancers probe this' },
  { name: 'OAuth callback', token: 'registerOAuthRoutes', why: 'sign-in returns here' },
  { name: 'app icons / manifest', token: 'registerAppIconRoutes', why: 'the installable app reads it' },
  { name: 'uploads route', token: 'UPLOADS_ROUTE', why: 'stored photos are served from it' },
  { name: 'tracking alerts', token: 'scheduleTrackingAlertNotifications', why: 'orders waiting on a tracking' },
  { name: 'open box reminders', token: 'scheduleOpenBoxAlerts', why: 'boxes left open past their window' },
  { name: 'push campaigns', token: 'startScheduledCampaignsPoller', why: 'scheduled campaigns never send without it' },
  { name: 'scheduled backups', token: 'initializeScheduledBackups', why: 'the only copy of the data' },
  { name: 'rate limiting', token: 'globalLimiter', why: 'abuse protection' },
  { name: 'login rate limiting', token: 'authLimiterMiddleware', why: 'password guessing' },
  { name: 'security headers', token: 'helmet', why: 'clickjacking and MIME sniffing' },
  { name: 'request logging', token: 'requestLoggingMiddleware', why: 'nothing is diagnosable without it' },
];

describe('the dev and production servers do the same job', () => {
  for (const { name, token, why } of MUST_BE_IN_BOTH) {
    it(`starts ${name} in both entries`, () => {
      const inDev = DEV.includes(token);
      const inProd = PROD.includes(token);

      expect(
        { dev: inDev, prod: inProd },
        `${name} is missing from ${inDev ? 'prod-entry.ts' : '_core/index.ts'} — ${why}`,
      ).toEqual({ dev: true, prod: true });
    });
  }

  it('serves uploads before the SPA catch-all', () => {
    // Ordering matters as much as presence: registered after the catch-all,
    // every image request would still resolve to index.html.
    const uploadsAt = PROD.indexOf('UPLOADS_ROUTE, express.static');
    const catchAllAt = PROD.indexOf('app.use("*"');

    expect(uploadsAt).toBeGreaterThan(-1);
    expect(catchAllAt).toBeGreaterThan(-1);
    expect(uploadsAt, 'the uploads route must be registered before the SPA fallback').toBeLessThan(catchAllAt);
  });
});
