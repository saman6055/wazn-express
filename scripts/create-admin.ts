/**
 * Create or reset the default admin user for staff login.
 * Run: pnpm exec tsx scripts/create-admin.ts
 * Optional: ADMIN_PASSWORD=yourpassword pnpm exec tsx scripts/create-admin.ts
 */
import "dotenv/config";
import * as bcrypt from "bcryptjs";
import { getDb } from "../server/db/connection";
import { getUserByUsername, createStaffUser, updateUserPassword } from "../server/db/admin.db";

const ADMIN_USERNAME = "admin";
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("❌ DATABASE_URL not set or database unavailable. Check your .env file.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  let user = await getUserByUsername(ADMIN_USERNAME);

  if (user) {
    await updateUserPassword(user.id, hash);
    console.log(`✅ Admin user "${ADMIN_USERNAME}" password updated.`);
  } else {
    await createStaffUser({
      name: "Admin",
      username: ADMIN_USERNAME,
      passwordHash: hash,
      role: "admin",
    });
    console.log(`✅ Admin user "${ADMIN_USERNAME}" created.`);
  }

  console.log(`   Username: ${ADMIN_USERNAME}`);
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`   (To set a custom password: ADMIN_PASSWORD=yourpass pnpm exec tsx scripts/create-admin.ts)`);
  }
  process.exit(0);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("❌ Error:", msg);
  const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : null;
  const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code: string }).code : null;
  if (code === "ECONNREFUSED") {
    console.error("\n   پەیوەندی بە MySQL ڕەتکرایەوە (Connection refused).");
    console.error("   دڵنیابە MySQL سێرڤەر چالاکە و DATABASE_URL لە .env ڕاستە (host, port, user, password).");
  }
  if (cause && typeof cause === "object") {
    const c = cause as Record<string, unknown>;
    if (c.code) console.error("   Code:", c.code);
    if (c.sqlMessage) console.error("   SQL message:", c.sqlMessage);
  }
  process.exit(1);
});
