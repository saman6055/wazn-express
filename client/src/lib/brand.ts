/**
 * The Wazn Express mark, shipped inside every build (client/public/brand).
 *
 * The logo uploaded in Settings lives in the uploads folder, and a redeploy
 * without a mounted volume takes that folder with it. That is how the company
 * logo vanished in September 2026: every login page, receipt and home-screen
 * icon fell back to a generic box. This copy cannot vanish — it is part of
 * the deploy itself. An uploaded logo still wins wherever one exists.
 */
export const BRAND_LOGO_URL = "/brand/wazn-logo.png";
