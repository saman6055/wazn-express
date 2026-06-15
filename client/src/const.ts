export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Resolve the login URL at runtime.
 *
 * When OAuth is configured (VITE_OAUTH_PORTAL_URL + VITE_APP_ID present),
 * sign-in routes through the OAuth flow regardless of caller context.
 *
 * Otherwise, pick the correct in-app login page based on where the user
 * currently is: a customer on `/portal/*` should land on `/customer-login`,
 * not `/staff-login` (which used to send them to the staff form and
 * leave them stranded after a portal session expired — they couldn't
 * even type their credentials).
 */
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  if (!oauthPortalUrl || !appId || typeof oauthPortalUrl !== "string") {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    // /portal/* and /customer-login both belong to the customer surface;
    // anything else routes back to /staff-login.
    const isCustomerSurface = path.startsWith("/portal") || path.startsWith("/customer-login");
    return `${origin}${isCustomerSurface ? "/customer-login" : "/staff-login"}`;
  }
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
