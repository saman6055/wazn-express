/**
 * Server configuration with startup validation.
 * Required env vars must be set; missing ones cause a clear error on load.
 * Do not use hardcoded fallbacks for secrets.
 */

const REQUIRED = [
  "DATABASE_URL",
  "JWT_SECRET",
  "MIGRATION_SECRET",
] as const;

const OPTIONAL = ["S3_BUCKET", "RESEND_API_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;

export type Config = {
  databaseUrl: string;
  jwtSecret: string;
  migrationSecret: string;
  s3Bucket: string | undefined;
  resendApiKey: string | undefined;
  vapidPublicKey: string | undefined;
  vapidPrivateKey: string | undefined;
  vapidSubject: string | undefined;
};

const state: { loaded: boolean; config: Config | null } = {
  loaded: false,
  config: null,
};

function validate(): Config {
  const missing: string[] = [];
  for (const key of REQUIRED) {
    const value = process.env[key];
    if (value === undefined || value.trim() === "") {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Set them in .env or your deployment environment. Do not use hardcoded secrets."
    );
  }

  return {
    databaseUrl: process.env.DATABASE_URL!,
    jwtSecret: process.env.JWT_SECRET!,
    migrationSecret: process.env.MIGRATION_SECRET!,
    s3Bucket: process.env.S3_BUCKET?.trim() || undefined,
    resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || undefined,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || undefined,
    vapidSubject: process.env.VAPID_SUBJECT?.trim() || undefined,
  };
}

/**
 * Load and validate config. Call once at server startup (e.g. in startServer()).
 * Throws if any required env var is missing.
 */
export function loadConfig(): Config {
  if (state.loaded && state.config) return state.config;
  state.config = validate();
  state.loaded = true;
  return state.config;
}

/**
 * Get the validated config. Must call loadConfig() at startup first.
 */
export function getConfig(): Config {
  if (!state.loaded || !state.config) {
    throw new Error(
      "Config not loaded. Call loadConfig() at server startup (e.g. at the start of startServer())."
    );
  }
  return state.config;
}
